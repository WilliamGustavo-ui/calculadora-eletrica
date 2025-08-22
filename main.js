// Arquivo: main.js

import * as auth from './auth.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as utils from './utils.js';
import { supabase } from './supabaseClient.js';

// --- ESTADO DA APLICAÇÃO ---
let currentUserProfile = null;
let technicalData = null; 
let allClients = [];

// --- HANDLERS DE AUTENTICAÇÃO E USUÁRIO ---
async function handleLogin() {
    const email = document.getElementById('emailLogin').value;
    const password = document.getElementById('password').value;
    
    const userProfile = await auth.signInUser(email, password);

    if (userProfile) {
        if (userProfile.is_approved) {
            currentUserProfile = userProfile;
            ui.showAppView(currentUserProfile);
            
            technicalData = await api.fetchTechnicalData();
            if (technicalData) {
                ui.setupDynamicTemperatures(technicalData);
                await handleNewProject(false); 
                await handleSearch();
            }
        } else {
            alert('Seu cadastro ainda não foi aprovado por um administrador.');
            await auth.signOutUser();
        }
    }
}
async function handleLogout() { await auth.signOutUser(); }
async function handleRegister(event) {
    event.preventDefault();
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const details = { nome: document.getElementById('regNome').value, cpf: document.getElementById('regCpf').value, telefone: document.getElementById('regTelefone').value, crea: document.getElementById('regCrea').value, email: email };
    const { error } = await auth.signUpUser(email, password, details);
    if (!error) {
        alert('Cadastro realizado com sucesso! Aguarde a aprovação de um administrador.');
        ui.closeModal('registerModalOverlay');
        event.target.reset();
    }
}
async function handleForgotPassword(event) { event.preventDefault(); const email = document.getElementById('forgotEmail').value; const { error } = await auth.sendPasswordResetEmail(email); if (error) { alert("Erro ao enviar e-mail: " + error.message); } else { alert("Se o e-mail estiver cadastrado, um link de redefinição foi enviado!"); ui.closeModal('forgotPasswordModalOverlay'); event.target.reset(); } }
async function handleResetPassword(event) { event.preventDefault(); const newPassword = document.getElementById('newPassword').value; if (!newPassword || newPassword.length < 6) { alert("A senha precisa ter no mínimo 6 caracteres."); return; } const { error } = await auth.updatePassword(newPassword); if (error) { alert("Erro ao atualizar senha: " + error.message); } else { alert("Senha atualizada com sucesso! A página será recarregada. Por favor, faça o login com sua nova senha."); window.location.hash = ''; window.location.reload(); } }

// --- HANDLERS DE CLIENTE ---
async function handleOpenClientManagement() {
    allClients = await api.fetchClients();
    ui.populateClientManagementModal(allClients);
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
        if (clientId) {
            await api.updateClient(clientId, clientData);
            alert('Cliente atualizado com sucesso!');
        } else {
            await api.addClient(clientData);
            alert('Cliente cadastrado com sucesso!');
        }
        ui.resetClientForm();
        await handleOpenClientManagement();
    } catch(error) {
        alert('Erro ao salvar cliente: ' + error.message);
    }
}

async function handleClientListClick(event) {
    const target = event.target;
    const clientId = target.dataset.clientId;

    if (target.classList.contains('edit-client-btn')) {
        const clientToEdit = allClients.find(c => c.id == clientId);
        if (clientToEdit) ui.openEditClientForm(clientToEdit);
    }

    if (target.classList.contains('delete-client-btn')) {
        if (confirm('Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.')) {
            const { error } = await api.deleteClient(clientId);
            if (error) {
                alert('Erro ao excluir cliente: ' + error.message);
            } else {
                await handleOpenClientManagement();
            }
        }
    }
}

// --- HANDLERS DE PROJETO ---
async function handleNewProject(showModal = true) {
    if (showModal) {
        allClients = await api.fetchClients();
        ui.populateSelectClientModal(allClients);
    } else {
        ui.resetForm(true, null);
    }
}

function handleConfirmClientSelection(isChange = false) {
    const select = document.getElementById('clientSelectForNewProject');
    const selectedOption = select.options[select.selectedIndex];
    const currentProjectId = document.getElementById('currentProjectId').value;

    if (select.value) {
        const client = JSON.parse(selectedOption.dataset.client);
        if(isChange && currentProjectId){
            document.getElementById('currentClientId').value = client.id;
            document.getElementById('clientLinkDisplay').textContent = `Cliente Vinculado: ${client.nome} (${client.client_code})`;
        } else {
            ui.resetForm(true, client);
        }
    }
    ui.closeModal('selectClientModalOverlay');
}

