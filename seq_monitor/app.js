/**
 * ==========================================================================
 * Seq Monitor - Lógica Frontend (JavaScript ES6+)
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  let logsChart = null;

  // --- Estado de la Aplicación ---
  const state = {
    seqUrl: 'http://127.0.0.1:5341',
    apiKey: '',
    currentFilter: '',
    limit: 50,
    savedQueries: [],
    logs: [],
    lastEventId: null,
    isStreaming: false,
    autoRefreshInterval: 5000,
    activeLevels: new Set(['Verbose', 'Debug', 'Information', 'Warning', 'Error', 'Fatal']),
    localSearchQuery: '',
    refreshTimer: null
  };

  // --- Elementos del DOM ---
  const el = {
    connectionForm: document.getElementById('connection-form'),
    connectionSelect: document.getElementById('connection-select'),
    btnConnect: document.getElementById('btn-connect'),
    connectionIndicator: document.getElementById('connection-indicator'),
    connectionStatusText: document.getElementById('connection-status-text'),
    savedQueriesList: document.getElementById('saved-queries-list'),
    btnAddQuery: document.getElementById('btn-add-query'),
    queryFilterInput: document.getElementById('query-filter-input'),
    queryCountInput: document.getElementById('query-count-input'),
    btnRunQuery: document.getElementById('btn-run-query'),
    livePulseDot: document.getElementById('live-pulse-dot'),
    liveStatusText: document.getElementById('live-status-text'),
    autoRefreshToggle: document.getElementById('auto-refresh-toggle'),
    refreshIntervalSelect: document.getElementById('refresh-interval-select'),
    btnTogglePlay: document.getElementById('btn-toggle-play'),
    playIcon: document.getElementById('play-icon'),
    pauseIcon: document.getElementById('pause-icon'),
    btnClearLogs: document.getElementById('btn-clear-logs'),
    logsContainer: document.getElementById('logs-stream-container'),
    noLogsPlaceholder: document.getElementById('no-logs-placeholder'),
    logsCounter: document.getElementById('logs-counter'),
    localSearchInput: document.getElementById('local-search-input'),
    levelChips: document.querySelectorAll('.level-chips .chip'),
    
    // Modal
    modalSaveQuery: document.getElementById('modal-save-query'),
    saveQueryForm: document.getElementById('save-query-form'),
    queryNameInput: document.getElementById('query-name-input'),
    queryExprInput: document.getElementById('query-expr-input'),
    btnCancelModal: document.getElementById('btn-cancel-modal'),
    
    // Tasks UI
    navMonitor: document.getElementById('nav-monitor'),
    navTasks: document.getElementById('nav-tasks'),
    contentPanel: document.querySelector('.content-panel'),
    tasksPanel: document.getElementById('tasks-panel'),
    appSidebar: document.querySelector('.app-sidebar'),
    tasksListContainer: document.getElementById('tasks-list-container'),
    btnCreateTask: document.getElementById('btn-create-task'),
    
    // Task Modal
    modalTask: document.getElementById('modal-task'),
    taskForm: document.getElementById('task-form'),
    btnCancelTaskModal: document.getElementById('btn-cancel-task-modal'),
    taskConditionSelect: document.getElementById('task-condition-select'),
    taskConditionValueContainer: document.getElementById('task-condition-value-container'),
    taskActionSelect: document.getElementById('task-action-select'),
    taskWebhookContainer: document.getElementById('task-webhook-container'),
    taskConnectionSelect: document.getElementById('task-connection-select'),

    // Connections UI
    navConnections: document.getElementById('nav-connections'),
    connectionsPanel: document.getElementById('connections-panel'),
    connectionsListContainer: document.getElementById('connections-list-container'),
    btnCreateConnection: document.getElementById('btn-create-connection'),
    
    // Connections Modal
    modalConnection: document.getElementById('modal-connection'),
    connectionFormModal: document.getElementById('connection-form-modal'),
    btnCancelConnModal: document.getElementById('btn-cancel-conn-modal'),

    toastContainer: document.getElementById('toast-container')
  };

  // --- Queries Predeterminadas ---
  const DEFAULT_QUERIES = [
    { id: 'q-all', name: 'Todos los Logs', filter: '' },
    { id: 'q-err', name: 'Errores y Fatal', filter: "@Level = 'Error' or @Level = 'Fatal'" },
    { id: 'q-warn', name: 'Advertencias (Warning)', filter: "@Level = 'Warning'" },
    { id: 'q-info', name: 'Mensajes Informativos', filter: "@Level = 'Information'" },
    { id: 'q-ai', name: 'AI & RAG Flows', filter: "App = 'RAG' or App = 'SARA' or @Message like '%RAG%' or @Message like '%SARA%'" },
    { id: 'q-exc', name: 'Excepciones / Errores Críticos', filter: "has(@Exception) or @Level = 'Fatal'" }
  ];

  // --- Inicialización ---
  function init() {
    loadSettings();
    setupEventListeners();
    updateConnectionUI('disconnected', 'Desconectado');
    renderSavedQueries();
    initChart();
    initTasks();
    initConnections();
  }

  // --- Carga y Guardado de Ajustes (LocalStorage) ---
  function loadSettings() {
    // URL y API Key ya no se cargan automáticamente aquí por petición
    state.seqUrl = '';
    state.apiKey = '';

    // Límite de logs
    state.limit = parseInt(localStorage.getItem('seq_monitor_limit')) || 50;
    el.queryCountInput.value = state.limit;

    // Queries guardadas
    const saved = localStorage.getItem('seq_monitor_queries');
    if (saved) {
      state.savedQueries = JSON.parse(saved);
    } else {
      state.savedQueries = [...DEFAULT_QUERIES];
      saveQueries();
    }
  }

  function saveQueries() {
    localStorage.setItem('seq_monitor_queries', JSON.stringify(state.savedQueries));
  }

  // --- Manejo de la Interfaz de Estado de Conexión ---
  function updateConnectionUI(status, message) {
    el.connectionIndicator.className = 'status-indicator';
    el.connectionIndicator.classList.add(status);
    el.connectionStatusText.textContent = message;
  }

  // --- Toast Notifications ---
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-message">${message}</span>
    `;
    el.toastContainer.appendChild(toast);

    // Fade out y remover
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // --- Probar Conexión con Seq ---
  async function testConnection(showNotifications = true) {
    updateConnectionUI('connecting', 'Validando conexión...');
    try {
      // Petición de prueba con límite 1 a través del proxy
      const queryParams = new URLSearchParams({
        seqUrl: state.seqUrl,
        count: 1
      });
      
      const response = await fetch(`/api/seq/events?${queryParams}`, {
        headers: {
          'X-Seq-ApiKey': state.apiKey
        }
      });

      if (response.ok) {
        updateConnectionUI('connected', 'Conectado a Seq');
        if (showNotifications) {
          showToast('Conexión con Seq establecida correctamente', 'success');
        }
        return true;
      } else {
        const errorData = await response.json();
        updateConnectionUI('error', `Error (${response.status})`);
        if (showNotifications) {
          showToast(`Error al conectar: ${errorData.error || 'Respuesta inválida'}`, 'error');
        }
        return false;
      }
    } catch (err) {
      updateConnectionUI('error', 'Error de red');
      if (showNotifications) {
        showToast(`Imposible conectar con el servidor proxy: ${err.message}`, 'error');
      }
      return false;
    }
  }

  // --- Renderizar Queries Guardadas ---
  function renderSavedQueries() {
    el.savedQueriesList.innerHTML = '';
    state.savedQueries.forEach((q) => {
      const item = document.createElement('div');
      item.className = 'query-item';
      if (state.currentFilter === q.filter) {
        item.classList.add('active');
      }
      
      // Sanitizar filter para mostrar en tooltip
      const filterText = q.filter || 'Sin filtro';

      item.innerHTML = `
        <div class="query-info" title="${filterText}">
          <span class="query-name">${q.name}</span>
          <span class="query-expr">${filterText}</span>
        </div>
        <div class="query-actions">
          ${q.id.startsWith('q-') ? '' : `
            <button class="btn-icon delete-query-btn" data-id="${q.id}" title="Eliminar consulta">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          `}
        </div>
      `;

      // Evento de click para ejecutar la consulta
      item.addEventListener('click', (e) => {
        if (e.target.closest('.delete-query-btn')) return;
        
        // Activar visualmente
        document.querySelectorAll('.query-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        // Cargar filtro y ejecutar
        state.currentFilter = q.filter;
        el.queryFilterInput.value = q.filter;
        fetchLogs(false);
      });

      // Evento para borrar la consulta
      const deleteBtn = item.querySelector('.delete-query-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteQuery(q.id);
        });
      }

      el.savedQueriesList.appendChild(item);
    });
  }

  function deleteQuery(id) {
    state.savedQueries = state.savedQueries.filter(q => q.id !== id);
    saveQueries();
    renderSavedQueries();
    showToast('Consulta personalizada eliminada', 'info');
  }

  // --- Formateador de JSON con Resaltado Sintáctico ---
  function highlightJson(jsonObj) {
    if (typeof jsonObj !== 'string') {
      jsonObj = JSON.stringify(jsonObj, undefined, 2);
    }
    
    // Escapar caracteres HTML
    jsonObj = jsonObj.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // Expresión regular para encontrar llaves, strings, números, booleanos, nulls
    return jsonObj.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, function (match) {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key';
        } else {
          cls = 'json-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return '<span class="' + cls + '">' + match + '</span>';
    });
  }

  // --- Renderizar Eventos de Log ---
  function renderLogs(logsList, append = false) {
    if (!append) {
      el.logsContainer.innerHTML = '';
      state.logs = logsList;
    } else {
      // Filtrar duplicados antes de agregar
      const existingIds = new Set(state.logs.map(l => l.Id));
      const newLogs = logsList.filter(l => !existingIds.has(l.Id));
      
      if (newLogs.length === 0) return;
      
      state.logs = [...newLogs, ...state.logs];
      // Si superamos el límite, recortar los logs más antiguos
      if (state.logs.length > state.limit * 2) {
        state.logs = state.logs.slice(0, state.limit * 2);
      }
    }

    if (state.logs.length === 0) {
      el.noLogsPlaceholder.classList.remove('hidden');
      el.logsCounter.textContent = 'Mostrando 0 logs';
      updateChartData();
      return;
    }

    el.noLogsPlaceholder.classList.add('hidden');

    // Si es un refresco dinámico (append), queremos inyectar al principio, si no pintamos todo
    if (append) {
      // Inyectamos los nuevos al principio
      const newLogsList = logsList.filter(l => !state.logs.includes(l)); // simplificado, ya filtrado arriba
      newLogsList.reverse().forEach(log => {
        const logRow = createLogElement(log);
        el.logsContainer.insertBefore(logRow, el.logsContainer.firstChild);
      });
    } else {
      state.logs.forEach(log => {
        const logRow = createLogElement(log);
        el.logsContainer.appendChild(logRow);
      });
    }

    // Aplicar filtros locales y buscar de inmediato
    applyFiltersAndSearch();
    updateChartData();
  }

  // --- Crear Elemento Log Individual ---
  function createLogElement(log) {
    const row = document.createElement('div');
    row.className = 'log-row';
    const level = log.Level || 'Information';
    row.setAttribute('data-level', level);
    row.setAttribute('data-id', log.Id);

    // Formatear Timestamp
    const date = new Date(log.Timestamp);
    const timeStr = date.toLocaleTimeString() + '.' + String(date.getMilliseconds()).padStart(3, '0');
    
    // Obtener mensaje principal
    const message = log.RenderedMessage || log.MessageTemplate || '(Sin mensaje)';

    // Generar bloque de propiedades JSON
    const propertiesData = {};
    if (log.Properties) {
      log.Properties.forEach(p => {
        propertiesData[p.Name] = p.Value;
      });
    }
    
    // Añadir excepción si existe
    if (log.Exception) {
      propertiesData['@Exception'] = log.Exception;
    }
    if (log.MessageTemplate && log.RenderedMessage !== log.MessageTemplate) {
      propertiesData['@MessageTemplate'] = log.MessageTemplate;
    }

    row.innerHTML = `
      <div class="log-summary">
        <div class="log-meta">
          <button class="btn-icon btn-arrow">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
          <span class="log-timestamp">${timeStr}</span>
          <span class="log-level-badge ${level.toLowerCase()}">${level}</span>
        </div>
        <span class="log-message" title="${message.replace(/"/g, '&quot;')}">${message}</span>
        <div class="log-row-actions">
          <button class="btn-icon btn-copy-log" title="Copiar log completo (JSON)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
          </button>
        </div>
      </div>
      <div class="log-details">
        <div class="log-details-grid">
          ${log.MessageTemplate ? `
            <div class="details-block">
              <h4>Message Template</h4>
              <div class="template-box">${log.MessageTemplate}</div>
            </div>
          ` : ''}
          <div class="details-block">
            <h4>Propiedades Estructuradas</h4>
            <pre class="json-box">${highlightJson(propertiesData)}</pre>
          </div>
        </div>
      </div>
    `;

    // Toggle expandir detalles al hacer click en el summary
    const summary = row.querySelector('.log-summary');
    summary.addEventListener('click', (e) => {
      // Ignorar clicks si se presiona el botón de copiar
      if (e.target.closest('.btn-copy-log')) return;
      row.classList.toggle('expanded');
    });

    // Copiar al portapapeles
    const btnCopy = row.querySelector('.btn-copy-log');
    btnCopy.addEventListener('click', (e) => {
      e.stopPropagation();
      const rawLog = {
        Id: log.Id,
        Timestamp: log.Timestamp,
        Level: log.Level,
        MessageTemplate: log.MessageTemplate,
        RenderedMessage: log.RenderedMessage,
        Properties: propertiesData
      };
      
      navigator.clipboard.writeText(JSON.stringify(rawLog, null, 2))
        .then(() => showToast('Log copiado al portapapeles', 'success'))
        .catch(err => showToast('Error al copiar log: ' + err.message, 'error'));
    });

    return row;
  }

  // --- Realizar Consulta de Logs a Seq ---
  async function fetchLogs(isAutoRefresh = false) {
    if (!isAutoRefresh && !state.isStreaming) {
      // Indicar carga si es una consulta manual
      el.btnRunQuery.disabled = true;
      el.btnRunQuery.innerHTML = `
        <svg class="animate-spin" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle><path d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
        Cargando...
      `;
    }

    try {
      const queryParams = new URLSearchParams({
        seqUrl: state.seqUrl,
        count: state.limit,
        render: 'true'
      });
      
      if (state.currentFilter && state.currentFilter.trim() !== '') {
        queryParams.append('filter', state.currentFilter);
      }

      // Si es auto-refresh y tenemos un último ID de evento, Seq no soporta afterId directamente
      // de forma simple en peticiones filtradas de la misma manera sin paginar, pero el proxy
      // lo enviará si lo proveemos. Para simplificar e integrarnos con facilidad, realizamos la query normal.
      const response = await fetch(`/api/seq/events?${queryParams}`, {
        headers: {
          'X-Seq-ApiKey': state.apiKey
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        showToast(`Error al obtener logs: ${errorData.error || 'Seq inalcanzable'}`, 'error');
        if (state.isStreaming) stopStreaming();
        return;
      }

      const data = await response.json();
      const fetchedLogs = Array.isArray(data) ? data : (data.Items || []);

      // Guardar el ID más reciente
      if (fetchedLogs.length > 0) {
        state.lastEventId = fetchedLogs[0].Id;
      }

      renderLogs(fetchedLogs, isAutoRefresh);

    } catch (err) {
      console.error(err);
      showToast(`Error de conexión al obtener logs: ${err.message}`, 'error');
      if (state.isStreaming) stopStreaming();
    } finally {
      if (!isAutoRefresh) {
        el.btnRunQuery.disabled = false;
        el.btnRunQuery.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          Ejecutar
        `;
      }
    }
  }

  // --- Aplicar Filtros de Nivel y Barra de Búsqueda Locales ---
  function applyFiltersAndSearch() {
    const rows = el.logsContainer.querySelectorAll('.log-row');
    let visibleCount = 0;

    rows.forEach(row => {
      const level = row.getAttribute('data-level');
      const text = row.querySelector('.log-message').textContent.toLowerCase();
      const detailBox = row.querySelector('.log-details');
      const detailsText = detailBox ? detailBox.textContent.toLowerCase() : '';
      
      const matchLevel = state.activeLevels.has(level);
      const matchSearch = state.localSearchQuery === '' || 
                          text.includes(state.localSearchQuery) || 
                          detailsText.includes(state.localSearchQuery);

      if (matchLevel && matchSearch) {
        row.classList.remove('hidden');
        visibleCount++;
      } else {
        row.classList.add('hidden');
      }
    });

    el.logsCounter.textContent = `Mostrando ${visibleCount} de ${state.logs.length} logs`;
  }

  // --- Iniciar / Detener Monitoreo en Vivo ---
  function startStreaming() {
    state.isStreaming = true;
    el.livePulseDot.classList.add('active');
    el.liveStatusText.textContent = `Monitoreando Seq en vivo (refresco ${state.autoRefreshInterval / 1000}s)`;
    el.playIcon.classList.add('hidden');
    el.pauseIcon.classList.remove('hidden');
    el.btnTogglePlay.classList.add('btn-primary');
    el.btnTogglePlay.querySelector('span').textContent = 'Pausar';
    
    // Realizar llamada inicial e iniciar temporizador
    fetchLogs(false);
    
    state.refreshTimer = setInterval(() => {
      fetchLogs(true);
    }, state.autoRefreshInterval);
  }

  function stopStreaming() {
    state.isStreaming = false;
    el.livePulseDot.classList.remove('active');
    el.liveStatusText.textContent = 'Streaming en tiempo real pausado';
    el.playIcon.classList.remove('hidden');
    el.pauseIcon.classList.add('hidden');
    el.btnTogglePlay.classList.remove('btn-primary');
    el.btnTogglePlay.querySelector('span').textContent = 'Monitorear';
    
    if (state.refreshTimer) {
      clearInterval(state.refreshTimer);
      state.refreshTimer = null;
    }
  }

  // --- Configuraciones de Event Listeners ---
  function setupEventListeners() {
    // Formulario de Conexión (Sidebar)
    el.connectionForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const connId = el.connectionSelect.value;
      if (!connId) return;
      
      const conn = connections.find(c => c.id === connId);
      if (!conn) return;

      state.seqUrl = conn.url;
      state.apiKey = conn.apiKey || '';

      const ok = await testConnection(true);
      if (ok) {
        fetchLogs(false);
      }
    });

    el.connectionSelect.addEventListener('change', (e) => {
      el.btnConnect.disabled = !e.target.value;
    });

    // Guardar logs al cambiar el límite
    el.queryCountInput.addEventListener('change', () => {
      let val = parseInt(el.queryCountInput.value);
      if (isNaN(val) || val < 1) val = 50;
      if (val > 500) val = 500;
      el.queryCountInput.value = val;
      state.limit = val;
      localStorage.setItem('seq_monitor_limit', val);
    });

    // Botón de Ejecutar Consulta
    el.btnRunQuery.addEventListener('click', () => {
      state.currentFilter = el.queryFilterInput.value.trim();
      fetchLogs(false);
    });

    // Filtro rápido de entrada (Enter)
    el.queryFilterInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        state.currentFilter = el.queryFilterInput.value.trim();
        fetchLogs(false);
      }
    });

    // Switch de Auto-refrescar
    el.autoRefreshToggle.addEventListener('change', (e) => {
      const active = e.target.checked;
      el.refreshIntervalSelect.disabled = !active;
      
      if (active && state.isStreaming) {
        // Reiniciar stream con el nuevo intervalo
        stopStreaming();
        startStreaming();
      } else if (!active && state.isStreaming) {
        stopStreaming();
      }
    });

    // Intervalo de refresco
    el.refreshIntervalSelect.addEventListener('change', (e) => {
      state.autoRefreshInterval = parseInt(e.target.value);
      if (state.isStreaming) {
        stopStreaming();
        startStreaming();
      }
    });

    // Botón Play / Pausa Stream
    el.btnTogglePlay.addEventListener('click', () => {
      if (state.isStreaming) {
        stopStreaming();
      } else {
        startStreaming();
      }
    });

    // Botón Limpiar Consola y Filtros
    el.btnClearLogs.addEventListener('click', () => {
      el.queryFilterInput.value = '';
      state.currentFilter = '';
      el.localSearchInput.value = '';
      state.localSearchQuery = '';
      
      // Restablecer chips de niveles
      el.levelChips.forEach(chip => chip.classList.add('active'));
      state.activeLevels = new Set(['Verbose', 'Debug', 'Information', 'Warning', 'Error', 'Fatal']);
      
      // Activar la query predeterminada de "Todos los Logs" en la lista de guardados
      document.querySelectorAll('.query-item').forEach(i => {
        if (i.querySelector('.query-name').textContent === 'Todos los Logs') {
          i.classList.add('active');
        } else {
          i.classList.remove('active');
        }
      });

      renderLogs([]);
      showToast('Consola, filtros e inputs restablecidos', 'info');
    });

    // Filtros por nivel (chips)
    el.levelChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const level = chip.getAttribute('data-level');
        chip.classList.toggle('active');
        
        if (chip.classList.contains('active')) {
          state.activeLevels.add(level);
        } else {
          state.activeLevels.delete(level);
        }
        applyFiltersAndSearch();
      });
    });

    // Búsqueda local por texto
    el.localSearchInput.addEventListener('input', (e) => {
      state.localSearchQuery = e.target.value.toLowerCase().trim();
      applyFiltersAndSearch();
    });

    // --- Modal para Guardar Query ---
    el.btnAddQuery.addEventListener('click', () => {
      const currentExpr = el.queryFilterInput.value.trim();
      el.queryExprInput.value = currentExpr || '(Consulta vacía - todos los logs)';
      el.queryNameInput.value = '';
      el.modalSaveQuery.classList.add('active');
      el.queryNameInput.focus();
    });

    el.btnCancelModal.addEventListener('click', () => {
      el.modalSaveQuery.classList.remove('active');
    });

    el.saveQueryForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = el.queryNameInput.value.trim();
      const filter = el.queryFilterInput.value.trim();

      if (!name) return;

      const newQuery = {
        id: 'q-custom-' + Date.now(),
        name: name,
        filter: filter
      };

      state.savedQueries.push(newQuery);
      saveQueries();
      renderSavedQueries();
      el.modalSaveQuery.classList.remove('active');
      showToast(`Consulta "${name}" guardada con éxito`, 'success');
    });

    // Cerrar modal al clickear afuera
    el.modalSaveQuery.addEventListener('click', (e) => {
      if (e.target === el.modalSaveQuery) {
        el.modalSaveQuery.classList.remove('active');
      }
    });
  }

  // --- Lógica del Gráfico Interactivo (Chart.js - Multilínea) ---
  function initChart() {
    const canvas = document.getElementById('logs-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const levels = ['Verbose', 'Debug', 'Information', 'Warning', 'Error', 'Fatal'];
    const colors = {
      Verbose: 'rgb(156, 163, 175)',
      Debug: 'rgb(16, 185, 129)',
      Information: 'rgb(14, 165, 233)',
      Warning: 'rgb(245, 158, 11)',
      Error: 'rgb(239, 68, 68)',
      Fatal: 'rgb(236, 72, 153)'
    };
    
    const fillColors = {
      Verbose: 'rgba(156, 163, 175, 0.03)',
      Debug: 'rgba(16, 185, 129, 0.03)',
      Information: 'rgba(14, 165, 233, 0.03)',
      Warning: 'rgba(245, 158, 11, 0.03)',
      Error: 'rgba(239, 68, 68, 0.03)',
      Fatal: 'rgba(236, 72, 153, 0.03)'
    };

    // Crear datasets para cada nivel
    const datasets = levels.map(lvl => ({
      label: lvl,
      data: [],
      borderColor: colors[lvl],
      backgroundColor: fillColors[lvl],
      borderWidth: 1.8,
      pointBackgroundColor: colors[lvl],
      pointBorderColor: 'rgba(255, 255, 255, 0.8)',
      pointBorderWidth: 1,
      pointRadius: 2,
      pointHoverRadius: 4.5,
      tension: 0.35,
      fill: true
    }));

    logsChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            onClick: (e, legendItem, legend) => {
              const datasetIndex = legendItem.datasetIndex;
              const levelLabel = legend.chart.data.datasets[datasetIndex].label;
              applyChartLevelFilter(levelLabel);
            },
            labels: {
              color: 'rgba(255, 255, 255, 0.7)',
              boxWidth: 8,
              boxHeight: 8,
              usePointStyle: true,
              pointStyle: 'circle',
              font: { size: 9, family: 'Inter', weight: '550' },
              padding: 12
            }
          },
          tooltip: {
            backgroundColor: 'rgba(17, 24, 39, 0.95)',
            titleColor: '#f3f4f6',
            bodyColor: '#e5e7eb',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            borderWidth: 1,
            padding: 8,
            cornerRadius: 6,
            displayColors: true,
            callbacks: {
              title: (items) => `Hora: ${items[0].label}`,
              label: (item) => `${item.dataset.label}: ${item.formattedValue} eventos`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.03)', drawBorder: false },
            ticks: { color: 'rgba(255, 255, 255, 0.4)', font: { size: 9 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.04)', drawBorder: false },
            ticks: { color: 'rgba(255, 255, 255, 0.6)', font: { size: 9 }, precision: 0 },
            min: 0
          }
        },
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const element = elements[0];
            const datasetIndex = element.datasetIndex;
            const index = element.index;
            
            const dataset = logsChart.data.datasets[datasetIndex];
            const levelLabel = dataset.label;
            const timeData = dataset.extraData ? dataset.extraData[index] : null;
            
            if (timeData && timeData.start) {
              applyChartTimeAndLevelFilter(levelLabel, timeData.start, timeData.end, logsChart.data.labels[index]);
            }
          } else {
            clearChartTimeFilter();
          }
        }
      }
    });
  }

  function updateChartData() {
    if (!logsChart) return;

    if (state.logs.length === 0) {
      logsChart.data.labels = ['Sin Eventos'];
      logsChart.data.datasets.forEach(dataset => {
        dataset.data = [0];
        dataset.extraData = [{ start: null, end: null }];
      });
      logsChart.update();
      return;
    }

    // 1. Encontrar todos los intervalos de 10s presentes en todos los logs cargados
    const intervalMetadata = {};
    state.logs.forEach(log => {
      const date = new Date(log.Timestamp);
      const roundedSeconds = Math.floor(date.getSeconds() / 10) * 10;
      
      const startOfInterval = new Date(date);
      startOfInterval.setSeconds(roundedSeconds, 0);
      
      const endOfInterval = new Date(startOfInterval);
      endOfInterval.setSeconds(startOfInterval.getSeconds() + 10);

      const labelTime = startOfInterval.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const key = startOfInterval.getTime();

      if (!intervalMetadata[key]) {
        intervalMetadata[key] = {
          label: labelTime,
          startIso: startOfInterval.toISOString(),
          endIso: endOfInterval.toISOString()
        };
      }
    });

    // Ordenar de forma cronológica
    const sortedKeys = Object.keys(intervalMetadata).sort((a, b) => Number(a) - Number(b));
    const labels = sortedKeys.map(k => intervalMetadata[k].label);
    const extraData = sortedKeys.map(k => ({
      start: intervalMetadata[k].startIso,
      end: intervalMetadata[k].endIso
    }));

    // 2. Mapear conteos por nivel en los intervalos temporales definidos
    const levels = ['Verbose', 'Debug', 'Information', 'Warning', 'Error', 'Fatal'];
    
    levels.forEach((lvl, datasetIndex) => {
      const lvlLogs = state.logs.filter(log => (log.Level || 'Information') === lvl);
      
      const counts = {};
      lvlLogs.forEach(log => {
        const date = new Date(log.Timestamp);
        const roundedSeconds = Math.floor(date.getSeconds() / 10) * 10;
        const startOfInterval = new Date(date);
        startOfInterval.setSeconds(roundedSeconds, 0);
        const key = startOfInterval.getTime();
        
        counts[key] = (counts[key] || 0) + 1;
      });

      const datasetData = sortedKeys.map(k => counts[k] || 0);
      
      logsChart.data.datasets[datasetIndex].data = datasetData;
      logsChart.data.datasets[datasetIndex].extraData = extraData;
    });

    logsChart.data.labels = labels;
    logsChart.update();
  }

  function applyChartTimeAndLevelFilter(level, startIso, endIso, timeLabel) {
    // Al dar clic en un punto, filtrar por ese Nivel específico y ese rango temporal de 10s
    const filterExpr = `@Level = '${level}' and @Timestamp >= DateTime('${startIso}') and @Timestamp < DateTime('${endIso}')`;
    el.queryFilterInput.value = filterExpr;
    state.currentFilter = filterExpr;
    
    document.querySelectorAll('.query-item').forEach(i => i.classList.remove('active'));
    
    showToast(`Filtrando logs (${level}) en el intervalo: ${timeLabel}`, 'info');
    fetchLogs(false);
  }

  function clearChartTimeFilter() {
    if (!state.currentFilter || !state.currentFilter.includes('@Timestamp')) return;

    el.queryFilterInput.value = '';
    state.currentFilter = '';
    
    document.querySelectorAll('.query-item').forEach(i => {
      if (i.querySelector('.query-name').textContent === 'Todos los Logs') {
        i.classList.add('active');
      } else {
        i.classList.remove('active');
      }
    });

    showToast('Filtro de tiempo de la gráfica removido', 'info');
    fetchLogs(false);
  }

  function applyChartLevelFilter(level) {
    // Al hacer clic en la leyenda de un nivel, filtrar globalmente por ese nivel en Seq
    const filterExpr = `@Level = '${level}'`;
    el.queryFilterInput.value = filterExpr;
    state.currentFilter = filterExpr;
    
    document.querySelectorAll('.query-item').forEach(i => i.classList.remove('active'));
    
    showToast(`Filtrando consultas por nivel: ${level}`, 'info');
    fetchLogs(false);
  }

  // --- Lógica de Tareas (Tasks) ---
  let tasks = [];

  async function fetchTasks() {
    try {
      const res = await fetch('/api/tasks');
      if (res.ok) {
        tasks = await res.json();
        renderTasks();
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
    }
  }

  function renderTasks() {
    el.tasksListContainer.innerHTML = '';
    if (tasks.length === 0) {
      el.tasksListContainer.innerHTML = '<p class="text-muted">No hay tareas configuradas.</p>';
      return;
    }

    tasks.forEach(task => {
      const elTask = document.createElement('div');
      elTask.className = 'task-item';
      
      const lastRun = task.lastRun ? new Date(task.lastRun).toLocaleString() : 'Nunca';
      
      elTask.innerHTML = `
        <div class="task-info">
          <h4>${task.name}</h4>
          <p>Seq: ${task.seqUrl} | Intervalo: ${task.intervalSeconds}s</p>
          <p>Condición: ${task.condition} ${task.conditionValue || ''}</p>
          <p>Acción: ${task.actionType} ${task.actionWebhookUrl ? '('+task.actionWebhookUrl+')' : ''}</p>
          <p>Última ejecución: ${lastRun}</p>
        </div>
        <div class="task-actions">
          <button class="btn btn-outline delete-task-btn" data-id="${task.id}">Eliminar</button>
        </div>
      `;

      elTask.querySelector('.delete-task-btn').addEventListener('click', () => deleteTask(task.id));
      el.tasksListContainer.appendChild(elTask);
    });
  }

  async function deleteTask(id) {
    if(!confirm('¿Eliminar esta tarea?')) return;
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      showToast('Tarea eliminada', 'info');
      fetchTasks();
    } catch (err) {
      showToast('Error al eliminar tarea', 'error');
    }
  }

  function initTasks() {
    // Navegación Tabs
    if (el.navMonitor && el.navTasks) {
      el.navMonitor.addEventListener('click', () => {
        el.navMonitor.classList.add('active');
        el.navTasks.classList.remove('active');
        el.contentPanel.style.display = 'flex';
        el.appSidebar.style.display = 'flex';
        el.tasksPanel.style.display = 'none';
      });

      el.navTasks.addEventListener('click', () => {
        el.navTasks.classList.add('active');
        el.navMonitor.classList.remove('active');
        el.contentPanel.style.display = 'none';
        el.appSidebar.style.display = 'none';
        el.tasksPanel.style.display = 'block';
        fetchTasks();
      });
    }

    // Formularios dinámicos
    el.taskConditionSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'count_greater_than' || val === 'count_equal_to') {
        el.taskConditionValueContainer.style.display = 'block';
      } else {
        el.taskConditionValueContainer.style.display = 'none';
      }
    });

    el.taskActionSelect.addEventListener('change', (e) => {
      if (e.target.value === 'webhook') {
        el.taskWebhookContainer.style.display = 'block';
      } else {
        el.taskWebhookContainer.style.display = 'none';
      }
    });

    // Abrir Modal
    el.btnCreateTask.addEventListener('click', () => {
      el.taskForm.reset();
      document.getElementById('task-query-input').value = state.currentFilter;
      
      el.taskConditionSelect.dispatchEvent(new Event('change'));
      el.taskActionSelect.dispatchEvent(new Event('change'));
      
      el.modalTask.classList.add('active');
    });

    // Cerrar Modal
    el.btnCancelTaskModal.addEventListener('click', () => {
      el.modalTask.classList.remove('active');
    });

    // Guardar Tarea
    el.taskForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const connId = el.taskConnectionSelect.value;
      const conn = connections.find(c => c.id === connId);
      if (!conn) {
        showToast('Debe seleccionar una conexión válida', 'error');
        return;
      }

      const newTask = {
        name: document.getElementById('task-name-input').value,
        seqUrl: conn.url,
        apiKey: conn.apiKey || '',
        query: document.getElementById('task-query-input').value,
        intervalSeconds: parseInt(document.getElementById('task-interval-input').value, 10),
        condition: el.taskConditionSelect.value,
        conditionValue: document.getElementById('task-condition-value').value,
        actionType: el.taskActionSelect.value,
        actionWebhookUrl: document.getElementById('task-webhook-url').value
      };

      try {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newTask)
        });
        if (res.ok) {
          showToast('Tarea guardada', 'success');
          el.modalTask.classList.remove('active');
          fetchTasks();
        }
      } catch(err) {
        showToast('Error al guardar tarea', 'error');
      }
    });

    // Polling de notificaciones
    setInterval(async () => {
      try {
        const res = await fetch('/api/tasks/notifications');
        if (res.ok) {
          const notifs = await res.json();
          notifs.forEach(n => showToast(n.message, 'info'));
        }
      } catch(e) {}
    }, 5000);
  }

  // --- Lógica de Conexiones ---
  let connections = [];

  async function fetchConnections() {
    try {
      const res = await fetch('/api/connections');
      if (res.ok) {
        connections = await res.json();
        renderConnections();
        populateConnectionSelects();
      }
    } catch (err) {
      console.error('Error fetching connections:', err);
    }
  }

  function renderConnections() {
    el.connectionsListContainer.innerHTML = '';
    if (connections.length === 0) {
      el.connectionsListContainer.innerHTML = '<p class="text-muted">No hay conexiones guardadas.</p>';
      return;
    }

    connections.forEach(conn => {
      const elConn = document.createElement('div');
      elConn.className = 'connection-card';
      elConn.innerHTML = `
        <h4>${conn.name}</h4>
        <p>${conn.url}</p>
        <p class="text-muted">${conn.apiKey ? 'Con API Key' : 'Sin API Key'}</p>
        <div class="task-actions" style="margin-top: auto;">
          <button class="btn btn-outline delete-conn-btn" data-id="${conn.id}">Eliminar</button>
        </div>
      `;

      elConn.querySelector('.delete-conn-btn').addEventListener('click', () => deleteConnection(conn.id));
      el.connectionsListContainer.appendChild(elConn);
    });
  }

  function populateConnectionSelects() {
    // Guardar selección actual si existe
    const currentMonitorVal = el.connectionSelect.value;
    const currentTaskVal = el.taskConnectionSelect.value;

    let optionsHTML = '<option value="">-- Selecciona --</option>';
    connections.forEach(c => {
      optionsHTML += `<option value="${c.id}">${c.name} (${c.url})</option>`;
    });

    el.connectionSelect.innerHTML = optionsHTML;
    el.taskConnectionSelect.innerHTML = optionsHTML;

    if (currentMonitorVal) el.connectionSelect.value = currentMonitorVal;
    if (currentTaskVal) el.taskConnectionSelect.value = currentTaskVal;
  }

  async function deleteConnection(id) {
    if(!confirm('¿Eliminar esta conexión?')) return;
    try {
      await fetch(`/api/connections/${id}`, { method: 'DELETE' });
      showToast('Conexión eliminada', 'info');
      fetchConnections();
    } catch (err) {
      showToast('Error al eliminar conexión', 'error');
    }
  }

  function initConnections() {
    fetchConnections();

    // Navegación
    if (el.navConnections) {
      el.navConnections.addEventListener('click', () => {
        el.navConnections.classList.add('active');
        el.navMonitor.classList.remove('active');
        el.navTasks.classList.remove('active');
        
        el.contentPanel.style.display = 'none';
        el.appSidebar.style.display = 'none';
        el.tasksPanel.style.display = 'none';
        el.connectionsPanel.style.display = 'block';
      });

      // Update monitor/tasks nav logic
      el.navMonitor.addEventListener('click', () => {
        el.navConnections.classList.remove('active');
        el.connectionsPanel.style.display = 'none';
      });
      el.navTasks.addEventListener('click', () => {
        el.navConnections.classList.remove('active');
        el.connectionsPanel.style.display = 'none';
      });
    }

    // Modal
    el.btnCreateConnection.addEventListener('click', () => {
      el.connectionFormModal.reset();
      el.modalConnection.classList.add('active');
    });

    el.btnCancelConnModal.addEventListener('click', () => {
      el.modalConnection.classList.remove('active');
    });

    // Guardar Conexión
    el.connectionFormModal.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const newConn = {
        name: document.getElementById('conn-name-input').value.trim(),
        url: document.getElementById('conn-url-input').value.trim(),
        apiKey: document.getElementById('conn-apikey-input').value.trim()
      };

      try {
        const res = await fetch('/api/connections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newConn)
        });
        if (res.ok) {
          showToast('Conexión guardada', 'success');
          el.modalConnection.classList.remove('active');
          fetchConnections();
        }
      } catch(err) {
        showToast('Error al guardar conexión', 'error');
      }
    });
  }

  // --- Arrancar ---
  init();
});
