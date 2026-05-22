import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import pg from 'pg';
const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
dotenv.config();

// Cargar variables del dashboard en desarrollo si no están definidas en el entorno
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('⚠️ Advertencia: DATABASE_URL no encontrada en las variables de entorno.');
}

const pool = connectionString ? new Pool({ connectionString }) : null;

const app = express();
const PORT = process.env.PORT || 3001;

// Habilitar CORS
app.use(cors());

// Parsear JSON
app.use(express.json());

// Servir archivos estáticos del frontend
app.use(express.static(__dirname));

// Endpoint de prueba de conexión básica al proxy
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Proxy de Seq Monitor activo' });
});

// --- SISTEMA DE TAREAS ---
const TASKS_FILE = path.join(__dirname, 'tasks.json');

function loadTasks() {
  try {
    if (fs.existsSync(TASKS_FILE)) {
      const data = fs.readFileSync(TASKS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error al cargar tareas:', error);
  }
  return [];
}

function saveTasks(tasks) {
  try {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf8');
  } catch (error) {
    console.error('Error al guardar tareas:', error);
  }
}

let tasksList = loadTasks();
let pendingNotifications = [];

app.get('/api/tasks', (req, res) => {
  res.json(tasksList);
});

app.post('/api/tasks', (req, res) => {
  const newTask = req.body;
  if (!newTask.id) newTask.id = Date.now().toString();
  newTask.createdAt = new Date().toISOString();
  
  const existingIndex = tasksList.findIndex(t => t.id === newTask.id);
  if (existingIndex >= 0) {
    tasksList[existingIndex] = { ...tasksList[existingIndex], ...newTask };
  } else {
    tasksList.push(newTask);
  }
  saveTasks(tasksList);
  res.json(newTask);
});

app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  tasksList = tasksList.filter(t => t.id !== id);
  saveTasks(tasksList);
  res.json({ success: true });
});

app.get('/api/tasks/notifications', (req, res) => {
  res.json(pendingNotifications);
  pendingNotifications = []; // Limpiar despues de leer
});

// --- SISTEMA DE CONEXIONES CON POSTGRES (SUPABASE DIRECTO) ---

app.get('/api/connections', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'La base de datos no está configurada.' });
  }
  try {
    const result = await pool.query(
      'SELECT id, nombre, url, api_key FROM sat_monitoreo.seq_conexiones ORDER BY creado_en ASC'
    );

    const mapped = result.rows.map(item => ({
      id: item.id,
      name: item.nombre,
      url: item.url,
      apiKey: item.api_key
    }));

    res.json(mapped);
  } catch (error) {
    console.error('Error al obtener conexiones de la base de datos:', error);
    res.status(500).json({ error: 'Error al obtener conexiones', details: error.message });
  }
});

app.post('/api/connections', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'La base de datos no está configurada.' });
  }
  const { id, name, url, apiKey } = req.body;

  try {
    let result;
    if (id) {
      // Si el id es proporcionado (es UUID), actualizamos
      result = await pool.query(
        'UPDATE sat_monitoreo.seq_conexiones SET nombre = $1, url = $2, api_key = $3, actualizado_en = NOW() WHERE id = $4 RETURNING id, nombre, url, api_key',
        [name, url, apiKey, id]
      );
    } else {
      // Si no hay id, insertamos y la base de datos genera el UUID
      result = await pool.query(
        'INSERT INTO sat_monitoreo.seq_conexiones (nombre, url, api_key) VALUES ($1, $2, $3) RETURNING id, nombre, url, api_key',
        [name, url, apiKey]
      );
    }

    const row = result.rows[0];
    if (!row) {
      return res.status(404).json({ error: 'No se pudo guardar la conexión.' });
    }

    res.json({
      id: row.id,
      name: row.nombre,
      url: row.url,
      apiKey: row.api_key
    });
  } catch (error) {
    console.error('Error al guardar conexión en la base de datos:', error);
    res.status(500).json({ error: 'Error al guardar conexión', details: error.message });
  }
});

