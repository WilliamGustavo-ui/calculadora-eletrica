// Arquivo: main.js

import * as auth from './auth.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as utils from './utils.js';
import { supabase } from './supabaseClient.js';

let currentUserProfile = null;
let technicalData = null;
let clients = [];
let currentClient = null;

function main() {
    setupEventListeners();
    utils.atualizarMascaraDocumento();
}

function setupEventListeners() {
    // Autenticação
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('forgotPasswordForm').addEventListener('submit', handleForgotPassword);
    document.getElementById('resetPasswordForm').addEventListener('submit', handleResetPassword);
    
    // Modais
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => ui.closeModal(e.target.dataset.modalId));
    });

    // Ações de Projeto (Obras)
    document.getElementById('saveBtn').addEventListener('click', handleSaveProject);
    document.getElementById('loadBtn').addEventListener('click', handleLoadProject);
    document.getElementById('deleteBtn').addEventListener('click', handleDeleteProject);
    document.getElementById('newBtn').addEventListener('click', handleNewProject);
    document.getElementById('searchInput').addEventListener('input', (e) => handleSearch(e.target.value));

    // Ações de Cliente
    document.getElementById('clientManagementBtn').addEventListener('click', handleShowClientManagement);
    document.getElementById('clientForm').addEventListener('submit', handleSaveClient);
    document.getElementById('newClientBtn').addEventListener('click', handleNewClient);
    document.getElementById('deleteClientBtn').addEventListener('click', handleDeleteClient);
    document.getElementById('clientList').addEventListener('click', handleLoadClient);
    document.getElementById('clientSearchInput').addEventListener('input', (e) => handleSearchClients(e.target.value));
    document.getElementById('clientDocumentType').addEventListener('change', ui.toggleLegalRepSection);
    document.getElementById('clientSearch').addEventListener('blur', handleLinkClientToProject);
    
    // Ações de Circuito
    document.getElementById('addCircuitBtn').addEventListener('click', ui.addCircuit);
    document.getElementById('circuits-container').addEventListener('click', e => {
        if (e.target.classList.contains('remove-btn')) {
            ui.removeCircuit(e.target.dataset.circuitId);
        }
    });
    
    // Cálculos e PDF
    document.getElementById('calculateBtn').addEventListener('click', handleCalculate);
    document.getElementById('pdfBtn').addEventListener('click', handleGeneratePdf);
    
    // Admin
    document.getElementById('adminPanelBtn').addEventListener('click', showAdminPanel);
    document.getElementById('manageProjectsBtn').addEventListener('click', showManageProjectsPanel);
    document.getElementById('adminUserList').addEventListener('click', handleAdminUserActions);
    document.getElementById('editUserForm').addEventListener('submit', handleUpdateUser);
    document.getElementById('adminProjectsTableBody').addEventListener('click', handleAdminProjectActions);
    document.getElementById('saveUserPermissionsBtn').addEventListener('click', handleUpdatePermissions);
}

async function handleLogin() {
    const email = document.getElementById('emailLogin').value;
    const password = document.getElementById('password').value;
    const userProfile = await auth.signInUser(email, password);

    if (userProfile && userProfile.is_approved) {
        currentUserProfile = userProfile;
        ui.showAppView(currentUserProfile);
        await loadInitialData();
    }
}

async function handleLogout() {
    await auth.signOutUser();
    currentUserProfile = null;
    technicalData = null;
    clients = [];
    currentClient = null;
    ui.showLoginView();
}

supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'INITIAL_SESSION' && session) {
        const userProfile = await auth.getSession();
        if (userProfile && !userProfile.is_blocked && userProfile.is_approved) {
            currentUserProfile = userProfile;
            ui.showAppView(currentUserProfile);
            await loadInitialData();
        } else {
            ui.showLoginView();
        }
    } else if (event === 'SIGNED_OUT') {
        ui.showLoginView();
    }
});

async function loadInitialData() {
    technicalData = await api.fetchTechnicalData();
    await handleSearch();
}

async function handleSearch(term = '') {
    if (!currentUserProfile) return;
    const projects = await api.fetchProjects(term, currentUserProfile);
    ui.populateProjectList(projects);
}

// --- LÓGICA DE CLIENTES ---

async function handleShowClientManagement() {
    ui.openModal('clientManagementModalOverlay');
    handleNewClient();
    await handleSearchClients();
}

async function handleSearchClients(searchTerm = '') {
    clients = await api.fetchClients(searchTerm, currentUserProfile);
    ui.populateClientList(clients, currentClient);
}

function handleNewClient() {
    currentClient = null;
    ui.resetClientForm();
    ui.populateClientList(clients, null);
}

async function handleLoadClient(event) {
    const target = event.target.closest('li');
    if (!target) return;

    const clientId = target.dataset.clientId;
    currentClient = clients.find(c => c.id == clientId);
    
    if (currentClient) {
        ui.populateClientList(clients, currentClient);
        ui.populateClientForm(currentClient);
        
        const projects = await api.fetchProjects(null, currentUserProfile);
        const clientProjects = projects.filter(p => p.client_id === currentClient.id);
        ui.populateClientProjectsList(clientProjects);

        if (currentUserProfile.is_admin) {
            const allUsers = await api.fetchAllUsers();
            const permittedUserIds = await api.getClientUserPermissions(currentClient.id);
            ui.populateUserPermissions(allUsers, permittedUserIds);
        }
    }
}

