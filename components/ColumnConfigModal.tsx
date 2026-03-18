import React, { useState } from 'react';
import { ColumnConfig } from '../types';
import { XIcon, PlusIcon, TrashIcon } from './Icons';

interface ColumnConfigModalProps {
    columnConfig: ColumnConfig;
    onSave: (config: ColumnConfig) => void;
    onClose: () => void;
}

const ColumnConfigModal: React.FC<ColumnConfigModalProps> = ({ columnConfig, onSave, onClose }) => {
    const [config, setConfig] = useState<ColumnConfig>(columnConfig);
    const [newOption, setNewOption] = useState('');

    const handleFormatChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newFormat = e.target.value as ColumnConfig['format'];
        setConfig(prev => ({
            ...prev,
            format: newFormat,
            options: newFormat === 'categorical' ? (prev.options || []) : undefined
        }));
    };

    const handleOptionChange = (index: number, value: string) => {
        const newOptions = [...(config.options || [])];
        newOptions[index] = value;
        setConfig(prev => ({ ...prev, options: newOptions }));
    };

    const handleAddOption = () => {
        if (newOption.trim()) {
            const newOptions = [...(config.options || []), newOption.trim()];
            setConfig(prev => ({ ...prev, options: newOptions }));
            setNewOption('');
        }
    };

    const handleDeleteOption = (index: number) => {
        const newOptions = [...(config.options || [])];
        newOptions.splice(index, 1);
        setConfig(prev => ({ ...prev, options: newOptions }));
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        Configurar Coluna: <span className="text-brand-400 capitalize">{config.label}</span>
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                        <XIcon size={20} />
                    </button>
                </div>
                
                <div className="p-6 space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Formato da Coluna</label>
                        <select value={config.format} onChange={handleFormatChange} className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-brand-500 transition-all appearance-none">
                            <option value="text">Texto</option>
                            <option value="number">Número</option>
                            <option value="date">Data</option>
                            <option value="categorical">Categórico (Seleção)</option>
                        </select>
                    </div>

                    {config.format === 'categorical' && (
                        <div className="animate-in slide-in-from-top-2">
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 ml-1">Opções da Categoria</h4>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                {(config.options || []).map((option, index) => (
                                    <div key={index} className="flex items-center space-x-2 group">
                                        <input
                                            type="text"
                                            value={option}
                                            onChange={(e) => handleOptionChange(index, e.target.value)}
                                            className="flex-grow px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-sm focus:border-brand-500 transition-colors"
                                        />
                                        <button onClick={() => handleDeleteOption(index)} className="p-2 text-slate-600 hover:text-red-400 transition-colors">
                                            <TrashIcon size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 flex items-center space-x-2">
                                <input
                                    type="text"
                                    value={newOption}
                                    onChange={(e) => setNewOption(e.target.value)}
                                    placeholder="Nova opção..."
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddOption(); } }}
                                    className="flex-grow px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                                />
                                <button onClick={handleAddOption} className="p-3 bg-brand-600 hover:bg-brand-500 rounded-xl flex-shrink-0 transition-colors shadow-lg shadow-brand-900/20">
                                    <PlusIcon size={20} className="text-white" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-5 bg-slate-950 border-t border-slate-800 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all font-medium">
                        Cancelar
                    </button>
                    <button onClick={() => onSave(config)} className="bg-brand-600 text-white font-bold px-8 py-2 rounded-lg hover:bg-brand-500 transition-all shadow-lg shadow-brand-900/20">
                        Salvar Alterações
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ColumnConfigModal;
