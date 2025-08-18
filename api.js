// Arquivo: api.js

import { supabase } from './supabaseClient.js';

// --- FUNÇÕES DE PROJETO (OBRAS) ---
export async function fetchProjects(searchTerm, user) {
    if (!user) return [];
    let query;

    if (user.is_admin) {
        query = supabase.from('projects').select('*, client:clients(name), profile:profiles(nome)');
    } else {
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
export async function fetchProjectById(projectId) {
    const { data, error } = await supabase.from('projects').select('*').eq('id', projectId).single();
    if (error) console.error('Erro ao buscar projeto por ID:', error.message);
    return data;
}
export async function saveProject(projectData, projectId) {
    let result;
    if (!projectId && !projectData.project_code) {
        const { count } = await supabase.from('projects').select('*', { count: 'exact', head: true });
        projectData.project_code = `OBRA-${String((count || 0) + 1).padStart(4, '0')}`;
    }
    if (projectId) {
        result = await supabase.from('projects').update(projectData).eq('id', projectId).select().single();
    } else {
        result = await supabase.from('projects').insert(projectData).select().single();
    }
    return result;
}
export async function deleteProject(projectId) {
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    return { error };
}
export async function transferProjectClient(projectId, newClientId) {
    const { error } = await supabase.from('projects').update({ client_id: newClientId }).eq('id', projectId);
    return { error };
}
export async function transferProjectOwner(projectId, newOwnerId) {
    const { error } = await supabase.from('projects').update({ owner_id: newOwnerId }).eq('id', projectId);
    return { error };
}


// --- FUNÇÕES DE CLIENTE ---
export async function fetchClients(searchTerm, user) {
    if (!user) return [];
    let query;
    if (user.is_admin) {
        query = supabase.from('clients').select('*');
    } else {
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
    if (!clientId && !clientData.client_code) {
        const { count } = await supabase.from('clients').select('*', { count: 'exact', head: true });
        clientData.client_code = `CLI-${String((count || 0) + 1).padStart(4, '0')}`;
    }
    if (clientId) {
        result = await supabase.from('clients').update(clientData).eq('id', clientId).select().single();
    } else {
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
    const { error: deleteError } = await supabase.from('client_user_permissions').delete().eq('client_id', clientId);
    if (deleteError) return { error: deleteError };

    if (userIds.length > 0) {
        const newPermissions = userIds.map(userId => ({ client_id: clientId, user_id: userId }));
        const { error: insertError } = await supabase.from('client_user_permissions').insert(newPermissions);
        return { error: insertError };
    }
    return { error: null };
}

// --- FUNÇÕES DE USUÁRIO ---
export async function fetchAllUsers() {
    const { data, error } = await supabase.from('profiles').select('*').order('nome');
    if (error) console.error('Erro ao buscar usuários:', error.message);
    return data || [];
}
export async function approveUser(userId) {
    const { error } = await supabase.from('profiles').update({ is_approved: true }).eq('id', userId);
    return { error };
}
export async function updateUserProfile(userId, profileData) {
    const { error } = await supabase.from('profiles').update(profileData).eq('id', userId);
    return { error };
}


// --- FUNÇÃO PARA BUSCAR DADOS TÉCNICOS ---
export async function fetchTechnicalData() {
    try {
        const [disjuntoresRes, cabosRes, eletrodutosRes, k1Res, k2Res, k3Res] = await Promise.all([
            supabase.from('disjuntores').select('*'),
            supabase.from('cabos').select('*'),
            supabase.from('eletrodutos').select('*'),
            supabase.from('fatores_k1_temperatura').select('*'),
            supabase.from('fatores_k2_solo').select('*'),
            supabase.from('fatores_k3_agrupamento').select('*')
        ]);

        const errors = [disjuntoresRes, cabosRes, eletrodutosRes, k1Res, k2Res, k3Res].map(res => res.error).filter(Boolean);
        if (errors.length > 0) {
            throw new Error('Falha ao buscar dados técnicos: ' + errors.map(e => e.message).join(', '));
        }

        return {
            disjuntores: disjuntoresRes.data,
            cabos: cabosRes.data,
            eletrodutos: eletrodutosRes.data,
            fatores_k1: k1Res.data,
            fatores_k2: k2Res.data,
            fatores_k3: k3Res.data,
        };
    } catch (error) {
        console.error(error.message);
        alert(error.message);
        return null;
    }
}