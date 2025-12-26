// Arquivo: main.js (v8.5 - Versão Completa e Corrigida)

import * as auth from './auth.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as utils from './utils.js';
import { supabase } from './supabaseClient.js';

let currentUserProfile = null;
let allClients = [];
let uiData = null;
let lastPdfUrl = null; // Controle de memória para evitar travamentos

// --- FUNÇÕES DE AUTENTICAÇÃO ---

async function handleLogin() {
    const email = document.getElementById('emailLogin').value;
    const password = document.getElementById('password').value;
    const userProfile = await auth.signInUser(email, password);
    if (!userProfile) console.error("Falha no login ou usuário bloqueado."); [cite: 1]
}

async function handleLogout() {
    if (lastPdfUrl) URL.revokeObjectURL(lastPdfUrl); [cite: 259]
    await auth.signOutUser();
}

async function handleRegister(event) {
    event.preventDefault();
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const details = {
        nome: document.getElementById('regNome').value,
        cpf: document.getElementById('regCpf').value,
        telefone: document.getElementById('regTelefone').value,
        crea: document.getElementById('regCrea').value,
        email: email
    };
    const { error } = await auth.signUpUser(email, password, details);
    if (!error) {
        alert('Cadastro realizado! Aguarde aprovação de um administrador.'); [cite: 1]
        ui.closeModal('registerModalOverlay');
    }
}

// --- GESTÃO DE PROJETOS E MEMORIAL ---

async function getFullFormData(forSave = false) {
    const mainData = { 
        obra: document.getElementById('obra').value, 
        projectCode: document.getElementById('project_code').value,
        cidadeObra: document.getElementById('cidadeObra').value,
        enderecoObra: document.getElementById('enderecoObra').value,
        areaObra: document.getElementById('areaObra').value,
        unidadesResidenciais: document.getElementById('unidadesResidenciais').value,
        unidadesComerciais: document.getElementById('unidadesComerciais').value,
        observacoes: document.getElementById('observacoes').value 
    }; [cite: 212, 215]

    const currentClientId = document.getElementById('currentClientId').value;
    const client = allClients.find(c => c.id == currentClientId);
    const clientProfile = client ? { 
        cliente: client.nome, 
        tipoDocumento: client.documento_tipo, 
        documento: client.documento_valor, 
        celular: client.celular, 
        telefone: client.telefone, 
        email: client.email, 
        enderecoCliente: client.endereco 
    } : {}; [cite: 208, 211]

    const techData = { 
        respTecnico: document.getElementById('respTecnico').value, 
        titulo: document.getElementById('titulo').value, 
        crea: document.getElementById('crea').value 
    }; [cite: 216, 217]

    const feederData = {};
    document.querySelectorAll('#feeder-form input, #feeder-form select').forEach(el => {
        const key = el.id.replace('feeder', '').charAt(0).toLowerCase() + el.id.replace('feeder', '').slice(1);
        feederData[key] = el.type === 'checkbox' ? el.checked : el.value;
    }); [cite: 226]

    const qdcsData = [];
    const allCircuits = [];
    const qdcBlocks = document.querySelectorAll('#qdc-container .qdc-block');

    for (const block of qdcBlocks) {
        const qId = block.dataset.id;
        const qdcConfig = {};
        block.querySelectorAll('.qdc-config-grid input, .qdc-config-grid select').forEach(el => {
            const key = el.id.replace(`qdc`, '').replace(`-${qId}`, '').replace(/^[A-Z]/, l => l.toLowerCase());
            qdcConfig[key] = el.type === 'checkbox' ? el.checked : el.value;
        });

        const circuits = [];
        block.querySelectorAll('.circuit-block').forEach(cBlock => {
            const cId = cBlock.dataset.id;
            const cData = { id: cId, qdcId: qId };
            cBlock.querySelectorAll('input, select').forEach(el => {
                const key = el.id.replace(`-${cId}`, '');
                cData[key] = el.type === 'checkbox' ? el.checked : el.value;
            });
            circuits.push(cData);
            allCircuits.push(cData);
        });

        qdcsData.push({
            id: qId,
            name: document.getElementById(`qdcName-${qId}`)?.value || `QDC ${qId}`,
            parentId: document.getElementById(`qdcParent-${qId}`)?.value || 'feeder',
            config: qdcConfig,
            circuits: circuits
        });
    }

    if (forSave) {
        return { project_name: mainData.obra, project_code: mainData.projectCode, client_id: currentClientId, main_data: mainData, tech_data: techData, feeder_data: feederData, qdcs_data: qdcsData, owner_id: currentUserProfile?.id };
    }
    return { mainData, feederData, qdcsData, circuitsData: allCircuits, clientProfile, techData }; [cite: 68]
}

