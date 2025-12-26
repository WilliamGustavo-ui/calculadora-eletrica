// Arquivo: main.js (v9.0 - Otimizado para Memória e Prevenção de Travamentos)

import * as auth from './auth.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as utils from './utils.js';
import { supabase } from './supabaseClient.js';

let currentUserProfile = null;
let allClients = [];
let uiData = null;

// Variável global para controle de memória do PDF
let currentPdfUrl = null;

// --- handleLogin ---
async function handleLogin() {
    const email = document.getElementById('emailLogin').value;
    const password = document.getElementById('password').value;
    const userProfile = await auth.signInUser(email, password);
    if (!userProfile) {
        console.error("Falha no login ou usuário bloqueado/não aprovado.");
    }
}

// --- Funções de Autenticação e Gerenciamento ---
async function handleLogout() {
    await auth.signOutUser();
}

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
    } else {
        alert(`Erro no registro: ${error.message}`);
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

async function handleOpenClientManagement() {
    try {
        allClients = await api.fetchClients();
        ui.populateClientManagementModal(allClients);
        ui.openModal('clientManagementModalOverlay');
    } catch(error) {
        console.error("Erro ao carregar clientes:", error);
        alert('Erro ao carregar clientes.');
    }
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
        let result;
        if (clientId) {
            result = await api.updateClient(clientId, clientData);
        } else {
            result = await api.addClient(clientData);
        }
        if (result.error) { throw result.error; }
        alert(clientId ? 'Cliente atualizado com sucesso!' : 'Cliente cadastrado com sucesso!');
        ui.resetClientForm();
        await handleOpenClientManagement(); 
    } catch (error) {
        alert('Erro ao salvar cliente: ' + error.message);
    }
}

async function handleClientListClick(event) {
    const target = event.target;
    const clientId = target.dataset.clientId;

    if (target.classList.contains('edit-client-btn')) {
        const clientToEdit = allClients.find(client => client.id == clientId);
        if (clientToEdit) {
            ui.openEditClientForm(clientToEdit);
        }
    }

    if (target.classList.contains('delete-client-btn')) {
        if (confirm('Tem certeza que deseja excluir este cliente?')) {
            const { error } = await api.deleteClient(clientId);
            if (error) {
                alert('Erro ao excluir cliente: ' + error.message);
            } else {
                await handleOpenClientManagement(); 
            }
        }
    }
}

async function handleNewProject(showModal = true) {
    try {
        if (showModal) {
            allClients = await api.fetchClients();
            ui.populateSelectClientModal(allClients);
            ui.openModal('selectClientModalOverlay');
        } else {
            ui.resetForm();
        }
    } catch(error){
        alert('Erro ao buscar clientes para nova obra.');
        console.error("Erro em handleNewProject:", error);
    }
}

function handleConfirmClientSelection(isChange = false) {
    const selectedClientId = document.getElementById('clientSelectForNewProject').value;
    const client = allClients.find(c => c.id == selectedClientId);

    if (!isChange) {
        ui.resetForm(true, client); 
    } else {
        if (client) {
            document.getElementById('clientLinkDisplay').textContent = `Cliente: ${client.nome} (${client.client_code || 'S/C'})`;
            document.getElementById('currentClientId').value = client.id;
        } else {
            document.getElementById('clientLinkDisplay').textContent = 'Cliente: Nenhum';
            document.getElementById('currentClientId').value = '';
        }
    }
    ui.closeModal('selectClientModalOverlay');
}

function handleContinueWithoutClient() {
    handleNewProject(false); 
    ui.closeModal('selectClientModalOverlay');
}

// --- Funções de Projeto ---

