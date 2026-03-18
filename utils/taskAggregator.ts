import { Task } from '../types';

interface AggregatedData {
    rootTasks: Task[];
    allTasksMap: Map<string, Task>;
}

// Helper to create a valid Date object from various formats
const createValidDate = (dateStr: any): Date | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
};

export const aggregateTasks = (rawData: Task[]): AggregatedData => {
    const taskMap = new Map<string, Task[]>();

    // 1. Group all tasks by ID
    rawData.forEach(row => {
        if (!row.id) return;
        const taskEvents = taskMap.get(row.id) || [];
        taskEvents.push(row);
        taskMap.set(row.id, taskEvents);
    });

    const latestStatesMap = new Map<string, Task>();

    // 2. Map groups to latest state and history
    taskMap.forEach((events, id) => {
        events.sort((a, b) => {
            const dateA = createValidDate(a.date_updated)?.getTime() || createValidDate(a.date_created)?.getTime() || 0;
            const dateB = createValidDate(b.date_updated)?.getTime() || createValidDate(b.date_created)?.getTime() || 0;
            return dateB - dateA;
        });

        const latestState = events[0];
        const history = events.slice(1);
        
        latestStatesMap.set(id, { ...latestState, history, subtasks: [] });
    });

    const rootTasks: Task[] = [];
    
    // 3. Build hierarchy
    latestStatesMap.forEach(task => {
        if (task.parent && latestStatesMap.has(task.parent)) {
            const parent = latestStatesMap.get(task.parent);
            if (parent) {
                if (!parent.subtasks) parent.subtasks = [];
                parent.subtasks.push(task);
            }
        } else {
            rootTasks.push(task);
        }
    });

    return { rootTasks, allTasksMap: latestStatesMap };
};
