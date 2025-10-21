// Arquivo: main.js (Baseado na versão funcional + Edge Function + Log em handleSearch)

import * as auth from './auth.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as utils from './utils.js';
import { supabase } from './supabaseClient.js';

let currentUserProfile = null;
let allClients = [];
let uiData = null;

// --- handleLogin da versão funcional ---
async function handleLogin() {
    const email = document.getElementById('emailLogin').value;
    const password = document.getElementById('password').value;
    const userProfile = await auth.signInUser(email, password);
    if (!userProfile) { console.error("Falha no login ou usuário bloqueado/não aprovado."); }
}

// --- Funções de Autenticação e Gerenciamento (Sem alterações) ---
async function handleLogout() { await auth.signOutUser(); }
async function handleRegister(event) { event.preventDefault(); const email = document.getElementById('regEmail').value; const password = document.getElementById('regPassword').value; const details = { nome: document.getElementById('regNome').value, cpf: document.getElementById('regCpf').value, telefone: document.getElementById('regTelefone').value, crea: document.getElementById('regCrea').value, email: email }; const { error } = await auth.signUpUser(email, password, details); if (!error) { alert('Cadastro realizado com sucesso! Aguarde a aprovação de um administrador.'); ui.closeModal('registerModalOverlay'); event.target.reset(); } else { alert(`Erro no registro: ${error.message}`)} }
async function handleForgotPassword(event) { event.preventDefault(); const email = document.getElementById('forgotEmail').value; const { error } = await auth.sendPasswordResetEmail(email); if (error) { alert("Erro ao enviar e-mail: " + error.message); } else { alert("Se o e-mail estiver cadastrado, um link de redefinição foi enviado!"); ui.closeModal('forgotPasswordModalOverlay'); event.target.reset(); } }
async function handleResetPassword(event) { event.preventDefault(); const newPassword = document.getElementById('newPassword').value; if (!newPassword || newPassword.length < 6) { alert("A senha precisa ter no mínimo 6 caracteres."); return; } const { error } = await auth.updatePassword(newPassword); if (error) { alert("Erro ao atualizar senha: " + error.message); } else { alert("Senha atualizada com sucesso! A página será recarregada. Por favor, faça o login com sua nova senha."); window.location.hash = ''; window.location.reload(); } }
async function handleOpenClientManagement() { try { allClients = await api.fetchClients(); ui.populateClientManagementModal(allClients); ui.openModal('clientManagementModalOverlay'); } catch(e) {console.error("Erro ao carregar clientes:", e); alert('Erro ao carregar clientes.')}}
async function handleClientFormSubmit(event) { event.preventDefault(); const clientId = document.getElementById('clientId').value; const clientData = { nome: document.getElementById('clientNome').value, documento_tipo: document.getElementById('clientDocumentoTipo').value, documento_valor: document.getElementById('clientDocumentoValor').value, email: document.getElementById('clientEmail').value, celular: document.getElementById('clientCelular').value, telefone: document.getElementById('clientTelefone').value, endereco: document.getElementById('clientEndereco').value, owner_id: currentUserProfile.id }; try { let result; if (clientId) { result = await api.updateClient(clientId, clientData); } else { result = await api.addClient(clientData); } if (result.error) { throw result.error; } alert(clientId ? 'Cliente atualizado com sucesso!' : 'Cliente cadastrado com sucesso!'); ui.resetClientForm(); await handleOpenClientManagement(); } catch (error) { alert('Erro ao salvar cliente: ' + error.message); } }
async function handleClientListClick(event) { const target = event.target; const clientId = target.dataset.clientId; if (target.classList.contains('edit-client-btn')) { const clientToEdit = allClients.find(c => c.id == clientId); if (clientToEdit) ui.openEditClientForm(clientToEdit); } if (target.classList.contains('delete-client-btn')) { if (confirm('Tem certeza que deseja excluir este cliente?')) { const { error } = await api.deleteClient(clientId); if (error) { alert('Erro ao excluir cliente: ' + error.message); } else { await handleOpenClientManagement(); } } } }
async function handleNewProject(showModal = true) {
    try {
        if (showModal) {
            allClients = await api.fetchClients();
            ui.populateSelectClientModal(allClients);
            ui.openModal('selectClientModalOverlay'); // <-- ESTA LINHA FOI ADICIONADA
        } else {
            ui.resetForm();
        }
    } catch(e){ alert('Erro ao buscar clientes para nova obra.')}
}

