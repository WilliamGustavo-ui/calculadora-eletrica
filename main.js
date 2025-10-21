// Arquivo: main.js (VERSÃO COMPLETA - CORRIGIDA PARA USAR EDGE FUNCTION)

import * as auth from './auth.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as utils from './utils.js';
import { supabase } from './supabaseClient.js';

let currentUserProfile = null;
let allClients = [];
let uiData = null; // Armazenará todos os dados técnicos carregados

async function handleLogin() {
    const email = document.getElementById('emailLogin').value;
    const password = document.getElementById('password').value;
    const userProfile = await auth.signInUser(email, password);
    if (userProfile) {
        // A verificação de aprovação e bloqueio é feita dentro de signInUser
        currentUserProfile = userProfile;
        ui.showAppView(currentUserProfile);

        // Carrega TODOS os dados técnicos (cabos, disjuntores, etc.) UMA VEZ
        if (!uiData) {
            console.log("Carregando dados técnicos da API...");
            uiData = await api.fetchUiData();
            if (uiData) {
                ui.setupDynamicData(uiData);
                console.log("Dados técnicos carregados e configurados na UI.");
            } else {
                 alert("Erro crítico ao carregar dados técnicos essenciais. Algumas funcionalidades podem não operar corretamente. Tente recarregar a página.");
                 // Poderia desabilitar o botão de cálculo aqui
            }
        } else {
            console.log("Dados técnicos já carregados.");
        }

        ui.resetForm(); // Inicia o formulário com o primeiro QDC
        await handleSearch(); // Carrega a lista de projetos
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
function handleConfirmClientSelection(isChange = false) { const select = document.getElementById('clientSelectForNewProject'); const selectedOption = select.options[select.selectedIndex]; const currentProjectId = document.getElementById('currentProjectId').value; if (select.value) { const client = JSON.parse(selectedOption.dataset.client); if (isChange && currentProjectId) { document.getElementById('currentClientId').value = client.id; document.getElementById('clientLinkDisplay').textContent = `Cliente Vinculado: ${client.nome} (${client.client_code || 'S/C'})`; } else { ui.resetForm(true, client); } } ui.closeModal('selectClientModalOverlay'); }
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
        // Converte números corretamente para cálculo
        feederDataForCalc[key] = (el.type === 'number' || el.step || ['fatorDemanda', 'fatorPotencia', 'comprimentoM', 'limiteQuedaTensao'].includes(key)) ? parseFloat(value) || 0 : value;
         // Trata campos específicos que podem vir de selects mas precisam ser número
         if (['tensaoV', 'temperaturaAmbienteC'].includes(key)) {
            feederDataForCalc[key] = parseInt(value, 10) || 0;
         }
         if (key === 'resistividadeSolo') {
             feederDataForCalc[key] = parseFloat(value) || 0;
         }
    });

    const qdcsData = []; // Para salvar no banco
    const allCircuitsForCalc = []; // Para enviar para a Edge Function

    document.querySelectorAll('#qdc-container .qdc-block').forEach(qdcBlock => {
        const qdcId = qdcBlock.dataset.id;

        const qdcConfigData = {}; // Dados de config do QDC para salvar
        qdcBlock.querySelectorAll('.qdc-config-grid input, .qdc-config-grid select').forEach(el => {
            const value = el.type === 'checkbox' ? el.checked : el.value;
            qdcConfigData[el.id] = value;
        });

        const qdc = {
            id: qdcId,
            name: document.getElementById(`qdcName-${qdcId}`).value,
            parentId: document.getElementById(`qdcParent-${qdcId}`).value,
            config: qdcConfigData, // Salva os dados de config do QDC
            circuits: []
        };

        qdcBlock.querySelectorAll('.circuit-block').forEach(circuitBlock => {
            const circuitId = circuitBlock.dataset.id;
            const circuitData = { id: circuitId }; // Para salvar no banco
            const circuitDataForCalc = { qdcId: qdcId, id: circuitId }; // Inclui qdcId e id original para cálculo/memorial

            circuitBlock.querySelectorAll('input, select').forEach(el => {
                const value = el.type === 'checkbox' ? el.checked : el.value;
                circuitData[el.id] = value; // Para salvar
                const key = el.id.replace(`-${circuitId}`, '');
                // Converte números corretamente para cálculo
                circuitDataForCalc[key] = (el.type === 'number' || el.step || ['potenciaW', 'fatorDemanda', 'fatorPotencia', 'comprimentoM', 'limiteQuedaTensao'].includes(key)) ? parseFloat(value) || 0 : value;

                 // Trata campos específicos que podem vir de selects mas precisam ser número
                 if (['tensaoV', 'temperaturaAmbienteC', 'numCircuitosAgrupados'].includes(key)) {
                    circuitDataForCalc[key] = parseInt(value, 10) || 0;
                 }
                 if (key === 'resistividadeSolo') {
                     circuitDataForCalc[key] = parseFloat(value) || 0;
                 }
                 // Garante que booleanos sejam booleanos
                 if (el.type === 'checkbox') {
                    circuitDataForCalc[key] = value; // Já é boolean
                 }

            });
            qdc.circuits.push(circuitData);
            allCircuitsForCalc.push(circuitDataForCalc);
        });
        qdcsData.push(qdc);
    });

    const currentClientId = document.getElementById('currentClientId').value;
    const client = allClients.find(c => c.id == currentClientId);
    const clientProfile = client ? { cliente: client.nome, tipoDocumento: client.documento_tipo, documento: client.documento_valor, celular: client.celular, telefone: client.telefone, email: client.email, enderecoCliente: client.endereco } : {};

    if (forSave) {
        // Objeto para salvar no banco de dados Supabase
        return {
            project_name: mainData.obra,
            project_code: mainData.projectCode || null,
            client_id: currentClientId || null,
            main_data: mainData,
            tech_data: { respTecnico: document.getElementById('respTecnico').value, titulo: document.getElementById('titulo').value, crea: document.getElementById('crea').value },
            feeder_data: feederData, // Salva os dados brutos do formulário feeder
            qdcs_data: qdcsData,   // Salva os dados brutos dos QDCs e seus circuitos
            owner_id: currentUserProfile.id
        };
    }

    // Objeto para enviar para a Edge Function 'calculate'
    return {
        mainData, // Dados gerais da obra
        feederData: feederDataForCalc, // Dados do alimentador formatados para cálculo
        circuitsData: allCircuitsForCalc, // Array plano de todos os circuitos formatados para cálculo
        clientProfile // Dados do cliente (se houver)
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
        const projectDataToSave = getFullFormData(true); // Pega dados formatados para salvar
        const currentProjectId = document.getElementById('currentProjectId').value;

        const { data, error } = await api.saveProject(projectDataToSave, currentProjectId);
        if (error) throw error;

        alert(`Obra "${data.project_name}" salva com sucesso!`);
        document.getElementById('currentProjectId').value = data.id; // Atualiza ID se for novo projeto
        document.getElementById('project_code').value = data.project_code; // Atualiza código se for gerado
        await handleSearch(); // Atualiza a lista de projetos salvos no dropdown
    } catch (error) {
        console.error('Erro ao salvar obra:', error); // Log detalhado do erro
        alert('Erro ao salvar obra: ' + error.message);
    } finally {
        loadingOverlay.classList.remove('visible');
        loadingText.textContent = 'Calculando...'; // Reset texto
    }
}

