// Arquivo: ui.js (v4 - Cards Estáticos e Edição via Modal)
import { ligacoes, BTU_TO_WATTS_FACTOR, CV_TO_WATTS_FACTOR } from './utils.js';
import { debounce } from './utils.js';

export let circuitCount = 0;
let qdcCount = 0;
let uiData = null;
let tempOptions = { pvc: [], epr: [] };
export let loadedProjectData = null;

export function setLoadedProjectData(projectData) {
    loadedProjectData = projectData;
}

export function setupDynamicData(data) {
    uiData = data;
    if (uiData?.fatores_k1 && Array.isArray(uiData.fatores_k1)) {
        tempOptions.pvc = uiData.fatores_k1.filter(f => f && typeof f.fator === 'number' && f.fator > 0 && typeof f.temperatura_c === 'number').map(f => f.temperatura_c).sort((a, b) => a - b);
    }
    if (!tempOptions.pvc.includes(30)) tempOptions.pvc.push(30);
    tempOptions.pvc = [...new Set(tempOptions.pvc)].sort((a,b) => a - b);

    if (uiData?.fatores_k1_epr && Array.isArray(uiData.fatores_k1_epr)) {
        tempOptions.epr = uiData.fatores_k1_epr.filter(f => f && typeof f.fator === 'number' && f.fator > 0 && typeof f.temperatura_c === 'number').map(f => f.temperatura_c).sort((a, b) => a - b);
    }
    if (tempOptions.epr.length === 0) tempOptions.epr = tempOptions.pvc.length > 0 ? [...tempOptions.pvc] : [30];
    tempOptions.epr = [...new Set(tempOptions.epr)].sort((a,b) => a - b);
}

// --- FUNÇÕES DE VISIBILIDADE ---
export function showLoginView() { document.getElementById('loginContainer').style.display = 'block'; document.getElementById('appContainer').style.display = 'none'; document.getElementById('resetPasswordContainer').style.display = 'none'; }
export function showAppView(userProfile) { document.getElementById('loginContainer').style.display = 'none'; document.getElementById('appContainer').style.display = 'block'; document.getElementById('resetPasswordContainer').style.display = 'none'; const isAdmin = userProfile?.is_admin || false; document.getElementById('adminPanelBtn').style.display = isAdmin ? 'block' : 'none'; }
export function showResetPasswordView() { document.getElementById('loginContainer').style.display = 'none'; document.getElementById('appContainer').style.display = 'none'; document.getElementById('resetPasswordContainer').style.display = 'block'; }

export function openModal(modalId) { const modal = document.getElementById(modalId); if(modal) modal.style.display = 'flex'; }
export function closeModal(modalId) { const modal = document.getElementById(modalId); if(modal) modal.style.display = 'none'; }

// --- ATUALIZAÇÃO HIERÁRQUICA DE CARGA (Mantida integralmente) ---
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
            const potenciaW = parseFloat(circuitBlock.querySelector(`#potenciaW-${id}`).value) || 0;
            const fatorDemanda = (parseFloat(circuitBlock.querySelector(`#fatorDemanda-${id}`).value) || 100) / 100.0;
            installedDirect += potenciaW;
            demandedDirect += (potenciaW * fatorDemanda);
        });
        
        const parentId = qdcBlock.querySelector(`#qdcParent-${qdcId}`)?.value || 'feeder';
        qdcData[qdcId] = { installedDirect, demandedDirect, parentId, childrenIds: [], aggregatedInstalled: -1, aggregatedDemand: -1 };
        document.getElementById(`qdcPotenciaInstalada-${qdcId}`).value = installedDirect.toFixed(2);
        document.getElementById(`qdcDemandaPropria-${qdcId}`).value = demandedDirect.toFixed(2);
    });

    Object.keys(qdcData).forEach(id => {
        const p = qdcData[id].parentId;
        if (p !== 'feeder') {
            const pk = p.replace('qdc-', '');
            if (qdcData[pk]) qdcData[pk].childrenIds.push(id);
        }
    });

    function calcInstalled(id) {
        if (qdcData[id].aggregatedInstalled !== -1) return qdcData[id].aggregatedInstalled;
        let sum = qdcData[id].installedDirect;
        qdcData[id].childrenIds.forEach(cid => sum += calcInstalled(cid));
        qdcData[id].aggregatedInstalled = sum;
        return sum;
    }

    Object.keys(qdcData).forEach(id => {
        const aggInst = calcInstalled(id);
        const fd = (parseFloat(document.getElementById(`qdcFatorDemanda-${id}`)?.value) || 100) / 100.0;
        const aggDem = aggInst * fd;
        document.getElementById(`qdcPotenciaDemandada-${id}`).value = aggDem.toFixed(2);
        if (qdcData[id].parentId === 'feeder') {
            totalDemandAggregatedGeneral += aggDem;
            totalInstalledAggregatedGeneral += aggInst;
        }
    });

    document.getElementById('feederPotenciaInstalada').value = totalInstalledAggregatedGeneral.toFixed(2);
    document.getElementById('feederSomaPotenciaDemandada').value = totalDemandAggregatedGeneral.toFixed(2);
    const gfd = (parseFloat(document.getElementById('feederFatorDemanda')?.value) || 100) / 100.0;
    document.getElementById('feederPotenciaDemandada').value = (totalDemandAggregatedGeneral * gfd).toFixed(2);
}
export const updateFeederPowerDisplay = debounce(_internal_updateFeederPowerDisplay, 350);

