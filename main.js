// Arquivo: main.js (VERSÃO FINAL E CORRIGIDA PARA QDCs)

import * as auth from './auth.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as utils from './utils.js';
import { supabase } from './supabaseClient.js';

let currentUserProfile = null;
let allClients = [];
let uiData = null; // Agora vai conter TODOS os dados técnicos

async function handleLogin() {
    const email = document.getElementById('emailLogin').value;
    const password = document.getElementById('password').value;
    const userProfile = await auth.signInUser(email, password);
    if (userProfile) {
        if (userProfile.is_approved) {
            currentUserProfile = userProfile;
            ui.showAppView(currentUserProfile);
            
            // Carrega TODOS os dados técnicos (cabos, disjuntores, etc.)
            uiData = await api.fetchUiData();
            if (uiData) {
                ui.setupDynamicData(uiData);
            }
            
            ui.resetForm(); // Inicia o formulário com o primeiro QDC
            await handleSearch();
        } 
        // A verificação de bloqueio já está no auth.js
    }
}

// --- Funções de Autenticação e Gerenciamento ---
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

// --- Funções de Projeto (Salvar, Carregar, Excluir) ---

function getFullFormData(forSave = false) {
    const mainData = { obra: document.getElementById('obra').value, cidadeObra: document.getElementById('cidadeObra').value, enderecoObra: document.getElementById('enderecoObra').value, areaObra: document.getElementById('areaObra').value, unidadesResidenciais: document.getElementById('unidadesResidenciais').value, unidadesComerciais: document.getElementById('unidadesComerciais').value, observacoes: document.getElementById('observacoes').value, projectCode: document.getElementById('project_code').value };
    
    const feederData = {};
    const feederDataForCalc = { id: 'feeder', nomeCircuito: "Alimentador Geral" };
    document.querySelectorAll('#feeder-form input, #feeder-form select').forEach(el => { 
        const value = el.type === 'checkbox' ? el.checked : el.value; 
        feederData[el.id] = value; 
        const key = el.id.replace('feeder', '').charAt(0).toLowerCase() + el.id.replace('feeder', '').slice(1);
        feederDataForCalc[key] = isNaN(parseFloat(value)) || !isFinite(value) ? value : parseFloat(value);
    });

    const qdcsData = [];
    const allCircuitsForCalc = []; // Array plano para o worker
    
    document.querySelectorAll('#qdc-container .qdc-block').forEach(qdcBlock => {
        const qdcId = qdcBlock.dataset.id;
        const qdc = {
            id: qdcId,
            name: document.getElementById(`qdcName-${qdcId}`).value,
            parentId: document.getElementById(`qdcParent-${qdcId}`).value,
            circuits: []
            // NOTA: Os campos de config do QDC (solicitação 3) não são salvos
            // pois o worker.js não faz cálculo hierárquico.
        };

        qdcBlock.querySelectorAll('.circuit-block').forEach(circuitBlock => {
            const circuitId = circuitBlock.dataset.id;
            const circuitData = { id: circuitId }; // Para salvar no JSON
            const circuitDataForCalc = {}; // Para o worker
            
            circuitBlock.querySelectorAll('input, select').forEach(el => {
                const value = el.type === 'checkbox' ? el.checked : el.value;
                circuitData[el.id] = value;
                // Renomeia 'fases-${id}' para 'fases'
                const key = el.id.replace(`-${circuitId}`, '');
                circuitDataForCalc[key] = isNaN(parseFloat(value)) || !isFinite(value) ? value : parseFloat(value);
            });
            qdc.circuits.push(circuitData);
            allCircuitsForCalc.push(circuitDataForCalc); // Adiciona ao array plano
        });
        qdcsData.push(qdc);
    });

    const currentClientId = document.getElementById('currentClientId').value;
    const client = allClients.find(c => c.id == currentClientId);
    const clientProfile = client ? { cliente: client.nome, tipoDocumento: client.documento_tipo, documento: client.documento_valor, celular: client.celular, telefone: client.telefone, email: client.email, enderecoCliente: client.endereco } : {};
    
    if (forSave) { 
        return { 
            project_name: mainData.obra, 
            project_code: mainData.projectCode || null, 
            client_id: currentClientId || null, 
            main_data: mainData, 
            tech_data: { respTecnico: document.getElementById('respTecnico').value, titulo: document.getElementById('titulo').value, crea: document.getElementById('crea').value }, 
            feeder_data: feederData,
            qdcs_data: qdcsData,
            owner_id: currentUserProfile.id 
        }; 
    }
    
    // Para cálculo via worker (que é plano)
    return { 
        mainData, 
        feederData: feederDataForCalc,
        circuitsData: allCircuitsForCalc, // Envia o array plano de circuitos
        clientProfile 
    };
}

