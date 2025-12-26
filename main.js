// Arquivo: main.js (v9.5 - Versão Integral e Consolidada para Estabilidade Online)

import * as auth from './auth.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as utils from './utils.js';
import { supabase } from './supabaseClient.js';

let currentUserProfile = null;
let allClients = [];
let uiData = null;

// Variável global para gerenciar a limpeza de memória RAM do navegador (Blob URLs)
let currentPdfUrl = null;

// --- 1. FUNÇÕES DE AUTENTICAÇÃO E ACESSO ---

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
    const details = {
        nome: document.getElementById('regNome').value,
        cpf: document.getElementById('regCpf').value,
        telefone: document.getElementById('regTelefone').value,
        crea: document.getElementById('regCrea').value,
        email: document.getElementById('regEmail').value
    };
    const { error } = await auth.signUpUser(details.email, document.getElementById('regPassword').value, details);
    if (!error) {
        alert('Cadastro realizado com sucesso! Aguarde a aprovação de um administrador.');
        ui.closeModal('registerModalOverlay');
        event.target.reset();
    }
}

async function handleForgotPassword(event) {
    event.preventDefault();
    const email = document.getElementById('forgotEmail').value;
    const { error } = await auth.sendPasswordResetEmail(email);
    if (error) alert("Erro: " + error.message);
    else {
        alert("Link de redefinição enviado!");
        ui.closeModal('forgotPasswordModalOverlay');
    }
}

async function handleResetPassword(event) {
    event.preventDefault();
    const newPassword = document.getElementById('newPassword').value;
    if (newPassword.length < 6) { alert("Mínimo 6 caracteres."); return; }
    const { error } = await auth.updatePassword(newPassword);
    if (!error) {
        alert("Senha atualizada! Por favor, faça login novamente.");
        window.location.hash = '';
        window.location.reload();
    }
}

// --- 2. GESTÃO DE CLIENTES ---

async function handleOpenClientManagement() {
    try {
        allClients = await api.fetchClients();
        ui.populateClientManagementModal(allClients);
        ui.openModal('clientManagementModalOverlay');
    } catch(error) { console.error("Erro ao carregar clientes:", error); }
}

async function handleClientFormSubmit(event) {
    event.preventDefault();
    const clientId = document.getElementById('clientId').value;
    const clientData = {
        nome: document.getElementById('clientNome').value,
        documento_tipo: document.getElementById('clientDocumentoTipo').value,
        documento_valor: document.getElementById('clientDocumentoValor').value,
        email: document.getElementById('clientEmail').value,
        celular: document.getElementById('clientCelular').value,
        telefone: document.getElementById('clientTelefone').value,
        endereco: document.getElementById('clientEndereco').value,
        owner_id: currentUserProfile.id
    };
    try {
        let result = clientId ? await api.updateClient(clientId, clientData) : await api.addClient(clientData);
        if (result.error) throw result.error;
        alert('Cliente salvo com sucesso!');
        ui.resetClientForm();
        await handleOpenClientManagement();
    } catch (error) { alert('Erro: ' + error.message); }
}

async function handleClientListClick(event) {
    const target = event.target;
    const clientId = target.dataset.clientId;
    if (target.classList.contains('edit-client-btn')) {
        const client = allClients.find(c => c.id == clientId);
        if (client) ui.openEditClientForm(client);
    }
    if (target.classList.contains('delete-client-btn') && confirm('Excluir este cliente?')) {
        const { error } = await api.deleteClient(clientId);
        if (!error) await handleOpenClientManagement();
    }
}

// --- 3. GESTÃO DE OBRAS (PROJETOS) ---

async function handleNewProject(showModal = true) {
    if (showModal) {
        allClients = await api.fetchClients();
        ui.populateSelectClientModal(allClients);
        ui.openModal('selectClientModalOverlay');
    } else { ui.resetForm(); }
}

function handleConfirmClientSelection(isChange = false) {
    const selectedId = document.getElementById('clientSelectForNewProject').value;
    const client = allClients.find(c => c.id == selectedId);
    if (!isChange) ui.resetForm(true, client);
    else if (client) {
        document.getElementById('clientLinkDisplay').textContent = `Cliente: ${client.nome}`;
        document.getElementById('currentClientId').value = client.id;
    }
    ui.closeModal('selectClientModalOverlay');
}

