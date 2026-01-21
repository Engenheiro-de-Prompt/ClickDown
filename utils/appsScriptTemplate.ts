// ==========================================
// SCRIPT 1: EXTRAÇÃO SEGURA (UNIDIRECIONAL)
// ==========================================
export function generateExtractionScript(apiKey: string, listId: string | null, teamId: string | null): string {
    return `/**
 * ARQUIVO: Extract.gs
 * TIPO: Extração Unidirecional (ClickUp -> Sheets)
 * DESCRIÇÃO: Este script é focado exclusivamente em baixar dados com segurança.
 * Ele não envia dados de volta para o ClickUp.
 * 
 * INSTRUÇÕES:
 * 1. Cole este código em um arquivo .gs separado (ex: "Extracao.gs").
 * 2. Recarregue a planilha.
 * 3. Use o menu "ClickDown: Extração Segura" para rodar.
 */

const EXT_CONFIG = {
  API_KEY: '${apiKey}',
  LIST_ID: '${listId || ""}',
  TEAM_ID: '${teamId || ""}',
  MAX_EXEC_TIME: 280000 // 4m 40s (Safety buffer)
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('ClickDown: Extração Segura')
    .addItem('⬇️ Baixar Tudo (Workspace)', 'EXT_runWorkspaceExtraction')
    .addItem('⬇️ Baixar Lista Específica', 'EXT_runListExtraction')
    .addSeparator()
    .addItem('⚠️ Limpar Cache de Execução', 'EXT_clearProperties')
    .addToUi();
}

function EXT_clearProperties() {
  PropertiesService.getScriptProperties().deleteAllProperties();
  SpreadsheetApp.getUi().alert('Cache limpo. A próxima execução começará do zero.');
}

// --- ENTRY POINTS ---

function EXT_runWorkspaceExtraction() {
  if (!EXT_CONFIG.TEAM_ID) return SpreadsheetApp.getUi().alert('ID do Time não configurado.');
  EXT_resumeExtraction('workspace');
}

function EXT_runListExtraction() {
  if (!EXT_CONFIG.LIST_ID) return SpreadsheetApp.getUi().alert('ID da Lista não configurado.');
  EXT_resumeExtraction('list');
}

// --- LOGIC ---

function EXT_resumeExtraction(mode) {
  const props = PropertiesService.getScriptProperties();
  const state = props.getProperties();
  const startTime = new Date().getTime();
  
  // Recuperar indices
  let spaceIdx = parseInt(state['EXT_SPACE_IDX'] || '0');
  let folderIdx = parseInt(state['EXT_FOLDER_IDX'] || '0');
  let listIdx = parseInt(state['EXT_LIST_IDX'] || '0');
  let page = parseInt(state['EXT_PAGE'] || '0');
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  // Setup inicial se for o começo
  if (spaceIdx === 0 && folderIdx === 0 && listIdx === 0 && page === 0) {
    sheet.clear();
    const headers = EXT_getBaseHeaders();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    EXT_formatHeaderRow(sheet);
  }

  // Roteamento de modo
  if (mode === 'list') {
    EXT_processSingleList(sheet, startTime, props, page);
  } else {
    EXT_processWorkspace(sheet, startTime, props, spaceIdx, folderIdx, listIdx, page);
  }
}

function EXT_processSingleList(sheet, startTime, props, startPage) {
   let page = startPage;
   while(true) {
     if (EXT_checkTime(startTime, props, { 'EXT_PAGE': page }, 'list')) return;

     const tasks = EXT_fetchTasks(EXT_CONFIG.LIST_ID, page);
     if (tasks.length === 0) break;
     
     EXT_appendRows(sheet, tasks, "Lista Única", "-", "Lista Atual");
     page++;
   }
   EXT_finish(props, sheet);
}

function EXT_processWorkspace(sheet, startTime, props, sIdx, fIdx, lIdx, pIdx) {
  const spaces = EXT_fetchSpaces(EXT_CONFIG.TEAM_ID);
  
  for (let s = sIdx; s < spaces.length; s++) {
    const space = spaces[s];
    // Nota: Simplificação para exemplo - Focando em estrutura Folder > List
    const folders = EXT_fetchFolders(space.id);
    
    // Adicionando uma "folder virtual" para listas soltas se necessário, 
    // mas aqui iteramos folders reais para manter código limpo.
    
    for (let f = fIdx; f < folders.length; f++) {
      const folder = folders[f];
      const lists = EXT_fetchLists(folder.id);
      
      for (let l = lIdx; l < lists.length; l++) {
        const list = lists[l];
        let page = pIdx; // Usa pIdx apenas na primeira iteração do loop interno restaurado
        
        let hasMore = true;
        while(hasMore) {
           if (EXT_checkTime(startTime, props, {
             'EXT_SPACE_IDX': s, 'EXT_FOLDER_IDX': f, 'EXT_LIST_IDX': l, 'EXT_PAGE': page
           }, 'workspace')) return;

           const tasks = EXT_fetchTasks(list.id, page);
           if (tasks && tasks.length > 0) {
             EXT_appendRows(sheet, tasks, space.name, folder.name, list.name);
             page++;
             if (tasks.length < 100) hasMore = false;
           } else {
             hasMore = false;
           }
        }
        pIdx = 0; // Reseta página para a próxima lista
      }
      lIdx = 0; // Reseta lista para a próxima pasta
    }
    fIdx = 0; // Reseta pasta para o próximo espaço
  }
  EXT_finish(props, sheet);
}

function EXT_checkTime(startTime, props, stateObj, mode) {
  if (new Date().getTime() - startTime > EXT_CONFIG.MAX_EXEC_TIME) {
    const saveState = {};
    for (let k in stateObj) saveState[k] = String(stateObj[k]);
    props.setProperties(saveState);
    
    ScriptApp.newTrigger(mode === 'list' ? 'EXT_runListExtraction' : 'EXT_runWorkspaceExtraction')
      .timeBased().after(1000 * 45).create(); // Trigger em 45s
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
  sheet.getRange(1, 1).setNote('Atualizado em: ' + new Date().toLocaleString());
  SpreadsheetApp.getUi().alert('Extração concluída com sucesso!');
}

// --- API HELPERS (PREFIXED) ---

function EXT_fetchTasks(listId, page) {
  const url = "https://api.clickup.com/api/v2/list/" + listId + "/task?page=" + page + "&subtasks=true&include_closed=true&archived=false";
  try {
    const res = UrlFetchApp.fetch(url, { headers: { "Authorization": EXT_CONFIG.API_KEY }, muteHttpExceptions: true });
    return JSON.parse(res.getContentText()).tasks || [];
  } catch(e) { return []; }
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
           let val = cf.value;
           if(typeof val === 'object' && val !== null) val = JSON.stringify(val);
           row[map[cf.name]] = val;
        }
      });
    }
    return row;
  });
  
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  SpreadsheetApp.flush();
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