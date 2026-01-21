import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowRight, ArrowLeft, Database, Download, 
  FileJson, Layers, CheckCircle, RefreshCw, 
  Settings, Key, AlertCircle, FileSpreadsheet, X,
  ArrowDownToLine, ArrowUpDown, Globe, Clock, Play, Square, Save, Calendar,
  ShieldCheck, Server
} from 'lucide-react';
import { ClickUpService } from './services/clickupService';
import { generateExtractionScript, generateBridgeScript } from './utils/appsScriptTemplate';
import { HierarchyState, Task } from './types';

// Components
const StepIndicator = ({ current, step, label }: { current: number, step: number, label: string }) => (
  <div className={`flex items-center space-x-2 ${current === step ? 'text-brand-500 font-bold' : current > step ? 'text-emerald-500' : 'text-slate-500'}`}>
    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
      current === step ? 'border-brand-500 bg-brand-500/10' : 
      current > step ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 bg-slate-800'
    }`}>
      {current > step ? <CheckCircle size={16} /> : <span>{step}</span>}
    </div>
    <span className="hidden sm:inline">{label}</span>
  </div>
);

const TaskDetailModal = ({ task, onClose, onSave }: { task: Task, onClose: () => void, onSave: (task: Task, updates: any) => Promise<void> }) => {
    const [editedTask, setEditedTask] = useState(task);
    const [isSaving, setIsSaving] = useState(false);
    const [timerActive, setTimerActive] = useState(false);
    const [timerStart, setTimerStart] = useState<number | null>(null);
    const [elapsed, setElapsed] = useState(0);

    // Timer Logic
    useEffect(() => {
        let interval: any;
        if (timerActive && timerStart) {
            interval = setInterval(() => {
                setElapsed(Date.now() - timerStart);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [timerActive, timerStart]);

    const formatTime = (ms: number) => {
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor((ms / (1000 * 60 * 60)));
        return `${hours}h ${minutes}m ${seconds}s`;
    };

    const handleSave = async () => {
        setIsSaving(true);
        // Calculate changes
        const updates: any = {};
        if (editedTask.name !== task.name) updates.name = editedTask.name;
        if (editedTask.description !== task.description) updates.description = editedTask.description;
        if (editedTask.status.status !== task.status.status) updates.status = editedTask.status.status;
        if (editedTask.priority?.priority !== task.priority?.priority) updates.priority = editedTask.priority?.priority;
        
        await onSave(task, updates);
        setIsSaving(false);
        onClose();
    };

    const toggleTimer = async () => {
        if (timerActive) {
            // Stop
            setTimerActive(false);
            const sessionTime = Date.now() - (timerStart || 0);
            await onSave(task, { add_time_ms: sessionTime });
            setElapsed(0);
            setTimerStart(null);
        } else {
            // Start
            setTimerStart(Date.now());
            setTimerActive(true);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs uppercase font-bold border ${timerActive ? 'border-red-500 text-red-400 animate-pulse' : 'border-slate-700 text-slate-500'}`}>
                            {timerActive ? 'REC' : task.id}
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                            {isSaving ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                            Salvar Alterações
                        </button>
                        <button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-lg">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Main Content */}
                    <div className="flex-1 p-8 overflow-y-auto border-r border-slate-800">
                        <input 
                            value={editedTask.name}
                            onChange={e => setEditedTask({...editedTask, name: e.target.value})}
                            className="text-2xl font-bold bg-transparent text-white w-full border-none focus:ring-0 px-0 mb-4 placeholder-slate-600"
                            placeholder="Nome da Tarefa"
                        />
                        
                        <div className="flex items-center gap-4 mb-6">
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                <span className="w-2 h-2 rounded-full" style={{background: editedTask.status.color || '#666'}}></span>
                                <input 
                                    value={editedTask.status.status}
                                    onChange={e => setEditedTask({...editedTask, status: {...editedTask.status, status: e.target.value}})}
                                    className="bg-transparent border-b border-slate-700 focus:border-brand-500 outline-none w-24"
                                />
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                <AlertCircle size={14} />
                                <select 
                                    value={editedTask.priority?.priority || 'normal'}
                                    onChange={e => setEditedTask({...editedTask, priority: {priority: e.target.value, color: ''}})}
                                    className="bg-transparent border-none outline-none text-slate-300 cursor-pointer"
                                >
                                    <option value="urgent">Urgente</option>
                                    <option value="high">Alta</option>
                                    <option value="normal">Normal</option>
                                    <option value="low">Baixa</option>
                                </select>
                            </div>
                        </div>

                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 min-h-[200px]">
                            <label className="text-xs uppercase font-bold text-slate-500 mb-2 block">Descrição</label>
                            <textarea 
                                value={editedTask.description || ''}
                                onChange={e => setEditedTask({...editedTask, description: e.target.value})}
                                className="w-full h-48 bg-transparent text-slate-300 resize-none outline-none text-sm leading-relaxed"
                                placeholder="Adicione uma descrição..."
                            />
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="w-80 bg-slate-950 p-6 overflow-y-auto">
                         {/* Timer Widget */}
                         <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 mb-6 shadow-lg">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-xs uppercase font-bold text-slate-500 flex items-center gap-2">
                                    <Clock size={14} /> Rastreador
                                </h4>
                                <span className="text-xs font-mono text-emerald-400">
                                    Total: {((task.time_spent || 0) / 3600000).toFixed(2)}h
                                </span>
                            </div>
                            
                            <div className="text-center py-4">
                                <div className="text-3xl font-mono text-white font-light tracking-wider mb-4">
                                    {formatTime(elapsed)}
                                </div>
                                <button 
                                    onClick={toggleTimer}
                                    className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
                                        timerActive 
                                        ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/50' 
                                        : 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-900/50'
                                    }`}
                                >
                                    {timerActive ? <><Square size={18} fill="currentColor" /> PARAR</> : <><Play size={18} fill="currentColor" /> INICIAR</>}
                                </button>
                            </div>
                         </div>

                         <div className="space-y-6">
                            <div>
                                <label className="text-xs uppercase font-bold text-slate-600 block mb-2">Data de Entrega</label>
                                <div className="flex items-center gap-2 text-slate-300 text-sm bg-slate-900 p-2 rounded border border-slate-800">
                                    <Calendar size={14} />
                                    {task.due_date ? new Date(parseInt(task.due_date)).toLocaleDateString() : 'Sem data'}
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-xs uppercase font-bold text-slate-600 block mb-2">Responsáveis</label>
                                <div className="flex flex-wrap gap-2">
                                    {task.assignees.map(u => (
                                        <div key={u.id} className="flex items-center gap-2 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                                            <div className="w-4 h-4 rounded-full bg-brand-500 text-[8px] flex items-center justify-center text-white">{u.username.substring(0,2)}</div>
                                            <span className="text-xs text-slate-300">{u.username}</span>
                                        </div>
                                    ))}
                                    {task.assignees.length === 0 && <span className="text-xs text-slate-600">Ninguém atribuído</span>}
                                </div>
                            </div>

                             <div>
                                <label className="text-xs uppercase font-bold text-slate-600 block mb-2">Tags</label>
                                <div className="flex flex-wrap gap-2">
                                    {task.tags.map((t, i) => (
                                        <span key={i} className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                                            #{t.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [apiKey, setApiKey] = useState('');
  const [service, setService] = useState<ClickUpService | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // New States for Sheets Mode
  const [dataSource, setDataSource] = useState<'clickup' | 'sheets'>('clickup');
  const [sheetsUrl, setSheetsUrl] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const [hierarchy, setHierarchy] = useState<HierarchyState>({
    teams: [], selectedTeam: null,
    spaces: [], selectedSpace: null,
    folders: [], selectedFolder: null,
    lists: [], selectedList: null,
    extractionMode: null,
    dataSource: 'clickup_api'
  });

  const [tasks, setTasks] = useState<Task[]>([]);
  const [scriptModalOpen, setScriptModalOpen] = useState(false);
  const [scriptType, setScriptType] = useState<'extraction' | 'bridge'>('extraction');

  // -- handlers --

  const handleApiKeySubmit = async () => {
    if (!apiKey.startsWith('pk_')) {
      setError('A chave API deve começar com "pk_"');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const srv = new ClickUpService(apiKey);
      setService(srv);
      const { teams } = await srv.getTeams();
      setHierarchy(prev => ({ ...prev, teams, dataSource: 'clickup_api' }));
      setDataSource('clickup');
      setCurrentStep(2);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSheetsConnect = async () => {
      if (!sheetsUrl.includes('script.google.com')) {
          setError('URL inválida. Deve ser um link de Web App do Google Apps Script.');
          return;
      }
      setLoading(true);
      setError(null);
      
      try {
          // Fetch data from doGet
          const response = await fetch(sheetsUrl + '?op=read', { redirect: "follow" });
          const data = await response.json();
          
          if (data.tasks) {
              setTasks(data.tasks);
              setHierarchy(prev => ({...prev, dataSource: 'google_sheets', sheetsUrl: sheetsUrl}));
              setDataSource('sheets');
              setCurrentStep(3); // Skip selection for sheets mode as it dumps everything
          } else {
              throw new Error('Formato de resposta inválido do Script.');
          }
      } catch (e: any) {
          setError('Erro ao conectar com a Planilha: ' + e.message + '. Verifique se o script está implantado como Web App (Acesso: Qualquer pessoa).');
      } finally {
          setLoading(false);
      }
  };

  const handleTeamChange = async (teamId: string) => {
    setHierarchy(prev => ({ ...prev, selectedTeam: teamId, spaces: [], lists: [], selectedSpace: null, selectedList: null }));
    if (!service) return;
    const { spaces } = await service.getSpaces(teamId);
    setHierarchy(prev => ({ ...prev, spaces }));
  };

  const handleSpaceChange = async (spaceId: string) => {
    setHierarchy(prev => ({ ...prev, selectedSpace: spaceId, lists: [], selectedList: null }));
    if (!service) return;
    setLoading(true);
    try {
      const { folders } = await service.getFolders(spaceId);
      const { lists: folderless } = await service.getFolderlessLists(spaceId);
      let allLists = [...folderless];
      for (const folder of folders) {
          const { lists } = await service.getLists(folder.id);
          allLists = allLists.concat(lists.map(l => ({ ...l, name: `${folder.name} > ${l.name}` })));
      }
      setHierarchy(prev => ({ ...prev, folders, lists: allLists }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const startExtraction = async () => {
    if (!service) return;
    setLoading(true);
    setTasks([]);
    
    try {
      let fetchedTasks: Task[] = [];
      if (hierarchy.extractionMode === 'workspace' && hierarchy.selectedTeam) {
        fetchedTasks = await service.getAllWorkspaceTasks(hierarchy.selectedTeam, (p) => setLoadingStatus(p.status));
      } else if (hierarchy.selectedList) {
        fetchedTasks = await service.getTasks(hierarchy.selectedList, (p) => setLoadingStatus(p.status));
      }
      setTasks(fetchedTasks);
      setCurrentStep(3);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setLoadingStatus('');
    }
  };

  const handleTaskUpdate = async (originalTask: Task, updates: any) => {
      // Optimistic update locally
      setTasks(prev => prev.map(t => t.id === originalTask.id ? { ...t, ...updates, 
        priority: updates.priority ? { priority: updates.priority, color: '' } : t.priority,
        status: updates.status ? { ...t.status, status: updates.status } : t.status
      } : t));

      // Push to Sheets if in Sheets Mode
      if (dataSource === 'sheets' && hierarchy.sheetsUrl) {
          try {
              await fetch(hierarchy.sheetsUrl, {
                  method: 'POST',
                  mode: 'no-cors', 
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      action: 'update_task',
                      id: originalTask.id,
                      sheet_row_index: originalTask.sheet_row_index,
                      updates: updates
                  })
              });
          } catch (e) {
              console.error("Sync failed", e);
              alert("Falha ao salvar no Google Sheets. Verifique a conexão.");
          }
      }
  };

  const downloadCSV = () => {
    if (tasks.length === 0) return;
    // ... (Existing CSV logic)
    const customFieldNames = new Set<string>();
    tasks.forEach(t => t.custom_fields?.forEach(f => customFieldNames.add(f.name)));
    const sortedCustomFields = Array.from(customFieldNames).sort();

    const headers = [
      'ID', 'Nome', 'URL', 'Status', 'Prioridade', 'Descrição', 'Criado em', 
      'Atualizado em', 'Responsáveis', 'Tags', 'Contexto', ...sortedCustomFields
    ];

    const escape = (val: any) => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
        return str;
    };

    const rows = tasks.map(t => {
      const context = t.context_list ? `${t.context_space} > ${t.context_folder} > ${t.context_list}` : 'Lista Atual';
      const base = [
        t.id, t.name, t.url, t.status.status, t.priority?.priority, t.description, 
        new Date(parseInt(t.date_created)).toLocaleDateString(),
        new Date(parseInt(t.date_updated)).toLocaleDateString(),
        t.assignees.map(u => u.username).join(', '),
        t.tags.map(tag => tag.name).join(', '),
        context
      ];
      const customs = sortedCustomFields.map(cf => {
        const field = t.custom_fields?.find(f => f.name === cf);
        if (!field || field.value === undefined) return '';
        if (Array.isArray(field.value)) return field.value.map((v: any) => v.name || v).join('; ');
        if (typeof field.value === 'object') return field.value.name;
        return field.value;
      });
      return [...base, ...customs].map(escape).join(',');
    });

    const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ClickDown_Export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const generatedCode = scriptType === 'extraction' 
      ? generateExtractionScript(apiKey, hierarchy.selectedList, hierarchy.selectedTeam)
      : generateBridgeScript();

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 font-sans selection:bg-brand-500/30">
      
      {selectedTask && (
          <TaskDetailModal 
            task={selectedTask} 
            onClose={() => setSelectedTask(null)} 
            onSave={handleTaskUpdate}
          />
      )}

      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Database className="text-white" size={18} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">ClickDown</h1>
        </div>
        
        <div className="p-6 space-y-8 flex-1">
          <div className="space-y-4">
            <StepIndicator current={currentStep} step={1} label="Conexão" />
            <StepIndicator current={currentStep} step={2} label="Configuração" />
            <StepIndicator current={currentStep} step={3} label="Dashboard" />
          </div>

          {currentStep === 3 && (
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 mt-8">
              <h3 className="text-xs font-uppercase text-slate-400 font-bold mb-2">MODO ATUAL</h3>
              <div className="flex items-center gap-2 mb-4">
                  {dataSource === 'clickup' ? (
                      <div className="flex items-center gap-2 text-brand-400 text-sm font-bold"><Globe size={14}/> ClickUp API</div>
                  ) : (
                      <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold"><FileSpreadsheet size={14}/> Google Sheets</div>
                  )}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Tarefas:</span>
                  <span className="text-white font-mono">{tasks.length}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-800 text-xs text-slate-600 text-center">
          v3.1 • Modular Hub
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* Step 1: CONNECTION TYPE */}
        {currentStep === 1 && (
          <div className="flex-1 overflow-auto p-10 flex flex-col items-center justify-center">
             <h2 className="text-4xl font-bold mb-4 text-center">Como deseja conectar?</h2>
             <p className="text-slate-400 mb-12 text-center max-w-lg">Escolha entre conectar diretamente à API do ClickUp para extração rápida ou usar o Google Sheets como seu banco de dados central.</p>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
                 
                 {/* Option A: ClickUp Direct */}
                 <div className="bg-slate-900 border border-slate-800 hover:border-brand-500 transition-all rounded-2xl p-8 cursor-pointer group relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                         <Globe size={120} />
                     </div>
                     <div className="w-12 h-12 bg-brand-900/50 rounded-xl flex items-center justify-center mb-6 text-brand-400">
                         <Key size={24} />
                     </div>
                     <h3 className="text-xl font-bold mb-2">Extração Direta</h3>
                     <p className="text-slate-400 text-sm mb-6 h-12">Conecte via API Key. Ideal para extrações pontuais e geração de CSV.</p>
                     
                     <div className="space-y-4 border-t border-slate-800 pt-6">
                        <label className="block text-xs font-bold text-slate-500 uppercase">ClickUp API Token</label>
                        <input 
                            type="password" 
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="pk_..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                        <button 
                            onClick={handleApiKeySubmit}
                            disabled={loading || !apiKey}
                            className="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold py-3 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <RefreshCw className="animate-spin" /> : 'Conectar API'}
                        </button>
                     </div>
                 </div>

                 {/* Option B: Google Sheets DB */}
                 <div className="bg-slate-900 border border-slate-800 hover:border-emerald-500 transition-all rounded-2xl p-8 cursor-pointer group relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                         <FileSpreadsheet size={120} />
                     </div>
                     <div className="w-12 h-12 bg-emerald-900/50 rounded-xl flex items-center justify-center mb-6 text-emerald-400">
                         <Database size={24} />
                     </div>
                     <h3 className="text-xl font-bold mb-2">Sheets Database <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded ml-2">NOVO</span></h3>
                     <p className="text-slate-400 text-sm mb-6 h-12">Use o Sheets como banco de dados. Edite tarefas e sincronize automaticamente.</p>
                     
                     <div className="space-y-4 border-t border-slate-800 pt-6">
                        <label className="block text-xs font-bold text-slate-500 uppercase">Script Web App URL</label>
                        <input 
                            type="text" 
                            value={sheetsUrl}
                            onChange={(e) => setSheetsUrl(e.target.value)}
                            placeholder="https://script.google.com/macros/s/..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                        <button 
                            onClick={handleSheetsConnect}
                            disabled={loading || !sheetsUrl}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <RefreshCw className="animate-spin" /> : 'Conectar Planilha'}
                        </button>
                     </div>
                 </div>

             </div>
             {error && (
                <div className="mt-8 p-3 bg-red-900/20 border border-red-900/50 rounded flex items-center text-red-400 text-sm max-w-2xl animate-in fade-in">
                <AlertCircle size={16} className="mr-2" />
                {error}
                </div>
            )}
          </div>
        )}

        {/* STEP 2: SELECTION (ClickUp Only) */}
        {currentStep === 2 && dataSource === 'clickup' && (
            <div className="flex-1 overflow-auto p-10">
                <div className="max-w-2xl mx-auto mt-10 fade-in">
              <h2 className="text-3xl font-bold mb-2">Origem dos Dados</h2>
              <p className="text-slate-400 mb-8">Defina o escopo da extração. Você pode selecionar uma lista específica ou todo o workspace.</p>

              <div className="space-y-6">
                
                {/* Team Select */}
                <div className="group">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Time (Workspace)</label>
                  <select 
                    onChange={(e) => handleTeamChange(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-4 text-white appearance-none focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                    value={hierarchy.selectedTeam || ''}
                  >
                    <option value="">Selecione um Time...</option>
                    {hierarchy.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>

                {hierarchy.selectedTeam && (
                  <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl space-y-6 animate-in slide-in-from-bottom-4">
                    
                    {/* Space Select */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Espaço</label>
                      <select 
                        onChange={(e) => handleSpaceChange(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white appearance-none focus:ring-2 focus:ring-brand-500 outline-none"
                        value={hierarchy.selectedSpace || ''}
                      >
                        <option value="">Selecione um Espaço...</option>
                        {hierarchy.spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>

                    {/* OR Separator */}
                    <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
                        <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-900 px-2 text-slate-500">Filtro Detalhado</span></div>
                    </div>

                    {/* List Select */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Lista Específica</label>
                      <select 
                         onChange={(e) => setHierarchy(h => ({ ...h, selectedList: e.target.value, extractionMode: 'list' }))}
                         disabled={!hierarchy.selectedSpace}
                         className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white appearance-none focus:ring-2 focus:ring-brand-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                         value={hierarchy.selectedList || ''}
                      >
                        <option value="">{loading ? 'Carregando listas...' : 'Selecione uma Lista...'}</option>
                        {hierarchy.lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>

                    {/* Extraction Mode Toggle (Big Button) */}
                    <div 
                      onClick={() => setHierarchy(h => ({ ...h, selectedList: null, extractionMode: 'workspace' }))}
                      className={`cursor-pointer border-2 rounded-xl p-4 flex items-center transition-all ${hierarchy.extractionMode === 'workspace' ? 'border-brand-500 bg-brand-500/10' : 'border-slate-800 hover:border-slate-600'}`}
                    >
                      <div className={`p-2 rounded-lg mr-4 ${hierarchy.extractionMode === 'workspace' ? 'bg-brand-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                        <Layers size={20} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-sm">Extração Global (Workspace)</h4>
                        <p className="text-xs text-slate-400">Baixa todas as tarefas de todos os espaços do time selecionado.</p>
                      </div>
                      {hierarchy.extractionMode === 'workspace' && <CheckCircle className="text-brand-500" size={20} />}
                    </div>

                  </div>
                )}

                <div className="flex justify-between pt-6">
                   <button onClick={() => setCurrentStep(1)} className="text-slate-400 hover:text-white flex items-center px-4 py-2">
                     <ArrowLeft size={16} className="mr-2" /> Voltar
                   </button>
                   <button 
                    onClick={startExtraction}
                    disabled={(!hierarchy.selectedList && hierarchy.extractionMode !== 'workspace') || loading}
                    className="bg-brand-600 hover:bg-brand-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-brand-900/50 flex items-center disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                   >
                     {loading ? (
                       <span className="flex items-center">
                         <RefreshCw className="animate-spin mr-2" size={18} />
                         {loadingStatus || 'Processando...'}
                       </span>
                     ) : (
                       <span className="flex items-center">
                         Iniciar Extração <ArrowRight size={18} className="ml-2" />
                       </span>
                     )}
                   </button>
                </div>
              </div>
            </div>
            </div>
        )}

        {/* STEP 3: DASHBOARD */}
        {currentStep === 3 && (
            <div className="flex-1 overflow-hidden flex flex-col p-6 md:p-10">
              {/* Dashboard Toolbar */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-3">
                      Gerenciador de Tarefas 
                      {dataSource === 'sheets' && <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 px-2 py-1 rounded">Live Sheets</span>}
                  </h2>
                  <p className="text-sm text-slate-400 flex items-center gap-2">
                    {dataSource === 'sheets' ? 'Edições são salvas automaticamente na planilha' : 'Visualização somente leitura (Exportação)'}
                  </p>
                </div>
                <div className="flex space-x-3">
                  {dataSource === 'clickup' && (
                    <button onClick={() => setCurrentStep(2)} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium border border-slate-700 transition-colors">
                        Novo Filtro
                    </button>
                  )}
                  <button onClick={downloadCSV} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium border border-slate-700 flex items-center transition-colors">
                    <Download size={16} className="mr-2 text-slate-400" /> Exportar CSV
                  </button>
                  <button 
                    onClick={() => setScriptModalOpen(true)} 
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg shadow-emerald-900/20 flex items-center transition-all border border-emerald-500"
                  >
                    <FileSpreadsheet size={16} className="mr-2" /> Gerar Script / Setup
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="flex-1 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-2xl relative">
                <div className="absolute inset-0 overflow-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-950 sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800 w-20">ID</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800">Tarefa</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800 w-32">Status</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800">Atribuído</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800">Entrega</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800">Prioridade</th>
                        {dataSource === 'sheets' && <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800 text-right">Ação</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {tasks.map(task => (
                        <tr key={task.id} className="hover:bg-slate-800/50 transition-colors group">
                          <td className="p-4 text-xs font-mono text-slate-500">{task.id}</td>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-slate-200 truncate max-w-xs">{task.name}</span>
                              <span className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                {task.context_list ? (
                                  <>
                                    <Layers size={10} /> {task.context_list}
                                  </>
                                ) : (
                                  <span className="text-xs italic opacity-50">Lista ID: {task.list.id}</span>
                                )}
                              </span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span 
                              className="px-2 py-1 rounded text-xs font-bold uppercase tracking-wide border border-white/10"
                              style={{ color: task.status.color, backgroundColor: `${task.status.color}20` }}
                            >
                              {task.status.status}
                            </span>
                          </td>
                          <td className="p-4">
                             <div className="flex -space-x-2">
                               {task.assignees.length > 0 ? task.assignees.map(u => (
                                 <div key={u.id} className="w-6 h-6 rounded-full bg-slate-700 border border-slate-900 flex items-center justify-center text-xs text-white uppercase" title={u.username}>
                                   {u.username.substring(0, 2)}
                                 </div>
                               )) : <span className="text-slate-600 text-xs">-</span>}
                             </div>
                          </td>
                          <td className="p-4 text-sm text-slate-400">
                            {task.due_date ? new Date(parseInt(task.due_date)).toLocaleDateString() : '-'}
                          </td>
                          <td className="p-4">
                             {task.priority ? (
                               <div className="flex items-center gap-2">
                                 <div className="w-2 h-2 rounded-full" style={{ background: task.priority.color || '#666' }}></div>
                                 <span className="text-xs capitalize">{task.priority.priority}</span>
                               </div>
                             ) : <span className="text-slate-600 text-xs">-</span>}
                          </td>
                          {dataSource === 'sheets' && (
                              <td className="p-4 text-right">
                                  <button onClick={() => setSelectedTask(task)} className="text-brand-400 hover:text-brand-300 text-xs font-bold border border-brand-500/30 px-3 py-1 rounded bg-brand-500/10 hover:bg-brand-500/20 transition-all">
                                      ABRIR
                                  </button>
                              </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
        )}

        {/* SCRIPT MODAL */}
          {scriptModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                       <FileJson className="text-emerald-500" /> Configuração Google Sheets
                    </h3>
                    <p className="text-sm text-slate-400">Automatize a sincronização dos seus dados.</p>
                  </div>
                  <button onClick={() => setScriptModalOpen(false)} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-lg transition-colors">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                  {/* Settings Sidebar */}
                  <div className="w-full md:w-1/3 p-6 bg-slate-800/50 border-r border-slate-800 overflow-y-auto">
                     
                     <div className="mb-6">
                       <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">Tipo de Script</label>
                       
                       <div className="space-y-3">
                         <div 
                           onClick={() => setScriptType('extraction')}
                           className={`p-3 rounded-lg border cursor-pointer transition-all ${scriptType === 'extraction' ? 'bg-brand-900/20 border-brand-500' : 'bg-slate-800 border-slate-700 hover:border-slate-600'}`}
                         >
                           <div className="flex items-center gap-2 mb-1">
                             <ShieldCheck size={16} className={scriptType === 'extraction' ? 'text-brand-400' : 'text-slate-400'} />
                             <span className={`font-medium text-sm ${scriptType === 'extraction' ? 'text-brand-100' : 'text-slate-300'}`}>1. Extração Segura</span>
                           </div>
                           <p className="text-xs text-slate-500 leading-relaxed">
                             ClickUp → Sheets. Unidirecional (apenas leitura do ClickUp). Segura e massiva.
                           </p>
                         </div>

                         <div 
                           onClick={() => setScriptType('bridge')}
                           className={`p-3 rounded-lg border cursor-pointer transition-all ${scriptType === 'bridge' ? 'bg-emerald-900/20 border-emerald-500' : 'bg-slate-800 border-slate-700 hover:border-slate-600'}`}
                         >
                           <div className="flex items-center gap-2 mb-1">
                             <Server size={16} className={scriptType === 'bridge' ? 'text-emerald-400' : 'text-slate-400'} />
                             <span className={`font-medium text-sm ${scriptType === 'bridge' ? 'text-emerald-100' : 'text-slate-300'}`}>2. API Bridge (App)</span>
                           </div>
                           <p className="text-xs text-slate-500 leading-relaxed">
                             App ↔ Sheets. Permite que o app leia/edite o Sheets. Web App Deployment.
                           </p>
                         </div>
                       </div>
                     </div>

                     <h4 className="font-bold text-sm uppercase text-slate-500 mb-4">Instruções</h4>
                     {scriptType === 'extraction' ? (
                        <ol className="space-y-4 text-sm text-slate-300 list-decimal list-inside">
                            <li className="pl-2">Crie um arquivo chamado <span className="text-white font-mono">Extracao.gs</span>.</li>
                            <li className="pl-2">Cole o código.</li>
                            <li className="pl-2">Atualize a página do Sheets.</li>
                            <li className="pl-2">Use o menu <span className="text-brand-400">ClickDown: Extração Segura</span> para baixar dados.</li>
                        </ol>
                     ) : (
                        <ol className="space-y-4 text-sm text-slate-300 list-decimal list-inside">
                            <li className="pl-2">Crie um arquivo chamado <span className="text-white font-mono">Bridge.gs</span>.</li>
                            <li className="pl-2">Cole o código.</li>
                            <li className="pl-2"><span className="text-white font-medium">Implante:</span> Clique em Implantar &gt; Nova Implantação.</li>
                            <li className="pl-2">Tipo: <span className="text-white">"App da Web"</span>.</li>
                            <li className="pl-2">Acesso: <span className="text-emerald-400">"Qualquer pessoa"</span>.</li>
                            <li className="pl-2">Copie a URL e cole no passo 1 do App.</li>
                        </ol>
                     )}
                     
                  </div>

                  {/* Code Viewer */}
                  <div className="flex-1 bg-slate-950 relative overflow-hidden group">
                    <div className="absolute top-4 right-4 z-10">
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(generatedCode);
                        }}
                        className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded shadow-lg text-xs font-bold uppercase tracking-wider transition-all transform active:scale-95"
                      >
                        Copiar Código
                      </button>
                    </div>
                    <pre className="p-6 text-xs font-mono text-slate-300 h-full overflow-auto custom-scrollbar">
                      <code>{generatedCode}</code>
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}

      </main>
    </div>
  );
};

export default App;