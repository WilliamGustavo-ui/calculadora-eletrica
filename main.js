// Arquivo: main.js (Completo - Download Data URL + Clique Simulado + Correção Admin UI)

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
        // UI já deve mostrar alerta dentro de signInUser
    }
    // Se o login for bem-sucedido, onAuthStateChange cuidará de mostrar a view do app
}

// --- Funções de Autenticação e Gerenciamento ---
async function handleLogout() {
    await auth.signOutUser();
    // onAuthStateChange cuidará de mostrar a view de login
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
        email: email // Adiciona email aos detalhes para RLS se necessário
    };
    const { error } = await auth.signUpUser(email, password, details);
    if (!error) {
        alert('Cadastro realizado com sucesso! Aguarde a aprovação de um administrador.');
        ui.closeModal('registerModalOverlay');
        event.target.reset(); // Limpa o formulário
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
        event.target.reset(); // Limpa o formulário
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
        window.location.hash = ''; // Limpa o hash da URL
        window.location.reload(); // Recarrega a página
    }
}

async function handleOpenClientManagement() {
    try {
        allClients = await api.fetchClients(); // Atualiza a lista de clientes
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
        owner_id: currentUserProfile.id // Garante que o dono seja o usuário logado
    };
    try {
        let result;
        if (clientId) { // Editando cliente existente
            result = await api.updateClient(clientId, clientData);
        } else { // Adicionando novo cliente
            result = await api.addClient(clientData);
        }
        if (result.error) { throw result.error; } // Lança erro se houver
        alert(clientId ? 'Cliente atualizado com sucesso!' : 'Cliente cadastrado com sucesso!');
        ui.resetClientForm(); // Limpa o formulário
        await handleOpenClientManagement(); // Recarrega a lista no modal
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
                await handleOpenClientManagement(); // Recarrega a lista após exclusão
            }
        }
    }
}