// --- Funções de Projeto (Salvar, Carregar, Excluir) ---

// --- getFullFormData (Formatado para Edge Function E Salvar) ---
function getFullFormData(forSave = false) {
    const mainData = { obra: document.getElementById('obra').value, cidadeObra: document.getElementById('cidadeObra').value, enderecoObra: document.getElementById('enderecoObra').value, areaObra: document.getElementById('areaObra').value, unidadesResidenciais: document.getElementById('unidadesResidenciais').value, unidadesComerciais: document.getElementById('unidadesComerciais').value, observacoes: document.getElementById('observacoes').value, projectCode: document.getElementById('project_code').value };
    const feederData = {}; const feederDataForCalc = { id: 'feeder', nomeCircuito: "Alimentador Geral" };
    document.querySelectorAll('#feeder-form input, #feeder-form select').forEach(el => {
        const value = el.type === 'checkbox' ? el.checked : el.value; feederData[el.id] = value;
        const key = el.id.replace('feeder', '').charAt(0).toLowerCase() + el.id.replace('feeder', '').slice(1);
        let calcValue = value; if (el.type === 'number' || ['fatorDemanda', 'fatorPotencia', 'comprimentoM', 'limiteQuedaTensao'].includes(key)) { calcValue = parseFloat(value) || 0; } else if (['tensaoV', 'temperaturaAmbienteC'].includes(key)) { calcValue = parseInt(value, 10) || 0; } else if (key === 'resistividadeSolo') { calcValue = parseFloat(value) || 0; } else if (el.type === 'checkbox') { calcValue = el.checked; } feederDataForCalc[key] = calcValue;
    });
    const qdcsData = []; const allCircuitsForCalc = [];
    document.querySelectorAll('#qdc-container .qdc-block').forEach(qdcBlock => {
        const qdcId = qdcBlock.dataset.id; const qdcConfigData = {};
        qdcBlock.querySelectorAll('.qdc-config-grid input, .qdc-config-grid select').forEach(el => { qdcConfigData[el.id] = el.type === 'checkbox' ? el.checked : el.value; });
        const qdc = { id: qdcId, name: document.getElementById(`qdcName-${qdcId}`).value, parentId: document.getElementById(`qdcParent-${qdcId}`).value, config: qdcConfigData, circuits: [] };
        qdcBlock.querySelectorAll('.circuit-block').forEach(circuitBlock => {
            const circuitId = circuitBlock.dataset.id; const circuitData = { id: circuitId }; const circuitDataForCalc = { qdcId: qdcId, id: circuitId };
            circuitBlock.querySelectorAll('input, select').forEach(el => {
                const value = el.type === 'checkbox' ? el.checked : el.value; circuitData[el.id] = value;
                const key = el.id.replace(`-${circuitId}`, ''); let calcValue = value;
                if (el.type === 'number' || ['potenciaW', 'fatorDemanda', 'fatorPotencia', 'comprimentoM', 'limiteQuedaTensao'].includes(key)) { calcValue = parseFloat(value) || 0; } else if (['tensaoV', 'temperaturaAmbienteC', 'numCircuitosAgrupados'].includes(key)) { calcValue = parseInt(value, 10) || 0; } else if (key === 'resistividadeSolo') { calcValue = parseFloat(value) || 0; } else if (el.type === 'checkbox') { calcValue = el.checked; } circuitDataForCalc[key] = calcValue;
            });
            qdc.circuits.push(circuitData); allCircuitsForCalc.push(circuitDataForCalc);
        });
        qdcsData.push(qdc);
    });
    const currentClientId = document.getElementById('currentClientId').value; const client = allClients.find(c => c.id == currentClientId); const clientProfile = client ? { cliente: client.nome, tipoDocumento: client.documento_tipo, documento: client.documento_valor, celular: client.celular, telefone: client.telefone, email: client.email, enderecoCliente: client.endereco } : {};
    if (forSave) { return { project_name: mainData.obra, project_code: mainData.projectCode || null, client_id: currentClientId || null, main_data: mainData, tech_data: { respTecnico: document.getElementById('respTecnico').value, titulo: document.getElementById('titulo').value, crea: document.getElementById('crea').value }, feeder_data: feederData, qdcs_data: qdcsData, owner_id: currentUserProfile?.id }; }
    return { mainData, feederData: feederDataForCalc, circuitsData: allCircuitsForCalc, clientProfile }; // Para Edge Function
}