async function handleCalculateAndPdf() {
    if (!currentUserProfile) return alert("Usuário não autenticado.");
    const loadingOverlay = document.getElementById('loadingOverlay');
    const btn = document.getElementById('calculateAndPdfBtn');

    try {
        btn.disabled = true;
        loadingOverlay.classList.add('visible');
        
        // Limpeza de memória RAM de PDFs anteriores
        if (lastPdfUrl) URL.revokeObjectURL(lastPdfUrl); [cite: 259]

        const formData = await getFullFormData(false);
        const { data: pdfBlob, error } = await supabase.functions.invoke('gerar-relatorio', {
            body: { formData },
            responseType: 'blob'
        }); [cite: 189]

        if (error) throw error;

        lastPdfUrl = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = lastPdfUrl;
        a.download = `Relatorio_${formData.mainData.obra.replace(/[^a-z0-9]/gi, '_')}.pdf`; [cite: 260]
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

    } catch (err) {
        console.error("Erro no memorial:", err);
        alert("Erro ao gerar memorial: " + err.message); [cite: 262]
    } finally {
        btn.disabled = false;
        loadingOverlay.classList.remove('visible');
    }
}

// --- CONFIGURAÇÃO DE EVENTOS ---

function setupEventListeners() {
    document.getElementById('loginBtn')?.addEventListener('click', handleLogin);
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
    document.getElementById('registerBtn')?.addEventListener('click', () => ui.openModal('registerModalOverlay'));
    document.getElementById('registerForm')?.addEventListener('submit', handleRegister);
    document.getElementById('calculateAndPdfBtn')?.addEventListener('click', handleCalculateAndPdf);
    
    // Otimização de busca e salvamento
    document.getElementById('saveBtn')?.addEventListener('click', async () => {
        const data = await getFullFormData(true);
        const id = document.getElementById('currentProjectId').value;
        const { data: saved, error } = await api.saveProject(data, id);
        if (!error) alert("Obra salva!"); [cite: 196]
    });

    const appContainer = document.getElementById('appContainer');
    if (appContainer) {
        appContainer.addEventListener('change', ui.handleMainContainerInteraction);
        appContainer.addEventListener('click', ui.handleMainContainerInteraction);
        
        // Listener de potência com debounce de 1s para não travar a CPU
        appContainer.addEventListener('input', utils.debounce((e) => {
            if (e.target.id.includes('potencia') || e.target.id.includes('Fator')) {
                ui.updateFeederPowerDisplay();
            }
        }, 1000));
    }
}

function main() {
    setupEventListeners();
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            const profile = await auth.getSession();
            if (profile && profile.is_approved && !profile.is_blocked) {
                currentUserProfile = profile;
                if (!uiData) {
                    uiData = await api.fetchUiData();
                    ui.setupDynamicData(uiData);
                }
                ui.showAppView(currentUserProfile);
            } else {
                await auth.signOutUser();
            }
        } else {
            ui.showLoginView();
        }
    });
}

document.addEventListener('DOMContentLoaded', main);