async function getFullFormData(forSave = false) {
    const mainData = { 
        obra: document.getElementById('obra').value, 
        cidadeObra: document.getElementById('cidadeObra').value, 
        enderecoObra: document.getElementById('enderecoObra').value, 
        areaObra: document.getElementById('areaObra').value, 
        unidadesResidenciais: document.getElementById('unidadesResidenciais').value, 
        unidadesComerciais: document.getElementById('unidadesComerciais').value, 
        observacoes: document.getElementById('observacoes').value, 
        projectCode: document.getElementById('project_code').value 
    };
    
    const currentClientId = document.getElementById('currentClientId').value;
    const client = allClients.find(c => c.id == currentClientId);
    const clientProfile = client ? { 
        cliente: client.nome, 
        tipoDocumento: client.documento_tipo, 
        documento: client.documento_valor, 
        celular: client.celular, 
        telefone: client.telefone, 
        email: client.email, 
        enderecoCliente: client.endereco 
    } : {};
    
    const techData = { 
        respTecnico: document.getElementById('respTecnico').value, 
        titulo: document.getElementById('titulo').value, 
        crea: document.getElementById('crea').value 
    };
    
    const feederData = {};
    const feederDataForCalc = { id: 'feeder', nomeCircuito: "Alimentador Geral" };
    document.querySelectorAll('#feeder-form input, #feeder-form select').forEach(element => { 
        const value = element.type === 'checkbox' ? element.checked : element.value; 
        feederData[element.id] = value; 
        const key = element.id.replace('feeder', '').charAt(0).toLowerCase() + element.id.replace('feeder', '').slice(1); 
        let calcValue = value; 
        if (element.type === 'number' || ['fatorDemanda', 'fatorPotencia', 'comprimentoM', 'limiteQuedaTensao'].includes(key)) { 
            calcValue = parseFloat(value) || 0; 
        } else if (['tensaoV', 'temperaturaAmbienteC'].includes(key)) { 
            calcValue = parseInt(value, 10) || 0; 
        } else if (key === 'resistividadeSolo') { 
            calcValue = parseFloat(value) || 0; 
        } else if (element.type === 'checkbox') { 
            calcValue = element.checked; 
        } feederDataForCalc[key] = calcValue; 
    });
    
    const qdcsDataForSave = [];
    const qdcsDataForCalc = [];
    const allCircuitsForCalc = [];

    const allQdcBlocks = document.querySelectorAll('#qdc-container .qdc-block');
    
    for (const qdcBlock of allQdcBlocks) {
        const qdcId = qdcBlock.dataset.id;
        const qdcConfigDataForSave = {};
        const qdcConfigDataForCalc = {};
        
        qdcBlock.querySelectorAll('.qdc-config-grid input, .qdc-config-grid select').forEach(element => { 
            const value = element.type === 'checkbox' ? element.checked : element.value; 
            qdcConfigDataForSave[element.id] = value; 
            const key = element.id.replace(`qdc`, '').replace(`-${qdcId}`, '').replace(/^[A-Z]/, l => l.toLowerCase()); 
            let calcValue = value; 
            if (element.type === 'number' || ['fatorDemanda', 'fatorPotencia', 'comprimentoM', 'limiteQuedaTensao'].includes(key)) { 
                calcValue = parseFloat(value) || 0; 
            } else if (['tensaoV', 'temperaturaAmbienteC', 'numCircuitosAgrupados'].includes(key)) { 
                calcValue = parseInt(value, 10) || 0; if (key === 'numCircuitosAgrupados' && calcValue === 0) calcValue = 1; 
            } else if (key === 'resistividadeSolo') { 
                calcValue = parseFloat(value) || 0; 
            } else if (element.type === 'checkbox') { 
                calcValue = element.checked; 
            } qdcConfigDataForCalc[key] = calcValue; 
        });
        
        const qdcInfo = { 
            id: qdcId, 
            name: document.getElementById(`qdcName-${qdcId}`)?.value || `QDC ${qdcId}`, 
            parentId: document.getElementById(`qdcParent-${qdcId}`)?.value || 'feeder' 
        };
        qdcsDataForCalc.push({ ...qdcInfo, config: qdcConfigDataForCalc });
        
        const circuitsForSave = [];
        qdcBlock.querySelectorAll('.circuit-block').forEach(circuitBlock => {
            const circuitId = circuitBlock.dataset.id;
            const circuitDataForSave = { id: circuitId };
            const circuitDataForCalc = { qdcId: qdcId, id: circuitId };
            
            circuitBlock.querySelectorAll('input, select').forEach(element => {
                const value = element.type === 'checkbox' ? element.checked : element.value;
                circuitDataForSave[element.id] = value;
                const key = element.id.replace(`-${circuitId}`, '');
                let calcValue = value;
                if (element.type === 'number' || ['potenciaW', 'fatorDemanda', 'fatorPotencia', 'comprimentoM', 'limiteQuedaTensao'].includes(key)) { 
                    calcValue = parseFloat(value) || 0; 
                } else if (['tensaoV', 'temperaturaAmbienteC', 'numCircuitosAgrupados'].includes(key)) { 
                    calcValue = parseInt(value, 10) || 0; if (key === 'numCircuitosAgrupados' && calcValue === 0) calcValue = 1; 
                } else if (key === 'resistividadeSolo') { 
                    calcValue = parseFloat(value) || 0; 
                } else if (element.type === 'checkbox') { 
                    calcValue = element.checked; 
                }
                circuitDataForCalc[key] = calcValue;
            });
            
            circuitsForSave.push(circuitDataForSave);
            allCircuitsForCalc.push(circuitDataForCalc);
        });
        
        qdcsDataForSave.push({ ...qdcInfo, config: qdcConfigDataForSave, circuits: circuitsForSave });

        await new Promise(resolve => setTimeout(resolve, 0));
    }

    if (forSave) {
        return { 
            project_name: mainData.obra, 
            project_code: mainData.projectCode || null, 
            client_id: currentClientId || null, 
            main_data: mainData, 
            tech_data: techData, 
            feeder_data: feederData, 
            qdcs_data: qdcsDataForSave, 
            owner_id: currentUserProfile?.id 
        };
    }
    else {
        return { mainData, feederData: feederDataForCalc, qdcsData: qdcsDataForCalc, circuitsData: allCircuitsForCalc, clientProfile, techData };
    }
}

