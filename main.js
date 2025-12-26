// Arquivo: main.js (v9.0 - Versão Completa com Web Worker)

import * as auth from './auth.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as utils from './utils.js';
import { supabase } from './supabaseClient.js';

let currentUserProfile = null;
let allClients = [];
let uiData = null;
let pdfWorker = null;

// --- CONFIGURAÇÕES DO SUPABASE ---
// Extraídas do seu supabaseClient.js para o Worker
const SUPABASE_URL = 'https://nlbkcnaocannelwdcqwa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sYmtjbmFvY2FubmVsd2RjcXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNTM4NTYsImV4cCI6MjA3MDgyOTg1Nn0.mLT8AWkqR0bzV_zRhr3d26ujJiv1vJFL03qiOFdHkRU';

// --- INICIALIZAÇÃO DO WORKER ---
function getPdfWorker() {
    if (!pdfWorker) {
        pdfWorker = new Worker('./pdfWorker.js', { type: 'module' });
        
        pdfWorker.onmessage = (e) => {
            const loadingOverlay = document.getElementById('loadingOverlay');
            const { success, pdfBlob, error, obra } = e.data;

            loadingOverlay.classList.remove('visible');

            if (success) {
                // Cria uma URL temporária para o arquivo binário recebido
                const pdfUrl = URL.createObjectURL(pdfBlob);
                
                // Simula o clique para download sem interromper a execução do site
                const a = document.createElement('a');
                a.href = pdfUrl;
                a.download = `Relatorio_${obra?.replace(/[^a-z0-9]/gi, '_') || 'Projeto'}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                // Libera a memória do navegador após 60 segundos
                setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
            } else {
                alert("Erro ao processar PDF no Worker: " + error);
            }
        };
    }
    return pdfWorker;
}

// --- FUNÇÕES DE AUTENTICAÇÃO ---
async function handleLogin() {
    const email = document.getElementById('emailLogin').value;
    const password = document.getElementById('password').value;
    const userProfile = await auth.signInUser(email, password);
    if (!userProfile) {
        console.error("Falha no login ou usuário bloqueado.");
    }
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

async function handleForgotPassword(event) {
    event.preventDefault();
    const email = document.getElementById('forgotEmail').value;
    const { error } = await auth.sendPasswordResetEmail(email);
    if (error) {
        alert("Erro ao enviar e-mail: " + error.message);
    } else {
        alert("Link de redefinição enviado!");
        ui.closeModal('forgotPasswordModalOverlay');
    }
}

async function handleResetPassword(event) {
    event.preventDefault();
    const newPassword = document.getElementById('newPassword').value;
    const { error } = await auth.updatePassword(newPassword);
    if (error) {
        alert("Erro ao atualizar senha: " + error.message);
    } else {
        alert("Senha atualizada com sucesso!");
        window.location.hash = '';
        window.location.reload();
    }
}

// --- GERENCIAMENTO DE CLIENTES ---
async function handleOpenClientManagement() {
    try {
        allClients = await api.fetchClients();
        ui.populateClientManagementModal(allClients);
        ui.openModal('clientManagementModalOverlay');
    } catch(error) {
        alert('Erro ao carregar clientes.');
    }
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
    } catch (error) {
        alert('Erro ao salvar: ' + error.message);
    }
}

async function handleClientListClick(event) {
    const target = event.target;
    const clientId = target.dataset.clientId;
    if (target.classList.contains('edit-client-btn')) {
        const client = allClients.find(c => c.id == clientId);
        if (client) ui.openEditClientForm(client);
    }
    if (target.classList.contains('delete-client-btn')) {
        if (confirm('Deseja excluir este cliente?')) {
            const { error } = await api.deleteClient(clientId);
            if (!error) await handleOpenClientManagement();
        }
    }
}

// --- GERENCIAMENTO DE OBRAS (PROJETOS) ---
async function handleNewProject(showModal = true) {
    if (showModal) {
        allClients = await api.fetchClients();
        ui.populateSelectClientModal(allClients);
    } else {
        ui.resetForm();
    }
}

function handleConfirmClientSelection(isChange = false) {
    const selectedClientId = document.getElementById('clientSelectForNewProject').value;
    const client = allClients.find(c => c.id == selectedClientId);
    if (!isChange) {
        ui.resetForm(true, client);
    } else {
        if (client) {
            document.getElementById('clientLinkDisplay').textContent = `Cliente: ${client.nome}`;
            document.getElementById('currentClientId').value = client.id;
        }
    }
    ui.closeModal('selectClientModalOverlay');
}

async function handleSaveProject() {
    if (!currentUserProfile) return;
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.classList.add('visible');
    try {
        const projectDataToSave = await getFullFormData(true);
        const currentProjectId = document.getElementById('currentProjectId').value;
        const { data, error } = await api.saveProject(projectDataToSave, currentProjectId);
        if (error) throw error;
        alert(`Obra salva: ${data.project_name}`);
        document.getElementById('currentProjectId').value = data.id;
        document.getElementById('project_code').value = data.project_code;
        await handleSearch();
    } catch (error) {
        alert('Erro ao salvar: ' + error.message);
    } finally {
        loadingOverlay.classList.remove('visible');
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
            alert("Obra carregada.");
        }
    } catch (error) {
        alert("Erro ao carregar obra.");
    } finally {
        loadingOverlay.classList.remove('visible');
    }
}

async function handleSearch(term = '') {
    const projects = await api.fetchProjects(term);
    ui.populateProjectList(projects);
}

// --- LÓGICA DE COLETA DE DADOS ---
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
    const clientProfile = client ? { 
        cliente: client.nome, 
        tipoDocumento: client.documento_tipo, 
        documento: client.documento_valor, 
        celular: client.celular, 
        telefone: client.telefone, 
        email: client.email, 
        enderecoCliente: client.endereco 
    } : {};

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
    const circuitsData = [];
    const qdcBlocks = document.querySelectorAll('#qdc-container .qdc-block');

    for (const qdcBlock of qdcBlocks) {
        const qdcId = qdcBlock.dataset.id;
        const config = {};
        qdcBlock.querySelectorAll('.qdc-config-grid input, .qdc-config-grid select').forEach(el => {
            config[el.id] = el.type === 'checkbox' ? el.checked : el.value;
        });

        const circuits = [];
        qdcBlock.querySelectorAll('.circuit-block').forEach(cBlock => {
            const cId = cBlock.dataset.id;
            const cData = { id: cId };
            cBlock.querySelectorAll('input, select').forEach(el => {
                const key = el.id.replace(`-${cId}`, '');
                cData[key] = el.type === 'checkbox' ? el.checked : el.value;
                cData.qdcId = qdcId;
            });
            circuits.push(cData);
            circuitsData.push(cData);
        });

        qdcsData.push({ 
            id: qdcId, 
            name: document.getElementById(`qdcName-${qdcId}`)?.value, 
            parentId: document.getElementById(`qdcParent-${qdcId}`)?.value,
            config, 
            circuits 
        });
        
        // Pequena pausa para não travar o navegador durante a coleta de centenas de inputs
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    if (forSave) return { main_data: mainData, client_id: currentClientId, tech_data: techData, feeder_data: feederData, qdcs_data: qdcsData };
    return { mainData, feederData, qdcsData, circuitsData, clientProfile, techData };
}

// --- DISPARO DO RELATÓRIO PDF ---
async function handleCalculateAndPdf() {
    if (!uiData) return;
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.classList.add('visible');

    try {
        const formData = await getFullFormData(false);
        const { data: { session } } = await supabase.auth.getSession();
        
        // Despacha o trabalho pesado para o Worker em outra thread
        const worker = getPdfWorker();
        worker.postMessage({
            formData,
            SUPABASE_URL,
            SUPABASE_ANON_KEY,
            authHeader: `Bearer ${session?.access_token}`
        });
    } catch (e) {
        loadingOverlay.classList.remove('visible');
        alert("Erro ao preparar dados.");
    }
}

// --- PAINEL ADMINISTRATIVO ---
async function showAdminPanel() {
    const users = await api.fetchAllUsers();
    ui.populateUsersPanel(users);
    ui.openModal('adminPanelModalOverlay');
}

async function handleAdminUserActions(event) {
    const target = event.target;
    const userId = target.dataset.userId;
    if (!userId) return;

    if (target.classList.contains('approve-user-btn')) {
        await api.approveUser(userId);
    } else if (target.classList.contains('block-user-btn')) {
        const isBlocked = target.dataset.isBlocked === 'true';
        await api.toggleUserBlock(userId, !isBlocked);
    } else if (target.classList.contains('remove-user-btn')) {
        if (confirm('Excluir permanentemente?')) await api.deleteUserFromAdmin(userId);
    }
    await showAdminPanel();
}

// --- SETUP INICIAL ---
function setupEventListeners() {
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('registerBtn').addEventListener('click', () => ui.openModal('registerModalOverlay'));
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('saveBtn').addEventListener('click', handleSaveProject);
    document.getElementById('loadBtn').addEventListener('click', handleLoadProject);
    document.getElementById('newBtn').addEventListener('click', () => handleNewProject(true));
    document.getElementById('calculateAndPdfBtn').addEventListener('click', handleCalculateAndPdf);
    document.getElementById('adminPanelBtn').addEventListener('click', showAdminPanel);
    document.getElementById('adminUserList').addEventListener('click', handleAdminUserActions);
    document.getElementById('manageClientsBtn').addEventListener('click', handleOpenClientManagement);
    document.getElementById('clientForm').addEventListener('submit', handleClientFormSubmit);
    document.getElementById('clientList').addEventListener('click', handleClientListClick);
    document.getElementById('confirmClientSelectionBtn').addEventListener('click', () => handleConfirmClientSelection(false));
    
    // Delegação para componentes dinâmicos (QDCs e Circuitos)
    const app = document.getElementById('appContainer');
    app.addEventListener('click', ui.handleMainContainerInteraction);
    app.addEventListener('change', ui.handleMainContainerInteraction);
    app.addEventListener('input', (e) => {
        if (e.target.id.includes('potenciaW') || e.target.id.includes('fatorDemanda')) ui.updateFeederPowerDisplay();
    });
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
                await handleSearch();
            } else {
                await auth.signOutUser();
            }
        } else {
            ui.showLoginView();
        }
    });
}

document.addEventListener('DOMContentLoaded', main);