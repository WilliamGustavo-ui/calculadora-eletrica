// Arquivo: main.js (v8.4 - Otimizado: Gerenciamento de Memória e Correção de Travamento Pós-PDF)

import * as auth from './auth.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as utils from './utils.js';
import { supabase } from './supabaseClient.js';

let currentUserProfile = null;
let allClients = [];
let uiData = null;
let currentPdfUrl = null; // Variável global para controle de memória do PDF

// --- Funções de Autenticação ---
async function handleLogin() {
    const email = document.getElementById('emailLogin').value;
    const password = document.getElementById('password').value;
    const userProfile = await auth.signInUser(email, password);
    if (!userProfile) console.error("Falha no login.");
}

async function handleLogout() {
    await auth.signOutUser();
}

async function handleRegister(event) {
    event.preventDefault();
    const details = {
        nome: document.getElementById('regNome').value,
        cpf: document.getElementById('regCpf').value,
        telefone: document.getElementById('regTelefone').value,
        crea: document.getElementById('regCrea').value,
        email: document.getElementById('regEmail').value
    };
    const { error } = await auth.signUpUser(details.email, document.getElementById('regPassword').value, details);
    if (!error) {
        alert('Cadastro realizado! Aguarde aprovação.');
        ui.closeModal('registerModalOverlay');
        event.target.reset();
    } else {
        alert(`Erro: ${error.message}`);
    }
}

async function handleForgotPassword(event) {
    event.preventDefault();
    const email = document.getElementById('forgotEmail').value;
    const { error } = await auth.sendPasswordResetEmail(email);
    if (error) alert("Erro: " + error.message);
    else {
        alert("Link enviado!");
        ui.closeModal('forgotPasswordModalOverlay');
    }
}

async function handleResetPassword(event) {
    event.preventDefault();
    const newPassword = document.getElementById('newPassword').value;
    const { error } = await auth.updatePassword(newPassword);
    if (error) alert("Erro: " + error.message);
    else {
        alert("Senha atualizada!");
        window.location.hash = '';
        window.location.reload();
    }
}

// --- Gerenciamento de Clientes ---
async function handleOpenClientManagement() {
    try {
        allClients = await api.fetchClients();
        ui.populateClientManagementModal(allClients);
        ui.openModal('clientManagementModalOverlay');
    } catch(error) {
        console.error("Erro ao carregar clientes:", error);
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
        let result = clientId ? await api.updateClient(clientId, clientData) : await api.addClient(clientData);
        if (result.error) throw result.error;
        alert('Sucesso!');
        ui.resetClientForm();
        await handleOpenClientManagement();
    } catch (error) {
        alert('Erro: ' + error.message);
    }
}

async function handleClientListClick(event) {
    const target = event.target;
    const clientId = target.dataset.clientId;
    if (target.classList.contains('edit-client-btn')) {
        const client = allClients.find(c => c.id == clientId);
        if (client) ui.openEditClientForm(client);
    }
    if (target.classList.contains('delete-client-btn')) {
        if (confirm('Excluir cliente?')) {
            const { error } = await api.deleteClient(clientId);
            if (!error) await handleOpenClientManagement();
        }
    }
}

// --- Gerenciamento de Obras/Projetos ---
async function handleNewProject(showModal = true) {
    if (showModal) {
        allClients = await api.fetchClients();
        ui.populateSelectClientModal(allClients);
    } else {
        ui.resetForm();
    }
}