async function handleSaveProject() {
    if (!currentUserProfile) { alert("Você precisa estar logado."); return; }
    const nomeObra = document.getElementById('obra').value.trim();
    if (!nomeObra) { alert("Insira um 'Nome da Obra'."); return; }
    const loadingOverlay = document.getElementById('loadingOverlay'); 
    const loadingText = loadingOverlay.querySelector('p');
    loadingText.textContent = 'Coletando dados...'; loadingOverlay.classList.add('visible');
    try {
        await new Promise(resolve => setTimeout(resolve, 50));
        const projectDataToSave = await getFullFormData(true);
        loadingText.textContent = 'Salvando dados da obra...';
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
        loadingOverlay.classList.remove('visible'); 
    }
}

function populateFormWithProjectData(project) {
    if (!project) return;
    ui.resetForm(false, project.client); 

    if (typeof ui.setLoadedProjectData === 'function') {
        ui.setLoadedProjectData(project);
    }

    document.getElementById('currentProjectId').value = project.id;

    if (project.main_data) { 
        Object.keys(project.main_data).forEach(key => { 
            const el = document.getElementById(key); 
            if (el) el.value = project.main_data[key]; 
        }); 
    }
    document.getElementById('project_code').value = project.project_code || '';
    if (project.tech_data) { 
        Object.keys(project.tech_data).forEach(key => { 
            const el = document.getElementById(key); 
            if (el) el.value = project.tech_data[key]; 
        }); 
    }
    if (project.feeder_data) { 
        Object.keys(project.feeder_data).forEach(key => { 
            const el = document.getElementById(key); 
            if (el) { 
                if (el.type === 'checkbox') el.checked = project.feeder_data[key]; 
                else el.value = project.feeder_data[key]; 
            } 
        });
        document.getElementById('feederFases')?.dispatchEvent(new Event('change'));
        document.getElementById('feederTipoIsolacao')?.dispatchEvent(new Event('change'));
    }

    const qdcContainerTarget = document.getElementById('qdc-container');
    if (project.qdcs_data && Array.isArray(project.qdcs_data) && qdcContainerTarget) {
        const fragment = document.createDocumentFragment();
        const qdcMap = new Map();
        project.qdcs_data.forEach(qdc => qdcMap.set(String(qdc.id), qdc));

        const sortedQdcs = []; const visited = new Set();
        function visit(qdcId) { 
            if (!qdcId || visited.has(qdcId)) return; 
            const qdc = qdcMap.get(qdcId); 
            if (!qdc) return; 
            visited.add(qdcId); 
            const parentValue = qdc.parentId; 
            if (parentValue && parentValue !== 'feeder') { 
                const parentId = parentValue.replace('qdc-', ''); 
                visit(parentId); 
            } 
            if(!sortedQdcs.some(sq => sq.id == qdc.id)) { sortedQdcs.push(qdc); } 
        }
        project.qdcs_data.forEach(qdc => visit(String(qdc.id)));

        sortedQdcs.forEach(qdc => {
            const renderedQdcId = ui.addQdcBlock(String(qdc.id), qdc.name, qdc.parentId, fragment);
            const qdcElementInFragment = fragment.querySelector(`#qdc-${renderedQdcId}`);
            if (qdc.config) { 
                Object.keys(qdc.config).forEach(key => { 
                    const el = qdcElementInFragment.querySelector(`#${key}`); 
                    if (el) { 
                        if (el.type === 'checkbox') (el).checked = qdc.config[key]; 
                        else (el).value = qdc.config[key]; 
                    } 
                }); 
            }
        });

        qdcContainerTarget.appendChild(fragment);

        sortedQdcs.forEach(qdc => {
            const renderedQdcId = String(qdc.id);
            ui.initializeQdcListeners(renderedQdcId); 
            document.getElementById(`qdcFases-${renderedQdcId}`)?.dispatchEvent(new Event('change'));
            document.getElementById(`qdcTipoIsolacao-${renderedQdcId}`)?.dispatchEvent(new Event('change'));
        });

        ui.updateQdcParentDropdowns();
        setTimeout(() => { ui.updateFeederPowerDisplay(); }, 100);

    } else {
        ui.updateFeederPowerDisplay();
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
            populateFormWithProjectData(project); 
            alert(`Obra "${project.project_name}" carregada com sucesso.`);
        } else { alert("Não foi possível encontrar os dados da obra selecionada."); }
    } catch (error) {
         console.error('Erro ao carregar obra:', error); alert("Erro ao carregar a obra: " + error.message);
    } finally { loadingOverlay.classList.remove('visible'); }
}

