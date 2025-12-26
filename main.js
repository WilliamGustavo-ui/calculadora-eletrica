// Arquivo: main.js (v9.2 - Performance Otimizada)
import * as auth from './auth.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as utils from './utils.js';
import { supabase } from './supabaseClient.js';

let currentUserProfile = null;
let allClients = [];
let uiData = null;
let pdfWorker = null;

const SUPABASE_URL = 'https://nlbkcnaocannelwdcqwa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sYmtjbmFvY2FubmVsd2RjcXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNTM4NTYsImV4cCI6MjA3MDgyOTg1Nn0.mLT8AWkqR0bzV_zRhr3d26ujJiv1vJFL03qiOFdHkRU';

// --- Inicialização do Worker ---
function getPdfWorker() {
    if (!pdfWorker) {
        pdfWorker = new Worker('./pdfWorker.js', { type: 'module' });
        pdfWorker.onmessage = (e) => {
            const loadingOverlay = document.getElementById('loadingOverlay');
            const { success, pdfBlob, error, obra } = e.data;
            loadingOverlay.classList.remove('visible');

            if (success) {
                const pdfUrl = URL.createObjectURL(pdfBlob);
                const a = document.createElement('a');
                a.href = pdfUrl;
                a.download = `Relatorio_${obra?.replace(/[^a-z0-9]/gi, '_') || 'Projeto'}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000); // Libera memória
            } else {
                alert("Erro no Worker: " + error);
            }
        };
    }
    return pdfWorker;
}

// --- Funções de Busca e Carregamento (Restauradas) ---
async function handleSearch(term = '') {
    if (!currentUserProfile) return;
    const projects = await api.fetchProjects(term);
    ui.populateProjectList(projects);
}

async function handleLoadProject() {
    const projectId = document.getElementById('savedProjectsSelect').value;
    if (!projectId) return;
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.classList.add('visible');

    try {
        const project = await api.fetchProjectById(projectId);
        if (project) {
            ui.resetForm(false, project.client);
            ui.setLoadedProjectData(project); // Prepara dados para o Lazy Load do ui.js
            
            document.getElementById('currentProjectId').value = project.id;
            document.getElementById('project_code').value = project.project_code || '';
            document.getElementById('obra').value = project.project_name || '';

            // Renderiza QDCs com pausas para não travar a UI
            const container = document.getElementById('qdc-container');
            if (project.qdcs_data) {
                for (const qdc of project.qdcs_data) {
                    ui.addQdcBlock(String(qdc.id), qdc.name, qdc.parentId, container);
                    await new Promise(r => setTimeout(r, 0)); // Pausa tática para o navegador respirar
                }
            }
            ui.updateQdcParentDropdowns();
            ui.updateFeederPowerDisplay();
        }
    } finally {
        loadingOverlay.classList.remove('visible');
    }
}

// --- Coleta de Dados Otimizada (Backend-Ready) ---
async function getFullFormData(forSave = false) {
    const mainData = { 
        obra: document.getElementById('obra').value,
        cidadeObra: document.getElementById('cidadeObra').value,
        observacoes: document.getElementById('observacoes').value,
        projectCode: document.getElementById('project_code').value
    };

    const currentClientId = document.getElementById('currentClientId').value;
    const client = allClients.find(c => c.id == currentClientId);
    const clientProfile = client ? { cliente: client.nome, documento: client.documento_valor } : {};

    const feederData = {};
    document.querySelectorAll('#feeder-form input, #feeder-form select').forEach(el => {
        feederData[el.id] = el.type === 'checkbox' ? el.checked : el.value;
    });

    const qdcsData = [];
    const circuitsData = [];
    const qdcBlocks = document.querySelectorAll('#qdc-container .qdc-block');

    for (const qdcBlock of qdcBlocks) {
        const qdcId = qdcBlock.dataset.id;
        const config = {};
        qdcBlock.querySelectorAll('.qdc-config-grid input, .qdc-config-grid select').forEach(el => {
            config[el.id] = el.type === 'checkbox' ? el.checked : el.value;
        });

        // Coleta apenas os circuitos que já foram carregados no DOM
        const circuits = [];
        qdcBlock.querySelectorAll('.circuit-block').forEach(cBlock => {
            const cId = cBlock.dataset.id;
            const cData = { id: cId, qdcId: qdcId };
            cBlock.querySelectorAll('input, select').forEach(el => {
                cData[el.id.replace(`-${cId}`, '')] = el.type === 'checkbox' ? el.checked : el.value;
            });
            circuits.push(cData);
            circuitsData.push(cData);
        });

        qdcsData.push({ id: qdcId, name: qdcBlock.querySelector('.qdc-name-input')?.value, parentId: qdcBlock.querySelector('.qdc-parent-select')?.value, config, circuits });
        
        // Evita travamento durante a coleta de centenas de campos
        await new Promise(r => setTimeout(r, 0));
    }

    if (forSave) return { main_data: mainData, qdcs_data: qdcsData, feeder_data: feederData, owner_id: currentUserProfile.id };
    return { mainData, feederData, qdcsData, circuitsData, clientProfile };
}

async function handleCalculateAndPdf() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.classList.add('visible');
    try {
        const formData = await getFullFormData(false);
        const { data: { session } } = await supabase.auth.getSession();
        
        getPdfWorker().postMessage({
            formData,
            SUPABASE_URL,
            SUPABASE_ANON_KEY,
            authHeader: `Bearer ${session?.access_token}`
        });
    } catch (e) {
        loadingOverlay.classList.remove('visible');
        alert("Erro ao preparar relatório.");
    }
}

// --- Bootstrap ---
function setupEventListeners() {
    document.getElementById('loginBtn')?.addEventListener('click', async () => {
        const user = await auth.signInUser(document.getElementById('emailLogin').value, document.getElementById('password').value);
        if(user) main();
    });
    document.getElementById('logoutBtn')?.addEventListener('click', () => auth.signOutUser());
    document.getElementById('loadBtn')?.addEventListener('click', handleLoadProject);
    document.getElementById('calculateAndPdfBtn')?.addEventListener('click', handleCalculateAndPdf);
    document.getElementById('searchInput')?.addEventListener('input', utils.debounce((e) => handleSearch(e.target.value), 400));
    document.getElementById('addQdcBtn')?.addEventListener('click', () => ui.addQdcBlock());

    const app = document.getElementById('appContainer');
    if (app) {
        app.addEventListener('click', ui.handleMainContainerInteraction);
        app.addEventListener('change', ui.handleMainContainerInteraction);
    }
}

function main() {
    setupEventListeners();
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            const profile = await auth.getSession();
            if (profile && profile.is_approved && !profile.is_blocked) {
                currentUserProfile = profile;
                uiData = await api.fetchUiData();
                ui.setupDynamicData(uiData);
                ui.showAppView(profile);
                allClients = await api.fetchClients();
                handleSearch();
            }
        } else {
            ui.showLoginView();
        }
    });
}

document.addEventListener('DOMContentLoaded', main);