function handleConfirmClientSelection(isChange = false) {
    const selectedId = document.getElementById('clientSelectForNewProject').value;
    const client = allClients.find(c => c.id == selectedId);
    if (!isChange) ui.resetForm(true, client);
    else if (client) {
        document.getElementById('clientLinkDisplay').textContent = `Cliente: ${client.nome}`;
        document.getElementById('currentClientId').value = client.id;
    }
    ui.closeModal('selectClientModalOverlay');
}

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
    const clientProfile = client ? { cliente: client.nome, tipoDocumento: client.documento_tipo, documento: client.documento_valor, celular: client.celular, telefone: client.telefone, email: client.email, enderecoCliente: client.endereco } : {};
    const techData = { respTecnico: document.getElementById('respTecnico').value, titulo: document.getElementById('titulo').value, crea: document.getElementById('crea').value };
    
    const feederData = {};
    const feederDataForCalc = { id: 'feeder', nomeCircuito: "Alimentador Geral" };
    document.querySelectorAll('#feeder-form input, #feeder-form select').forEach(el => {
        const value = el.type === 'checkbox' ? el.checked : el.value;
        feederData[el.id] = value;
        const key = el.id.replace('feeder', '').charAt(0).toLowerCase() + el.id.replace('feeder', '').slice(1);
        feederDataForCalc[key] = (el.type === 'number' || ['fatorDemanda', 'fatorPotencia', 'comprimentoM', 'limiteQuedaTensao', 'tensaoV', 'temperaturaAmbienteC', 'resistividadeSolo'].includes(key)) ? parseFloat(value) : value;
    });

    const qdcsDataForSave = [];
    const qdcsDataForCalc = [];
    const allCircuitsForCalc = [];

    const allQdcBlocks = document.querySelectorAll('#qdc-container .qdc-block');
    for (const qdcBlock of allQdcBlocks) {
        const qdcId = qdcBlock.dataset.id;
        const qdcConfigSave = {};
        const qdcConfigCalc = {};
        
        qdcBlock.querySelectorAll('.qdc-config-grid input, .qdc-config-grid select').forEach(el => {
            const val = el.type === 'checkbox' ? el.checked : el.value;
            qdcConfigSave[el.id] = val;
            const key = el.id.replace(`qdc`, '').replace(`-${qdcId}`, '').replace(/^[A-Z]/, l => l.toLowerCase());
            qdcConfigCalc[key] = (el.type === 'number' || ['fatorDemanda', 'fatorPotencia', 'comprimentoM', 'limiteQuedaTensao', 'tensaoV', 'temperaturaAmbienteC', 'numCircuitosAgrupados', 'resistividadeSolo'].includes(key)) ? parseFloat(val) : val;
        });

        const qdcInfo = { id: qdcId, name: document.getElementById(`qdcName-${qdcId}`)?.value || `QDC ${qdcId}`, parentId: document.getElementById(`qdcParent-${qdcId}`)?.value || 'feeder' };
        qdcsDataForCalc.push({ ...qdcInfo, config: qdcConfigCalc });

        const circuitsSave = [];
        qdcBlock.querySelectorAll('.circuit-block').forEach(circuitBlock => {
            const cId = circuitBlock.dataset.id;
            const cSave = { id: cId };
            const cCalc = { qdcId: qdcId, id: cId };
            circuitBlock.querySelectorAll('input, select').forEach(el => {
                const val = el.type === 'checkbox' ? el.checked : el.value;
                cSave[el.id] = val;
                const key = el.id.replace(`-${cId}`, '');
                cCalc[key] = (el.type === 'number' || ['potenciaW', 'fatorDemanda', 'fatorPotencia', 'comprimentoM', 'limiteQuedaTensao', 'tensaoV', 'temperaturaAmbienteC', 'numCircuitosAgrupados', 'resistividadeSolo'].includes(key)) ? parseFloat(val) : val;
            });
            circuitsSave.push(cSave);
            allCircuitsForCalc.push(cCalc);
        });
        qdcsDataForSave.push({ ...qdcInfo, config: qdcConfigSave, circuits: circuitsSave });
        await new Promise(r => setTimeout(r, 0));
    }

    return forSave ? { project_name: mainData.obra, project_code: mainData.projectCode || null, client_id: currentClientId || null, main_data: mainData, tech_data: techData, feeder_data: feederData, qdcs_data: qdcsDataForSave, owner_id: currentUserProfile?.id }
                   : { mainData, feederData: feederDataForCalc, qdcsData: qdcsDataForCalc, circuitsData: allCircuitsForCalc, clientProfile, techData };
}

async function handleSaveProject() {
    if (!currentUserProfile) return;
    const loading = document.getElementById('loadingOverlay');
    loading.classList.add('visible');
    try {
        const projectData = await getFullFormData(true);
        const currentId = document.getElementById('currentProjectId').value;
        const { data, error } = await api.saveProject(projectData, currentId);
        if (error) throw error;
        document.getElementById('currentProjectId').value = data.id;
        document.getElementById('project_code').value = data.project_code;
        alert("Salvo!");
        await handleSearch();
    } catch (e) { alert(e.message); } finally { loading.classList.remove('visible'); }
}

