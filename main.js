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
    
    // Gerenciamento de Clientes
    document.getElementById('clientManagementBtn').addEventListener('click', handleShowClientManagement);
    document.getElementById('clientForm').addEventListener('submit', handleSaveClient);
    document.getElementById('newClientBtn').addEventListener('click', handleNewClient);
    document.getElementById('deleteClientBtn').addEventListener('click', handleDeleteClient);
    document.getElementById('clientList').addEventListener('click', handleLoadClient);
    document.getElementById('clientSearchInput').addEventListener('input', (e) => handleSearchClients(e.target.value));
    document.getElementById('clientDocumentType').addEventListener('change', ui.toggleLegalRepSection);
    
    // Gerenciamento de Obras
    document.getElementById('saveBtn').addEventListener('click', handleSaveProject);
    document.getElementById('loadBtn').addEventListener('click', handleLoadProject);
    document.getElementById('deleteBtn').addEventListener('click', handleDeleteProject);
    document.getElementById('newBtn').addEventListener('click', handleNewProject);
    document.getElementById('clientSearch').addEventListener('blur', handleLinkClientToProject);

    // Admin
    document.getElementById('adminPanelBtn').addEventListener('click', showAdminPanel);
    document.getElementById('manageProjectsBtn').addEventListener('click', showManageProjectsPanel);
    document.getElementById('adminUserList').addEventListener('click', handleAdminUserActions);
    document.getElementById('saveUserPermissionsBtn').addEventListener('click', handleUpdatePermissions);
    document.getElementById('adminProjectsTableBody').addEventListener('click', handleAdminProjectActions);

    // Outros
    document.querySelectorAll('.close-modal-btn').forEach(btn => { btn.addEventListener('click', (e) => ui.closeModal(e.target.dataset.modalId)); });
    document.getElementById('addCircuitBtn').addEventListener('click', ui.addCircuit);
    document.getElementById('calculateBtn').addEventListener('click', handleCalculate);
    document.getElementById('pdfBtn').addEventListener('click', handleGeneratePdf);
}

// --- LÓGICA PRINCIPAL ---

async function handleLogin() {
    const email = document.getElementById('emailLogin').value;
    const password = document.getElementById('password').value;
    const userProfile = await auth.signInUser(email, password);
    if (userProfile) {
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
        // ... coletar outros dados do responsável
    }
    const { error } = await api.saveClient(clientData, clientId);
    if (error) {
        alert("Erro ao salvar cliente: " + error.message);
    } else {
        alert("Cliente salvo!");
        handleNewClient();
        await handleSearchClients();
    }
}

async function handleDeleteClient() {
    const clientId = document.getElementById('currentClientId').value;
    if (!clientId) return alert("Nenhum cliente selecionado.");
    if (confirm(`Excluir o cliente "${currentClient.name}"?`)) {
        const { error } = await api.deleteClient(clientId);
        if (error) {
            alert("Erro ao excluir: " + error.message);
        } else {
            alert("Cliente excluído.");
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
        // ... outros dados da obra
        client_id: linkedClient ? linkedClient.id : null,
        project_code: document.getElementById('projectCode').value.trim() || null
    };
    const currentProjectId = document.getElementById('currentProjectId').value;
    try {
        const { data } = await api.saveProject(projectData, currentProjectId);
        alert(`Obra "${data.project_name}" salva!`);
        document.getElementById('currentProjectId').value = data.id;
        document.getElementById('projectCode').value = data.project_code;
        await handleSearch();
    } catch (error) {
        alert('Erro ao salvar obra: ' + error.message);
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
        if (searchTerm) alert(foundClients.length > 1 ? "Múltiplos clientes encontrados." : "Nenhum cliente encontrado.");
    }
}


// --- LÓGICA DE ADMINISTRAÇÃO ---

async function showAdminPanel() {
    const users = await api.fetchAllUsers();
    ui.populateUsersPanel(users);
    ui.openModal('adminPanelOverlay');
}

async function showManageProjectsPanel() {
    const projects = await api.fetchProjects(null, { is_admin: true });
    const allUsers = await api.fetchAllUsers();
    const allClients = await api.fetchClients('', { is_admin: true });
    ui.populateProjectsPanel_Admin(projects, allUsers, allClients);
    ui.openModal('manageProjectsModalOverlay');
}

async function handleAdminUserActions(event) {
    const target = event.target;
    if (!target.dataset.userId) return;

    const userId = target.dataset.userId;
    if (target.classList.contains('approve-user-btn')) {
        await api.approveUser(userId);
    } else if (target.classList.contains('block-user-btn')) {
        const isBlocked = target.dataset.isBlocked === 'true';
        await api.toggleUserBlock(userId, !isBlocked);
    } else if (target.classList.contains('delete-user-btn')) {
        if (confirm("Isto removerá o perfil, mas não o login. A exclusão completa deve ser feita no Supabase. Continuar?")) {
            await api.deleteUserProfile(userId);
        }
    }
    await showAdminPanel(); // Refresh list
}

async function handleUpdatePermissions() {
    if (!currentUserProfile.is_admin || !currentClient) return;
    const selectedUserIds = Array.from(document.querySelectorAll('#userAccessList input:checked')).map(cb => cb.value);
    const { error } = await api.updateClientUserPermissions(currentClient.id, selectedUserIds);
    if (error) alert("Erro ao salvar permissões: " + error.message);
    else alert("Permissões atualizadas!");
}

async function handleAdminProjectActions(event) {
    // ... lógica para transferir obras
}


// --- LÓGICA DE CADASTRO E CÁLCULO (Existente) ---
async function handleRegister(event) { /* ...código existente... */ }
function handleCalculate() { /* ...código existente... */ }
function handleGeneratePdf() { /* ...código existente... */ }

// PONTO DE ENTRADA
document.addEventListener('DOMContentLoaded', main);