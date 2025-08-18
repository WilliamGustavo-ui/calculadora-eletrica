// Arquivo: main.js

import * as auth from './auth.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as utils from './utils.js';
import { supabase } from './supabaseClient.js';

// --- ESTADO DA APLICAÇÃO ---
let currentUserProfile = null;
let technicalData = null;
let clients = []; // Armazena a lista de clientes carregada
let currentClient = null; // Armazena o cliente atualmente selecionado no modal

// --- FUNÇÃO DE INICIALIZAÇÃO ---
function main() {
    setupEventListeners();
    utils.atualizarMascaraDocumento();
}

// --- CONFIGURAÇÃO DOS EVENTOS ---
function setupEventListeners() {
    // Autenticação
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('registerBtn').addEventListener('click', () => ui.openModal('registerModalOverlay'));
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('forgotPasswordLink').addEventListener('click', (e) => { e.preventDefault(); ui.openModal('forgotPasswordModalOverlay'); });
    document.getElementById('forgotPasswordForm').addEventListener('submit', handleForgotPassword);
    document.getElementById('resetPasswordForm').addEventListener('submit', handleResetPassword);
    
    // Modais
    document.querySelectorAll('.close-modal-btn').forEach(btn => { btn.addEventListener('click', (e) => ui.closeModal(e.target.dataset.modalId)); });

    // Ações de Projeto (Obras)
    document.getElementById('saveBtn').addEventListener('click', handleSaveProject);
    document.getElementById('loadBtn').addEventListener('click', handleLoadProject);
    document.getElementById('deleteBtn').addEventListener('click', handleDeleteProject);
    document.getElementById('newBtn').addEventListener('click', handleNewProject);
    document.getElementById('searchInput').addEventListener('input', (e) => handleSearch(e.target.value));

    // Ações de Cliente (Novo)
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
    document.getElementById('circuits-container').addEventListener('click', e => { if (e.target.classList.contains('remove-btn')) { ui.removeCircuit(e.target.dataset.circuitId); } });
    
    // Cálculos e PDF
    document.getElementById('calculateBtn').addEventListener('click', handleCalculate);
    document.getElementById('pdfBtn').addEventListener('click', handleGeneratePdf);
    
    // Máscaras de Input
    document.getElementById('regCpf').addEventListener('input', utils.mascaraCPF);
    document.getElementById('regTelefone').addEventListener('input', utils.mascaraCelular);
    document.getElementById('editCpf').addEventListener('input', utils.mascaraCPF);
    document.getElementById('editTelefone').addEventListener('input', utils.mascaraCelular);
    document.getElementById('tipoDocumento').addEventListener('change', utils.atualizarMascaraDocumento);
    document.getElementById('documento').addEventListener('input', utils.aplicarMascara);
    document.getElementById('telefone').addEventListener('input', utils.mascaraTelefone);
    document.getElementById('celular').addEventListener('input', utils.mascaraCelular);
    document.getElementById('clientPhone').addEventListener('input', utils.mascaraTelefone);
    document.getElementById('clientMobile').addEventListener('input', utils.mascaraCelular);
    document.getElementById('legalRepCpf').addEventListener('input', utils.mascaraCPF);
    document.getElementById('legalRepPhone').addEventListener('input', utils.mascaraTelefone);
    document.getElementById('legalRepMobile').addEventListener('input', utils.mascaraCelular);
    document.getElementById('clientDocumentNumber').addEventListener('input', (e) => {
        const type = document.getElementById('clientDocumentType').value;
        utils.aplicarMascara(e, type);
    });

    // Admin
    document.getElementById('adminPanelBtn').addEventListener('click', showAdminPanel);
    document.getElementById('manageProjectsBtn').addEventListener('click', showManageProjectsPanel);
    document.getElementById('adminUserList').addEventListener('click', handleAdminUserActions);
    document.getElementById('editUserForm').addEventListener('submit', handleUpdateUser);
    document.getElementById('adminProjectsTableBody').addEventListener('click', handleAdminProjectActions);
    document.getElementById('saveUserPermissionsBtn').addEventListener('click', handleUpdatePermissions);
}


// --- HANDLERS DE AUTENTICAÇÃO E SESSÃO ---

async function handleLogin() {
    const email = document.getElementById('emailLogin').value;
    const password = document.getElementById('password').value;
    const userProfile = await auth.signInUser(email, password);

    if (userProfile) {
        if (userProfile.is_approved) {
            currentUserProfile = userProfile;
            ui.showAppView(currentUserProfile);
            await loadInitialData();
        } else {
            alert('Seu cadastro ainda não foi aprovado por um administrador.');
            await auth.signOutUser();
        }
    }
}

