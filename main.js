// Arquivo: main.js (VERSÃO FINAL E CORRIGIDA)

import * as auth from './auth.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as utils from './utils.js';
import { supabase } from './supabaseClient.js';

let currentUserProfile = null;
let allClients = [];
let uiData = null;

// Função chamada após a UI do app ser renderizada
function setupAppEventListeners() {
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    document.getElementById('saveBtn').addEventListener('click', handleSaveProject);
    document.getElementById('loadBtn').addEventListener('click', handleLoadProject);
    document.getElementById('deleteBtn').addEventListener('click', handleDeleteProject);
    document.getElementById('newBtn').addEventListener('click', () => handleNewProject(true));
    
    const debouncedSearch = utils.debounce((e) => handleSearch(e.target.value), 300);
    document.getElementById('searchInput').addEventListener('input', debouncedSearch);
    
    // As linhas abaixo foram movidas para cá para garantir que os elementos existam
    // document.getElementById('addQdcBtn').addEventListener('click', ui.addQdcBlock);
    // document.getElementById('manageQdcsBtn').addEventListener('click', () => ui.openModal('qdcManagerModalOverlay'));
    
    const mainContainer = document.getElementById('appContainer');
    mainContainer.addEventListener('input', ui.handleMainContainerInteraction);
    mainContainer.addEventListener('click', ui.handleMainContainerInteraction);
    
    // document.getElementById('calculateAndPdfBtn').addEventListener('click', handleCalculateAndPdf);
    
    document.getElementById('manageProjectsBtn').addEventListener('click', showManageProjectsPanel);
    
    // O botão adminPanelBtn só existe se o usuário for admin, então o listener deve ser condicional
    const adminBtn = document.getElementById('adminPanelBtn');
    if (adminBtn) {
        adminBtn.addEventListener('click', showAdminPanel);
    }
    
    document.getElementById('manageClientsBtn').addEventListener('click', handleOpenClientManagement);
    document.getElementById('changeClientBtn').addEventListener('click', async () => { 
        allClients = await api.fetchClients(); 
        ui.populateSelectClientModal(allClients, true); 
    });
}


async function handleLogin() {
    const email = document.getElementById('emailLogin').value;
    const password = document.getElementById('password').value;
    const userProfile = await auth.signInUser(email, password);
    if (userProfile) {
        if (userProfile.is_approved) {
            currentUserProfile = userProfile;
            ui.showAppView(currentUserProfile);
            setupAppEventListeners(); // <<<<<<<<<<< ADICIONA LISTENERS APÓS CRIAR A VIEW
            
            uiData = await api.fetchUiData();
            if (uiData) {
                ui.setupDynamicData(uiData);
            }
            
            // ui.resetForm(); 
            await handleSearch();
        } 
    }
}

// --- Funções de Autenticação e Gerenciamento (sem alterações) ---
async function handleLogout() { await auth.signOutUser(); }
async function handleRegister(event) { event.preventDefault(); const email = document.getElementById('regEmail').value; const password = document.getElementById('regPassword').value; const details = { nome: document.getElementById('regNome').value, cpf: document.getElementById('regCpf').value, telefone: document.getElementById('regTelefone').value, crea: document.getElementById('regCrea').value, email: email }; const { error } = await auth.signUpUser(email, password, details); if (!error) { alert('Cadastro realizado com sucesso! Aguarde a aprovação de um administrador.'); ui.closeModal('registerModalOverlay'); event.target.reset(); } }
async function handleForgotPassword(event) { event.preventDefault(); const email = document.getElementById('forgotEmail').value; const { error } = await auth.sendPasswordResetEmail(email); if (error) { alert("Erro ao enviar e-mail: " + error.message); } else { alert("Se o e-mail estiver cadastrado, um link de redefinição foi enviado!"); ui.closeModal('forgotPasswordModalOverlay'); event.target.reset(); } }
async function handleResetPassword(event) { event.preventDefault(); const newPassword = document.getElementById('newPassword').value; if (!newPassword || newPassword.length < 6) { alert("A senha precisa ter no mínimo 6 caracteres."); return; } const { error } = await auth.updatePassword(newPassword); if (error) { alert("Erro ao atualizar senha: " + error.message); } else { alert("Senha atualizada com sucesso! A página será recarregada. Por favor, faça o login com sua nova senha."); window.location.hash = ''; window.location.reload(); } }
async function handleOpenClientManagement() { allClients = await api.fetchClients(); ui.populateClientManagementModal(allClients); ui.openModal('clientManagementModalOverlay'); }
async function handleClientFormSubmit(event) { event.preventDefault(); const clientId = document.getElementById('clientId').value; const clientData = { nome: document.getElementById('clientNome').value, documento_tipo: document.getElementById('clientDocumentoTipo').value, documento_valor: document.getElementById('clientDocumentoValor').value, email: document.getElementById('clientEmail').value, celular: document.getElementById('clientCelular').value, telefone: document.getElementById('clientTelefone').value, endereco: document.getElementById('clientEndereco').value, owner_id: currentUserProfile.id }; try { let result; if (clientId) { result = await api.updateClient(clientId, clientData); } else { result = await api.addClient(clientData); } if (result.error) { throw result.error; } alert(clientId ? 'Cliente atualizado com sucesso!' : 'Cliente cadastrado com sucesso!'); ui.resetClientForm(); await handleOpenClientManagement(); } catch (error) { alert('Erro ao salvar cliente: ' + error.message); } }
async function handleClientListClick(event) { const target = event.target; const clientId = target.dataset.clientId; if (target.classList.contains('edit-client-btn')) { const clientToEdit = allClients.find(c => c.id == clientId); if (clientToEdit) ui.openEditClientForm(clientToEdit); } if (target.classList.contains('delete-client-btn')) { if (confirm('Tem certeza que deseja excluir este cliente?')) { const { error } = await api.deleteClient(clientId); if (error) { alert('Erro ao excluir cliente: ' + error.message); } else { await handleOpenClientManagement(); } } } }
async function handleNewProject(showModal = true) { if (showModal) { allClients = await api.fetchClients(); ui.populateSelectClientModal(allClients); } else { ui.resetForm(); } }
function handleConfirmClientSelection(isChange = false) { const select = document.getElementById('clientSelectForNewProject'); const selectedOption = select.options[select.selectedIndex]; const currentProjectId = document.getElementById('currentProjectId').value; if (select.value) { const client = JSON.parse(selectedOption.dataset.client); if (isChange && currentProjectId) { document.getElementById('currentClientId').value = client.id; document.getElementById('clientLinkDisplay').textContent = `Cliente Vinculado: ${client.nome} (${client.client_code})`; } else { ui.resetForm(true, client); } } ui.closeModal('selectClientModalOverlay'); }
function handleContinueWithoutClient() { ui.resetForm(); ui.closeModal('selectClientModalOverlay'); }

