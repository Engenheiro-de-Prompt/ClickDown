import React, { useState } from 'react';
import { Webhook } from '../types';
import { XIcon, TrashIcon, PlusIcon, WebhookIcon } from './Icons';

interface WebhookManagerModalProps {
    webhooks: Webhook[];
    onClose: () => void;
    onUpdate: (webhooks: Webhook[]) => void;
}

const WebhookManagerModal: React.FC<WebhookManagerModalProps> = ({ webhooks, onClose, onUpdate }) => {
    const [localWebhooks, setLocalWebhooks] = useState(webhooks);
    const [newWebhookName, setNewWebhookName] = useState('');
    const [newWebhookUrl, setNewWebhookUrl] = useState('');
    const [error, setError] = useState('');

    const handleAdd = () => {
        if (!newWebhookName.trim() || !newWebhookUrl.trim()) {
            setError('Nome e URL são obrigatórios.');
            return;
        }
        const newWebhook: Webhook = {
            id: 'wh_' + Date.now() + Math.random().toString(36).substring(2, 9),
            name: newWebhookName.trim(),
            url: newWebhookUrl.trim()
        };
        setLocalWebhooks([...localWebhooks, newWebhook]);
        setNewWebhookName('');
        setNewWebhookUrl('');
        setError('');
    };

    const handleDelete = (id: string) => {
        setLocalWebhooks(localWebhooks.filter(wh => wh.id !== id));
    };

    const handleSave = () => {
        onUpdate(localWebhooks);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-800 bg-slate-950 flex justify-between items-center px-8">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-3">
                            <WebhookIcon className="text-brand-500" size={24} />
                            Conexões de Dados
                        </h2>
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-widest mt-1">Gerencie suas planilhas do Google</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all">
                        <XIcon size={24} />
                    </button>
                </div>
                
                <div className="p-8 flex-grow overflow-y-auto space-y-8 custom-scrollbar">
                    <section>
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Webhooks Ativos ({localWebhooks.length})</h3>
                        <div className="grid gap-3">
                            {localWebhooks.map(wh => (
                                <div key={wh.id} className="flex items-center justify-between bg-slate-850/50 border border-slate-800 p-4 rounded-2xl group hover:border-brand-500/30 transition-all">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <p className="font-bold text-slate-100 mb-0.5">{wh.name}</p>
                                        <p className="text-[10px] text-slate-500 font-mono truncate">{wh.url}</p>
                                    </div>
                                    <button onClick={() => handleDelete(wh.id)} className="p-2.5 text-slate-500 hover:text-red-400 rounded-xl hover:bg-red-500/10 transition-all">
                                        <TrashIcon size={20}/>
                                    </button>
                                </div>
                            ))}
                            {localWebhooks.length === 0 && (
                                <div className="text-center py-10 bg-slate-950/30 rounded-2xl border-2 border-dashed border-slate-800">
                                    <p className="text-sm text-slate-600 font-medium">Nenhum webhook configurado. Adicione um abaixo.</p>
                                </div>
                            )}
                        </div>
                    </section>
                    
                    <section className="bg-brand-500/5 rounded-3xl p-6 border border-brand-500/10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold">
                                <PlusIcon size={18} />
                            </div>
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Nova Conexão</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 ml-1">Apelido</label>
                                    <input
                                        type="text"
                                        value={newWebhookName}
                                        onChange={e => setNewWebhookName(e.target.value)}
                                        placeholder="ex: Planejamento Q1"
                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 ml-1">URL do App Script</label>
                                    <input
                                        type="url"
                                        value={newWebhookUrl}
                                        onChange={e => setNewWebhookUrl(e.target.value)}
                                        placeholder="https://script.google.com/macros/s/..."
                                        className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-all font-mono"
                                    />
                                </div>
                            </div>
                            {error && <p className="text-xs text-red-400 font-medium animate-bounce ml-1">{error}</p>}
                             <button onClick={handleAdd} className="flex items-center justify-center w-full bg-brand-600 text-white px-6 py-3.5 rounded-xl hover:bg-brand-500 transition-all font-bold shadow-lg shadow-brand-900/20 active:scale-[0.98]">
                                <PlusIcon size={20} className="mr-2" />
                                Adicionar Webhook
                            </button>
                        </div>
                    </section>
                </div>

                <div className="p-6 bg-slate-950 border-t border-slate-800 flex justify-end gap-3 px-8">
                    <button onClick={onClose} className="px-6 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all font-medium">
                        Cancelar
                    </button>
                    <button onClick={handleSave} className="bg-brand-600 text-white font-bold px-10 py-2 rounded-xl hover:bg-brand-500 transition-all shadow-lg shadow-brand-900/20 active:scale-[0.98]">
                        Salvar Alterações
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WebhookManagerModal;
