import React from 'react';
import { SearchIcon, FilterIcon, UserIcon } from './Icons';

interface FilterBarProps {
    onSearch: (term: string) => void;
    onPriorityChange: (priority: string) => void;
    onAssigneeChange: (assignee: string) => void;
    allAssignees: string[];
    allPriorities: string[];
}

const FilterBar: React.FC<FilterBarProps> = ({ onSearch, onPriorityChange, onAssigneeChange, allAssignees, allPriorities }) => {
    return (
        <div className="bg-slate-900 border-b border-slate-800 p-4 sticky top-[105px] z-10 backdrop-blur-md bg-opacity-80">
            <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-grow w-full">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input 
                        type="text" 
                        placeholder="Pesquisar tarefas..." 
                        onChange={(e) => onSearch(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                    />
                </div>
                
                <div className="flex gap-4 w-full md:w-auto">
                    <div className="relative w-full md:w-48">
                        <FilterIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                        <select 
                            onChange={(e) => onPriorityChange(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-400 appearance-none focus:ring-2 focus:ring-brand-500 outline-none hover:border-slate-700 transition-all"
                        >
                            <option value="">Todas Prioridades</option>
                            {allPriorities.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                    
                    <div className="relative w-full md:w-48">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                        <select 
                            onChange={(e) => onAssigneeChange(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-400 appearance-none focus:ring-2 focus:ring-brand-500 outline-none hover:border-slate-700 transition-all"
                        >
                            <option value="">Todos Responsáveis</option>
                            {allAssignees.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FilterBar;
