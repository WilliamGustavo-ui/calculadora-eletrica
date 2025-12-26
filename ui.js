// Arquivo: ui.js (Versão Final - JavaScript Puro - v18.2)
import { ligacoes, BTU_TO_WATTS_FACTOR, CV_TO_WATTS_FACTOR, debounce } from './utils.js';
import { supabase } from './supabaseClient.js';

let circuitCount = 0;
let qdcCount = 0;
let uiData = null;
let tempOptions = { pvc: [], epr: [] };
export let loadedProjectData = null; 

// Armazena dados do projeto carregado para permitir cálculos em QDCs não renderizados
export function setLoadedProjectData(projectData) {
    loadedProjectData = projectData;
}

// --- 1. LÓGICA DE CÁLCULO REMOTO (Evita Travamentos) ---

/**
 * Coleta os dados de potências de forma leve. 
 * Se o QDC estiver fechado (Lazy Load), lê os dados do cache 'loadedProjectData'.
 */
export async function collectFormDataForCalculation() {
    const qdcsData = [];
    const circuitsData = [];
    const allQdcBlocks = document.querySelectorAll('#qdc-container .qdc-block');
    
    for (const qdcBlock of allQdcBlocks) {
        const qdcId = qdcBlock.dataset.id;
        const parentId = document.getElementById(`qdcParent-${qdcId}`)?.value || 'feeder';
        const fdQdc = document.getElementById(`qdcFatorDemanda-${qdcId}`)?.value || 100;

        qdcsData.push({ id: qdcId, parentId: parentId, config: { fatorDemanda: fdQdc } });

        const circuitsInDom = qdcBlock.querySelectorAll('.circuit-block');
        if (circuitsInDom.length > 0) {
            circuitsInDom.forEach(c => {
                const cId = c.dataset.id;
                circuitsData.push({ 
                    qdcId: qdcId, 
                    potenciaW: document.getElementById(`potenciaW-${cId}`)?.value || 0 
                });
            });
        } else {
            const savedQdc = loadedProjectData?.qdcs_data?.find(q => String(q.id) === String(qdcId));
            if (savedQdc?.circuits) {
                savedQdc.circuits.forEach(c => {
                    const potW = c[`potenciaW-${c.id}`] || c.potenciaW || 0;
                    circuitsData.push({ qdcId: qdcId, potenciaW: potW });
                });
            }
        }
    }
    return { qdcsData, circuitsData };
}

/**
 * Chama a Edge Function no Supabase para processar a hierarquia.
 */
async function _internal_updateFeederPowerDisplay() {
    const feederPotInstaladaEl = document.getElementById('feederPotenciaInstalada');
    const feederSomaPotDemandadaEl = document.getElementById('feederSomaPotenciaDemandada');
    const feederPotDemandadaFinalEl = document.getElementById('feederPotenciaDemandada');
    const fdGeral = document.getElementById('feederFatorDemanda')?.value || 100;

    try {
        const { qdcsData, circuitsData } = await collectFormDataForCalculation();
        
        const { data, error } = await supabase.functions.invoke('calcular-totais', {
            body: { qdcsData, circuitsData, feederFatorDemanda: fdGeral }
        });

        if (error) throw error;

        // Atualiza Alimentador Geral
        if (feederPotInstaladaEl) feederPotInstaladaEl.value = data.geral.instalada.toFixed(2);
        if (feederSomaPotDemandadaEl) feederSomaPotDemandadaEl.value = data.geral.somaDemandada.toFixed(2);
        if (feederPotDemandadaFinalEl) feederPotDemandadaFinalEl.value = data.geral.final.toFixed(2);

        // Atualiza inputs de cada QDC visível
        Object.keys(data.qdcs).forEach(qdcId => {
            const pi = document.getElementById(`qdcPotenciaInstalada-${qdcId}`);
            const pd = document.getElementById(`qdcPotenciaDemandada-${qdcId}`);
            if (pi) pi.value = data.qdcs[qdcId].instalada.toFixed(2);
            if (pd) pd.value = data.qdcs[qdcId].demandada.toFixed(2);
        });
    } catch (err) {
        console.error("Erro no cálculo remoto:", err);
    }
}
export const updateFeederPowerDisplay = debounce(_internal_updateFeederPowerDisplay, 600);

// --- 2. GESTÃO DE UI E PROJETOS ---

