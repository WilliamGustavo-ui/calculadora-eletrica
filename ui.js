// Arquivo: ui.js (v5 - Versão Corrigida e Completa)
import { ligacoes, BTU_TO_WATTS_FACTOR, CV_TO_WATTS_FACTOR } from './utils.js';
import { debounce } from './utils.js';

export let circuitCount = 0;
let qdcCount = 0;
let uiData = null;
let tempOptions = { pvc: [], epr: [] };
export let loadedProjectData = null;

export function setLoadedProjectData(projectData) { loadedProjectData = projectData; }

export function setupDynamicData(data) {
    uiData = data;
    if (uiData?.fatores_k1) {
        tempOptions.pvc = uiData.fatores_k1.map(f => f.temperatura_c).sort((a, b) => a - b);
    }
    tempOptions.pvc = [...new Set(tempOptions.pvc || [30])];
    if (uiData?.fatores_k1_epr) {
        tempOptions.epr = uiData.fatores_k1_epr.map(f => f.temperatura_c).sort((a, b) => a - b);
    }
    tempOptions.epr = [...new Set(tempOptions.epr || [30])];
}

// --- VISIBILIDADE ---
export function showLoginView() { document.getElementById('loginContainer').style.display = 'block'; document.getElementById('appContainer').style.display = 'none'; }
export function showAppView(userProfile) { document.getElementById('loginContainer').style.display = 'none'; document.getElementById('appContainer').style.display = 'block'; document.getElementById('adminPanelBtn').style.display = userProfile?.is_admin ? 'block' : 'none'; }
export function openModal(modalId) { const m = document.getElementById(modalId); if(m) m.style.display = 'flex'; }
export function closeModal(modalId) { const m = document.getElementById(modalId); if(m) m.style.display = 'none'; }

// --- SOMA HIERÁRQUICA (Mantida original) ---
function _internal_updateFeederPowerDisplay() {
    const qdcData = {};
    let totalDemandAggregatedGeneral = 0;
    let totalInstalledAggregatedGeneral = 0;
    document.querySelectorAll('#qdc-container .qdc-block').forEach(qdcBlock => {
        const qdcId = qdcBlock.dataset.id;
        let installedDirect = 0;
        let demandedDirect = 0;
        qdcBlock.querySelectorAll('.circuit-block').forEach(circuitBlock => {
            const id = circuitBlock.dataset.id;
            const potenciaW = parseFloat(circuitBlock.querySelector(`#potenciaW-${id}`)?.value) || 0;
            const fd = (parseFloat(circuitBlock.querySelector(`#fatorDemanda-${id}`)?.value) || 100) / 100.0;
            installedDirect += potenciaW;
            demandedDirect += (potenciaW * fd);
        });
        const parentId = qdcBlock.querySelector(`#qdcParent-${qdcId}`)?.value || 'feeder';
        qdcData[qdcId] = { installedDirect, demandedDirect, parentId, childrenIds: [], aggregatedInstalled: -1 };
        document.getElementById(`qdcPotenciaInstalada-${qdcId}`).value = installedDirect.toFixed(2);
        document.getElementById(`qdcDemandaPropria-${qdcId}`).value = demandedDirect.toFixed(2);
    });
    Object.keys(qdcData).forEach(id => {
        const p = qdcData[id].parentId;
        if (p !== 'feeder' && qdcData[p.replace('qdc-', '')]) qdcData[p.replace('qdc-', '')].childrenIds.push(id);
    });
    function calcInst(id) {
        if (qdcData[id].aggregatedInstalled !== -1) return qdcData[id].aggregatedInstalled;
        let s = qdcData[id].installedDirect;
        qdcData[id].childrenIds.forEach(cid => s += calcInst(cid));
        qdcData[id].aggregatedInstalled = s;
        return s;
    }
    Object.keys(qdcData).forEach(id => {
        const ai = calcInst(id);
        const qfd = (parseFloat(document.getElementById(`qdcFatorDemanda-${id}`)?.value) || 100) / 100.0;
        const ad = ai * qfd;
        document.getElementById(`qdcPotenciaDemandada-${id}`).value = ad.toFixed(2);
        if (qdcData[id].parentId === 'feeder') { totalDemandAggregatedGeneral += ad; totalInstalledAggregatedGeneral += ai; }
    });
    document.getElementById('feederPotenciaInstalada').value = totalInstalledAggregatedGeneral.toFixed(2);
    document.getElementById('feederSomaPotenciaDemandada').value = totalDemandAggregatedGeneral.toFixed(2);
    const gfd = (parseFloat(document.getElementById('feederFatorDemanda')?.value) || 100) / 100.0;
    document.getElementById('feederPotenciaDemandada').value = (totalDemandAggregatedGeneral * gfd).toFixed(2);
}
export const updateFeederPowerDisplay = debounce(_internal_updateFeederPowerDisplay, 350);

