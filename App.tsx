import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowRight, ArrowLeft, Database, Download,
  FileJson, Layers, CheckCircle, RefreshCw,
  Settings, Key, AlertCircle, FileSpreadsheet, X,
  Globe, Clock, Play, Square, Save, Calendar,
  ShieldCheck, Server, Search, Filter, Plus, LayoutGrid, Link
} from 'lucide-react';

// Services & Utils
import { ClickUpService } from './services/clickupService';
import { SheetService } from './services/sheetService';
import { aggregateTasks } from './utils/taskAggregator';
import { generateExtractionScript, generateBridgeScript } from './utils/appsScriptTemplate';

// Types
import { HierarchyState, Task, Webhook, ViewType, HierarchicalData } from './types';

// Components
import TaskDetailModal from './components/TaskDetailModal';
import KanbanBoard from './components/KanbanBoard';
import TableView from './components/TableView';
import ListView from './components/ListView';
import WebhookManagerModal from './components/WebhookManagerModal';
import CreateTaskModal from './components/CreateTaskModal';
import HomePage from './components/HomePage';
import FilterBar from './components/FilterBar';
import ActionModal from './components/ActionModal';
import ViewSwitcher from './components/ViewSwitcher';
import { 
    HomeIcon, KanbanIcon, ListIcon, TableIcon, 
    RefreshIcon, PlusIcon, WebhookIcon, FolderIcon, 
    ListIcon as ClickUpListIcon, DotsVerticalIcon,
    ChevronDownIcon, EditIcon, TrashIcon
} from './components/Icons';

