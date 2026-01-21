// ==========================================
// SCRIPT 1: EXTRAÇÃO SEGURA (UNIDIRECIONAL)
// ==========================================
export function generateExtractionScript(apiKey: string, listId: string | null, teamId: string | null): string {
    return `/**
 * ARQUIVO: Extract.gs
 * TIPO: Extração Unidirecional (ClickUp -> Sheets)
 * v3.3 - Correção de Tipos de Dados (IDs para Valores)
 * 
 * Este script agora extrai tarefas ativas E arquivadas.
 * Resolve IDs de campos personalizados (Dropdowns, Labels, Users, etc.) para valores legíveis.
 */

const EXT_CONFIG = {
  API_KEY: '${apiKey}',
  LIST_ID: '${listId || ""}',
  TEAM_ID: '${teamId || ""}',
  MAX_EXEC_TIME: 280000, // 4m 40s (Safety buffer)
  MAX_RETRIES: 3
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ClickDown: Extração Segura')
    .addItem('⬇️ Baixar Tudo (Workspace)', 'EXT_runWorkspaceExtraction')
    .addItem('⬇️ Baixar Lista Específica', 'EXT_runListExtraction')
    .addSeparator()
    .addItem('⚠️ Limpar Cache', 'EXT_clearProperties')
    .addItem('📋 Ver Logs', 'EXT_showLogs')
    .addToUi();
}

function EXT_showLogs() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ClickDown_Logs');
  if (sheet) sheet.activate();
  else SpreadsheetApp.getUi().alert('Nenhum log encontrado ainda. Execute uma extração primeiro.');
}

function EXT_clearProperties() {
  PropertiesService.getScriptProperties().deleteAllProperties();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ClickDown_Logs');
  if(sheet) sheet.clear();
  SpreadsheetApp.getUi().alert('Cache e Logs limpos. A próxima execução será do zero.');
}

// --- ENTRY POINTS ---

function EXT_runWorkspaceExtraction() {
  if (!EXT_CONFIG.TEAM_ID) return SpreadsheetApp.getUi().alert('ID do Time não configurado.');
  EXT_log("=== INICIANDO EXTRAÇÃO DO WORKSPACE ===");
  EXT_resumeExtraction('workspace');
}

function EXT_runListExtraction() {
  if (!EXT_CONFIG.LIST_ID) return SpreadsheetApp.getUi().alert('ID da Lista não configurado.');
  EXT_log("=== INICIANDO EXTRAÇÃO DE LISTA ÚNICA ===");
  EXT_resumeExtraction('list');
}

// --- LOGIC ---

function EXT_resumeExtraction(mode) {
  const props = PropertiesService.getScriptProperties();
  const state = props.getProperties();
  const startTime = new Date().getTime();
  
  // Indices Recuperados
  let sIdx = parseInt(state['EXT_SPACE_IDX'] || '0');
  let fIdx = parseInt(state['EXT_FOLDER_IDX'] || '0');
  let lIdx = parseInt(state['EXT_LIST_IDX'] || '0');
  let aIdx = parseInt(state['EXT_ARCHIVED_IDX'] || '0'); // 0 = Ativas, 1 = Arquivadas
  let pIdx = parseInt(state['EXT_PAGE'] || '0');
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (sheet.getName() === 'ClickDown_Logs') {
    SpreadsheetApp.getUi().alert('Erro: Mude para a aba de destino dos dados (não use a aba Logs).');
    return;
  }
  
  // Setup inicial
  if (sIdx === 0 && fIdx === 0 && lIdx === 0 && aIdx === 0 && pIdx === 0) {
    sheet.clear();
    const headers = EXT_getBaseHeaders();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    EXT_formatHeaderRow(sheet);
  }

  try {
    if (mode === 'list') {
      EXT_processSingleList(sheet, startTime, props, aIdx, pIdx);
    } else {
      EXT_processWorkspace(sheet, startTime, props, sIdx, fIdx, lIdx, aIdx, pIdx);
    }
  } catch (e) {
    EXT_log("ERRO FATAL: " + e.toString());
    SpreadsheetApp.getUi().alert("Erro: Veja a aba ClickDown_Logs para detalhes.");
    throw e;
  }
}

function EXT_processSingleList(sheet, startTime, props, startAIdx, startPIdx) {
   const states = [false, true]; // [Ativo, Arquivado]
   
   for (let a = startAIdx; a < states.length; a++) {
     const isArchived = states[a];
     let page = (a === startAIdx) ? startPIdx : 0;
     
     EXT_log('Processando Lista ' + EXT_CONFIG.LIST_ID + ' | Arquivado: ' + isArchived + ' | Pag Inicial: ' + page);

     while(true) {
       if (EXT_checkTime(startTime, props, { 'EXT_ARCHIVED_IDX': a, 'EXT_PAGE': page }, 'list')) return;

       const tasks = EXT_fetchTasksWithRetry(EXT_CONFIG.LIST_ID, page, isArchived);
       
       if (tasks.length > 0) {
         EXT_appendRows(sheet, tasks, "Lista Única", "-", "Lista Atual");
         // Log compactado
         if (page % 5 === 0) EXT_log(' -> Pag ' + page + ': + ' + tasks.length + ' tarefas.');
       }
       
       if (tasks.length < 100) break;
       page++;
     }
   }
   EXT_finish(props, sheet);
}

function EXT_processWorkspace(sheet, startTime, props, sIdx, fIdx, lIdx, aIdx, pIdx) {
  const spaces = EXT_fetchSpaces(EXT_CONFIG.TEAM_ID);
  
  for (let s = sIdx; s < spaces.length; s++) {
    const space = spaces[s];
    
    // Busca pastas normais
    const folders = EXT_fetchFolders(space.id);
    // Cria estrutura unificada: [Listas Soltas (Pasta Virtual)] + [Pastas Reais]
    const allFolders = [{id: "folderless", name: "(Sem Pasta)", isVirtual: true}, ...folders];

    // Ajuste de índice de pasta
    const startFolder = (s === sIdx) ? fIdx : 0;
    
    for (let f = startFolder; f < allFolders.length; f++) {
      const folder = allFolders[f];
      let lists = [];
      
      try {
        if (folder.isVirtual) {
           lists = EXT_fetchFolderlessLists(space.id);
        } else {
           lists = EXT_fetchLists(folder.id);
        }
      } catch (e) {
         EXT_log("AVISO: Falha ao listar pastas em " + space.name + ". " + e.message);
         continue; 
      }

      if (lists.length === 0) continue;

      // Ajuste de índice de lista
      const startList = (s === sIdx && f === fIdx) ? lIdx : 0;
      
      for (let l = startList; l < lists.length; l++) {
        const list = lists[l];
        const states = [false, true]; // [Ativo, Arquivado]
        
        // Ajuste de estado arquivado
        const startArchived = (s === sIdx && f === fIdx && l === lIdx) ? aIdx : 0;
        
        for (let a = startArchived; a < 2; a++) {
           const isArchived = states[a];
           // Ajuste de página
           let page = (s === sIdx && f === fIdx && l === lIdx && a === startArchived) ? pIdx : 0;
           
           // Se mudamos de contexto, reseta pIdx local
           if (!(s === sIdx && f === fIdx && l === lIdx && a === startArchived)) pIdx = 0;

           while(true) {
             // Check Time e Salva Estado Completo
             if (EXT_checkTime(startTime, props, {
               'EXT_SPACE_IDX': s, 'EXT_FOLDER_IDX': f, 'EXT_LIST_IDX': l, 
               'EXT_ARCHIVED_IDX': a, 'EXT_PAGE': page
             }, 'workspace')) return;
             
             try {
                const tasks = EXT_fetchTasksWithRetry(list.id, page, isArchived);
                
                if (tasks && tasks.length > 0) {
                   EXT_appendRows(sheet, tasks, space.name, folder.name, list.name);
                }
                
                if (page === 0 && tasks.length > 0) EXT_log('Iniciando: ' + space.name + ' > ' + list.name + (isArchived ? ' [ARQ]' : ''));
                if (tasks.length === 100) EXT_log(' -> Pag ' + page + ': Lote completo (100)');

                if (tasks.length < 100) break;
                page++;
             } catch (err) {
                EXT_log("ERRO (Pular Lista): " + list.name + " - " + err.message);
                break; 
             }
           }
        }
      }
    }
  }
  EXT_finish(props, sheet);
}

function EXT_checkTime(startTime, props, stateObj, mode) {
  if (new Date().getTime() - startTime > EXT_CONFIG.MAX_EXEC_TIME) {
    const saveState = {};
    for (let k in stateObj) saveState[k] = String(stateObj[k]);
    props.setProperties(saveState);
    EXT_log("⏰ Tempo limite. Salvando estado para continuar em 45s...");
    EXT_log("Estado: " + JSON.stringify(saveState));
    
    ScriptApp.newTrigger(mode === 'list' ? 'EXT_runListExtraction' : 'EXT_runWorkspaceExtraction')
      .timeBased().after(1000 * 45).create(); 
    return true;
  }
  return false;
}

function EXT_finish(props, sheet) {
  props.deleteAllProperties();
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction().startsWith('EXT_run')) ScriptApp.deleteTrigger(t);
  });
  
  const msg = 'Extração Concluída! Total de linhas: ' + sheet.getLastRow();
  sheet.getRange(1, 1).setNote(msg + ' em ' + new Date().toLocaleString());
  EXT_log("✅ " + msg);
  SpreadsheetApp.getUi().alert(msg);
}

// --- API HELPERS (ROBUST) ---

function EXT_fetchTasksWithRetry(listId, page, archived) {
  let attempt = 0;
  while(attempt < EXT_CONFIG.MAX_RETRIES) {
    try {
      const url = "https://api.clickup.com/api/v2/list/" + listId + "/task?page=" + page + "&subtasks=true&include_closed=true&archived=" + archived;
      const res = UrlFetchApp.fetch(url, { headers: { "Authorization": EXT_CONFIG.API_KEY }, muteHttpExceptions: true });
      const code = res.getResponseCode();
      
      if (code === 200) {
         const json = JSON.parse(res.getContentText());
         return json.tasks || [];
      } else if (code === 429) {
         EXT_log("⚠️ Rate Limit (429). Pausa de 5s...");
         Utilities.sleep(5000);
      } else {
         throw new Error("HTTP " + code + ": " + res.getContentText());
      }
    } catch(e) {
      EXT_log("⚠️ Erro fetch (Tentativa " + (attempt+1) + "): " + e.message);
      attempt++;
      Utilities.sleep(2000 * attempt);
    }
  }
  throw new Error("Falha definitiva ao buscar tarefas na lista " + listId);
}

function EXT_fetchSpaces(teamId) {
  return JSON.parse(UrlFetchApp.fetch("https://api.clickup.com/api/v2/team/" + teamId + "/space", { headers: { "Authorization": EXT_CONFIG.API_KEY } }).getContentText()).spaces || [];
}
function EXT_fetchFolders(spaceId) {
  return JSON.parse(UrlFetchApp.fetch("https://api.clickup.com/api/v2/space/" + spaceId + "/folder", { headers: { "Authorization": EXT_CONFIG.API_KEY } }).getContentText()).folders || [];
}
function EXT_fetchLists(folderId) {
  return JSON.parse(UrlFetchApp.fetch("https://api.clickup.com/api/v2/folder/" + folderId + "/list", { headers: { "Authorization": EXT_CONFIG.API_KEY } }).getContentText()).lists || [];
}
function EXT_fetchFolderlessLists(spaceId) {
  return JSON.parse(UrlFetchApp.fetch("https://api.clickup.com/api/v2/space/" + spaceId + "/list", { headers: { "Authorization": EXT_CONFIG.API_KEY } }).getContentText()).lists || [];
}

// --- LOGGER ---
function EXT_log(msg) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('ClickDown_Logs');
  if (!sheet) {
    sheet = ss.insertSheet('ClickDown_Logs');
    sheet.appendRow(['Timestamp', 'Mensagem']);
    sheet.setColumnWidth(1, 150);
    sheet.setColumnWidth(2, 500);
    sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
  }
  sheet.appendRow([new Date().toLocaleString(), msg]);
  // Limpeza automática de logs antigos se passar de 2000 linhas
  if (sheet.getLastRow() > 2000) {
      sheet.deleteRows(2, 500); 
  }
  console.log(msg);
}

// --- SHEET HELPERS ---

function EXT_appendRows(sheet, tasks, sName, fName, lName) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach((h, i) => map[h] = i);
  
  // Check for new custom fields
  let newCols = 0;
  tasks.forEach(t => {
    if(t.custom_fields) {
      t.custom_fields.forEach(cf => {
        if(!map.hasOwnProperty(cf.name)) {
          const colIdx = headers.length + newCols + 1;
          sheet.getRange(1, colIdx).setValue(cf.name).setFontWeight('bold').setBackground('#0f172a').setFontColor('white');
          map[cf.name] = colIdx - 1;
          newCols++;
        }
      });
    }
  });
  
  // Recalcular map se houver novas colunas
  if (newCols > 0) {
     const newHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
     newHeaders.forEach((h, i) => map[h] = i);
  }

  const rows = tasks.map(t => {
    const row = new Array(Object.keys(map).length).fill('');
    
    // Base Mappings
    if(map['ID'] !== undefined) row[map['ID']] = t.id;
    if(map['Nome'] !== undefined) row[map['Nome']] = t.name;
    if(map['Status'] !== undefined) row[map['Status']] = t.status ? t.status.status : '';
    if(map['Espaço'] !== undefined) row[map['Espaço']] = sName;
    if(map['Pasta'] !== undefined) row[map['Pasta']] = fName;
    if(map['Lista'] !== undefined) row[map['Lista']] = lName;
    if(map['URL'] !== undefined) row[map['URL']] = t.url;
    if(map['Descrição'] !== undefined) row[map['Descrição']] = t.description ? t.description.substring(0, 5000) : '';
    if(map['Data de Entrega'] !== undefined) row[map['Data de Entrega']] = t.due_date ? new Date(parseInt(t.due_date)).toLocaleString() : '';
    if(map['Prioridade'] !== undefined) row[map['Prioridade']] = t.priority ? t.priority.priority : '';
    
    // Custom Fields
    if(t.custom_fields) {
      t.custom_fields.forEach(cf => {
        if(map[cf.name] !== undefined) {
           row[map[cf.name]] = EXT_resolveCustomField(cf);
        }
      });
    }
    return row;
  });
  
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  SpreadsheetApp.flush();
}

function EXT_resolveCustomField(field) {
    if (field.value === undefined || field.value === null) return '';

    // Handle Dropdowns and Labels (UUID lookup)
    if ((field.type === 'drop_down' || field.type === 'labels') && field.type_config && field.type_config.options) {
        if (Array.isArray(field.value)) {
            return field.value.map(function(val) {
                var option = field.type_config.options.find(function(o) { return o.id === val || o.orderindex === val; });
                return option ? option.label : val;
            }).join(', ');
        } else {
            var option = field.type_config.options.find(function(o) { return o.id === field.value || o.orderindex === field.value; });
            return option ? option.label : field.value;
        }
    }

    // Handle Users
    if (field.type === 'users' && Array.isArray(field.value)) {
        return field.value.map(function(u) { return u.username || u.id; }).join(', ');
    }

    // Handle Date
    if (field.type === 'date' && field.value) {
        try {
            var timestamp = parseInt(field.value);
            if (!isNaN(timestamp)) {
                return new Date(timestamp).toLocaleDateString();
            }
        } catch (e) { return field.value; }
    }

    // Handle Checkbox
    if (field.type === 'checkbox') {
        return (field.value === 'true' || field.value === true) ? 'Sim' : 'Não';
    }

    // Handle Rating
    if (field.type === 'rating' && field.type_config && field.type_config.count) {
        return field.value + '/' + field.type_config.count;
    }

    // Handle Location
    if (field.type === 'location' && field.value && field.value.formatted_address) {
        return field.value.formatted_address;
    }

    // Handle Relationships and Tasks
    if ((field.type === 'list_relationship' || field.type === 'task_relationship') && Array.isArray(field.value)) {
        return field.value.map(function(t) { return t.name || t.id; }).join(', ');
    }

    // Handle Object values (fallback)
    if (typeof field.value === 'object' && !Array.isArray(field.value)) {
        return field.value.name || field.value.label || field.value.value || JSON.stringify(field.value);
    }

    return field.value;
}

function EXT_getBaseHeaders() {
  return ['ID', 'Nome', 'URL', 'Status', 'Prioridade', 'Data de Entrega', 'Espaço', 'Pasta', 'Lista', 'Descrição', 'Tempo Rastreado (h)'];
}

function EXT_formatHeaderRow(sheet) {
  sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold').setBackground('#0f172a').setFontColor('white').setWrap(false);
}
`;
}