async function handleSaveProject() {
    if (!currentUserProfile) { alert("Você precisa estar logado."); return; }
    const nomeObra = document.getElementById('obra').value.trim();
    if (!nomeObra) { alert("Insira um 'Nome da Obra'."); return; }

    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = loadingOverlay.querySelector('p');
    loadingText.textContent = 'Salvando dados da obra...';
    loadingOverlay.classList.add('visible');
    
    try {
        await new Promise(resolve => setTimeout(resolve, 50));
        const projectDataToSave = getFullFormData(true);
        const currentProjectId = document.getElementById('currentProjectId').value;
        
        const { data, error } = await api.saveProject(projectDataToSave, currentProjectId);
        if (error) throw error;
        
        alert(`Obra "${data.project_name}" salva!`);
        document.getElementById('currentProjectId').value = data.id;
        document.getElementById('project_code').value = data.project_code;
        await handleSearch();
    } catch (error) {
        alert('Erro ao salvar obra: ' + error.message);
    } finally {
        loadingOverlay.classList.remove('visible');
        loadingText.textContent = 'Calculando...';
    }
}

async function handleLoadProject() {
    const projectId = document.getElementById('savedProjectsSelect').value;
    if (!projectId) return;

    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.classList.add('visible');
    try {
        await new Promise(resolve => setTimeout(resolve, 50));
        const project = await api.fetchProjectById(projectId);
        if (project) {
            ui.populateFormWithProjectData(project); // Chama a função de UI para preencher
            alert(`Obra "${project.project_name}" carregada.`);
        }
    } catch (error) {
        alert("Erro ao carregar a obra: " + error.message);
    } finally {
        loadingOverlay.classList.remove('visible');
    }
}

async function handleDeleteProject() { const projectId = document.getElementById('savedProjectsSelect').value; const projectName = document.getElementById('savedProjectsSelect').options[document.getElementById('savedProjectsSelect').selectedIndex].text; if (!projectId || !confirm(`Excluir a obra "${projectName}"?`)) return; const { error } = await api.deleteProject(projectId); if (error) { alert('Erro: ' + error.message); } else { alert("Obra excluída."); ui.resetForm(); await handleSearch(); } }
async function handleSearch(term = '') { if (!currentUserProfile) return; const projects = await api.fetchProjects(term); ui.populateProjectList(projects); }
async function showManageProjectsPanel() { const projects = await api.fetchProjects(''); allClients = await api.fetchClients(); const allUsers = await api.fetchAllUsers(); ui.populateProjectsPanel(projects, allClients, allUsers, currentUserProfile); ui.openModal('manageProjectsModalOverlay'); }
async function handleProjectPanelClick(event) { const target = event.target; const projectId = target.dataset.projectId; if (target.classList.contains('transfer-client-btn')) { const select = target.parentElement.querySelector('.transfer-client-select'); const newClientId = select.value || null; const { error } = await api.transferProjectClient(projectId, newClientId); if (error) { alert('Erro: ' + error.message); } else { alert('Cliente atualizado!'); await showManageProjectsPanel(); } } if (target.classList.contains('transfer-owner-btn')) { const select = target.parentElement.querySelector('.transfer-owner-select'); const newOwnerId = select.value; if (newOwnerId && confirm('Transferir propriedade?')) { const { error } = await api.transferProjectOwner(projectId, newOwnerId); if (error) { alert('Erro: ' + error.message); } else { alert('Propriedade transferida!'); await showManageProjectsPanel(); } } } }
async function showAdminPanel() { const users = await api.fetchAllUsers(); ui.populateUsersPanel(users); ui.openModal('adminPanelModalOverlay'); }
async function handleAdminUserActions(event) {
    const target = event.target;
    const userId = target.dataset.userId;
    if (target.classList.contains('approve-user-btn')) { await api.approveUser(userId); await showAdminPanel(); }
    if (target.classList.contains('edit-user-btn')) { const user = await api.fetchUserById(userId); if (user) ui.populateEditUserModal(user); }
    if (target.classList.contains('block-user-btn')) { const shouldBlock = target.dataset.isBlocked === 'true'; const actionText = shouldBlock ? 'bloquear' : 'desbloquear'; if (confirm(`Tem certeza?`)) { await api.toggleUserBlock(userId, shouldBlock); await showAdminPanel(); } }
    if (target.classList.contains('remove-user-btn')) { if (confirm('ATENÇÃO: Ação irreversível!')) { const { error } = await api.deleteUserFromAdmin(userId); if (error) { alert('Erro: ' + error.message); } else { alert('Usuário excluído.'); await showAdminPanel(); } } }
}
async function handleUpdateUser(event) { event.preventDefault(); const userId = document.getElementById('editUserId').value; const data = { nome: document.getElementById('editNome').value, cpf: document.getElementById('editCpf').value, telefone: document.getElementById('editTelefone').value, crea: document.getElementById('editCrea').value, }; const { error } = await api.updateUserProfile(userId, data); if (error) { alert("Erro: " + error.message); } else { alert("Usuário atualizado!"); ui.closeModal('editUserModalOverlay'); await showAdminPanel(); } }

