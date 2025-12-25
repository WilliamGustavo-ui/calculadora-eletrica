// Arquivo: main.js (v8.4 - Otimizado para Cálculo em Nuvem e Performance)
import * as auth from './auth.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as utils from './utils.js';
import { supabase } from './supabaseClient.js';

let currentUserProfile = null;
let allClients = [];
let uiData = null;

// --- LOGIN E AUTH ---
async function handleLogin() {
    const email = document.getElementById('emailLogin').value;
    const password = document.getElementById('password').value;
    const userProfile = await auth.signInUser(email, password);
    if (!userProfile) console.error("Falha no login ou usuário bloqueado."); [cite: 5, 201]
}

async function handleLogout() {
    await auth.signOutUser(); [cite: 46]
}

// --- GESTÃO DE PROJETOS (SALVAR/CARREGAR) ---

async function handleSaveProject() {
    if (!currentUserProfile) { alert("Acesso negado."); return; } [cite: 201]
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.classList.add('visible'); [cite: 210]

    try {
        // Coleta todos os dados do formulário (incluindo circuitos não visíveis no DOM)
        const projectDataToSave = await getFullFormData(true);
        const currentProjectId = document.getElementById('currentProjectId').value;

        // Adiciona os valores calculados atuais ao feeder_data para persistência
        projectDataToSave.feeder_data.feederPotenciaInstalada = document.getElementById('feederPotenciaInstalada').value;
        projectDataToSave.feeder_data.feederSomaPotenciaDemandada = document.getElementById('feederSomaPotenciaDemandada').value;
        projectDataToSave.feeder_data.feederPotenciaDemandada = document.getElementById('feederPotenciaDemandada').value;

        const { data, error } = await api.saveProject(projectDataToSave, currentProjectId); [cite: 56]
        if (error) throw error;

        alert("Obra salva com sucesso!");
        document.getElementById('currentProjectId').value = data.id;
        await handleSearch();
    } catch (error) {
        alert("Erro ao salvar: " + error.message);
    } finally {
        loadingOverlay.classList.remove('visible');
    }
}

function populateFormWithProjectData(project) {
    if (!project) return;

    // 1. Prepara o Lazy Loading armazenando o objeto completo
    ui.setLoadedProjectData(project); [cite: 20]

    // 2. Reseta o formulário e vincula o cliente
    ui.resetForm(false, project.client); [cite: 195]
    document.getElementById('currentProjectId').value = project.id;

    // 3. Preenchimento Imediato do Alimentador (Aparece a soma sem abrir QDCs)
    if (project.feeder_data) {
        Object.keys(project.feeder_data).forEach(key => {
            const el = document.getElementById(key);
            if (el) {
                if (el.type === 'checkbox') el.checked = project.feeder_data[key];
                else el.value = project.feeder_data[key];
            }
        });
    }

    // 4. Renderização da Estrutura de QDCs (Apenas cabeçalhos)
    const qdcContainer = document.getElementById('qdc-container');
    if (project.qdcs_data && Array.isArray(project.qdcs_data)) {
        const fragment = document.createDocumentFragment();
        
        // Adiciona apenas os blocos de QDC vazios (Rápido)
        project.qdcs_data.forEach(qdc => {
            ui.addQdcBlock(qdc.id, qdc.name, qdc.parentId, fragment);
            // Preenche configurações do QDC
            if (qdc.config) {
                const qdcId = String(qdc.id);
                // Preenche o fator de demanda para o cálculo remoto
                const fdEl = fragment.querySelector(`#qdcFatorDemanda-${qdcId}`);
                if (fdEl) fdEl.value = qdc.config.qdcFatorDemanda || 100;
            }
        });
        qdcContainer.appendChild(fragment);
        ui.updateQdcParentDropdowns();
    }
}

async function handleLoadProject() {
    const projectId = document.getElementById('savedProjectsSelect').value;
    if (!projectId) return;
    
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.classList.add('visible'); [cite: 210]

    try {
        const project = await api.fetchProjectById(projectId); [cite: 50]
        if (project) {
            populateFormWithProjectData(project);
        }
    } catch (error) {
        console.error("Erro:", error);
    } finally {
        loadingOverlay.classList.remove('visible');
    }
}

// --- FUNÇÕES TÉCNICAS E LISTENERS ---

async function getFullFormData(forSave = false) {
    // Implementação unificada para coletar dados de campos visíveis e do backup em memória
    // Essencial para que o 'salvar' e o 'calcular' funcionem com Lazy Loading
    const mainData = { 
        obra: document.getElementById('obra').value,
        projectCode: document.getElementById('project_code').value 
    };
    
    const feederData = {};
    document.querySelectorAll('#feeder-form input, #feeder-form select').forEach(el => {
        feederData[el.id] = el.type === 'checkbox' ? el.checked : el.value;
    });

    // Coleta dados dos QDCs e Circuitos (Mesmo os que não estão no DOM)
    const { qdcsData, circuitsData } = await ui.collectFormDataForCalculation();

    if (forSave) {
        return {
            project_name: mainData.obra,
            main_data: mainData,
            feeder_data: feederData,
            qdcs_data: qdcsData, // Aqui incluímos a estrutura completa
            owner_id: currentUserProfile?.id
        };
    }
    return { mainData, qdcsData, circuitsData, feederData };
}

function setupEventListeners() {
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('saveBtn').addEventListener('click', handleSaveProject);
    document.getElementById('loadBtn').addEventListener('click', handleLoadProject);
    document.getElementById('addQdcBtn').addEventListener('click', () => ui.addQdcBlock());
    
    // Delegação de eventos para performance (ui.js trata os cliques internos)
    const appContainer = document.getElementById('appContainer');
    if (appContainer) {
        appContainer.addEventListener('click', ui.handleMainContainerInteraction);
        appContainer.addEventListener('change', ui.handleMainContainerInteraction);
        
        // Listener de Input com Debounce para o cálculo remoto
        appContainer.addEventListener('input', (e) => {
            if (e.target.id.includes('potenciaW') || e.target.id.includes('FatorDemanda')) {
                ui.updateFeederPowerDisplay();
            }
        });
    }

    document.getElementById('calculateAndPdfBtn').addEventListener('click', () => {
        // Usa sua Edge Function original de relatório
        api.generateReport(getFullFormData(false));
    });
}

function main() {
    setupEventListeners();
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            currentUserProfile = await auth.getSession(); [cite: 49]
            if (currentUserProfile) {
                ui.showAppView(currentUserProfile);
                uiData = await api.fetchUiData(); [cite: 108]
                ui.setupDynamicData(uiData); [cite: 35]
                handleSearch();
            }
        } else {
            ui.showLoginView();
        }
    });
}

document.addEventListener('DOMContentLoaded', main);