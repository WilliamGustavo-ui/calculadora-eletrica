// Arquivo: main.js (v8.2 - Correção de travamento PÓS-DOWNLOAD com URL.createObjectURL)

import * as auth from './auth.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as utils from './utils.js';
import { supabase } from './supabaseClient.js';

let currentUserProfile = null;
let allClients = [];
let uiData = null;

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
        await handleOpenClientManagement(); // Recarrega
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
                await handleOpenClientManagement(); // Recarrega
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
        ui.resetForm(true, client); // Reseta formulário VINCULANDO o cliente
    } else {
        // Apenas muda o cliente no projeto atual
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
    handleNewProject(false); // Reseta formulário sem cliente
    ui.closeModal('selectClientModalOverlay');
}

// --- Funções de Projeto (Salvar, Carregar, Excluir) ---

// (Função assíncrona para não travar a UI ao coletar dados)
async function getFullFormData(forSave = false) {
    // Coleta dados dos forms e formata para salvar ou calcular
    const mainData = { obra: document.getElementById('obra').value, cidadeObra: document.getElementById('cidadeObra').value, enderecoObra: document.getElementById('enderecoObra').value, areaObra: document.getElementById('areaObra').value, unidadesResidenciais: document.getElementById('unidadesResidenciais').value, unidadesComerciais: document.getElementById('unidadesComerciais').value, observacoes: document.getElementById('observacoes').value, projectCode: document.getElementById('project_code').value };
    const currentClientId = document.getElementById('currentClientId').value;
    const client = allClients.find(c => c.id == currentClientId);
    const clientProfile = client ? { cliente: client.nome, tipoDocumento: client.documento_tipo, documento: client.documento_valor, celular: client.celular, telefone: client.telefone, email: client.email, enderecoCliente: client.endereco } : {};
    const techData = { respTecnico: document.getElementById('respTecnico').value, titulo: document.getElementById('titulo').value, crea: document.getElementById('crea').value };
    const feederData = {};
    const feederDataForCalc = { id: 'feeder', nomeCircuito: "Alimentador Geral" };
    document.querySelectorAll('#feeder-form input, #feeder-form select').forEach(element => { const value = element.type === 'checkbox' ? element.checked : element.value; feederData[element.id] = value; const key = element.id.replace('feeder', '').charAt(0).toLowerCase() + element.id.replace('feeder', '').slice(1); let calcValue = value; if (element.type === 'number' || ['fatorDemanda', 'fatorPotencia', 'comprimentoM', 'limiteQuedaTensao'].includes(key)) { calcValue = parseFloat(value) || 0; } else if (['tensaoV', 'temperaturaAmbienteC'].includes(key)) { calcValue = parseInt(value, 10) || 0; } else if (key === 'resistividadeSolo') { calcValue = parseFloat(value) || 0; } else if (element.type === 'checkbox') { calcValue = element.checked; } feederDataForCalc[key] = calcValue; });
    
    const qdcsDataForSave = [];
    const qdcsDataForCalc = [];
    const allCircuitsForCalc = [];

    const allQdcBlocks = document.querySelectorAll('#qdc-container .qdc-block');
    
    for (const qdcBlock of allQdcBlocks) {
        const qdcId = qdcBlock.dataset.id;
        const qdcConfigDataForSave = {};
        const qdcConfigDataForCalc = {};
        
        qdcBlock.querySelectorAll('.qdc-config-grid input, .qdc-config-grid select').forEach(element => { const value = element.type === 'checkbox' ? element.checked : element.value; qdcConfigDataForSave[element.id] = value; const key = element.id.replace(`qdc`, '').replace(`-${qdcId}`, '').replace(/^[A-Z]/, l => l.toLowerCase()); let calcValue = value; if (element.type === 'number' || ['fatorDemanda', 'fatorPotencia', 'comprimentoM', 'limiteQuedaTensao'].includes(key)) { calcValue = parseFloat(value) || 0; } else if (['tensaoV', 'temperaturaAmbienteC', 'numCircuitosAgrupados'].includes(key)) { calcValue = parseInt(value, 10) || 0; if (key === 'numCircuitosAgrupados' && calcValue === 0) calcValue = 1; } else if (key === 'resistividadeSolo') { calcValue = parseFloat(value) || 0; } else if (element.type === 'checkbox') { calcValue = element.checked; } qdcConfigDataForCalc[key] = calcValue; });
        
        const qdcInfo = { id: qdcId, name: document.getElementById(`qdcName-${qdcId}`)?.value || `QDC ${qdcId}`, parentId: document.getElementById(`qdcParent-${qdcId}`)?.value || 'feeder' };
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
                if (element.type === 'number' || ['potenciaW', 'fatorDemanda', 'fatorPotencia', 'comprimentoM', 'limiteQuedaTensao'].includes(key)) { calcValue = parseFloat(value) || 0; } else if (['tensaoV', 'temperaturaAmbienteC', 'numCircuitosAgrupados'].includes(key)) { calcValue = parseInt(value, 10) || 0; if (key === 'numCircuitosAgrupados' && calcValue === 0) calcValue = 1; } else if (key === 'resistividadeSolo') { calcValue = parseFloat(value) || 0; } else if (element.type === 'checkbox') { calcValue = element.checked; }
                circuitDataForCalc[key] = calcValue;
            });
            
            circuitsForSave.push(circuitDataForSave);
            allCircuitsForCalc.push(circuitDataForCalc);
        });
        
        qdcsDataForSave.push({ ...qdcInfo, config: qdcConfigDataForSave, circuits: circuitsForSave });

        // Pausa a execução para permitir que a UI (spinner) atualize
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    if (forSave) {
        return { project_name: mainData.obra, project_code: mainData.projectCode || null, client_id: currentClientId || null, main_data: mainData, tech_data: techData, feeder_data: feederData, qdcs_data: qdcsDataForSave, owner_id: currentUserProfile?.id };
    }
    else {
        return { mainData, feederData: feederDataForCalc, qdcsData: qdcsDataForCalc, circuitsData: allCircuitsForCalc, clientProfile, techData };
    }
}


