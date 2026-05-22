/**
 * Script de prueba para validar el procesamiento de logs de Seq
 */
async function test() {
  try {
    const seqUrl = 'http://127.0.0.1:5341';
    const proxyUrl = `http://127.0.0.1:3001/api/seq/events?seqUrl=${encodeURIComponent(seqUrl)}&count=50&render=true`;
    
    console.log('Consultando proxy:', proxyUrl);
    const res = await fetch(proxyUrl);
    if (!res.ok) {
      console.error('Error de respuesta:', res.status, await res.text());
      return;
    }
    
    const data = await res.json();
    const logs = Array.isArray(data) ? data : (data.Items || []);
    console.log(`Se obtuvieron ${logs.length} logs.`);
    
    // Simular la lógica de app.js
    logs.forEach((log, index) => {
      try {
        const level = log.Level || 'Information';
        const date = new Date(log.Timestamp);
        const timeStr = date.toLocaleTimeString() + '.' + String(date.getMilliseconds()).padStart(3, '0');
        const message = log.RenderedMessage || log.MessageTemplate || '(Sin mensaje)';
        
        const propertiesData = {};
        if (log.Properties) {
          // Si es un array (API de Seq estándar)
          if (Array.isArray(log.Properties)) {
            log.Properties.forEach(p => {
              propertiesData[p.Name] = p.Value;
            });
          } else {
            // Si es un objeto plano
            Object.assign(propertiesData, log.Properties);
          }
        }
        
        if (log.Exception) {
          propertiesData['@Exception'] = log.Exception;
        }
        
        // Simular highlightJson
        const highlighted = JSON.stringify(propertiesData, null, 2);
        
        if (index === 0) {
          console.log('Primer log parseado con éxito:');
          console.log(`- Time: ${timeStr}`);
          console.log(`- Level: ${level}`);
          console.log(`- Message: ${message}`);
          console.log(`- Properties count: ${Object.keys(propertiesData).length}`);
        }
      } catch (err) {
        console.error(`Error en log index ${index}:`, err);
        throw err;
      }
    });
    
    console.log('¡Toda la lógica de procesamiento de logs funcionó sin errores!');
  } catch (err) {
    console.error('Error general en el test:', err);
  }
}

test();
