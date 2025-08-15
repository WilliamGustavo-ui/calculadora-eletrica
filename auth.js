// Arquivo: auth.js

import { supabase } from './supabaseClient.js';

// ... (as outras funções como signInUser, signUpUser, etc. continuam iguais) ...
// A única mudança crucial é na função getSession abaixo.

export async function signInUser(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        alert('Erro no login: ' + error.message);
    }
}

export async function signUpUser(email, password, details) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: details
        }
    });

    if (error) {
        alert('Erro ao registrar: ' + error.message);
    }
    return { error };
}

export async function signOutUser() {
    await supabase.auth.signOut();
}

/**
 * VERSÃO DE DEPURAÇÃO DA FUNÇÃO getSession.
 * Ela vai nos mostrar cada passo da verificação de perfil no console.
 */
export async function getSession() {
    console.log('[getSession] Iniciando a busca da sessão...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
        console.error('[getSession] Erro ao obter a sessão do Supabase:', sessionError.message);
        return null;
    }
    if (!session) {
        console.warn('[getSession] Nenhuma sessão ativa encontrada.');
        return null;
    }

    console.log(`[getSession] Sessão encontrada para o usuário: ${session.user.id}`);
    console.log('[getSession] Buscando perfil correspondente no banco de dados...');

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
    
    if (profileError) {
        console.error('[getSession] ERRO AO BUSCAR PERFIL NO BANCO DE DADOS:', profileError.message);
        return null;
    }

    if (profile) {
        console.log('[getSession] Perfil encontrado com sucesso:', profile);
    } else {
        console.warn('[getSession] Perfil não encontrado para o ID do usuário.');
    }
    
    return profile;
}


// --- FUNÇÕES DE REDEFINIÇÃO DE SENHA ---
export async function sendPasswordResetEmail(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://williamguto0911-design.github.io/calculadora-eletrica/index.html',
    });
    return { error };
}

export async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error };
}