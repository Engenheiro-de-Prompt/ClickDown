import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Task, ColumnConfig } from '../types';
import { 
    ChevronDownIcon, ChevronUpIcon, ChevronRightIcon, SettingsIcon, 
    SearchIcon, FilterIcon, DownloadIcon, SaveIcon,
    PlusIcon, XIcon, X, UserIcon, CalendarIcon, TagIcon,
    RecurrenceIcon, ParentTaskIcon, SubtaskIcon, TableIcon as Table
} from './Icons';
import CollapsibleSection from './CollapsibleSection';
import { createValidDate, formatDateForInput } from '../utils/dateUtils';
import { formatRuleToString } from '../utils/recurrenceUtils';
import ColumnConfigModal from './ColumnConfigModal';

interface EditingCellProps {
  task: Task;
  columnKey: string;
  config: ColumnConfig;
  onSave: (task: Task, columnKey: string, newValue: any) => void;
  onCancel: () => void;
}

const EditingCell: React.FC<EditingCellProps> = ({ task, columnKey, config, onSave, onCancel }) => {
  // Safe access to task properties
  const getInitialValue = () => {
    if (columnKey === 'status') return task.status.status;
    if (columnKey === 'priority') return task.priority?.priority;
    if (columnKey === 'assignees') return task.assignees.map(u => u.username).join(', ');
    if (columnKey === 'tags') return task.tags.map(t => t.name).join(', ');
    return (task as any)[columnKey];
  };

  const [currentValue, setCurrentValue] = useState(getInitialValue());
  
  const handleSave = () => {
    onSave(task, columnKey, currentValue);
  };
  
  const commonProps = {
    value: currentValue ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setCurrentValue(e.target.value),
    onBlur: handleSave,
    onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') onCancel();
    },
    autoFocus: true,
    className: "w-full h-full px-2 py-1 bg-slate-950 border border-brand-500 rounded-lg text-slate-200 text-xs outline-none focus:ring-2 focus:ring-brand-500/20"
  };
  
  switch (config.format) {
      case 'categorical':
          return (
              <select {...commonProps}>
                  <option value="">Nenhuma</option>
                  {config.options?.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
          );
      case 'date':
          return <input type="date" {...commonProps} value={formatDateForInput(createValidDate(currentValue))}/>
      case 'number':
          return <input type="number" {...commonProps} />
      case 'text':
      default:
          return <input type="text" {...commonProps} />;
  }
};


interface TableViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onUpdateTask: (task: Task, updates: any) => void;
  allStatuses: string[];
  allPriorities: string[];
  showCompletedToggle?: boolean;
  onGoToParent?: (parentId: string) => void;
}

type SortKey = keyof Task | string;
type SortDirection = 'asc' | 'desc';

const priorityOrder: { [key: string]: number } = {
  'urgent': 4,
  'high': 3,
  'normal': 2,
  'low': 1,
};

const STANDARD_FIELDS = new Set(['id', 'name', 'status', 'priority', 'assignees', 'tags', 'due_date', 'date_created', 'date_updated', 'parent', 'subtasks', 'description', 'time_spent', 'recurrence']);