async function handleLogout() {
    currentUserProfile = null;
    technicalData = null;
    clients = [];
    currentClient = null;
    await auth.signOutUser();
    ui.showLoginView();
}

supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'INITIAL_SESSION' && session) {
        const userProfile = await auth.getSession();
        if (userProfile && userProfile.is_approved) {
            currentUserProfile = userProfile;
            ui.showAppView(currentUserProfile);
            await loadInitialData();
        }
    } else if (event === 'SIGNED_OUT') {
        currentUserProfile = null;
        technicalData = null;
        ui.showLoginView();
    } else if (event === 'PASSWORD_RECOVERY') {
        ui.showResetPasswordView();
    }
});

async function loadInitialData() {
    technicalData = await api.fetchTechnicalData();
    await handleSearch();
}


// --- HANDLERS DE CLIENTES ---

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
    } else {
        clientData.legal_rep_name = null;
        clientData.legal_rep_cpf = null;
        clientData.legal_rep_phone = null;
        clientData.legal_rep_mobile = null;
        clientData.legal_rep_email = null;
    }
    
    const { data, error } = await api.saveClient(clientData, clientId);
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
    if (!clientId || !currentClient) {
        alert("Nenhum cliente selecionado para excluir.");
        return;
    }
    if (confirm(`Tem certeza que deseja excluir o cliente "${currentClient.name}"? As obras vinculadas não serão excluídas, mas perderão o vínculo.`)) {
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

async function handleUpdatePermissions() {
    if (!currentUserProfile.is_admin || !currentClient) return;
    
    const selectedUserIds = [];
    document.querySelectorAll('#userAccessList input[type="checkbox"]:checked').forEach(checkbox => {
        selectedUserIds.push(checkbox.value);
    });

    const { error } = await api.updateClientUserPermissions(currentClient.id, selectedUserIds);
    if (error) {
        alert("Erro ao salvar permissões: " + error.message);
    } else {
        alert("Permissões atualizadas com sucesso!");
    }
}


// --- HANDLERS DE OBRAS E VÍNCULOS ---

async function handleLinkClientToProject(event) {
    const searchTerm = event.target.value.trim();
    if (!searchTerm) {
        ui.clearProjectClientInfo();
        return;
    }
    
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

async function handleSaveProject() {
    if (!currentUserProfile) { alert("Você precisa estar logado para salvar um projeto."); return; }
    const projectName = document.getElementById('obra').value.trim();
    if (!projectName) { alert("Por favor, insira um 'Nome da Obra' para salvar."); return; }
    
    const clientSearchValue = document.getElementById('clientSearch').value.trim();
    const allClients = await api.fetchClients('', { is_admin: true });
    const linkedClient = allClients.find(c => c.client_code === clientSearchValue);

    const mainData = {};
    document.querySelectorAll('#main-form input, #main-form select').forEach(el => mainData[el.id] = el.value);
    const techData = {};
    document.querySelectorAll('#tech-form input').forEach(el => techData[el.id] = el.value);
    const circuitsData = [];
    document.querySelectorAll('.circuit-block').forEach(block => {
        const circuit = { id: block.dataset.id };
        block.querySelectorAll('input, select').forEach(el => { circuit[el.id] = el.type === 'checkbox' ? el.checked : el.value; });
        circuitsData.push(circuit);
    });
    
    const projectData = { 
        project_name: projectName, 
        main_data: mainData, 
        tech_data: techData, 
        circuits_data: circuitsData, 
        owner_id: currentUserProfile.id,
        client_id: linkedClient ? linkedClient.id : null,
        project_code: document.getElementById('projectCode').value.trim() || null
    };

    const currentProjectId = document.getElementById('currentProjectId').value;
    try {
        const { data, error } = await api.saveProject(projectData, currentProjectId);
        if (error) throw error;
        alert(`Obra "${projectName}" salva com sucesso!`);
        document.getElementById('currentProjectId').value = data.id;
        document.getElementById('projectCode').value = data.project_code;
        await handleSearch();
    } catch (error) { alert('Erro ao salvar obra: ' + error.message); }
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

function handleNewProject() {
    if (confirm("Deseja limpar todos os campos para iniciar uma nova obra?")) {
        ui.resetForm(true);
        ui.clearProjectClientInfo();
    }
}

async function handleDeleteProject() {
    const projectId = document.getElementById('savedProjectsSelect').value;
    if (!projectId) return;
    const projectName = document.getElementById('savedProjectsSelect').options[document.getElementById('savedProjectsSelect').selectedIndex].text;
    if (confirm(`Tem certeza que deseja excluir a obra "${projectName}"?`)) {
        const { error } = await api.deleteProject(projectId);
        if (error) { alert('Erro ao excluir obra: ' + error.message); }
        else { alert("Obra excluída."); handleNewProject(); await handleSearch(); }
    }
}

async function handleSearch(term = '') {
    if (!currentUserProfile) return;
    const projects = await api.fetchProjects(term, currentUserProfile);
    ui.populateProjectList(projects);
}


// --- DEMAIS HANDLERS ---
function handleCalculate() {
    const results = utils.calcularTodosCircuitos(technicalData);
    if (results) { ui.renderReport(results); }
}
function handleGeneratePdf() {
    const results = utils.calcularTodosCircuitos(technicalData);
    if(results) { ui.generatePdf(results, currentUserProfile); }
}
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
    const userId = target.dataset.userId;
    if (target.classList.contains('approve-user-btn')) { await api.approveUser(userId); showAdminPanel(); }
    if (target.classList.contains('edit-user-btn')) { const users = await api.fetchAllUsers(); const user = users.find(u => u.id === userId); if (user) ui.populateEditUserModal(user); }
    if (target.classList.contains('remove-user-btn')) { alert("A remoção completa de usuários (auth) deve ser feita no painel do Supabase. Esta ação não é suportada diretamente via API por segurança."); }
}
async function handleUpdateUser(event) {
    event.preventDefault();
    const userId = document.getElementById('editUserId').value;
    const data = { nome: document.getElementById('editNome').value, cpf: document.getElementById('editCpf').value, telefone: document.getElementById('editTelefone').value, crea: document.getElementById('editCrea').value, };
    const { error } = await api.updateUserProfile(userId, data);
    if (error) { alert("Erro ao atualizar usuário: " + error.message); }
    else { alert("Usuário atualizado com sucesso!"); ui.closeModal('editUserModalOverlay'); showAdminPanel(); }
}
async function handleAdminProjectActions(event) {
    const target = event.target;
    if (!target.classList.contains('transfer-btn')) return;

    const projectId = target.dataset.projectId;

    if (target.classList.contains('transfer-user-btn')) {
        const newOwnerId = target.previousElementSibling.value;
        const { error } = await api.transferProjectOwner(projectId, newOwnerId); // Supondo que esta função exista em api.js
        if(error) {
            alert("Erro ao transferir proprietário da obra: " + error.message);
        } else {
            alert("Proprietário da obra alterado com sucesso!");
            showManageProjectsPanel();
        }
    }
    
    if (target.classList.contains('transfer-client-btn')) {
        const newClientId = target.previousElementSibling.value;
        if (!newClientId) {
            alert("Selecione um cliente de destino.");
            return;
        }
        const { error } = await api.transferProjectClient(projectId, newClientId);
        if (error) {
            alert("Erro ao transferir obra de cliente: " + error.message);
        } else {
            alert("Obra transferida para o novo cliente!");
            showManageProjectsPanel();
        }
    }
}


// --- HANDLERS DE CADASTRO (EXISTENTES) ---
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
        alert('Cadastro realizado com sucesso! Aguarde a aprovação de um administrador.');
        ui.closeModal('registerModalOverlay');
        event.target.reset();
    }
}
async function handleForgotPassword(event) {
    event.preventDefault();
    const email = document.getElementById('forgotEmail').value;
    const { error } = await auth.sendPasswordResetEmail(email);
    if (error) {
        alert("Erro ao enviar e-mail: " + error.message);
    } else {
        alert("Se o e-mail estiver cadastrado, um link de redefinição foi enviado!");
        ui.closeModal('forgotPasswordModalOverlay');
        event.target.reset();
    }
}
async function handleResetPassword(event) {
    event.preventDefault();
    const newPassword = document.getElementById('newPassword').value;
    if (!newPassword || newPassword.length < 6) {
        alert("A senha precisa ter no mínimo 6 caracteres.");
        return;
    }
    const { error } = await auth.updatePassword(newPassword);
    if (error) {
        alert("Erro ao atualizar senha: " + error.message);
    } else {
        alert("Senha atualizada com sucesso! A página será recarregada. Por favor, faça o login com sua nova senha.");
        window.location.hash = '';
        window.location.reload();
    }
}


/**
 * PONTO DE ENTRADA E GARANTIA DE EXECUÇÃO
 * A função main() só será chamada após o DOM estar completamente carregado.
 */
document.addEventListener('DOMContentLoaded', main);