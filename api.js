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
    let query = supabase.from('projects').select('id, project_name, project_code, client:clients(nome)');
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

// --- FUNÇÕES DE ADMINISTRAÇÃO E DADOS TÉCNICOS ---
export async function fetchAllUsers() { /* ... */ }
export async function approveUser(userId) { /* ... */ }
export async function updateUserProfile(userId, profileData) { /* ... */ }
export async function fetchAllApprovedUsers() { /* ... */ }
export async function transferProjectOwner(projectId, newOwnerId) { /* ... */ }
export async function fetchTechnicalData() {
    const technicalData = {};
    const tablesToFetch = [
        { key: 'disjuntores', name: 'disjuntores' },
        { key: 'cabos', name: 'cabos' },
        { key: 'eletrodutos', name: 'eletrodutos' },
        { key: 'fatores_k1', name: 'fatores_k1_temperatura' },
        { key: 'fatores_k1_epr', name: 'fatores_k1_temperatura_epr' },
        { key: 'fatores_k2', name: 'fatores_k2_solo' },
        { key: 'fatores_k3', name: 'fatores_k3_agrupamento' },
        { key: 'dps', name: 'dps' }
    ];
    console.log("Iniciando busca de dados técnicos...");
    for (const table of tablesToFetch) {
        try {
            const { data, error } = await supabase.from(table.name).select('*');
            if (error) { throw new Error(error.message); }
            technicalData[table.key] = data;
        } catch (err) {
            console.error(`ERRO FATAL ao carregar a tabela '${table.name}'. Detalhes: ${err.message}`);
            technicalData[table.key] = [];
        }
    }
    console.log("Dados técnicos carregados:", technicalData);
    return technicalData;
}