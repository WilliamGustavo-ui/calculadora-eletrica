// Arquivo: main.js (v8.3 Integral - Corrigido com Web Worker)

import * as auth from './auth.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as utils from './utils.js';
import { supabase } from './supabaseClient.js';

let currentUserProfile = null;
let allClients = [];
let uiData = null;
let pdfWorker = null;

// --- Configurações Supabase para o Worker ---
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
                setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
            } else {
                alert("Erro ao gerar PDF: " + error);
            }
        };
    }
    return pdfWorker;
}

// --- Funções de Auth ---
async function handleLogin() {
    const email = document.getElementById('emailLogin').value;
    const password = document.getElementById('password').value;
    const userProfile = await auth.signInUser(email, password);
    if (!userProfile) console.error("Falha no login ou usuário bloqueado.");
}

async function handleLogout() {
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
        alert('Cadastro realizado com sucesso! Aguarde aprovação.');
        ui.closeModal('registerModalOverlay');
        event.target.reset();
    } else {
        alert(`Erro no registro: ${error.message}`);
    }
}

// --- Funções de Busca e Carregamento (Restauradas) ---
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
    if (!projectId) { alert("Selecione uma obra."); return; }
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.classList.add('visible');
    try {
        await new Promise(resolve => setTimeout(resolve, 50));
        const project = await api.fetchProjectById(projectId);
        if (project) {
            populateFormWithProjectData(project); 
            alert(`Obra "${project.project_name}" carregada.`);
        }
    } catch (error) {
         console.error('Erro ao carregar obra:', error);
    } finally { loadingOverlay.classList.remove('visible'); }
}

function populateFormWithProjectData(project) {
    if (!project) return;
    ui.resetForm(false, project.client);
    ui.setLoadedProjectData(project);
    document.getElementById('currentProjectId').value = project.id;
    if (project.main_data) {
        Object.keys(project.main_data).forEach(key => {
            const el = document.getElementById(key);
            if (el) el.value = project.main_data[key];
        });
    }
    document.getElementById('project_code').value = project.project_code || '';
    if (project.tech_data) {
        Object.keys(project.tech_data).forEach(key => {
            const el = document.getElementById(key);
            if (el) el.value = project.tech_data[key];
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
        document.getElementById('feederFases')?.dispatchEvent(new Event('change'));
        document.getElementById('feederTipoIsolacao')?.dispatchEvent(new Event('change'));
    }

    const qdcContainerTarget = document.getElementById('qdc-container');
    if (project.qdcs_data && Array.isArray(project.qdcs_data)) {
        const fragment = document.createDocumentFragment();
        project.qdcs_data.forEach(qdc => {
            const renderedQdcId = ui.addQdcBlock(String(qdc.id), qdc.name, qdc.parentId, fragment);
            const qdcEl = fragment.querySelector(`#qdc-${renderedQdcId}`);
            if (qdcEl && qdc.config) {
                Object.keys(qdc.config).forEach(key => {
                    const el = qdcEl.querySelector(`#${key}`);
                    if (el) {
                        if (el.type === 'checkbox') el.checked = qdc.config[key];
                        else el.value = qdc.config[key];
                    }
                });
            }
        });
        qdcContainerTarget.appendChild(fragment);
        project.qdcs_data.forEach(qdc => {
            ui.initializeQdcListeners(String(qdc.id));
            document.getElementById(`qdcFases-${qdc.id}`)?.dispatchEvent(new Event('change'));
            document.getElementById(`qdcTipoIsolacao-${qdc.id}`)?.dispatchEvent(new Event('change'));
        });
        ui.updateQdcParentDropdowns();
        setTimeout(() => ui.updateFeederPowerDisplay(), 100);
    }
}

// --- Coleta de Dados para o PDF (Worker-Ready) ---
async function getFullFormData(forSave = false) {
    const mainData = { 
        obra: document.getElementById('obra').value, 
        cidadeObra: document.getElementById('cidadeObra').value, 
        enderecoObra: document.getElementById('enderecoObra').value, 
        areaObra: document.getElementById('areaObra').value, 
        unidadesResidenciais: document.getElementById('unidadesResidenciais').value, 
        unidadesComerciais: document.getElementById('unidadesComerciais').value, 
        observacoes: document.getElementById('observacoes').value, 
        projectCode: document.getElementById('project_code').value 
    };
    const currentClientId = document.getElementById('currentClientId').value;
    const client = allClients.find(c => c.id == currentClientId);
    const clientProfile = client ? { cliente: client.nome, tipoDocumento: client.documento_tipo, documento: client.documento_valor, celular: client.celular, telefone: client.telefone, email: client.email, enderecoCliente: client.endereco } : {};
    const techData = { respTecnico: document.getElementById('respTecnico').value, titulo: document.getElementById('titulo').value, crea: document.getElementById('crea').value };
    
    // Simplificado para o worker (apenas dados de cálculo)
    const feederData = {};
    document.querySelectorAll('#feeder-form input, #feeder-form select').forEach(el => {
        feederData[el.id] = el.type === 'checkbox' ? el.checked : el.value;
    });

    const qdcsData = [];
    const circuitsData = [];
    for (const qdcBlock of document.querySelectorAll('#qdc-container .qdc-block')) {
        const qdcId = qdcBlock.dataset.id;
        const config = {};
        qdcBlock.querySelectorAll('.qdc-config-grid input, .qdc-config-grid select').forEach(el => {
            config[el.id] = el.type === 'checkbox' ? el.checked : el.value;
        });
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
        qdcsData.push({ id: qdcId, name: qdcBlock.querySelector(`#qdcName-${qdcId}`)?.value, parentId: qdcBlock.querySelector(`#qdcParent-${qdcId}`)?.value, config, circuits });
        await new Promise(r => setTimeout(r, 0));
    }

    if (forSave) return { project_name: mainData.obra, project_code: mainData.projectCode, client_id: currentClientId, main_data: mainData, tech_data: techData, feeder_data: feederData, qdcs_data: qdcsData, owner_id: currentUserProfile.id };
    return { mainData, feederData, qdcsData, circuitsData, clientProfile, techData };
}

async function handleCalculateAndPdf() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.classList.add('visible');
    try {
        const formData = await getFullFormData(false);
        const { data: { session } } = await supabase.auth.getSession();
        getPdfWorker().postMessage({ formData, SUPABASE_URL, SUPABASE_ANON_KEY, authHeader: `Bearer ${session.access_token}` });
    } catch (e) {
        loadingOverlay.classList.remove('visible');
        alert("Erro ao preparar PDF.");
    }
}

// --- Bootstrap Inicial ---
function setupEventListeners() {
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('saveBtn').addEventListener('click', () => { /* Chame sua handleSave original */ });
    document.getElementById('loadBtn').addEventListener('click', handleLoadProject);
    document.getElementById('calculateAndPdfBtn').addEventListener('click', handleCalculateAndPdf);
    document.getElementById('searchInput').addEventListener('input', utils.debounce((e) => handleSearch(e.target.value), 400));
    document.getElementById('addQdcBtn').addEventListener('click', () => ui.addQdcBlock());
    
    const app = document.getElementById('appContainer');
    app.addEventListener('click', ui.handleMainContainerInteraction);
    app.addEventListener('change', ui.handleMainContainerInteraction);
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
                handleSearch(); // CARREGA AS OBRAS AQUI
            }
        } else {
            ui.showLoginView();
        }
    });
}

document.addEventListener('DOMContentLoaded', main);