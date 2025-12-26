// Arquivo: main.js (v10.0 - Carregamento em Background e Coleta Robusta)

import * as auth from './auth.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as utils from './utils.js';
import { supabase } from './supabaseClient.js';

let currentUserProfile = null;
let allClients = [];
let uiData = null;
let currentPdfUrl = null;

// --- 1. CARREGAMENTO DE OBRA OTIMIZADO (BACKEND-DRIVEN) ---

async function populateFormWithProjectData(project) {
    if (!project) return;
    const overlay = document.getElementById('loadingOverlay');
    const text = overlay.querySelector('p');
    
    overlay.classList.add('visible');
    text.textContent = 'Carregando dados da nuvem...';

    // Armazena os dados brutos para que o PDF possa usá-los sem ler o HTML
    ui.setLoadedProjectData(project);

    // Renderiza apenas a "casca" dos QDCs para evitar travamento de UI
    ui.resetForm(false, project.client);
    document.getElementById('currentProjectId').value = project.id;

    if (project.feeder_data) {
        Object.keys(project.feeder_data).forEach(k => {
            const el = document.getElementById(k);
            if (el) el.value = project.feeder_data[k];
        });
    }

    if (project.qdcs_data) {
        const container = document.getElementById('qdc-container');
        container.innerHTML = '';
        const frag = document.createDocumentFragment();
        
        project.qdcs_data.forEach(q => {
            ui.addQdcBlock(String(q.id), q.name, q.parentId, frag);
        });
        container.appendChild(frag);

        // ATENÇÃO: Não vamos forçar o clique/abertura de todos os circuitos aqui.
        // Isso é o que causa o travamento. Vamos deixar que o usuário abra conforme precisar.
        // A soma do Alimentador será feita via dados, não via DOM.
        
        text.textContent = 'Sincronizando cálculos...';
        setTimeout(() => { 
            ui.updateFeederPowerDisplay(); 
            overlay.classList.remove('visible');
        }, 500);
    }
}

// --- 2. GERAÇÃO DE PDF (A VERDADEIRA SOLUÇÃO) ---

async function handleCalculateAndPdf() {
    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.add('visible');
    overlay.querySelector('p').textContent = 'Preparando dados em segundo plano...';

    try {
        // PEGANDO DADOS DIRETAMENTE DO OBJETO, NÃO DO HTML
        // Isso evita que o PDF venha incompleto se os quadros estiverem fechados
        const projectData = ui.loadedProjectData; 
        
        if (!projectData) {
            throw new Error("Dados da obra não encontrados. Tente recarregar a obra.");
        }

        // Preparamos o pacote de dados EXATAMENTE como a Edge Function espera
        const payload = {
            mainData: projectData.main_data,
            feederData: processFeederForCalc(projectData.feeder_data),
            qdcsData: projectData.qdcs_data.map(q => ({
                id: q.id,
                name: q.name,
                parentId: q.parentId,
                config: processConfigForCalc(q.config)
            })),
            circuitsData: extractAllCircuits(projectData.qdcs_data),
            clientProfile: projectData.client || {},
            techData: projectData.tech_data || {}
        };

        overlay.querySelector('p').textContent = 'Backend processando 50+ páginas...';

        const { data: blob, error } = await supabase.functions.invoke('gerar-relatorio', {
            body: { formData: payload },
            responseType: 'blob'
        });

        if (error) throw error;

        if (currentPdfUrl) URL.revokeObjectURL(currentPdfUrl);
        currentPdfUrl = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = currentPdfUrl;
        a.download = `Relatorio_${projectData.project_name}.pdf`;
        a.click();

    } catch (e) {
        alert("Erro no Backend: " + e.message);
    } finally {
        overlay.classList.remove('visible');
    }
}

// --- FUNÇÕES AUXILIARES DE BACKEND (PROCESSAMENTO DE DADOS) ---

function extractAllCircuits(qdcsData) {
    const all = [];
    qdcsData.forEach(qdc => {
        if (qdc.circuits) {
            qdc.circuits.forEach(c => {
                // Formata cada circuito para o motor de cálculo do backend
                all.push({
                    qdcId: qdc.id,
                    ...processConfigForCalc(c)
                });
            });
        }
    });
    return all;
}

function processFeederForCalc(data) {
    const processed = { id: 'feeder' };
    Object.keys(data).forEach(k => {
        const val = data[k];
        const newKey = k.replace('feeder', '').charAt(0).toLowerCase() + k.replace('feeder', '').slice(1);
        processed[newKey] = isNaN(val) || val === "" ? val : parseFloat(val);
    });
    return processed;
}

function processConfigForCalc(config) {
    const processed = {};
    Object.keys(config).forEach(k => {
        const val = config[k];
        // Remove prefixos de ID e converte strings numéricas em números reais
        const newKey = k.split('-')[0].replace('qdc', '').replace(/^[A-Z]/, l => l.toLowerCase());
        processed[newKey] = isNaN(val) || val === "" || typeof val === 'boolean' ? val : parseFloat(val);
    });
    return processed;
}

// --- SETUP DOS LISTENERS (ORDEM CORRETA) ---

function setupEventListeners() {
    document.getElementById('loginBtn')?.addEventListener('click', async () => {
        const user = await auth.signInUser(document.getElementById('emailLogin').value, document.getElementById('password').value);
        if (user) window.location.reload(); 
    });

    document.getElementById('loadBtn')?.addEventListener('click', handleLoadProject);
    document.getElementById('calculateAndPdfBtn')?.addEventListener('click', handleCalculateAndPdf);
    
    // Outros botões...
    document.getElementById('saveBtn')?.addEventListener('click', () => alert("Use o botão de salvar original"));
}

async function handleLoadProject() {
    const id = document.getElementById('savedProjectsSelect').value;
    if (!id) return;
    const p = await api.fetchProjectById(id);
    if (p) populateFormWithProjectData(p);
}

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    supabase.auth.onAuthStateChange(async (ev, sess) => {
        if (sess) {
            currentUserProfile = await auth.getSession();
            uiData = await api.fetchUiData();
            ui.setupDynamicData(uiData);
            ui.showAppView(currentUserProfile);
            const projs = await api.fetchProjects('');
            ui.populateProjectList(projs);
        } else {
            ui.showLoginView();
        }
    });
});