// Arquivo: api.js

import { supabase } from './supabaseClient.js';

// --- FUNÇÕES DE CLIENTE ---

export async function fetchClients() {
    const { data, error } = await supabase
        .from('clients')
        .select('*, projects(*)') // Busca clientes e seus projetos vinculados
        .order('nome');
    
    if (error) console.error('Erro ao buscar clientes:', error.message);
    return data || [];
}

export async function addClient(clientData) {
    // 1. Gera o próximo código de cliente usando a função do banco
    const { data: codeData, error: codeError } = await supabase.rpc('generate_new_client_code');
    if (codeError) throw codeError;
    
    clientData.client_code = codeData;

    // 2. Insere o novo cliente com o código gerado
    const { data, error } = await supabase
        .from('clients')
        .insert(clientData)
        .select()
        .single();
    
    if (error) console.error('Erro ao adicionar cliente:', error.message);
    return { data, error };
}

export async function updateClient(clientId, clientData) {
    const { data, error } = await supabase
        .from('clients')
        .update(clientData)
        .eq('id', clientId)
        .select()
        .single();
        
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
    // Busca por nome do projeto, código do projeto ou nome do cliente
    let query = supabase.from('projects').select('id, project_name, project_code, owner_id, client:clients(nome)');
    
    if (searchTerm) {
        query = query.or(`project_name.ilike.%${searchTerm}%,project_code.ilike.%${searchTerm}%,clients.nome.ilike.%${searchTerm}%`);
    }
    
    const { data, error } = await query.order('project_name');
    if (error) console.error('Erro ao buscar projetos:', error.message);
    return data || [];
}

export async function fetchProjectById(projectId) {
    // Busca um projeto e os dados do seu cliente vinculado
    const { data, error } = await supabase
        .from('projects')
        .select('*, client:clients(*)')
        .eq('id', projectId)
        .single();
        
    if (error) console.error('Erro ao buscar projeto por ID:', error.message);
    return data;
}

export async function saveProject(projectData, projectId) {
    // Gera um código de projeto se for um novo projeto
    if (!projectId) {
        const { data: codeData, error: codeError } = await supabase.rpc('generate_new_project_code');
        if (codeError) throw codeError;
        projectData.project_code = codeData;
    }

    let result;
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

// --- FUNÇÕES DE ADMINISTRAÇÃO E DADOS TÉCNICOS --- (sem alterações)

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

export async function fetchAllApprovedUsers() {
    const { data, error } = await supabase.from('profiles').select('id, nome').eq('is_approved', true);
    if (error) console.error('Erro ao buscar usuários aprovados:', error.message);
    return data || [];
}

export async function transferProjectOwner(projectId, newOwnerId) {
    const { error } = await supabase.from('projects').update({ owner_id: newOwnerId }).eq('id', projectId);
    return { error };
}

export async function fetchTechnicalData() {
    const technicalData = {};
    const tablesToFetch = [
        { key: 'disjuntores', name: 'disjuntores' },
        { key: 'cabos', name: 'cabos' },
        { key: 'eletrodutos', name: 'eletrodutos' },
        { key: 'fatores_k1', name: 'fatores_k1_temperatura' },
        { key: 'fatores_k2', name: 'fatores_k2_solo' },
        { key: 'fatores_k3', name: 'fatores_k3_agrupamento' },
        { key: 'dps', name: 'dps' }
    ];

    console.log("Iniciando busca de dados técnicos...");

    for (const table of tablesToFetch) {
        try {
            const { data, error } = await supabase.from(table.name).select('*');
            if (error) {
                throw new Error(error.message);
            }
            technicalData[table.key] = data;
        } catch (err) {
            console.error(`ERRO FATAL ao carregar a tabela '${table.name}'. Detalhes: ${err.message}`);
            technicalData[table.key] = [];
        }
    }
    
    console.log("Dados técnicos carregados:", technicalData);
    return technicalData;
}