// Arquivo: main.js (Substituição Total - v8.5)
import * as auth from './auth.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as utils from './utils.js';
import { supabase } from './supabaseClient.js';

let currentUserProfile = null;
let allClients = [];
let uiData = null;

// --- LISTENERS E MODAL DE CIRCUITO ---
function setupEventListeners() {
    // Auth & Modais básicos
    document.getElementById('loginBtn').addEventListener('click', async () => {
        const email = document.getElementById('emailLogin').value;
        const pass = document.getElementById('password').value;
        await auth.signInUser(email, pass);
    });
    document.getElementById('logoutBtn').addEventListener('click', () => auth.signOutUser());
    document.querySelectorAll('.close-modal-btn').forEach(btn => btn.addEventListener('click', (e) => ui.closeModal(e.target.closest('.modal-overlay').id)));

    // CRUD Projetos
    document.getElementById('saveBtn').addEventListener('click', handleSaveProject);
    document.getElementById('loadBtn').addEventListener('click', handleLoadProject);
    document.getElementById('newBtn').addEventListener('click', () => ui.resetForm());

    // >>> LÓGICA DO POPUP DE CIRCUITO <<<
    document.getElementById('confirmAddCircuitBtn').addEventListener('click', () => {
        const eid = document.getElementById('editingCircuitId').value;
        const qid = document.getElementById('targetQdcId').value;
        
        const data = {
            nome: document.getElementById('modalNomeCircuito').value,
            tipo: document.getElementById('modalTipoCircuito').value,
            potencia: document.getElementById('modalPotenciaW').value,
            demanda: document.getElementById('modalFatorDemanda').value,
            fases: document.getElementById('modalFases').value,
            tensao: document.getElementById('modalTensaoV').value,
            comprimento: document.getElementById('modalComprimentoM').value,
            isolacao: document.getElementById('modalTipoIsolacao').value,
            agrupamento: document.getElementById('modalAgrupamento').value,
            dr: document.getElementById('modalRequerDR').checked
        };

        if (eid) {
            // Atualiza Card Existente via DOM
            document.getElementById(`nomeCircuito-${eid}`).value = data.nome;
            document.getElementById(`nomeCircuitoLabel-${eid}`).textContent = data.nome;
            document.getElementById(`tipoCircuito-${eid}`).value = data.tipo;
            document.getElementById(`potenciaW-${eid}`).value = data.potencia;
            document.getElementById(`fatorDemanda-${eid}`).value = data.demanda;
            document.getElementById(`fases-${eid}`).value = data.fases;
            document.getElementById(`tensaoV-${eid}`).value = data.tensao;
            document.getElementById(`comprimentoM-${eid}`).value = data.comprimento;
            document.getElementById(`tipoIsolacao-${eid}`).value = data.isolacao;
            document.getElementById(`numCircuitosAgrupados-${eid}`).value = data.agrupamento;
            document.getElementById(`requerDR-${eid}`).checked = data.dr;
            document.getElementById(`resumoPotencia-${eid}`).textContent = `${data.potencia}W | ${data.tensao}V`;
        } else {
            // Cria Novo Card com os dados do modal
            const newId = ui.circuitCount + 1;
            const payload = {
                id: String(newId),
                [`nomeCircuito-${newId}`]: data.nome,
                [`tipoCircuito-${newId}`]: data.tipo,
                [`potenciaW-${newId}`]: data.potencia,
                [`fatorDemanda-${newId}`]: data.demanda,
                [`fases-${newId}`]: data.fases,
                [`tensaoV-${newId}`]: data.tensao,
                [`comprimentoM-${newId}`]: data.comprimento,
                [`tipoIsolacao-${newId}`]: data.isolacao,
                [`numCircuitosAgrupados-${newId}`]: data.agrupamento,
                [`requerDR-${newId}`]: data.dr
            };
            ui.addCircuit(qid, payload);
        }
        ui.closeModal('addCircuitModalOverlay');
        ui.updateFeederPowerDisplay();
    });

    // App Interações (Event Delegation)
    const app = document.getElementById('appContainer');
    app.addEventListener('click', ui.handleMainContainerInteraction);
    document.getElementById('addQdcBtn').addEventListener('click', () => ui.addQdcBlock());
    document.getElementById('calculateAndPdfBtn').addEventListener('click', handleCalculateAndPdf);
}

// --- INTEGRAÇÃO COM API (Baseado no seu arquivo v8.4) ---
async function handleSaveProject() {
    const loading = document.getElementById('loadingOverlay');
    loading.classList.add('visible');
    try {
        const formData = await getFullFormData(true);
        const pid = document.getElementById('currentProjectId').value;
        const { data, error } = await api.saveProject(formData, pid);
        if (error) throw error;
        alert("Obra salva!");
        document.getElementById('currentProjectId').value = data.id;
        document.getElementById('project_code').value = data.project_code;
    } catch (e) { alert("Erro ao salvar: " + e.message); }
    finally { loading.classList.remove('visible'); }
}

async function getFullFormData(forSave = false) {
    const main = { obra: document.getElementById('obra').value, projectCode: document.getElementById('project_code').value };
    const qdcs_data = [];
    document.querySelectorAll('#qdc-container .qdc-block').forEach(qdc => {
        const id = qdc.dataset.id;
        const circuits = [];
        qdc.querySelectorAll('.circuit-block').forEach(cb => {
            const cid = cb.dataset.id;
            const cdata = { id: cid };
            cb.querySelectorAll('input, select').forEach(i => {
                cdata[i.id] = i.type === 'checkbox' ? i.checked : i.value;
            });
            circuits.push(cdata);
        });
        qdcs_data.push({ id, name: document.getElementById(`qdcName-${id}`).value, parentId: document.getElementById(`qdcParent-${id}`).value, circuits });
    });
    return { project_name: main.obra, project_code: main.projectCode, qdcs_data, owner_id: currentUserProfile?.id };
}

async function handleLoadProject() {
    const pid = document.getElementById('savedProjectsSelect').value;
    if (!pid) return;
    const project = await api.fetchProjectById(pid);
    if (project) {
        ui.resetForm(false);
        document.getElementById('currentProjectId').value = project.id;
        document.getElementById('obra').value = project.project_name;
        project.qdcs_data?.forEach(q => {
            ui.addQdcBlock(q.id, q.name, q.parentId);
            q.circuits?.forEach(c => ui.addCircuit(q.id, c));
        });
    }
}

async function handleCalculateAndPdf() {
    const loading = document.getElementById('loadingOverlay');
    loading.classList.add('visible');
    try {
        const data = await getFullFormData(false);
        const { data: blob } = await supabase.functions.invoke('gerar-relatorio', { body: { formData: data }, responseType: 'blob' });
        const url = URL.createObjectURL(blob);
        window.open(url);
    } catch (e) { alert("Erro ao gerar PDF: " + e.message); }
    finally { loading.classList.remove('visible'); }
}

function main() {
    setupEventListeners();
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            currentUserProfile = await auth.getSession();
            uiData = await api.fetchUiData();
            ui.setupDynamicData(uiData);
            ui.showAppView(currentUserProfile);
            const projs = await api.fetchProjects('');
            ui.populateProjectList(projs);
        } else { ui.showLoginView(); }
    });
}
document.addEventListener('DOMContentLoaded', main);