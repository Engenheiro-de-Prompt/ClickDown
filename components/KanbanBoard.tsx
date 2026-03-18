import React, { useMemo, useState } from 'react';
import { Task } from '../types';
import TaskCard from './TaskCard';
import { ChevronDownIcon, PlusIcon, DotsVerticalIcon } from './Icons';

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onGoToParent: (parentId: string) => void;
}

const STATUS_ORDER = ['to do', 'in progress', 'review', 'blocked', 'complete', 'closed'];

const KanbanColumn: React.FC<{ 
  title: string; 
  color: string;
  tasks: Task[]; 
  onTaskClick: (task: Task) => void; 
  onGoToParent: (parentId: string) => void; 
}> = ({ title, color, tasks, onTaskClick, onGoToParent }) => {
  const [isCollapsed, setIsCollapsed] = useState(title.toLowerCase().includes('concl') || title.toLowerCase().includes('clos'));

  return (
    <div className="w-80 bg-slate-900/40 rounded-2xl p-4 flex-shrink-0 flex flex-col transition-all duration-300 border border-slate-800/50">
      <div className="flex justify-between items-center mb-6 pb-2 border-b border-slate-800" style={{ borderTop: `4px solid ${color || '#475569'}` }}>
        <div className="pt-2">
            <h3 className="font-bold text-slate-100 text-sm uppercase tracking-wider">{title}</h3>
            <span className="text-[10px] text-slate-500 font-bold">{tasks.length} TAREFAS</span>
        </div>
        <div className="flex items-center space-x-2">
            {(title.toLowerCase().includes('concl') || title.toLowerCase().includes('clos')) && (
              <button 
                onClick={() => setIsCollapsed(!isCollapsed)} 
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                title={isCollapsed ? "Expandir" : "Recolher"}
              >
                  <ChevronDownIcon size={16} className={`transition-transform ${isCollapsed ? '' : 'rotate-180'}`} />
              </button>
            )}
        </div>
      </div>

      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} onGoToParent={onGoToParent} />
          ))}
          {tasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 opacity-20">
                <div className="w-10 h-10 rounded-full border-2 border-dashed border-slate-500 mb-2"></div>
                <span className="text-[10px] font-bold">VAZIO</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


const KanbanBoard: React.FC<KanbanBoardProps> = ({ tasks, onTaskClick, onGoToParent }) => {
  const columns = useMemo(() => {
    const grouped: { [key: string]: { tasks: Task[], color: string } } = {};
    
    tasks.forEach(task => {
      const statusName = task.status.status;
      if (!grouped[statusName]) {
        grouped[statusName] = { tasks: [], color: task.status.color }; 
      }
      grouped[statusName].tasks.push(task);
    });
    
    return Object.entries(grouped).sort(([nameA], [nameB]) => {
      const indexA = STATUS_ORDER.findIndex(s => nameA.toLowerCase().includes(s));
      const indexB = STATUS_ORDER.findIndex(s => nameB.toLowerCase().includes(s));
      
      if (indexA === -1 && indexB === -1) return nameA.localeCompare(nameB);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

  }, [tasks]);

  return (
    <div className="flex space-x-6 overflow-x-auto pb-6 h-full custom-scrollbar">
      {columns.map(([statusName, data]) => (
        <KanbanColumn 
            key={statusName} 
            title={statusName} 
            color={data.color}
            tasks={data.tasks} 
            onTaskClick={onTaskClick} 
            onGoToParent={onGoToParent} 
        />
      ))}
    </div>
  );
};

export default KanbanBoard;
