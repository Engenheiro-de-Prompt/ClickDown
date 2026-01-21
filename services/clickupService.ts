import { Team, Space, Folder, List, Task } from '../types';

const BASE_URL = 'https://api.clickup.com/api/v2';

export class ClickUpService {
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    private async fetch(endpoint: string): Promise<any> {
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            headers: {
                'Authorization': this.apiKey,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ err: response.statusText }));
            throw new Error(error.err || 'Falha na comunicação com o ClickUp');
        }

        return response.json();
    }

    async getTeams(): Promise<{ teams: Team[] }> { return this.fetch('/team'); }
    async getSpaces(teamId: string): Promise<{ spaces: Space[] }> { return this.fetch(`/team/${teamId}/space`); }
    async getFolders(spaceId: string): Promise<{ folders: Folder[] }> { return this.fetch(`/space/${spaceId}/folder`); }
    async getLists(folderId: string): Promise<{ lists: List[] }> { return this.fetch(`/folder/${folderId}/list`); }
    async getFolderlessLists(spaceId: string): Promise<{ lists: List[] }> { return this.fetch(`/space/${spaceId}/list`); }

    async getTasks(listId: string, onProgress: (progress: { page: number; count: number; status: string }) => void = () => { }): Promise<Task[]> {
        if (!listId) throw new Error('ID da Lista inválido ou não fornecido.');

        let tasks: Task[] = [];

        // true = archived, false = active (plus closed if include_closed=true)
        const states = [false, true];

        for (const isArchived of states) {
            let page = 0;
            let hasMore = true;

            while (hasMore) {
                const result = await this.fetch(`/list/${listId}/task?page=${page}&include_markdown_description=true&subtasks=true&include_closed=true&archived=${isArchived}`);

                if (result.tasks && result.tasks.length > 0) {
                    // Enrich with Resolved Custom Fields
                    const enriched = result.tasks.map((t: Task) => {
                        if (t.custom_fields) {
                            t.custom_fields.forEach(f => {
                                f.value = this.resolveCustomFieldValue(f);
                            });
                        }
                        return t;
                    });

                    tasks = tasks.concat(enriched);

                    onProgress({
                        page: page + 1,
                        count: tasks.length,
                        status: isArchived ? 'Buscando Arquivados...' : 'Buscando Ativos...'
                    });

                    hasMore = (result.tasks.length === 100) && (result.last_page !== true);
                    page++;
                } else {
                    hasMore = false;
                }

                if (page > 50) break; // Safety break
            }
        }

        return tasks;
    }

    resolveCustomFieldValue(field: any): any {
        if (field.value === undefined || field.value === null) return '';

        // Handle Dropdowns and Labels (UUID lookup)
        if ((field.type === 'drop_down' || field.type === 'labels') && field.type_config && field.type_config.options) {
            if (Array.isArray(field.value)) {
                return field.value.map((val: any) => {
                    const option = field.type_config.options.find((o: any) => o.id === val || o.orderindex === val);
                    return option ? option.label : val;
                }).join(', ');
            } else {
                const option = field.type_config.options.find((o: any) => o.id === field.value || o.orderindex === field.value);
                return option ? option.label : field.value;
            }
        }

        // Handle Users
        if (field.type === 'users' && Array.isArray(field.value)) {
            return field.value.map((u: any) => u.username || u.id).join(', ');
        }

        // Handle Date
        if (field.type === 'date' && field.value) {
            try {
                const timestamp = parseInt(field.value);
                if (!isNaN(timestamp)) {
                    return new Date(timestamp).toLocaleDateString('pt-BR');
                }
            } catch (e) { return field.value; }
        }

        // Handle Checkbox
        if (field.type === 'checkbox') {
            return field.value === 'true' || field.value === true ? 'Sim' : 'Não';
        }

        // Handle Rating
        if (field.type === 'rating' && field.type_config?.count) {
            return `${field.value}/${field.type_config.count}`;
        }

        // Handle Location
        if (field.type === 'location' && field.value?.formatted_address) {
            return field.value.formatted_address;
        }

        // Handle Relationships and Tasks
        if ((field.type === 'list_relationship' || field.type === 'task_relationship') && Array.isArray(field.value)) {
            return field.value.map((t: any) => t.name || t.id).join(', ');
        }

        // Handle Object values (fallback)
        if (typeof field.value === 'object' && !Array.isArray(field.value)) {
            return field.value.name || field.value.label || field.value.value || JSON.stringify(field.value);
        }

        return field.value;
    }

    async getAllWorkspaceTasks(teamId: string, onProgress: (progress: { status: string }) => void = () => { }): Promise<Task[]> {
        let allTasks: Task[] = [];

        // 1. Get Spaces
        const { spaces } = await this.getSpaces(teamId);

        for (let i = 0; i < spaces.length; i++) {
            const space = spaces[i];
            onProgress({ status: `Explorando Espaço: ${space.name} (${i + 1}/${spaces.length})` });

            // 2. Get Folderless Lists
            try {
                const { lists: folderless } = await this.getFolderlessLists(space.id);
                for (const list of folderless) {
                    try {
                        const tasks = await this.getTasks(list.id, (p) => {
                            onProgress({ status: `Espaço: ${space.name} > Lista: ${list.name} (${p.count} tarefas)` });
                        });
                        // Enriched with context
                        tasks.forEach(t => {
                            t.context_space = space.name;
                            t.context_list = list.name;
                            t.context_folder = '(Sem Pasta)';
                        });
                        allTasks = allTasks.concat(tasks);
                    } catch (e) {
                        console.error(`Skipping list ${list.name}`, e);
                    }
                }
            } catch (e) { console.error(`Error fetching folderless lists for space ${space.name}`, e); }

            // 3. Get Folders
            try {
                const { folders } = await this.getFolders(space.id);
                for (const folder of folders) {
                    const { lists } = await this.getLists(folder.id);

                    for (const list of lists) {
                        try {
                            const tasks = await this.getTasks(list.id, (p) => {
                                onProgress({ status: `Pasta: ${folder.name} > Lista: ${list.name} (${p.count} tarefas)` });
                            });
                            // Enriched with context
                            tasks.forEach(t => {
                                t.context_space = space.name;
                                t.context_list = list.name;
                                t.context_folder = folder.name;
                            });
                            allTasks = allTasks.concat(tasks);
                        } catch (e) {
                            console.error(`Skipping list ${list.name}`, e);
                        }
                    }
                }
            } catch (e) { console.error(`Error fetching folders for space ${space.name}`, e); }
        }

        return allTasks;
    }
}