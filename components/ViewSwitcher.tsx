import React from 'react';
import { ViewType } from '../types';
import { HomeIcon, KanbanIcon, ListIcon, TableIcon } from './Icons';

interface ViewSwitcherProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
}

const views: { id: ViewType; name: string; icon: any }[] = [
  { id: 'home', name: 'Início', icon: HomeIcon },
  { id: 'kanban', name: 'Kanban', icon: KanbanIcon },
  { id: 'list', name: 'Lista', icon: ListIcon },
  { id: 'table', name: 'Tabela', icon: TableIcon },
];

const ViewSwitcher: React.FC<ViewSwitcherProps> = ({ currentView, onViewChange }) => {
  return (
    <div className="flex items-center bg-slate-950 rounded-xl p-1 border border-slate-800">
      {views.map((view) => (
        <button
          key={view.id}
          onClick={() => onViewChange(view.id)}
          className={`px-4 py-1.5 text-[10px] uppercase tracking-widest font-bold flex items-center rounded-lg transition-all ${
            currentView === view.id
              ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20'
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'
          }`}
        >
          <view.icon className="w-3.5 h-3.5 mr-2" />
          {view.name}
        </button>
      ))}
    </div>
  );
};

export default ViewSwitcher;
