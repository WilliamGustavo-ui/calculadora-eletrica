// Arquivo: main.js

import * as auth from './auth.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as utils from './utils.js';
import { supabase } from './supabaseClient.js';

// --- ESTADO DA APLICAÇÃO ---
let currentUserProfile = null;
let technicalData = null; 

// --- HANDLERS (FUNÇÕES DE EVENTO) ---

async function handleLogin() {
    const email = document.getElementById('emailLogin').value;
    const password = document.getElementById('password').value;
    
    const userProfile = await auth.signInUser(email, password);

    if (userProfile) {
        if (userProfile.is_approved) {
            currentUserProfile = userProfile;
            ui.showAppView(currentUserProfile);
            
            technicalData = await api.fetchTechnicalData();
            ui.resetForm(true);
            await handleSearch();
        } else {
            alert('Seu cadastro ainda não foi aprovado por um administrador.');
            await auth.signOutUser();
        }
    }
}

async function handleLogout() {
    currentUserProfile = null; 
    technicalData = null; 
    await auth.signOutUser();
}

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

async function handleForgotPassword(event) {
    event.preventDefault();
    const email = document.getElementById('forgotEmail').value;
    const { error } = await auth.sendPasswordResetEmail(email);
    if (error) { alert("Erro ao enviar e-mail: " + error.message); }
    else { alert("Se o e-mail estiver cadastrado, um link de redefinição foi enviado!"); ui.closeModal('forgotPasswordModalOverlay'); event.target.reset(); }
}

async function handleResetPassword(event) {
    event.preventDefault();
    const newPassword = document.getElementById('newPassword').value;
    if (!newPassword || newPassword.length < 6) { alert("A senha precisa ter no mínimo 6 caracteres."); return; }
    const { error } = await auth.updatePassword(newPassword);
    if (error) { alert("Erro ao atualizar senha: " + error.message); }
    else { alert("Senha atualizada com sucesso! A página será recarregada. Por favor, faça o login com sua nova senha."); window.location.hash = ''; window.location.reload(); }
}

async function handleSaveProject() {
    if (!currentUserProfile) { alert("Você precisa estar logado para salvar um projeto."); return; }
    const projectName = document.getElementById('obra').value.trim();
    if (!projectName) { alert("Por favor, insira um 'Nome da Obra' para salvar."); return; }
    
    const mainData = {};
    document.querySelectorAll('#main-form input:not(#currentProjectId), #main-form select').forEach(el => mainData[el.id] = el.value);

    const techData = {};
    document.querySelectorAll('#tech-form input').forEach(el => techData[el.id] = el.value);

    const feederData = {};
    document.querySelectorAll('#feeder-form input, #feeder-form select').forEach(el => feederData[el.id] = el.type === 'checkbox' ? el.checked : el.value);

    const circuitsData = [];
    // CORRIGIDO: Seletor agora é mais específico para evitar pegar o form do alimentador.
    document.querySelectorAll('#circuits-container .circuit-block').forEach(block => {
        const circuit = { id: block.dataset.id };
        block.querySelectorAll('input, select').forEach(el => { circuit[el.id] = el.type === 'checkbox' ? el.checked : el.value; });
        circuitsData.push(circuit);
    });

    const projectData = { project_name: projectName, main_data: mainData, tech_data: techData, feeder_data: feederData, circuits_data: circuitsData, owner_id: currentUserProfile.id };
    const currentProjectId = document.getElementById('currentProjectId').value;
    try {
        const { data, error } = await api.saveProject(projectData, currentProjectId);
        if (error) throw error;
        alert(`Obra "${projectName}" salva com sucesso!`);
        document.getElementById('currentProjectId').value = data.id;
        await handleSearch();
    } catch (error) { alert('Erro ao salvar obra: ' + error.message); }
}

async function handleLoadProject() {
    const projectId = document.getElementById('savedProjectsSelect').value;
    if (!projectId) return;
    const project = await api.fetchProjectById(projectId);
    if (project) { ui.populateFormWithProjectData(project); alert(`Obra "${project.project_name}" carregada.`); }
}

async function handleDeleteProject() {
    const projectId = document.getElementById('savedProjectsSelect').value;
    const projectName = document.getElementById('savedProjectsSelect').options[document.getElementById('savedProjectsSelect').selectedIndex].text;
    if (!projectId || !confirm(`Tem certeza que deseja excluir a obra "${projectName}"?`)) return;
    const { error } = await api.deleteProject(projectId);
    if (error) { alert('Erro ao excluir obra: ' + error.message); }
    else { alert("Obra excluída."); ui.resetForm(true); await handleSearch(); }
}

function handleNewProject() {
    if (confirm("Deseja limpar todos os campos para iniciar uma nova obra?")) { ui.resetForm(true); }
}