export function populateProjectList(projects) {
    const select = document.getElementById('savedProjectsSelect');
    if(!select) return;
    select.innerHTML = '<option value="">-- Selecione uma obra --</option>';
    if (projects && Array.isArray(projects)) {
        projects.forEach(p => {
            const o = document.createElement('option');
            o.value = p.id;
            o.textContent = `${p.project_code || 'S/C'} - ${p.project_name}`;
            select.appendChild(o);
        });
    }
}

export function setupDynamicData(data) {
    uiData = data;
    if (uiData?.fatores_k1) tempOptions.pvc = uiData.fatores_k1.map(f => f.temperatura_c).sort((a,b)=>a-b);
    if (uiData?.fatores_k1_epr) tempOptions.epr = uiData.fatores_k1_epr.map(f => f.temperatura_c).sort((a,b)=>a-b);
}

export function showAppView(userProfile) {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    const isAdmin = userProfile?.is_admin || false;
    document.getElementById('adminPanelBtn').style.display = isAdmin ? 'block' : 'none';
}

export function showLoginView() {
    document.getElementById('loginContainer').style.display = 'block';
    document.getElementById('appContainer').style.display = 'none';
}

export function openModal(id) { 
    const modal = document.getElementById(id);
    if(modal) modal.style.display = 'flex'; 
}

export function closeModal(id) { 
    const modal = document.getElementById(id);
    if(modal) modal.style.display = 'none'; 
}

// --- 3. TEMPLATES HTML ---

function getQdcHTML(id, name, parentId) {
    return `
    <div class="qdc-block collapsed" id="qdc-${id}" data-id="${id}" data-circuits-loaded="false">
        <div class="qdc-header">
            <div class="form-group"><label>Nome</label><input type="text" id="qdcName-${id}" value="${name}"></div>
            <div class="form-group"><label>Alimentação</label><select id="qdcParent-${id}" class="qdc-parent-select" data-initial-parent="${parentId}"></select></div>
            <div class="qdc-header-right">
                <button type="button" class="toggle-circuits-btn btn-grey" data-qdc-id="${id}">Exibir</button>
                <button type="button" class="add-circuit-to-qdc-btn btn-green" data-qdc-id="${id}">+ Ckt</button>
                <button type="button" class="remove-qdc-btn btn-red" data-qdc-id="${id}">Remover</button>
            </div>
        </div>
        <div class="qdc-content" style="display:none; padding: 20px;">
            <div class="form-grid-3-col">
                <div class="form-group"><label>Instalada</label><input type="text" id="qdcPotenciaInstalada-${id}" readonly></div>
                <div class="form-group"><label>Demandada (Agregada)</label><input type="text" id="qdcPotenciaDemandada-${id}" readonly style="color: #28a745; font-weight: bold;"></div>
                <div class="form-group"><label>FD %</label><input type="number" id="qdcFatorDemanda-${id}" value="100"></div>
            </div>
            <div id="circuits-for-qdc-${id}"></div>
        </div>
    </div>`;
}

// --- 4. FUNÇÕES DE RENDERIZAÇÃO E EVENTOS ---

export function addQdcBlock(id = null, name = null, parentId = 'feeder', container = null) {
    let internalId = id ? String(id) : String(++qdcCount);
    const div = document.createElement('div');
    div.innerHTML = getQdcHTML(internalId, name || `QDC ${internalId}`, parentId);
    const target = container instanceof DocumentFragment ? container : document.getElementById('qdc-container');
    target.appendChild(div.firstElementChild);

    if (!(container instanceof DocumentFragment)) {
        updateQdcParentDropdowns();
        updateFeederPowerDisplay();
    }
    return internalId;
}

export function addCircuit(qdcId, data = null, container = null) {
    const id = data?.id || ++circuitCount;
    const div = document.createElement('div');
    div.innerHTML = `<div class="circuit-block" data-id="${id}" style="border: 1px solid #ddd; padding: 10px; margin-bottom: 10px; border-radius: 5px;">
        <div style="display: flex; gap: 10px; align-items: center;">
            <span>Ckt ${id}</span>
            <input type="text" id="nomeCircuito-${id}" value="${data?.nomeCircuito || 'Circuito ' + id}" style="flex: 1;">
            <label>W:</label>
            <input type="number" id="potenciaW-${id}" value="${data?.potenciaW || 1000}" style="width: 80px;">
        </div>
    </div>`;
    const target = container || document.getElementById(`circuits-for-qdc-${qdcId}`);
    target.appendChild(div.firstElementChild);
}

