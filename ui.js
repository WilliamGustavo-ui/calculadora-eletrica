import { ligacoes, BTU_TO_WATTS_FACTOR, CV_TO_WATTS_FACTOR, debounce } from './utils.js';
import { supabase } from './supabaseClient.js';

let circuitCount = 0;
let qdcCount = 0;
let uiData = null;
let tempOptions = { pvc: [], epr: [] };
export let loadedProjectData = null; 

export function setLoadedProjectData(projectData) {
    loadedProjectData = projectData;
}

// --- 1. COLETA DE DADOS OTIMIZADA (BACKEND FRIENDLY) ---
async function collectFormDataForCalculation() {
    const qdcsData = [];
    const circuitsData = [];
    const allQdcBlocks = document.querySelectorAll('#qdc-container .qdc-block');
    
    for (const qdcBlock of allQdcBlocks) {
        const qdcId = qdcBlock.dataset.id;
        const parentId = document.getElementById(`qdcParent-${qdcId}`)?.value || 'feeder';
        const fdQdc = document.getElementById(`qdcFatorDemanda-${qdcId}`)?.value || 100;

        qdcsData.push({
            id: qdcId,
            parentId: parentId,
            config: { fatorDemanda: fdQdc }
        });

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

// --- 2. ATUALIZAÇÃO VIA EDGE FUNCTION ---
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

        if (feederPotInstaladaEl) feederPotInstaladaEl.value = data.geral.instalada.toFixed(2);
        if (feederSomaPotDemandadaEl) feederSomaPotDemandadaEl.value = data.geral.somaDemandada.toFixed(2);
        if (feederPotDemandadaFinalEl) feederPotDemandadaFinalEl.value = data.geral.final.toFixed(2);

        Object.keys(data.qdcs).forEach(qdcId => {
            const potInstEl = document.getElementById(`qdcPotenciaInstalada-${qdcId}`);
            const potDemAgregadaEl = document.getElementById(`qdcPotenciaDemandada-${qdcId}`);
            if (potInstEl) potInstEl.value = data.qdcs[qdcId].instalada.toFixed(2);
            if (potDemAgregadaEl) potDemAgregadaEl.value = data.qdcs[qdcId].demandada.toFixed(2);
        });
    } catch (err) {
        console.error("Erro no cálculo remoto:", err);
    }
}
export const updateFeederPowerDisplay = debounce(_internal_updateFeederPowerDisplay, 600);

// --- 3. GESTÃO DE UI E DINÂMICOS ---
export function setupDynamicData(data) {
    uiData = data;
    if (uiData?.fatores_k1) tempOptions.pvc = uiData.fatores_k1.map(f => f.temperatura_c).sort((a,b)=>a-b);
    if (uiData?.fatores_k1_epr) tempOptions.epr = uiData.fatores_k1_epr.map(f => f.temperatura_c).sort((a,b)=>a-b);
}

export function openModal(modalId) { 
    if (modalId === 'qdcManagerModalOverlay') populateQdcManagerModal();
    const m = document.getElementById(modalId); if(m) m.style.display = 'flex'; 
}
export function closeModal(modalId) { const m = document.getElementById(modalId); if(m) m.style.display = 'none'; }

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

// --- 4. LÓGICA DE QUADROS (QDC) ---
function getQdcHTML(id, name, parentId) {
    return `
    <div class="qdc-block collapsed" id="qdc-${id}" data-id="${id}" data-circuits-loaded="false">
        <div class="qdc-header">
            <div class="form-group"><label>Nome</label><input type="text" id="qdcName-${id}" value="${name}" class="qdc-name-input"></div>
            <div class="form-group"><label>Alimentado por:</label><select id="qdcParent-${id}" class="qdc-parent-select" data-initial-parent="${parentId}"></select></div>
            <div class="qdc-header-right">
                <button type="button" class="toggle-circuits-btn btn-grey" data-qdc-id="${id}">Exibir Circuitos</button>
                <button type="button" class="add-circuit-to-qdc-btn btn-green" data-qdc-id="${id}">+ Circuito</button>
                <button type="button" class="remove-qdc-btn btn-red" data-qdc-id="${id}">Remover QDC</button>
            </div>
        </div>
        <div class="qdc-content">
            <div class="form-grid-3-col">
                 <div class="form-group"><label>Instalada</label><input type="text" id="qdcPotenciaInstalada-${id}" readonly></div>
                 <div class="form-group"><label>Demandada Agregada</label><input type="text" id="qdcPotenciaDemandada-${id}" readonly style="color: #28a745; font-weight: bold;"></div>
                 <div class="form-group"><label>FD (%)</label><input type="number" id="qdcFatorDemanda-${id}" value="100"></div>
            </div>
            <div id="circuits-for-qdc-${id}" class="circuits-container-internal">
                 <p class="circuits-loading-placeholder" style="display:none; text-align:center;">Carregando...</p>
            </div>
        </div>
    </div>`;
}