async function handleSearch(term = '') {
    if (!currentUserProfile) return;
    const projects = await api.fetchProjects(term);
    ui.populateProjectList(projects, currentUserProfile.is_admin);
}

function handleCalculate() {
    const results = utils.calcularProjetoCompleto(technicalData);
    if (results) {
        ui.renderReport(results);
    }
}

function handleGeneratePdf() {
    const results = utils.calcularProjetoCompleto(technicalData);
    if(results) { ui.generatePdf(results, currentUserProfile); }
}

async function showAdminPanel() {
    const users = await api.fetchAllUsers();
    ui.populateUsersPanel(users);
    ui.openModal('adminPanelModalOverlay');
}

async function showManageProjectsPanel() {
    const projects = await api.fetchProjects();
    const users = await api.fetchAllApprovedUsers();
    ui.populateProjectsPanel_Admin(projects, users);
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
    if (event.target.classList.contains('transfer-btn')) {
        const button = event.target;
        const projectId = button.dataset.projectId;
        const newOwnerId = button.previousElementSibling.value;
        const { error } = await api.transferProjectOwner(projectId, newOwnerId);
        if (error) { alert("Erro ao transferir obra: " + error.message); }
        else { alert("Obra transferida!"); showManageProjectsPanel(); }
    }
}

// --- FUNÇÃO DE INICIALIZAÇÃO ---
function main() {
    setupEventListeners();
    utils.atualizarMascaraDocumento();
}

// --- CONFIGURAÇÃO DOS EVENTOS ---
function setupEventListeners() {
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('registerBtn').addEventListener('click', () => ui.openModal('registerModalOverlay'));
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('forgotPasswordLink').addEventListener('click', (e) => { e.preventDefault(); ui.openModal('forgotPasswordModalOverlay'); });
    document.getElementById('forgotPasswordForm').addEventListener('submit', handleForgotPassword);
    document.getElementById('resetPasswordForm').addEventListener('submit', handleResetPassword);
    document.querySelectorAll('.close-modal-btn').forEach(btn => { btn.addEventListener('click', (e) => ui.closeModal(e.target.dataset.modalId)); });
    document.getElementById('saveBtn').addEventListener('click', handleSaveProject);
    document.getElementById('loadBtn').addEventListener('click', handleLoadProject);
    document.getElementById('deleteBtn').addEventListener('click', handleDeleteProject);
    document.getElementById('newBtn').addEventListener('click', handleNewProject);
    document.getElementById('searchInput').addEventListener('input', (e) => handleSearch(e.target.value));
    document.getElementById('addCircuitBtn').addEventListener('click', () => ui.addCircuit());
    document.getElementById('circuits-container').addEventListener('click', e => { if (e.target.classList.contains('remove-btn')) { ui.removeCircuit(e.target.dataset.circuitId); } });
    document.getElementById('calculateBtn').addEventListener('click', handleCalculate);
    document.getElementById('pdfBtn').addEventListener('click', handleGeneratePdf);
    document.getElementById('regCpf').addEventListener('input', utils.mascaraCPF);
    document.getElementById('regTelefone').addEventListener('input', utils.mascaraCelular);
    document.getElementById('editCpf').addEventListener('input', utils.mascaraCPF);
    document.getElementById('editTelefone').addEventListener('input', utils.mascaraCelular);
    document.getElementById('tipoDocumento').addEventListener('change', utils.atualizarMascaraDocumento);
    document.getElementById('documento').addEventListener('input', utils.aplicarMascara);
    document.getElementById('telefone').addEventListener('input', utils.mascaraTelefone);
    document.getElementById('celular').addEventListener('input', utils.mascaraCelular);
    document.getElementById('adminPanelBtn').addEventListener('click', showAdminPanel);
    document.getElementById('manageProjectsBtn').addEventListener('click', showManageProjectsPanel);
    document.getElementById('adminUserList').addEventListener('click', handleAdminUserActions);
    document.getElementById('editUserForm').addEventListener('submit', handleUpdateUser);
    document.getElementById('adminProjectsTableBody').addEventListener('click', handleAdminProjectActions);
}

main(); // PONTO DE ENTRADA

supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'INITIAL_SESSION') {
        if (session) {
            const userProfile = await auth.getSession();
            if (userProfile && userProfile.is_approved) {
                currentUserProfile = userProfile;
                ui.showAppView(currentUserProfile);
                
                technicalData = await api.fetchTechnicalData();
                ui.resetForm(true);
                await handleSearch();
            }
        }
    } else if (event === 'SIGNED_OUT') {
        currentUserProfile = null;
        technicalData = null; 
        ui.showLoginView();
    } else if (event === 'PASSWORD_RECOVERY') {
        ui.showResetPasswordView();
    }
});