// --- COMPONENTES ---
export function addQdcBlock(id = null, name = null, parentId = 'feeder', container = null) {
    if (id) qdcCount = Math.max(qdcCount, parseInt(id, 10)); else qdcCount++;
    const internalId = id || String(qdcCount);
    const div = document.createElement('div');
    div.innerHTML = `
    <div class="qdc-block" id="qdc-${internalId}" data-id="${internalId}">
        <div class="qdc-header">
            <div class="form-group qdc-header-left"><label>Quadro</label><input type="text" id="qdcName-${internalId}" value="${name || 'QDC ' + internalId}" class="qdc-name-input"></div>
            <div class="form-group qdc-header-center"><label>Alimentado por:</label><select id="qdcParent-${internalId}" class="qdc-parent-select" data-initial-parent="${parentId}"></select></div>
            <div class="qdc-header-right">
                <button type="button" class="add-circuit-to-qdc-btn btn-green">+ Circuito</button>
                <button type="button" class="remove-qdc-btn btn-red">Remover</button>
            </div>
        </div>
        <div class="qdc-content">
            <div class="form-grid-3-col">
                 <div class="form-group"><label>Instalada</label><input type="text" id="qdcPotenciaInstalada-${internalId}" readonly></div>
                 <div class="form-group"><label>Demanda Própria</label><input type="text" id="qdcDemandaPropria-${internalId}" readonly></div>
                 <div class="form-group"><label>Demanda Agregada</label><input type="text" id="qdcPotenciaDemandada-${internalId}" readonly></div>
            </div>
            <div class="hidden" style="display:none;"><input type="number" id="qdcFatorDemanda-${internalId}" value="100"></div>
            <div id="circuits-for-qdc-${internalId}" class="circuits-container-internal"></div>
        </div>
    </div>`;
    const target = container instanceof DocumentFragment ? container : document.getElementById('qdc-container');
    target.appendChild(div.firstElementChild);
    if (!(container instanceof DocumentFragment)) { updateQdcParentDropdowns(); updateFeederPowerDisplay(); }
    return internalId;
}

export function updateQdcParentDropdowns() {
    const options = [{ value: 'feeder', text: 'Alimentador Geral' }];
    document.querySelectorAll('#qdc-container .qdc-block').forEach(q => {
        const id = q.dataset.id;
        options.push({ value: `qdc-${id}`, text: document.getElementById(`qdcName-${id}`).value });
    });
    document.querySelectorAll('.qdc-parent-select').forEach(select => {
        const curId = select.closest('.qdc-block').dataset.id;
        const initial = select.dataset.initialParent || select.value;
        select.innerHTML = '';
        options.forEach(opt => {
            if (`qdc-${curId}` !== opt.value) {
                const o = document.createElement('option'); o.value = opt.value; o.textContent = opt.text; select.appendChild(o);
            }
        });
        select.value = initial;
    });
}

function getCircuitHTML(id) {
    return `
    <div class="circuit-block static-card" id="circuit-${id}" data-id="${id}">
        <div class="circuit-header no-toggle">
            <div class="circuit-info-summary">
                <span class="circuit-badge">${id}</span>
                <strong id="nomeCircuitoLabel-${id}">Circuito ${id}</strong>
                <span class="circuit-subinfo" id="resumoPotencia-${id}">-</span>
            </div>
            <div class="circuit-header-right">
                <button type="button" class="edit-circuit-btn btn-load">Editar</button>
                <button type="button" class="remove-circuit-btn btn-red">Excluir</button>
            </div>
        </div>
        <div class="hidden-data" style="display:none;">
            <input type="text" id="nomeCircuito-${id}">
            <input type="text" id="tipoCircuito-${id}">
            <input type="number" id="potenciaW-${id}">
            <input type="number" id="fatorDemanda-${id}">
            <input type="text" id="fases-${id}">
            <input type="number" id="tensaoV-${id}">
            <input type="number" id="comprimentoM-${id}">
            <input type="text" id="tipoIsolacao-${id}">
            <input type="number" id="numCircuitosAgrupados-${id}">
            <input type="checkbox" id="requerDR-${id}">
        </div>
    </div>`;
}