function handleContinueWithoutClient() {
    ui.resetForm(true, null);
    ui.closeModal('selectClientModalOverlay');
}

async function handleSaveProject() {
    if (!currentUserProfile) { alert("Você precisa estar logado para salvar um projeto."); return; }
    const nomeObra = document.getElementById('obra').value.trim();
    if (!nomeObra) { alert("Por favor, insira um 'Nome da Obra' para salvar."); return; }
    
    const mainData = {};
    document.querySelectorAll('#main-form input, #main-form textarea, #main-form select').forEach(el => {
        if (el.id && !['currentProjectId', 'currentClientId'].includes(el.id)) {
            mainData[el.id] = el.value;
        }
    });

    const techData = {};
    document.querySelectorAll('#tech-form input').forEach(el => techData[el.id] = el.value);

    const feederData = {};
    document.querySelectorAll('#feeder-form input, #feeder-form select').forEach(el => feederData[el.id] = el.type === 'checkbox' ? el.checked : el.value);

    const circuitsData = [];
    document.querySelectorAll('#circuits-container .circuit-block').forEach(block => {
        const circuit = { id: block.dataset.id };
        block.querySelectorAll('input, select').forEach(el => { circuit[el.id] = el.type === 'checkbox' ? el.checked : el.value; });
        circuitsData.push(circuit);
    });

    const projectData = {
        project_name: nomeObra,
        client_id: document.getElementById('currentClientId').value || null,
        main_data: mainData,
        tech_data: techData,
        feeder_data: feederData,
        circuits_data: circuitsData,
        owner_id: currentUserProfile.id
    };

    const currentProjectId = document.getElementById('currentProjectId').value;
    try {
        const { data, error } = await api.saveProject(projectData, currentProjectId);
        if (error) throw error;
        alert(`Obra "${data.project_name}" salva com sucesso!`);
        document.getElementById('currentProjectId').value = data.id;
        document.getElementById('project_code').value = data.project_code;
        await handleSearch();
    } catch (error) { alert('Erro ao salvar obra: ' + error.message); }
}

async function handleLoadProject() {
    const projectId = document.getElementById('savedProjectsSelect').value;
    if (!projectId) return;
    const project = await api.fetchProjectById(projectId);
    if (project) { 
        ui.populateFormWithProjectData(project);
        alert(`Obra "${project.project_name}" carregada.`); 
    }
}

async function handleDeleteProject() {
    const projectId = document.getElementById('savedProjectsSelect').value;
    const projectName = document.getElementById('savedProjectsSelect').options[document.getElementById('savedProjectsSelect').selectedIndex].text;
    if (!projectId || !confirm(`Tem certeza que deseja excluir a obra "${projectName}"?`)) return;
    const { error } = await api.deleteProject(projectId);
    if (error) { alert('Erro ao excluir obra: ' + error.message); }
    else { alert("Obra excluída."); ui.resetForm(true); await handleSearch(); }
}

async function handleSearch(term = '') {
    if (!currentUserProfile) return;
    const projects = await api.fetchProjects(term);
    ui.populateProjectList(projects);
}

function handleCalculate() { const results = utils.calcularProjetoCompleto(technicalData); if (results) { ui.renderReport(results); } }
function handleGeneratePdf() { const results = utils.calcularProjetoCompleto(technicalData); if(results) { ui.generatePdf(results, currentUserProfile); } }

async function showManageProjectsPanel() {
    const projects = await api.fetchProjects('');
    allClients = await api.fetchClients();
    ui.populateProjectsPanel(projects, allClients);
    ui.openModal('manageProjectsModalOverlay');
}

async function handleProjectPanelClick(event) {
    if (event.target.classList.contains('transfer-client-btn')) {
        const button = event.target;
        const projectId = button.dataset.projectId;
        const newClientId = button.previousElementSibling.value || null;
        await api.transferProjectClient(projectId, newClientId);
        alert('Obra transferida com sucesso!');
        await showManageProjectsPanel();
    }
}


// --- INICIALIZAÇÃO E EVENTOS GERAIS ---
function main() {
    setupEventListeners();
}

