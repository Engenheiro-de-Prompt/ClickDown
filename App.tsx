import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowRight, ArrowLeft, Database, Download, 
  FileJson, Layers, CheckCircle, RefreshCw, 
  Settings, Key, AlertCircle, FileSpreadsheet, X,
  ArrowDownToLine, ArrowUpDown, Globe, Clock, Play, Square, Save, Calendar,
  ShieldCheck, Server, LayoutList, Kanban, Filter, ChevronDown, ChevronRight,
  MoreHorizontal, Plus
} from 'lucide-react';
import { ClickUpService } from './services/clickupService';
import { generateExtractionScript, generateBridgeScript } from './utils/appsScriptTemplate';
import { HierarchyState, Task, ViewType, GroupBy } from './types';

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

// --- CLICKUP UI COMPONENTS ---

const StatusBadge = ({ status, color }: { status: string, color: string }) => (
    <span 
      className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border truncate max-w-[100px]"
      style={{ 
          color: color, 
          backgroundColor: `${color}15`,
          borderColor: `${color}30`
      }}
    >
      {status}
    </span>
);

const PriorityFlag = ({ priority }: { priority?: string }) => {
    if (!priority) return null;
    const colors: Record<string, string> = {
        urgent: '#ef4444',
        high: '#eab308',
        normal: '#3b82f6',
        low: '#94a3b8'
    };
    return (
        <div className="flex items-center gap-1.5" title={`Prioridade: ${priority}`}>
            <div className={`w-2 h-2 rounded-sm`} style={{ backgroundColor: colors[priority] || colors.normal }}></div>
            <span className="text-xs capitalize text-slate-400 hidden sm:inline">{priority}</span>
        </div>
    );
};

