// Arquivo: ui.js (v4.3 - VERSÃO FINAL COMPLETA SEM ABREVIAÇÕES)

console.log("--- ui.js: Iniciando carregamento ---");

import { ligacoes, BTU_TO_WATTS_FACTOR, CV_TO_WATTS_FACTOR } from './utils.js';
import { debounce } from './utils.js';

let circuitCount = 0;
let qdcCount = 0;
let uiData = null;
let tempOptions = { pvc: [], epr: [] };
export let loadedProjectData = null; 

// Define os dados vindos do banco para permitir o cálculo de QDCs não renderizados
export function setLoadedProjectData(projectData) {
    loadedProjectData = projectData;
}

export function setupDynamicData(data) {
    uiData = data;
    if (uiData?.fatores_k1 && Array.isArray(uiData.fatores_k1)) {
        tempOptions.pvc = uiData.fatores_k1
            .filter(f => f && typeof f.fator === 'number' && f.fator > 0)
            .map(f => f.temperatura_c)
            .sort((a, b) => a - b);
    } 
    if (!tempOptions.pvc.includes(30)) tempOptions.pvc.push(30);
    tempOptions.pvc = [...new Set(tempOptions.pvc)].sort((a,b) => a - b);

    if (uiData?.fatores_k1_epr && Array.isArray(uiData.fatores_k1_epr)) {
        tempOptions.epr = uiData.fatores_k1_epr
            .filter(f => f && typeof f.fator === 'number' && f.fator > 0)
            .map(f => f.temperatura_c)
            .sort((a, b) => a - b);
    } 
    if (tempOptions.epr.length === 0) tempOptions.epr = tempOptions.pvc.length > 0 ? [...tempOptions.pvc] : [30];
    tempOptions.epr = [...new Set(tempOptions.epr)].sort((a,b) => a - b);
}

function populateTemperatureDropdown(selectElement, temperatures) {
    if (!selectElement) return;
    const currentValue = selectElement.value;
    selectElement.innerHTML = '';
    const validTemps = [...new Set(temperatures)].sort((a,b)=> a-b);
    validTemps.forEach(temp => {
        const option = document.createElement('option');
        option.value = temp;
        option.textContent = `${temp}°C`;
        selectElement.appendChild(option);
    });
    if (validTemps.map(String).includes(currentValue)) selectElement.value = currentValue;
    else selectElement.value = validTemps.includes(30) ? '30' : validTemps[0];
}

// --- VISIBILIDADE E MODAIS ---
export function showLoginView() { 
    document.getElementById('loginContainer').style.display = 'block'; 
    document.getElementById('appContainer').style.display = 'none'; 
    document.getElementById('resetPasswordContainer').style.display = 'none'; 
}

export function showAppView(userProfile) { 
    document.getElementById('loginContainer').style.display = 'none'; 
    document.getElementById('appContainer').style.display = 'block'; 
    const isAdmin = userProfile?.is_admin || false; 
    document.getElementById('adminPanelBtn').style.display = isAdmin ? 'block' : 'none';
}

export function openModal(modalId) {
    if (modalId === 'qdcManagerModalOverlay') populateQdcManagerModal();
    const modal = document.getElementById(modalId);
    if(modal) modal.style.display = 'flex';
}

export function closeModal(modalId) { 
    const modal = document.getElementById(modalId); 
    if(modal) modal.style.display = 'none'; 
}

