export interface User {
    id: number;
    username: string;
    email: string;
    color: string;
}

export interface Status {
    status: string;
    color: string;
    type: string;
    orderindex: number;
}

export interface Tag {
    name: string;
    tag_fg: string;
    tag_bg: string;
}

export interface CustomField {
    id: string;
    name: string;
    type: string;
    type_config?: any;
    date_created?: string;
    hide_from_guests?: boolean;
    value?: any;
    required?: boolean;
}

export interface Task {
    id: string;
    custom_id?: string;
    name: string;
    text_content?: string;
    description?: string;
    status: Status;
    orderindex: string;
    date_created: string;
    date_updated: string;
    date_closed?: string;
    date_done?: string;
    creator: User;
    assignees: User[];
    checklists: any[];
    tags: Tag[];
    parent?: string;
    priority?: {
        priority: string;
        color: string;
    };
    due_date?: string;
    start_date?: string;
    points?: number;
    time_estimate?: number;
    time_spent?: number;
    custom_fields?: CustomField[];
    dependencies?: any[];
    linked_tasks?: any[];
    team_id: string;
    url: string;
    permission_level?: string;
    list: { id: string; name: string; access: boolean };
    project?: { id: string; name: string; hidden: boolean; access: boolean };
    folder?: { id: string; name: string; hidden: boolean; access: boolean };
    space?: { id: string; name: string };
    // Augmented fields for UI
    context_list?: string;
    context_folder?: string;
    context_space?: string;
}

export interface Team {
    id: string;
    name: string;
    color: string;
    avatar: string;
    members: any[];
}

export interface Space {
    id: string;
    name: string;
    private: boolean;
    statuses: Status[];
}

export interface Folder {
    id: string;
    name: string;
    hidden: boolean;
    space: { id: string; name: string; access: boolean };
}

export interface List {
    id: string;
    name: string;
    folder?: { id: string; name: string; hidden: boolean; access: boolean };
}

export interface HierarchyState {
    teams: Team[];
    selectedTeam: string | null;
    spaces: Space[];
    selectedSpace: string | null;
    folders: Folder[];
    selectedFolder: string | null;
    lists: List[];
    selectedList: string | null;
    extractionMode: 'list' | 'workspace' | null;
}