export async function ensureCircuitsLoaded(qdcBlock, qdcId) {
    if (qdcBlock.dataset.circuitsLoaded === 'true') return;
    const container = document.getElementById(`circuits-for-qdc-${qdcId}`);
    const saved = loadedProjectData?.qdcs_data?.find(q => String(q.id) === String(qdcId));
    if (saved?.circuits) {
        const frag = document.createDocumentFragment();
        saved.circuits.forEach(c => addCircuit(qdcId, c, frag));
        container.appendChild(frag);
    }
    qdcBlock.dataset.circuitsLoaded = 'true';
}

export function handleMainContainerInteraction(event) {
    const target = event.target;
    const qdcBlock = target.closest('.qdc-block');
    if (!qdcBlock) return;
    const qdcId = qdcBlock.dataset.id;
    const content = qdcBlock.querySelector('.qdc-content');

    if (target.classList.contains('toggle-circuits-btn')) {
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'block' : 'none';
        target.textContent = isHidden ? 'Ocultar' : 'Exibir';
        if (isHidden) {
            qdcBlock.classList.remove('collapsed');
            ensureCircuitsLoaded(qdcBlock, qdcId);
        } else {
            qdcBlock.classList.add('collapsed');
        }
    }
    
    if (target.classList.contains('add-circuit-to-qdc-btn')) {
        content.style.display = 'block';
        qdcBlock.classList.remove('collapsed');
        ensureCircuitsLoaded(qdcBlock, qdcId);
        addCircuit(qdcId);
        updateFeederPowerDisplay();
    }

    if (target.classList.contains('remove-qdc-btn')) {
        if(confirm("Deseja realmente remover este QDC?")) {
            qdcBlock.remove();
            updateQdcParentDropdowns();
            updateFeederPowerDisplay();
        }
    }
}

export function updateQdcParentDropdowns() {
    const options = [{ value: 'feeder', text: 'Alimentador Geral' }];
    document.querySelectorAll('.qdc-block').forEach(q => {
        const id = q.dataset.id;
        const name = document.getElementById(`qdcName-${id}`)?.value || `QDC ${id}`;
        options.push({ value: `qdc-${id}`, text: name });
    });
    document.querySelectorAll('.qdc-parent-select').forEach(s => {
        const currentId = s.closest('.qdc-block').dataset.id;
        const val = s.dataset.initialParent || s.value;
        s.innerHTML = '';
        options.forEach(o => {
            if (`qdc-${currentId}` !== o.value) {
                const opt = document.createElement('option');
                opt.value = o.value; opt.textContent = o.text; s.appendChild(opt);
            }
        });
        s.value = val;
    });
}

export function resetForm(addDefault = true, client = null) {
    loadedProjectData = null;
    document.getElementById('qdc-container').innerHTML = '';
    const linkDisplay = document.getElementById('clientLinkDisplay');
    if (client && linkDisplay) {
        linkDisplay.textContent = `Cliente: ${client.nome}`;
    } else if (linkDisplay) {
        linkDisplay.textContent = 'Cliente: Nenhum';
    }
    if (addDefault) addQdcBlock();
    updateFeederPowerDisplay();
}

// --- 5. FUNÇÕES ADMINISTRATIVAS ---

export function populateUsersPanel(users) {
    const list = document.getElementById('adminUserList');
    if (!list) return;
    list.innerHTML = '';
    users.forEach(user => {
        const li = document.createElement('li');
        li.innerHTML = `<span><strong>${user.nome || user.email}</strong></span>
        <div class="admin-user-actions">
            <button class="btn-green approve-user-btn" data-user-id="${user.id}">${user.is_approved ? 'Aprovado' : 'Aprovar'}</button>
            <button class="btn-red remove-user-btn" data-user-id="${user.id}">Excluir</button>
        </div>`;
        list.appendChild(li);
    });
}

export function populateProjectsPanel(projects, clients, users, currentUserProfile) {
    const tableBody = document.getElementById('adminProjectsTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    projects.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${p.project_code || 'S/C'}</td>
        <td>${p.project_name}</td>
        <td>${p.owner?.nome || 'N/A'}</td>
        <td>${p.client?.nome || 'Nenhum'}</td>`;
        tableBody.appendChild(tr);
    });
}

export function populateClientManagementModal(clients) {
    const list = document.getElementById('clientList');
    if (!list) return;
    list.innerHTML = '';
    clients.forEach(c => {
        const li = document.createElement('li');
        li.innerHTML = `<span><strong>${c.nome}</strong></span>
        <button class="btn-edit edit-client-btn" data-client-id="${c.id}">Editar</button>`;
        list.appendChild(li);
    });
}