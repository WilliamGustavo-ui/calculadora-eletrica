import { supabase } from './supabaseClient.js';

// --- FUNÇÕES DE PROJETO ---

/**
 * Busca a lista de projetos do usuário logado ou todos os projetos se for admin.
 * A sintaxe do select foi corrigida para fazer a junção com a tabela de perfis.
 */
export async function fetchProjects(searchTerm) {
    // A sintaxe da busca foi ajustada para ser mais explícita
    let query = supabase.from('projects').select('id, project_name, owner_id, profile:profiles(nome)');

    if (searchTerm) {
        query = query.ilike('project_name', `%${searchTerm}%`);
    }
    const { data, error } = await query.order('project_name');
    
    if (error) {
        console.error('Erro ao buscar projetos:', error.message);
        // Adicionamos um alerta para o usuário saber do erro.
        alert("Erro ao carregar os projetos: " + error.message);
    }
    return data || [];
}

/**
 * Busca todos os dados de um único projeto pelo seu ID.
 */
export async function fetchProjectById(projectId) {
    const { data, error } = await supabase.from('projects').select('*').eq('id', projectId).single();
    if (error) console.error('Erro ao buscar projeto por ID:', error.message);
    return data;
}

/**
 * Salva um projeto. Funciona tanto para criar um novo (INSERT) quanto para atualizar um existente (UPDATE).
 */
export async function saveProject(projectData, projectId) {
    let result;
    if (projectId) {
        // Atualiza um projeto existente
        result = await supabase.from('projects').update(projectData).eq('id', projectId).select().single();
    } else {
        // Cria um projeto novo
        if (!projectData.main_data.codigoCliente) {
            const { count, error } = await supabase.from('projects').select('*', { count: 'exact', head: true });
            if (error) { throw new Error("Erro ao gerar código do cliente"); }
            projectData.main_data.codigoCliente = 'C-' + String((count || 0) + 1).padStart(3, '0');
        }
        result = await supabase.from('projects').insert(projectData).select().single();
    }
    return result;
}

/**
 * Deleta um projeto do banco de dados pelo seu ID.
 */
export async function deleteProject(projectId) {
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    return { error };
}


// --- FUNÇÕES DE ADMINISTRAÇÃO ---

/**
 * (Admin) Busca a lista de todos os usuários no sistema.
 */
export async function fetchAllUsers() {
    const { data, error } = await supabase.from('profiles').select('*').order('nome');
    if (error) console.error('Erro ao buscar usuários:', error.message);
    return data || [];
}

/**
 * (Admin) Aprova o cadastro de um novo usuário.
 */
export async function approveUser(userId) {
    const { error } = await supabase.from('profiles').update({ is_approved: true }).eq('id', userId);
    return { error };
}

/**
 * (Admin) Atualiza os dados do perfil de um usuário.
 */
export async function updateUserProfile(userId, profileData) {
    const { error } = await supabase.from('profiles').update(profileData).eq('id', userId);
    return { error };
}

/**
 * (Admin) Busca todos os usuários que já foram aprovados.
 */
export async function fetchAllApprovedUsers() {
    const { data, error } = await supabase.from('profiles').select('id, nome').eq('is_approved', true);
    if (error) console.error('Erro ao buscar usuários aprovados:', error.message);
    return data || [];
}

/**
 * (Admin) Transfere a propriedade de um projeto para outro usuário.
 */
export async function transferProjectOwner(projectId, newOwnerId) {
    const { error } = await supabase.from('projects').update({ owner_id: newOwnerId }).eq('id', projectId);
    return { error };
}