// CORREÇÃO: Função para garantir que o Alimentador Geral não inicie zerado
async function populateFormWithProjectData(project) {
    if (!project) return;
    ui.resetForm(false, project.client);
    if (typeof ui.setLoadedProjectData === 'function') ui.setLoadedProjectData(project);

    document.getElementById('currentProjectId').value = project.id;

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

    if (project.feeder_data) {
        Object.keys(project.feeder_data).forEach(k => {
            const el = document.getElementById(k);
            if (el) el.type === 'checkbox' ? el.checked = project.feeder_data[k] : el.value = project.feeder_data[k];
        });
        document.getElementById('feederFases')?.dispatchEvent(new Event('change'));
        document.getElementById('feederTipoIsolacao')?.dispatchEvent(new Event('change'));
    }

    if (project.qdcs_data) {
        const qdcTarget = document.getElementById('qdc-container');
        const frag = document.createDocumentFragment();
        
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

        sorted.forEach(q => {
            const rid = ui.addQdcBlock(String(q.id), q.name, q.parentId, frag);
            const qEl = frag.querySelector(`#qdc-${rid}`);
            if (q.config && qEl) {
                Object.keys(q.config).forEach(k => {
                    const inp = qEl.querySelector(`#${k}`);
                    if (inp) inp.type === 'checkbox' ? inp.checked = q.config[k] : inp.value = q.config[k];
                });
            }
        });
        qdcTarget.appendChild(frag);

        for (const q of sorted) {
            const rid = String(q.id);
            ui.initializeQdcListeners(rid);
            document.getElementById(`qdcFases-${rid}`)?.dispatchEvent(new Event('change'));
            document.getElementById(`qdcTipoIsolacao-${rid}`)?.dispatchEvent(new Event('change'));
            
            // Força o carregamento dos circuitos via Lazy Loading para a soma de carga
            const block = document.getElementById(`qdc-${rid}`);
            if (block) {
                const btn = block.querySelector('.toggle-circuits-btn');
                if (btn) ui.handleMainContainerInteraction({ target: btn, type: 'click', stopPropagation: () => {} });
            }
        }
        ui.updateQdcParentDropdowns();
        setTimeout(() => { ui.updateFeederPowerDisplay(); }, 1000);
    }
}

// --- 4. CÁLCULO E GERAÇÃO DE PDF (COM GESTÃO DE RAM) ---

async function handleCalculateAndPdf() {
    if (!uiData || !currentUserProfile) return;
    const overlay = document.getElementById('loadingOverlay');
    const text = overlay.querySelector('p');

    // LIBERAÇÃO DE MEMÓRIA: Revoga a URL do Blob anterior para evitar travamentos
    if (currentPdfUrl) { 
        URL.revokeObjectURL(currentPdfUrl); 
        currentPdfUrl = null; 
        console.log("RAM liberada.");
    }
    document.getElementById('pdfLinkContainer')?.remove();

    text.textContent = 'Coletando dados da obra...';
    overlay.classList.add('visible');

    try {
        const formData = await getFullFormData(false);
        text.textContent = 'Calculando e gerando PDF (isso pode demorar em obras grandes)...';
        
        const { data: blob, error } = await supabase.functions.invoke('gerar-relatorio', { 
            body: { formData }, 
            responseType: 'blob' 
        });

        if (error) throw error;
        if (!blob || blob.size === 0) throw new Error("A função não retornou um arquivo válido.");

        // Gerar nova URL e disparar download automático
        currentPdfUrl = URL.createObjectURL(blob);
        const fileName = `Relatorio_${document.getElementById('obra').value.replace(/\s+/g, '_')}.pdf`;

        const a = document.createElement('a');
        a.href = currentPdfUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Backup manual para download
        const div = document.createElement('div');
        div.id = 'pdfLinkContainer';
        div.style.textAlign = 'center';
        div.innerHTML = `<a href="${currentPdfUrl}" class="btn-green" style="display:inline-block; margin-top:15px;">Baixar Relatório Novamente</a>`;
        document.querySelector('.button-container').after(div);

        alert("PDF gerado com sucesso!");
    } catch (e) { 
        console.error("Erro na geração do PDF:", e);
        alert("Erro: " + e.message); 
    } finally { 
        overlay.classList.remove('visible'); 
    }
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
    const clientProfile = client ? { 
        cliente: client.nome, documento: client.documento_valor, 
        tipoDocumento: client.documento_tipo, email: client.email, 
        celular: client.celular, enderecoCliente: client.endereco 
    } : {};
    const techData = { 
        respTecnico: document.getElementById('respTecnico').value, 
        titulo: document.getElementById('titulo').value, 
        crea: document.getElementById('crea').value 
    };
    
    const feederData = {};
    const feederCalc = { id: 'feeder', nomeCircuito: "Alimentador Geral" };
    document.querySelectorAll('#feeder-form input, #feeder-form select').forEach(el => {
        const v = el.type === 'checkbox' ? el.checked : el.value;
        feederData[el.id] = v;
        const k = el.id.replace('feeder', '').charAt(0).toLowerCase() + el.id.replace('feeder', '').slice(1);
        feederCalc[k] = (el.type === 'number') ? parseFloat(v) : v;
    });

    const qdcsSave = []; const qdcsCalc = []; const circsCalc = [];
    const qdcBlocks = document.querySelectorAll('#qdc-container .qdc-block');

    for (const block of qdcBlocks) {
        const qid = block.dataset.id;
        const qSave = {}; const qCalc = {};
        block.querySelectorAll('.qdc-config-grid input, .qdc-config-grid select').forEach(el => {
            const v = el.type === 'checkbox' ? el.checked : el.value;
            qSave[el.id] = v;
            const k = el.id.replace('qdc', '').replace(`-${qid}`, '').replace(/^[A-Z]/, l => l.toLowerCase());
            qCalc[k] = (el.type === 'number') ? parseFloat(v) : v;
        });
        const qInfo = { id: qid, name: document.getElementById(`qdcName-${qid}`)?.value, parentId: document.getElementById(`qdcParent-${qid}`)?.value };
        qdcsCalc.push({ ...qInfo, config: qCalc });

        const cSave = [];
        block.querySelectorAll('.circuit-block').forEach(cb => {
            const cid = cb.dataset.id;
            const cs = { id: cid }; const cc = { qdcId: qid, id: cid };
            cb.querySelectorAll('input, select').forEach(el => {
                const val = el.type === 'checkbox' ? el.checked : el.value;
                cs[el.id] = val;
                const key = el.id.replace(`-${cid}`, '');
                cc[key] = (el.type === 'number') ? parseFloat(val) : val;
            });
            cSave.push(cs); circsCalc.push(cc);
        });
        qdcsSave.push({ ...qInfo, config: qSave, circuits: cSave });
        await new Promise(r => setTimeout(r, 0)); // Evita travamento da interface
    }

    return forSave ? 
        { project_name: mainData.obra, project_code: mainData.projectCode, client_id: clientId, main_data: mainData, tech_data: techData, feeder_data: feederData, qdcs_data: qdcsSave, owner_id: currentUserProfile?.id } : 
        { mainData, feederData: feederCalc, qdcsData: qdcsCalc, circuitsData: circsCalc, clientProfile, techData };
}