async function handleSaveProject() { alert("Função 'Salvar Projeto' precisa ser atualizada para a nova estrutura de QDCs."); }
async function handleLoadProject() { alert("Função 'Carregar Projeto' precisa ser atualizada para a nova estrutura de QDCs."); }

async function handleDeleteProject() { const projectId = document.getElementById('savedProjectsSelect').value; const projectName = document.getElementById('savedProjectsSelect').options[document.getElementById('savedProjectsSelect').selectedIndex].text; if (!projectId || !confirm(`Tem certeza que deseja excluir a obra "${projectName}"?`)) return; const { error } = await api.deleteProject(projectId); if (error) { alert('Erro ao excluir obra: ' + error.message); } else { alert("Obra excluída."); ui.resetForm(); await handleSearch(); } }
async function handleSearch(term = '') { if (!currentUserProfile) return; const projects = await api.fetchProjects(term); ui.populateProjectList(projects); }
async function showManageProjectsPanel() { const projects = await api.fetchProjects(''); allClients = await api.fetchClients(); const allUsers = await api.fetchAllUsers(); ui.populateProjectsPanel(projects, allClients, allUsers, currentUserProfile); ui.openModal('manageProjectsModalOverlay'); }
async function handleProjectPanelClick(event) { const target = event.target; const projectId = target.dataset.projectId; if (target.classList.contains('transfer-client-btn')) { const select = target.parentElement.querySelector('.transfer-client-select'); const newClientId = select.value || null; const { error } = await api.transferProjectClient(projectId, newClientId); if (error) { alert('Erro ao transferir cliente: ' + error.message); } else { alert('Cliente da obra atualizado com sucesso!'); await showManageProjectsPanel(); } } if (target.classList.contains('transfer-owner-btn')) { const select = target.parentElement.querySelector('.transfer-owner-select'); const newOwnerId = select.value; if (newOwnerId && confirm('Tem certeza que deseja transferir a propriedade desta obra? Você perderá o acesso a ela se transferir para outro usuário.')) { const { error } = await api.transferProjectOwner(projectId, newOwnerId); if (error) { alert('Propriedade da obra transferida com sucesso!'); await showManageProjectsPanel(); } } } }
async function showAdminPanel() { const users = await api.fetchAllUsers(); ui.populateUsersPanel(users); ui.openModal('adminPanelModalOverlay'); }
async function handleAdminUserActions(event) {
    const target = event.target;
    const userId = target.dataset.userId;
    if (target.classList.contains('approve-user-btn')) { await api.approveUser(userId); await showAdminPanel(); }
    if (target.classList.contains('edit-user-btn')) { const user = await api.fetchUserById(userId); if (user) ui.populateEditUserModal(user); }
    if (target.classList.contains('block-user-btn')) { const shouldBlock = target.dataset.isBlocked === 'true'; const actionText = shouldBlock ? 'bloquear' : 'desbloquear'; if (confirm(`Tem certeza que deseja ${actionText} este usuário?`)) { await api.toggleUserBlock(userId, shouldBlock); await showAdminPanel(); } }
    if (target.classList.contains('remove-user-btn')) { if (confirm('ATENÇÃO: Ação irreversível. Deseja continuar?')) { const { error } = await api.deleteUserFromAdmin(userId); if (error) { alert('Erro ao excluir usuário: ' + error.message); } else { alert('Usuário excluído com sucesso.'); await showAdminPanel(); } } }
}
async function handleUpdateUser(event) { event.preventDefault(); const userId = document.getElementById('editUserId').value; const data = { nome: document.getElementById('editNome').value, cpf: document.getElementById('editCpf').value, telefone: document.getElementById('editTelefone').value, crea: document.getElementById('editCrea').value, }; const { error } = await api.updateUserProfile(userId, data); if (error) { alert("Erro ao atualizar usuário: " + error.message); } else { alert("Usuário atualizado com sucesso!"); ui.closeModal('editUserModalOverlay'); await showAdminPanel(); } }