async function handleLoadProject() {
    const projectId = document.getElementById('savedProjectsSelect').value;
    if (!projectId) {
        alert("Por favor, selecione uma obra para carregar.");
        return;
    }

    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.classList.add('visible');
    try {
        await new Promise(resolve => setTimeout(resolve, 50)); // Pequeno delay para UI atualizar
        const project = await api.fetchProjectById(projectId);
        if (project) {
            ui.populateFormWithProjectData(project); // Preenche o formulário com os dados carregados
            alert(`Obra "${project.project_name}" carregada com sucesso.`);
        } else {
            alert("Não foi possível encontrar os dados da obra selecionada.");
        }
    } catch (error) {
         console.error('Erro ao carregar obra:', error); // Log detalhado do erro
        alert("Erro ao carregar a obra: " + error.message);
    } finally {
        loadingOverlay.classList.remove('visible');
    }
}

async function handleDeleteProject() { const projectId = document.getElementById('savedProjectsSelect').value; const projectNameOption = document.getElementById('savedProjectsSelect').options[document.getElementById('savedProjectsSelect').selectedIndex]; const projectName = projectNameOption ? projectNameOption.text : "Selecionada"; if (!projectId) { alert("Selecione uma obra para excluir."); return; } if (!confirm(`Tem certeza que deseja excluir permanentemente a obra "${projectName}"? Esta ação não pode ser desfeita.`)) return; const { error } = await api.deleteProject(projectId); if (error) { console.error('Erro ao excluir obra:', error); alert('Erro ao excluir obra: ' + error.message); } else { alert(`Obra "${projectName}" excluída com sucesso.`); ui.resetForm(); await handleSearch(); } }
async function handleSearch(term = '') { if (!currentUserProfile) return; try { const projects = await api.fetchProjects(term); ui.populateProjectList(projects); } catch(error){ console.error("Erro ao buscar projetos:", error); alert("Não foi possível buscar a lista de obras.");} }
async function showManageProjectsPanel() { try { const projects = await api.fetchProjects(''); allClients = await api.fetchClients(); const allUsers = await api.fetchAllUsers(); ui.populateProjectsPanel(projects, allClients, allUsers, currentUserProfile); ui.openModal('manageProjectsModalOverlay'); } catch(error){ console.error("Erro ao abrir gerenciador de obras:", error); alert("Erro ao carregar dados para o gerenciador de obras."); } }
async function handleProjectPanelClick(event) { const target = event.target; const projectId = target.dataset.projectId; if (target.classList.contains('transfer-client-btn')) { const select = target.closest('.action-group').querySelector('.transfer-client-select'); const newClientId = select.value || null; const { error } = await api.transferProjectClient(projectId, newClientId); if (error) { alert('Erro ao transferir cliente: ' + error.message); } else { alert('Cliente da obra atualizado!'); await showManageProjectsPanel(); } } if (target.classList.contains('transfer-owner-btn')) { const select = target.closest('.action-group').querySelector('.transfer-owner-select'); const newOwnerId = select.value; if (newOwnerId && confirm('Tem certeza que deseja transferir a propriedade desta obra para outro usuário?')) { const { error } = await api.transferProjectOwner(projectId, newOwnerId); if (error) { alert('Erro ao transferir propriedade: ' + error.message); } else { alert('Propriedade da obra transferida com sucesso!'); await showManageProjectsPanel(); } } } }
async function showAdminPanel() { try { const users = await api.fetchAllUsers(); ui.populateUsersPanel(users); ui.openModal('adminPanelModalOverlay'); } catch(error){ console.error("Erro ao buscar usuários:", error); alert("Não foi possível carregar a lista de usuários."); } }
async function handleAdminUserActions(event) {
    const target = event.target;
    const userId = target.dataset.userId;
    if (!userId) return; // Sai se não houver ID

    try {
        if (target.classList.contains('approve-user-btn')) { await api.approveUser(userId); await showAdminPanel(); }
        if (target.classList.contains('edit-user-btn')) { const user = await api.fetchUserById(userId); if (user) ui.populateEditUserModal(user); }
        if (target.classList.contains('block-user-btn')) { const shouldBlock = target.dataset.isBlocked === 'true'; if (confirm(`Tem certeza que deseja ${shouldBlock ? 'bloquear' : 'desbloquear'} este usuário?`)) { await api.toggleUserBlock(userId, shouldBlock); await showAdminPanel(); } }
        if (target.classList.contains('remove-user-btn')) { if (confirm('ATENÇÃO: Ação irreversível! Excluir este usuário permanentemente?')) { const { data, error } = await api.deleteUserFromAdmin(userId); if (error) { throw error; } alert(data?.message || 'Usuário excluído com sucesso.'); await showAdminPanel(); } }
    } catch (error) {
         console.error("Erro na ação administrativa:", error);
         alert("Ocorreu um erro: " + error.message);
         await showAdminPanel(); // Recarrega o painel mesmo em caso de erro
    }
}
async function handleUpdateUser(event) { event.preventDefault(); const userId = document.getElementById('editUserId').value; const data = { nome: document.getElementById('editNome').value, cpf: document.getElementById('editCpf').value, telefone: document.getElementById('editTelefone').value, crea: document.getElementById('editCrea').value, }; const { error } = await api.updateUserProfile(userId, data); if (error) { alert("Erro ao atualizar usuário: " + error.message); } else { alert("Usuário atualizado com sucesso!"); ui.closeModal('editUserModalOverlay'); await showAdminPanel(); } }

