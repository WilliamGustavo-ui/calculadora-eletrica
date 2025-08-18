// Arquivo: auth.js

import { supabase } from './supabaseClient.js';

export async function signInUser(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        alert('Erro no login: ' + error.message);
        return { user: null, profile: null };
    }
    if (data.user) {
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();
        if (profileError) {
            alert('Erro ao buscar perfil: ' + profileError.message);
            return { user: data.user, profile: null };
        }
        return { user: data.user, profile };
    }
    return { user: null, profile: null };
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
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
    
    return profile;
}

// --- NOVAS FUNÇÕES ---

/**
 * Envia o e-mail de redefinição de senha para o usuário.
 */
export async function sendPasswordResetEmail(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://williamguto0911-design.github.io/calculadora-eletrica/',
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