// CORREÇÃO 1: Função modificada para usar o Worker local
async function handleCalculateAndPdf() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = loadingOverlay.querySelector('p');
    loadingText.textContent = 'Calculando, por favor aguarde...';
    loadingOverlay.classList.add('visible');
    
    // Pega os dados do formulário (agora retorna 'circuitsData' plano)
    const formData = getFullFormData(false);

    try {
        // ** NOVO: Usando o Web Worker (calculator.worker.js) **
        const results = await new Promise((resolve, reject) => {
            // Verifica se os dados técnicos (cabos, disjuntores...) foram carregados
            if (!uiData || !uiData.cabos || !uiData.disjuntores) {
                reject(new Error("Os dados técnicos (cabos, disjuntores, etc.) não foram carregados. Tente recarregar a página."));
                return;
            }

            // Criar o worker
            const worker = new Worker('calculator.worker.js', { type: 'module' });

            // Lidar com mensagens de sucesso do worker
            worker.onmessage = (e) => {
                if (e.data.error) {
                    reject(new Error(e.data.error));
                } else {
                    resolve(e.data); // Deve retornar { feederResult, circuitResults }
                }
                worker.terminate();
            };

            // Lidar com erros do worker
            worker.onerror = (e) => {
                reject(new Error(`Erro no Worker: ${e.message}`));
                worker.terminate();
            };

            // Envia os dados para o worker
            // O worker espera um objeto { formData, technicalData }
            // uiData contém todos os dados técnicos (cabos, disjuntores, etc.)
            worker.postMessage({ formData: formData, technicalData: uiData });
        });
        
        // Se chegou aqui, 'results' contém { feederResult, circuitResults }
        loadingText.textContent = 'Gerando PDFs...';
        await new Promise(resolve => setTimeout(resolve, 50));

        // Passa os resultados para as funções de PDF
        await ui.generateMemorialPdf(results, currentUserProfile);
        await ui.generateUnifilarPdf(results);

        alert("PDFs baixados com sucesso!");

    } catch (error) {
        console.error("Erro ao gerar PDFs:", error);
        alert("Ocorreu um erro: " + error.message);
    } finally {
        loadingOverlay.classList.remove('visible');
        loadingText.textContent = 'Calculando...';
    }
}