async function handleSaveClient(event) {
    event.preventDefault();
    const clientId = document.getElementById('currentClientId').value;
    const clientData = {
        name: document.getElementById('clientName').value,
        document_type: document.getElementById('clientDocumentType').value,
        document_number: document.getElementById('clientDocumentNumber').value,
        address: document.getElementById('clientAddress').value,
        phone: document.getElementById('clientPhone').value,
        mobile_phone: document.getElementById('clientMobile').value,
        email: document.getElementById('clientEmail').value,
        billing_email: document.getElementById('clientBillingEmail').value
    };

    if (clientData.document_type === 'CNPJ') {
        clientData.legal_rep_name = document.getElementById('legalRepName').value;
        clientData.legal_rep_cpf = document.getElementById('legalRepCpf').value;
        clientData.legal_rep_phone = document.getElementById('legalRepPhone').value;
        clientData.legal_rep_mobile = document.getElementById('legalRepMobile').value;
        clientData.legal_rep_email = document.getElementById('legalRepEmail').value;
    }
    
    const { error } = await api.saveClient(clientData, clientId);
    if (error) {
        alert("Erro ao salvar cliente: " + error.message);
    } else {
        alert("Cliente salvo com sucesso!");
        handleNewClient();
        await handleSearchClients();
    }
}

async function handleDeleteClient() {
    const clientId = document.getElementById('currentClientId').value;
    if (!clientId) return alert("Nenhum cliente selecionado.");
    
    if (confirm(`Tem certeza que deseja excluir o cliente "${currentClient.name}"?`)) {
        const { error } = await api.deleteClient(clientId);
        if (error) {
            alert("Erro ao excluir cliente: " + error.message);
        } else {
            alert("Cliente excluído com sucesso.");
            handleNewClient();
            await handleSearchClients();
        }
    }
}

// --- LÓGICA DE OBRAS ---

async function handleSaveProject() {
    const clientSearchValue = document.getElementById('clientSearch').value.trim();
    const linkedClient = clients.find(c => c.client_code === clientSearchValue);
    
    const projectData = {
        // ... coletar outros dados da obra
        client_id: linkedClient ? linkedClient.id : null,
        project_code: document.getElementById('projectCode').value.trim() || null
    };
    const currentProjectId = document.getElementById('currentProjectId').value;
    try {
        const { data } = await api.saveProject(projectData, currentProjectId);
        alert(`Obra "${data.project_name}" salva com sucesso!`);
        document.getElementById('currentProjectId').value = data.id;
        document.getElementById('projectCode').value = data.project_code;
        await handleSearch();
    } catch (error) {
        alert('Erro ao salvar obra: ' + error.message);
    }
}

async function handleLoadProject() {
    const projectId = document.getElementById('savedProjectsSelect').value;
    if (!projectId) return;

    const project = await api.fetchProjectById(projectId);
    if (project) {
        ui.populateFormWithProjectData(project);
        if (project.client_id) {
            const allClients = await api.fetchClients('', { is_admin: true });
            const client = allClients.find(c => c.id === project.client_id);
            if(client) ui.linkClientToProjectForm(client);
        } else {
            ui.clearProjectClientInfo();
        }
        alert(`Obra "${project.project_name}" carregada.`);
    }
}

async function handleLinkClientToProject(event) {
    const searchTerm = event.target.value.trim();
    if (!searchTerm) return ui.clearProjectClientInfo();
    
    const foundClients = await api.fetchClients(searchTerm, currentUserProfile);
    if (foundClients.length === 1) {
        ui.linkClientToProjectForm(foundClients[0]);
    } else {
        ui.clearProjectClientInfo();
        if (searchTerm) {
            alert(foundClients.length > 1 ? "Múltiplos clientes encontrados. Por favor, seja mais específico." : "Nenhum cliente encontrado.");
        }
    }
}

// ... Outras funções handle...
async function handleRegister(event) { /* ...código de cadastro... */ }
async function handleForgotPassword(event) { /* ...código de redefinição de senha... */ }
async function handleResetPassword(event) { /* ...código de nova senha... */ }
function handleNewProject() { /* ...código para novo projeto... */ }
async function handleDeleteProject() { /* ...código para deletar projeto... */ }
function handleCalculate() { /* ...código para calcular... */ }
function handleGeneratePdf() { /* ...código para gerar PDF... */ }
async function showAdminPanel() { /* ...código do painel de admin... */ }
async function showManageProjectsPanel() { /* ...código do painel de obras... */ }
async function handleAdminUserActions(event) {
    // ... lógica para aprovar, bloquear, excluir usuário ...
}
async function handleUpdateUser(event) { /* ...código para atualizar usuário... */ }
async function handleAdminProjectActions(event) { /* ...código para transferir obras... */ }
async function handleUpdatePermissions() { /* ...código para atualizar permissões... */ }


// --- PONTO DE ENTRADA DA APLICAÇÃO ---
document.addEventListener('DOMContentLoaded', main);