async function handleLoadProject() {
    const projectId = document.getElementById('savedProjectsSelect').value;
    if (!projectId) return;
    const loading = document.getElementById('loadingOverlay');
    loading.classList.add('visible');
    try {
        const project = await api.fetchProjectById(projectId);
        if (project) {
            ui.resetForm(false, project.client);
            ui.setLoadedProjectData(project);
            document.getElementById('currentProjectId').value = project.id;
            if (project.main_data) Object.keys(project.main_data).forEach(k => { if(document.getElementById(k)) document.getElementById(k).value = project.main_data[k]; });
            document.getElementById('project_code').value = project.project_code || '';
            if (project.tech_data) Object.keys(project.tech_data).forEach(k => { if(document.getElementById(k)) document.getElementById(k).value = project.tech_data[k]; });
            if (project.feeder_data) {
                Object.keys(project.feeder_data).forEach(k => { const el = document.getElementById(k); if(el) el.type === 'checkbox' ? el.checked = project.feeder_data[k] : el.value = project.feeder_data[k]; });
                document.getElementById('feederFases').dispatchEvent(new Event('change'));
                document.getElementById('feederTipoIsolacao').dispatchEvent(new Event('change'));
            }
            if (project.qdcs_data) {
                const frag = document.createDocumentFragment();
                project.qdcs_data.forEach(q => {
                    const qId = ui.addQdcBlock(String(q.id), q.name, q.parentId, frag);
                    if (q.config) Object.keys(q.config).forEach(k => { const el = frag.querySelector(`#${k}`); if(el) el.type === 'checkbox' ? el.checked = q.config[k] : el.value = q.config[k]; });
                });
                document.getElementById('qdc-container').appendChild(frag);
                project.qdcs_data.forEach(q => {
                    ui.initializeQdcListeners(String(q.id));
                    document.getElementById(`qdcFases-${q.id}`).dispatchEvent(new Event('change'));
                    document.getElementById(`qdcTipoIsolacao-${q.id}`).dispatchEvent(new Event('change'));
                });
                ui.updateQdcParentDropdowns();
            }
            setTimeout(() => ui.updateFeederPowerDisplay(), 100);
        }
    } catch(e) { alert(e.message); } finally { loading.classList.remove('visible'); }
}

async function handleSearch(term = '') {
    const projects = await api.fetchProjects(term);
    ui.populateProjectList(projects);
}

// >>>>> CORREÇÃO DO TRAVAMENTO NO PDF (Gerenciamento de ObjectURL e Memória) <<<<<
async function handleCalculateAndPdf() {
    if (!uiData || !currentUserProfile) return;

    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = loadingOverlay.querySelector('p');
    
    // 1. Limpeza de memória: Revoga URL anterior para liberar RAM
    const oldLinkContainer = document.getElementById('pdfLinkContainer');
    if (oldLinkContainer) {
        const oldLink = oldLinkContainer.querySelector('a');
        if (oldLink && oldLink.href.startsWith('blob:')) {
            URL.revokeObjectURL(oldLink.href); // Libera o recurso do navegador
        }
        oldLinkContainer.remove();
    }

    loadingText.textContent = 'Coletando dados...';
    loadingOverlay.classList.add('visible');
    
    try {
        // Coleta dados de forma assíncrona
        const formDataForFunction = await getFullFormData(false);

        loadingText.textContent = 'Processando no servidor...';
        const { data: pdfBlob, error: functionError } = await supabase.functions.invoke('gerar-relatorio', {
            body: { formData: formDataForFunction },
            responseType: 'blob'
        });

        if (functionError || !pdfBlob) throw new Error("Falha na geração do PDF.");

        // 2. Criação eficiente do link (ObjectURL)
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const nomeObra = document.getElementById('obra')?.value || 'Projeto';
        
        const linkContainer = document.createElement('div');
        linkContainer.id = 'pdfLinkContainer';
        linkContainer.style.cssText = 'margin-top: 15px; text-align: center;';

        const a = document.createElement('a');
        a.href = pdfUrl;
        a.textContent = "Baixar PDF";
        a.download = `Relatorio_${nomeObra.replace(/[^a-z0-9]/gi, '_')}.pdf`;
        a.className = 'btn-green';
        a.style.display = 'inline-block';

        // Dispara download automático e oculta link após clique
        a.addEventListener('click', () => {
            setTimeout(() => { if(linkContainer) linkContainer.style.display = 'none'; }, 1000);
        });

        linkContainer.appendChild(a);
        const btnContainer = document.querySelector('.button-container');
        btnContainer ? btnContainer.parentNode.insertBefore(linkContainer, btnContainer.nextSibling) : document.getElementById('appContainer').appendChild(linkContainer);

    } catch (error) {
        alert("Erro: " + error.message);
    } finally {
        loadingOverlay.classList.remove('visible');
        loadingText.textContent = 'Calculando...';
    }
}

