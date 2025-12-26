// Arquivo: main.js (v8.6 - Correção de Sintaxe e Performance)

import * as auth from './auth.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as utils from './utils.js';
import { supabase } from './supabaseClient.js';

let currentUserProfile = null;
let allClients = [];
let uiData = null;
let lastPdfUrl = null; // Controle de memória do PDF [cite: 259]

async function handleLogin() {
    const email = document.getElementById('emailLogin').value;
    const password = document.getElementById('password').value;
    const userProfile = await auth.signInUser(email, password);
    if (!userProfile) console.error("Falha no login.");
}

async function handleLogout() {
    if (lastPdfUrl) URL.revokeObjectURL(lastPdfUrl); // Limpa RAM ao sair [cite: 259]
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
        alert('Cadastro realizado! Aguarde aprovação.');
        ui.closeModal('registerModalOverlay');
    }
}

// --- COLETA DE DADOS OTIMIZADA ---

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
    const clientProfile = client ? { 
        cliente: client.nome, 
        tipoDocumento: client.documento_tipo, 
        documento: client.documento_valor, 
        celular: client.celular, 
        email: client.email 
    } : {};
    
    const techData = { 
        respTecnico: document.getElementById('respTecnico').value, 
        titulo: document.getElementById('titulo').value, 
        crea: document.getElementById('crea').value 
    };

    const feederData = {};
    document.querySelectorAll('#feeder-form input, #feeder-form select').forEach(el => {
        const key = el.id.replace('feeder', '').charAt(0).toLowerCase() + el.id.replace('feeder', '').slice(1);
        feederData[key] = el.type === 'checkbox' ? el.checked : el.value;
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
            parentId: document.getElementById(`qdcParent-${qId}`)?.value || 'feeder',
            config: qdcConfig,
            circuits: circuits
        });
    }

    return forSave ? 
        { project_name: mainData.obra, project_code: mainData.projectCode, client_id: currentClientId, main_data: mainData, tech_data: techData, feeder_data: feederData, qdcs_data: qdcsData, owner_id: currentUserProfile?.id } : 
        { mainData, feederData, qdcsData, circuitsData: allCircuits, clientProfile, techData };
}

// --- GERAÇÃO DE MEMORIAL (CORREÇÃO DE TRAVAMENTO) ---

async function handleCalculateAndPdf() {
    if (!currentUserProfile) return alert("Usuário não autenticado.");
    const btn = document.getElementById('calculateAndPdfBtn');
    const loadingOverlay = document.getElementById('loadingOverlay');
    
    try {
        btn.disabled = true;
        loadingOverlay.classList.add('visible');

        // Revoga a URL anterior para liberar memória RAM imediatamente [cite: 259]
        if (lastPdfUrl) URL.revokeObjectURL(lastPdfUrl);

        const formData = await getFullFormData(false);

        const { data: pdfBlob, error } = await supabase.functions.invoke('gerar-relatorio', {
            body: { formData },
            responseType: 'blob'
        });

        if (error) throw error;

        // Cria URL do blob e gerencia o download [cite: 260]
        lastPdfUrl = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = lastPdfUrl;
        a.download = `Relatorio_${formData.mainData.obra.replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

    } catch (err) {
        console.error("Erro no memorial:", err);
        alert("Erro: " + err.message);
    } finally {
        btn.disabled = false;
        loadingOverlay.classList.remove('visible');
    }
}

// --- EVENTOS E INICIALIZAÇÃO ---

function setupEventListeners() {
    document.getElementById('loginBtn')?.addEventListener('click', handleLogin);
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
    document.getElementById('registerBtn')?.addEventListener('click', () => ui.openModal('registerModalOverlay'));
    document.getElementById('registerForm')?.addEventListener('submit', handleRegister);
    document.getElementById('calculateAndPdfBtn')?.addEventListener('click', handleCalculateAndPdf);
    
    document.getElementById('saveBtn')?.addEventListener('click', async () => {
        const data = await getFullFormData(true);
        const id = document.getElementById('currentProjectId').value;
        const { data: saved, error } = await api.saveProject(data, id);
        if (!error) alert("Obra salva!");
    });

    const appContainer = document.getElementById('appContainer');
    if (appContainer) {
        appContainer.addEventListener('change', ui.handleMainContainerInteraction);
        appContainer.addEventListener('click', ui.handleMainContainerInteraction);
        
        // Debounce de 1s para evitar sobrecarga da CPU durante digitação
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