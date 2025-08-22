// Arquivo: api.js

import { supabase } from './supabaseClient.js';

// --- FUNÇÕES DE PROJETO ---
export async function fetchProjects(searchTerm) {
    let query = supabase.from('projects').select('id, project_name, owner_id, profile:profiles(nome)');
    if (searchTerm) {
        query = query.ilike('project_name', `%${searchTerm}%`);
    }
    const { data, error } = await query.order('project_name');
    if (error) {
        console.error('Erro ao buscar projetos:', error.message);
        alert("Erro ao carregar os projetos: " + error.message);
    }
    return data || [];
}
export async function fetchProjectById(projectId) {
    const { data, error } = await supabase.from('projects').select('*').eq('id', projectId).single();
    if (error) console.error('Erro ao buscar projeto por ID:', error.message);
    return data;
}
export async function saveProject(projectData, projectId) {
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

// --- FUNÇÕES DE ADMINISTRAÇÃO ---
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

/**
 * VERSÃO FINAL E ROBUSTA
 * Busca cada tabela de dados técnicos individualmente para evitar uma falha total.
 */
export async function fetchTechnicalData() {
    const technicalData = {};
    const tablesToFetch = [
        { key: 'disjuntores', name: 'disjuntores' },
        { key: 'cabos', name: 'cabos' },
        { key: 'eletrodutos', name: 'eletrodutos' },
        { key: 'fatores_k1', name: 'fatores_k1_temperatura' },
        { key: 'fatores_k1_epr', name: 'fatores_k1_temperatura_epr' }, // <-- Busca a tabela EPR
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
            console.error(`ERRO FATAL ao carregar a tabela '${table.name}'. Verifique o nome da tabela e as políticas de segurança (RLS) no Supabase. Detalhes: ${err.message}`);
            technicalData[table.key] = [];
        }
    }
    
    console.log("Dados técnicos carregados:", technicalData);
    return technicalData;
}