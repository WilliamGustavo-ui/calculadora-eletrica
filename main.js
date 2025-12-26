import * as auth from './auth.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as utils from './utils.js';
import { supabase } from './supabaseClient.js';

let currentUserProfile = null;
let allClients = [];
let uiData = null;
let currentPdfUrl = null;

// --- 1. LOGIN COM TRATAMENTO DE ERRO (EVITA ERRO 400) ---

async function handleLogin() {
    const emailEl = document.getElementById('emailLogin');
    const passEl = document.getElementById('password');
    
    const email = emailEl.value.trim();
    const password = passEl.value;

    if (!email || !password) {
        alert("Por favor, preencha e-mail e senha.");
        return;
    }

    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.classList.add('visible');
    loadingOverlay.querySelector('p').textContent = 'Autenticando...';

    try {
        const userProfile = await auth.signInUser(email, password);
        // Se o login falhar, o auth.js já dispara um alert, então apenas limpamos o overlay
        if (!userProfile) {
            loadingOverlay.classList.remove('visible');
        }
        // Se tiver sucesso, o onAuthStateChange cuidará do resto
    } catch (e) {
        console.error("Erro inesperado no login:", e);
        loadingOverlay.classList.remove('visible');
    }
}

// --- 2. CARREGAMENTO CADENCIADO (EVITA TRAVAMENTO DE UI) ---

async function populateFormWithProjectData(project) {
    if (!project) return;
    const overlay = document.getElementById('loadingOverlay');
    const text = overlay.querySelector('p');
    
    overlay.classList.add('visible');
    text.textContent = 'Carregando estrutura da obra...';

    // Salva os dados brutos no objeto ui.js para acesso rápido no PDF
    ui.setLoadedProjectData(project);

    // Reseta o formulário sem travar
    ui.resetForm(false, project.client);
    document.getElementById('currentProjectId').value = project.id;

    if (project.qdcs_data) {
        const container = document.getElementById('qdc-container');
        container.innerHTML = '';
        const frag = document.createDocumentFragment();
        
        // Adiciona apenas os blocos (casca)
        project.qdcs_data.forEach(q => {
            ui.addQdcBlock(String(q.id), q.name, q.parentId, frag);
        });
        container.appendChild(frag);

        // NÃO abrimos os circuitos aqui. Isso evita o log de "Lazy Load" massivo que trava tudo.
        // Os circuitos serão carregados sob demanda ou quando gerar o PDF.
        
        ui.updateQdcParentDropdowns();
        text.textContent = 'Obra carregada com sucesso.';
        
        setTimeout(() => { 
            ui.updateFeederPowerDisplay(); 
            overlay.classList.remove('visible');
        }, 500);
    }
}

// --- 3. GERAÇÃO DE PDF VIA BACKEND (MEMORIAL COMPLETO) ---

async function handleCalculateAndPdf() {
    // Usamos os dados que já foram carregados no login/load para não depender do DOM lento
    const projectData = ui.loadedProjectData;
    
    if (!projectData) {
        alert("Erro: Dados da obra não encontrados. Tente carregar a obra novamente.");
        return;
    }

    const overlay = document.getElementById('loadingOverlay');
    overlay.classList.add('visible');
    overlay.querySelector('p').textContent = 'Gerando relatório completo no servidor...';

    try {
        // Envia o objeto completo (projectData) para a Edge Function
        // Assim o PDF terá todos os circuitos, mesmo que as abas estejam fechadas
        const payload = {
            mainData: projectData.main_data,
            feederData: projectData.feeder_data,
            qdcsData: projectData.qdcs_data,
            // O backend receberá os dados brutos do banco, garantindo 100% de integridade
            isDirectFromData: true 
        };

        const { data: blob, error } = await supabase.functions.invoke('gerar-relatorio', {
            body: { formData: payload },
            responseType: 'blob'
        });

        if (error) throw error;

        if (currentPdfUrl) URL.revokeObjectURL(currentPdfUrl);
        currentPdfUrl = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = currentPdfUrl;
        a.download = `Relatorio_${projectData.project_name || 'Obra'}.pdf`;
        a.click();

    } catch (e) {
        alert("Erro ao gerar PDF: " + e.message);
    } finally {
        overlay.classList.remove('visible');
    }
}

// --- 4. CONFIGURAÇÃO DE EVENTOS ---

function setupEventListeners() {
    document.getElementById('loginBtn')?.addEventListener('click', handleLogin);
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        await auth.signOutUser();
        window.location.reload();
    });

    document.getElementById('loadBtn')?.addEventListener('click', async () => {
        const id = document.getElementById('savedProjectsSelect').value;
        if (id) {
            const p = await api.fetchProjectById(id);
            populateFormWithProjectData(p);
        }
    });

    document.getElementById('calculateAndPdfBtn')?.addEventListener('click', handleCalculateAndPdf);
    document.getElementById('addQdcBtn')?.addEventListener('click', () => ui.addQdcBlock());
    
    const app = document.getElementById('appContainer');
    if (app) {
        app.addEventListener('change', ui.handleMainContainerInteraction);
        app.addEventListener('click', ui.handleMainContainerInteraction);
    }
}

// --- 5. INICIALIZAÇÃO SEGURA ---

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            const overlay = document.getElementById('loadingOverlay');
            overlay.classList.add('visible');
            overlay.querySelector('p').textContent = 'Sincronizando ambiente...';

            try {
                currentUserProfile = await auth.getSession();
                
                if (currentUserProfile?.is_approved && !currentUserProfile?.is_blocked) {
                    // Carrega dados técnicos uma única vez
                    if (!uiData) {
                        uiData = await api.fetchUiData();
                        ui.setupDynamicData(uiData);
                    }
                    
                    ui.showAppView(currentUserProfile);
                    
                    const projs = await api.fetchProjects('');
                    ui.populateProjectList(projs);
                } else {
                    ui.showLoginView();
                }
            } catch (e) {
                console.error("Erro na inicialização:", e);
            } finally {
                overlay.classList.remove('visible');
            }
        } else {
            ui.showLoginView();
        }
    });
});