// --- COMPONENTES QDC ---
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
                 <div class="form-group"><label>Demandada (Própria)</label><input type="text" id="qdcDemandaPropria-${internalId}" readonly></div>
                 <div class="form-group"><label>Demandada (Agregada)</label><input type="text" id="qdcPotenciaDemandada-${internalId}" readonly></div>
            </div>
            <div class="hidden-qdc-config" style="display:none;">
                 <input type="number" id="qdcFatorDemanda-${internalId}" value="100">
                 <select id="qdcFases-${internalId}"><option value="Trifasico">Trifásico</option></select>
            </div>
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
    document.querySelectorAll('#qdc-container .qdc-block').forEach(qdc => {
        const id = qdc.dataset.id;
        options.push({ value: `qdc-${id}`, text: document.getElementById(`qdcName-${id}`).value });
    });
    document.querySelectorAll('.qdc-parent-select').forEach(select => {
        const currentId = select.closest('.qdc-block').dataset.id;
        const initial = select.dataset.initialParent || select.value;
        select.innerHTML = '';
        options.forEach(opt => { if (`qdc-${currentId}` !== opt.value) {
            const o = document.createElement('option'); o.value = opt.value; o.textContent = opt.text; select.appendChild(o);
        }});
        select.value = initial;
    });
}

// --- CIRCUITO COMO CARD ESTÁTICO ---
function getCircuitHTML(id) {
    return `
    <div class="circuit-block static-card" id="circuit-${id}" data-id="${id}">
        <div class="circuit-header no-toggle" style="cursor: default;">
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

// --- INTERAÇÃO E EVENTOS ---
export function handleMainContainerInteraction(event) {
    const target = event.target;
    const qdcBlock = target.closest('.qdc-block');
    const circuitBlock = target.closest('.circuit-block');

    if (qdcBlock && event.type === 'click') {
        if (target.closest('.add-circuit-to-qdc-btn')) {
            document.getElementById('targetQdcId').value = qdcBlock.dataset.id;
            document.getElementById('targetQdcName').textContent = document.getElementById(`qdcName-${qdcBlock.dataset.id}`).value;
            document.getElementById('editingCircuitId').value = "";
            document.getElementById('modalTitle').textContent = "Novo Circuito";
            document.getElementById('modalCircuitForm').reset();
            openModal('addCircuitModalOverlay');
        }
        if (target.closest('.remove-qdc-btn')) { if (confirm("Remover QDC?")) { qdcBlock.remove(); updateQdcParentDropdowns(); updateFeederPowerDisplay(); } }
    }

    if (circuitBlock && event.type === 'click') {
        const id = circuitBlock.dataset.id;
        if (target.closest('.edit-circuit-btn')) {
            document.getElementById('editingCircuitId').value = id;
            document.getElementById('targetQdcId').value = qdcBlock.dataset.id;
            document.getElementById('modalTitle').textContent = "Editar Circuito " + id;
            // Preenche modal com dados do card
            document.getElementById('modalNomeCircuito').value = document.getElementById(`nomeCircuito-${id}`).value;
            document.getElementById('modalTipoCircuito').value = document.getElementById(`tipoCircuito-${id}`).value;
            document.getElementById('modalPotenciaW').value = document.getElementById(`potenciaW-${id}`).value;
            document.getElementById('modalFatorDemanda').value = document.getElementById(`fatorDemanda-${id}`).value;
            document.getElementById('modalFases').value = document.getElementById(`fases-${id}`).value || 'Monofasico';
            document.getElementById('modalTensaoV').value = document.getElementById(`tensaoV-${id}`).value || '220';
            document.getElementById('modalComprimentoM').value = document.getElementById(`comprimentoM-${id}`).value || '20';
            document.getElementById('modalTipoIsolacao').value = document.getElementById(`tipoIsolacao-${id}`).value || 'PVC';
            document.getElementById('modalAgrupamento').value = document.getElementById(`numCircuitosAgrupados-${id}`).value || '1';
            document.getElementById('modalRequerDR').checked = document.getElementById(`requerDR-${id}`).checked;
            openModal('addCircuitModalOverlay');
        }
        if (target.closest('.remove-circuit-btn')) { if (confirm("Remover Circuito?")) { circuitBlock.remove(); updateFeederPowerDisplay(); } }
    }
}

export function resetForm(addDefault = true, client = null) {
    document.getElementById('qdc-container').innerHTML = '';
    circuitCount = 0; qdcCount = 0;
    if (client) document.getElementById('clientLinkDisplay').textContent = `Cliente: ${client.nome}`;
    if (addDefault) addQdcBlock();
    updateFeederPowerDisplay();
}

// Funções de popular (mantidas do seu arquivo original para não quebrar nada)
export function populateProjectList(projects) { const select = document.getElementById('savedProjectsSelect'); if(!select) return; select.innerHTML = '<option value="">-- Selecione uma obra --</option>'; if (projects && Array.isArray(projects)) { projects.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = `${p.project_code ?? 'S/C'} - ${p.project_name ?? 'Obra sem nome'}`; select.appendChild(o); }); } }