function getFullFormData(forSave = false) {
    // Implementação futura
    return {};
}

async function handleCalculateAndPdf() {
    alert("A lógica de cálculo precisa ser atualizada para a nova estrutura de QDCs.");
}

// Event Listeners que rodam no início, para elementos que sempre existem
function setupInitialEventListeners() {
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('registerBtn').addEventListener('click', () => ui.openModal('registerModalOverlay'));
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('forgotPasswordLink').addEventListener('click', (e) => { e.preventDefault(); ui.openModal('forgotPasswordModalOverlay'); });
    document.getElementById('forgotPasswordForm').addEventListener('submit', handleForgotPassword);
    document.getElementById('resetPasswordForm').addEventListener('submit', handleResetPassword);
    document.querySelectorAll('.close-modal-btn').forEach(btn => { btn.addEventListener('click', (e) => ui.closeModal(e.target.closest('.modal-overlay').id)); });
    
    // Listeners de Modais que podem ser abertos de qualquer tela
    document.getElementById('adminProjectsTableBody').addEventListener('click', handleProjectPanelClick);
    document.getElementById('adminUserList').addEventListener('click', handleAdminUserActions);
    document.getElementById('editUserForm').addEventListener('submit', handleUpdateUser);
    document.getElementById('clientForm').addEventListener('submit', handleClientFormSubmit);
    document.getElementById('clientList').addEventListener('click', handleClientListClick);
    document.getElementById('clientFormCancelBtn').addEventListener('click', ui.resetClientForm);
    document.getElementById('confirmClientSelectionBtn').addEventListener('click', () => handleConfirmClientSelection(true));
    document.getElementById('continueWithoutClientBtn').addEventListener('click', handleContinueWithoutClient);
    document.getElementById('addNewClientFromSelectModalBtn').addEventListener('click', () => { ui.closeModal('selectClientModalOverlay'); handleOpenClientManagement(); });
    
    // Listeners de Máscaras
    document.getElementById('regCpf').addEventListener('input', utils.mascaraCPF);
    document.getElementById('regTelefone').addEventListener('input', utils.mascaraCelular);
    document.getElementById('editCpf').addEventListener('input', utils.mascaraCPF);
    document.getElementById('editTelefone').addEventListener('input', utils.mascaraCelular);
    document.getElementById('clientCelular').addEventListener('input', utils.mascaraCelular);
    document.getElementById('clientTelefone').addEventListener('input', utils.mascaraTelefone);
    document.getElementById('clientDocumentoValor').addEventListener('input', (e) => { const tipo = document.getElementById('clientDocumentoTipo').value; utils.aplicarMascara(e, tipo); });
    document.getElementById('clientDocumentoTipo').addEventListener('change', () => document.getElementById('clientDocumentoValor').value = '');
}

function main() {
    setupInitialEventListeners(); // <<<<<<<<<<< SOMENTE LISTENERS INICIAIS
    
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
            if (session) {
                const userProfile = await auth.getSession();
                if (userProfile && !userProfile.is_blocked && userProfile.is_approved) {
                    currentUserProfile = userProfile;
                    ui.showAppView(currentUserProfile);
                    setupAppEventListeners(); // <<<<<<<<<<< ADICIONA LISTENERS DO APP AQUI
                    
                    allClients = await api.fetchClients();
                    
                    uiData = await api.fetchUiData();
                    if (uiData) {
                        ui.setupDynamicData(uiData);
                    }

                    // ui.resetForm();
                    await handleSearch();
                } else if (userProfile) {
                    await auth.signOutUser();
                }
            } else {
                ui.showLoginView();
            }
        } else if (event === 'SIGNED_OUT') {
            currentUserProfile = null;
            allClients = [];
            uiData = null;
            ui.showLoginView();
        } else if (event === 'PASSWORD_RECOVERY') {
            ui.showResetPasswordView();
        }
    });
}

main();