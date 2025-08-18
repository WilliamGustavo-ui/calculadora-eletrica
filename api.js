import { supabase } from './supabaseClient.js';

// --- FUNÇÕES DE PROJETO (OBRAS) ---
export async function fetchProjects(searchTerm, user) {
    if (!user) return [];
    let query;

    if (user.is_admin) {
        // Admin vê todos os projetos
        query = supabase.from('projects').select('*, client:clients(name), profile:profiles(nome)');
    } else {
        // Usuário comum vê apenas projetos de clientes aos quais ele tem acesso
        const { data: permissions, error: permError } = await supabase
            .from('client_user_permissions')
            .select('client_id')
            .eq('user_id', user.id);
        
        if (permError) {
            console.error("Erro ao buscar permissões:", permError);
            return [];
        }
        const accessibleClientIds = permissions.map(p => p.client_id);
        query = supabase.from('projects').select('*, client:clients(name), profile:profiles(nome)').in('client_id', accessibleClientIds);
    }
    
    if (searchTerm) {
        query = query.or(`project_name.ilike.%${searchTerm}%,project_code.ilike.%${searchTerm}%`);
    }
    const { data, error } = await query.order('project_name');
    
    if (error) console.error('Erro ao buscar projetos:', error);
    return data || [];
}
export async function fetchProjectById(projectId) { /* ...código existente... */ }
export async function saveProject(projectData, projectId) {
    // Lógica para gerar código da obra se for um novo projeto
    if (!projectId && !projectData.project_code) {
        const { count } = await supabase.from('projects').select('*', { count: 'exact', head: true });
        projectData.project_code = `OBRA-${String((count || 0) + 1).padStart(4, '0')}`;
    }
    // ...resto da função saveProject existente...
}
export async function deleteProject(projectId) { /* ...código existente... */ }
export async function transferProjectClient(projectId, newClientId) {
    const { error } = await supabase.from('projects').update({ client_id: newClientId }).eq('id', projectId);
    return { error };
}


// --- FUNÇÕES DE CLIENTE ---
export async function fetchClients(searchTerm, user) {
    if (!user) return [];
    let query;
    if (user.is_admin) {
        query = supabase.from('clients').select('*');
    } else {
        // Junta com a tabela de permissões para pegar apenas os clientes permitidos
        const { data: permissions, error: permError } = await supabase
            .from('client_user_permissions')
            .select('client_id')
            .eq('user_id', user.id);
        
        if (permError) {
            console.error("Erro ao buscar permissões:", permError);
            return [];
        }
        const accessibleClientIds = permissions.map(p => p.client_id);
        query = supabase.from('clients').select('*').in('id', accessibleClientIds);
    }

    if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,document_number.ilike.%${searchTerm}%,client_code.ilike.%${searchTerm}%`);
    }
    const { data, error } = await query.order('name');
    if (error) console.error('Erro ao buscar clientes:', error);
    return data || [];
}

export async function saveClient(clientData, clientId) {
    let result;
    if (clientId) {
        result = await supabase.from('clients').update(clientData).eq('id', clientId).select().single();
    } else {
        // Gera código do cliente
        const { count } = await supabase.from('clients').select('*', { count: 'exact', head: true });
        clientData.client_code = `CLI-${String((count || 0) + 1).padStart(4, '0')}`;
        result = await supabase.from('clients').insert(clientData).select().single();
    }
    return result;
}

export async function deleteClient(clientId) {
    const { error } = await supabase.from('clients').delete().eq('id', clientId);
    return { error };
}

// --- FUNÇÕES DE PERMISSÃO (ADMIN) ---
export async function getClientUserPermissions(clientId) {
    const { data, error } = await supabase.from('client_user_permissions').select('user_id').eq('client_id', clientId);
    if (error) console.error('Erro ao buscar permissões do cliente:', error);
    return data?.map(p => p.user_id) || [];
}

export async function updateClientUserPermissions(clientId, userIds) {
    // 1. Deleta todas as permissões existentes para este cliente
    const { error: deleteError } = await supabase.from('client_user_permissions').delete().eq('client_id', clientId);
    if (deleteError) return { error: deleteError };

    // 2. Insere as novas permissões
    if (userIds.length > 0) {
        const newPermissions = userIds.map(userId => ({ client_id: clientId, user_id: userId }));
        const { error: insertError } = await supabase.from('client_user_permissions').insert(newPermissions);
        return { error: insertError };
    }
    return { error: null };
}

// --- FUNÇÕES DE USUÁRIO (Existentes) ---
export async function fetchAllUsers() { /* ...código existente... */ }
export async function approveUser(userId) { /* ...código existente... */ }
export async function updateUserProfile(userId, data) { /* ...código existente... */ }
// ... e o resto das suas funções de API ...