function setupEventListeners() {
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('registerBtn').addEventListener('click', () => ui.openModal('registerModalOverlay'));
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('forgotPasswordLink').addEventListener('click', (e) => { e.preventDefault(); ui.openModal('forgotPasswordModalOverlay'); });
    document.getElementById('forgotPasswordForm').addEventListener('submit', handleForgotPassword);
    document.getElementById('resetPasswordForm').addEventListener('submit', handleResetPassword);
    document.querySelectorAll('.close-modal-btn').forEach(btn => { btn.addEventListener('click', (e) => ui.closeModal(e.target.closest('.modal-overlay').id)); });
    
    document.getElementById('saveBtn').addEventListener('click', handleSaveProject);
    document.getElementById('loadBtn').addEventListener('click', handleLoadProject);
    document.getElementById('deleteBtn').addEventListener('click', handleDeleteProject);
    document.getElementById('newBtn').addEventListener('click', () => handleNewProject(true));
    const debouncedSearch = utils.debounce((e) => handleSearch(e.target.value), 300);
    document.getElementById('searchInput').addEventListener('input', debouncedSearch);
        
    document.getElementById('addQdcBtn').addEventListener('click', ui.addQdcBlock);
    document.getElementById('manageQdcsBtn').addEventListener('click', () => ui.openModal('qdcManagerModalOverlay'));
    
    const appContainer = document.getElementById('appContainer');
    if(appContainer) {
        appContainer.addEventListener('input', ui.handleMainContainerInteraction);
        appContainer.addEventListener('click', ui.handleMainContainerInteraction);
    }
    
    document.getElementById('calculateAndPdfBtn').addEventListener('click', handleCalculateAndPdf);
    
    document.getElementById('manageProjectsBtn').addEventListener('click', showManageProjectsPanel);
    const projectsTableBody = document.getElementById('adminProjectsTableBody');
    if(projectsTableBody) projectsTableBody.addEventListener('click', handleProjectPanelClick);
    
    document.getElementById('adminPanelBtn').addEventListener('click', showAdminPanel);
    const adminUserList = document.getElementById('adminUserList');
    if(adminUserList) adminUserList.addEventListener('click', handleAdminUserActions);
    
    const editUserForm = document.getElementById('editUserForm');
    if(editUserForm) editUserForm.addEventListener('submit', handleUpdateUser);
    
    document.getElementById('manageClientsBtn').addEventListener('click', handleOpenClientManagement);
    const clientForm = document.getElementById('clientForm');
    if(clientForm) clientForm.addEventListener('submit', handleClientFormSubmit);
    
    const clientList = document.getElementById('clientList');
    if(clientList) clientList.addEventListener('click', handleClientListClick);
    
    const clientFormCancelBtn = document.getElementById('clientFormCancelBtn');
    if(clientFormCancelBtn) clientFormCancelBtn.addEventListener('click', ui.resetClientForm);
    
    document.getElementById('confirmClientSelectionBtn').addEventListener('click', () => handleConfirmClientSelection(true));
    document.getElementById('continueWithoutClientBtn').addEventListener('click', handleContinueWithoutClient);
    document.getElementById('addNewClientFromSelectModalBtn').addEventListener('click', () => { ui.closeModal('selectClientModalOverlay'); handleOpenClientManagement(); });
    document.getElementById('changeClientBtn').addEventListener('click', async () => { allClients = await api.fetchClients(); ui.populateSelectClientModal(allClients, true); });
    
    // --- Máscaras ---
    document.getElementById('regCpf').addEventListener('input', utils.mascaraCPF);
    document.getElementById('regTelefone').addEventListener('input', utils.mascaraCelular);
    const editCpf = document.getElementById('editCpf');
    if(editCpf) editCpf.addEventListener('input', utils.mascaraCPF);
    const editTel = document.getElementById('editTelefone');
    if(editTel) editTel.addEventListener('input', utils.mascaraCelular);
    const clientCel = document.getElementById('clientCelular');
    if(clientCel) clientCel.addEventListener('input', utils.mascaraCelular);
    const clientTel = document.getElementById('clientTelefone');
    if(clientTel) clientTel.addEventListener('input', utils.mascaraTelefone);
    const clientDoc = document.getElementById('clientDocumentoValor');
    if(clientDoc) clientDoc.addEventListener('input', (e) => { const tipo = document.getElementById('clientDocumentoTipo').value; utils.aplicarMascara(e, tipo); });
    const clientDocTipo = document.getElementById('clientDocumentoTipo');
    if(clientDocTipo) clientDocTipo.addEventListener('change', () => { const docVal = document.getElementById('clientDocumentoValor'); if(docVal) docVal.value = ''; });
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
                    
                    // Carrega todos os dados (UI e Cálculo)
                    uiData = await api.fetchUiData();
                    if (uiData) {
                        ui.setupDynamicData(uiData);
                    }

                    ui.resetForm();
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