const TableView: React.FC<TableViewProps> = ({ tasks, onTaskClick, onUpdateTask, allStatuses, allPriorities, showCompletedToggle = true, onGoToParent }) => {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [editingCell, setEditingCell] = useState<{ taskId: string; columnKey: string } | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  const [columnConfigs, setColumnConfigs] = useState<Record<string, ColumnConfig>>({});
  const [isColumnManagerOpen, setIsColumnManagerOpen] = useState(false);
  const [configuringColumnKey, setConfiguringColumnKey] = useState<string | null>(null);
  const columnManagerRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    const defaultVisible = ['name', 'status', 'priority', 'assignees', 'due_date'];
    
    const allKeys = new Set<string>(['name', 'status', 'priority', 'assignees', 'due_date', 'context_space', 'context_folder', 'context_list', 'tags', 'time_spent', 'description']);
    tasks.forEach(task => {
        Object.keys(task).forEach(key => {
            if (!STANDARD_FIELDS.has(key) && !key.startsWith('context_') && !key.startsWith('sheet_') && !key.startsWith('webhook')) {
                allKeys.add(key);
            }
        });
    });

    setColumnConfigs(prev => {
        const newConfigs: Record<string, ColumnConfig> = { ...prev };
        allKeys.forEach(key => {
            if (!newConfigs[key]) {
                 newConfigs[key] = {
                    key,
                    label: key.replace(/_/g, ' '),
                    isVisible: defaultVisible.includes(key),
                    format: 'text',
                 }
            }
            // Set smart defaults
            if (key === 'status' && !newConfigs[key].options) {
                newConfigs[key].format = 'categorical';
                newConfigs[key].options = allStatuses;
            }
            if (key === 'priority' && !newConfigs[key].options) {
                newConfigs[key].format = 'categorical';
                newConfigs[key].options = allPriorities;
            }
            if (key === 'due_date' && newConfigs[key].format === 'text') {
                newConfigs[key].format = 'date';
            }
        });
        return newConfigs;
    });
  }, [tasks, allStatuses, allPriorities]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnManagerRef.current && !columnManagerRef.current.contains(event.target as Node)) {
        setIsColumnManagerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const visibleColumns = useMemo(() => {
      return Object.values(columnConfigs).filter((c: ColumnConfig) => c.isVisible).map((c: ColumnConfig) => c.key);
  }, [columnConfigs]);
  
  const { completedTasks, activeTasks } = useMemo(() => {
      return {
          completedTasks: tasks.filter(t => (t.status.status.toLowerCase().includes('concl') || t.status.status.toLowerCase().includes('clos'))),
          activeTasks: tasks.filter(t => !(t.status.status.toLowerCase().includes('concl') || t.status.status.toLowerCase().includes('clos')))
      };
  }, [tasks]);

  const sortedTasks = useMemo(() => {
    const tasksToSort = showCompletedToggle ? activeTasks : tasks;
    if (!sortKey) return tasksToSort;
    
    return [...tasksToSort].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortKey === 'status') {
          aValue = a.status.status;
          bValue = b.status.status;
      } else if (sortKey === 'priority') {
          aValue = a.priority?.priority;
          bValue = b.priority?.priority;
      } else {
          aValue = (a as any)[sortKey];
          bValue = (b as any)[sortKey];
      }
      
      if (sortKey === 'priority') {
        const aPriority = priorityOrder[String(aValue).toLowerCase()] || 0;
        const bPriority = priorityOrder[String(bValue).toLowerCase()] || 0;
        return sortDirection === 'asc' ? aPriority - bPriority : bPriority - aPriority;
      }

      if (aValue == null) return 1;
      if (bValue == null) return -1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [activeTasks, tasks, showCompletedToggle, sortKey, sortDirection]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };
  
  const handleCellSave = (task: Task, columnKey: string, newValue: any) => {
    const updates: any = {};
    const config = columnConfigs[columnKey];

    if (columnKey === 'status') {
        updates.status = newValue;
    } else if (columnKey === 'priority') {
        updates.priority = newValue;
    } else if (columnKey === 'assignees') {
        // Simple string update for now, or could map back to User objects
        updates.assignees_usernames = newValue;
    } else if (columnKey === 'tags') {
        updates.tags_names = newValue;
    } else if (config && config.format === 'date' && newValue) {
        updates[columnKey] = new Date(`${newValue}T12:00:00`).getTime().toString();
    } else {
        updates[columnKey] = newValue;
    }
    
    onUpdateTask(task, updates);
    setEditingCell(null);
  };
  
  const handleToggleColumn = (columnKey: string) => {
    setColumnConfigs(prev => ({
        ...prev,
        [columnKey]: { ...prev[columnKey], isVisible: !prev[columnKey].isVisible }
    }));
  };

  const renderCellContent = (task: Task, columnKey: string) => {
    if (columnKey === 'status') {
        return (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase border" 
                  style={{ color: task.status.color, borderColor: task.status.color + '40', backgroundColor: task.status.color + '10' }}>
                {task.status.status}
            </span>
        );
    }
    
    if (columnKey === 'priority') {
        if (!task.priority) return <span className="text-slate-600">-</span>;
        return (
            <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: task.priority.color }}></div>
                <span className="capitalize">{task.priority.priority}</span>
            </div>
        );
    }

    if (columnKey === 'assignees') {
        return (
            <div className="flex -space-x-1">
                {task.assignees.map((u, i) => (
                    <div key={i} className="w-5 h-5 rounded-full bg-slate-800 border border-slate-950 flex items-center justify-center text-[8px] text-white uppercase" title={u.username}>
                        {u.username.substring(0, 2)}
                    </div>
                ))}
                {task.assignees.length === 0 && <span className="text-slate-600">-</span>}
            </div>
        );
    }

    if (columnKey === 'tags') {
        return (
            <div className="flex gap-1 overflow-hidden">
                {task.tags.map((t, i) => (
                    <span key={i} className="text-[10px] text-slate-500 whitespace-nowrap">#{t.name}</span>
                ))}
                {task.tags.length === 0 && <span className="text-slate-600">-</span>}
            </div>
        );
    }

    if (columnKey === 'due_date') {
        const date = createValidDate(task.due_date);
        return date ? date.toLocaleDateString() : <span className="text-slate-600">-</span>;
    }

    if (columnKey === 'time_spent') {
        return task.time_spent ? `${(task.time_spent / 3600000).toFixed(1)}h` : <span className="text-slate-600">-</span>;
    }

    const value = (task as any)[columnKey];
    if (value == null || value === '') return <span className="text-slate-600">-</span>;
    return String(value);
  }

  const toggleRowExpansion = (taskId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const renderRows = (tasksToRender: Task[], level: number): React.ReactNode => {
    return tasksToRender.map(task => {
        const isExpanded = expandedRows.has(task.id);
        const recurrenceSummary = task.recurrence ? formatRuleToString(task.recurrence) : null;

        return (
            <React.Fragment key={task.id}>
                <tr className="bg-slate-900 border-b border-slate-800/50 hover:bg-slate-800/80 transition-colors group">
                    {visibleColumns.map((key, index) => {
                        const isEditing = editingCell?.taskId === task.id && editingCell.columnKey === key;
                        const config = columnConfigs[key];
                        
                        const handleCellClick = () => {
                          if (isEditing || !config) return;
                          if (key === 'name') {
                            onTaskClick(task);
                          } else {
                            setEditingCell({ taskId: task.id, columnKey: key });
                          }
                        };

                        return (
                            <td 
                                key={key} 
                                onClick={handleCellClick}
                                className="px-6 py-3 text-xs text-slate-300 whitespace-nowrap cursor-pointer relative"
                                style={index === 0 ? { paddingLeft: `${1.5 + level * 1.5}rem` } : {}}
                            >
                                <div className="flex items-center min-h-[1.5rem]">
                                    {index === 0 && (
                                        task.subtasks && task.subtasks.length > 0 ? (
                                            <button onClick={(e) => { e.stopPropagation(); toggleRowExpansion(task.id); }} className="mr-2 -ml-1 p-1 text-slate-500 hover:text-white transition-colors">
                                                <ChevronDownIcon size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                            </button>
                                        ) : <div className="w-6 mr-2"></div>
                                    )}
                                    {isEditing && config
                                        ? <EditingCell task={task} columnKey={key} config={config} onSave={handleCellSave} onCancel={() => setEditingCell(null)} /> 
                                        : <div className="truncate group-hover:text-white transition-colors">{renderCellContent(task, key)}</div>
                                    }
                                    {index === 0 && recurrenceSummary && (
                                        <RecurrenceIcon className="w-3.5 h-3.5 ml-2 text-cyan-400 opacity-60" title={recurrenceSummary} />
                                    )}
                                    {index === 0 && task.parent && onGoToParent && (
                                        <button onClick={(e) => { e.stopPropagation(); onGoToParent(task.parent!); }} title="Ir para tarefa pai" className="ml-2 text-slate-600 hover:text-brand-400 transition-colors">
                                            <ParentTaskIcon className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </td>
                        );
                    })}
                </tr>
                {isExpanded && task.subtasks && task.subtasks.length > 0 && renderRows(task.subtasks, level + 1)}
            </React.Fragment>
        );
    });
  };

  const renderTable = (tasksToRender: Task[]) => (
    <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-950/80">
              {visibleColumns.map(key => (
                <th key={key} scope="col" className="px-6 py-4 whitespace-nowrap">
                  <button className="flex items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-slate-300 transition-colors" onClick={() => handleSort(key)}>
                    {columnConfigs[key]?.label || key.replace(/_/g, ' ')}
                    {sortKey === key && (sortDirection === 'asc' ? <ChevronUpIcon size={12} className="ml-1" /> : <ChevronDownIcon size={12} className="ml-1" />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/30">
            {renderRows(tasksToRender, 0)}
            {tasksToRender.length === 0 && (
                <tr className="bg-slate-900">
                    <td colSpan={visibleColumns.length} className="text-center py-16">
                        <div className="flex flex-col items-center opacity-20">
                            <Table size={48} className="mb-2" />
                            <span className="text-xs font-bold uppercase tracking-widest">Nenhuma tarefa encontrada</span>
                        </div>
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
        <div className="flex justify-end">
            <div className="relative" ref={columnManagerRef}>
                <button 
                  onClick={() => setIsColumnManagerOpen(prev => !prev)} 
                  className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-all shadow-lg"
                >
                    <SettingsIcon size={14}/>
                    Colunas
                </button>
                {isColumnManagerOpen && (
                    <div className="absolute right-0 top-full mt-3 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-30 p-5 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Visibilidade das Colunas</h4>
                            <X size={14} className="text-slate-600 cursor-pointer hover:text-white" onClick={() => setIsColumnManagerOpen(false)} />
                        </div>
                        <div className="max-h-64 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
                            {Object.values(columnConfigs).map((config: ColumnConfig) => (
                                <div key={config.key} className="flex items-center justify-between gap-3 p-1.5 hover:bg-slate-800 rounded-lg group transition-colors">
                                    <label className="flex items-center gap-3 flex-grow cursor-pointer">
                                        <div className="relative flex items-center">
                                            <input 
                                                type="checkbox" 
                                                checked={config.isVisible} 
                                                onChange={() => handleToggleColumn(config.key)} 
                                                className="peer appearance-none w-4 h-4 rounded border border-slate-700 bg-slate-950 checked:bg-brand-500 checked:border-brand-500 transition-all cursor-pointer"
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                                            </div>
                                        </div>
                                        <span className="text-xs font-medium text-slate-300 capitalize group-hover:text-white">{config.label}</span>
                                    </label>
                                    <button 
                                      onClick={() => { setConfiguringColumnKey(config.key); setIsColumnManagerOpen(false); }} 
                                      className="p-1.5 text-slate-600 hover:text-brand-400 bg-slate-800/50 hover:bg-slate-800 rounded transition-all opacity-0 group-hover:opacity-100"
                                    >
                                      <SettingsIcon size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>

        {renderTable(sortedTasks)}

        {showCompletedToggle && completedTasks.length > 0 && (
            <CollapsibleSection title={`Concluídas (${completedTasks.length})`} defaultCollapsed>
                {renderTable(completedTasks)}
            </CollapsibleSection>
        )}
        
        {configuringColumnKey && columnConfigs[configuringColumnKey] && (
            <ColumnConfigModal
              columnConfig={columnConfigs[configuringColumnKey]}
              onClose={() => setConfiguringColumnKey(null)}
              onSave={(newConfig) => {
                  setColumnConfigs(prev => ({
                    ...prev,
                    [newConfig.key]: newConfig
                  }));
                  setConfiguringColumnKey(null);
              }}
            />
        )}
    </div>
  );
};

export default TableView;
