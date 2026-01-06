// Arquivo: main.js (v8.6 - Substituição Completa)
import * as auth from './auth.js';
import * as ui from './ui.js';
import * as api from './api.js';
import * as utils from './utils.js';
import { supabase } from './supabaseClient.js';

let currentUserProfile = null;
let uiData = null;

function setupEventListeners() {
    // Auth
    document.getElementById('loginBtn')?.addEventListener('click', async () => {
        const email = document.getElementById('emailLogin').value;
        const pass = document.getElementById('password').value;
        await auth.signInUser(email, pass);
    });
    document.getElementById('logoutBtn')?.addEventListener('click', () => auth.signOutUser());

    // Projeto
    document.getElementById('saveBtn')?.addEventListener('click', handleSaveProject);
    document.getElementById('loadBtn')?.addEventListener('click', handleLoadProject);
    document.getElementById('newBtn')?.addEventListener('click', () => ui.resetForm());

    // >>> CONFIRMAÇÃO DO MODAL DE CIRCUITO <<<
    document.getElementById('confirmAddCircuitBtn')?.addEventListener('click', () => {
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
            // Atualiza Card Existente
            const fields = {
                [`nomeCircuito-${eid}`]: data.nome,
                [`tipoCircuito-${eid}`]: data.tipo,
                [`potenciaW-${eid}`]: data.potencia,
                [`fatorDemanda-${eid}`]: data.demanda,
                [`fases-${eid}`]: data.fases,
                [`tensaoV-${eid}`]: data.tensao,
                [`comprimentoM-${eid}`]: data.comprimento,
                [`tipoIsolacao-${eid}`]: data.isolacao,
                [`numCircuitosAgrupados-${eid}`]: data.agrupamento
            };
            Object.keys(fields).forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = fields[id];
            });
            const drEl = document.getElementById(`requerDR-${eid}`);
            if (drEl) drEl.checked = data.dr;
            
            document.getElementById(`nomeCircuitoLabel-${eid}`).textContent = data.nome;
            document.getElementById(`resumoPotencia-${eid}`).textContent = `${data.potencia}W | ${data.tensao}V`;
        } else {
            // Cria Novo via UI
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

    const app = document.getElementById('appContainer');
    if (app) {
        app.addEventListener('click', ui.handleMainContainerInteraction);
    }
    document.getElementById('addQdcBtn')?.addEventListener('click', () => ui.addQdcBlock());
    document.getElementById('calculateAndPdfBtn')?.addEventListener('click', handleCalculateAndPdf);
}

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
    } catch (e) { alert(e.message); }
    finally { loading.classList.remove('visible'); }
}

async function getFullFormData(forSave = false) {
    const main = { obra: document.getElementById('obra').value };
    const qdcs_data = [];
    document.querySelectorAll('#qdc-container .qdc-block').forEach(qdc => {
        const id = qdc.dataset.id;
        const circuits = [];
        qdc.querySelectorAll('.circuit-block').forEach(cb => {
            const cid = cb.dataset.id;
            const cdata = {};
            cb.querySelectorAll('input, select').forEach(i => {
                cdata[i.id] = i.type === 'checkbox' ? i.checked : i.value;
            });
            circuits.push(cdata);
        });
        qdcs_data.push({ id, name: document.getElementById(`qdcName-${id}`).value, parentId: document.getElementById(`qdcParent-${id}`).value, circuits });
    });
    return { project_name: main.obra, qdcs_data, owner_id: currentUserProfile?.id };
}

async function handleLoadProject() {
    const id = document.getElementById('savedProjectsSelect').value;
    const project = await api.fetchProjectById(id);
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
    } catch (e) { alert(e.message); }
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