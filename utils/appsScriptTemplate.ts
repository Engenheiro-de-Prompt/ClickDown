export function generateAppsScript(apiKey: string, listId: string | null, teamId: string | null): string {
    return `/**
 * ClickDown Integration: ClickUp to Google Sheets ETL (Advanced)
 * Versão: 2.1 (Dynamic Columns & Safe Limits)
 * 
 * INSTRUÇÕES:
 * 1. No Google Sheets, vá em Extensões > Apps Script.
 * 2. Cole este código no editor (substitua qualquer código existente).
 * 3. Salve o projeto.
 * 4. Recarregue a planilha.
 */

const CLICKUP_API_KEY = '${apiKey}';
const LIST_ID = '${listId || ""}';
const TEAM_ID = '${teamId || ""}'; 

// ==========================================
// MENUS E GATILHOS
// ==========================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('ClickDown ETL')
    .addItem('🔄 Sincronizar Agora (Lista)', 'syncClickUpData')
    .addItem('🌍 Extrair Todo o Workspace (Global)', 'extractWholeWorkspace')
    .addSeparator()
    .addItem('⚙️ Configurar Automação Semanal', 'setupTrigger')
    .addToUi();
}

function setupTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
  
  ScriptApp.newTrigger('syncClickUpData')
      .timeBased()
      .onWeekDay(ScriptApp.WeekDay.MONDAY)
      .atHour(8)
      .create();
      
  SpreadsheetApp.getUi().alert('✅ Automação configurada! Execução: Segunda-feira às 08:00.');
}

// ==========================================
// FUNÇÕES PRINCIPAIS
// ==========================================

/**
 * Modo Lista Única: Sincroniza e define colunas baseado na lista específica.
 */
function syncClickUpData() {
  if (!LIST_ID) {
    SpreadsheetApp.getUi().alert('❌ Erro: Nenhum ID de Lista configurado.');
    return;
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const tasks = fetchTasksFromList(LIST_ID);
  
  if (tasks.length === 0) {
    SpreadsheetApp.getUi().alert('⚠️ Nenhuma tarefa encontrada.');
    return;
  }
  
  // No modo lista, pegamos todos os headers de uma vez
  processAndWriteData(sheet, tasks, true);
  SpreadsheetApp.getUi().alert('✅ Sincronização concluída! ' + tasks.length + ' tarefas.');
}

/**
 * Modo Workspace: Itera sobre tudo e expande colunas dinamicamente.
 * Resolve o problema de "Limite de 50000 caracteres" distribuindo dados em colunas.
 */
function extractWholeWorkspace() {
  if (!TEAM_ID) {
    SpreadsheetApp.getUi().alert('❌ Erro: Nenhum ID de Time configurado.');
    return;
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.clear();
  
  // Configuração inicial de Headers
  let headers = getBaseHeaders();
  let headerMap = {}; // Mapa: Nome do Campo -> Índice da Coluna (0-based)
  headers.forEach((h, i) => headerMap[h] = i);
  
  // Escreve headers iniciais
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatHeaderRow(sheet);

  const spaces = fetchSpaces(TEAM_ID);
  let totalTasks = 0;
  let currentRow = 2; // Começa a escrever na linha 2

  // Função auxiliar para processar um lote de tarefas e atualizar headers dinamicamente
  const processBatch = (tasks, spaceName, folderName, listName) => {
    if (!tasks || tasks.length === 0) return;

    // 1. Identificar novos campos personalizados neste lote
    let newFieldsFound = false;
    tasks.forEach(t => {
      if (t.custom_fields) {
        t.custom_fields.forEach(cf => {
          if (!headerMap.hasOwnProperty(cf.name)) {
            // Novo campo encontrado! Adicionar ao mapa e à lista de headers
            headerMap[cf.name] = headers.length;
            headers.push(cf.name);
            newFieldsFound = true;
          }
        });
      }
    });

    // 2. Se houve novos campos, atualizar a linha de cabeçalho na planilha
    if (newFieldsFound) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      formatHeaderRow(sheet);
    }

    // 3. Mapear dados para a estrutura de colunas atual (com padding seguro)
    const rows = tasks.map(t => {
      // Injeta contexto
      t.space = { name: spaceName };
      t.folder = { name: folderName };
      t.list = { name: listName };

      // Cria array preenchido com vazios
      const rowData = new Array(headers.length).fill('');
      
      // Preenche dados base
      const baseData = mapTaskBaseData(t);
      baseData.forEach((val, idx) => rowData[idx] = val);

      // Preenche campos personalizados nas colunas corretas
      if (t.custom_fields) {
        t.custom_fields.forEach(cf => {
          const colIdx = headerMap[cf.name];
          if (colIdx !== undefined) {
            rowData[colIdx] = safeValue(formatCustomField(cf));
          }
        });
      }
      return rowData;
    });

    // 4. Escrever lote na planilha
    if (rows.length > 0) {
      sheet.getRange(currentRow, 1, rows.length, headers.length).setValues(rows);
      currentRow += rows.length;
      totalTasks += rows.length;
    }
    SpreadsheetApp.flush(); // Garante que o script não estoure memória
  };

  // Iteração do Workspace
  for (var s = 0; s < spaces.length; s++) {
    const space = spaces[s];
    
    // Listas soltas
    const folderless = fetchFolderlessLists(space.id);
    for (var l = 0; l < folderless.length; l++) {
      const list = folderless[l];
      const tasks = fetchTasksFromList(list.id);
      processBatch(tasks, space.name, "(Sem Pasta)", list.name);
    }
    
    // Pastas
    const folders = fetchFolders(space.id);
    for (var f = 0; f < folders.length; f++) {
      const folder = folders[f];
      const lists = fetchLists(folder.id);
      for (var l = 0; l < lists.length; l++) {
        const list = lists[l];
        const tasks = fetchTasksFromList(list.id);
        processBatch(tasks, space.name, folder.name, list.name);
      }
    }
  }
  
  Browser.msgBox("✅ Extração Global Finalizada! Total de tarefas: " + totalTasks);
}

// ==========================================
// PROCESSAMENTO DE DADOS (SAFE MODE)
// ==========================================

function processAndWriteData(sheet, tasks, clearSheet) {
  // Identificar todos os campos personalizados únicos
  const customFieldNames = new Set();
  tasks.forEach(task => {
    if (task.custom_fields) {
      task.custom_fields.forEach(field => customFieldNames.add(field.name));
    }
  });
  
  const sortedCustomFields = Array.from(customFieldNames).sort();
  let headers = getBaseHeaders().concat(sortedCustomFields);
  
  if (clearSheet) sheet.clear();
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatHeaderRow(sheet);
  
  const data = tasks.map(task => {
    const baseData = mapTaskBaseData(task);
    
    // Adicionar campos personalizados na ordem correta
    const customData = sortedCustomFields.map(fieldName => {
      const field = task.custom_fields ? task.custom_fields.find(f => f.name === fieldName) : null;
      return field ? safeValue(formatCustomField(field)) : '';
    });
    
    return baseData.concat(customData);
  });
  
  if (data.length > 0) {
    sheet.getRange(2, 1, data.length, headers.length).setValues(data);
  }
}

function getBaseHeaders() {
  return [
    'ID', 'Nome', 'URL', 'Status', 'Prioridade', 'Descrição',
    'Criado em', 'Criado por', 'Atualizado em', 
    'Início', 'Data de Entrega', 'Fechado em', 'Concluído em',
    'Responsáveis', 'Observadores', 'Tags', 
    'Checklists (Resolvido/Total)', 'Progresso (Pontos)', 
    'Estimativa (h)', 'Tempo Rastreado (h)', 
    'Dependendo de', 'Bloqueando',
    'Anexos (Qtd)', 'Tarefa Pai', 
    'Espaço', 'Pasta', 'Lista',
    'Comentários (Qtd)', 'Último Comentário'
  ];
}

function mapTaskBaseData(task) {
    const spaceName = task.space ? task.space.name : '';
    const folderName = task.folder ? task.folder.name : '';
    const listName = task.list ? task.list.name : '';

    return [
      safeValue(task.id),
      safeValue(task.name),
      safeValue(task.url),
      task.status ? safeValue(task.status.status) : '',
      task.priority ? safeValue(task.priority.priority) : '',
      safeValue(task.description, 40000), // Limite de segurança para descrição
      formatDate(task.date_created),
      task.creator ? safeValue(task.creator.username) : '',
      formatDate(task.date_updated),
      formatDate(task.start_date),
      formatDate(task.due_date),
      formatDate(task.date_closed),
      formatDate(task.date_done),
      task.assignees ? safeValue(task.assignees.map(a => a.username).join(', ')) : '',
      task.watchers ? safeValue(task.watchers.map(w => w.username).join(', ')) : '',
      task.tags ? safeValue(task.tags.map(t => t.name).join(', ')) : '',
      formatChecklists(task.checklists),
      task.points ? task.points : '',
      task.time_estimate ? (task.time_estimate / 3600000).toFixed(2) : '',
      task.time_spent ? (task.time_spent / 3600000).toFixed(2) : '0',
      formatDependencies(task.dependencies, 'depends_on'),
      formatDependencies(task.dependencies, 'dependency_of'),
      task.attachments ? task.attachments.length : 0,
      safeValue(task.parent),
      safeValue(spaceName), safeValue(folderName), safeValue(listName),
      ...fetchAllComments(task.id)
    ];
}

/**
 * Garante que o valor caiba em uma célula do Google Sheets.
 * O limite técnico é 50.000 caracteres.
 */
function safeValue(val, limit) {
  if (val === null || val === undefined) return "";
  const str = String(val);
  const max = limit || 45000; // Margem de segurança abaixo de 50k
  if (str.length > max) {
    return str.substring(0, max) + " [TRUNCADO - LIMITE EXCEDIDO]";
  }
  return str;
}

function formatHeaderRow(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol > 0) {
    sheet.getRange(1, 1, 1, lastCol)
      .setFontWeight('bold')
      .setBackground('#0f172a')
      .setFontColor('white')
      .setWrap(false);
  }
}

// ==========================================
// CLIENTE API CLICKUP (MANTIDO)
// ==========================================

function fetchSpaces(teamId) {
  return JSON.parse(UrlFetchApp.fetch("https://api.clickup.com/api/v2/team/" + teamId + "/space", { headers: { "Authorization": CLICKUP_API_KEY }, muteHttpExceptions: true }).getContentText()).spaces || [];
}
function fetchFolders(spaceId) {
  return JSON.parse(UrlFetchApp.fetch("https://api.clickup.com/api/v2/space/" + spaceId + "/folder", { headers: { "Authorization": CLICKUP_API_KEY }, muteHttpExceptions: true }).getContentText()).folders || [];
}
function fetchFolderlessLists(spaceId) {
  return JSON.parse(UrlFetchApp.fetch("https://api.clickup.com/api/v2/space/" + spaceId + "/list", { headers: { "Authorization": CLICKUP_API_KEY }, muteHttpExceptions: true }).getContentText()).lists || [];
}
function fetchLists(folderId) {
  return JSON.parse(UrlFetchApp.fetch("https://api.clickup.com/api/v2/folder/" + folderId + "/list", { headers: { "Authorization": CLICKUP_API_KEY }, muteHttpExceptions: true }).getContentText()).lists || [];
}

function fetchTasksFromList(listId) {
  let allTasks = [];
  const states = [false, true]; 
  for (let i = 0; i < states.length; i++) {
    let isArchived = states[i];
    let page = 0;
    while (true) {
      const url = "https://api.clickup.com/api/v2/list/" + listId + "/task?page=" + page + "&subtasks=true&include_closed=true&include_markdown_description=true&archived=" + isArchived;
      const res = UrlFetchApp.fetch(url, { headers: { "Authorization": CLICKUP_API_KEY }, muteHttpExceptions: true });
      const json = JSON.parse(res.getContentText());
      if (json.tasks && json.tasks.length > 0) {
        allTasks = allTasks.concat(json.tasks);
        if (json.tasks.length < 100 || json.last_page) break;
        page++;
      } else { break; }
      if (page > 30) break; // Safety limit
    }
  }
  return allTasks;
}

function fetchAllComments(taskId) {
  try {
    const url = "https://api.clickup.com/api/v2/task/" + taskId + "/comment";
    const res = UrlFetchApp.fetch(url, { headers: { "Authorization": CLICKUP_API_KEY }, muteHttpExceptions: true });
    const json = JSON.parse(res.getContentText());
    if (json.comments && json.comments.length > 0) {
      const count = json.comments.length;
      const lastComment = json.comments[0].comment_text || "";
      return [count, safeValue(lastComment, 5000)];
    }
  } catch (e) {}
  return [0, ''];
}

// ==========================================
// FORMATADORES
// ==========================================

function formatCustomField(field) {
  if (field.value === undefined || field.value === null) return '';
  if (Array.isArray(field.value)) return field.value.map(v => v.name || v).join(', ');
  if (typeof field.value === 'object') return field.value.name || JSON.stringify(field.value);
  return field.value;
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  return new Date(parseInt(timestamp)).toLocaleString();
}

function formatChecklists(checklists) {
  if (!checklists || checklists.length === 0) return '0/0';
  let total = 0;
  let resolved = 0;
  checklists.forEach(cl => {
    total += cl.items ? cl.items.length : 0;
    resolved += cl.items ? cl.items.filter(item => item.resolved).length : 0;
  });
  return resolved + '/' + total;
}

function formatDependencies(deps, type) {
  if (!deps || deps.length === 0) return '';
  const filtered = deps.filter(d => d.type === type);
  return filtered.map(d => d.task_id).join(', ');
}
`;
}