// --- LÓGICA DE CÁLCULO HIERÁRQUICO (RESOLVE O PROBLEMA DO LAZY LOADING) ---
function _internal_updateFeederPowerDisplay() {
    const qdcData = {};
    const qdcBlocks = document.querySelectorAll('#qdc-container .qdc-block');

    qdcBlocks.forEach(qdcBlock => {
        const qdcId = qdcBlock.dataset.id;
        let installedDirect = 0;
        let demandedDirect = 0;

        // Se o QDC está aberto, lê os dados da interface
        if (qdcBlock.dataset.circuitsLoaded === 'true') {
            qdcBlock.querySelectorAll('.circuit-block').forEach(ckt => {
                const id = ckt.dataset.id;
                const w = parseFloat(document.getElementById(`potenciaW-${id}`)?.value) || 0;
                const fd = (parseFloat(document.getElementById(`fatorDemanda-${id}`)?.value) || 100) / 100.0;
                installedDirect += w;
                demandedDirect += (w * fd);
            });
        } else {
            // Se está fechado, busca na memória do projeto carregado
            const savedQdc = loadedProjectData?.qdcs_data?.find(q => String(q.id) === String(qdcId));
            savedQdc?.circuits?.forEach(c => {
                const w = parseFloat(c[`potenciaW-${c.id}`]) || 0;
                const fd = (parseFloat(c[`fatorDemanda-${c.id}`]) || 100) / 100.0;
                installedDirect += w;
                demandedDirect += (w * fd);
            });
        }
        
        const pId = document.getElementById(`qdcParent-${qdcId}`)?.value || 'feeder';
        qdcData[qdcId] = { installedDirect, demandedDirect, parentId: pId, childrenIds: [], aggregatedInstalled: -1, aggregatedDemand: -1 };
        
        if(document.getElementById(`qdcPotenciaInstalada-${qdcId}`)) document.getElementById(`qdcPotenciaInstalada-${qdcId}`).value = installedDirect.toFixed(2);
        if(document.getElementById(`qdcDemandaPropria-${qdcId}`)) document.getElementById(`qdcDemandaPropria-${qdcId}`).value = demandedDirect.toFixed(2);
    });

    // Mapeamento de filhos para pais
    Object.keys(qdcData).forEach(id => {
        const pId = qdcData[id].parentId;
        if (pId !== 'feeder') {
            const pKey = pId.replace('qdc-', '');
            if (qdcData[pKey]) qdcData[pKey].childrenIds.push(id);
        }
    });

    const visited = new Set();
    function calcAggregated(id) {
        if (!qdcData[id] || visited.has(id)) return { i: 0 };
        visited.add(id);
        let inst = qdcData[id].installedDirect;
        qdcData[id].childrenIds.forEach(cid => { inst += calcAggregated(cid).i; });
        qdcData[id].aggregatedInstalled = inst;
        const fd = (parseFloat(document.getElementById(`qdcFatorDemanda-${id}`)?.value) || 100) / 100.0;
        qdcData[id].aggregatedDemand = inst * fd;
        visited.delete(id);
        return { i: inst, d: qdcData[id].aggregatedDemand };
    }

    let totalD = 0; let totalI = 0;
    Object.keys(qdcData).forEach(id => {
        const res = calcAggregated(id);
        if(document.getElementById(`qdcPotenciaDemandada-${id}`)) document.getElementById(`qdcPotenciaDemandada-${id}`).value = qdcData[id].aggregatedDemand.toFixed(2);
        if (qdcData[id].parentId === 'feeder') { totalD += qdcData[id].aggregatedDemand; totalI += qdcData[id].aggregatedInstalled; }
    });

    if(document.getElementById('feederPotenciaInstalada')) document.getElementById('feederPotenciaInstalada').value = totalI.toFixed(2);
    if(document.getElementById('feederSomaPotenciaDemandada')) document.getElementById('feederSomaPotenciaDemandada').value = totalD.toFixed(2);
    const gFD = (parseFloat(document.getElementById('feederFatorDemanda')?.value) || 100) / 100.0;
    if(document.getElementById('feederPotenciaDemandada')) document.getElementById('feederPotenciaDemandada').value = (totalD * gFD).toFixed(2);
}
export const updateFeederPowerDisplay = debounce(_internal_updateFeederPowerDisplay, 350);

// --- CONSTRUÇÃO DE INTERFACE (QDC E CIRCUITOS) ---
export function addQdcBlock(id = null, name = null, parentId = 'feeder', container = null) {
    const isNew = !id;
    let internalId = id ? String(id) : String(++qdcCount);
    if(id) qdcCount = Math.max(qdcCount, parseInt(id));

    const div = document.createElement('div');
    div.innerHTML = getQdcHTML(internalId, name || `QDC ${internalId}`, parentId);
    const el = div.firstElementChild;
    const target = container instanceof DocumentFragment ? container : document.getElementById('qdc-container');
    target.appendChild(el);

    if (!(container instanceof DocumentFragment)) {
        updateQdcParentDropdowns();
        initializeQdcListeners(internalId);
        if (isNew) {
            addCircuit(internalId);
            el.classList.remove('collapsed'); el.dataset.circuitsLoaded = 'true';
            el.querySelector('.toggle-circuits-btn').textContent = 'Ocultar Circuitos';
        }
        updateFeederPowerDisplay();
    }
    return internalId;
}

