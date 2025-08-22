import { supabase } from './supabaseClient.js';

// --- FUNÇÕES DE CLIENTE ---
export async function fetchClients() { /* ... (código completo na resposta anterior) ... */ }
export async function addClient(clientData) { /* ... (código completo na resposta anterior) ... */ }
export async function updateClient(clientId, clientData) { /* ... (código completo na resposta anterior) ... */ }
export async function deleteClient(clientId) { /* ... (código completo na resposta anterior) ... */ }

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
export async function fetchProjectById(projectId) { /* ... (código completo na resposta anterior) ... */ }
export async function saveProject(projectData, projectId) { /* ... (código completo na resposta anterior) ... */ }
export async function deleteProject(projectId) { /* ... (código completo na resposta anterior) ... */ }
export async function transferProjectClient(projectId, newClientId) { /* ... (código completo na resposta anterior) ... */ }

// --- FUNÇÕES DE ADMINISTRAÇÃO E DADOS TÉCNICOS ---
export async function fetchAllUsers() { /* ... (código completo na resposta anterior) ... */ }
export async function approveUser(userId) { /* ... (código completo na resposta anterior) ... */ }
export async function updateUserProfile(userId, profileData) { /* ... (código completo na resposta anterior) ... */ }
export async function fetchAllApprovedUsers() { /* ... (código completo na resposta anterior) ... */ }
export async function transferProjectOwner(projectId, newOwnerId) { /* ... (código completo na resposta anterior) ... */ }
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