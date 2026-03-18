import React, { useState } from 'react';
import { XIcon, AlertCircleIcon, TrashIcon, EditIcon, PlusIcon } from './Icons';

interface ActionModalProps {
    action: 'CREATE' | 'RENAME' | 'DELETE';
    structure: 'workspace' | 'folder' | 'list';
    context?: any;
    onConfirm: (value: string) => void;
    onClose: () => void;
}

const ActionModal: React.FC<ActionModalProps> = ({ action, structure, context, onConfirm, onClose }) => {
    const [value, setValue] = useState(action === 'RENAME' ? context.name : '');
    
    const getTitle = () => {
        const strMap: any = { workspace: 'Espaço', folder: 'Pasta', list: 'Lista' };
        if (action === 'CREATE') return `Criar Novo ${strMap[structure]}`;
        if (action === 'RENAME') return `Renomear ${strMap[structure]}`;
        if (action === 'DELETE') return `Excluir ${strMap[structure]}`;
        return '';
    };

    const handleConfirm = () => {
        if (action === 'DELETE') {
            onConfirm(context.name);
        } else if (value.trim()) {
            onConfirm(value.trim());
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white flex items-center gap-3">
                        {action === 'DELETE' ? <AlertCircleIcon className="text-red-500" /> : action === 'CREATE' ? <PlusIcon className="text-brand-500" /> : <EditIcon className="text-brand-500" />}
                        {getTitle()}
                    </h3>
                    <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all">
                        <XIcon size={20} />
                    </button>
                </div>
                
                <div className="p-8">
                    {action === 'DELETE' ? (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-300 leading-relaxed">
                                Tem certeza que deseja excluir <span className="font-bold text-white">"{context.name}"</span>? 
                                Todas as tarefas e dados vinculados nesta estrutura serão perdidos permanentemente.
                            </p>
                            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-start gap-3">
                                <AlertCircleIcon className="text-red-500 flex-shrink-0" size={20} />
                                <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider">Esta ação não pode ser desfeita.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nome do(a) {structure === 'workspace' ? 'Espaço' : structure === 'folder' ? 'Pasta' : 'Lista'}</label>
                            <input
                                type="text"
                                value={value}
                                onChange={e => setValue(e.target.value)}
                                autoFocus
                                className="w-full px-5 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-white text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-all font-bold"
                                placeholder={`Ex: ${structure === 'workspace' ? 'Operações Q2' : 'Pendências'}`}
                                onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                            />
                        </div>
                    )}
                </div>

                <div className="p-6 bg-slate-950 border-t border-slate-800 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all font-bold text-xs uppercase tracking-widest">
                        Cancelar
                    </button>
                    <button 
                        onClick={handleConfirm}
                        className={`px-8 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 ${action === 'DELETE' ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/20' : 'bg-brand-600 hover:bg-brand-500 text-white shadow-brand-900/20'}`}
                    >
                        {action === 'DELETE' ? 'Confirmar Exclusão' : 'Confirmar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ActionModal;
