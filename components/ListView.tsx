import React, { useMemo } from 'react';
import { Task } from '../types';
import TaskCard from './TaskCard';
import CollapsibleSection from './CollapsibleSection';
import { ListIcon, KanbanIcon as LayoutGrid } from './Icons';

interface ListViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onGoToParent: (parentId: string) => void;
}

const TaskListItem: React.FC<{ 
  task: Task; 
  level: number; 
  onTaskClick: (task: Task) => void; 
  onGoToParent: (id: string) => void 
}> = ({ task, level, onTaskClick, onGoToParent }) => {
  return (
    <div style={{ marginLeft: `${level * 24}px` }} className="animate-in slide-in-from-left-2 duration-200">
      <TaskCard task={task} onClick={() => onTaskClick(task)} onGoToParent={onGoToParent} />
      {task.subtasks && task.subtasks.length > 0 && (
        <div className="mt-4 space-y-4 border-l-2 border-slate-800/50 ml-6 pl-2">
          {task.subtasks.map(subtask => (
            <TaskListItem key={subtask.id} task={subtask} level={0} onTaskClick={onTaskClick} onGoToParent={onGoToParent} />
          ))}
        </div>
      )}
    </div>
  );
};


const ListView: React.FC<ListViewProps> = ({ tasks, onTaskClick, onGoToParent }) => {
  const { completedTasks, activeTasks } = useMemo(() => {
    // Separa apenas as tarefas raiz em seções ativas e concluídas.
    const completedRootTasks = tasks.filter(t => (t.status.status.toLowerCase().includes('concl') || t.status.status.toLowerCase().includes('clos')));
    const activeRootTasks = tasks.filter(t => !(t.status.status.toLowerCase().includes('concl') || t.status.status.toLowerCase().includes('clos')));
    return { completedTasks: completedRootTasks, activeTasks: activeRootTasks };
  }, [tasks]);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      {activeTasks.length > 0 ? (
        <div className="space-y-6">
          {activeTasks.map(task => (
            <TaskListItem key={task.id} task={task} level={0} onTaskClick={onTaskClick} onGoToParent={onGoToParent} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 opacity-20">
            <LayoutGrid size={48} className="mb-2" />
            <span className="text-sm font-bold uppercase tracking-widest">Lista Vazia</span>
        </div>
      )}

      {completedTasks.length > 0 && (
        <CollapsibleSection title={`Concluídas (${completedTasks.length})`} defaultCollapsed={true}>
          <div className="space-y-6 mt-6 opacity-60 hover:opacity-100 transition-opacity">
            {completedTasks.map(task => (
             <TaskListItem key={task.id} task={task} level={0} onTaskClick={onTaskClick} onGoToParent={onGoToParent} />
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
};

export default ListView;