// ========================================================================
// >>>>> FUNÇÃO ATUALIZADA: handleCalculateAndPdf (para usar Edge Function) <<<<<
// ========================================================================
async function handleCalculateAndPdf() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = loadingOverlay.querySelector('p');
    loadingText.textContent = 'Calculando no servidor...'; // Atualiza texto de loading
    loadingOverlay.classList.add('visible');

    // Pega os dados do formulário formatados para a Edge Function
    const formDataForFunction = getFullFormData(false);

    try {
        // --- CHAMA A EDGE FUNCTION 'calculate' ---
        console.log("Enviando para Edge Function 'calculate':", JSON.stringify(formDataForFunction, null, 2)); // Log formatado para depuração
        const { data: results, error: functionError } = await supabase.functions.invoke('calculate', {
            body: { formData: formDataForFunction }, // Envia o formData no corpo
        });

        // --- TRATAMENTO DE ERRO DETALHADO ---
        if (functionError) {
            let errMsg = functionError.message;
            let errorDetails = null;
            try {
                 // Tenta pegar a mensagem de erro específica retornada pela função
                 errorDetails = await functionError.context?.json();
                 if (errorDetails?.error) {
                     errMsg = errorDetails.error;
                 }
                 console.error("Detalhes do erro da Edge Function:", errorDetails || functionError.context?.statusText);
            } catch(e) {
                 console.error("Erro ao parsear detalhes do erro da Edge Function:", e);
                 console.error("Contexto original do erro:", functionError.context); // Loga o contexto original
            }
            throw new Error(`Erro na Edge Function (${functionError.context?.status || 'N/A'}): ${errMsg}`);
        }

        // Verifica se a resposta da função contém os resultados esperados
        if (!results || !results.feederResult || !results.circuitResults) {
            console.error("Resposta inesperada ou incompleta da Edge Function:", results);
            throw new Error("A função de cálculo retornou dados incompletos ou em formato inválido. Verifique os logs da Edge Function no Supabase.");
        }
        console.log("Resultados recebidos da Edge Function:", results); // Log de sucesso
        // --- FIM DA CHAMADA À EDGE FUNCTION ---

        loadingText.textContent = 'Gerando PDFs...';
        await new Promise(resolve => setTimeout(resolve, 50)); // Pequeno delay para UI

        // Passa os resultados recebidos da função para as funções de PDF
        // Garante que currentUserProfile esteja disponível
        if (!currentUserProfile) {
            throw new Error("Perfil do usuário não carregado. Não é possível gerar o memorial.");
        }
        await ui.generateMemorialPdf(results, currentUserProfile);
        await ui.generateUnifilarPdf(results);

        alert("PDFs gerados e baixados com sucesso!");

    } catch (error) {
        console.error("Erro durante cálculo ou geração de PDF:", error);
        alert("Ocorreu um erro: " + error.message + "\nVerifique o console para mais detalhes."); // Informa sobre o console
    } finally {
        loadingOverlay.classList.remove('visible');
        loadingText.textContent = 'Calculando...'; // Reset texto original do loading
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
    document.getElementById('newBtn').addEventListener('click', () => handleNewProject(true)); // Passa true para mostrar modal
    const debouncedSearch = utils.debounce((e) => handleSearch(e.target.value), 300);
    document.getElementById('searchInput').addEventListener('input', debouncedSearch);

    // Listener corrigido para o botão principal Add QDC
    document.getElementById('addQdcBtn').addEventListener('click', () => ui.addQdcBlock());

    document.getElementById('manageQdcsBtn').addEventListener('click', () => ui.openModal('qdcManagerModalOverlay'));

    const appContainer = document.getElementById('appContainer');
    if(appContainer) {
        // Listener geral para interações DENTRO dos QDCs/Circuitos (colapsar, remover, inputs)
        // O listener específico para '+ Circuito' foi movido para dentro de addQdcBlock no ui.js
        appContainer.addEventListener('input', ui.handleMainContainerInteraction);
        appContainer.addEventListener('click', ui.handleMainContainerInteraction);
    }

    // Botão principal para calcular e gerar PDFs
    document.getElementById('calculateAndPdfBtn').addEventListener('click', handleCalculateAndPdf);

    // Botões e listeners para painéis de gerenciamento
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

    // Listeners do modal de seleção de cliente
    document.getElementById('confirmClientSelectionBtn').addEventListener('click', () => {
         const isChange = document.querySelector('#selectClientModalOverlay h3').textContent.includes('Alterar'); // Verifica se é alteração
         handleConfirmClientSelection(isChange);
    });
    // Botão "Alterar Cliente" no formulário principal
    document.getElementById('changeClientBtn').addEventListener('click', async () => {
        allClients = await api.fetchClients();
        ui.populateSelectClientModal(allClients, true); // true indica que é para alterar
    });

    document.getElementById('continueWithoutClientBtn').addEventListener('click', handleContinueWithoutClient);
    document.getElementById('addNewClientFromSelectModalBtn').addEventListener('click', () => { ui.closeModal('selectClientModalOverlay'); handleOpenClientManagement(); });


    // --- Máscaras ---
    document.getElementById('regCpf')?.addEventListener('input', utils.mascaraCPF);
    document.getElementById('regTelefone')?.addEventListener('input', utils.mascaraCelular);
    document.getElementById('editCpf')?.addEventListener('input', utils.mascaraCPF);
    document.getElementById('editTelefone')?.addEventListener('input', utils.mascaraCelular);
    document.getElementById('clientCelular')?.addEventListener('input', utils.mascaraCelular);
    document.getElementById('clientTelefone')?.addEventListener('input', utils.mascaraTelefone);
    const clientDoc = document.getElementById('clientDocumentoValor');
    if(clientDoc) clientDoc.addEventListener('input', (e) => { const tipo = document.getElementById('clientDocumentoTipo')?.value; if(tipo) utils.aplicarMascara(e, tipo); });
    const clientDocTipo = document.getElementById('clientDocumentoTipo');
    if(clientDocTipo) clientDocTipo.addEventListener('change', () => { const docVal = document.getElementById('clientDocumentoValor'); if(docVal) docVal.value = ''; });
}

