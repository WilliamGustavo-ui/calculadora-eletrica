// Arquivo: main.js (v8.4 - Otimizado para Performance e Cálculo em Nuvem)
import * as auth from './auth.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as utils from './utils.js';
import { supabase } from './supabaseClient.js';

let currentUserProfile = null;
let allClients = [];
let uiData = null;

// --- GESTÃO DE AUTENTICAÇÃO ---
async function handleLogin() {
    const email = document.getElementById('emailLogin').value;
    const password = document.getElementById('password').value;
    const userProfile = await auth.signInUser(email, password);
    if (!userProfile) console.error("Falha no login ou usuário bloqueado.");
}

async function handleLogout() {
    await auth.signOutUser();
}

// --- GESTÃO DE PROJETOS (SALVAR/CARREGAR) ---

async function handleSaveProject() {
    if (!currentUserProfile) { alert("Acesso negado."); return; }
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.classList.add('visible');

    try {
        // Coleta dados (incluindo circuitos em memória via Lazy Load) [cite: 27, 85]
        const projectDataToSave = await getFullFormData(true);
        const currentProjectId = document.getElementById('currentProjectId').value;

        // Persiste os valores calculados atuais no feeder_data
        projectDataToSave.feeder_data.feederPotenciaInstalada = document.getElementById('feederPotenciaInstalada').value;
        projectDataToSave.feeder_data.feederSomaPotenciaDemandada = document.getElementById('feederSomaPotenciaDemandada').value;
        projectDataToSave.feeder_data.feederPotenciaDemandada = document.getElementById('feederPotenciaDemandada').value;

        const { data, error } = await api.saveProject(projectDataToSave, currentProjectId);
        if (error) throw error;

        alert("Obra salva com sucesso!");
        document.getElementById('currentProjectId').value = data.id;
        document.getElementById('project_code').value = data.project_code;
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
    ui.setLoadedProjectData(project);

    // 2. Reseta o formulário e vincula o cliente
    ui.resetForm(false, project.client);
    document.getElementById('currentProjectId').value = project.id;

    // 3. Preenchimento Imediato do Alimentador (Exibe somas do banco)
    if (project.feeder_data) {
        Object.keys(project.feeder_data).forEach(key => {
            const el = document.getElementById(key);
            if (el) {
                if (el.type === 'checkbox') el.checked = project.feeder_data[key];
                else el.value = project.feeder_data[key];
            }
        });
    }
    
    // 4. Preenchimento do Responsável Técnico
    if (project.tech_data) {
        Object.keys(project.tech_data).forEach(key => {
            const el = document.getElementById(key);
            if (el) el.value = project.tech_data[key];
        });
    }

    // 5. Renderização da Estrutura de QDCs (Apenas blocos, sem circuitos)
    const qdcContainer = document.getElementById('qdc-container');
    if (project.qdcs_data && Array.isArray(project.qdcs_data)) {
        const fragment = document.createDocumentFragment();
        project.qdcs_data.forEach(qdc => {
            ui.addQdcBlock(qdc.id, qdc.name, qdc.parentId, fragment);
            const qdcId = String(qdc.id);
            // Preenche FD do QDC para garantir cálculos futuros
            if (qdc.config) {
                const fdEl = fragment.querySelector(`#qdcFatorDemanda-${qdcId}`);
                if (fdEl) fdEl.value = qdc.config.qdcFatorDemanda || qdc.config[`qdcFatorDemanda-${qdcId}`] || 100;
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
    loadingOverlay.classList.add('visible');

    try {
        const project = await api.fetchProjectById(projectId);
        if (project) {
            populateFormWithProjectData(project);
        }
    } catch (error) {
        console.error("Erro ao carregar obra:", error);
    } finally {
        loadingOverlay.classList.remove('visible');
    }
}

// --- UTILITÁRIOS DE COLETA ---

async function getFullFormData(forSave = false) {
    const mainData = { 
        obra: document.getElementById('obra').value,
        projectCode: document.getElementById('project_code').value,
        cidadeObra: document.getElementById('cidadeObra')?.value,
        enderecoObra: document.getElementById('enderecoObra')?.value,
        areaObra: document.getElementById('areaObra')?.value,
        unidadesResidenciais: document.getElementById('unidadesResidenciais')?.value,
        unidadesComerciais: document.getElementById('unidadesComerciais')?.value,
        observacoes: document.getElementById('observacoes')?.value
    };
    
    const feederData = {};
    document.querySelectorAll('#feeder-form input, #feeder-form select').forEach(el => {
        feederData[el.id] = el.type === 'checkbox' ? el.checked : el.value;
    });

    const techData = {
        respTecnico: document.getElementById('respTecnico')?.value,
        titulo: document.getElementById('titulo')?.value,
        crea: document.getElementById('crea')?.value
    };

    // Coleta dados dos QDCs e Circuitos (Mesmo os que não estão no DOM via ui.js)
    const { qdcsData, circuitsData } = await ui.collectFormDataForCalculation();

    if (forSave) {
        return {
            project_name: mainData.obra,
            project_code: mainData.projectCode,
            main_data: mainData,
            feeder_data: feederData,
            tech_data: techData,
            qdcs_data: qdcsData,
            owner_id: currentUserProfile?.id,
            client_id: document.getElementById('currentClientId')?.value || null
        };
    }
    return { mainData, qdcsData, circuitsData, feederData, techData };
}

// --- EVENTOS E INICIALIZAÇÃO ---

async function handleSearch(term = '') {
    try {
        const projects = await api.fetchProjects(term);
        ui.populateProjectList(projects);
    } catch (e) { console.error(e); }
}

function setupEventListeners() {
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('saveBtn').addEventListener('click', handleSaveProject);
    document.getElementById('loadBtn').addEventListener('click', handleLoadProject);
    document.getElementById('addQdcBtn').addEventListener('click', () => ui.addQdcBlock());
    document.getElementById('newBtn').addEventListener('click', () => ui.resetForm());

    const appContainer = document.getElementById('appContainer');
    if (appContainer) {
        appContainer.addEventListener('click', ui.handleMainContainerInteraction);
        appContainer.addEventListener('change', ui.handleMainContainerInteraction);
        
        // Dispara o cálculo leve na nuvem ao alterar potências
        appContainer.addEventListener('input', utils.debounce((e) => {
            if (e.target.id.includes('potenciaW') || e.target.id.includes('FatorDemanda')) {
                ui.updateFeederPowerDisplay();
            }
        }, 800));
    }

    document.getElementById('calculateAndPdfBtn').addEventListener('click', async () => {
        // Usa a Edge Function de relatório (gerar-relatorio) [cite: 12, 201]
        const formData = await getFullFormData(false);
        // Implementar chamada via api.js ou supabase.functions.invoke conforme main.js original
    });
}

function main() {
    setupEventListeners();
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            currentUserProfile = await auth.getSession();
            if (currentUserProfile && !currentUserProfile.is_blocked) {
                ui.showAppView(currentUserProfile);
                uiData = await api.fetchUiData();
                ui.setupDynamicData(uiData);
                handleSearch();
            }
        } else {
            ui.showLoginView();
        }
    });
}

document.addEventListener('DOMContentLoaded', main);