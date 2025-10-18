// Arquivo: api.js (COM NOVAS FUNÇÕES DE BLOQUEIO E EXCLUSÃO)

import { supabase } from './supabaseClient.js';

// --- FUNÇÕES DE CLIENTE ---
export async function fetchClients() {
    const { data, error } = await supabase.from('clients').select('*, projects(id)').order('nome');
    if (error) console.error('Erro ao buscar clientes:', error.message);
    return data || [];
}
export async function addClient(clientData) {
    const { data: codeData, error: codeError } = await supabase.rpc('generate_new_client_code');
    if (codeError) throw codeError;
    clientData.client_code = codeData;
    const { data, error } = await supabase.from('clients').insert(clientData).select().single();
    if (error) console.error('Erro ao adicionar cliente:', error.message);
    return { data, error };
}
export async function updateClient(clientId, clientData) {
    const { data, error } = await supabase.from('clients').update(clientData).eq('id', clientId).select().single();
    if (error) console.error('Erro ao atualizar cliente:', error.message);
    return { data, error };
}
export async function deleteClient(clientId) {
    const { error } = await supabase.from('clients').delete().eq('id', clientId);
    if (error) console.error('Erro ao deletar cliente:', error.message);
    return { error };
}

// --- FUNÇÕES DE PROJETO ---
export async function fetchProjects(searchTerm) {
    let query = supabase.from('projects').select('id, project_name, project_code, owner_id, client_id, client:clients(nome), owner:profiles(nome, email)');
    if (searchTerm) {
        query = query.or(`project_name.ilike.%${searchTerm}%,project_code.ilike.%${searchTerm}%,clients.nome.ilike.%${searchTerm}%`);
    }
    const { data, error } = await query.order('project_name');
    if (error) { console.error('Erro ao buscar projetos:', error.message); alert('Erro ao buscar projetos: ' + error.message); }
    return data || [];
}
export async function fetchProjectById(projectId) {
    const { data, error } = await supabase.from('projects').select('*, client:clients(*)').eq('id', projectId).single();
    if (error) console.error('Erro ao buscar projeto por ID:', error.message);
    return data;
}
export async function saveProject(projectData, projectId) {
    if (!projectId && !projectData.project_code) {
        const { data: codeData, error: codeError } = await supabase.rpc('generate_new_project_code');
        if (codeError) throw codeError;
        projectData.project_code = codeData;
    }
    let result;
    if (projectId) {
        result = await supabase.from('projects').update(projectData).eq('id', projectId).select('*, client:clients(*)').single();
    } else {
        result = await supabase.from('projects').insert(projectData).select('*, client:clients(*)').single();
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
    const { error } = await supabase
        .from('projects')
        .update({ owner_id: newOwnerId })
        .eq('id', projectId);
    if (error) console.error('Erro ao transferir propriedade da obra:', error.message);
    return { error };
}

// --- FUNÇÕES DE ADMINISTRAÇÃO E DADOS ---
export async function fetchAllUsers() {
    const { data, error } = await supabase.from('profiles').select('*').order('nome');
    if (error) console.error('Erro ao buscar todos os usuários:', error.message);
    return data || [];
}
export async function approveUser(userId) {
    const { error } = await supabase.from('profiles').update({ is_approved: true }).eq('id', userId);
    if (error) console.error('Erro ao aprovar usuário:', error.message);
    return { error };
}
export async function updateUserProfile(userId, profileData) {
    const { data, error } = await supabase.from('profiles').update(profileData).eq('id', userId).select().single();
    if (error) console.error('Erro ao atualizar perfil do usuário:', error.message);
    return { data, error };
}
export async function fetchUserById(userId) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error) console.error('Erro ao buscar usuário por ID:', error.message);
    return data;
}

// CORREÇÃO 1: Buscando todos os dados técnicos necessários para o Worker
export async function fetchUiData() {
    const uiData = {};
    
    // Nomes das tabelas no Supabase e a chave que o worker.js espera
    const tablesToFetch = [
        // Tabelas de UI
        { key: 'ar_condicionado_btu', name: 'ar_condicionado_btu' },
        { key: 'motores_cv', name: 'motores_cv' },
        
        // Tabelas de Cálculo (para o worker)
        { key: 'fatores_k1', name: 'fatores_k1_temperatura' },
        { key: 'fatores_k1_epr', name: 'fatores_k1_temperatura_epr' },
        { key: 'fatores_k2', name: 'fatores_k2_solo' },
        { key: 'fatores_k3', name: 'fatores_k3' },
        { key: 'disjuntores', name: 'disjuntores' },
        { key: 'cabos', name: 'cabos' },
        { key: 'eletrodutos', name: 'eletrodutos' },
        { key: 'dps', name: 'dps' }
    ];

    for (const table of tablesToFetch) {
        try {
            const { data, error } = await supabase.from(table.name).select('*');
            if (error) { throw new Error(error.message); }
            uiData[table.key] = data; // Atribui os dados à chave correta
        } catch (err) {
            console.error(`ERRO ao carregar dados da tabela '${table.name}'. Detalhes: ${err.message}`);
            uiData[table.key] = []; // Garante que a chave exista mesmo em caso de falha
        }
    }
    return uiData;
}


// >>>>>>>>>>>> FUNÇÃO ADICIONADA: BLOQUEAR/DESBLOQUEAR USUÁRIO <<<<<<<<<<<<<<
export async function toggleUserBlock(userId, isBlocked) {
    const { error } = await supabase
        .from('profiles')
        .update({ is_blocked: isBlocked })
        .eq('id', userId);
    if (error) console.error(`Erro ao ${isBlocked ? 'bloquear' : 'desbloquear'} usuário:`, error.message);
    return { error };
}

// >>>>>>>>>>>> FUNÇÃO ADICIONADA: EXCLUIR USUÁRIO (chama a Edge Function) <<<<<<<<<<<<<<
export async function deleteUserFromAdmin(userIdToDelete) {
    const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userIdToDelete },
    });
    if (error) console.error('Erro ao chamar a função de exclusão:', error.message);
    return { data, error };
}