import React, { useState, useEffect } from 'react';
import { 
  X, Save, Clock, Calendar, AlertCircle, 
  Play, Square, ChevronRight, RefreshCcw,
  MessageSquare, History, CheckSquareIcon as CheckSquare, Plus
} from './Icons';
import { Task, RecurrenceRule } from '../types';
import RecurrenceEditor from './RecurrenceEditor';
import { createValidDate } from '../utils/dateUtils';
import { formatRuleToString } from '../utils/recurrenceUtils';

interface TaskDetailModalProps {
  task: Task;
  allTasksMap: Map<string, Task>;
  onClose: () => void;
  onSave: (task: Task, updates: any) => Promise<void>;
  onGoToTask?: (taskId: string) => void;
}

const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ task, allTasksMap, onClose, onSave, onGoToTask }) => {
  const [editedTask, setEditedTask] = useState(task);
  const [isSaving, setIsSaving] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [showRecurrenceEditor, setShowRecurrenceEditor] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'subtasks'>('details');

  useEffect(() => {
    setEditedTask(task);
    setElapsed(0);
    setTimerActive(false);
    setTimerStart(null);
  }, [task]);

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
    if (JSON.stringify(editedTask.recurrence) !== JSON.stringify(task.recurrence)) updates.recurrence = editedTask.recurrence;

    await onSave(task, updates);
    setIsSaving(false);
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

  const handleRecurrenceSave = (rule: RecurrenceRule) => {
    setEditedTask({ ...editedTask, recurrence: rule });
    setShowRecurrenceEditor(false);
  };

  const handleRecurrenceRemove = () => {
    setEditedTask({ ...editedTask, recurrence: undefined });
    setShowRecurrenceEditor(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-5xl h-[90vh] rounded-3xl shadow-3xl flex flex-col overflow-hidden ring-1 ring-white/10">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950 flex justify-between items-center px-8">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all ${timerActive ? 'bg-red-500/10 border-red-500/50 text-red-500 animate-pulse' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
              <div className={`w-2 h-2 rounded-full ${timerActive ? 'bg-red-500' : 'bg-slate-700'}`}></div>
              {timerActive ? 'Gravando Tempo' : task.id}
            </div>
            {task.parent && allTasksMap.has(task.parent) && (
                <button 
                  onClick={() => onGoToTask?.(task.parent!)}
                  className="flex items-center gap-2 text-xs text-brand-400 hover:text-brand-300 font-bold uppercase tracking-wider transition-colors"
                >
                    <ChevronRight size={14} className="rotate-180" />
                    {allTasksMap.get(task.parent)?.name}
                </button>
            )}
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleSave} 
              disabled={isSaving} 
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-brand-900/40 disabled:opacity-50 active:scale-95"
            >
              {isSaving ? <RefreshCcw className="animate-spin" size={18} /> : <Save size={18} />}
              Salvar
            </button>
            <button onClick={onClose} className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-900/50">
            {/* Tabs */}
            <div className="flex border-b border-slate-800/50 px-8 bg-slate-950/20">
                <button onClick={() => setActiveTab('details')} className={`px-6 py-4 text-xs font-bold uppercase tracking-[0.2em] transition-all relative ${activeTab === 'details' ? 'text-brand-400' : 'text-slate-500 hover:text-slate-300'}`}>
                    Detalhes
                    {activeTab === 'details' && <div className="absolute bottom-0 left-6 right-6 h-0.5 bg-brand-500 rounded-full"></div>}
                </button>
                <button onClick={() => setActiveTab('subtasks')} className={`px-6 py-4 text-xs font-bold uppercase tracking-[0.2em] transition-all relative ${activeTab === 'subtasks' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
                    Subtarefas ({task.subtasks?.length || 0})
                    {activeTab === 'subtasks' && <div className="absolute bottom-0 left-6 right-6 h-0.5 bg-indigo-500 rounded-full"></div>}
                </button>
                <button onClick={() => setActiveTab('history')} className={`px-6 py-4 text-xs font-bold uppercase tracking-[0.2em] transition-all relative ${activeTab === 'history' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>
                    Histórico ({task.history?.length || 0})
                    {activeTab === 'history' && <div className="absolute bottom-0 left-6 right-6 h-0.5 bg-emerald-500 rounded-full"></div>}
                </button>
            </div>

            <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                {activeTab === 'details' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
                        <textarea
                            value={editedTask.name}
                            onChange={e => setEditedTask({ ...editedTask, name: e.target.value })}
                            className="text-3xl font-bold bg-transparent text-white w-full border-none focus:ring-0 px-0 mb-2 placeholder-slate-700 leading-tight resize-none h-auto"
                            placeholder="Título da Tarefa"
                            rows={2}
                        />

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Status</label>
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: editedTask.status.color }}></div>
                                    <select
                                        value={editedTask.status.status}
                                        onChange={e => setEditedTask({ ...editedTask, status: { ...editedTask.status, status: e.target.value } })}
                                        className="bg-transparent border-none outline-none text-slate-200 text-sm font-semibold p-0 w-full cursor-pointer"
                                    >
                                        <option value={editedTask.status.status}>{editedTask.status.status}</option>
                                    </select>
                                </div>
                            </div>
                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Prioridade</label>
                                <div className="flex items-center gap-3">
                                    <AlertCircle size={16} className={editedTask.priority?.priority === 'urgent' ? 'text-red-500' : 'text-slate-500'} />
                                    <select
                                        value={editedTask.priority?.priority || 'normal'}
                                        onChange={e => setEditedTask({ ...editedTask, priority: { priority: e.target.value, color: '' } })}
                                        className="bg-transparent border-none outline-none text-slate-200 text-sm font-semibold p-0 w-full cursor-pointer"
                                    >
                                        <option value="urgent">Urgente</option>
                                        <option value="high">Alta</option>
                                        <option value="normal">Normal</option>
                                        <option value="low">Baixa</option>
                                    </select>
                                </div>
                            </div>
                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Data de Entrega</label>
                                <div className="flex items-center gap-3 text-slate-200 text-sm font-semibold cursor-pointer">
                                    <Calendar size={16} className="text-slate-500" />
                                    <span>{editedTask.due_date ? new Date(parseInt(editedTask.due_date)).toLocaleDateString() : 'Não definido'}</span>
                                </div>
                            </div>
                            <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50 relative">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Recorrência</label>
                                <button
                                    onClick={() => setShowRecurrenceEditor(!showRecurrenceEditor)}
                                    className={`flex items-center gap-3 text-sm font-semibold transition-colors ${editedTask.recurrence ? 'text-cyan-400' : 'text-slate-300'}`}
                                >
                                    <RefreshCcw size={16} className={editedTask.recurrence ? 'animate-spin-slow' : 'text-slate-500'} />
                                    <span className="truncate">{editedTask.recurrence ? 'Configurado' : 'Configurar'}</span>
                                </button>
                                {showRecurrenceEditor && (
                                    <RecurrenceEditor
                                        rule={editedTask.recurrence || null}
                                        baseDate={editedTask.due_date || undefined}
                                        onSave={handleRecurrenceSave}
                                        onRemove={handleRecurrenceRemove}
                                        onClose={() => setShowRecurrenceEditor(false)}
                                    />
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2 ml-1">
                                <MessageSquare size={16} className="text-brand-500" />
                                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Descrição</h3>
                            </div>
                            <div className="bg-slate-950/30 p-6 rounded-3xl border border-slate-800/50 min-h-[300px] focus-within:border-brand-500/30 transition-all">
                                <textarea
                                    value={editedTask.description || ''}
                                    onChange={e => setEditedTask({ ...editedTask, description: e.target.value })}
                                    className="w-full min-h-[250px] bg-transparent text-slate-200 resize-none outline-none text-sm leading-relaxed placeholder-slate-700"
                                    placeholder="Comece a escrever a descrição da tarefa..."
                                />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'subtasks' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-white uppercase tracking-wider">Subtarefas</h3>
                            <button className="flex items-center gap-2 bg-indigo-600/20 text-indigo-400 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-600/30 transition-all">
                                <Plus size={16} /> Nova Subtarefa
                            </button>
                        </div>
                        <div className="grid gap-3">
                            {task.subtasks?.map(sub => (
                                <div key={sub.id} onClick={() => onGoToTask?.(sub.id)} className="flex items-center justify-between p-4 bg-slate-950/40 border border-slate-800 rounded-2xl cursor-pointer hover:border-indigo-500/30 hover:bg-slate-850 transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-5 h-5 rounded border border-slate-700 flex items-center justify-center text-slate-700 group-hover:border-indigo-500 group-hover:text-indigo-500 transition-colors">
                                            {sub.status.status.toLowerCase().includes('concl') && <CheckSquare size={12} fill="currentColor" />}
                                        </div>
                                        <span className={`text-sm font-medium ${sub.status.status.toLowerCase().includes('concl') ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{sub.name}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-[10px] uppercase font-bold text-slate-600" style={{ color: sub.status.color }}>{sub.status.status}</span>
                                        <ChevronRight size={16} className="text-slate-700 group-hover:text-white transition-colors" />
                                    </div>
                                </div>
                            ))}
                            {(!task.subtasks || task.subtasks.length === 0) && (
                                <div className="text-center py-20 opacity-20">
                                    <Plus size={48} className="mx-auto mb-4" />
                                    <p className="text-sm font-bold uppercase tracking-widest">Nenhuma subtarefa</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <h3 className="text-lg font-bold text-white uppercase tracking-wider mb-6">Linha do Tempo</h3>
                        <div className="relative border-l-2 border-slate-800 ml-4 pl-8 space-y-10">
                            {task.history?.map((entry, i) => (
                                <div key={i} className="relative">
                                    <div className="absolute -left-[41px] top-0 w-5 h-5 rounded-full bg-slate-900 border-2 border-emerald-500 flex items-center justify-center">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                    </div>
                                    <div className="bg-slate-950/40 border border-slate-800 p-5 rounded-2xl">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-bold text-slate-400 capitalize">{entry.status.status}</span>
                                            <span className="text-[10px] text-slate-600 font-mono">
                                                {entry.date_updated ? new Date(parseInt(entry.date_updated)).toLocaleString() : entry.date_created ? new Date(parseInt(entry.date_created)).toLocaleString() : 'N/D'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-200 font-medium">{entry.name}</p>
                                        <div className="mt-4 flex gap-4 text-[10px] text-slate-500 uppercase tracking-widest">
                                            {entry.priority && <span>Prioridade: <b className="text-slate-300">{entry.priority.priority}</b></span>}
                                            {entry.time_spent && <span>Tempo: <b className="text-slate-300">{(entry.time_spent / 3600000).toFixed(1)}h</b></span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {(!task.history || task.history.length === 0) && (
                                <div className="text-center py-20 opacity-20 ml-[-32px]">
                                    <History size={48} className="mx-auto mb-4" />
                                    <p className="text-sm font-bold uppercase tracking-widest">Sem histórico registrado</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-80 bg-slate-950 p-8 overflow-y-auto border-l border-slate-800 flex flex-col gap-8 custom-scrollbar">
            {/* Timer Widget */}
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-2xl ring-1 ring-white/5">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-[0.2em] flex items-center gap-2">
                  <Clock size={14} className="text-brand-500" /> Rastreador
                </h4>
                <div className="text-[10px] font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800">
                  {((task.time_spent || 0) / 3600000).toFixed(2)}H TOTAL
                </div>
              </div>

              <div className="text-center py-6">
                <div className={`text-4xl font-mono text-white font-light tracking-widest mb-6 ${timerActive ? 'text-red-400' : ''}`}>
                  {formatTime(elapsed)}
                </div>
                <button
                  onClick={toggleTimer}
                  className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg ${timerActive
                      ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/30'
                      : 'bg-brand-600 text-white hover:bg-brand-500 shadow-brand-900/40'
                    }`}
                >
                  {timerActive ? <><Square size={20} fill="currentColor" /> PARAR</> : <><Play size={20} fill="currentColor" /> INICIAR</>}
                </button>
              </div>
            </div>

            <div className="space-y-8">
              <section>
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] block mb-4">Responsáveis</label>
                <div className="flex flex-wrap gap-2">
                  {task.assignees.map(u => (
                    <div key={u.id} className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 group hover:border-slate-600 transition-all">
                      <div className="w-5 h-5 rounded-lg bg-brand-600 text-[10px] flex items-center justify-center text-white font-bold">{u.username.substring(0, 2).toUpperCase()}</div>
                      <span className="text-xs font-medium text-slate-300 group-hover:text-white">{u.username}</span>
                    </div>
                  ))}
                  {task.assignees.length === 0 && <span className="text-xs text-slate-600 italic">Ninguém atribuído</span>}
                    <button className="p-1.5 rounded-lg border border-dashed border-slate-800 text-slate-600 hover:border-slate-500 hover:text-slate-400 transition-all">
                        <Plus size={16} />
                    </button>
                </div>
              </section>

              <section>
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] block mb-4">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {task.tags.map((t, i) => (
                    <span key={i} className="text-[10px] px-3 py-1.5 rounded-lg bg-slate-900 text-slate-400 border border-slate-800 hover:text-brand-400 hover:border-brand-500/30 transition-all cursor-pointer">
                      #{t.name.toUpperCase()}
                    </span>
                  ))}
                  {task.tags.length === 0 && <span className="text-xs text-slate-600 italic">Sem tags</span>}
                    <button className="p-1.5 rounded-lg border border-dashed border-slate-800 text-slate-600 hover:border-slate-500 hover:text-slate-400 transition-all">
                        <Plus size={16} />
                    </button>
                </div>
              </section>
              
              <section>
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em] block mb-4">Contexto Original</label>
                <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 space-y-2">
                    <p className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-500"></div>
                        {task.context_space || 'N/D'}
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold ml-3.5">
                        {task.context_folder || 'Sem Pasta'}
                    </p>
                    <p className="text-[10px] text-white font-black ml-3.5 flex items-center gap-2">
                        <ChevronRight size={10} className="text-brand-500" />
                        {task.context_list || 'Lista Desconhecida'}
                    </p>
                    {task.webhookName && (
                        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-2 text-[8px] font-bold text-cyan-400 uppercase tracking-widest">
                            <RefreshCcw size={10} />
                            Fonte: {task.webhookName}
                        </div>
                    )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TaskDetailModal;