async function handleSaveProject() {
    if (!currentUserProfile) { alert("Você precisa estar logado."); return; }
    const nomeObra = document.getElementById('obra').value.trim();
    if (!nomeObra) { alert("Insira um 'Nome da Obra'."); return; }
    const loadingOverlay = document.getElementById('loadingOverlay'); const loadingText = loadingOverlay.querySelector('p');
    loadingText.textContent = 'Salvando dados da obra...'; loadingOverlay.classList.add('visible');
    try {
        await new Promise(resolve => setTimeout(resolve, 50));
        const projectDataToSave = getFullFormData(true);
        const currentProjectId = document.getElementById('currentProjectId').value;
        const { data, error } = await api.saveProject(projectDataToSave, currentProjectId);
        if (error) throw error;
        alert(`Obra "${data.project_name}" salva com sucesso!`);
        document.getElementById('currentProjectId').value = data.id;
        document.getElementById('project_code').value = data.project_code;
        await handleSearch();
    } catch (error) {
        console.error('Erro ao salvar obra:', error);
        alert('Erro ao salvar obra: ' + error.message);
    } finally {
        loadingOverlay.classList.remove('visible'); loadingText.textContent = 'Calculando...';
    }
}

async function handleLoadProject() {
    const projectId = document.getElementById('savedProjectsSelect').value;
    if (!projectId) { alert("Por favor, selecione uma obra para carregar."); return; }
    const loadingOverlay = document.getElementById('loadingOverlay'); loadingOverlay.classList.add('visible');
    try {
        await new Promise(resolve => setTimeout(resolve, 50));
        const project = await api.fetchProjectById(projectId);
        if (project) {
            ui.populateFormWithProjectData(project);
            alert(`Obra "${project.project_name}" carregada com sucesso.`);
        } else { alert("Não foi possível encontrar os dados da obra selecionada."); }
    } catch (error) {
         console.error('Erro ao carregar obra:', error); alert("Erro ao carregar a obra: " + error.message);
    } finally { loadingOverlay.classList.remove('visible'); }
}

async function handleDeleteProject() { const projectId = document.getElementById('savedProjectsSelect').value; const projectNameOption = document.getElementById('savedProjectsSelect').options[document.getElementById('savedProjectsSelect').selectedIndex]; const projectName = projectNameOption ? projectNameOption.text : "Selecionada"; if (!projectId) { alert("Selecione uma obra para excluir."); return; } if (!confirm(`Tem certeza que deseja excluir permanentemente a obra "${projectName}"? Esta ação não pode ser desfeita.`)) return; const { error } = await api.deleteProject(projectId); if (error) { console.error('Erro ao excluir obra:', error); alert('Erro ao excluir obra: ' + error.message); } else { alert(`Obra "${projectName}" excluída com sucesso.`); ui.resetForm(); await handleSearch(); } }

// ========================================================================
// >>>>> FUNÇÃO ATUALIZADA: handleSearch (com log) <<<<<
// ========================================================================
async function handleSearch(term = '') {
    if (!currentUserProfile) return;
    try {
        const projects = await api.fetchProjects(term);
        console.log("Projetos buscados:", projects); // <--- LOG ADICIONADO AQUI
        ui.populateProjectList(projects); // Chama a função para preencher o dropdown
    } catch(error){
        console.error("Erro ao buscar projetos:", error);
        // Evita alert para não interromper fluxo, mas loga o erro
    }
}