export function addQdcBlock(id = null, name = null, parentId = 'feeder', container = null) {
    let internalId = id ? String(id) : String(++qdcCount);
    const newQdcDiv = document.createElement('div');
    newQdcDiv.innerHTML = getQdcHTML(internalId, name || `QDC ${internalId}`, parentId);
    const target = container instanceof DocumentFragment ? container : document.getElementById('qdc-container');
    target.appendChild(newQdcDiv.firstElementChild);

    if (!(container instanceof DocumentFragment)) {
        updateQdcParentDropdowns();
        updateFeederPowerDisplay();
    }
    return internalId;
}

export function updateQdcParentDropdowns() {
    const options = [{ value: 'feeder', text: 'Alimentador Geral' }];
    document.querySelectorAll('.qdc-block').forEach(q => {
        const id = q.dataset.id;
        options.push({ value: `qdc-${id}`, text: document.getElementById(`qdcName-${id}`)?.value || `QDC ${id}` });
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

// --- 5. LAZY LOADING DE CIRCUITOS ---
export async function ensureCircuitsLoaded(qdcBlock, qdcId) {
    if (qdcBlock.dataset.circuitsLoaded === 'true') return;
    const container = document.getElementById(`circuits-for-qdc-${qdcId}`);
    const placeholder = container.querySelector('.circuits-loading-placeholder');
    if(placeholder) placeholder.style.display = 'block';

    const savedQdc = loadedProjectData?.qdcs_data?.find(q => String(q.id) === String(qdcId));
    if (savedQdc?.circuits) {
        const frag = document.createDocumentFragment();
        savedQdc.circuits.forEach(c => addCircuit(qdcId, c, frag));
        container.appendChild(frag);
    }
    qdcBlock.dataset.circuitsLoaded = 'true';
    if(placeholder) placeholder.style.display = 'none';
}

export function addCircuit(qdcId, data = null, container = null) {
    const id = data?.id || ++circuitCount;
    const div = document.createElement('div');
    div.innerHTML = `<div class="circuit-block collapsed" id="circuit-${id}" data-id="${id}">
        <div class="circuit-header">
            <span>Ckt ${id} - <span id="nomeCircuitoLabel-${id}">${data?.nomeCircuito || 'Novo'}</span></span>
            <button type="button" class="remove-circuit-btn btn-red" data-circuit-id="${id}">X</button>
        </div>
        <div class="circuit-content">
            <div class="form-group"><label>Nome</label><input type="text" id="nomeCircuito-${id}" value="${data?.nomeCircuito || ''}"></div>
            <div class="form-group"><label>Potência (W)</label><input type="number" id="potenciaW-${id}" value="${data?.potenciaW || 100}"></div>
        </div>
    </div>`;
    const target = container || document.getElementById(`circuits-for-qdc-${qdcId}`);
    target.appendChild(div.firstElementChild);
}

// --- 6. HANDLERS GERAIS ---
export function handleMainContainerInteraction(event) {
    const target = event.target;
    const qdcBlock = target.closest('.qdc-block');
    if (!qdcBlock) return;
    const qdcId = qdcBlock.dataset.id;

    if (target.classList.contains('toggle-circuits-btn')) {
        const isCol = qdcBlock.classList.contains('collapsed');
        if (isCol) {
            qdcBlock.classList.remove('collapsed');
            target.textContent = 'Ocultar Circuitos';
            ensureCircuitsLoaded(qdcBlock, qdcId);
        } else {
            qdcBlock.classList.add('collapsed');
            target.textContent = 'Exibir Circuitos';
        }
    }
    
    if (target.classList.contains('add-circuit-to-qdc-btn')) {
        ensureCircuitsLoaded(qdcBlock, qdcId).then(() => {
            addCircuit(qdcId);
            qdcBlock.classList.remove('collapsed');
        });
    }
}

export function resetForm(addDefault = true, client = null) {
    loadedProjectData = null;
    document.getElementById('qdc-container').innerHTML = '';
    if (client) document.getElementById('clientLinkDisplay').textContent = `Cliente: ${client.nome}`;
    if (addDefault) addQdcBlock();
}