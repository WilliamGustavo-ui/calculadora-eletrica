// Arquivo: auth.js

import { supabase } from './supabaseClient.js';

/**
 * Função signInUser NOVA E CORRIGIDA.
 * A única responsabilidade dela agora é autenticar o usuário.
 * A busca do perfil e a verificação de 'is_approved' serão feitas
 * exclusivamente pelo 'onAuthStateChange' em main.js, eliminando a condição de corrida.
 */
export async function signInUser(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        // O erro 400 (senha incorreta) ainda será mostrado aqui.
        alert('Erro no login: ' + error.message);
    }
    // Não retornamos nada, pois o onAuthStateChange cuidará do resto.
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

export async function getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
        return null;
    }
    // Esta função agora é a única fonte da verdade para o perfil do usuário logado.
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
    
    return profile;
}

// --- FUNÇÕES DE REDEFINIÇÃO DE SENHA ---

/**
 * Envia o e-mail de redefinição de senha para o usuário.
 */
export async function sendPasswordResetEmail(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://williamgustavo-ui.github.io/calculadora-eletrica/index.html',
    });
    return { error };
}

/**
 * Atualiza a senha do usuário logado (autenticado pelo link de redefinição).
 */
export async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error };
}