function setupEventListeners() {
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('registerBtn').addEventListener('click', () => ui.openModal('registerModalOverlay'));
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('forgotPasswordLink').addEventListener('click', (e) => { e.preventDefault(); ui.openModal('forgotPasswordModalOverlay'); });
    document.getElementById('forgotPasswordForm').addEventListener('submit', handleForgotPassword);
    document.getElementById('resetPasswordForm').addEventListener('submit', handleResetPassword);
    document.querySelectorAll('.close-modal-btn').forEach(btn => { btn.addEventListener('click', (e) => ui.closeModal(e.target.dataset.modalId)); });
    
    // Controles de Projeto
    document.getElementById('saveBtn').addEventListener('click', handleSaveProject);
    document.getElementById('loadBtn').addEventListener('click', handleLoadProject);
    document.getElementById('deleteBtn').addEventListener('click', handleDeleteProject);
    document.getElementById('newBtn').addEventListener('click', () => handleNewProject(true));
    document.getElementById('searchInput').addEventListener('input', (e) => handleSearch(e.target.value));
    
    // Controles de Circuito
    document.getElementById('addCircuitBtn').addEventListener('click', () => ui.addCircuit());
    document.getElementById('circuits-container').addEventListener('click', e => { if (e.target.classList.contains('remove-btn')) { ui.removeCircuit(e.target.dataset.circuitId); } });
    
    // Ações Finais
    document.getElementById('calculateBtn').addEventListener('click', handleCalculate);
    document.getElementById('pdfBtn').addEventListener('click', handleGeneratePdf);
    
    // Admin
    document.getElementById('manageProjectsBtn').addEventListener('click', showManageProjectsPanel);
    document.getElementById('adminProjectsTableBody').addEventListener('click', handleProjectPanelClick);
    document.getElementById('adminPanelBtn').addEventListener('click', async () => {const users = await api.fetchAllUsers(); ui.populateUsersPanel(users); ui.openModal('adminPanelModalOverlay'); });
    document.getElementById('adminUserList').addEventListener('click', (e) => { /* ...lógica admin... */ });
    document.getElementById('editUserForm').addEventListener('submit', (e) => { /* ...lógica admin... */ });

    // Clientes
    document.getElementById('manageClientsBtn').addEventListener('click', handleOpenClientManagement);
    document.getElementById('clientForm').addEventListener('submit', handleClientFormSubmit);
    document.getElementById('clientList').addEventListener('click', handleClientListClick);
    document.getElementById('clientFormCancelBtn').addEventListener('click', ui.resetClientForm);
    document.getElementById('confirmClientSelectionBtn').addEventListener('click', () => handleConfirmClientSelection(true));
    document.getElementById('continueWithoutClientBtn').addEventListener('click', handleContinueWithoutClient);
    document.getElementById('addNewClientFromSelectModalBtn').addEventListener('click', () => { ui.closeModal('selectClientModalOverlay'); handleOpenClientManagement(); });
    document.getElementById('changeClientBtn').addEventListener('click', async () => { allClients = await api.fetchClients(); ui.populateSelectClientModal(allClients, true); });

    // Máscaras (agora apontando para os IDs corretos dentro dos modais)
    document.getElementById('regCpf').addEventListener('input', utils.mascaraCPF);
    document.getElementById('regTelefone').addEventListener('input', utils.mascaraCelular);
    document.getElementById('editCpf').addEventListener('input', utils.mascaraCPF);
    document.getElementById('editTelefone').addEventListener('input', utils.mascaraCelular);
    document.getElementById('clientCelular').addEventListener('input', utils.mascaraCelular);
    document.getElementById('clientTelefone').addEventListener('input', utils.mascaraTelefone);
    document.getElementById('clientDocumentoValor').addEventListener('input', (e) => {
        const tipo = document.getElementById('clientDocumentoTipo').value;
        utils.aplicarMascara(e, tipo);
    });
    document.getElementById('clientDocumentoTipo').addEventListener('change', () => document.getElementById('clientDocumentoValor').value = '');
}

main();

supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (session) {
            const userProfile = await auth.getSession();
            if (userProfile && userProfile.is_approved) {
                currentUserProfile = userProfile;
                ui.showAppView(currentUserProfile);
                
                technicalData = await api.fetchTechnicalData();
                if (technicalData) {
                    ui.setupDynamicTemperatures(technicalData);
                    await handleNewProject(false);
                    await handleSearch();
                }
            }
        } else {
            ui.showLoginView();
        }
    } else if (event === 'SIGNED_OUT') {
        currentUserProfile = null;
        technicalData = null; 
        ui.showLoginView();
    } else if (event === 'PASSWORD_RECOVERY') {
        ui.showResetPasswordView();
    }
});