async function handleDeleteProject() {
    const projectId = document.getElementById('savedProjectsSelect').value;
    const projectNameOption = document.getElementById('savedProjectsSelect').options[document.getElementById('savedProjectsSelect').selectedIndex];
    const projectName = projectNameOption ? projectNameOption.text : "Selecionada";
    if (!projectId) { alert("Selecione uma obra para excluir."); return; }
    if (!confirm(`Tem certeza que deseja excluir permanentemente a obra "${projectName}"? Esta ação não pode ser desfeita.`)) return;
    const { error } = await api.deleteProject(projectId);
    if (error) {
        console.error('Erro ao excluir obra:', error); alert('Erro ao excluir obra: ' + error.message);
    } else {
        alert(`Obra "${projectName}" excluída com sucesso.`);
        ui.resetForm();
        await handleSearch();
    }
}

async function handleSearch(term = '') {
    if (!currentUserProfile) return;
    try {
        const projects = await api.fetchProjects(term);
        ui.populateProjectList(projects);
    } catch(error){
        console.error("Erro ao buscar projetos:", error);
    }
}

async function showManageProjectsPanel() {
     try {
         const projects = await api.fetchProjects('');
         allClients = await api.fetchClients();
         const allUsers = await api.fetchAllUsers();
         ui.populateProjectsPanel(projects, allClients, allUsers, currentUserProfile);
         ui.openModal('manageProjectsModalOverlay');
     } catch(error){
         console.error("Erro ao abrir gerenciador de obras:", error);
         alert("Erro ao carregar dados para o gerenciador de obras.");
     }
 }

