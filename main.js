// Arquivo: main.js (v8.4 - Otimizado para Performance e Memória)

import * as auth from './auth.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as utils from './utils.js';
import { supabase } from './supabaseClient.js';

let currentUserProfile = null;
let allClients = [];
let uiData = null;
let lastPdfUrl = null; // Controle de memória do PDF

async function handleLogin() {
    const email = document.getElementById('emailLogin').value;
    const password = document.getElementById('password').value;
    const userProfile = await auth.signInUser(email, password);
    if (!userProfile) console.error("Falha no login ou bloqueio.");
}

async function handleLogout() {
    if (lastPdfUrl) URL.revokeObjectURL(lastPdfUrl);
    await auth.signOutUser();
}

async function handleRegister(event) {
    event.preventDefault();
    const details = {
        nome: document.getElementById('regNome').value,
        cpf: document.getElementById('regCpf').value,
        telefone: document.getElementById('regTelefone').value,
        crea: document.getElementById('regCrea').value,
        email: document.getElementById('regEmail').value
    };
    const { error } = await auth.signUpUser(details.email, document.getElementById('regPassword').value, details);
    if (!error) {
        alert('Sucesso! Aguarde aprovação.');
        ui.closeModal('registerModalOverlay');
    }
}

// --- FUNÇÕES DE PROJETO ---

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
    };

    const currentClientId = document.getElementById('currentClientId').value;
    const client = allClients.find(c => c.id == currentClientId);
    const clientProfile = client ? { cliente: client.nome, documento: client.documento_valor, email: client.email } : {};
    
    const techData = { 
        respTecnico: document.getElementById('respTecnico').value, 
        titulo: document.getElementById('titulo').value, 
        crea: document.getElementById('crea').value 
    };

    const feederData = {};
    document.querySelectorAll('#feeder-form input, #feeder-form select').forEach(el => {
        feederData[el.id] = el.type === 'checkbox' ? el.checked : el.value;
    });

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
            name: document.getElementById(`qdcName-${qId}`)?.value,
            parentId: document.getElementById(`qdcParent-${qId}`)?.value,
            config: qdcConfig,
            circuits: circuits
        });
    }

    return forSave ? 
        { project_name: mainData.obra, client_id: currentClientId, main_data: mainData, tech_data: techData, feeder_data: feederData, qdcs_data: qdcsData } : 
        { mainData, feederData, qdcsData, circuitsData: allCircuits, clientProfile, techData };
}

async function handleCalculateAndPdf() {
    if (!currentUserProfile) return alert("Faça login primeiro.");
    
    const btn = document.getElementById('calculateAndPdfBtn');
    const loadingOverlay = document.getElementById('loadingOverlay');
    
    try {
        btn.disabled = true;
        loadingOverlay.classList.add('visible');

        // 1. Liberação de memória RAM
        if (lastPdfUrl) {
            URL.revokeObjectURL(lastPdfUrl);
            lastPdfUrl = null;
        }

        const formData = await getFullFormData(false); [cite: 190]

        // 2. Chamada para Edge Function
        const { data: pdfBlob, error } = await supabase.functions.invoke('gerar-relatorio', {
            body: { formData },
            responseType: 'blob'
        }); [cite: 260]

        if (error) throw error;

        // 3. Download Gerenciado
        lastPdfUrl = URL.createObjectURL(pdfBlob); [cite: 259]
        const a = document.createElement('a');
        a.href = lastPdfUrl;
        a.download = `Relatorio_${formData.mainData.obra.replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

    } catch (err) {
        console.error("Erro ao gerar memorial:", err);
        alert("Erro: " + err.message);
    } finally {
        btn.disabled = false;
        loadingOverlay.classList.remove('visible');
    }
}

// --- CONFIGURAÇÃO DE LISTENERS ---

function setupEventListeners() {
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('saveBtn').addEventListener('click', handleSaveProject);
    document.getElementById('calculateAndPdfBtn').addEventListener('click', handleCalculateAndPdf);
    
    const appContainer = document.getElementById('appContainer');
    if (appContainer) {
        appContainer.addEventListener('change', ui.handleMainContainerInteraction);
        appContainer.addEventListener('click', ui.handleMainContainerInteraction);
        
        // Listener de input otimizado com Debounce
        appContainer.addEventListener('input', utils.debounce((e) => {
            if (e.target.id.includes('potencia') || e.target.id.includes('Fator')) {
                ui.updateFeederPowerDisplay();
            }
        }, 1000));
    }
}

// --- INICIALIZAÇÃO ---

function main() {
    setupEventListeners();

    supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            const profile = await auth.getSession(); [cite: 191]
            if (profile && profile.is_approved && !profile.is_blocked) {
                currentUserProfile = profile;
                if (!uiData) {
                    uiData = await api.fetchUiData(); [cite: 194]
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