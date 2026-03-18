import { Task, User, Tag, Status } from '../types';

interface ApiResponse {
    status: string;
    data?: any;
    tasks?: any[]; // For ClickDown Bridge.gs compatibility
    message?: string;
}

// Helper to get the first non-empty value from a list of possible keys
const coalesce = (obj: any, keys: string[]): any => {
    for (const key of keys) {
        const value = obj[key];
        if (value !== undefined && value !== null && value !== '') {
            return value;
        }
    }
    return undefined;
};

// Normalizes various input types (string, array, array-like string) into a clean string array.
const normalizeToArray = (...values: any[]): string[] => {
    const result = new Set<string>();
    values.flat().forEach(value => {
        if (!value) return;

        let items: string[] = [];
        if (Array.isArray(value)) {
            items = value.map(String).filter(Boolean);
        } else if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                const content = trimmed.substring(1, trimmed.length - 1);
                items = content.split(',').map(s => s.replace(/"/g, '').trim()).filter(Boolean);
            } else {
                items = trimmed.split(',').map(s => s.trim()).filter(Boolean);
            }
        }
        items.forEach(item => result.add(item));
    });
    return Array.from(result);
};

const normalizePriority = (value: any): { priority: string; color: string } => {
    const priorityMap: { [key: string]: { priority: string; color: string } } = {
        '1': { priority: 'urgent', color: '#f87171' },
        '1.0': { priority: 'urgent', color: '#f87171' },
        'Urgente': { priority: 'urgent', color: '#f87171' },
        '2': { priority: 'high', color: '#fbbf24' },
        '2.0': { priority: 'high', color: '#fbbf24' },
        'Alta': { priority: 'high', color: '#fbbf24' },
        '3': { priority: 'normal', color: '#60a5fa' },
        '3.0': { priority: 'normal', color: '#60a5fa' },
        'Normal': { priority: 'normal', color: '#60a5fa' },
        'Média': { priority: 'normal', color: '#60a5fa' },
        '4': { priority: 'low', color: '#94a3b8' },
        '4.0': { priority: 'low', color: '#94a3b8' },
        'Baixa': { priority: 'low', color: '#94a3b8' }
    };
    const stringValue = String(value);
    return priorityMap[stringValue] || { priority: stringValue || 'normal', color: '#60a5fa' };
};

const normalizeStatus = (value: any): Status => {
    // Simple mapping, can be expanded
    return {
        status: String(value || 'Open'),
        color: '#888',
        type: 'custom',
        orderindex: 0
    };
};

const parseDate = (value: any): string => {
    if (!value) return '';
    const date = new Date(value);
    if (!isNaN(date.getTime())) return date.getTime().toString();
    return String(value);
};

export const normalizeTask = (rawTask: any): Task => {
    const id = coalesce(rawTask, ['id', 'Task_ID', 'Task ID.1', 'ID']);
    const name = coalesce(rawTask, ['name', 'Task_Name', 'Task Name', 'Nome']);
    
    const assigneesRaw = normalizeToArray(coalesce(rawTask, ['assignees', 'Assignees', 'Responsáveis']));
    const assignees: User[] = assigneesRaw.map((u, i) => ({
        id: i,
        username: u,
        email: '',
        color: '#0ea5e9'
    }));

    const tagsRaw = normalizeToArray(
        coalesce(rawTask, ['tags', 'Tags', 'Tags_estrutura', 'Tags_horas']),
        coalesce(rawTask, ['Projeto', 'Cliente', 'Processo Geral', 'Processos', 'Processo 2', 'Estratégico vs Operacional', 'Tipo de Atividade', 'IA / DEV'])
    );
    const tags: Tag[] = tagsRaw.map(t => ({ name: t, tag_fg: '#fff', tag_bg: '#334155' }));

    return {
        ...rawTask,
        id: id,
        name: name,
        description: coalesce(rawTask, ['description', 'Task_Content', 'Task Content', 'Descrição', 'text_content']),
        status: normalizeStatus(coalesce(rawTask, ['status', 'Status', 'Task Status', 'Section Column'])),
        priority: normalizePriority(coalesce(rawTask, ['priority', 'Priority', 'Prioridade'])),
        due_date: parseDate(coalesce(rawTask, ['due_date', 'Due_Date', 'Due Date', 'Due Date_estrutura', 'Due Date_horas', 'Data de Entrega'])),
        date_created: parseDate(coalesce(rawTask, ['date_created', 'Date_Created', 'Date Created', 'Date Created_estrutura', 'Date Created_horas', 'Criado em'])),
        date_updated: parseDate(coalesce(rawTask, ['date_updated', 'Last_Modified', 'Atualizado em'])),
        context_space: coalesce(rawTask, ['context_space', 'Space_Name', 'Space Name', 'Espaço', 'Nome do Espaço']),
        context_folder: coalesce(rawTask, ['context_folder', 'Folder_Name', 'Folder Name', 'Pasta']),
        context_list: coalesce(rawTask, ['context_list', 'List_Name', 'List Name', 'Lista']),
        parent: coalesce(rawTask, ['parent', 'Parent_Task_ID', 'Parent ID', 'Parent Task ID', 'Parent Task']),
        assignees: assignees,
        tags: tags,
        list: { id: 'sheet', name: coalesce(rawTask, ['List_Name', 'Lista']) || 'Sheet List', access: true }
    };
};

export class SheetService {
    static async fetchData(webhook: { url: string }, action: string = 'read'): Promise<Task[]> {
        const url = webhook.url;
        // Support both op=read (Bridge.gs) and action=GET_DATA (Piloto apps script)
        const finalUrl = url.includes('?') ? `${url}&op=${action}&action=${action === 'read' ? 'GET_DATA' : action}` : `${url}?op=${action}&action=${action === 'read' ? 'GET_DATA' : action}`;
        
        const response = await fetch(finalUrl, { 
            method: 'GET',
            redirect: "follow",
            mode: 'cors'
        });

        if (!response.ok) {
            throw new Error(`Erro ao conectar com a Planilha: ${response.statusText}`);
        }

        const result: ApiResponse = await response.json();
        const rawTasks = result.data || result.tasks || (Array.isArray(result) ? result : []);
        
        return rawTasks.map((t: any) => ({
            ...normalizeTask(t),
            webhookUrl: url,
            webhookId: (webhook as any).id,
            webhookName: (webhook as any).name
        }));
    }

    static async updateTask(task: Task, updates: any): Promise<void> {
        if (!task.webhookUrl) return;
        
        await fetch(task.webhookUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'update_task',
                id: task.id,
                sheet_row_index: task.sheet_row_index,
                updates: updates,
                taskData: { ...updates, Task_ID: task.id }
            })
        });
    }

    static async createTask(webhookUrl: string, taskData: Partial<Task>): Promise<void> {
        await fetch(webhookUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'create_task',
                ...taskData,
                Task_Name: taskData.name,
                Task_Content: taskData.description
            })
        });
    }

    static async renameStructure(webhookUrl: string, payload: any): Promise<void> {
        await fetch(webhookUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'RENAME_STRUCTURE',
                ...payload
            })
        });
    }

    static async deleteStructure(webhookUrl: string, payload: any): Promise<void> {
        await fetch(webhookUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'DELETE_STRUCTURE',
                ...payload
            })
        });
    }
}