async function handleProjectPanelClick(event) {
    const target = event.target;
    const projectId = target.dataset.projectId;
    if(!projectId) return;

    if (target.classList.contains('transfer-client-btn')) {
        const select = target.closest('.action-group')?.querySelector('.transfer-client-select');
        if(!select) return;
        const newClientId = select.value || null;
        const { error } = await api.transferProjectClient(projectId, newClientId);
        if (error) { alert('Erro ao transferir cliente: ' + error.message); }
        else { alert('Cliente da obra atualizado!'); await showManageProjectsPanel(); }
    }

    if (target.classList.contains('transfer-owner-btn')) {
        const select = target.closest('.action-group')?.querySelector('.transfer-owner-select');
        if(!select) return;
        const newOwnerId = select.value;
        if (newOwnerId && confirm('Tem certeza que deseja transferir a propriedade desta obra para outro usuário?')) {
            const { error } = await api.transferProjectOwner(projectId, newOwnerId);
            if (error) { alert('Erro ao transferir propriedade: ' + error.message); }
            else { alert('Propriedade da obra transferida com sucesso!'); await showManageProjectsPanel(); }
        }
    }
}

async function showAdminPanel() {
    try {
        const users = await api.fetchAllUsers();
        ui.populateUsersPanel(users);
        ui.openModal('adminPanelModalOverlay');
    } catch(error){
        console.error("Erro ao buscar usuários:", error);
        alert("Não foi possível carregar a lista de usuários.");
    }
}

async function handleAdminUserActions(event) {
    const target = event.target;
    const userId = target.dataset.userId;
    if (!userId) return;
    try {
        if (target.classList.contains('approve-user-btn')) {
            await api.approveUser(userId); await showAdminPanel();
        } else if (target.classList.contains('edit-user-btn')) {
            const user = await api.fetchUserById(userId); if (user) ui.populateEditUserModal(user); else alert(`Usuário ${userId} não encontrado.`);
        } else if (target.classList.contains('block-user-btn')) {
            const isCurrentlyBlocked = target.dataset.isBlocked === 'true';
            const shouldBlock = !isCurrentlyBlocked;
            if (confirm(`Tem certeza que deseja ${shouldBlock ? 'BLOQUEAR' : 'DESBLOQUEAR'} este usuário?`)) {
                const { error: updateError } = await api.toggleUserBlock(userId, shouldBlock);
                if (updateError) throw updateError;
                const updatedUsers = await api.fetchAllUsers(); 
                if (updatedUsers) ui.populateUsersPanel(updatedUsers); 
                else await showAdminPanel(); 
            }
        } else if (target.classList.contains('remove-user-btn')) {
            if (confirm('ATENÇÃO: Ação irreversível! Excluir este usuário permanentemente?')) {
                const { data, error: deleteError } = await api.deleteUserFromAdmin(userId);
                if (deleteError) throw deleteError;
                alert(data?.message || 'Usuário excluído com sucesso.');
                await showAdminPanel();
            }
        }
    } catch (error) {
        console.error("[Admin Action] Erro:", error); alert("Erro: " + error.message);
        try { await showAdminPanel(); } catch (refreshError) { console.error("Erro ao recarregar painel:", refreshError); }
    }
}