async function handleNewProject(showModal = true) {
    try {
        if (showModal) {
            allClients = await api.fetchClients(); // Garante lista atualizada
            ui.populateSelectClientModal(allClients);
            ui.openModal('selectClientModalOverlay');
        } else {
            // Apenas reseta o formulário principal
            ui.resetForm(); // Já adiciona um QDC default
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
        // É uma nova obra, reseta o formulário VINCULANDO o cliente selecionado
        ui.resetForm(true, client); // Passa o cliente para o resetForm
    } else {
        // É apenas uma mudança de cliente em um projeto existente
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
    handleNewProject(false); // Chama a lógica de nova obra sem mostrar o modal (apenas reseta)
    ui.closeModal('selectClientModalOverlay');
}

// --- Funções de Projeto (Salvar, Carregar, Excluir) ---

function getFullFormData(forSave = false) {
    // --- Dados Principais, Cliente, Técnico ---
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
    // Cria clientProfile apenas se um cliente estiver vinculado
    const clientProfile = client ? {
        cliente: client.nome,
        tipoDocumento: client.documento_tipo,
        documento: client.documento_valor,
        celular: client.celular,
        telefone: client.telefone,
        email: client.email,
        enderecoCliente: client.endereco
    } : {}; // Objeto vazio se não houver cliente
    const techData = {
        respTecnico: document.getElementById('respTecnico').value,
        titulo: document.getElementById('titulo').value,
        crea: document.getElementById('crea').value
    };

    // --- Dados Alimentador Geral ---
    const feederData = {}; // Para salvar no BD
    const feederDataForCalc = { id: 'feeder', nomeCircuito: "Alimentador Geral" }; // Para Edge Function
    document.querySelectorAll('#feeder-form input, #feeder-form select').forEach(element => {
        const value = element.type === 'checkbox' ? element.checked : element.value;
        feederData[element.id] = value; // Para salvar
        // Mapeia para cálculo
        const key = element.id.replace('feeder', '').charAt(0).toLowerCase() + element.id.replace('feeder', '').slice(1);
        let calcValue = value;
        // Converte tipos para cálculo
        if (element.type === 'number' || ['fatorDemanda', 'fatorPotencia', 'comprimentoM', 'limiteQuedaTensao'].includes(key)) {
            calcValue = parseFloat(value) || 0;
        } else if (['tensaoV', 'temperaturaAmbienteC'].includes(key)) {
            calcValue = parseInt(value, 10) || 0;
        } else if (key === 'resistividadeSolo') {
            calcValue = parseFloat(value) || 0; // 0 é valor válido (Não aplicável)
        } else if (element.type === 'checkbox') {
            calcValue = element.checked;
        }
        feederDataForCalc[key] = calcValue;
    });

    // --- Dados QDCs e Circuitos ---
    const qdcsDataForSave = []; // Array completo para salvar no BD
    const qdcsDataForCalc = []; // Array simplificado para Edge Function (config do alimentador)
    const allCircuitsForCalc = []; // Array plano de circuitos para Edge Function

    document.querySelectorAll('#qdc-container .qdc-block').forEach(qdcBlock => {
        const qdcId = qdcBlock.dataset.id;
        const qdcConfigDataForSave = {}; // Config para salvar
        const qdcConfigDataForCalc = {}; // Config para cálculo

        // Coleta config do alimentador do QDC
        qdcBlock.querySelectorAll('.qdc-config-grid input, .qdc-config-grid select').forEach(element => {
            const value = element.type === 'checkbox' ? element.checked : element.value;
            qdcConfigDataForSave[element.id] = value; // Salva com ID original (ex: qdcFases-1)

            // Mapeia para cálculo (ex: qdcFases-1 -> fases)
            const key = element.id.replace(`qdc`, '').replace(`-${qdcId}`, '').replace(/^[A-Z]/, l => l.toLowerCase());
            let calcValue = value;
            // Converte tipos para cálculo
             if (element.type === 'number' || ['fatorDemanda', 'fatorPotencia', 'comprimentoM', 'limiteQuedaTensao'].includes(key)) {
                 calcValue = parseFloat(value) || 0;
             } else if (['tensaoV', 'temperaturaAmbienteC', 'numCircuitosAgrupados'].includes(key)) {
                 calcValue = parseInt(value, 10) || 0; // Assume 0 se vazio/inválido
                 if (key === 'numCircuitosAgrupados' && calcValue === 0) calcValue = 1; // Mínimo 1 circuito agrupado
             } else if (key === 'resistividadeSolo') {
                 calcValue = parseFloat(value) || 0;
             } else if (element.type === 'checkbox') {
                 calcValue = element.checked;
             }
             qdcConfigDataForCalc[key] = calcValue;
        });

        const qdcInfo = {
             id: qdcId,
             name: document.getElementById(`qdcName-${qdcId}`)?.value || `QDC ${qdcId}`,
             parentId: document.getElementById(`qdcParent-${qdcId}`)?.value || 'feeder'
        };

        // Adiciona ao array para cálculo
        qdcsDataForCalc.push({ ...qdcInfo, config: qdcConfigDataForCalc });

        // Coleta circuitos para salvar e para cálculo
        const circuitsForSave = [];
        qdcBlock.querySelectorAll('.circuit-block').forEach(circuitBlock => {
            const circuitId = circuitBlock.dataset.id;
            const circuitDataForSave = { id: circuitId }; // Para salvar
            const circuitDataForCalc = { qdcId: qdcId, id: circuitId }; // Para cálculo

            circuitBlock.querySelectorAll('input, select').forEach(element => {
                 const value = element.type === 'checkbox' ? element.checked : element.value;
                 circuitDataForSave[element.id] = value; // Salva com ID original (ex: nomeCircuito-1)

                 // Mapeia para cálculo (ex: nomeCircuito-1 -> nomeCircuito)
                 const key = element.id.replace(`-${circuitId}`, '');
                 let calcValue = value;
                 // Converte tipos para cálculo
                 if (element.type === 'number' || ['potenciaW', 'fatorDemanda', 'fatorPotencia', 'comprimentoM', 'limiteQuedaTensao'].includes(key)) {
                     calcValue = parseFloat(value) || 0;
                 } else if (['tensaoV', 'temperaturaAmbienteC', 'numCircuitosAgrupados'].includes(key)) {
                     calcValue = parseInt(value, 10) || 0;
                     if (key === 'numCircuitosAgrupados' && calcValue === 0) calcValue = 1; // Mínimo 1
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

        // Adiciona ao array para salvar
        qdcsDataForSave.push({ ...qdcInfo, config: qdcConfigDataForSave, circuits: circuitsForSave });
    });

    // --- Retorno ---
    if (forSave) {
        // Retorna estrutura completa para salvar no banco de dados
        return {
            project_name: mainData.obra,
            project_code: mainData.projectCode || null, // Garante null se vazio
            client_id: currentClientId || null, // Garante null se vazio
            main_data: mainData,
            tech_data: techData,
            feeder_data: feederData,
            qdcs_data: qdcsDataForSave,
            owner_id: currentUserProfile?.id // ID do usuário logado
        };
    } else {
        // Retorna estrutura simplificada para a Edge Function
        return {
            mainData,
            feederData: feederDataForCalc,
            qdcsData: qdcsDataForCalc,
            circuitsData: allCircuitsForCalc,
            clientProfile, // Pode ser objeto vazio
            techData
        };
    }
}

async function handleSaveProject() {
    if (!currentUserProfile) { alert("Você precisa estar logado."); return; }
    const nomeObra = document.getElementById('obra').value.trim();
    if (!nomeObra) { alert("Insira um 'Nome da Obra'."); return; }
    const loadingOverlay = document.getElementById('loadingOverlay'); const loadingText = loadingOverlay.querySelector('p');
    loadingText.textContent = 'Salvando dados da obra...'; loadingOverlay.classList.add('visible');
    try {
        await new Promise(resolve => setTimeout(resolve, 50)); // Pequeno delay para UI
        const projectDataToSave = getFullFormData(true);
        const currentProjectId = document.getElementById('currentProjectId').value;
        const { data, error } = await api.saveProject(projectDataToSave, currentProjectId);
        if (error) throw error;
        alert(`Obra "${data.project_name}" salva com sucesso!`);
        // Atualiza UI com ID e código do projeto (se for novo)
        document.getElementById('currentProjectId').value = data.id;
        document.getElementById('project_code').value = data.project_code;
        await handleSearch(); // Atualiza a lista de projetos
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
        await new Promise(resolve => setTimeout(resolve, 50)); // Pequeno delay para UI
        const project = await api.fetchProjectById(projectId);
        if (project) {
            ui.populateFormWithProjectData(project); // Chama a função que preenche o form
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
        ui.resetForm(); // Limpa o formulário
        await handleSearch(); // Atualiza a lista de projetos
    }
}

async function handleSearch(term = '') {
    if (!currentUserProfile) return; // Só busca se estiver logado
    try {
        const projects = await api.fetchProjects(term);
        // console.log("Projetos buscados:", projects); // Log Reduzido
        ui.populateProjectList(projects);
    } catch(error){
        console.error("Erro ao buscar projetos:", error);
    }
}

async function showManageProjectsPanel() {
     try {
         const projects = await api.fetchProjects(''); // Busca todos os projetos
         allClients = await api.fetchClients(); // Atualiza lista de clientes
         const allUsers = await api.fetchAllUsers(); // Busca todos os usuários
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
        const newClientId = select.value || null; // Permite desvincular
        const { error } = await api.transferProjectClient(projectId, newClientId);
        if (error) { alert('Erro ao transferir cliente: ' + error.message); }
        else { alert('Cliente da obra atualizado!'); await showManageProjectsPanel(); } // Recarrega
    }

    if (target.classList.contains('transfer-owner-btn')) {
        const select = target.closest('.action-group')?.querySelector('.transfer-owner-select');
        if(!select) return;
        const newOwnerId = select.value;
        if (newOwnerId && confirm('Tem certeza que deseja transferir a propriedade desta obra para outro usuário?')) {
            const { error } = await api.transferProjectOwner(projectId, newOwnerId);
            if (error) { alert('Erro ao transferir propriedade: ' + error.message); }
            else { alert('Propriedade da obra transferida com sucesso!'); await showManageProjectsPanel(); } // Recarrega
        }
    }
}

async function showAdminPanel() {
    try {
        const users = await api.fetchAllUsers(); // Busca usuários
        ui.populateUsersPanel(users); // Popula o modal
        ui.openModal('adminPanelModalOverlay'); // Abre o modal
    } catch(error){
        console.error("Erro ao buscar usuários:", error);
        alert("Não foi possível carregar a lista de usuários.");
    }
}

async function handleAdminUserActions(event) {
    const target = event.target; // O elemento clicado (o botão)
    const userId = target.dataset.userId;

    if (!userId) return; // Se o clique não foi em um botão com data-user-id, ignora

    console.log(`[Admin Action] Ação detectada no painel admin. Botão:`, target);
    console.log(`[Admin Action] User ID extraído: ${userId}`);

    try {
        if (target.classList.contains('approve-user-btn')) {
            console.log(`[Admin Action] Tentando aprovar usuário ${userId}...`);
            await api.approveUser(userId);
            console.log(`[Admin Action] Ação 'approveUser' chamada.`);
            await showAdminPanel(); // Recarrega o painel completo
        }
        else if (target.classList.contains('edit-user-btn')) {
            console.log(`[Admin Action] Tentando buscar usuário ${userId} para editar...`);
            const user = await api.fetchUserById(userId);
            if (user) {
                 console.log(`[Admin Action] Usuário ${userId} encontrado, populando modal.`);
                 ui.populateEditUserModal(user); // Abre modal de edição
            } else {
                 console.warn(`[Admin Action] Usuário ${userId} não encontrado para edição.`);
                 alert(`Usuário com ID ${userId} não encontrado.`);
            }
        }
        else if (target.classList.contains('block-user-btn')) {
            const isCurrentlyBlocked = target.dataset.isBlocked === 'true';
            const shouldBlock = !isCurrentlyBlocked; // A ação é o INVERSO do estado atual

            console.log(`[Admin Action] Botão Bloquear/Desbloquear clicado para User ID: ${userId}`);
            console.log(`   - Estado Atual (data-is-blocked): ${target.dataset.isBlocked} (Interpretado como: ${isCurrentlyBlocked})`);
            console.log(`   - Ação a ser tomada (shouldBlock): ${shouldBlock}`);

            if (confirm(`Tem certeza que deseja ${shouldBlock ? 'BLOQUEAR' : 'DESBLOQUEAR'} este usuário?`)) {
                console.log(`[Admin Action] Confirmado. Chamando api.toggleUserBlock(${userId}, ${shouldBlock})...`);
                const { error: updateError } = await api.toggleUserBlock(userId, shouldBlock); // Chama a API
                console.log(`[Admin Action] Resultado da chamada api.toggleUserBlock:`, updateError ? updateError : 'Sucesso');

                if (updateError) { throw updateError; } // Lança erro se falhar

                // >>>>> CORREÇÃO: Busca dados atualizados e repopula a UI manualmente <<<<<
                console.log(`[Admin Action] Atualização bem-sucedida. Buscando lista atualizada de usuários...`);
                const updatedUsers = await api.fetchAllUsers(); // Busca novamente
                if (updatedUsers) {
                    console.log(`[Admin Action] Lista atualizada recebida. Repopulando painel...`);
                    ui.populateUsersPanel(updatedUsers); // Repopula a UI com dados frescos
                } else {
                     console.warn("[Admin Action] Falha ao buscar usuários atualizados após bloqueio/desbloqueio. A UI pode não refletir a mudança.");
                     await showAdminPanel(); // Fallback para recarregar tudo
                }

            } else {
                 console.log(`[Admin Action] Ação cancelada pelo usuário.`);
            }
        }
        else if (target.classList.contains('remove-user-btn')) {
            console.log(`[Admin Action] Tentando remover usuário ${userId}...`);
            if (confirm('ATENÇÃO: Ação irreversível! Excluir este usuário permanentemente?')) {
                console.log(`[Admin Action] Confirmado. Chamando api.deleteUserFromAdmin(${userId})...`);
                const { data, error: deleteError } = await api.deleteUserFromAdmin(userId); // Chama a Edge Function
                 console.log(`[Admin Action] Resultado da chamada api.deleteUserFromAdmin:`, deleteError ? deleteError : data);

                if (deleteError) { throw deleteError; } // Lança erro se falhar
                alert(data?.message || 'Usuário excluído com sucesso.');
                console.log(`[Admin Action] Usuário excluído. Recarregando painel...`);
                await showAdminPanel(); // Recarrega o painel completo
            } else {
                 console.log(`[Admin Action] Remoção cancelada pelo usuário.`);
            }
        } else {
             console.log("[Admin Action] Clique detectado, mas não em um botão de ação conhecido.");
        }
    } catch (error) {
        console.error("[Admin Action] Erro durante a execução da ação:", error);
        alert("Ocorreu um erro ao processar a ação: " + error.message + "\nVerifique o console para mais detalhes.");
        try { await showAdminPanel(); } catch (refreshError) { console.error("[Admin Action] Erro adicional ao tentar recarregar o painel após um erro:", refreshError); }
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
        // Não atualiza email ou senha aqui
    };
    const { error } = await api.updateUserProfile(userId, data);
    if (error) {
        alert("Erro ao atualizar usuário: " + error.message);
    } else {
        alert("Usuário atualizado com sucesso!");
        ui.closeModal('editUserModalOverlay');
        await showAdminPanel(); // Recarrega o painel de admin
    }
}

// ========================================================================
// >>>>> FUNÇÃO REVERTIDA (Download via Data URL + Clique Simulado) <<<<<
// ========================================================================
async function handleCalculateAndPdf() {
    if (!uiData) { alert("Erro: Dados técnicos não carregados..."); return; }
    if (!currentUserProfile) { alert("Erro: Usuário não autenticado..."); await handleLogout(); return; }

    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = loadingOverlay.querySelector('p');
    document.getElementById('pdfLinkContainer')?.remove(); // Limpa link antigo

    loadingText.textContent = 'Calculando e gerando PDF no servidor...';
    loadingOverlay.classList.add('visible');

    const formDataForFunction = getFullFormData(false);

    try {
        console.log("Enviando para Edge Function 'gerar-relatorio' (esperando blob):", formDataForFunction);

        // Pede a resposta como Blob
        const { data: pdfBlob, error: functionError } = await supabase.functions.invoke('gerar-relatorio', {
            body: { formData: formDataForFunction },
            responseType: 'blob'
        });

        if (functionError) {
             let errMsg = functionError.message;
             try {
                 // Tenta ler o erro como texto (se o servidor não enviou um PDF)
                 const errorText = await functionError.context.blob.text();
                 const errorJson = JSON.parse(errorText);
                 if (errorJson.error) errMsg = errorJson.error;
                 else errMsg = errorText;
             } catch(e) { /* falha ao ler erro, usa o padrão */ }
            throw new Error(`Erro na Edge Function (${functionError.context?.status || 'N/A'}): ${errMsg}`);
        }
        if (!pdfBlob) {
            throw new Error("A função de cálculo não retornou um arquivo (blob).");
        }

        console.log("Blob de PDF recebido:", pdfBlob);
        console.log(`>>> TAMANHO DO BLOB: ${(pdfBlob.size / 1024 / 1024).toFixed(2)} MB`);
        loadingText.textContent = 'PDF recebido, convertendo para Data URL...';
        await new Promise(resolve => setTimeout(resolve, 50));

        // Converte Blob para Data URL (Base64)
        console.log("Convertendo Blob para Base64...");
        const reader = new FileReader();
        reader.readAsDataURL(pdfBlob);
        reader.onloadend = () => { // Função callback quando a conversão terminar
            const base64data = reader.result;
            if (!base64data) {
                console.error("Falha ao converter Blob para Data URL (resultado vazio).");
                alert("Erro ao processar o PDF recebido.");
                loadingOverlay.classList.remove('visible');
                return;
            }
            console.log("Data URL criada (primeiros 100 chars):", base64data.substring(0, 100) + "...");

            const nomeObra = document.getElementById('obra')?.value || 'Projeto';
            const a = document.createElement('a');
            a.style.display = 'none'; // Link invisível
            a.href = base64data; // Usa a Data URL
            a.download = `Relatorio_${nomeObra.replace(/[^a-z0-9]/gi, '_')}.pdf`; // Nome do arquivo

            console.log("Adicionando link (Data URL) ao body...");
            document.body.appendChild(a);

            console.log("Simulando clique no link (Data URL)...");
            a.click(); // Simula o clique para iniciar o download/abertura
            console.log("Clique simulado.");

            // Limpeza: remove o link do DOM
            console.log("Removendo link...");
            a.remove();
            console.log("Link removido.");

            // alert("PDF gerado! Verifique seus downloads ou a nova aba."); // Removido alerta
            // Esconde loading APÓS a tentativa de download ter sido iniciada
            loadingOverlay.classList.remove('visible');
            console.log("Overlay de loading removido após tentativa de download.");
        };
        reader.onerror = (error) => {
             console.error("Erro ao ler Blob como Data URL:", error);
             alert("Erro ao converter o PDF recebido. Verifique o console.");
             loadingOverlay.classList.remove('visible');
        };

    } catch (error) {
        console.error("Erro durante cálculo ou PDF:", error);
        alert("Ocorreu um erro: " + error.message + "\nVerifique o console.");
         loadingOverlay.classList.remove('visible'); // Garante que loading some em caso de erro
    }
    // O finally foi removido daqui porque a lógica principal agora está dentro do reader.onloadend
}


// ========================================================================
// >>>>> FUNÇÃO ATUALIZADA (setupEventListeners com Correção para Admin Panel) <<<<<
// ========================================================================
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

    const debouncedUpdateQdcDropdowns = utils.debounce(ui.updateQdcParentDropdowns, 400);

    document.getElementById('addQdcBtn').addEventListener('click', () => ui.addQdcBlock());
    document.getElementById('manageQdcsBtn').addEventListener('click', () => ui.openModal('qdcManagerModalOverlay'));

    const appContainer = document.getElementById('appContainer');
    if(appContainer) {
        // Usa delegação de evento para interações dentro do container principal
        appContainer.addEventListener('change', ui.handleMainContainerInteraction);
        appContainer.addEventListener('click', ui.handleMainContainerInteraction);

        // Listener 'input' separado para atualizações em tempo real (potência, nomes)
        appContainer.addEventListener('input', (event) => {
            const target = event.target;

            // Atualiza display de potência
            if (target.id.startsWith('potenciaW-') ||
                target.id.startsWith('fatorDemanda-') ||
                target.id.startsWith('qdcFatorDemanda-') ||
                target.id === 'feederFatorDemanda')
            {
                ui.updateFeederPowerDisplay(); // Função debounced do ui.js
            }

            // Atualiza dropdowns de parentesco se nome do QDC mudar
            if (target.classList.contains('qdc-name-input')) {
                debouncedUpdateQdcDropdowns(); // Função debounced do ui.js
            }

            // Atualiza label do circuito se nome mudar
            if (target.id.startsWith('nomeCircuito-')) {
                 const circuitId = target.closest('.circuit-block')?.dataset.id;
                 if (circuitId) {
                    const labelElement = document.getElementById(`nomeCircuitoLabel-${circuitId}`);
                    if(labelElement) labelElement.textContent = target.value || `Circuito ${circuitId}`;
                 }
            }
        });
    }

    document.getElementById('calculateAndPdfBtn').addEventListener('click', handleCalculateAndPdf);

    // Botões e Modais de Gerenciamento
    document.getElementById('manageProjectsBtn').addEventListener('click', showManageProjectsPanel);
    const projectsTableBody = document.getElementById('adminProjectsTableBody');
    if(projectsTableBody) {
        projectsTableBody.addEventListener('click', handleProjectPanelClick);
    }
    document.getElementById('adminPanelBtn').addEventListener('click', showAdminPanel);

    // Listener para o PAINEL DE ADMIN (UL) usando delegação
    const adminUserList = document.getElementById('adminUserList');
    if(adminUserList) {
        console.log("Adicionando listener de clique ao adminUserList.");
        adminUserList.addEventListener('click', handleAdminUserActions);
    } else {
        console.error("Elemento adminUserList não encontrado!");
    }

    const editUserForm = document.getElementById('editUserForm');
    if(editUserForm) {
        editUserForm.addEventListener('submit', handleUpdateUser);
    }
    document.getElementById('manageClientsBtn').addEventListener('click', handleOpenClientManagement);
    const clientForm = document.getElementById('clientForm');
    if(clientForm) {
        clientForm.addEventListener('submit', handleClientFormSubmit);
    }
    const clientList = document.getElementById('clientList');
    if(clientList) {
        clientList.addEventListener('click', handleClientListClick);
    }
    const clientFormCancelBtn = document.getElementById('clientFormCancelBtn');
    if(clientFormCancelBtn) {
        clientFormCancelBtn.addEventListener('click', ui.resetClientForm);
    }
    document.getElementById('confirmClientSelectionBtn').addEventListener('click', () => { const isChange = document.querySelector('#selectClientModalOverlay h3')?.textContent.includes('Alterar'); handleConfirmClientSelection(isChange); });
    document.getElementById('changeClientBtn').addEventListener('click', async () => { try { allClients = await api.fetchClients(); ui.populateSelectClientModal(allClients, true);} catch(e){ alert("Erro ao carregar clientes.")} });
    document.getElementById('continueWithoutClientBtn').addEventListener('click', handleContinueWithoutClient);
    document.getElementById('addNewClientFromSelectModalBtn').addEventListener('click', () => { ui.closeModal('selectClientModalOverlay'); handleOpenClientManagement(); });

    // --- Máscaras ---
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
    const clientDocTypeSelect = document.getElementById('clientDocumentoTipo');
    if(clientDocTypeSelect) {
        clientDocTypeSelect.addEventListener('change', () => {
            const docValueInput = document.getElementById('clientDocumentoValor');
            if(docValueInput) docValueInput.value = ''; // Limpa valor ao mudar tipo
        });
    }
}


// --- onAuthStateChange (Sem alterações) ---
function main() {
    setupEventListeners();

    supabase.auth.onAuthStateChange(async (event, session) => {
        const hash = window.location.hash;

        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
            if (session) {
                const userProfile = await auth.getSession(); // Busca perfil do usuário logado
                // Verifica se usuário existe, está aprovado e não está bloqueado
                if (userProfile && userProfile.is_approved && !userProfile.is_blocked) {
                    currentUserProfile = userProfile; // Armazena perfil globalmente
                    // Carrega dados técnicos UMA VEZ após login bem-sucedido
                    if (!uiData) {
                        console.log("Carregando dados técnicos...");
                        uiData = await api.fetchUiData();
                        if (uiData) {
                            ui.setupDynamicData(uiData); // Configura dados no ui.js
                            console.log("Dados técnicos carregados.");
                        } else {
                            // Erro crítico se dados técnicos não carregarem
                            console.error("Falha CRÍTICA ao carregar dados técnicos!");
                            alert("Erro CRÍTICO ao carregar dados técnicos. A aplicação não pode continuar.");
                            ui.showLoginView(); currentUserProfile = null; await auth.signOutUser(); return;
                        }
                    }
                    ui.showAppView(currentUserProfile); // Mostra a interface principal
                    try { allClients = await api.fetchClients(); } catch (e) { console.error("Erro ao carregar clientes:", e); } // Carrega clientes

                    // Verifica se é um fluxo de recuperação de senha
                    if (hash.includes('type=recovery') && event === 'SIGNED_IN') {
                        console.log("Recuperação de senha detectada."); ui.showResetPasswordView();
                    } else if (!hash.includes('type=recovery')) {
                        // Se não for recuperação, reseta o formulário e busca projetos
                        ui.resetForm();
                        await handleSearch();
                    }

                } else if (userProfile && !userProfile.is_approved) {
                    alert("Seu cadastro ainda não foi aprovado."); await auth.signOutUser(); ui.showLoginView(); // Garante logout e volta pro login
                } else if (userProfile && userProfile.is_blocked) {
                    alert("Seu usuário está bloqueado."); await auth.signOutUser(); ui.showLoginView(); // Garante logout e volta pro login
                } else {
                    // Caso estranho: sessão existe mas perfil não encontrado ou inválido
                    console.warn("Sessão encontrada, mas perfil inválido/não encontrado ou não aprovado/bloqueado."); await auth.signOutUser(); ui.showLoginView();
                }
            } else {
                 // Sem sessão ativa
                 if (!hash.includes('type=recovery')) { ui.showLoginView(); } // Mostra login se não for recuperação
                 else { console.log("Hash de recuperação sem sessão ativa."); } // Permite ficar na tela de reset
            }
        } else if (event === 'SIGNED_OUT') {
            // Usuário deslogou
            console.log("Usuário deslogado."); currentUserProfile = null; allClients = []; ui.showLoginView(); window.location.hash = ''; // Limpa hash
        } else if (event === 'PASSWORD_RECOVERY') {
             // Evento disparado quando o usuário clica no link de recuperação
             console.log("Evento PASSWORD_RECOVERY recebido."); ui.showResetPasswordView();
        }
    });
}

// --- Ponto de Entrada ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("--- main.js: DOM Content Loaded ---");
    main(); // Inicia a aplicação
});