// ==========================================
// SCRIPT 2: BRIDGE (WEB APP BIDIRECIONAL)
// ==========================================
export function generateBridgeScript(): string {
    return `/**
 * ARQUIVO: Bridge.gs
 * TIPO: Integração Bidirecional (App <-> Sheets)
 * DESCRIÇÃO: Este script serve como API para o ClickDown App (Web).
 * Ele recebe comandos do App para atualizar a planilha e serve dados JSON.
 * 
 * INSTRUÇÕES:
 * 1. Cole este código em um arquivo .gs separado (ex: "ApiBridge.gs").
 * 2. Implante como Web App (Executar como: Eu / Acesso: Qualquer pessoa).
 */

// --- WEB APP HANDLERS (RESERVED) ---

function doGet(e) {
  // Retorna JSON estruturado da planilha para o App
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return _jsonResponse({ tasks: [] });

  const headers = data[0];
  const rows = data.slice(1);
  const map = {};
  headers.forEach((h, i) => map[h] = i);

  const tasks = rows.map((r, i) => ({
      sheet_row_index: i + 2,
      id: r[map['ID']],
      name: r[map['Nome']],
      status: { status: r[map['Status']], color: '#888', type: 'custom' },
      priority: r[map['Prioridade']] ? { priority: r[map['Prioridade']] } : null,
      description: r[map['Descrição']],
      due_date: r[map['Data de Entrega']] ? new Date(r[map['Data de Entrega']]).getTime().toString() : null,
      context_space: r[map['Espaço']],
      context_folder: r[map['Pasta']],
      context_list: r[map['Lista']],
      list: { id: 'sheet', name: r[map['Lista']] || 'Sheet List' },
      time_spent: parseFloat(r[map['Tempo Rastreado (h)']] || 0) * 3600000,
      assignees: [], // Simplificado para leitura
      tags: []
  })).filter(t => t.id);

  return _jsonResponse({ tasks: tasks });
}

function doPost(e) {
  // Recebe atualizações do App
  try {
    const p = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    if (p.action === 'update_task') {
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const colMap = {};
      headers.forEach((h, i) => colMap[h] = i + 1);

      let rowIndex = p.sheet_row_index;
      
      // Validação de segurança básica
      const idVal = sheet.getRange(rowIndex, colMap['ID']).getValue();
      if (String(idVal) !== String(p.id)) {
        return _jsonResponse({ error: 'Mismatch de ID. Recarregue os dados.' });
      }

      // Aplica updates
      if (p.updates.name && colMap['Nome']) sheet.getRange(rowIndex, colMap['Nome']).setValue(p.updates.name);
      if (p.updates.description && colMap['Descrição']) sheet.getRange(rowIndex, colMap['Descrição']).setValue(p.updates.description);
      if (p.updates.status && colMap['Status']) sheet.getRange(rowIndex, colMap['Status']).setValue(p.updates.status);
      if (p.updates.priority && colMap['Prioridade']) sheet.getRange(rowIndex, colMap['Prioridade']).setValue(p.updates.priority);
      
      // Atualização de tempo
      if (p.updates.add_time_ms && colMap['Tempo Rastreado (h)']) {
         const cell = sheet.getRange(rowIndex, colMap['Tempo Rastreado (h)']);
         const current = parseFloat(cell.getValue()) || 0;
         cell.setValue(current + (p.updates.add_time_ms / 3600000));
      }

      return _jsonResponse({ success: true });
    }
    return _jsonResponse({ error: 'Ação desconhecida' });
  } catch (err) {
    return _jsonResponse({ error: err.toString() });
  }
}

function _jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
`;
}