async function handleUpdateUser(event) { 
    event.preventDefault(); 
    const userId = document.getElementById('editUserId').value; 
    const data = { 
        nome: document.getElementById('editNome').value, 
        cpf: document.getElementById('editCpf').value, 
        telefone: document.getElementById('editTelefone').value, 
        crea: document.getElementById('editCrea').value, 
    }; 
    const { error } = await api.updateUserProfile(userId, data); 
    if (error) { alert("Erro ao atualizar usuário: " + error.message); } 
    else { alert("Usuário atualizado com sucesso!"); ui.closeModal('editUserModalOverlay'); await showAdminPanel(); } 
}

// --- handleCalculateAndPdf (Versão Otimizada v9.0) ---
async function handleCalculateAndPdf() {
    if (!uiData) { alert("Erro: Dados técnicos não carregados..."); return; }
    if (!currentUserProfile) { alert("Erro: Usuário não autenticado..."); await handleLogout(); return; }

    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = loadingOverlay.querySelector('p');
    
    // LIMPEZA DE MEMÓRIA: Revoga a URL do Blob anterior se existir
    if (currentPdfUrl) {
        URL.revokeObjectURL(currentPdfUrl);
        currentPdfUrl = null;
        console.log("Memória do PDF anterior liberada.");
    }

    const oldLinkContainer = document.getElementById('pdfLinkContainer');
    if (oldLinkContainer) oldLinkContainer.remove();

    loadingText.textContent = 'Coletando dados do formulário...';
    loadingOverlay.classList.add('visible');
    
    try {
        const formDataForFunction = await getFullFormData(false);

        loadingText.textContent = 'Gerando relatório PDF (isso pode demorar em obras grandes)...';

        const { data: pdfBlob, error: functionError } = await supabase.functions.invoke('gerar-relatorio', {
            body: { formData: formDataForFunction },
            responseType: 'blob'
        });

        if (functionError) {
             let errMsg = functionError.message;
             try {
                 const errorText = await functionError.context.blob.text();
                 const errorJson = JSON.parse(errorText);
                 if (errorJson.error) errMsg = errorJson.error;
             } catch(e) {}
            throw new Error(`Erro na Edge Function: ${errMsg}`);
        }
        if (!pdfBlob || pdfBlob.size === 0) throw new Error("O servidor retornou um arquivo vazio.");

        // CRIAÇÃO DA NOVA URL E DOWNLOAD
        currentPdfUrl = URL.createObjectURL(pdfBlob);
        const nomeObra = document.getElementById('obra')?.value || 'Projeto';
        const fileName = `Relatorio_${nomeObra.replace(/[^a-z0-9]/gi, '_')}.pdf`;

        const a = document.createElement('a');
        a.href = currentPdfUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Feedback visual
        const linkContainer = document.createElement('div');
        linkContainer.id = 'pdfLinkContainer';
        linkContainer.style.cssText = 'margin-top: 15px; text-align: center;';

        const manualBtn = document.createElement('a');
        manualBtn.href = currentPdfUrl;
        manualBtn.textContent = "Baixar PDF Novamente";
        manualBtn.className = 'btn-green';
        manualBtn.style.display = 'inline-block';

        linkContainer.appendChild(manualBtn);
        const buttonContainer = document.querySelector('.button-container');
        if (buttonContainer) buttonContainer.after(linkContainer);

        alert("PDF gerado com sucesso!");

    } catch (error) {
        console.error("Erro:", error);
        alert("Erro ao gerar PDF: " + error.message);
    } finally {
        loadingOverlay.classList.remove('visible');
    }
}

