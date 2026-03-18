import React, { useState, useEffect } from 'react';
import { RecurrenceRule } from '../types';
import { XIcon } from './Icons';
import { calculateNextDueDate } from '../utils/recurrenceUtils';

interface RecurrenceEditorProps {
    rule: RecurrenceRule | null;
    baseDate?: string;
    onSave: (rule: RecurrenceRule) => void;
    onRemove: () => void;
    onClose: () => void;
}

const WEEKDAYS = [
    { label: 'Dom', value: 0 }, { label: 'Seg', value: 1 }, { label: 'Ter', value: 2 },
    { label: 'Qua', value: 3 }, { label: 'Qui', value: 4 }, { label: 'Sex', value: 5 },
    { label: 'Sáb', value: 6 }
];

const DEFAULT_RULE: RecurrenceRule = {
    frequency: 'weekly',
    interval: 1,
    daysOfWeek: [new Date().getDay()],
    mode: 'reopen',
    creationOptions: {
        keepStructure: true,
        keepDetails: true,
        keepContent: false,
        keepData: false,
    }
};

const RecurrenceEditor: React.FC<RecurrenceEditorProps> = ({ rule, baseDate, onSave, onRemove, onClose }) => {
    const [currentRule, setCurrentRule] = useState<RecurrenceRule>(rule || DEFAULT_RULE);
    
    useEffect(() => {
        if (!rule) {
            const initialDay = baseDate ? new Date(parseInt(baseDate)).getDay() : new Date().getDay();
            setCurrentRule({ ...DEFAULT_RULE, daysOfWeek: [initialDay] });
        } else {
            setCurrentRule(rule);
        }
    }, [rule, baseDate]);
    
    const handleDayToggle = (day: number) => {
        const days = currentRule.daysOfWeek || [];
        const newDays = days.includes(day)
            ? days.filter(d => d !== day)
            : [...days, day];
        if (newDays.length > 0) {
            setCurrentRule(prev => ({ ...prev, daysOfWeek: newDays }));
        }
    };

    const handleSave = () => {
        const fromDate = new Date(baseDate ? parseInt(baseDate) : Date.now());
        const nextDueDate = calculateNextDueDate(currentRule, fromDate);
        onSave({ ...currentRule, nextDueDate: nextDueDate.toISOString() });
    };

    return (
        <div className="absolute top-full right-0 mt-3 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 p-6 animate-in fade-in slide-in-from-top-2 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Recorrência</h3>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
                    <XIcon size={16} />
                </button>
            </div>
            
            <div className="space-y-6">
                {/* Frequency */}
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 ml-1">Frequência</label>
                    <select 
                        value={currentRule.frequency} 
                        onChange={e => setCurrentRule(prev => ({ ...prev, frequency: e.target.value as 'weekly' | 'monthly' }))}
                        className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-all"
                    >
                        <option value="weekly">Semanalmente</option>
                        <option value="monthly">Mensalmente</option>
                    </select>
                </div>

                {/* Weekly Options */}
                {currentRule.frequency === 'weekly' && (
                    <div className="animate-in fade-in duration-300">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-3 ml-1">Dias da Semana</label>
                        <div className="flex justify-between gap-1">
                            {WEEKDAYS.map(day => (
                                <button 
                                    key={day.value}
                                    onClick={() => handleDayToggle(day.value)}
                                    className={`w-8 h-8 rounded-lg font-bold text-[10px] uppercase flex items-center justify-center transition-all ${
                                        currentRule.daysOfWeek?.includes(day.value) 
                                            ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/40' 
                                            : 'bg-slate-850 hover:bg-slate-800 text-slate-500 hover:text-slate-300 border border-slate-800'
                                    }`}
                                >
                                    {day.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* Monthly Options */}
                {currentRule.frequency === 'monthly' && (
                     <div className="animate-in fade-in duration-300">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 ml-1">Dia do Mês</label>
                        <input 
                            type="number" 
                            min="1" max="31"
                            value={currentRule.dayOfMonth || 1} 
                            onChange={e => setCurrentRule(prev => ({...prev, dayOfMonth: parseInt(e.target.value, 10)}))}
                            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-all font-mono"
                        />
                    </div>
                )}
                
                {/* Action Mode */}
                <div>
                     <label className="block text-[10px] font-bold text-slate-500 uppercase mb-3 ml-1">Quando concluída</label>
                     <div className="space-y-2">
                        <label className={`flex items-center p-3 rounded-xl border transition-all cursor-pointer ${currentRule.mode === 'reopen' ? 'bg-brand-500/10 border-brand-500/50' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}>
                            <input type="radio" name="mode" value="reopen" checked={currentRule.mode === 'reopen'} onChange={() => setCurrentRule(prev => ({...prev, mode: 'reopen'}))} className="hidden"/>
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${currentRule.mode === 'reopen' ? 'border-brand-500' : 'border-slate-700'}`}>
                                {currentRule.mode === 'reopen' && <div className="w-2 h-2 rounded-full bg-brand-500"></div>}
                            </div>
                            <span className="ml-3 text-xs font-medium text-slate-300">Reabrir esta tarefa</span>
                        </label>
                         <label className={`flex items-center p-3 rounded-xl border transition-all cursor-pointer ${currentRule.mode === 'create_new' ? 'bg-indigo-500/10 border-indigo-500/50' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}>
                            <input type="radio" name="mode" value="create_new" checked={currentRule.mode === 'create_new'} onChange={() => setCurrentRule(prev => ({...prev, mode: 'create_new'}))} className="hidden"/>
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${currentRule.mode === 'create_new' ? 'border-indigo-500' : 'border-slate-700'}`}>
                                {currentRule.mode === 'create_new' && <div className="w-2 h-2 rounded-full bg-indigo-500"></div>}
                            </div>
                            <span className="ml-3 text-xs font-medium text-slate-300">Criar uma nova tarefa</span>
                        </label>
                     </div>
                </div>
            </div>
            
            {/* Actions */}
            <div className="flex justify-between items-center mt-8 pt-4 border-t border-slate-800">
                <button onClick={onRemove} className="text-[10px] font-bold uppercase tracking-widest text-red-500 hover:text-red-400 transition-colors">Remover</button>
                <button onClick={handleSave} className="bg-brand-600 text-white text-[10px] font-bold uppercase tracking-widest px-6 py-2 rounded-lg hover:bg-brand-500 transition-all shadow-lg shadow-brand-900/20 active:scale-95">Salvar</button>
            </div>
        </div>
    );
};

export default RecurrenceEditor;