function getQdcHTML(id, name, parentId) {
    return `
    <div class="qdc-block collapsed" id="qdc-${id}" data-id="${id}" data-circuits-loaded="false">
        <div class="qdc-header">
            <div class="form-group"><label>Nome do Quadro</label><input type="text" id="qdcName-${id}" value="${name}" class="qdc-name-input"></div>
            <div class="form-group"><label>Alimentado por</label><select id="qdcParent-${id}" class="qdc-parent-select" data-initial-parent="${parentId}"></select></div>
            <div class="qdc-header-right">
                <button type="button" class="toggle-circuits-btn btn-grey">Exibir Circuitos</button>
                <button type="button" class="add-circuit-to-qdc-btn btn-green">+ Ckt</button>
                <button type="button" class="remove-qdc-btn btn-red">Remover QDC</button>
            </div>
        </div>
        <div class="qdc-content">
            <div class="form-grid-3-col">
                <div class="form-group"><label>P. Instalada</label><input type="text" id="qdcPotenciaInstalada-${id}" readonly></div>
                <div class="form-group"><label>Demanda Total</label><input type="text" id="qdcPotenciaDemandada-${id}" readonly style="color:green; font-weight:bold;"></div>
                <div class="form-group"><label>FD (%)</label><input type="number" id="qdcFatorDemanda-${id}" value="100"></div>
            </div>
            <div id="circuits-for-qdc-${id}" class="circuits-container-internal"><p class="circuits-loading-placeholder" style="display:none;">Carregando circuitos...</p></div>
        </div>
    </div>`;
}

export function addCircuit(qdcId, saved = null, container = null) {
    let id = saved?.id ? parseInt(saved.id) : ++circuitCount;
    if(saved?.id) circuitCount = Math.max(circuitCount, id);

    const div = document.createElement('div');
    div.innerHTML = getCircuitHTML(id);
    const el = div.firstElementChild;
    const target = container instanceof DocumentFragment ? container : document.getElementById(`circuits-for-qdc-${qdcId}`);
    target.appendChild(el);

    if (saved) {
        Object.keys(saved).forEach(k => {
            let inp = el.querySelector(`#${k}`) || el.querySelector(`#${k}-${id}`);
            if (inp) { if (inp.type === 'checkbox') inp.checked = saved[k]; else inp.value = saved[k]; }
        });
    }
    if (!(container instanceof DocumentFragment)) updateFeederPowerDisplay();
}

function getCircuitHTML(id) {
    return `
    <div class="circuit-block collapsed" id="circuit-${id}" data-id="${id}">
        <div class="circuit-header"><span>Circuito ${id}</span><div class="circuit-header-right"><button type="button" class="remove-circuit-btn btn-red">Excluir</button><span>▼</span></div></div>
        <div class="circuit-content">
            <div class="form-grid">
                <div class="form-group"><label>Potência (W)</label><input type="number" id="potenciaW-${id}" value="1200"></div>
                <div class="form-group"><label>FD (%)</label><input type="number" id="fatorDemanda-${id}" value="100"></div>
            </div>
        </div>
    </div>`;
}

// --- GESTÃO DE USUÁRIOS E ADMIN ---
export function populateUsersPanel(users) {
    const list = document.getElementById('adminUserList'); if (!list) return;
    list.innerHTML = '';
    users.forEach(user => {
        const li = document.createElement('li');
        const blockBtn = user.is_blocked ? 'Desbloquear' : 'Bloquear';
        li.innerHTML = `
            <span><strong>${user.nome || 'Sem Nome'}</strong> (${user.email})</span>
            <div class="admin-user-actions">
                ${!user.is_approved ? `<button class="btn-green approve-user-btn" data-user-id="${user.id}">Aprovar</button>` : ''}
                <button class="btn-blue-dark edit-user-btn" data-user-id="${user.id}">Editar</button>
                <button class="btn-orange block-user-btn" data-user-id="${user.id}" data-is-blocked="${user.is_blocked}">${blockBtn}</button>
                <button class="btn-red remove-user-btn" data-user-id="${user.id}">Excluir</button>
            </div>`;
        list.appendChild(li);
    });
}