const StepIndicator = ({ current, step, label }: { current: number, step: number, label: string }) => (
  <div className={`flex items-center space-x-2 ${current === step ? 'text-brand-500 font-bold' : current > step ? 'text-emerald-500' : 'text-slate-500'}`}>
    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
      current === step ? 'border-brand-500 bg-brand-500/10' : 
      current > step ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 bg-slate-800'
    }`}>
      {current > step ? <CheckCircle size={16} /> : <span>{step}</span>}
    </div>
    <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">{label}</span>
  </div>
);

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [apiKey, setApiKey] = useState('');
  const [clickupService, setClickupService] = useState<ClickUpService | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Connection & Data States
  const [dataSource, setDataSource] = useState<'clickup' | 'sheets' | 'both'>('clickup');
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [rawTasks, setRawTasks] = useState<Task[]>([]);
  const [hierarchy, setHierarchy] = useState<HierarchyState>({
    teams: [], selectedTeam: null,
    spaces: [], selectedSpace: null,
    folders: [], selectedFolder: null,
    lists: [], selectedList: null,
    extractionMode: null,
    dataSource: 'clickup_api'
  });

  // UI States
  const [viewMode, setViewMode] = useState<ViewType>('home');
  const [selectedList, setSelectedList] = useState<{ webhookId: string; webhookUrl: string; workspace: string; folder: string; list: string; } | null>(null);
  const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({});
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [webhookModalOpen, setWebhookModalOpen] = useState(false);
  const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false);
  const [scriptModalOpen, setScriptModalOpen] = useState(false);
  const [scriptType, setScriptType] = useState<'extraction' | 'bridge'>('extraction');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('');
  const [modalAction, setModalAction] = useState<{
    type: 'CREATE' | 'RENAME' | 'DELETE';
    structure: 'workspace' | 'folder' | 'list';
    context?: any;
  } | null>(null);

  // Load webhooks from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('clickdown_webhooks');
    if (saved) {
      try {
        setWebhooks(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load webhooks", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('clickdown_webhooks', JSON.stringify(webhooks));
  }, [webhooks]);

  // Hierarchy Building
  const hierarchyData: HierarchicalData = useMemo(() => {
    const root: HierarchicalData = {};
    webhooks.forEach(wh => { root[wh.id] = { id: wh.id, name: wh.name, folders: {} }; });
    
    rawTasks.forEach(task => {
        const whId = task.webhookId;
        if (!whId || !root[whId]) return;
        
        const space = task.context_space || 'Sem Espaço';
        const folder = task.context_folder || 'Sem Pasta';
        const listName = task.context_list || 'Sem Lista';
        
        if (!root[whId].folders[space]) {
            root[whId].folders[space] = { id: space, name: space, lists: {} };
        }
        
        const workspace = root[whId].folders[space];
        if (!workspace.lists[folder]) {
            workspace.lists[folder] = { id: folder, name: folder, tasks: [] };
        }
        
        const currentList = workspace.lists[folder];
        // This is a bit different from Piloto (Workspace->Folder->List)
        // We'll adapt to ClickUp's Space->Folder->List structure
        // If it's a sheet, we use context_space/folder/list
        currentList.tasks.push(task);
    });
    return root;
  }, [rawTasks, webhooks]);

  // Aggregated Data & Filtering
  const filteredTasks = useMemo(() => {
    let base = rawTasks;
    
    if (viewMode !== 'home' && selectedList) {
        base = rawTasks.filter(t => 
            t.webhookId === selectedList.webhookId && 
            t.context_space === selectedList.workspace && 
            t.context_folder === selectedList.folder && 
            t.context_list === selectedList.list
        );
    }
    
    return base.filter(t => {
        const matchesSearch = searchQuery ? (t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.id.toLowerCase().includes(searchQuery.toLowerCase())) : true;
        const matchesPriority = priorityFilter ? (t.priority?.priority === priorityFilter) : true;
        const matchesAssignee = assigneeFilter ? (t.assignees.some(u => u.username === assigneeFilter)) : true;
        return matchesSearch && matchesPriority && matchesAssignee;
    });
  }, [rawTasks, searchQuery, priorityFilter, assigneeFilter, viewMode, selectedList]);

  const { rootTasks, allTasksMap } = useMemo(() => {
    return aggregateTasks(filteredTasks);
  }, [filteredTasks]);

  const { allAssignees, allPriorities, allStatuses } = useMemo(() => {
    const assignees = new Set<string>();
    const priorities = new Set<string>();
    const statuses = new Set<string>();
    rawTasks.forEach(task => {
        task.assignees.forEach(u => assignees.add(u.username));
        if (task.priority) priorities.add(task.priority.priority);
        if (task.status) statuses.add(task.status.status);
    });
    return {
        allAssignees: Array.from(assignees).sort(),
        allPriorities: Array.from(priorities),
        allStatuses: Array.from(statuses)
    };
  }, [rawTasks]);

  // -- Handlers --

  const handleApiKeySubmit = async () => {
    if (!apiKey.startsWith('pk_')) {
      setError('A chave API deve começar com "pk_"');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const srv = new ClickUpService(apiKey);
      setClickupService(srv);
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
    if (webhooks.length === 0) {
      setError('Adicione pelo menos um webhook (Planilha) para conectar.');
      setWebhookModalOpen(true);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      setLoadingStatus('Conectando às planilhas...');
      const allTasks: Task[] = [];
      
      for (const wh of webhooks) {
          setLoadingStatus(`Lendo: ${wh.name}...`);
          try {
              const tasksFromSheet = await SheetService.fetchData(wh);
              allTasks.push(...tasksFromSheet);
          } catch (e) {
              console.error(`Failed to fetch from ${wh.name}`, e);
          }
      }

      setRawTasks(allTasks);
      setDataSource('sheets');
      setCurrentStep(3);
    } catch (e: any) {
      setError('Erro ao conectar com as Planilhas. Verifique os webhooks.');
    } finally {
      setLoading(false);
      setLoadingStatus('');
    }
  };

  const startExtraction = async () => {
    if (!clickupService) return;
    setLoading(true);
    setRawTasks([]);

    try {
      let fetchedTasks: Task[] = [];
      if (hierarchy.extractionMode === 'workspace' && hierarchy.selectedTeam) {
        fetchedTasks = await clickupService.getAllWorkspaceTasks(hierarchy.selectedTeam, (p) => setLoadingStatus(p.status));
      } else if (hierarchy.selectedList) {
        fetchedTasks = await clickupService.getTasks(hierarchy.selectedList, (p) => setLoadingStatus(p.status));
      }
      setRawTasks(fetchedTasks);
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
    setRawTasks(prev => {
        const newTasks = [...prev];
        const index = newTasks.findIndex(t => t.id === originalTask.id);
        if (index !== -1) {
            newTasks[index] = { 
                ...newTasks[index], 
                ...updates,
                priority: updates.priority ? { priority: updates.priority, color: '' } : newTasks[index].priority,
                status: updates.status ? { ...newTasks[index].status, status: updates.status } : newTasks[index].status,
                recurrence: updates.recurrence !== undefined ? updates.recurrence : newTasks[index].recurrence
            };
        }
        return newTasks;
    });

    // Push to Sheets if source is a webhook
    if (originalTask.webhookUrl) {
      try {
        await SheetService.updateTask(originalTask, updates);
      } catch (e) {
        console.error("Sync failed", e);
        alert("Falha ao salvar no Google Sheets. Verifique a conexão.");
      }
  };

  const handleTaskCreate = async (taskData: Partial<Task>) => {
      if (taskData.webhookUrl) {
          try {
              await SheetService.createTask(taskData.webhookUrl, taskData);
              setRawTasks(prev => [{ ...taskData, id: 'new_' + Date.now() } as Task, ...prev]);
          } catch (e) {
              console.error("Creation failed", e);
              alert("Falha ao criar tarefa no Sheets.");
          }
      }
  };

  const handleGoToTask = (taskId: string) => {
      const task = allTasksMap.get(taskId);
      if (task) {
          setSelectedTask(task);
      }
  };

  const downloadCSV = () => {
    if (rawTasks.length === 0) return;
    const customFieldNames = new Set<string>();
    rawTasks.forEach(t => t.custom_fields?.forEach(f => customFieldNames.add(f.name)));
    const sortedCustomFields = Array.from(customFieldNames).sort();

    const headers = [
      'ID', 'Nome', 'URL', 'Status', 'Prioridade', 'Descrição', 'Criado em',
      'Atualizado em', 'Responsáveis', 'Tags', 'Hierarquia', 'Fonte', ...sortedCustomFields
    ];

    const escape = (val: any) => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
        return str;
    };

    const rows = rawTasks.map(t => {
      const hierarchyStr = t.context_list ? `${t.context_space} > ${t.context_folder} > ${t.context_list}` : 'N/A';
      const base = [
        t.id, t.name, t.url || '', t.status.status, t.priority?.priority || '', t.description || '',
        t.date_created ? new Date(parseInt(t.date_created)).toLocaleDateString() : '',
        t.date_updated ? new Date(parseInt(t.date_updated)).toLocaleDateString() : '',
        t.assignees.map(u => u.username).join(', '),
        t.tags.map(tag => tag.name).join(', '),
        hierarchyStr,
        t.webhookName || 'ClickUp API'
      ];
      const customs = sortedCustomFields.map(cf => {
        const field = t.custom_fields?.find(f => f.name === cf);
        return field?.value || '';
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

  const handleTeamChange = async (teamId: string) => {
    setHierarchy(prev => ({ ...prev, selectedTeam: teamId, spaces: [], lists: [], selectedSpace: null, selectedList: null }));
    if (!clickupService) return;
    const { spaces } = await clickupService.getSpaces(teamId);
    setHierarchy(prev => ({ ...prev, spaces }));
  };

  const handleSpaceChange = async (spaceId: string) => {
    setHierarchy(prev => ({ ...prev, selectedSpace: spaceId, lists: [], selectedList: null }));
    if (!clickupService) return;
    setLoading(true);
    try {
      const { folders } = await clickupService.getFolders(spaceId);
      const { lists: folderless } = await clickupService.getFolderlessLists(spaceId);
      let allLists = [...folderless];
      for (const folder of folders) {
        const { lists } = await clickupService.getLists(folder.id);
        allLists = allLists.concat(lists.map(l => ({ ...l, name: `${folder.name} > ${l.name}` })));
      }
      setHierarchy(prev => ({ ...prev, folders, lists: allLists }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const generatedCode = scriptType === 'extraction'
    ? generateExtractionScript(apiKey, hierarchy.selectedList, hierarchy.selectedTeam)
    : generateBridgeScript();

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 font-sans selection:bg-brand-500/30">
      
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          allTasksMap={allTasksMap}
          onClose={() => setSelectedTask(null)}
          onSave={handleTaskUpdate}
          onGoToTask={handleGoToTask}
        />
      )}

      {webhookModalOpen && (
          <WebhookManagerModal 
            webhooks={webhooks} 
            onClose={() => setWebhookModalOpen(false)} 
            onUpdate={setWebhooks} 
          />
      )}

      {createTaskModalOpen && (
          <CreateTaskModal
            onClose={() => setCreateTaskModalOpen(false)}
            onCreate={handleTaskCreate}
            allStatuses={['A Fazer', 'Em Andamento', 'Em Revisão', 'Bloqueado', 'Concluído']}
            allPriorities={['Urgente', 'Alta', 'Média', 'Baixa']}
            allAssignees={[]}
            listContext={webhooks.length > 0 ? {
                context_space: 'Manual',
                context_folder: 'Planilha',
                context_list: webhooks[0].name,
                webhookId: webhooks[0].id,
                webhookUrl: webhooks[0].url,
                webhookName: webhooks[0].name
            } : null}
          />
      )}

      {/* Sidebar */}
      <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col hidden lg:flex">
        <div className="p-8 border-b border-slate-800 flex items-center space-x-4">
          <div className="w-10 h-10 bg-brand-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-brand-500/40 transform -rotate-3 hover:rotate-0 transition-transform cursor-pointer">
            <Database className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-white">ClickDown</h1>
            <p className="text-[10px] text-brand-400 font-bold uppercase tracking-widest">Master Control</p>
          </div>
        </div>

        <div className="p-8 space-y-12 flex-1 overflow-y-auto custom-scrollbar">
          <div className="space-y-6">
            <StepIndicator current={currentStep} step={1} label="Conexão" />
            <StepIndicator current={currentStep} step={2} label="Configuração" />
            <StepIndicator current={currentStep} step={3} label="Dashboard" />
          </div>

          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in duration-500 pb-20">
              <button 
                onClick={() => setViewMode('home')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold text-xs ${viewMode === 'home' ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20 forced-shadow' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
              >
                <HomeIcon size={18} />
                <span>Página Inicial</span>
              </button>

              <div className="pt-4 space-y-2">
                <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] px-4 mb-2">Hierarquia de Dados</h3>
                {webhooks.map(wh => (
                    <div key={wh.id} className="space-y-1">
                        <div 
                            onClick={() => setExpanded(prev => ({ ...prev, [wh.id]: !prev[wh.id] }))}
                            className="flex items-center gap-3 px-4 py-2 hover:bg-slate-800 rounded-xl cursor-pointer group"
                        >
                            <WebhookIcon size={14} className="text-slate-500 group-hover:text-emerald-500 transition-colors" />
                            <span className="text-[11px] font-bold text-slate-400 truncate">{wh.name}</span>
                            <ChevronDownIcon size={14} className={`ml-auto text-slate-600 transition-transform ${expanded[wh.id] ? 'rotate-180' : ''}`} />
                        </div>

                        {expanded[wh.id] && hierarchyData[wh.id] && Object.values(hierarchyData[wh.id].folders).map(space => (
                            <div key={space.id} className="ml-4 space-y-1 border-l border-slate-800 pb-1">
                                <div 
                                    onClick={() => setExpanded(prev => ({ ...prev, [`${wh.id}-${space.id}`]: !prev[`${wh.id}-${space.id}`] }))}
                                    className="flex items-center gap-3 px-4 py-1.5 hover:bg-slate-800 rounded-lg cursor-pointer group"
                                >
                                    <FolderIcon size={12} className="text-slate-600 group-hover:text-brand-500 transition-colors" />
                                    <span className="text-[11px] font-bold text-slate-500 truncate">{space.name}</span>
                                    <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={(e) => { e.stopPropagation(); setModalAction({ type: 'RENAME', structure: 'workspace', context: { name: space.name, webhookId: wh.id, webhookUrl: wh.url } }); }} className="p-1 text-slate-600 hover:text-white"><EditIcon size={10} /></button>
                                        <button onClick={(e) => { e.stopPropagation(); setModalAction({ type: 'DELETE', structure: 'workspace', context: { name: space.name, webhookId: wh.id, webhookUrl: wh.url } }); }} className="p-1 text-slate-600 hover:text-red-500"><TrashIcon size={10} /></button>
                                    </div>
                                </div>

                                {expanded[`${wh.id}-${space.id}`] && Object.values(space.lists).map(folder => (
                                    <div key={folder.id} className="ml-6 space-y-1">
                                        <div 
                                            onClick={() => {
                                                setViewMode('list');
                                                setSelectedList({
                                                    webhookId: wh.id,
                                                    webhookUrl: wh.url,
                                                    workspace: space.name,
                                                    folder: folder.name,
                                                    list: folder.name // In Sheets we often use folder as list
                                                });
                                            }}
                                            className={`flex items-center gap-3 px-4 py-1.5 rounded-lg cursor-pointer group transition-all ${selectedList?.workspace === space.name && selectedList?.folder === folder.name ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/50 text-slate-500'}`}
                                        >
                                            <ClickUpListIcon size={10} className={selectedList?.workspace === space.name && selectedList?.folder === folder.name ? 'text-brand-400' : 'text-slate-700'} />
                                            <span className="text-[11px] font-bold truncate">{folder.name}</span>
                                            <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={(e) => { e.stopPropagation(); setModalAction({ type: 'RENAME', structure: 'folder', context: { name: folder.name, workspace: space.name, webhookId: wh.id, webhookUrl: wh.url } }); }} className="p-1 text-slate-600 hover:text-white"><EditIcon size={10} /></button>
                                                <button onClick={(e) => { e.stopPropagation(); setModalAction({ type: 'DELETE', structure: 'folder', context: { name: folder.name, workspace: space.name, webhookId: wh.id, webhookUrl: wh.url } }); }} className="p-1 text-slate-600 hover:text-red-500"><TrashIcon size={10} /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-800 text-[10px] text-slate-600 font-bold tracking-[0.2em] text-center">
          V4.0 • FULL MERGE EDITION
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-slate-900/50">
        
        {/* Step 3 Top Bar (Sidebar Toggle or Context) */}
        {currentStep === 3 && (
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <button onClick={() => setViewMode('home')} className={`p-2 rounded-xl transition-all ${viewMode === 'home' ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' : 'text-slate-500 hover:bg-slate-800'}`}>
                        <HomeIcon size={20} />
                    </button>
                    <div className="h-6 w-px bg-slate-800"></div>
                    <div>
                        <h4 className="text-sm font-bold text-white capitalize">{viewMode === 'home' ? 'Página Inicial' : selectedList?.list || 'Visualização'}</h4>
                        {viewMode !== 'home' && selectedList && <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{selectedList.workspace} / {selectedList.folder}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={downloadCSV} className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all" title="Exportar CSV">
                        <Download size={18} />
                    </button>
                    <button onClick={() => setCreateTaskModalOpen(true)} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-black px-4 py-2 rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-brand-900/30">
                        <Plus size={16} /> Nova Tarefa
                    </button>
                    <div className="h-6 w-px bg-slate-800 mx-1"></div>
                    <ViewSwitcher currentView={viewMode} onViewChange={setViewMode} />
                    <button onClick={() => setScriptModalOpen(true)} className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all" title="Scripts">
                        <FileJson size={18} />
                    </button>
                </div>
            </div>
        )}

        {/* Filter Bar */}
        {currentStep === 3 && (
            <FilterBar 
                onSearch={setSearchQuery}
                onPriorityChange={setPriorityFilter}
                onAssigneeChange={setAssigneeFilter}
                allAssignees={allAssignees}
                allPriorities={allPriorities}
            />
        )}

        {/* Step 1: CONNECTION TYPE */}
        {currentStep === 1 && (
          <div className="flex-1 overflow-auto p-12 flex flex-col items-center justify-center animate-in fade-in duration-500">
            <h2 className="text-5xl font-black mb-4 text-center tracking-tighter">Conecte seu fluxo.</h2>
            <p className="text-slate-400 mb-16 text-center max-w-xl text-lg leading-relaxed">Sincronize o ClickUp diretamente ou transforme o Google Sheets no motor do seu gerenciamento.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">

              {/* Option A: ClickUp Direct */}
              <div className="bg-slate-900 border border-slate-800 hover:border-brand-500 transition-all rounded-3xl p-10 cursor-pointer group relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform rotate-12">
                  <Globe size={240} />
                </div>
                <div className="w-16 h-16 bg-brand-500/20 rounded-2xl flex items-center justify-center mb-8 text-brand-400 group-hover:scale-110 transition-transform">
                  <Key size={32} />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-white">API ClickUp</h3>
                <p className="text-slate-400 text-sm mb-8 leading-relaxed">Conexão nativa em tempo real. Ideal para extrações rápidas, auditorias e gestão multiplataforma.</p>

                <div className="space-y-4 border-t border-slate-800/50 pt-8">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Token de Acesso (Key)</label>
                  <div className="relative">
                    <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="pk_..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-5 py-3 text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all placeholder-slate-800"
                    />
                  </div>
                  <button
                    onClick={handleApiKeySubmit}
                    disabled={loading || !apiKey}
                    className="w-full bg-brand-600 hover:bg-brand-500 text-white font-black py-4 rounded-xl flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-brand-900/40 transition-all active:scale-95"
                  >
                    {loading ? <RefreshCw className="animate-spin" /> : 'ATIVAR CONEXÃO'}
                  </button>
                </div>
              </div>

              {/* Option B: Google Sheets DB */}
              <div className="bg-slate-900 border border-slate-800 hover:border-emerald-500 transition-all rounded-3xl p-10 cursor-pointer group relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform rotate-12">
                  <FileSpreadsheet size={240} />
                </div>
                <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-8 text-emerald-400 group-hover:scale-110 transition-transform">
                  <Database size={32} />
                </div>
                <h3 className="text-2xl font-bold mb-3 text-white flex items-center gap-3">
                    Bases Locais
                    <span className="text-[10px] bg-emerald-500 text-white px-3 py-1 rounded-full uppercase tracking-widest">Hub</span>
                </h3>
                <p className="text-slate-400 text-sm mb-8 leading-relaxed">Utilize o Google Sheets como backend. Suporte a múltiplas planilhas simultâneas e edição bidirecional.</p>

                <div className="space-y-4 border-t border-slate-800/50 pt-8">
                  <button 
                    onClick={() => setWebhookModalOpen(true)}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3 rounded-xl flex items-center justify-center gap-3 transition-all border border-slate-700 mb-3"
                  >
                    <Link size={18} className="text-brand-500" />
                    GERENCIAR CONEXÕES ({webhooks.length})
                  </button>
                  <button 
                    onClick={() => { setScriptType('bridge'); setScriptModalOpen(true); }}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3 rounded-xl flex items-center justify-center gap-3 transition-all border border-slate-700 mb-3"
                  >
                    <FileJson size={18} className="text-emerald-500" />
                    OBTER SCRIPT CONFIGURAÇÃO
                  </button>
                  <button
                    onClick={handleSheetsConnect}
                    disabled={loading || webhooks.length === 0}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-emerald-900/40 transition-all active:scale-95"
                  >
                    {loading ? <RefreshCw className="animate-spin" /> : 'CARREGAR DADOS'}
                  </button>
                </div>
              </div>

            </div>
            {error && (
              <div className="mt-12 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center text-red-400 text-sm animate-in zoom-in duration-300 font-medium">
                <AlertCircle size={20} className="mr-3" />
                {error}
                </div>
            )}
          </div>
        )}

        {/* STEP 2: SELECTION (ClickUp Only) */}
        {currentStep === 2 && dataSource === 'clickup' && (
          <div className="flex-1 overflow-auto p-12 animate-in slide-in-from-right-10 duration-500">
            <div className="max-w-3xl mx-auto mt-10">
              <h2 className="text-4xl font-black mb-3 tracking-tighter">Refine a Extração</h2>
              <p className="text-slate-400 mb-12 text-lg">Mapeie os espaços ou listas que deseja consolidar no seu dashboard.</p>

              <div className="space-y-8 bg-slate-900/50 p-10 rounded-4xl border border-slate-800 shadow-3xl">

                {/* Team Select */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 ml-1">Time (Workspace)</label>
                  <select
                    onChange={(e) => handleTeamChange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white appearance-none focus:ring-2 focus:ring-brand-500 outline-none transition-all font-bold"
                    value={hierarchy.selectedTeam || ''}
                  >
                    <option value="">Selecione um Workspace...</option>
                    {hierarchy.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>

                {hierarchy.selectedTeam && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 ml-1">Espaço</label>
                            <select
                                onChange={(e) => handleSpaceChange(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white appearance-none focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                                value={hierarchy.selectedSpace || ''}
                            >
                                <option value="">Selecione um Espaço...</option>
                                {hierarchy.spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 ml-1">Lista Específica</label>
                            <select
                                onChange={(e) => setHierarchy(h => ({ ...h, selectedList: e.target.value, extractionMode: 'list' }))}
                                disabled={!hierarchy.selectedSpace}
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white appearance-none focus:ring-2 focus:ring-brand-500 outline-none disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                value={hierarchy.selectedList || ''}
                            >
                                <option value="">{loading ? 'Carregando listas...' : 'Selecione uma Lista...'}</option>
                                {hierarchy.lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="relative py-4">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
                      <div className="relative flex justify-center"><span className="bg-[#0b1120] px-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Ou Extração Global</span></div>
                    </div>

                    <button
                      onClick={() => setHierarchy(h => ({ ...h, selectedList: null, extractionMode: 'workspace' }))}
                      className={`w-full group rounded-3xl p-6 flex items-center transition-all border-2 ${hierarchy.extractionMode === 'workspace' ? 'border-brand-500 bg-brand-500/10 shadow-2xl shadow-brand-900/20' : 'border-slate-800 hover:border-slate-600 bg-slate-950/50'}`}
                    >
                      <div className={`p-4 rounded-2xl mr-6 transition-all ${hierarchy.extractionMode === 'workspace' ? 'bg-brand-500 text-white' : 'bg-slate-800 text-slate-500 group-hover:text-slate-300'}`}>
                        <Layers size={24} />
                      </div>
                      <div className="flex-1 text-left">
                        <h4 className="font-bold text-lg text-white">Full Workspace Consolidado</h4>
                        <p className="text-xs text-slate-500 font-medium">Baixar todas as tarefas de absolutamente todos os espaços deste time.</p>
                      </div>
                      {hierarchy.extractionMode === 'workspace' && <CheckCircle className="text-brand-500" size={32} />}
                    </button>
                  </div>
                )}

                <div className="flex justify-between items-center pt-8 border-t border-slate-800/50">
                  <button onClick={() => setCurrentStep(1)} className="text-slate-500 hover:text-white flex items-center px-6 py-2 font-bold uppercase tracking-widest text-[10px] transition-colors">
                    <ArrowLeft size={16} className="mr-3" /> Alterar Conexão
                  </button>
                  <button
                    onClick={startExtraction}
                    disabled={(!hierarchy.selectedList && hierarchy.extractionMode !== 'workspace') || loading}
                    className="bg-brand-600 hover:bg-brand-500 text-white font-black py-4 px-12 rounded-2xl shadow-2xl shadow-brand-900/40 flex items-center disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                  >
                    {loading ? (
                      <span className="flex items-center">
                        <RefreshCw className="animate-spin mr-3" size={20} />
                        {loadingStatus || 'PROCESSANDO...'}
                      </span>
                    ) : (
                      <span className="flex items-center gap-3">
                        FINALIZAR SETUP <ArrowRight size={20} />
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
            {/* Dashboard Header */}
            <header className="p-8 border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-20">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 max-w-[1600px] mx-auto w-full">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-4 mb-2">
                             <h2 className="text-3xl font-black tracking-tighter text-white truncate">Dashboard</h2>
                             <div className="flex items-center gap-1.5 px-3 py-1 bg-brand-500/10 border border-brand-500/30 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
                                <span className="text-[10px] font-black uppercase text-brand-400 tracking-widest">{rootTasks.length} Casos</span>
                             </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="relative group max-w-lg flex-1">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-brand-400 transition-colors" size={18} />
                                <input 
                                    type="text" 
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Localizar tarefa, ID ou fonte..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-4 py-3 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-brand-500 transition-all font-medium"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex bg-slate-950 border border-slate-800 p-1.5 rounded-2xl mr-2">
                            {[
                                { id: 'list', icon: ListIcon },
                                { id: 'kanban', icon: LayoutGrid },
                                { id: 'table', icon: TableIcon }
                            ].map(v => (
                                <button
                                    key={v.id}
                                    onClick={() => setViewMode(v.id as any)}
                                    className={`p-2.5 rounded-xl transition-all ${viewMode === v.id ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-600 hover:text-slate-400'}`}
                                >
                                    <v.icon size={20} />
                                </button>
                            ))}
                        </div>
                        <button onClick={downloadCSV} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-5 py-3 rounded-2xl text-xs uppercase tracking-widest border border-slate-700 transition-all active:scale-95">
                            <Download size={18} /> Exportar
                        </button>
                        <button onClick={() => setCreateTaskModalOpen(true)} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-black px-6 py-3 rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-brand-900/40 transition-all active:scale-95">
                            <Plus size={18} /> Nova Tarefa
                        </button>
                        <button onClick={() => setScriptModalOpen(true)} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-5 py-3 rounded-2xl text-xs uppercase tracking-widest border border-slate-700 transition-all active:scale-95">
                            <FileJson size={18} /> Scripts
                        </button>
                    </div>
                </div>
            </header>

            {/* Dashboard Content */}
            <div className="flex-1 overflow-auto p-8 custom-scrollbar bg-slate-900/10">
                <div className="max-w-[1600px] mx-auto h-full">
                    {viewMode === 'home' && (
                        <HomePage 
                            tasks={rawTasks} 
                            onTaskClick={setSelectedTask} 
                            onUpdateTask={handleTaskUpdate}
                            allStatuses={allStatuses}
                            allPriorities={allPriorities}
                            onGoToParent={handleGoToTask}
                        />
                    )}
                    {viewMode === 'list' && (
                        <ListView 
                            tasks={rootTasks} 
                            onTaskClick={setSelectedTask} 
                            onGoToParent={handleGoToTask} 
                        />
                    )}
                    {viewMode === 'kanban' && (
                        <KanbanBoard 
                            tasks={rawTasks} 
                            onTaskClick={setSelectedTask} 
                            onGoToParent={handleGoToTask} 
                        />
                    )}
                    {viewMode === 'table' && (
                        <TableView 
                            tasks={rootTasks} 
                            onTaskClick={setSelectedTask} 
                            onUpdateTask={handleTaskUpdate}
                            allStatuses={allStatuses}
                            allPriorities={allPriorities}
                            onGoToParent={handleGoToTask}
                        />
                    )}
                </div>
            </div>
        )}

        {/* SCRIPT MODAL */}
        {scriptModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-slate-800 w-full max-w-5xl h-[90vh] rounded-4xl shadow-3xl flex flex-col overflow-hidden ring-1 ring-white/10">
              <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                <div>
                  <h3 className="text-2xl font-black text-white flex items-center gap-3">
                    <FileJson className="text-emerald-500" size={28} /> Setup de Automação
                  </h3>
                  <p className="text-sm text-slate-500 font-medium uppercase tracking-widest mt-1">Integre o Google Apps Script ao seu fluxo</p>
                </div>
                <button onClick={() => setScriptModalOpen(false)} className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all">
                  <X size={28} />
                </button>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                {/* Settings Sidebar */}
                <div className="w-full md:w-1/3 p-8 bg-slate-900/50 border-r border-slate-800 overflow-y-auto custom-scrollbar">

                  <div className="mb-8">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-4 block">Selecione o Mecanismo</label>

                    <div className="space-y-4">
                      <div
                        onClick={() => setScriptType('extraction')}
                        className={`p-5 rounded-3xl border-2 transition-all cursor-pointer ${scriptType === 'extraction' ? 'bg-brand-500/10 border-brand-500 shadow-xl shadow-brand-900/20' : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'}`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${scriptType === 'extraction' ? 'bg-brand-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                             <ShieldCheck size={18} />
                          </div>
                          <span className={`font-bold text-sm ${scriptType === 'extraction' ? 'text-white' : 'text-slate-400'}`}>1. Full Extract (One-way)</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed font-medium">
                          ClickUp → Sheets. Baixa volumes massivos de dados com segurança total.
                        </p>
                      </div>

                      <div
                        onClick={() => setScriptType('bridge')}
                        className={`p-5 rounded-3xl border-2 transition-all cursor-pointer ${scriptType === 'bridge' ? 'bg-emerald-500/10 border-emerald-500 shadow-xl shadow-emerald-900/20' : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'}`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${scriptType === 'bridge' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                             <Server size={18} />
                          </div>
                          <span className={`font-bold text-sm ${scriptType === 'bridge' ? 'text-white' : 'text-slate-400'}`}>2. Master Bridge (Live)</span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed font-medium">
                          App ↔ Sheets. Habilita edição em tempo real e sincronização bidirecional.
                        </p>
                      </div>
                    </div>
                    <pre className="p-6 text-xs font-mono text-slate-300 h-full overflow-auto custom-scrollbar">
                      <code>{generatedCode}</code>
                    </pre>
                  </div>

                  <h4 className="text-[10px] font-black uppercase text-slate-600 tracking-widest mb-6">Guia de Implementação</h4>
                  <div className="space-y-6">
                    {(scriptType === 'extraction' ? [
                        'Crie um arquivo Extracao.gs no Apps Script',
                        'Cole o código gerado à direita',
                        'Recarregue sua Planilha do Google',
                        'Configure o gatilho no menu ClickDown'
                    ] : [
                        'Crie um arquivo Bridge.gs no Apps Script',
                        'Cole o código e salve o projeto',
                        'Clique em Implantar > Nova Implantação',
                        'Tipo: App da Web | Acesso: Qualquer pessoa'
                    ]).map((step, i) => (
                        <div key={i} className="flex gap-4">
                            <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-400 flex-shrink-0">
                                {i + 1}
                            </div>
                            <p className="text-xs text-slate-300 font-medium leading-relaxed">{step}</p>
                        </div>
                    ))}
                  </div>

                </div>

                {/* Code Viewer */}
                <div className="flex-1 bg-slate-950 relative overflow-hidden group">
                  <div className="absolute top-6 right-8 z-10">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedCode);
                      }}
                      className="bg-brand-600 hover:bg-brand-500 text-white px-8 py-3 rounded-2xl shadow-2xl shadow-brand-900/40 text-xs font-black uppercase tracking-widest transition-all transform active:scale-95 group-hover:scale-105"
                    >
                      Copiar Código Fonte
                    </button>
                  </div>
                  <pre className="p-10 text-[11px] font-mono text-slate-400 h-full overflow-auto custom-scrollbar leading-relaxed">
                    <code className="block py-10">{generatedCode}</code>
                  </pre>
                  <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none"></div>
                </div>
              </div>
            </div>
          )}

      </main>
    </div>
  );
};

export default App;