async function handleSaveProject() {
    if (!currentUserProfile) { alert("Você precisa estar logado."); return; }
    const nomeObra = document.getElementById('obra').value.trim();
    if (!nomeObra) { alert("Insira um 'Nome da Obra'."); return; }
    const loadingOverlay = document.getElementById('loadingOverlay'); const loadingText = loadingOverlay.querySelector('p');
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
        loadingOverlay.classList.remove('visible'); loadingText.textContent = 'Calculando...';
    }
}

function populateFormWithProjectData(project) {
    console.time("populateForm");
    if (!project) return;
    ui.resetForm(false, project.client); // Reseta, sem QDC default, mas com cliente

    if (typeof ui.setLoadedProjectData === 'function') {
        ui.setLoadedProjectData(project);
    } else {
        console.error("Função ui.setLoadedProjectData não encontrada! Lazy loading não funcionará.");
        alert("Erro interno: Falha ao preparar carregamento dos circuitos. Tente recarregar a página.");
    }

    document.getElementById('currentProjectId').value = project.id;

    // Preenche dados principais, técnico e alimentador geral
    if (project.main_data) { Object.keys(project.main_data).forEach(key => { const el = document.getElementById(key); if (el) el.value = project.main_data[key]; }); }
    document.getElementById('project_code').value = project.project_code || '';
    if (project.tech_data) { Object.keys(project.tech_data).forEach(key => { const el = document.getElementById(key); if (el) el.value = project.tech_data[key]; }); }
    if (project.feeder_data) { Object.keys(project.feeder_data).forEach(key => { const el = document.getElementById(key); if (el) { if (el.type === 'checkbox') el.checked = project.feeder_data[key]; else el.value = project.feeder_data[key]; } });
        document.getElementById('feederFases')?.dispatchEvent(new Event('change'));
        document.getElementById('feederTipoIsolacao')?.dispatchEvent(new Event('change'));
    }

    const qdcContainerTarget = document.getElementById('qdc-container');
    if (project.qdcs_data && Array.isArray(project.qdcs_data) && qdcContainerTarget) {
        const fragment = document.createDocumentFragment();
        const qdcMap = new Map();
        project.qdcs_data.forEach(qdc => qdcMap.set(String(qdc.id), qdc));

        // Ordena QDCs para renderização hierárquica
        const sortedQdcs = []; const visited = new Set();
        function visit(qdcId) { if (!qdcId || visited.has(qdcId)) return; const qdc = qdcMap.get(qdcId); if (!qdc) return; visited.add(qdcId); const parentValue = qdc.parentId; if (parentValue && parentValue !== 'feeder') { const parentId = parentValue.replace('qdc-', ''); visit(parentId); } if(!sortedQdcs.some(sq => sq.id == qdc.id)) { sortedQdcs.push(qdc); } }
        project.qdcs_data.forEach(qdc => visit(String(qdc.id)));

        // Renderiza APENAS os blocos de QDC no fragmento (sem circuitos)
        sortedQdcs.forEach(qdc => {
            const renderedQdcId = ui.addQdcBlock(String(qdc.id), qdc.name, qdc.parentId, fragment);
            const qdcElementInFragment = fragment.querySelector(`#qdc-${renderedQdcId}`);
            if (!qdcElementInFragment) { console.error(`Elemento QDC ${renderedQdcId} não encontrado no fragmento.`); return; }
            if (qdc.config) { Object.keys(qdc.config).forEach(key => { const el = qdcElementInFragment.querySelector(`#${key}`); if (el) { if (el.type === 'checkbox') (el).checked = qdc.config[key]; else (el).value = qdc.config[key]; } }); }
        });

        // Adiciona todos os QDCs (vazios e colapsados) ao DOM
        qdcContainerTarget.appendChild(fragment);

        // Inicializa listeners e dropdowns APÓS adicionar ao DOM
        sortedQdcs.forEach(qdc => {
            const renderedQdcId = String(qdc.id);
            if (typeof ui.initializeQdcListeners === 'function') {
                ui.initializeQdcListeners(renderedQdcId); // Garante listeners
            }
            document.getElementById(`qdcFases-${renderedQdcId}`)?.dispatchEvent(new Event('change'));
            document.getElementById(`qdcTipoIsolacao-${renderedQdcId}`)?.dispatchEvent(new Event('change'));
        });

        // Atualiza os dropdowns de parentesco
        ui.updateQdcParentDropdowns();
        // Restaura a seleção de parentesco salva (com delay)
        setTimeout(() => {
             sortedQdcs.forEach(qdc => {
                const parentSelect = document.getElementById(`qdcParent-${qdc.id}`);
                if (parentSelect && qdc.parentId) {
                    if (Array.from(parentSelect.options).some(opt => opt.value === qdc.parentId)) {
                        (parentSelect).value = qdc.parentId;
                        parentSelect.dataset.initialParent = qdc.parentId;
                    } else {
                        (parentSelect).value = 'feeder';
                        parentSelect.dataset.initialParent = 'feeder';
                    }
                }
             });
             ui.updateFeederPowerDisplay();
        }, 100);

    } else {
        ui.updateFeederPowerDisplay();
    }
    console.timeEnd("populateForm");
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
                const updatedUsers = await api.fetchAllUsers(); // Refetch
                if (updatedUsers) ui.populateUsersPanel(updatedUsers); // Update UI
                else await showAdminPanel(); // Fallback
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

async function handleUpdateUser(event) { event.preventDefault(); const userId = document.getElementById('editUserId').value; const data = { nome: document.getElementById('editNome').value, cpf: document.getElementById('editCpf').value, telefone: document.getElementById('editTelefone').value, crea: document.getElementById('editCrea').value, }; const { error } = await api.updateUserProfile(userId, data); if (error) { alert("Erro ao atualizar usuário: " + error.message); } else { alert("Usuário atualizado com sucesso!"); ui.closeModal('editUserModalOverlay'); await showAdminPanel(); } }

// ========================================================================
// --- FUNÇÃO ATUALIZADA (v8.2 - Corrige travamento pós-download) ---
// ========================================================================
async function handleCalculateAndPdf() {
    if (!uiData) { alert("Erro: Dados técnicos não carregados..."); return; }
    if (!currentUserProfile) { alert("Erro: Usuário não autenticado..."); await handleLogout(); return; }

    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = loadingOverlay.querySelector('p');
    // Limpa o link de download antigo (se existir)
    const oldLinkContainer = document.getElementById('pdfLinkContainer');
    if (oldLinkContainer) {
        // Revoga a URL do Blob anterior para liberar memória
        const oldLink = oldLinkContainer.querySelector('a');
        if (oldLink && oldLink.href.startsWith('blob:')) {
            URL.revokeObjectURL(oldLink.href);
        }
        oldLinkContainer.remove();
    }


    loadingText.textContent = 'Coletando dados do formulário...';
    loadingOverlay.classList.add('visible');
    
    try {
        // Coleta os dados de forma assíncrona para não travar a UI
        const formDataForFunction = await getFullFormData(false);

        loadingText.textContent = 'Calculando e gerando PDF no servidor...';
        console.log("Enviando para Edge Function 'gerar-relatorio' (esperando blob)...");

        // Pede a resposta como Blob
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
                 else errMsg = errorText;
             } catch(e) { /* falha ao ler erro */ }
            throw new Error(`Erro na Edge Function (${functionError.context?.status || 'N/A'}): ${errMsg}`);
        }
        if (!pdfBlob) {
            throw new Error("A função de cálculo não retornou um arquivo (blob).");
        }

        console.log(`Blob de PDF recebido: ${(pdfBlob.size / 1024 / 1024).toFixed(2)} MB`);
        loadingText.textContent = 'PDF recebido, criando link...';
        await new Promise(resolve => setTimeout(resolve, 50));

        // --- CORREÇÃO: Troca de FileReader (Base64) para URL.createObjectURL ---
        // Isso é muito mais rápido e não trava o navegador
        const pdfUrl = URL.createObjectURL(pdfBlob);
        
        const nomeObra = document.getElementById('obra')?.value || 'Projeto';
        const linkContainer = document.createElement('div');
        linkContainer.id = 'pdfLinkContainer';
        linkContainer.style.marginTop = '15px';
        linkContainer.style.textAlign = 'center';

        const a = document.createElement('a');
        a.href = pdfUrl; // Usa a URL do Blob
        a.textContent = "Clique aqui para ver/baixar o PDF";
        a.target = "_blank"; // Abre em nova aba
        a.download = `Relatorio_${nomeObra.replace(/[^a-z0-9]/gi, '_')}.pdf`; // Nome do arquivo
        
        // Estilos para o link parecer um botão
        a.style.display = 'inline-block';
        a.style.padding = '10px 15px';
        a.style.backgroundColor = 'var(--btn-green)';
        a.style.color = 'white';
        a.style.textDecoration = 'none';
        a.style.borderRadius = '5px';
        a.style.fontWeight = 'bold';

        // O navegador gerencia a limpeza do ObjectURL, mas podemos limpar
        // o *link* da UI após o clique.
        a.addEventListener('click', () => {
             console.log("Link (ObjectURL) clicado.");
             // Esconde o link após o clique para evitar confusão
             setTimeout(() => {
                if(linkContainer) linkContainer.style.display = 'none';
                // A URL do blob será revogada quando o link antigo for limpo na próxima geração
             }, 500);
        });

        linkContainer.appendChild(a);

        // Adiciona o link abaixo do botão "Gerar PDF"
        const buttonContainer = document.querySelector('.button-container');
        if (buttonContainer) {
            buttonContainer.parentNode.insertBefore(linkContainer, buttonContainer.nextSibling);
        } else {
            document.getElementById('appContainer').appendChild(linkContainer);
        }

        console.log("Link (ObjectURL) para PDF criado. Aguardando clique do usuário.");
        loadingOverlay.classList.remove('visible');
        
        // --- FIM DA CORREÇÃO ---

    } catch (error) {
        console.error("Erro durante coleta de dados, cálculo ou PDF:", error);
        alert("Ocorreu um erro: " + error.message + "\nVerifique o console.");
         loadingOverlay.classList.remove('visible');
    } finally {
        // Garante que o texto de loading seja resetado caso a função falhe antes de mudar
        loadingText.textContent = 'Calculando, por favor aguarde...';
    }
}