export function populateEditUserModal(user) {
    document.getElementById('editUserId').value = user.id;
    document.getElementById('editNome').value = user.nome || '';
    document.getElementById('editEmail').value = user.email || '';
    document.getElementById('editCpf').value = user.cpf || '';
    document.getElementById('editTelefone').value = user.telefone || '';
    document.getElementById('editCrea').value = user.crea || '';
    openModal('editUserModalOverlay');
}

// --- GESTÃO DE CLIENTES ---
export function populateClientManagementModal(clients) {
    const list = document.getElementById('clientList'); if (!list) return;
    list.innerHTML = '';
    clients.forEach(c => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span><strong>${c.nome}</strong></span>
            <div class="client-actions">
                <button class="btn-blue-dark edit-client-btn" data-client-id="${c.id}">Editar</button>
                <button class="btn-red delete-client-btn" data-client-id="${c.id}">Excluir</button>
            </div>`;
        list.appendChild(li);
    });
}

// --- FUNÇÕES DE SUPORTE TÉCNICO ---
function updateQdcParentDropdowns() {
    const qdcs = document.querySelectorAll('#qdc-container .qdc-block');
    const options = [{ value: 'feeder', text: 'Alimentador Geral' }];
    qdcs.forEach(q => {
        const id = q.dataset.id;
        const name = document.getElementById(`qdcName-${id}`)?.value || `QDC ${id}`;
        options.push({ value: `qdc-${id}`, text: name });
    });
    document.querySelectorAll('.qdc-parent-select').forEach(select => {
        const myId = select.closest('.qdc-block')?.dataset.id;
        const current = select.value;
        select.innerHTML = '';
        options.forEach(opt => {
            if (`qdc-${myId}` !== opt.value) {
                const o = document.createElement('option');
                o.value = opt.value; o.textContent = opt.text;
                select.appendChild(o);
            }
        });
        select.value = current || 'feeder';
    });
}

function initializeQdcListeners(id) {
    const fases = document.getElementById(`qdcFases-${id}`);
    const isolacao = document.getElementById(`qdcTipoIsolacao-${id}`);
    if(fases) fases.addEventListener('change', () => updateFeederPowerDisplay());
    if(isolacao) isolacao.addEventListener('change', () => {
        const temp = document.getElementById(`qdcTemperaturaAmbienteC-${id}`);
        populateTemperatureDropdown(temp, isolacao.value === 'PVC' ? tempOptions.pvc : tempOptions.epr);
    });
}

export function handleMainContainerInteraction(event) {
    const target = event.target;
    const qdcBlock = target.closest('.qdc-block');
    if (qdcBlock) {
        const qid = qdcBlock.dataset.id;
        if (target.classList.contains('toggle-circuits-btn')) {
            const isC = qdcBlock.classList.toggle('collapsed');
            target.textContent = isC ? 'Exibir Circuitos' : 'Ocultar Circuitos';
            if(!isC) ensureCircuitsLoaded(qdcBlock, qid);
        }
        if (target.classList.contains('remove-qdc-btn')) {
            if(confirm("Excluir quadro?")) { qdcBlock.remove(); updateFeederPowerDisplay(); }
        }
    }
    if (target.closest('.remove-circuit-btn')) {
        target.closest('.circuit-block').remove(); updateFeederPowerDisplay();
    }
}

async function ensureCircuitsLoaded(qdcB, qid) {
    if (qdcB.dataset.circuitsLoaded === 'true') return;
    qdcB.dataset.circuitsLoaded = 'true';
    const circuits = loadedProjectData?.qdcs_data?.find(q => String(q.id) === String(qid))?.circuits;
    if (circuits) {
        const frag = document.createDocumentFragment();
        circuits.forEach(c => addCircuit(qid, c, frag));
        document.getElementById(`circuits-for-qdc-${qid}`).appendChild(frag);
        updateFeederPowerDisplay();
    }
}

function populateQdcManagerModal() {
    const container = document.getElementById('qdcTreeContainer'); if(!container) return;
    const blocks = document.querySelectorAll('#qdc-container .qdc-block');
    container.innerHTML = Array.from(blocks).map(b => `<li>${document.getElementById(`qdcName-${b.dataset.id}`).value}</li>`).join('');
}

console.log("--- ui.js: Fim do arquivo ---");