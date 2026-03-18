import React, { useState } from 'react';
import { Task } from '../types';
import { XIcon, PlusIcon, RefreshCwIcon as RefreshCw } from './Icons';

interface CreateTaskModalProps {
    onClose: () => void;
    onCreate: (taskData: Partial<Task>) => Promise<void>;
    listContext: { 
        context_space: string; 
        context_folder: string; 
        context_list: string; 
        webhookId: string; 
        webhookUrl: string; 
        webhookName: string;
    } | null;
    allAssignees: string[];
    allStatuses: string[];
    allPriorities: string[];
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ onClose, onCreate, listContext, allAssignees, allStatuses, allPriorities }) => {
    const [taskData, setTaskData] = useState({
        name: '',
        description: '',
        status: allStatuses.includes('A Fazer') ? 'A Fazer' : (allStatuses[0] || ''),
        priority: allPriorities.includes('Média') ? 'Média' : (allPriorities[0] || ''),
        assignees: '',
        due_date: '',
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setTaskData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!taskData.name.trim() || !listContext) return;
        
        setIsSaving(true);
        try {
            const newTask: Partial<Task> = {
                name: taskData.name,
                description: taskData.description,
                status: { status: taskData.status, color: '' },
                priority: { priority: taskData.priority, color: '' },
                assignees: taskData.assignees ? taskData.assignees.split(',').map(s => ({ id: s.trim(), username: s.trim(), color: '', initials: s.trim().substring(0,2) })) : [],
                due_date: taskData.due_date ? new Date(taskData.due_date).getTime().toString() : undefined,
                ...listContext,
                date_created: Date.now().toString(),
                date_updated: Date.now().toString(),
            };
            await onCreate(newTask);
            onClose();
        } catch (error) {
            console.error("Failed to create task", error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-300" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-800 rounded-4xl shadow-3xl w-full max-w-2xl overflow-hidden ring-1 ring-white/10 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="p-8 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tighter">Nova Tarefa</h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                            {listContext ? `${listContext.context_space} > ${listContext.context_list}` : 'Selecione um contexto'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all">
                        <XIcon size={24} />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-10 space-y-8">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 ml-1">Título</label>
                            <input 
                                name="name" 
                                type="text" 
                                value={taskData.name} 
                                onChange={handleChange} 
                                placeholder="O que precisa ser feito?" 
                                required 
                                className="w-full px-6 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-white text-lg font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all placeholder-slate-800"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 ml-1">Descrição</label>
                            <textarea 
                                name="description" 
                                value={taskData.description} 
                                onChange={handleChange} 
                                rows={4} 
                                placeholder="Adicione detalhes, requisitos ou notas..." 
                                className="w-full px-6 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-white text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-all placeholder-slate-800 resize-none"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 ml-1">Status</label>
                                <select 
                                    name="status" 
                                    value={taskData.status} 
                                    onChange={handleChange} 
                                    className="w-full px-6 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-white text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all appearance-none"
                                >
                                    {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 ml-1">Prioridade</label>
                                <select 
                                    name="priority" 
                                    value={taskData.priority} 
                                    onChange={handleChange} 
                                    className="w-full px-6 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-white text-sm font-bold outline-none focus:ring-2 focus:ring-brand-500 transition-all appearance-none"
                                >
                                    {allPriorities.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                        </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 ml-1">Responsáveis</label>
                                <input 
                                    name="assignees" 
                                    type="text" 
                                    value={taskData.assignees} 
                                    onChange={handleChange} 
                                    placeholder="Nomes separados por vírgula" 
                                    className="w-full px-6 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-white text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-all placeholder-slate-800"
                                />
                            </div>
                             <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 ml-1">Prazo Final</label>
                                <input 
                                    name="due_date" 
                                    type="date" 
                                    value={taskData.due_date} 
                                    onChange={handleChange} 
                                    className="w-full px-6 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-white text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-all appearance-none flex-row-reverse"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-8 bg-slate-950 border-t border-slate-800 flex justify-end gap-4 px-10">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="px-8 py-3 rounded-2xl text-slate-500 hover:text-white hover:bg-slate-800 transition-all font-bold text-xs uppercase tracking-widest"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit" 
                            disabled={!listContext || isSaving || !taskData.name.trim()} 
                            className="bg-brand-600 hover:bg-brand-500 text-white font-black px-12 py-3 rounded-2xl shadow-xl shadow-brand-900/40 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isSaving ? <RefreshCw className="animate-spin" size={18} /> : <PlusIcon size={18} />}
                            {isSaving ? 'CRIANDO...' : 'CRIAR TAREFA'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateTaskModal;