const TaskCard: React.FC<{ task: Task; onClick: () => void }> = ({ task, onClick }) => (
    <div 
        onClick={onClick}
        className="bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-brand-500/50 p-3 rounded-lg shadow-sm cursor-pointer transition-all group flex flex-col gap-2"
    >
        <div className="flex justify-between items-start">
             <span className="text-xs text-slate-500 font-mono">#{task.id}</span>
             {task.assignees.length > 0 && (
                <div className="flex -space-x-1">
                    {task.assignees.slice(0, 3).map(u => (
                        <div key={u.id} className="w-5 h-5 rounded-full bg-slate-700 border border-slate-900 flex items-center justify-center text-[8px] text-white uppercase">
                            {u.username.substring(0,2)}
                        </div>
                    ))}
                </div>
             )}
        </div>
        <div className="font-medium text-slate-200 text-sm line-clamp-2 leading-tight">
            {task.name}
        </div>
        <div className="flex items-center justify-between mt-1 pt-2 border-t border-slate-800/50">
            <StatusBadge status={task.status.status} color={task.status.color} />
            <PriorityFlag priority={task.priority?.priority} />
        </div>
        {task.due_date && (
            <div className="text-[10px] text-slate-500 flex items-center gap-1">
                <Calendar size={10} />
                {new Date(parseInt(task.due_date)).toLocaleDateString()}
            </div>
        )}
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
            setTimerActive(false);
            const sessionTime = Date.now() - (timerStart || 0);
            await onSave(task, { add_time_ms: sessionTime });
            setElapsed(0);
            setTimerStart(null);
        } else {
            setTimerStart(Date.now());
            setTimerActive(true);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-6xl h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
                {/* ClickUp 3.0 Header */}
                <div className="h-14 border-b border-slate-800 bg-slate-950 flex justify-between items-center px-4">
                    <div className="flex items-center gap-3 text-sm text-slate-500 overflow-hidden">
                        <span className="flex items-center gap-1 hover:text-white cursor-pointer transition-colors">
                             <Layers size={14} /> 
                             {task.context_space || 'Espaço'}
                        </span>
                        <ChevronRight size={12} />
                        <span className="hover:text-white cursor-pointer transition-colors">
                             {task.context_folder || 'Pasta'}
                        </span>
                        <ChevronRight size={12} />
                        <span className="text-white font-medium flex items-center gap-2">
                            {task.context_list || 'Lista'}
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 border border-slate-700">#{task.id}</span>
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wide transition-colors disabled:opacity-50">
                            {isSaving ? <RefreshCw className="animate-spin" size={14} /> : <Save size={14} />}
                            Salvar
                        </button>
                        <button onClick={onClose} className="hover:bg-slate-800 text-slate-400 hover:text-white p-1.5 rounded transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden bg-slate-900">
                    {/* LEFT COLUMN: Content */}
                    <div className="flex-1 p-8 overflow-y-auto border-r border-slate-800 custom-scrollbar">
                        
                        {/* Title & Status Bar */}
                        <div className="flex items-start gap-4 mb-6">
                            <div className="pt-2">
                                <StatusBadge status={editedTask.status.status} color={editedTask.status.color || '#888'} />
                            </div>
                            <textarea 
                                value={editedTask.name}
                                onChange={e => setEditedTask({...editedTask, name: e.target.value})}
                                className="text-3xl font-bold bg-transparent text-white w-full border-none focus:ring-0 px-0 resize-none h-auto overflow-hidden placeholder-slate-600 leading-tight"
                                placeholder="Nome da Tarefa"
                                rows={2}
                            />
                        </div>

                        {/* Description Block */}
                        <div className="group mb-8">
                            <label className="flex items-center gap-2 text-xs uppercase font-bold text-slate-500 mb-3 select-none">
                                <FileSpreadsheet size={14} /> Descrição
                            </label>
                            <div className="min-h-[150px] p-4 rounded-lg border border-transparent hover:border-slate-700 bg-slate-800/20 hover:bg-slate-800/40 transition-all">
                                <textarea 
                                    value={editedTask.description || ''}
                                    onChange={e => setEditedTask({...editedTask, description: e.target.value})}
                                    className="w-full h-full bg-transparent text-slate-300 resize-none outline-none text-sm leading-relaxed min-h-[150px]"
                                    placeholder="Adicione detalhes, slash commands, ou cole imagens..."
                                />
                            </div>
                        </div>

                        {/* Subtasks / Checklists Simulation */}
                        <div className="mb-8">
                            <div className="flex items-center justify-between mb-3">
                                <label className="flex items-center gap-2 text-xs uppercase font-bold text-slate-500 select-none">
                                    <CheckCircle size={14} /> Subtarefas
                                </label>
                                <button className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                                    <Plus size={12} /> Nova Subtarefa
                                </button>
                            </div>
                            <div className="bg-slate-950 rounded-lg border border-slate-800 overflow-hidden">
                                {task.subtasks && task.subtasks.length > 0 ? (
                                    task.subtasks.map((st, i) => (
                                        <div key={i} className="flex items-center gap-3 p-3 border-b border-slate-800 last:border-0 hover:bg-slate-900 transition-colors">
                                            <Square size={16} className="text-slate-600" />
                                            <span className="text-sm text-slate-300">{st.name}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-4 text-center text-slate-600 text-sm italic">
                                        Nenhuma subtarefa encontrada.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Attachments Placeholder */}
                         <div className="mb-8 opacity-50">
                            <label className="flex items-center gap-2 text-xs uppercase font-bold text-slate-500 mb-3 select-none">
                                <Database size={14} /> Anexos
                            </label>
                            <div className="border-2 border-dashed border-slate-800 rounded-lg p-6 flex flex-col items-center justify-center text-slate-600">
                                <span className="text-xs">Arraste arquivos aqui</span>
                            </div>
                        </div>

                    </div>

                    {/* RIGHT COLUMN: Sidebar (Properties) */}
                    <div className="w-[350px] bg-slate-950 border-l border-slate-800 flex flex-col">
                        
                         {/* Properties List */}
                         <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                            
                            {/* Actions Panel */}
                            <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-xs font-bold text-slate-500 uppercase flex gap-2 items-center">
                                        <Clock size={14}/> Tracking
                                    </span>
                                    <span className="text-xs font-mono text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded">
                                        {((task.time_spent || 0) / 3600000).toFixed(2)}h
                                    </span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                     <div className="text-xl font-mono text-white tracking-widest">
                                        {formatTime(elapsed)}
                                     </div>
                                     <button 
                                        onClick={toggleTimer}
                                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                                            timerActive 
                                            ? 'bg-red-500 text-white shadow-lg shadow-red-900/50 animate-pulse' 
                                            : 'bg-emerald-600 text-white hover:bg-emerald-500'
                                        }`}
                                    >
                                        {timerActive ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5"/>}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {/* Details Grid */}
                                <div className="grid grid-cols-1 gap-4">
                                    
                                    <div className="group">
                                        <label className="text-[10px] uppercase font-bold text-slate-600 mb-1.5 block group-hover:text-brand-500 transition-colors">Criado em</label>
                                        <div className="text-sm text-slate-300">{new Date(parseInt(task.date_created)).toLocaleDateString()}</div>
                                    </div>

                                    <div className="group">
                                        <label className="text-[10px] uppercase font-bold text-slate-600 mb-1.5 block group-hover:text-brand-500 transition-colors">Data de Entrega</label>
                                        <div className="flex items-center gap-2 text-slate-300 text-sm bg-slate-900 p-2 rounded border border-slate-800 hover:border-slate-600 transition-colors cursor-pointer">
                                            <Calendar size={14} />
                                            {task.due_date ? new Date(parseInt(task.due_date)).toLocaleDateString() : 'Sem data'}
                                        </div>
                                    </div>
                                    
                                    <div className="group">
                                        <label className="text-[10px] uppercase font-bold text-slate-600 mb-1.5 block group-hover:text-brand-500 transition-colors">Prioridade</label>
                                        <select 
                                            value={editedTask.priority?.priority || 'normal'}
                                            onChange={e => setEditedTask({...editedTask, priority: {priority: e.target.value, color: ''}})}
                                            className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-sm text-slate-300 outline-none focus:border-brand-500"
                                        >
                                            <option value="urgent">🔴 Urgente</option>
                                            <option value="high">🟡 Alta</option>
                                            <option value="normal">🔵 Normal</option>
                                            <option value="low">⚪ Baixa</option>
                                        </select>
                                    </div>

                                    <div className="group">
                                        <label className="text-[10px] uppercase font-bold text-slate-600 mb-1.5 block group-hover:text-brand-500 transition-colors">Responsáveis</label>
                                        <div className="flex flex-wrap gap-2">
                                            {task.assignees.length > 0 ? task.assignees.map(u => (
                                                <div key={u.id} className="flex items-center gap-2 bg-slate-900 px-2 py-1.5 rounded border border-slate-800">
                                                    <div className="w-5 h-5 rounded-full bg-brand-600 text-[9px] flex items-center justify-center text-white font-bold">{u.username.substring(0,2)}</div>
                                                    <span className="text-xs text-slate-300">{u.username}</span>
                                                </div>
                                            )) : <span className="text-xs text-slate-600 italic">Não atribuído</span>}
                                        </div>
                                    </div>

                                    {/* Custom Fields Renderer */}
                                    {task.custom_fields && task.custom_fields.length > 0 && (
                                        <div className="pt-4 border-t border-slate-800 space-y-4">
                                            <label className="text-[10px] uppercase font-bold text-slate-500 block">Campos Personalizados</label>
                                            {task.custom_fields.map((cf, i) => (
                                                <div key={i} className="group">
                                                    <label className="text-[10px] font-bold text-slate-600 mb-1 block truncate" title={cf.name}>{cf.name}</label>
                                                    <div className="text-sm text-slate-300 bg-slate-900/50 p-2 rounded border border-slate-800/50 min-h-[30px] flex items-center">
                                                        {typeof cf.value === 'object' ? JSON.stringify(cf.value) : (cf.value || '-')}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

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

  // View States
  const [viewType, setViewType] = useState<ViewType>('list');
  const [groupBy, setGroupBy] = useState<GroupBy>('status');
  const [searchQuery, setSearchQuery] = useState('');

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

  // --- VIEW LOGIC ---

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [tasks, searchQuery]);

  const groupedTasks = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    const sortOrder: string[] = [];

    filteredTasks.forEach(task => {
        let key = 'Outros';
        let color = '#888';
        let order = 999;

        if (groupBy === 'status') {
            key = task.status.status.toUpperCase();
            color = task.status.color;
            order = task.status.orderindex || 999;
        } else if (groupBy === 'priority') {
            key = (task.priority?.priority || 'none').toUpperCase();
            order = { 'URGENT': 1, 'HIGH': 2, 'NORMAL': 3, 'LOW': 4, 'NONE': 5 }[key] || 999;
        }

        if (!groups[key]) {
            groups[key] = [];
            sortOrder.push(key);
        }
        groups[key].push(task);
    });

    // Custom Sort logic based on grouping
    if (groupBy === 'status') {
         // Sort keys by tasks' internal status order index usually, but here we just alphabetize or keep insertion order roughly
         // A real implementation would dedupe statuses and sort by orderIndex
    } else if (groupBy === 'priority') {
         const pOrder: Record<string, number> = { 'URGENT': 1, 'HIGH': 2, 'NORMAL': 3, 'LOW': 4, 'NONE': 5 };
         sortOrder.sort((a, b) => pOrder[a] - pOrder[b]);
    }

    return { groups, sortOrder };
  }, [filteredTasks, groupBy]);

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
          v3.2 • ClickUp UX
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-slate-950">
        
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

        {/* STEP 3: DASHBOARD - RECREATED CLICKUP INTERFACE */}
        {currentStep === 3 && (
            <div className="flex-1 overflow-hidden flex flex-col">
              
              {/* Top Action Bar (ClickUp Style) */}
              <div className="h-14 border-b border-slate-800 bg-slate-900 flex items-center justify-between px-6 shrink-0">
                  <div className="flex items-center gap-4">
                     {/* View Switcher Tabs */}
                     <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                        <button 
                            onClick={() => setViewType('list')}
                            className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium transition-all ${viewType === 'list' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <LayoutList size={14} /> Lista
                        </button>
                        <button 
                            onClick={() => setViewType('board')}
                            className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium transition-all ${viewType === 'board' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <Kanban size={14} /> Quadro
                        </button>
                     </div>

                     <div className="h-6 w-px bg-slate-800"></div>

                     {/* Filters / Search */}
                     <div className="relative">
                        <input 
                            type="text" 
                            placeholder="Buscar tarefas..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-transparent border-none focus:ring-0 text-sm text-white placeholder-slate-600 w-48"
                        />
                     </div>
                  </div>

                  <div className="flex items-center gap-2">
                       <button onClick={downloadCSV} className="text-slate-400 hover:text-white px-3 py-1.5 rounded-md text-xs font-medium border border-slate-800 hover:bg-slate-800 transition-colors flex items-center gap-2">
                           <Download size={14} /> Exportar
                       </button>
                       <button onClick={() => setScriptModalOpen(true)} className="text-brand-400 hover:text-brand-300 px-3 py-1.5 rounded-md text-xs font-medium border border-brand-900/50 hover:bg-brand-900/20 transition-colors flex items-center gap-2">
                           <Server size={14} /> Scripts
                       </button>
                  </div>
              </div>

              {/* View Control Bar */}
              <div className="h-10 border-b border-slate-800 bg-slate-900/50 flex items-center px-6 gap-4 shrink-0">
                   <div className="flex items-center gap-1 text-xs font-medium text-slate-500">
                       <Filter size={12} />
                       <span>Agrupar por:</span>
                       <select 
                           value={groupBy}
                           onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                           className="bg-transparent border-none outline-none text-slate-300 font-bold cursor-pointer hover:text-white"
                       >
                           <option value="status">Status</option>
                           <option value="priority">Prioridade</option>
                           <option value="none">Nenhum</option>
                       </select>
                   </div>
              </div>

              {/* MAIN VIEW AREA */}
              <div className="flex-1 bg-slate-950 overflow-auto p-6 relative">
                  
                  {/* LIST VIEW */}
                  {viewType === 'list' && (
                      <div className="w-full space-y-8 pb-20">
                          {groupedTasks.sortOrder.map((groupName) => (
                              <div key={groupName} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                  {/* Group Header */}
                                  <div className="flex items-center gap-3 mb-2 sticky top-0 bg-slate-950/95 backdrop-blur py-2 z-10 border-b border-dashed border-slate-800">
                                      <ChevronDown size={14} className="text-slate-500" />
                                      <span 
                                        className="text-sm font-bold uppercase tracking-wider px-2 py-0.5 rounded text-white"
                                        style={{ backgroundColor: groupedTasks.groups[groupName][0]?.status.color || '#334155' }}
                                      >
                                          {groupName}
                                      </span>
                                      <span className="text-xs text-slate-500 font-mono">{groupedTasks.groups[groupName].length}</span>
                                  </div>
                                  
                                  {/* Tasks */}
                                  <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
                                      {groupedTasks.groups[groupName].map((task) => (
                                          <div 
                                            key={task.id} 
                                            onClick={() => setSelectedTask(task)}
                                            className="group flex items-center gap-4 p-3 border-b border-slate-800 last:border-0 hover:bg-slate-800/80 cursor-pointer transition-colors"
                                          >
                                              <div className="w-4 flex justify-center"><Square size={14} className="text-slate-600 group-hover:text-brand-500" /></div>
                                              
                                              <div className="flex-1 min-w-0">
                                                  <div className="flex items-center gap-2">
                                                      <span className="text-sm text-slate-200 truncate font-medium">{task.name}</span>
                                                      {task.priority && <PriorityFlag priority={task.priority.priority} />}
                                                  </div>
                                                  <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                                                      <span className="font-mono opacity-50">#{task.id}</span>
                                                      <span className="w-px h-2 bg-slate-700"></span>
                                                      <span className="truncate max-w-[200px]">{task.context_list || task.list.name}</span>
                                                  </div>
                                              </div>

                                              {/* Columns */}
                                              <div className="hidden md:flex items-center gap-6 w-1/3 justify-end pr-4">
                                                  {/* Assignees */}
                                                  <div className="w-20 flex justify-end">
                                                      {task.assignees.length > 0 ? (
                                                          <div className="flex -space-x-2">
                                                              {task.assignees.slice(0, 3).map(u => (
                                                                  <div key={u.id} className="w-6 h-6 rounded-full bg-slate-700 border border-slate-900 flex items-center justify-center text-[8px] text-white uppercase">{u.username.substring(0,2)}</div>
                                                              ))}
                                                          </div>
                                                      ) : <span className="text-slate-700 text-lg leading-none">-</span>}
                                                  </div>
                                                  
                                                  {/* Date */}
                                                  <div className="w-24 text-right">
                                                      {task.due_date ? (
                                                          <span className="text-xs text-slate-400">{new Date(parseInt(task.due_date)).toLocaleDateString()}</span>
                                                      ) : <span className="text-slate-700">-</span>}
                                                  </div>
                                                  
                                                  {/* Status Pill */}
                                                  <div className="w-24 flex justify-end">
                                                      <StatusBadge status={task.status.status} color={task.status.color} />
                                                  </div>
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}

                  {/* BOARD VIEW */}
                  {viewType === 'board' && (
                      <div className="flex gap-4 h-full overflow-x-auto pb-4 custom-scrollbar">
                          {groupedTasks.sortOrder.map((groupName) => (
                              <div key={groupName} className="min-w-[280px] w-[280px] flex flex-col h-full rounded-xl bg-slate-900/30 border border-slate-800/50">
                                  {/* Column Header */}
                                  <div className="p-3 flex items-center justify-between border-b border-slate-800/50 sticky top-0 bg-slate-950 z-10 rounded-t-xl">
                                      <div className="flex items-center gap-2">
                                          <span 
                                            className="w-2 h-2 rounded-full"
                                            style={{ backgroundColor: groupedTasks.groups[groupName][0]?.status.color || '#334155' }}
                                          ></span>
                                          <span className="text-xs font-bold uppercase text-slate-300 truncate max-w-[150px]">{groupName}</span>
                                          <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 rounded">{groupedTasks.groups[groupName].length}</span>
                                      </div>
                                      <div className="flex gap-1">
                                          <button className="text-slate-600 hover:text-white"><Plus size={14} /></button>
                                          <button className="text-slate-600 hover:text-white"><MoreHorizontal size={14} /></button>
                                      </div>
                                  </div>

                                  {/* Cards Container */}
                                  <div className="p-2 flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                                      {groupedTasks.groups[groupName].map(task => (
                                          <TaskCard key={task.id} task={task} onClick={() => setSelectedTask(task)} />
                                      ))}
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}

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