// --- setupEventListeners ---
function setupEventListeners() {
    // Adiciona listeners para todos os elementos interativos
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
    const debouncedUpdateQdcDropdowns = utils.debounce(ui.updateQdcParentDropdowns, 400);
    document.getElementById('addQdcBtn').addEventListener('click', () => ui.addQdcBlock());
    document.getElementById('manageQdcsBtn').addEventListener('click', () => ui.openModal('qdcManagerModalOverlay'));
    const appContainer = document.getElementById('appContainer');
    if(appContainer) {
        // Usa delegação de evento para interações dentro do container principal
        appContainer.addEventListener('change', ui.handleMainContainerInteraction);
        appContainer.addEventListener('click', ui.handleMainContainerInteraction);
        // Listener 'input' separado para atualizações em tempo real (potência, nomes)
        appContainer.addEventListener('input', (event) => { const target = event.target; if (target.id.startsWith('potenciaW-') || target.id.startsWith('fatorDemanda-') || target.id.startsWith('qdcFatorDemanda-') || target.id === 'feederFatorDemanda') { ui.updateFeederPowerDisplay(); } if (target.classList.contains('qdc-name-input')) { debouncedUpdateQdcDropdowns(); } if (target.id.startsWith('nomeCircuito-')) { const circuitId = target.closest('.circuit-block')?.dataset.id; if (circuitId) { const labelElement = document.getElementById(`nomeCircuitoLabel-${circuitId}`); if(labelElement) labelElement.textContent = target.value || `Circuito ${circuitId}`; } } });
    }
    document.getElementById('calculateAndPdfBtn').addEventListener('click', handleCalculateAndPdf);
    document.getElementById('manageProjectsBtn').addEventListener('click', showManageProjectsPanel);
    const projectsTableBody = document.getElementById('adminProjectsTableBody'); if(projectsTableBody) projectsTableBody.addEventListener('click', handleProjectPanelClick);
    document.getElementById('adminPanelBtn').addEventListener('click', showAdminPanel);
    const adminUserList = document.getElementById('adminUserList'); if(adminUserList) { adminUserList.addEventListener('click', handleAdminUserActions); } else { console.error("Elemento adminUserList não encontrado!"); }
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
    document.getElementById('regCpf')?.addEventListener('input', utils.mascaraCPF); document.getElementById('regTelefone')?.addEventListener('input', utils.mascaraCelular); document.getElementById('editCpf')?.addEventListener('input', utils.mascaraCPF); document.getElementById('editTelefone')?.addEventListener('input', utils.mascaraCelular); document.getElementById('clientCelular')?.addEventListener('input', utils.mascaraCelular); document.getElementById('clientTelefone')?.addEventListener('input', utils.mascaraTelefone); const clientDocInput = document.getElementById('clientDocumentoValor'); if(clientDocInput) { clientDocInput.addEventListener('input', (event) => { const tipo = document.getElementById('clientDocumentoTipo')?.value; if(tipo) utils.aplicarMascara(event, tipo); }); } const clientDocTypeSelect = document.getElementById('clientDocumentoTipo'); if(clientDocTypeSelect) { clientDocTypeSelect.addEventListener('change', () => { const docValueInput = document.getElementById('documentoValor'); if(docValueInput) docValueInput.value = ''; }); }
}