async function showManageProjectsPanel() { try { const projects = await api.fetchProjects(''); allClients = await api.fetchClients(); const allUsers = await api.fetchAllUsers(); ui.populateProjectsPanel(projects, allClients, allUsers, currentUserProfile); ui.openModal('manageProjectsModalOverlay'); } catch(error){ console.error("Erro ao abrir gerenciador de obras:", error); alert("Erro ao carregar dados para o gerenciador de obras."); } }
async function handleProjectPanelClick(event) { const target = event.target; const projectId = target.dataset.projectId; if(!projectId) return; if (target.classList.contains('transfer-client-btn')) { const select = target.closest('.action-group')?.querySelector('.transfer-client-select'); if(!select) return; const newClientId = select.value || null; const { error } = await api.transferProjectClient(projectId, newClientId); if (error) { alert('Erro ao transferir cliente: ' + error.message); } else { alert('Cliente da obra atualizado!'); await showManageProjectsPanel(); } } if (target.classList.contains('transfer-owner-btn')) { const select = target.closest('.action-group')?.querySelector('.transfer-owner-select'); if(!select) return; const newOwnerId = select.value; if (newOwnerId && confirm('Tem certeza que deseja transferir a propriedade desta obra para outro usuário?')) { const { error } = await api.transferProjectOwner(projectId, newOwnerId); if (error) { alert('Erro ao transferir propriedade: ' + error.message); } else { alert('Propriedade da obra transferida com sucesso!'); await showManageProjectsPanel(); } } } }
async function showAdminPanel() { try { const users = await api.fetchAllUsers(); ui.populateUsersPanel(users); ui.openModal('adminPanelModalOverlay'); } catch(error){ console.error("Erro ao buscar usuários:", error); alert("Não foi possível carregar a lista de usuários."); } }
async function handleAdminUserActions(event) {
    const target = event.target; const userId = target.dataset.userId; if (!userId) return;
    try {
        if (target.classList.contains('approve-user-btn')) { await api.approveUser(userId); await showAdminPanel(); }
        if (target.classList.contains('edit-user-btn')) { const user = await api.fetchUserById(userId); if (user) ui.populateEditUserModal(user); }
        if (target.classList.contains('block-user-btn')) { const shouldBlock = target.dataset.isBlocked === 'true'; if (confirm(`Tem certeza que deseja ${shouldBlock ? 'bloquear' : 'desbloquear'} este usuário?`)) { await api.toggleUserBlock(userId, shouldBlock); await showAdminPanel(); } }
        if (target.classList.contains('remove-user-btn')) { if (confirm('ATENÇÃO: Ação irreversível! Excluir este usuário permanentemente?')) { const { data, error } = await api.deleteUserFromAdmin(userId); if (error) { throw error; } alert(data?.message || 'Usuário excluído com sucesso.'); await showAdminPanel(); } }
    } catch (error) { console.error("Erro na ação administrativa:", error); alert("Ocorreu um erro: " + error.message); await showAdminPanel(); }
}
async function handleUpdateUser(event) { event.preventDefault(); const userId = document.getElementById('editUserId').value; const data = { nome: document.getElementById('editNome').value, cpf: document.getElementById('editCpf').value, telefone: document.getElementById('editTelefone').value, crea: document.getElementById('editCrea').value, }; const { error } = await api.updateUserProfile(userId, data); if (error) { alert("Erro ao atualizar usuário: " + error.message); } else { alert("Usuário atualizado com sucesso!"); ui.closeModal('editUserModalOverlay'); await showAdminPanel(); } }