// --- 5. ADMINISTRAÇÃO E AUXILIARES ---

async function handleSaveProject() {
    const d = await getFullFormData(true);
    const id = document.getElementById('currentProjectId').value;
    const { data: res, error } = await api.saveProject(d, id);
    if (!error) { 
        alert("Projeto salvo com sucesso!"); 
        document.getElementById('currentProjectId').value = res.id;
        handleSearch(); 
    }
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
    try {
        const users = await api.fetchAllUsers();
        ui.populateUsersPanel(users);
        ui.openModal('adminPanelModalOverlay');
    } catch (e) { console.error("Erro no painel admin:", e); }
}

async function handleAdminUserActions(event) {
    const target = event.target;
    const userId = target.dataset.userId;
    if (!userId) return;
    if (target.classList.contains('approve-user-btn')) { await api.approveUser(userId); showAdminPanel(); }
    if (target.classList.contains('block-user-btn')) { 
        const block = target.dataset.isBlocked !== 'true';
        if (confirm(`Confirmar ${block ? 'bloqueio' : 'desbloqueio'}?`)) { await api.toggleUserBlock(userId, block); showAdminPanel(); }
    }
    if (target.classList.contains('remove-user-btn') && confirm('Excluir este usuário permanentemente?')) {
        await api.deleteUserFromAdmin(userId);
        showAdminPanel();
    }
}

// --- 6. LISTENERS E INICIALIZAÇÃO ---

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
    document.getElementById('clientForm').addEventListener('submit', handleClientFormSubmit);
    document.getElementById('clientList').addEventListener('click', handleClientListClick);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('confirmClientSelectionBtn').addEventListener('click', () => handleConfirmClientSelection());
    document.getElementById('changeClientBtn')?.addEventListener('click', () => handleOpenClientManagement());

    document.getElementById('searchInput').addEventListener('input', utils.debounce((e) => handleSearch(e.target.value), 300));

    const app = document.getElementById('appContainer');
    if (app) {
        app.addEventListener('change', ui.handleMainContainerInteraction);
        app.addEventListener('click', ui.handleMainContainerInteraction);
        app.addEventListener('input', (e) => {
            if (e.target.id.includes('potencia') || e.target.id.includes('fatorDemanda')) ui.updateFeederPowerDisplay();
        });
    }
    
    // Máscaras de CPF e Celular
    document.getElementById('regCpf')?.addEventListener('input', utils.mascaraCPF);
    document.getElementById('regTelefone')?.addEventListener('input', utils.mascaraCelular);
}

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            currentUserProfile = await auth.getSession();
            if (currentUserProfile?.is_approved && !currentUserProfile?.is_blocked) {
                // Carrega dados técnicos APENAS se ainda não existirem
                if (!uiData) {
                    uiData = await api.fetchUiData();
                    if (uiData) {
                        ui.setupDynamicData(uiData);
                        ui.showAppView(currentUserProfile);
                        handleSearch();
                    } else {
                        console.error("Falha ao carregar dados técnicos.");
                        await auth.signOutUser();
                    }
                }
            } else { ui.showLoginView(); }
        } else { ui.showLoginView(); }
    });
});