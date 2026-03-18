import React from 'react';
import { Task } from '../types';
import { UserIcon, CalendarIcon, TagIcon, ClockIcon, ParentTaskIcon, SubtaskIcon, RecurrenceIcon } from './Icons';
import { createValidDate } from '../utils/dateUtils';
import { formatRuleToString } from '../utils/recurrenceUtils';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  onGoToParent?: (parentId: string) => void;
}

const PriorityPill: React.FC<{ priority?: string }> = ({ priority }) => {
    if (!priority) return null;
    const colors: { [key: string]: string } = {
        'urgent': 'bg-red-900/50 text-red-300 border border-red-700/50',
        'high': 'bg-orange-900/50 text-orange-300 border border-orange-700/50',
        'normal': 'bg-blue-900/50 text-blue-300 border border-blue-700/50',
        'low': 'bg-slate-900/50 text-slate-300 border border-slate-700/50'
    };
    return <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded-full border ${colors[priority.toLowerCase()] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>{priority}</span>
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onClick, onGoToParent }) => {
  const validDueDate = createValidDate(task.due_date);
  const recurrenceSummary = task.recurrence ? formatRuleToString(task.recurrence) : null;

  return (
    <div onClick={onClick} className="group bg-slate-900/80 rounded-xl border border-slate-800 p-4 cursor-pointer hover:border-brand-500/50 hover:bg-slate-800 transition-all duration-200 shadow-lg hover:shadow-brand-500/10">
      <div className="flex justify-between items-start gap-2">
        <h4 className="font-semibold text-slate-200 text-sm leading-tight group-hover:text-white transition-colors">{task.name}</h4>
        <PriorityPill priority={task.priority?.priority}/>
      </div>
      
      {task.description && (
        <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">{task.description}</p>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {/* Badges Row 1 */}
        <div className="flex items-center flex-wrap gap-2 text-[10px] text-slate-400 font-medium">
            {task.assignees && task.assignees.length > 0 && (
                <div className="flex -space-x-2">
                  {task.assignees.slice(0, 3).map((u, i) => (
                    <div key={i} className="w-5 h-5 rounded-full bg-slate-700 border border-slate-950 flex items-center justify-center text-[8px] text-white uppercase" title={u.username}>
                      {u.username.substring(0, 2)}
                    </div>
                  ))}
                  {task.assignees.length > 3 && (
                    <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-950 flex items-center justify-center text-[8px] text-slate-400">
                      +{task.assignees.length - 3}
                    </div>
                  )}
                </div>
            )}
            
            {validDueDate && (
                <div className="flex items-center bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    <CalendarIcon className="w-3 h-3 mr-1 text-slate-500"/>
                    <span>{validDueDate.toLocaleDateString()}</span>
                </div>
            )}

            {task.time_spent && task.time_spent > 0 && (
                <div className="flex items-center bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                    <ClockIcon className="w-3 h-3 mr-1"/>
                    <span>{(task.time_spent / 3600000).toFixed(1)}h</span>
                </div>
            )}
        </div>

        {/* Badges Row 2 */}
        <div className="flex items-center justify-between border-t border-slate-800/50 pt-3">
            <div className="flex items-center gap-2">
                {recurrenceSummary && (
                    <div className="p-1 rounded bg-cyan-500/10 text-cyan-400" title={recurrenceSummary}>
                        <RecurrenceIcon className="w-3 h-3" />
                    </div>
                )}
                {task.parent && onGoToParent && (
                    <button
                        title="Ir para a tarefa pai"
                        onClick={(e) => { e.stopPropagation(); onGoToParent(task.parent!); }}
                        className="p-1 rounded bg-slate-800 text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
                    >
                        <ParentTaskIcon className="w-3 h-3" />
                    </button>
                )}
                {task.subtasks && task.subtasks.length > 0 && (
                    <div className="flex items-center text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20" title={`${task.subtasks.length} subtarefas`}>
                        <SubtaskIcon className="w-3 h-3 mr-1" />
                        <span>{task.subtasks.length}</span>
                    </div>
                )}
            </div>

            {task.tags && task.tags.length > 0 && (
                <div className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/50 text-slate-500 italic">
                    #{task.tags[0].name}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
