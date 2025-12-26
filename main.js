// Arquivo: main.js (v9.6 - Estabilidade Máxima e Carregamento Cadenciado)

import * as auth from './auth.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as utils from './utils.js';
import { supabase } from './supabaseClient.js';

let currentUserProfile = null;
let allClients = [];
let uiData = null;

// Controle de memória para evitar travamento após gerar PDFs grandes
let currentPdfUrl = null;

// --- 1. AUTENTICAÇÃO E ACESSO ---

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
        event.target.reset();
    }
}

// --- 2. GESTÃO DE OBRAS E CARREGAMENTO (CORREÇÃO DE TRAVAMENTO) ---

async function populateFormWithProjectData(project) {
    if (!project) return;
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = loadingOverlay.querySelector('p');
    
    loadingText.textContent = 'Iniciando carregamento da obra...';
    loadingOverlay.classList.add('visible');

    ui.resetForm(false, project.client);
    if (typeof ui.setLoadedProjectData === 'function') ui.setLoadedProjectData(project);

    document.getElementById('currentProjectId').value = project.id;

    // Preenche dados básicos (Main e Tech)
    if (project.main_data) {
        Object.keys(project.main_data).forEach(k => {
            const el = document.getElementById(k);
            if (el) el.value = project.main_data[k];
        });
    }
    document.getElementById('project_code').value = project.project_code || '';
    if (project.tech_data) {
        Object.keys(project.tech_data).forEach(k => {
            const el = document.getElementById(k);
            if (el) el.value = project.tech_data[k];
        });
    }

    // Alimenta o formulário do Alimentador Geral
    if (project.feeder_data) {
        Object.keys(project.feeder_data).forEach(k => {
            const el = document.getElementById(k);
            if (el) el.type === 'checkbox' ? el.checked = project.feeder_data[k] : el.value = project.feeder_data[k];
        });
        document.getElementById('feederFases')?.dispatchEvent(new Event('change'));
        document.getElementById('feederTipoIsolacao')?.dispatchEvent(new Event('change'));
    }

    // Carregamento de QDCs com processamento cadenciado (evita congelamento)
    if (project.qdcs_data) {
        const qdcContainer = document.getElementById('qdc-container');
        const frag = document.createDocumentFragment();
        
        // Ordenação lógica
        const qdcMap = new Map();
        project.qdcs_data.forEach(q => qdcMap.set(String(q.id), q));
        const sorted = []; const visited = new Set();
        function visit(id) {
            if (!id || visited.has(id)) return;
            const q = qdcMap.get(id);
            if (!q) return;
            visited.add(id);
            if (q.parentId && q.parentId !== 'feeder') visit(q.parentId.replace('qdc-', ''));
            sorted.push(q);
        }
        project.qdcs_data.forEach(q => visit(String(q.id)));

        // Renderiza as "caixas" dos QDCs
        sorted.forEach(q => {
            const rid = ui.addQdcBlock(String(q.id), q.name, q.parentId, frag);
            const qdcEl = frag.querySelector(`#qdc-${rid}`);
            if (q.config && qdcEl) {
                Object.keys(q.config).forEach(k => {
                    const inp = qdcEl.querySelector(`#${k}`);
                    if (inp) inp.type === 'checkbox' ? inp.checked = q.config[k] : inp.value = q.config[k];
                });
            }
        });
        qdcContainer.appendChild(frag);

        // Carrega circuitos um por um com pequena pausa
        for (const q of sorted) {
            const rid = String(q.id);
            loadingText.textContent = `Carregando circuitos: ${q.name || rid}...`;
            
            ui.initializeQdcListeners(rid);
            document.getElementById(`qdcFases-${rid}`)?.dispatchEvent(new Event('change'));
            document.getElementById(`qdcTipoIsolacao-${rid}`)?.dispatchEvent(new Event('change'));
            
            const block = document.getElementById(`qdc-${rid}`);
            if (block) {
                const btn = block.querySelector('.toggle-circuits-btn');
                // Chamada direta para carregar circuitos sem travar a interface
                if (btn) await ui.handleMainContainerInteraction({ target: btn, type: 'click', stopPropagation: () => {} });
            }
            // Pausa de 10ms entre QDCs para liberar o processador
            await new Promise(r => setTimeout(r, 10));
        }

        ui.updateQdcParentDropdowns();
        loadingText.textContent = 'Finalizando cálculos de carga...';
        setTimeout(() => { 
            ui.updateFeederPowerDisplay();
            loadingOverlay.classList.remove('visible');
        }, 500);
    } else {
        loadingOverlay.classList.remove('visible');
    }
}

// --- 3. GERAÇÃO DE PDF E MEMÓRIA ---