// --- handleCalculateAndPdf (Usando Edge Function) ---
async function handleCalculateAndPdf() {
    if (!uiData) { alert("Erro: Dados técnicos não carregados..."); return; }
    if (!currentUserProfile) { alert("Erro: Usuário não autenticado..."); await handleLogout(); return; }
    const loadingOverlay = document.getElementById('loadingOverlay'); const loadingText = loadingOverlay.querySelector('p');
    loadingText.textContent = 'Calculando no servidor...'; loadingOverlay.classList.add('visible');
    const formDataForFunction = getFullFormData(false);
    try {
        console.log("Enviando para Edge Function 'calculate':", JSON.stringify(formDataForFunction, null, 2));
        const { data: results, error: functionError } = await supabase.functions.invoke('calculate', { body: { formData: formDataForFunction }, });
        if (functionError) { let errMsg = functionError.message; let errorDetails = null; try { errorDetails = await functionError.context?.json(); if (errorDetails?.error) { errMsg = errorDetails.error; } console.error("Detalhes do erro da Edge Function:", errorDetails || functionError.context?.statusText); } catch(e) { console.error("Erro ao parsear detalhes do erro:", e); console.error("Contexto original:", functionError.context); } throw new Error(`Erro na Edge Function (${functionError.context?.status || 'N/A'}): ${errMsg}`); }
        if (!results || !results.feederResult || !results.circuitResults) { console.error("Resposta inesperada:", results); throw new Error("A função de cálculo retornou dados incompletos. Verifique os logs da Edge Function."); }
        console.log("Resultados recebidos:", results);
        loadingText.textContent = 'Gerando PDFs...'; await new Promise(resolve => setTimeout(resolve, 50));
        await ui.generateMemorialPdf(results, currentUserProfile);
        await ui.generateUnifilarPdf(results);
        alert("PDFs gerados e baixados com sucesso!");
    } catch (error) {
        console.error("Erro durante cálculo ou PDF:", error); alert("Ocorreu um erro: " + error.message + "\nVerifique o console.");
    } finally {
        loadingOverlay.classList.remove('visible'); loadingText.textContent = 'Calculando...';
    }
}


function setupEventListeners() {
    // --- Listeners da versão funcional ---
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
    document.getElementById('addQdcBtn').addEventListener('click', () => ui.addQdcBlock()); // Listener corrigido
    document.getElementById('manageQdcsBtn').addEventListener('click', () => ui.openModal('qdcManagerModalOverlay'));
    const appContainer = document.getElementById('appContainer'); if(appContainer) { appContainer.addEventListener('input', ui.handleMainContainerInteraction); appContainer.addEventListener('click', ui.handleMainContainerInteraction); }
    document.getElementById('calculateAndPdfBtn').addEventListener('click', handleCalculateAndPdf); // Chama a versão com Edge Function
    document.getElementById('manageProjectsBtn').addEventListener('click', showManageProjectsPanel);
    const projectsTableBody = document.getElementById('adminProjectsTableBody'); if(projectsTableBody) projectsTableBody.addEventListener('click', handleProjectPanelClick);
    document.getElementById('adminPanelBtn').addEventListener('click', showAdminPanel);
    const adminUserList = document.getElementById('adminUserList'); if(adminUserList) adminUserList.addEventListener('click', handleAdminUserActions);
    const editUserForm = document.getElementById('editUserForm'); if(editUserForm) editUserForm.addEventListener('submit', handleUpdateUser);
    document.getElementById('manageClientsBtn').addEventListener('click', handleOpenClientManagement);
    const clientForm = document.getElementById('clientForm'); if(clientForm) clientForm.addEventListener('submit', handleClientFormSubmit);
    const clientList = document.getElementById('clientList'); if(clientList) clientList.addEventListener('click', handleClientListClick);
    const clientFormCancelBtn = document.getElementById('clientFormCancelBtn'); if(clientFormCancelBtn) clientFormCancelBtn.addEventListener('click', ui.resetClientForm);
    document.getElementById('confirmClientSelectionBtn').addEventListener('click', () => { const isChange = document.querySelector('#selectClientModalOverlay h3')?.textContent.includes('Alterar'); handleConfirmClientSelection(isChange); });
    document.getElementById('changeClientBtn').addEventListener('click', async () => { try { allClients = await api.fetchClients(); ui.populateSelectClientModal(allClients, true);} catch(e){ alert("Erro ao carregar clientes.")} });
    document.getElementById('continueWithoutClientBtn').addEventListener('click', handleContinueWithoutClient);
    document.getElementById('addNewClientFromSelectModalBtn').addEventListener('click', () => { ui.closeModal('selectClientModalOverlay'); handleOpenClientManagement(); });
    // --- Máscaras ---
    document.getElementById('regCpf')?.addEventListener('input', utils.mascaraCPF); document.getElementById('regTelefone')?.addEventListener('input', utils.mascaraCelular); document.getElementById('editCpf')?.addEventListener('input', utils.mascaraCPF); document.getElementById('editTelefone')?.addEventListener('input', utils.mascaraCelular); document.getElementById('clientCelular')?.addEventListener('input', utils.mascaraCelular); document.getElementById('clientTelefone')?.addEventListener('input', utils.mascaraTelefone); const clientDoc = document.getElementById('clientDocumentoValor'); if(clientDoc) clientDoc.addEventListener('input', (e) => { const tipo = document.getElementById('clientDocumentoTipo')?.value; if(tipo) utils.aplicarMascara(e, tipo); }); const clientDocTipo = document.getElementById('clientDocumentoTipo'); if(clientDocTipo) clientDocTipo.addEventListener('change', () => { const docVal = document.getElementById('clientDocumentoValor'); if(docVal) docVal.value = ''; });
}

