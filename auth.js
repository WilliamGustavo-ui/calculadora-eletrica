// Arquivo: auth.js
import { supabase } from './supabaseClient.js';

export async function signInUser(email, password) {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
        alert('Erro no login: ' + authError.message);
        return null;
    }
    if (authData.user) {
        const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', authData.user.id).single();
        if (profileError) {
            alert('Erro ao buscar perfil do usuário: ' + profileError.message);
            await supabase.auth.signOut();
            return null;
        }
        return profile;
    }
    return null;
}

export async function signUpUser(email, password, details) {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: details } });
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
    if (error || !session) return null;
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    return profile;
}

export async function sendPasswordResetEmail(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: 'https://williamgustavo-ui.github.io/calculadora-eletrica/index.html' });
    return { error };
}

export async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error };
}