function main() {
    setupEventListeners();

    supabase.auth.onAuthStateChange(async (event, session) => {
        const hash = window.location.hash; // Pega o hash ANTES de qualquer redirect

        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
            if (session) {
                const userProfile = await auth.getSession();
                 // Verifica aprovação e bloqueio
                if (userProfile && userProfile.is_approved && !userProfile.is_blocked) {
                    currentUserProfile = userProfile;
                    ui.showAppView(currentUserProfile);
                    allClients = await api.fetchClients(); // Carrega clientes após login

                    // Carrega dados técnicos UMA VEZ após login bem-sucedido
                    if (!uiData) {
                        console.log("Carregando dados técnicos...");
                        uiData = await api.fetchUiData();
                        if (uiData) {
                            ui.setupDynamicData(uiData);
                             console.log("Dados técnicos carregados.");
                        } else {
                            console.error("Falha ao carregar dados técnicos!");
                            alert("Erro ao carregar dados técnicos essenciais. Tente recarregar a página.");
                        }
                    }

                    // Verifica se há hash para recuperação de senha APÓS login inicial
                    if (hash.includes('type=recovery') && event === 'SIGNED_IN') {
                        console.log("Detectado hash de recuperação de senha.");
                        ui.showResetPasswordView(); // Mostra a view de resetar senha
                    } else if (!hash.includes('type=recovery')) {
                        // Só reseta o form e busca se NÃO estiver no fluxo de reset de senha
                        ui.resetForm();
                        await handleSearch();
                    }

                } else if (userProfile && !userProfile.is_approved) {
                    alert("Seu cadastro ainda não foi aprovado por um administrador.");
                    await auth.signOutUser(); // Desloga
                    // ui.showLoginView() será chamado pelo evento SIGNED_OUT
                } else if (userProfile && userProfile.is_blocked) {
                    alert("Seu usuário está temporariamente bloqueado. Contate um administrador.");
                    await auth.signOutUser(); // Desloga
                     // ui.showLoginView() será chamado pelo evento SIGNED_OUT
                } else {
                     // Caso userProfile seja null ou falhe por outro motivo (sessão inválida?)
                    console.warn("Sessão encontrada, mas perfil inválido ou não encontrado. Deslogando.");
                    await auth.signOutUser();
                     // ui.showLoginView() será chamado pelo evento SIGNED_OUT
                }
            } else {
                // Sem sessão ativa E não está no fluxo de recuperação que força login
                 if (!hash.includes('type=recovery')) {
                    ui.showLoginView();
                 } else {
                     // Se tem hash de recovery mas não tem sessão, algo está estranho, mas deixa tentar o reset
                     console.log("Hash de recuperação detectado, mas sem sessão ativa (pode ocorrer após submit do reset).");
                     // A view de reset PODE já estar visível se o evento foi PASSWORD_RECOVERY
                 }
            }
        } else if (event === 'SIGNED_OUT') {
            console.log("Usuário deslogado.");
            currentUserProfile = null;
            allClients = [];
            // uiData = null; // Decide se quer limpar os dados técnicos ao deslogar
            ui.showLoginView();
            window.location.hash = ''; // Limpa hash ao sair
        } else if (event === 'PASSWORD_RECOVERY') {
             // Este evento ocorre QUANDO o usuário clica no link do email.
             // O Supabase força um login temporário e adiciona o hash.
             // A lógica no SIGNED_IN agora trata a exibição da view correta.
             console.log("Evento PASSWORD_RECOVERY recebido.");
             // A ação de mostrar a view de reset é feita no handler de SIGNED_IN/INITIAL_SESSION
             // ui.showResetPasswordView(); // Mover para SIGNED_IN
        }
    });
}

main();