export function addCircuit(qdcId, data = null, container = null) {
    if (data && data.id) circuitCount = Math.max(circuitCount, parseInt(data.id, 10)); else circuitCount++;
    const id = data?.id || String(circuitCount);
    const div = document.createElement('div');
    div.innerHTML = getCircuitHTML(id);
    const el = div.firstElementChild;
    const target = container instanceof DocumentFragment ? container : document.getElementById(`circuits-for-qdc-${qdcId}`);
    target.appendChild(el);
    if (data) {
        Object.keys(data).forEach(key => {
            const inputId = key.includes('-') ? key : `${key}-${id}`;
            const input = el.querySelector(`#${inputId}`);
            if (input) { if (input.type === 'checkbox') input.checked = data[key]; else input.value = data[key]; }
        });
        el.querySelector(`#nomeCircuitoLabel-${id}`).textContent = data[`nomeCircuito-${id}`] || `Circuito ${id}`;
        el.querySelector(`#resumoPotencia-${id}`).textContent = `${data[`potenciaW-${id}`] || 0}W | ${data[`tensaoV-${id}`] || 220}V`;
    }
    if (!(container instanceof DocumentFragment)) updateFeederPowerDisplay();
}

export function handleMainContainerInteraction(event) {
    const target = event.target;
    const qdcBlock = target.closest('.qdc-block');
    const circuitBlock = target.closest('.circuit-block');

    if (qdcBlock && event.type === 'click') {
        if (target.classList.contains('add-circuit-to-qdc-btn')) {
            document.getElementById('targetQdcId').value = qdcBlock.dataset.id;
            document.getElementById('targetQdcName').textContent = document.getElementById(`qdcName-${qdcBlock.dataset.id}`).value;
            document.getElementById('editingCircuitId').value = "";
            document.getElementById('modalTitle').textContent = "Novo Circuito";
            document.getElementById('modalCircuitForm').reset();
            openModal('addCircuitModalOverlay');
        }
        if (target.classList.contains('remove-qdc-btn')) { if (confirm("Remover QDC?")) { qdcBlock.remove(); updateQdcParentDropdowns(); updateFeederPowerDisplay(); } }
    }

    if (circuitBlock && event.type === 'click') {
        const id = circuitBlock.dataset.id;
        if (target.classList.contains('edit-circuit-btn')) {
            document.getElementById('editingCircuitId').value = id;
            document.getElementById('targetQdcId').value = qdcBlock.dataset.id;
            document.getElementById('modalTitle').textContent = "Editar Circuito " + id;
            
            // CORREÇÃO: Verifica se os elementos do modal existem antes de atribuir valor
            const fields = {
                'modalNomeCircuito': `nomeCircuito-${id}`,
                'modalTipoCircuito': `tipoCircuito-${id}`,
                'modalPotenciaW': `potenciaW-${id}`,
                'modalFatorDemanda': `fatorDemanda-${id}`,
                'modalFases': `fases-${id}`,
                'modalTensaoV': `tensaoV-${id}`,
                'modalComprimentoM': `comprimentoM-${id}`,
                'modalTipoIsolacao': `tipoIsolacao-${id}`,
                'modalAgrupamento': `numCircuitosAgrupados-${id}`
            };

            Object.keys(fields).forEach(modalId => {
                const modalEl = document.getElementById(modalId);
                const sourceEl = document.getElementById(fields[modalId]);
                if (modalEl && sourceEl) modalEl.value = sourceEl.value;
            });
            
            const drModal = document.getElementById('modalRequerDR');
            const drSource = document.getElementById(`requerDR-${id}`);
            if (drModal && drSource) drModal.checked = drSource.checked;

            openModal('addCircuitModalOverlay');
        }
        if (target.classList.contains('remove-circuit-btn')) { if (confirm("Remover Circuito?")) { circuitBlock.remove(); updateFeederPowerDisplay(); } }
    }
}

export function resetForm(addDefault = true, client = null) {
    document.getElementById('qdc-container').innerHTML = '';
    circuitCount = 0; qdcCount = 0;
    if (client) document.getElementById('clientLinkDisplay').textContent = `Cliente: ${client.nome}`;
    if (addDefault) addQdcBlock();
    updateFeederPowerDisplay();
}

export function populateProjectList(projects) {
    const select = document.getElementById('savedProjectsSelect');
    if(!select) return;
    select.innerHTML = '<option value="">-- Selecione uma obra --</option>';
    if (projects && Array.isArray(projects)) {
        projects.forEach(p => {
            const o = document.createElement('option'); o.value = p.id;
            o.textContent = `${p.project_code ?? 'S/C'} - ${p.project_name ?? 'Obra sem nome'}`;
            select.appendChild(o);
        });
    }
}