app.delete('/api/connections/:id', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'La base de datos no está configurada.' });
  }
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM sat_monitoreo.seq_conexiones WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar conexión en la base de datos:', error);
    res.status(500).json({ error: 'Error al eliminar conexión', details: error.message });
  }
});

// --- TAREAS EN SEGUNDO PLANO (SCHEDULER) ---
setInterval(async () => {
  const now = Date.now();
  for (let task of tasksList) {
    if (!task.lastRun || (now - task.lastRun) >= (task.intervalSeconds * 1000)) {
      task.lastRun = now;
      saveTasks(tasksList); // Guardar estado de ultima ejecucion
      
      try {
        // Ejecutar query
        const targetUrl = new URL('/api/events', task.seqUrl);
        if (task.query) targetUrl.searchParams.append('filter', task.query);
        targetUrl.searchParams.append('count', '50'); // Límite razonable para chequeos
        
        const headers = { 'Accept': 'application/json' };
        if (task.apiKey) headers['X-Seq-ApiKey'] = task.apiKey;

        const response = await fetch(targetUrl.toString(), { method: 'GET', headers });
        if (!response.ok) throw new Error(`Seq error: ${response.status}`);
        
        const data = await response.json();
        const events = data.Events || [];
        const count = events.length;

        // Evaluar condición
        let conditionMet = false;
        if (task.condition === 'is_empty') conditionMet = count === 0;
        else if (task.condition === 'is_not_empty') conditionMet = count > 0;
        else if (task.condition === 'count_greater_than') conditionMet = count > parseInt(task.conditionValue || 0);
        else if (task.condition === 'count_equal_to') conditionMet = count === parseInt(task.conditionValue || 0);

        if (conditionMet) {
          console.log(`[Task ${task.name}] Condición cumplida. Ejecutando acción: ${task.actionType}`);
          if (task.actionType === 'webhook' && task.actionWebhookUrl) {
            await fetch(task.actionWebhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ task, eventsCount: count, events })
            });
          } else if (task.actionType === 'notification') {
            pendingNotifications.push({ 
              id: Date.now(), 
              message: `[TAREA] ${task.name} - Condición cumplida (${count} resultados)` 
            });
          }
        }
      } catch (err) {
        console.error(`[Task ${task.name}] Error en ejecución:`, err.message);
      }
    }
  }
}, 5000); // Evaluar cada 5 segundos

// Proxy para consultar eventos en Seq
app.get('/api/seq/events', async (req, res) => {
  const { seqUrl, filter, count, render, afterId } = req.query;
  const apiKey = req.headers['x-seq-apikey'];

  if (!seqUrl) {
    return res.status(400).json({ 
      error: 'Falta parámetro requerido', 
      details: 'La URL de Seq (seqUrl) es obligatoria.' 
    });
  }

  try {
    // Validar y construir URL
    const targetUrl = new URL('/api/events', seqUrl);
    if (filter) targetUrl.searchParams.append('filter', filter);
    if (count) targetUrl.searchParams.append('count', count);
    if (render) targetUrl.searchParams.append('render', render);
    if (afterId) targetUrl.searchParams.append('afterId', afterId);

    const headers = {
      'Accept': 'application/json'
    };
    if (apiKey && apiKey.trim() !== '') {
      headers['X-Seq-ApiKey'] = apiKey.trim();
    }

    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: `Error de Seq (Status ${response.status})`,
        details: errorText || 'Error sin descripción de Seq.'
      });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    console.error('Error al conectar con Seq:', error);
    return res.status(502).json({
      error: 'Imposible conectar con Seq',
      details: `No se pudo establecer conexión con ${seqUrl}. Asegúrate de que Seq esté corriendo y la URL sea correcta. Error: ${error.message}`
    });
  }
});

// Arrancar servidor
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 Seq Monitor de Pruebas corriendo en:`);
  console.log(`   👉 http://localhost:${PORT}`);
  console.log(`==================================================`);
});
