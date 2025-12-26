// Arquivo: main.js (v8.5 - Solução para bloqueio de Main Thread e Memory Leak)

import * as auth from './auth.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as utils from './utils.js';
import { supabase } from './supabaseClient.js';

let currentUserProfile = null;
let allClients = [];
let uiData = null;

// --- Funções de Autenticação ---
async function handleLogin() {
    const email = document.getElementById('emailLogin').value;
    const password = document.getElementById('password').value;
    const userProfile = await auth.signInUser(email, password);
    if (!userProfile) console.error("Falha no login."); [cite: 1, 2]
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
    const { error } = await auth.signUpUser(details.email, document.getElementById('regPassword').value, details); [cite: 1]
    if (!error) {
        alert('Cadastro realizado! Aguarde aprovação.');
        ui.closeModal('registerModalOverlay');
        event.target.reset();
    } else {
        alert(`Erro: ${error.message}`);
    }
}

// --- Gerenciamento de Dados e Obras ---
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
    }; [cite: 79]

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
    } : {}; [cite: 81]

    const techData = { 
        respTecnico: document.getElementById('respTecnico').value, 
        titulo: document.getElementById('titulo').value, 
        crea: document.getElementById('crea').value 
    }; [cite: 79]
    
    const feederData = {};
    const feederDataForCalc = { id: 'feeder', nomeCircuito: "Alimentador Geral" };
    document.querySelectorAll('#feeder-form input, #feeder-form select').forEach(el => {
        const val = el.type === 'checkbox' ? el.checked : el.value;
        feederData[el.id] = val;
        const key = el.id.replace('feeder', '').charAt(0).toLowerCase() + el.id.replace('feeder', '').slice(1);
        feederDataForCalc[key] = (el.type === 'number' || ['fatorDemanda', 'fatorPotencia', 'comprimentoM', 'limiteQuedaTensao', 'tensaoV', 'temperaturaAmbienteC'].includes(key)) ? parseFloat(val) || 0 : val;
    }); [cite: 27, 30]

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
            qdcConfigCalc[key] = (el.type === 'number' || ['fatorDemanda', 'fatorPotencia', 'comprimentoM', 'limiteQuedaTensao'].includes(key)) ? parseFloat(val) || 0 : val;
        }); [cite: 19]

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
                cCalc[key] = (el.type === 'number' || ['potenciaW', 'fatorDemanda', 'fatorPotencia'].includes(key)) ? parseFloat(val) || 0 : val;
            }); [cite: 81]
            circuitsSave.push(cSave);
            allCircuitsForCalc.push(cCalc);
        });
        
        qdcsDataForSave.push({ ...qdcInfo, config: qdcConfigSave, circuits: circuitsSave });
        // Pausa de 0ms para liberar a UI e evitar erro de 'Violation'
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    return forSave ? { 
        project_name: mainData.obra, 
        project_code: mainData.projectCode, 
        client_id: currentClientId, 
        main_data: mainData, 
        tech_data: techData, 
        feeder_data: feederData, 
        qdcs_data: qdcsDataForSave, 
        owner_id: currentUserProfile?.id 
    } : { mainData, feederData: feederDataForCalc, qdcsData: qdcsDataForCalc, circuitsData: allCircuitsForCalc, clientProfile, techData };
}

// >>>>> FUNÇÃO CORRIGIDA: handleCalculateAndPdf <<<<<
async function handleCalculateAndPdf() {
    if (!uiData || !currentUserProfile) return;

    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = loadingOverlay.querySelector('p');
    
    // 1. Limpeza Proativa de Memória
    const oldLinkContainer = document.getElementById('pdfLinkContainer');
    if (oldLinkContainer) {
        const oldLink = oldLinkContainer.querySelector('a');
        if (oldLink && oldLink.href.startsWith('blob:')) {
            URL.revokeObjectURL(oldLink.href); // Libera o PDF antigo da RAM
        }
        oldLinkContainer.remove();
    }

    loadingOverlay.classList.add('visible');
    loadingText.textContent = 'Coletando dados...';
    
    try {
        // Coleta assíncrona para não travar o clique
        const formDataForFunction = await getFullFormData(false);

        loadingText.textContent = 'Gerando Relatório no Servidor...';
        
        const { data: pdfBlob, error: functionError } = await supabase.functions.invoke('gerar-relatorio', {
            body: { formData: formDataForFunction },
            responseType: 'blob'
        }); [cite: 201]

        if (functionError || !pdfBlob) throw new Error(functionError?.message || "Erro ao receber arquivo.");

        // 2. Criação do Objeto PDF
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const nomeObra = document.getElementById('obra')?.value || 'Projeto';
        
        const linkContainer = document.createElement('div');
        linkContainer.id = 'pdfLinkContainer';
        linkContainer.style.cssText = 'margin-top: 20px; text-align: center;';

        const a = document.createElement('a');
        a.href = pdfUrl;
        a.textContent = "BAIXAR RELATÓRIO PDF";
        a.download = `Relatorio_${nomeObra.replace(/[^a-z0-9]/gi, '_')}.pdf`;
        a.className = 'btn-green';
        a.style.cssText = 'padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;';

        // Auto-destruição do link para economizar recursos
        a.addEventListener('click', () => {
            setTimeout(() => { 
                if(linkContainer) linkContainer.style.display = 'none'; 
                // Não revogamos aqui para permitir que o usuário abra o link novamente se necessário
            }, 2000);
        });

        linkContainer.appendChild(a);
        const btnContainer = document.querySelector('.button-container');
        btnContainer ? btnContainer.parentNode.insertBefore(linkContainer, btnContainer.nextSibling) : document.body.appendChild(linkContainer);

        console.log("PDF Pronto para download.");

    } catch (error) {
        console.error("Erro no PDF:", error);
        alert("Erro ao gerar PDF: " + error.message);
    } finally {
        loadingOverlay.classList.remove('visible');
        loadingText.textContent = 'Calculando...';
    }
}

// --- Inicialização ---
function setupEventListeners() {
    document.getElementById('loginBtn')?.addEventListener('click', handleLogin);
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
    document.getElementById('saveBtn')?.addEventListener('click', handleSaveProject);
    document.getElementById('calculateAndPdfBtn')?.addEventListener('click', handleCalculateAndPdf);
    
    const app = document.getElementById('appContainer');
    if (app) {
        app.addEventListener('change', ui.handleMainContainerInteraction);
        app.addEventListener('click', ui.handleMainContainerInteraction);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            currentUserProfile = await auth.getSession(); [cite: 1]
            if (!uiData) {
                uiData = await api.fetchUiData(); [cite: 205]
                ui.setupDynamicData(uiData);
            }
            ui.showAppView(currentUserProfile);
        } else {
            ui.showLoginView();
        }
    });
});