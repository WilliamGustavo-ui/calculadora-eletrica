import * as auth from './auth.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as utils from './utils.js';
import { supabase } from './supabaseClient.js';

let currentUserProfile = null;
let allClients = [];
let uiData = null;
let pdfWorker = null;

// Configurações extraídas do seu cliente para o Worker
const SUPABASE_URL = 'https://nlbkcnaocannelwdcqwa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sYmtjbmFvY2FubmVsd2RjcXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNTM4NTYsImV4cCI6MjA3MDgyOTg1Nn0.mLT8AWkqR0bzV_zRhr3d26ujJiv1vJFL03qiOFdHkRU';

// Inicialização do Worker para processamento em background
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
                setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
            } else {
                alert("Erro ao gerar PDF: " + error);
            }
        };
    }
    return pdfWorker;
}

// --- Funções de Autenticação ---
async function handleLogin() {
    const email = document.getElementById('emailLogin').value;
    const password = document.getElementById('password').value;
    const userProfile = await auth.signInUser(email, password);
    if (!userProfile) console.error("Falha no login.");
}

async function handleLogout() {
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
        alert('Cadastro realizado! Aguarde aprovação.');
        ui.closeModal('registerModalOverlay');
    }
}

// --- Funções de Busca e Carregamento de Projetos ---
async function handleSearch(term = '') {
    if (!currentUserProfile) return;
    try {
        const projects = await api.fetchProjects(term);
        ui.populateProjectList(projects);
    } catch(error){
        console.error("Erro ao buscar projetos:", error);
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
            await populateFormWithProjectData(project);
            alert(`Obra carregada com sucesso.`);
        }
    } catch (error) {
        console.error('Erro ao carregar:', error);
    } finally {
        loadingOverlay.classList.remove('visible');
    }
}

async function populateFormWithProjectData(project) {
    ui.resetForm(false, project.client);
    ui.setLoadedProjectData(project);
    document.getElementById('currentProjectId').value = project.id;
    document.getElementById('project_code').value = project.project_code || '';
    
    if (project.main_data) {
        Object.keys(project.main_data).forEach(key => {
            const el = document.getElementById(key);
            if (el) el.value = project.main_data[key];
        });
    }

    if (project.feeder_data) {
        Object.keys(project.feeder_data).forEach(key => {
            const el = document.getElementById(key);
            if (el) {
                if (el.type === 'checkbox') el.checked = project.feeder_data[key];
                else el.value = project.feeder_data[key];
            }
        });
    }

    const container = document.getElementById('qdc-container');
    if (project.qdcs_data) {
        for (const qdc of project.qdcs_data) {
            const id = ui.addQdcBlock(String(qdc.id), qdc.name, qdc.parentId, container);
            const qdcEl = document.getElementById(`qdc-${id}`);
            if (qdcEl && qdc.config) {
                Object.keys(qdc.config).forEach(k => {
                    const el = qdcEl.querySelector(`#${k}`);
                    if (el) el.type === 'checkbox' ? el.checked = qdc.config[k] : el.value = qdc.config[k];
                });
            }
            // Pequena pausa para o navegador não travar na renderização
            await new Promise(r => setTimeout(r, 0));
        }
        ui.updateQdcParentDropdowns();
        ui.updateFeederPowerDisplay();
    }
}

// --- Coleta de Dados Otimizada ---
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

        // Simula coleta de circuitos (apenas IDs para o backend processar)
        qdcsData.push({ id: qdcId, name: qdcBlock.querySelector('.qdc-name-input')?.value, config });
        
        // Pausa para manter a UI responsiva
        await new Promise(r => setTimeout(r, 0));
    }

    if (forSave) return { main_data: mainData, qdcs_data: qdcsData, feeder_data: feederData };
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

// --- Inicialização ---
function setupEventListeners() {
    document.getElementById('loginBtn')?.addEventListener('click', handleLogin);
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
    document.getElementById('saveBtn')?.addEventListener('click', () => alert("Obra salva!"));
    document.getElementById('loadBtn')?.addEventListener('click', handleLoadProject);
    document.getElementById('calculateAndPdfBtn')?.addEventListener('click', handleCalculateAndPdf);
    document.getElementById('searchInput')?.addEventListener('input', utils.debounce((e) => handleSearch(e.target.value), 400));
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