// --- Listeners e Inicialização ---
function setupEventListeners() {
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('registerBtn').addEventListener('click', () => ui.openModal('registerModalOverlay'));
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('forgotPasswordLink').addEventListener('click', (e) => { e.preventDefault(); ui.openModal('forgotPasswordModalOverlay'); });
    document.getElementById('forgotPasswordForm').addEventListener('submit', handleForgotPassword);
    document.getElementById('resetPasswordForm').addEventListener('submit', handleResetPassword);
    document.querySelectorAll('.close-modal-btn').forEach(btn => btn.addEventListener('click', (e) => ui.closeModal(e.target.closest('.modal-overlay').id)));
    document.getElementById('saveBtn').addEventListener('click', handleSaveProject);
    document.getElementById('loadBtn').addEventListener('click', handleLoadProject);
    document.getElementById('deleteBtn').addEventListener('click', async () => {
        const id = document.getElementById('savedProjectsSelect').value;
        if(id && confirm("Excluir obra?")) { await api.deleteProject(id); ui.resetForm(); await handleSearch(); }
    });
    document.getElementById('newBtn').addEventListener('click', () => handleNewProject(true));
    document.getElementById('searchInput').addEventListener('input', utils.debounce((e) => handleSearch(e.target.value), 300));
    document.getElementById('addQdcBtn').addEventListener('click', () => ui.addQdcBlock());
    document.getElementById('manageQdcsBtn').addEventListener('click', () => ui.openModal('qdcManagerModalOverlay'));
    
    const app = document.getElementById('appContainer');
    app.addEventListener('change', ui.handleMainContainerInteraction);
    app.addEventListener('click', ui.handleMainContainerInteraction);
    app.addEventListener('input', (e) => {
        const t = e.target;
        if (t.id.startsWith('potenciaW-') || t.id.startsWith('fatorDemanda-') || t.id.startsWith('qdcFatorDemanda-') || t.id === 'feederFatorDemanda') ui.updateFeederPowerDisplay();
        if (t.classList.contains('qdc-name-input')) utils.debounce(ui.updateQdcParentDropdowns, 400)();
    });

    document.getElementById('calculateAndPdfBtn').addEventListener('click', handleCalculateAndPdf);
    document.getElementById('manageProjectsBtn').addEventListener('click', async () => {
        const p = await api.fetchProjects('');
        allClients = await api.fetchClients();
        ui.populateProjectsPanel(p, allClients, await api.fetchAllUsers(), currentUserProfile);
        ui.openModal('manageProjectsModalOverlay');
    });
    document.getElementById('adminPanelBtn').addEventListener('click', async () => ui.populateUsersPanel(await api.fetchAllUsers()));
    document.getElementById('manageClientsBtn').addEventListener('click', handleOpenClientManagement);
    document.getElementById('clientForm').addEventListener('submit', handleClientFormSubmit);
    document.getElementById('clientList').addEventListener('click', handleClientListClick);
    document.getElementById('confirmClientSelectionBtn').addEventListener('click', () => handleConfirmClientSelection(false));
}

function main() {
    setupEventListeners();
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (session && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
            const profile = await auth.getSession();
            if (profile && profile.is_approved && !profile.is_blocked) {
                currentUserProfile = profile;
                if (!uiData) {
                    uiData = await api.fetchUiData();
                    ui.setupDynamicData(uiData);
                }
                ui.showAppView(currentUserProfile);
                await handleSearch();
            } else { await auth.signOutUser(); ui.showLoginView(); }
        } else if (event === 'SIGNED_OUT') {
            ui.showLoginView();
        }
    });
}

document.addEventListener('DOMContentLoaded', main);