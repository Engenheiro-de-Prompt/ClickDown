import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, ArrowLeft, Database, Download, 
  FileJson, Layers, CheckCircle, RefreshCw, 
  Settings, Key, AlertCircle, FileSpreadsheet, X 
} from 'lucide-react';
import { ClickUpService } from './services/clickupService';
import { generateAppsScript } from './utils/appsScriptTemplate';
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

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [apiKey, setApiKey] = useState('');
  const [service, setService] = useState<ClickUpService | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const [hierarchy, setHierarchy] = useState<HierarchyState>({
    teams: [], selectedTeam: null,
    spaces: [], selectedSpace: null,
    folders: [], selectedFolder: null,
    lists: [], selectedList: null,
    extractionMode: null
  });

  const [tasks, setTasks] = useState<Task[]>([]);
  const [scriptModalOpen, setScriptModalOpen] = useState(false);

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
      setHierarchy(prev => ({ ...prev, teams }));
      setCurrentStep(2);
    } catch (e: any) {
      setError(e.message);
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

  const downloadCSV = () => {
    if (tasks.length === 0) return;

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

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 font-sans selection:bg-brand-500/30">
      
      {/* Sidebar / Navigation */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Database className="text-white" size={18} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">ClickDown</h1>
        </div>
        
        <div className="p-6 space-y-8 flex-1">
          <div className="space-y-4">
            <StepIndicator current={currentStep} step={1} label="Conexão API" />
            <StepIndicator current={currentStep} step={2} label="Seleção" />
            <StepIndicator current={currentStep} step={3} label="Dashboard" />
          </div>

          {currentStep === 3 && (
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 mt-8">
              <h3 className="text-xs font-uppercase text-slate-400 font-bold mb-2">RESUMO</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Tarefas:</span>
                  <span className="text-white font-mono">{tasks.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Completas:</span>
                  <span className="text-emerald-400 font-mono">{tasks.filter(t => t.status.type === 'closed').length}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-800 text-xs text-slate-600 text-center">
          v2.0 • ClickUp to Sheets
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* Header (Mobile Only mostly) */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-md md:hidden">
          <span className="font-bold">ClickDown</span>
          <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400">Step {currentStep}/3</span>
        </header>

        {/* Dynamic Content Area */}
        <div className="flex-1 overflow-auto p-6 md:p-10 relative">
          
          {/* STEP 1: API KEY */}
          {currentStep === 1 && (
            <div className="max-w-md mx-auto mt-20 fade-in">
              <div className="text-center mb-10">
                <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl border border-slate-700">
                  <Key className="text-brand-500" size={32} />
                </div>
                <h2 className="text-3xl font-bold mb-2">Conecte seu ClickUp</h2>
                <p className="text-slate-400">Insira sua chave de API pessoal (pk_...) para começar a extrair e gerenciar seus dados.</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl">
                <label className="block text-sm font-medium text-slate-400 mb-2">API Token</label>
                <input 
                  type="password" 
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="pk_12345_..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all placeholder-slate-700"
                />
                {error && (
                  <div className="mt-4 p-3 bg-red-900/20 border border-red-900/50 rounded flex items-center text-red-400 text-sm">
                    <AlertCircle size={16} className="mr-2" />
                    {error}
                  </div>
                )}
                <button 
                  onClick={handleApiKeySubmit}
                  disabled={loading}
                  className="w-full mt-6 bg-brand-600 hover:bg-brand-500 text-white font-medium py-3 rounded-lg transition-all flex items-center justify-center shadow-lg shadow-brand-900/50 disabled:opacity-50"
                >
                  {loading ? <RefreshCw className="animate-spin mr-2" size={18} /> : null}
                  {loading ? 'Conectando...' : 'Autenticar'}
                </button>
              </div>
              
              <div className="mt-8 text-center">
                <a href="#" className="text-xs text-slate-500 hover:text-brand-400 border-b border-transparent hover:border-brand-400 transition-colors">
                  Onde encontro minha API Key?
                </a>
              </div>
            </div>
          )}

          {/* STEP 2: SELECTION */}
          {currentStep === 2 && (
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
          )}

          {/* STEP 3: DASHBOARD */}
          {currentStep === 3 && (
            <div className="h-full flex flex-col">
              {/* Dashboard Toolbar */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold">Gerenciador de Tarefas</h2>
                  <p className="text-sm text-slate-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Sincronizado com ClickUp
                  </p>
                </div>
                <div className="flex space-x-3">
                  <button onClick={() => setCurrentStep(2)} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium border border-slate-700 transition-colors">
                    Novo Filtro
                  </button>
                  <button onClick={downloadCSV} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium border border-slate-700 flex items-center transition-colors">
                    <Download size={16} className="mr-2 text-slate-400" /> Exportar CSV
                  </button>
                  <button 
                    onClick={() => setScriptModalOpen(true)} 
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg shadow-emerald-900/20 flex items-center transition-all border border-emerald-500"
                  >
                    <FileSpreadsheet size={16} className="mr-2" /> Integração Google Sheets
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="flex-1 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-2xl relative">
                <div className="absolute inset-0 overflow-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-950 sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800">ID</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800">Tarefa</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800">Status</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800">Atribuído</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800">Entrega</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800">Prioridade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {tasks.map(task => (
                        <tr key={task.id} className="hover:bg-slate-800/50 transition-colors group">
                          <td className="p-4 text-xs font-mono text-slate-500">{task.id}</td>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <a href={task.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-slate-200 hover:text-brand-400 truncate max-w-xs">{task.name}</a>
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
                                 <div className="w-2 h-2 rounded-full" style={{ background: task.priority.color }}></div>
                                 <span className="text-xs capitalize">{task.priority.priority}</span>
                               </div>
                             ) : <span className="text-slate-600 text-xs">-</span>}
                          </td>
                        </tr>
                      ))}
                      {tasks.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-10 text-center text-slate-500">
                            Nenhuma tarefa encontrada. Tente outro filtro.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SCRIPT MODAL */}
          {scriptModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
              <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
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
                  {/* Instructions Sidebar */}
                  <div className="w-full md:w-1/3 p-6 bg-slate-800/50 border-r border-slate-800 overflow-y-auto">
                     <h4 className="font-bold text-sm uppercase text-slate-500 mb-4">Como Instalar</h4>
                     <ol className="space-y-4 text-sm text-slate-300 list-decimal list-inside">
                        <li className="pl-2"><span className="text-white font-medium">Crie uma Planilha</span> no Google Sheets.</li>
                        <li className="pl-2">Vá em <span className="font-mono bg-slate-950 px-1 rounded text-emerald-400">Extensões {'>'} Apps Script</span>.</li>
                        <li className="pl-2">Apague qualquer código existente e <span className="text-white font-medium">cole o código ao lado</span>.</li>
                        <li className="pl-2">Salve o projeto (ícone de disquete).</li>
                        <li className="pl-2">Recarregue a planilha. Um menu <span className="font-bold">ClickDown ETL</span> aparecerá.</li>
                        <li className="pl-2">Use o menu para sincronizar ou configurar a automação semanal.</li>
                     </ol>
                     
                     <div className="mt-8 p-4 bg-emerald-900/20 border border-emerald-900/50 rounded-lg">
                       <h5 className="text-emerald-400 font-bold mb-1 flex items-center gap-2"><RefreshCw size={14}/> Sincronização Bidirecional</h5>
                       <p className="text-xs text-emerald-200/70">
                         Este script suporta a leitura completa do ClickUp. Para editar dados e enviar de volta, use as funções do menu no App Script ou configure o painel web avançado.
                       </p>
                     </div>
                  </div>

                  {/* Code Viewer */}
                  <div className="flex-1 bg-slate-950 relative overflow-hidden group">
                    <div className="absolute top-4 right-4 z-10">
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(generateAppsScript(apiKey, hierarchy.selectedList, hierarchy.selectedTeam));
                        }}
                        className="bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded shadow-lg text-xs font-bold uppercase tracking-wider transition-all transform active:scale-95"
                      >
                        Copiar Código
                      </button>
                    </div>
                    <pre className="p-6 text-xs font-mono text-slate-300 h-full overflow-auto custom-scrollbar">
                      <code>{generateAppsScript(apiKey, hierarchy.selectedList, hierarchy.selectedTeam)}</code>
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default App;