// --- onAuthStateChange ---
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
                        console.log("Carregando dados técnicos...");
                        uiData = await api.fetchUiData();
                        if (uiData) {
                            ui.setupDynamicData(uiData);
                            console.log("Dados técnicos carregados.");
                        } else {
                            console.error("Falha CRÍTICA ao carregar dados técnicos!"); alert("Erro CRÍTICO ao carregar dados técnicos."); ui.showLoginView(); currentUserProfile = null; await auth.signOutUser(); return;
                        }
                    }
                    ui.showAppView(currentUserProfile);
                    try { allClients = await api.fetchClients(); } catch (e) { console.error("Erro ao carregar clientes:", e); }

                    if (hash.includes('type=recovery') && event === 'SIGNED_IN') {
                         ui.showResetPasswordView();
                    } else if (!hash.includes('type=recovery')) {
                        ui.resetForm();
                        await handleSearch();
                    }

                } else if (userProfile && !userProfile.is_approved) {
                    alert("Seu cadastro ainda não foi aprovado."); await auth.signOutUser(); ui.showLoginView();
                } else if (userProfile && userProfile.is_blocked) {
                    alert("Seu usuário está bloqueado."); await auth.signOutUser(); ui.showLoginView();
                } else {
                    console.warn("Sessão encontrada, mas perfil inválido/não encontrado ou não aprovado/bloqueado."); await auth.signOutUser(); ui.showLoginView();
                }
            } else {
                 if (!hash.includes('type=recovery')) { ui.showLoginView(); }
                 else { /* Sem sessão */ }
            }
        } else if (event === 'SIGNED_OUT') {
            console.log("Usuário deslogado.");
            currentUserProfile = null; allClients = []; uiData = null;
            ui.showLoginView(); window.location.hash = '';
        } else if (event === 'PASSWORD_RECOVERY') {
              ui.showResetPasswordView();
        }
    });
}

// --- Ponto de Entrada ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("--- main.js: DOM Content Loaded ---");
    main(); // Inicia a aplicação
});