async function handleCalculateAndPdf() {
    if (!uiData || !currentUserProfile) return;
    const overlay = document.getElementById('loadingOverlay');
    if (currentPdfUrl) { URL.revokeObjectURL(currentPdfUrl); currentPdfUrl = null; }
    document.getElementById('pdfLinkContainer')?.remove();

    overlay.classList.add('visible');
    overlay.querySelector('p').textContent = 'Gerando relatório PDF...';

    try {
        const formData = await getFullFormData(false);
        const { data: blob, error } = await supabase.functions.invoke('gerar-relatorio', { body: { formData }, responseType: 'blob' });
        if (error) throw error;

        currentPdfUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = currentPdfUrl;
        a.download = `Relatorio_${document.getElementById('obra').value.replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        alert("Relatório gerado!");
    } catch (e) { alert("Erro ao gerar PDF: " + e.message); }
    finally { overlay.classList.remove('visible'); }
}

async function getFullFormData(forSave = false) {
    const mainData = { 
        obra: document.getElementById('obra').value, cidadeObra: document.getElementById('cidadeObra').value,
        enderecoObra: document.getElementById('enderecoObra').value, areaObra: document.getElementById('areaObra').value,
        unidadesResidenciais: document.getElementById('unidadesResidenciais').value, unidadesComerciais: document.getElementById('unidadesComerciais').value,
        observacoes: document.getElementById('observacoes').value, projectCode: document.getElementById('project_code').value
    };
    const clientId = document.getElementById('currentClientId').value;
    const client = allClients.find(c => c.id == clientId);
    const clientProfile = client ? { cliente: client.nome, documento: client.documento_valor, tipoDocumento: client.documento_tipo, email: client.email, celular: client.celular, enderecoCliente: client.endereco } : {};
    
    const feederCalc = { id: 'feeder' };
    document.querySelectorAll('#feeder-form input, #feeder-form select').forEach(el => {
        const k = el.id.replace('feeder', '').charAt(0).toLowerCase() + el.id.replace('feeder', '').slice(1);
        feederCalc[k] = (el.type === 'number') ? parseFloat(el.value) : el.value;
    });

    const qdcsSave = []; const qdcsCalc = []; const circsCalc = [];
    const qdcBlocks = document.querySelectorAll('#qdc-container .qdc-block');

    for (const block of qdcBlocks) {
        const qid = block.dataset.id;
        const qInfo = { id: qid, name: document.getElementById(`qdcName-${qid}`)?.value, parentId: document.getElementById(`qdcParent-${qid}`)?.value };
        
        const qConfig = {};
        block.querySelectorAll('.qdc-config-grid input, .qdc-config-grid select').forEach(el => {
            const k = el.id.replace('qdc', '').replace(`-${qid}`, '').replace(/^[A-Z]/, l => l.toLowerCase());
            qConfig[k] = (el.type === 'number') ? parseFloat(el.value) : el.value;
        });
        qdcsCalc.push({ ...qInfo, config: qConfig });

        const cSave = [];
        block.querySelectorAll('.circuit-block').forEach(cb => {
            const cid = cb.dataset.id;
            const cc = { qdcId: qid, id: cid };
            cb.querySelectorAll('input, select').forEach(el => {
                const k = el.id.replace(`-${cid}`, '');
                cc[k] = (el.type === 'number') ? parseFloat(el.value) : el.value;
            });
            cSave.push({ id: cid }); circsCalc.push(cc);
        });
        qdcsSave.push({ ...qInfo, config: qConfig, circuits: cSave });
        await new Promise(r => setTimeout(r, 0));
    }

    return forSave ? 
        { project_name: mainData.obra, project_code: mainData.projectCode, client_id: clientId, main_data: mainData, tech_data: {}, feeder_data: {}, qdcs_data: qdcsSave, owner_id: currentUserProfile?.id } : 
        { mainData, feederData: feederCalc, qdcsData: qdcsCalc, circuitsData: circsCalc, clientProfile, techData: {} };
}

// --- 4. FUNÇÕES DE ADMIN E BUSCA ---

async function handleSaveProject() {
    const data = await getFullFormData(true);
    const id = document.getElementById('currentProjectId').value;
    const { data: res, error } = await api.saveProject(data, id);
    if (!error) { alert("Obra salva!"); handleSearch(); }
}

async function handleLoadProject() {
    const id = document.getElementById('savedProjectsSelect').value;
    if (!id) return;
    const p = await api.fetchProjectById(id);
    if (p) populateFormWithProjectData(p);
}

async function handleSearch(term = '') {
    const projs = await api.fetchProjects(term);
    ui.populateProjectList(projs);
}

async function showAdminPanel() {
    const users = await api.fetchAllUsers();
    ui.populateUsersPanel(users);
    ui.openModal('adminPanelModalOverlay');
}

// --- 5. LISTENERS E INICIALIZAÇÃO ---

function setupEventListeners() {
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('saveBtn').addEventListener('click', handleSaveProject);
    document.getElementById('loadBtn').addEventListener('click', handleLoadProject);
    document.getElementById('calculateAndPdfBtn').addEventListener('click', handleCalculateAndPdf);
    document.getElementById('newBtn').addEventListener('click', () => handleNewProject(true));
    document.getElementById('addQdcBtn').addEventListener('click', () => ui.addQdcBlock());
    document.getElementById('adminPanelBtn').addEventListener('click', showAdminPanel);
    document.getElementById('manageClientsBtn').addEventListener('click', handleOpenClientManagement);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    
    document.getElementById('searchInput').addEventListener('input', utils.debounce((e) => handleSearch(e.target.value), 300));

    const app = document.getElementById('appContainer');
    if (app) {
        app.addEventListener('change', ui.handleMainContainerInteraction);
        app.addEventListener('click', ui.handleMainContainerInteraction);
        app.addEventListener('input', (e) => {
            if (e.target.id.includes('potencia') || e.target.id.includes('fatorDemanda')) ui.updateFeederPowerDisplay();
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    supabase.auth.onAuthStateChange(async (ev, sess) => {
        if (sess) {
            currentUserProfile = await auth.getSession();
            if (currentUserProfile?.is_approved && !currentUserProfile?.is_blocked) {
                if (!uiData) {
                    uiData = await api.fetchUiData();
                    ui.setupDynamicData(uiData);
                    ui.showAppView(currentUserProfile);
                    handleSearch();
                }
            } else { ui.showLoginView(); }
        } else { ui.showLoginView(); }
    });
});