// --- onAuthStateChange da versão funcional ---
function main() {
    setupEventListeners();

    supabase.auth.onAuthStateChange(async (event, session) => {
        const hash = window.location.hash;

        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
            if (session) {
                const userProfile = await auth.getSession();
                if (userProfile && userProfile.is_approved && !userProfile.is_blocked) {
                    currentUserProfile = userProfile;
                    // Carrega dados técnicos ANTES de mostrar App
                    if (!uiData) {
                        console.log("Carregando dados técnicos...");
                        uiData = await api.fetchUiData();
                        if (uiData) {
                            ui.setupDynamicData(uiData);
                            console.log("Dados técnicos carregados.");
                        } else {
                            console.error("Falha CRÍTICA ao carregar dados técnicos!");
                            alert("Erro CRÍTICO ao carregar dados técnicos. A aplicação não pode continuar.");
                            ui.showLoginView(); currentUserProfile = null; await auth.signOutUser(); return;
                        }
                    }
                    ui.showAppView(currentUserProfile); // Mostra App
                    try { allClients = await api.fetchClients(); } catch (e) { console.error("Erro ao carregar clientes:", e); }

                    if (hash.includes('type=recovery') && event === 'SIGNED_IN') {
                        console.log("Recuperação de senha detectada."); ui.showResetPasswordView();
                    } else if (!hash.includes('type=recovery')) {
                        ui.resetForm();
                        await handleSearch(); // Chama handleSearch AQUI após reset
                    }

                } else if (userProfile && !userProfile.is_approved) {
                    alert("Seu cadastro ainda não foi aprovado."); await auth.signOutUser();
                } else if (userProfile && userProfile.is_blocked) {
                    alert("Seu usuário está bloqueado."); await auth.signOutUser();
                } else {
                    console.warn("Sessão encontrada, mas perfil inválido/não encontrado."); await auth.signOutUser();
                }
            } else {
                 if (!hash.includes('type=recovery')) { ui.showLoginView(); }
                 else { console.log("Hash de recuperação sem sessão."); }
            }
        } else if (event === 'SIGNED_OUT') {
            console.log("Usuário deslogado."); currentUserProfile = null; allClients = []; ui.showLoginView(); window.location.hash = '';
        } else if (event === 'PASSWORD_RECOVERY') {
             console.log("Evento PASSWORD_RECOVERY."); ui.showResetPasswordView();
        }
    });
}

main();