// Arquivo: main.js (v8.6 - Correção de Sintaxe e Performance)

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
    const emailEl = document.getElementById('emailLogin');
    const passwordEl = document.getElementById('password');
    
    if (!emailEl || !passwordEl) return;

    const email = emailEl.value;
    const password = passwordEl.value;
    
    const userProfile = await auth.signInUser(email, password);
    if (!userProfile) {
        console.error("Falha no login ou usuário bloqueado.");
    }
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
    const password = document.getElementById('regPassword').value;
    
    const { error } = await auth.signUpUser(details.email, password, details);
    if (!error) {
        alert('Cadastro realizado! Aguarde a aprovação de um administrador.');
        ui.closeModal('registerModalOverlay');
        event.target.reset();
    } else {
        alert(`Erro no registro: ${error.message}`);
    }
}

// --- Gerenciamento de Dados (Otimizado para evitar travamentos) ---
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
    const client = allClients.find(c => String(c.id) === String(currentClientId));
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
    document.querySelectorAll('#feeder-form input, #feeder-form select').forEach(el => {
        const val = el.type === 'checkbox' ? el.checked : el.value;
        feederData[el.id] = val;
        const key = el.id.replace('feeder', '').charAt(0).toLowerCase() + el.id.replace('feeder', '').slice(1);
        feederDataForCalc[key] = (el.type === 'number' || ['fatorDemanda', 'fatorPotencia', 'comprimentoM', 'limiteQuedaTensao', 'tensaoV', 'temperaturaAmbienteC'].includes(key)) ? parseFloat(val) || 0 : val;
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
            qdcConfigCalc[key] = (el.type === 'number' || ['fatorDemanda', 'fatorPotencia', 'comprimentoM', 'limiteQuedaTensao'].includes(key)) ? parseFloat(val) || 0 : val;
        });

        const qdcInfo = { 
            id: qdcId, 
            name: document.getElementById(`qdcName-${qdcId}`)?.value || `QDC ${qdcId}`, 
            parentId: document.getElementById(`qdcParent-${qdcId}`)?.value || 'feeder' 
        };
        
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
            });
            circuitsSave.push(cSave);
            allCircuitsForCalc.push(cCalc);
        });
        
        qdcsDataForSave.push({ ...qdcInfo, config: qdcConfigSave, circuits: circuitsSave });
        
        // Desafoga a Main Thread para evitar travamento (Violation)
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    if (forSave) {
        return { 
            project_name: mainData.obra, 
            project_code: mainData.projectCode, 
            client_id: currentClientId || null, 
            main_data: mainData, 
            tech_data: techData, 
            feeder_data: feederData, 
            qdcs_data: qdcsDataForSave, 
            owner_id: currentUserProfile?.id 
        };
    }
    return { mainData, feederData: feederDataForCalc, qdcsData: qdcsDataForCalc, circuitsData: allCircuitsForCalc, clientProfile, techData };
}

// --- Geração de PDF (Sem vazamento de memória) ---
async function handleCalculateAndPdf() {
    if (!uiData || !currentUserProfile) return;

    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = loadingOverlay?.querySelector('p');
    
    const oldLinkContainer = document.getElementById('pdfLinkContainer');
    if (oldLinkContainer) {
        const oldLink = oldLinkContainer.querySelector('a');
        if (oldLink && oldLink.href.startsWith('blob:')) {
            URL.revokeObjectURL(oldLink.href); // Limpa memória RAM 
        }
        oldLinkContainer.remove();
    }

    if (loadingOverlay) loadingOverlay.classList.add('visible');
    if (loadingText) loadingText.textContent = 'Coletando dados e calculando...';
    
    try {
        const formDataForFunction = await getFullFormData(false);

        if (loadingText) loadingText.textContent = 'Gerando PDF no servidor...';
        
        const { data: pdfBlob, error: functionError } = await supabase.functions.invoke('gerar-relatorio', {
            body: { formData: formDataForFunction },
            responseType: 'blob'
        });

        if (functionError || !pdfBlob) throw new Error("A função não retornou um arquivo válido.");

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
        a.style.cssText = 'padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;';

        a.addEventListener('click', () => {
            setTimeout(() => { 
                if (linkContainer) linkContainer.style.display = 'none'; 
            }, 1000);
        });

        linkContainer.appendChild(a);
        const btnContainer = document.querySelector('.button-container');
        if (btnContainer) {
            btnContainer.parentNode.insertBefore(linkContainer, btnContainer.nextSibling);
        } else {
            document.body.appendChild(linkContainer);
        }

    } catch (error) {
        console.error("Erro no PDF:", error);
        alert("Ocorreu um erro: " + error.message);
    } finally {
        if (loadingOverlay) loadingOverlay.classList.remove('visible');
    }
}

// --- Inicialização e Listeners ---
function setupEventListeners() {
    document.getElementById('loginBtn')?.addEventListener('click', handleLogin);
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
    document.getElementById('registerBtn')?.addEventListener('click', () => ui.openModal('registerModalOverlay'));
    document.getElementById('registerForm')?.addEventListener('submit', handleRegister);
    document.getElementById('calculateAndPdfBtn')?.addEventListener('click', handleCalculateAndPdf);
    document.getElementById('addQdcBtn')?.addEventListener('click', () => ui.addQdcBlock());
    
    const appContainer = document.getElementById('appContainer');
    if (appContainer) {
        appContainer.addEventListener('change', ui.handleMainContainerInteraction);
        appContainer.addEventListener('click', ui.handleMainContainerInteraction);
        appContainer.addEventListener('input', (event) => {
            const target = event.target;
            if (target.id.startsWith('potenciaW-') || target.id.startsWith('fatorDemanda-') || target.id === 'feederFatorDemanda') {
                ui.updateFeederPowerDisplay();
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            const profile = await auth.getSession();
            if (profile && profile.is_approved && !profile.is_blocked) {
                currentUserProfile = profile;
                if (!uiData) {
                    uiData = await api.fetchUiData();
                    if (uiData) ui.setupDynamicData(uiData);
                }
                ui.showAppView(currentUserProfile);
                allClients = await api.fetchClients();
            } else {
                await auth.signOutUser();
                ui.showLoginView();
            }
        } else {
            ui.showLoginView();
        }
    });
});