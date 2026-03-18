import React, { useMemo } from 'react';
import { Task } from '../types';
import TableView from './TableView';
import { createValidDate } from '../utils/dateUtils';
import CollapsibleSection from './CollapsibleSection';

interface HomePageProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onUpdateTask: (task: Task, updates: any) => void;
  allStatuses: string[];
  allPriorities: string[];
  onGoToParent: (parentId: string) => void;
}

const HomePage: React.FC<HomePageProps> = ({ tasks, onTaskClick, onUpdateTask, allStatuses, allPriorities, onGoToParent }) => {
  const categorizedTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    const overdue: Task[] = [];
    const todayTasks: Task[] = [];
    const upcoming: Task[] = [];
    const noDate: Task[] = [];

    tasks.forEach(task => {
      // Ignora subtarefas na categorização da página inicial para evitar duplicação em visões de seção
      // No ClickDown, usamos 'parent' em vez de 'Parent_Task_ID'
      if(task.parent) return;

      const dueDate = createValidDate(task.due_date);
      
      if (!dueDate) {
        noDate.push(task);
        return;
      }
      
      const taskDueDate = new Date(dueDate);
      taskDueDate.setHours(0, 0, 0, 0);
      const taskDueTime = taskDueDate.getTime();

      // Mapeamento de status para 'Concluído' (ClickDown usa status.status)
      const isCompleted = task.status.status.toLowerCase().includes('concl') || task.status.status.toLowerCase().includes('clos');

      if (!isCompleted && taskDueTime < todayTime) {
        overdue.push(task);
      } else if (taskDueTime === todayTime) {
        todayTasks.push(task);
      } else if (taskDueTime > todayTime) {
        upcoming.push(task);
      } else {
        if (!isCompleted) {
            upcoming.push(task)
        }
      }
    });

    return { overdue, todayTasks, upcoming, noDate };
  }, [tasks]);

  const renderSection = (title: string, taskList: Task[], defaultCollapsed = false) => {
    if (taskList.length === 0) return null;

    return (
      <CollapsibleSection title={`${title} (${taskList.length})`} defaultCollapsed={defaultCollapsed}>
        <div className="mt-4">
          <TableView
            tasks={taskList}
            onTaskClick={onTaskClick}
            onUpdateTask={onUpdateTask}
            allStatuses={allStatuses}
            allPriorities={allPriorities}
            showCompletedToggle={false}
            onGoToParent={onGoToParent}
          />
        </div>
      </CollapsibleSection>
    );
  };

  return (
    <div className="w-full h-full space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-brand-500/10 border border-brand-500/20 p-6 rounded-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-400 mb-1">Para Hoje</p>
              <h4 className="text-3xl font-black text-white">{categorizedTasks.todayTasks.length}</h4>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-400 mb-1">Atrasadas</p>
              <h4 className="text-3xl font-black text-white">{categorizedTasks.overdue.length}</h4>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-1">Próximas</p>
              <h4 className="text-3xl font-black text-white">{categorizedTasks.upcoming.length}</h4>
          </div>
      </div>

      {renderSection("Para Hoje", categorizedTasks.todayTasks, false)}
      {renderSection("Atrasadas", categorizedTasks.overdue, false)}
      {renderSection("Próximas", categorizedTasks.upcoming, true)}
      {renderSection("Sem Data", categorizedTasks.noDate, true)}
    </div>
  );
};

export default HomePage;