// --- setupEventListeners ---
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
    
    document.getElementById('addQdcBtn').addEventListener('click', () => ui.addQdcBlock());
    document.getElementById('manageQdcsBtn').addEventListener('click', () => ui.openModal('qdcManagerModalOverlay'));
    
    const appContainer = document.getElementById('appContainer');
    if(appContainer) {
        appContainer.addEventListener('change', ui.handleMainContainerInteraction);
        appContainer.addEventListener('click', ui.handleMainContainerInteraction);
        appContainer.addEventListener('input', (event) => { 
            const target = event.target; 
            if (target.id.startsWith('potenciaW-') || target.id.startsWith('fatorDemanda-') || target.id.startsWith('qdcFatorDemanda-') || target.id === 'feederFatorDemanda') { 
                ui.updateFeederPowerDisplay(); 
            } 
            if (target.classList.contains('qdc-name-input')) { 
                utils.debounce(ui.updateQdcParentDropdowns, 400)(); 
            } 
            if (target.id.startsWith('nomeCircuito-')) { 
                const circuitId = target.closest('.circuit-block')?.dataset.id; 
                if (circuitId) { 
                    const label = document.getElementById(`nomeCircuitoLabel-${circuitId}`); 
                    if(label) label.textContent = target.value || `Circuito ${circuitId}`; 
                } 
            } 
        });
    }
    document.getElementById('calculateAndPdfBtn').addEventListener('click', handleCalculateAndPdf);
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
    
    document.getElementById('regCpf')?.addEventListener('input', utils.mascaraCPF); 
    document.getElementById('regTelefone')?.addEventListener('input', utils.mascaraCelular); 
    document.getElementById('editCpf')?.addEventListener('input', utils.mascaraCPF); 
    document.getElementById('editTelefone')?.addEventListener('input', utils.mascaraCelular); 
    document.getElementById('clientCelular')?.addEventListener('input', utils.mascaraCelular); 
    document.getElementById('clientTelefone')?.addEventListener('input', utils.mascaraTelefone); 
    
    const clientDocInput = document.getElementById('clientDocumentoValor'); 
    if(clientDocInput) { 
        clientDocInput.addEventListener('input', (event) => { 
            const tipo = document.getElementById('clientDocumentoTipo')?.value; 
            if(tipo) utils.aplicarMascara(event, tipo); 
        }); 
    }
}

// --- main ---
function main() {
    setupEventListeners();

    supabase.auth.onAuthStateChange(async (event, session) => {
        const hash = window.location.hash;

        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
            if (session) {
                const userProfile = await auth.getSession();
                if (userProfile && userProfile.is_approved && !userProfile.is_blocked) {
                    currentUserProfile = userProfile;
                    if (!uiData) {
                        uiData = await api.fetchUiData();
                        if (uiData) {
                            ui.setupDynamicData(uiData);
                        } else {
                            alert("Erro ao carregar dados técnicos."); ui.showLoginView(); await auth.signOutUser(); return;
                        }
                    }
                    ui.showAppView(currentUserProfile);
                    try { allClients = await api.fetchClients(); } catch (e) {}

                    if (hash.includes('type=recovery')) {
                         ui.showResetPasswordView();
                    } else {
                        ui.resetForm();
                        await handleSearch();
                    }

                } else if (userProfile && !userProfile.is_approved) {
                    alert("Seu cadastro ainda não foi aprovado."); await auth.signOutUser(); ui.showLoginView();
                } else if (userProfile && userProfile.is_blocked) {
                    alert("Seu usuário está bloqueado."); await auth.signOutUser(); ui.showLoginView();
                } else {
                    await auth.signOutUser(); ui.showLoginView();
                }
            } else {
                 if (!hash.includes('type=recovery')) { ui.showLoginView(); }
            }
        } else if (event === 'SIGNED_OUT') {
            currentUserProfile = null; allClients = []; uiData = null;
            ui.showLoginView(); window.location.hash = '';
        } else if (event === 'PASSWORD_RECOVERY') {
              ui.showResetPasswordView();
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    main(); 
});