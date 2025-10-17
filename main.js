// Arquivo: main.js (VERSÃO COM LÓGICA DE QDCs)

import * as auth from './auth.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as utils from './utils.js';
import { supabase } from './supabaseClient.js';

let currentUserProfile = null;
let allClients = [];
let uiData = null;

async function handleLogin() {
    const email = document.getElementById('emailLogin').value;
    const password = document.getElementById('password').value;
    const userProfile = await auth.signInUser(email, password);
    if (userProfile) {
        if (userProfile.is_approved) {
            currentUserProfile = userProfile;
            ui.showAppView(currentUserProfile);
            
            uiData = await api.fetchUiData();
            if (uiData) {
                ui.setupDynamicData(uiData);
            }
            
            await handleNewProject(false);
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
async function handleNewProject(showModal = true) { if (showModal) { allClients = await api.fetchClients(); ui.populateSelectClientModal(allClients); } else { ui.resetForm(true, null); } }
function handleConfirmClientSelection(isChange = false) { const select = document.getElementById('clientSelectForNewProject'); const selectedOption = select.options[select.selectedIndex]; const currentProjectId = document.getElementById('currentProjectId').value; if (select.value) { const client = JSON.parse(selectedOption.dataset.client); if (isChange && currentProjectId) { document.getElementById('currentClientId').value = client.id; document.getElementById('clientLinkDisplay').textContent = `Cliente Vinculado: ${client.nome} (${client.client_code})`; } else { ui.resetForm(true, client); } } ui.closeModal('selectClientModalOverlay'); }
function handleContinueWithoutClient() { ui.resetForm(true, null); ui.closeModal('selectClientModalOverlay'); }

async function handleSaveProject() {
    // Esta função precisará ser adaptada para salvar a nova estrutura de QDCs
    alert("Função 'Salvar Projeto' precisa ser atualizada para a nova estrutura de QDCs.");
}

async function handleLoadProject() {
    // Esta função precisará ser adaptada para carregar a nova estrutura de QDCs
    alert("Função 'Carregar Projeto' precisa ser atualizada para a nova estrutura de QDCs.");
}

async function handleDeleteProject() { const projectId = document.getElementById('savedProjectsSelect').value; const projectName = document.getElementById('savedProjectsSelect').options[document.getElementById('savedProjectsSelect').selectedIndex].text; if (!projectId || !confirm(`Tem certeza que deseja excluir a obra "${projectName}"?`)) return; const { error } = await api.deleteProject(projectId); if (error) { alert('Erro ao excluir obra: ' + error.message); } else { alert("Obra excluída."); ui.resetForm(true, null); await handleSearch(); } }
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

// >>>>>>>>>>>> FUNÇÃO ATUALIZADA PARA LER A ESTRUTURA DE QDCs <<<<<<<<<<<<<<
function getFullFormData(forSave = false) {
    const mainData = { /* ... (código existente para pegar dados da obra) ... */ };
    const feederData = { /* ... (código existente para pegar dados do alimentador) ... */ };
    
    const qdcsData = [];
    document.querySelectorAll('#qdc-container .qdc-block').forEach(qdcBlock => {
        const qdcId = qdcBlock.dataset.id;
        const qdc = {
            id: qdcId,
            name: document.getElementById(`qdcName-${qdcId}`).value,
            parentId: document.getElementById(`qdcParent-${qdcId}`).value,
            circuits: []
        };

        qdcBlock.querySelectorAll('.circuit-block').forEach(circuitBlock => {
            const circuitId = circuitBlock.dataset.id;
            const circuitData = { id: circuitId };
            circuitBlock.querySelectorAll('input, select').forEach(el => {
                const value = el.type === 'checkbox' ? el.checked : el.value;
                const key = el.id.replace(`-${circuitId}`, '');
                circuitData[key] = isNaN(parseFloat(value)) || !isFinite(value) ? value : parseFloat(value);
            });
            qdc.circuits.push(circuitData);
        });
        qdcsData.push(qdc);
    });

    // A estrutura de salvar precisará ser mais robusta, por enquanto focamos no cálculo
    if (forSave) {
        // Retornar um objeto complexo com a hierarquia de QDCs e circuitos
        return { /* ... (lógica de save a ser implementada) ... */ };
    }

    return { mainData, feederData, qdcsData };
}

async function handleCalculateAndPdf() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = loadingOverlay.querySelector('p');
    loadingText.textContent = 'Calculando, por favor aguarde...';
    loadingOverlay.classList.add('visible');
    
    const formData = getFullFormData(false);

    try {
        const { data: results, error } = await supabase.functions.invoke('calculate-hierarchical', { // Chamando nova função de back-end
            body: { formData },
        });

        if (error) throw new Error(`Erro na comunicação com o servidor: ${error.message}`);
        if (results.error) throw new Error(`Erro no cálculo: ${results.error}`);

        loadingText.textContent = 'Gerando PDFs, por favor aguarde...';
        await new Promise(resolve => setTimeout(resolve, 50));

        await ui.generateMemorialPdf(results, currentUserProfile);
        await ui.generateUnifilarPdf(results);

        alert("PDFs do Memorial e Diagrama Unifilar foram baixados com sucesso!");

    } catch (error) {
        console.error("Erro ao gerar PDFs:", error);
        alert("Ocorreu um erro inesperado: " + error.message);
    } finally {
        loadingOverlay.classList.remove('visible');
        loadingText.textContent = 'Calculando, por favor aguarde...';
    }
}

function setupEventListeners() {
    // --- Listeners existentes ---
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    // ... (todos os outros listeners existentes)

    // >>>>>>>>>>>> NOVOS LISTENERS PARA QDCs <<<<<<<<<<<<<<
    document.getElementById('addQdcBtn').addEventListener('click', ui.addQdcBlock);
    document.getElementById('manageQdcsBtn').addEventListener('click', () => ui.openModal('qdcManagerModalOverlay'));
    
    // Listener delegado para todo o container de QDCs e Circuitos
    document.getElementById('qdc-container').addEventListener('input', ui.handleMainContainerInteraction);
    document.getElementById('qdc-container').addEventListener('click', ui.handleMainContainerInteraction);

    // Listener do botão principal de cálculo
    document.getElementById('calculateAndPdfBtn').addEventListener('click', handleCalculateAndPdf);
}

function main() {
    setupEventListeners();
    
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
            if (session) {
                const userProfile = await auth.getSession();
                if (userProfile && !userProfile.is_blocked && userProfile.is_approved) {
                    currentUserProfile = userProfile;
                    ui.showAppView(currentUserProfile);
                    allClients = await api.fetchClients();
                    
                    uiData = await api.fetchUiData();
                    if (uiData) {
                        ui.setupDynamicData(uiData);
                    }

                    await handleNewProject(false);
                    await handleSearch();
                } else if (userProfile) {
                    await auth.signOutUser(); // Força logout se não aprovado ou bloqueado
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