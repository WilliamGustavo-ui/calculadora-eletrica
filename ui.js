// Arquivo: ui.js (VERSÃO FINAL COM LÓGICA DE QDCs E PDFS COMPLETOS)

import { ligacoes, BTU_TO_WATTS_FACTOR, CV_TO_WATTS_FACTOR } from './utils.js';
import { Canvg } from 'https://cdn.skypack.dev/canvg';

let circuitCount = 0;
let qdcCount = 0;
let uiData = null;
let tempOptions = { pvc: [], epr: [] };

export function setupDynamicData(data) {
    uiData = data;
    if (uiData?.fatores_k1_temperatura) {
        tempOptions.pvc = uiData.fatores_k1_temperatura.filter(f => f.fator > 0).map(f => f.temperatura_c).sort((a, b) => a - b);
    }
    if (uiData?.fatores_k1_temperatura_epr) {
        tempOptions.epr = uiData.fatores_k1_temperatura_epr.filter(f => f.fator > 0).map(f => f.temperatura_c).sort((a, b) => a - b);
    } else {
        tempOptions.epr = tempOptions.pvc;
    }
}

function populateTemperatureDropdown(selectElement, temperatures) {
    const currentValue = selectElement.value;
    selectElement.innerHTML = '';
    temperatures.forEach(temp => {
        const option = document.createElement('option');
        option.value = temp;
        option.textContent = `${temp}°C`;
        selectElement.appendChild(option);
    });
    if (temperatures.includes(parseInt(currentValue))) {
        selectElement.value = currentValue;
    } else if (temperatures.includes(30)) {
        selectElement.value = '30';
    } else if (temperatures.length > 0) {
        selectElement.value = temperatures[0];
    }
}

function populateBtuDropdown(selectElement, btuData) {
    selectElement.innerHTML = '';
    if (!btuData) return;
    btuData.sort((a, b) => a.valor_btu - b.valor_btu).forEach(item => { const option = document.createElement('option'); option.value = item.valor_btu; option.textContent = item.descricao; selectElement.appendChild(option); });
}

function populateCvDropdown(selectElement, cvData) {
    selectElement.innerHTML = '';
    if (!cvData) return;
    cvData.sort((a, b) => a.valor_cv - b.valor_cv).forEach(item => { const option = document.createElement('option'); option.value = item.valor_cv; option.textContent = item.descricao; selectElement.appendChild(option); });
}

function populateSoilResistivityDropdown(selectElement, soilData) {
    selectElement.innerHTML = '<option value="0">Não Aplicável</option>';
    if (!soilData) return;
    soilData.sort((a, b) => a.resistividade - b.resistividade).forEach(item => { const option = document.createElement('option'); option.value = item.resistividade; option.textContent = `${item.resistividade}`; selectElement.appendChild(option); });
}

function updateFeederPowerDisplay() {
    let totalInstalada = 0;
    document.querySelectorAll('.circuit-block').forEach(block => {
        const id = block.dataset.id;
        if (document.getElementById(`potenciaW-${id}`)) {
            const potenciaW = parseFloat(document.getElementById(`potenciaW-${id}`).value) || 0;
            totalInstalada += potenciaW;
        }
    });
    document.getElementById('feederPotenciaInstalada').value = totalInstalada.toFixed(2);
    document.getElementById('feederPotenciaDemandada').value = 'Calculado no back-end';
}

// --- FUNÇÕES DE VISIBILIDADE E MODAIS ---
export function showLoginView() { document.getElementById('loginContainer').style.display = 'block'; document.getElementById('appContainer').style.display = 'none'; document.getElementById('resetPasswordContainer').style.display = 'none'; }
export function showAppView(userProfile) { document.getElementById('loginContainer').style.display = 'none'; document.getElementById('appContainer').style.display = 'block'; document.getElementById('resetPasswordContainer').style.display = 'none'; const isAdmin = userProfile?.is_admin || false; document.getElementById('adminPanelBtn').style.display = isAdmin ? 'block' : 'none'; document.getElementById('manageClientsBtn').style.display = 'block'; document.getElementById('manageProjectsBtn').style.display = 'block'; }
export function showResetPasswordView() { document.getElementById('loginContainer').style.display = 'none'; document.getElementById('appContainer').style.display = 'none'; document.getElementById('resetPasswordContainer').style.display = 'block'; }
export function openModal(modalId) { const modal = document.getElementById(modalId); if(modal) modal.style.display = 'flex'; }
export function closeModal(modalId) { const modal = document.getElementById(modalId); if(modal) modal.style.display = 'none'; }


// --- LÓGICA DE QDC ---
function getQdcHTML(id, name = `QDC ${id}`, parentId = 'feeder') {
    return `
    <div class="qdc-block" id="qdc-${id}" data-id="${id}">
        <div class="qdc-header">
            <div class="form-group qdc-header-left">
                <label for="qdcName-${id}">Nome do Quadro</label>
                <input type="text" id="qdcName-${id}" value="${name}" class="qdc-name-input">
            </div>
            <div class="form-group qdc-header-center">
                <label for="qdcParent-${id}">Alimentado por:</label>
                <select id="qdcParent-${id}" class="qdc-parent-select" data-initial-parent="${parentId}"></select>
            </div>
            <div class="qdc-header-right">
                <button type="button" class="add-circuit-to-qdc-btn btn-green" data-qdc-id="${id}">+ Circuito</button>
                <button type="button" class="remove-qdc-btn btn-red" data-qdc-id="${id}">Remover QDC</button>
                <span class="toggle-arrow">▼</span>
            </div>
        </div>
        <div class="qdc-content">
            <div id="circuits-for-qdc-${id}" class="circuits-container-internal">
                </div>
        </div>
    </div>`;
}

export function addQdcBlock(id = null, name = null, parentId = 'feeder') {
    const internalId = id || ++qdcCount;
    if (!id) qdcCount = Math.max(qdcCount, internalId);
    const qdcName = name || `QDC ${internalId}`;
    const newQdcDiv = document.createElement('div');
    newQdcDiv.innerHTML = getQdcHTML(internalId, qdcName, parentId);
    const qdcContainer = document.getElementById('qdc-container');
    qdcContainer.appendChild(newQdcDiv.firstElementChild);
    updateQdcParentDropdowns();
    return internalId;
}

export function removeQdc(qdcId) {
    const qdcBlock = document.getElementById(`qdc-${qdcId}`);
    if (qdcBlock && confirm(`Remover QDC "${qdcBlock.querySelector('.qdc-name-input').value}" e seus circuitos?`)) {
        qdcBlock.remove();
        updateQdcParentDropdowns();
    }
}

export function updateQdcParentDropdowns() {
    const allQdcs = document.querySelectorAll('.qdc-block');
    const options = ['<option value="feeder">Alimentador Geral</option>'];
    allQdcs.forEach(qdc => {
        const id = qdc.dataset.id;
        const name = document.getElementById(`qdcName-${id}`).value || `QDC ${id}`;
        options.push(`<option value="qdc-${id}">${name}</option>`);
    });

    allQdcs.forEach(qdc => {
        const id = qdc.dataset.id;
        const parentSelect = document.getElementById(`qdcParent-${id}`);
        const currentParent = parentSelect.dataset.initialParent || parentSelect.value;
        const filteredOptions = options.filter(opt => !opt.includes(`value="qdc-${id}"`));
        parentSelect.innerHTML = filteredOptions.join('');
        if (Array.from(parentSelect.options).some(option => option.value === currentParent)) { parentSelect.value = currentParent; }
        else { parentSelect.value = 'feeder'; }
        delete parentSelect.dataset.initialParent;
    });
}

// --- LÓGICA DE CIRCUITO ---
export function addCircuit(qdcId, savedCircuitData = null) {
    const internalId = savedCircuitData ? parseInt(savedCircuitData.id) : ++circuitCount;
    if (!savedCircuitData) circuitCount = Math.max(circuitCount, internalId);

    const newCircuitDiv = document.createElement('div');
    newCircuitDiv.innerHTML = getCircuitHTML(internalId);

    const circuitContainer = document.getElementById(`circuits-for-qdc-${qdcId}`);
    circuitContainer.appendChild(newCircuitDiv.firstElementChild);

    if (savedCircuitData) {
        Object.keys(savedCircuitData).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                if (element.type === 'checkbox') { element.checked = savedCircuitData[key]; }
                else { element.value = savedCircuitData[key]; }
            }
        });
        const nameInput = document.getElementById(`nomeCircuito-${internalId}`);
        if(nameInput && nameInput.value) { document.getElementById(`nomeCircuitoLabel-${internalId}`).textContent = nameInput.value; }
    }
    
    atualizarLigacoes(internalId);
    handleCircuitTypeChange(internalId);

    const potenciaBTUSelect = document.getElementById(`potenciaBTU-${internalId}`);
    const potenciaCVSelect = document.getElementById(`potenciaCV-${internalId}`);
    const resistividadeSolo = document.getElementById(`resistividadeSolo-${internalId}`);
    const temperaturaAmbiente = document.getElementById(`temperaturaAmbienteC-${internalId}`);
    
    if(uiData) {
        populateBtuDropdown(potenciaBTUSelect, uiData.ar_condicionado_btu);
        populateCvDropdown(potenciaCVSelect, uiData.motores_cv);
        populateSoilResistivityDropdown(resistividadeSolo, uiData.fatores_k2_solo);
        populateTemperatureDropdown(temperaturaAmbiente, tempOptions.pvc);
    }

     if (savedCircuitData) {
        if(savedCircuitData[`potenciaBTU-${internalId}`]) potenciaBTUSelect.value = savedCircuitData[`potenciaBTU-${internalId}`];
        if(savedCircuitData[`potenciaCV-${internalId}`]) potenciaCVSelect.value = savedCircuitData[`potenciaCV-${internalId}`];
        if(savedCircuitData[`resistividadeSolo-${internalId}`]) resistividadeSolo.value = savedCircuitData[`resistividadeSolo-${internalId}`];
        if(savedCircuitData[`temperaturaAmbienteC-${internalId}`]) temperaturaAmbiente.value = savedCircuitData[`temperaturaAmbienteC-${internalId}`];
        handleInsulationChange(internalId);
        if(savedCircuitData[`temperaturaAmbienteC-${internalId}`]) temperaturaAmbiente.value = savedCircuitData[`temperaturaAmbienteC-${internalId}`];
    }
}

export function removeCircuit(circuitId) {
    const circuitBlock = document.getElementById(`circuit-${circuitId}`);
    if (circuitBlock) { circuitBlock.remove(); updateFeederPowerDisplay(); }
}

function getCircuitHTML(id) {
    return `<div class="circuit-block" id="circuit-${id}" data-id="${id}"> <div class="circuit-header"> <h3 class="circuit-header-left">Circuito <span class="circuit-number"></span></h3> <h3 class="circuit-header-center" id="nomeCircuitoLabel-${id}">Circuito ${id}</h3> <div class="circuit-header-right"> <button type="button" class="remove-circuit-btn btn-red" data-circuit-id="${id}">Remover</button> <span class="toggle-arrow">▼</span> </div> </div> <div class="circuit-content"> <div class="form-grid"> <div class="form-group"> <label for="nomeCircuito-${id}">Nome do Circuito</label> <input type="text" id="nomeCircuito-${id}" value="Circuito ${id}"> </div> <div class="full-width potencia-group"> <div class="form-group"> <label for="tipoCircuito-${id}">Tipo de Circuito</label> <select id="tipoCircuito-${id}"> <option value="iluminacao">Iluminação</option> <option value="tug" selected>TUG</option> <option value="tue">TUE</option> <option value="aquecimento">Aquecimento</option> <option value="motores">Motores</option> <option value="ar_condicionado">Ar Condicionado</option> </select> </div> <div class="form-group hidden" id="potenciaBTU_group-${id}"> <label for="potenciaBTU-${id}">Potência (BTU/h)</label> <select id="potenciaBTU-${id}"></select> </div> <div class="form-group hidden" id="potenciaCV_group-${id}"> <label for="potenciaCV-${id}">Potência (CV)</label> <select id="potenciaCV-${id}"></select> </div> <div class="form-group"> <label for="potenciaW-${id}">Potência (W)</label> <input type="number" id="potenciaW-${id}" value="2500"> </div> </div> <div class="form-group"> <label for="fatorDemanda-${id}">Fator Demanda (%)</label> <input type="number" id="fatorDemanda-${id}" value="100" step="1"> </div> <div class="form-group"> <label for="fases-${id}">Fases</label> <select id="fases-${id}"> <option value="Monofasico" selected>Monofásico</option> <option value="Bifasico">Bifásico</option> <option value="Trifasico">Trifásico</option> </select> </div> <div class="form-group"> <label for="tipoLigacao-${id}">Ligação</label> <select id="tipoLigacao-${id}"></select> </div> <div class="form-group"> <label for="tensaoV-${id}">Tensão (V)</label> <select id="tensaoV-${id}"><option value="12">12</option><option value="24">24</option><option value="36">36</option><option value="127">127</option><option value="220" selected>220</option><option value="380">380</option><option value="440">440</option><option value="760">760</option></select> </div> <div class="form-group"> <label for="fatorPotencia-${id}">Fator Potência</label> <input type="number" id="fatorPotencia-${id}" step="0.01" value="0.92"> </div> <div class="form-group"> <label for="comprimentoM-${id}">Comprimento (m)</label> <input type="number" id="comprimentoM-${id}" value="20"> </div> <div class="form-group"> <label for="tipoIsolacao-${id}">Isolação</label> <select id="tipoIsolacao-${id}"><option value="PVC" selected>PVC 70°C</option><option value="EPR">EPR 90°C</option><option value="XLPE">XLPE 90°C</option></select> </div> <div class="form-group"> <label for="materialCabo-${id}">Condutor</label> <select id="materialCabo-${id}"><option value="Cobre" selected>Cobre</option><option value="Aluminio">Alumínio</option></select> </div> <div class="form-group"> <label for="metodoInstalacao-${id}">Instalação</label> <select id="metodoInstalacao-${id}"><option value="A1">A1</option><option value="A2">A2</option><option value="B1" selected>B1</option><option value="B2">B2</option><option value="C">C</option><option value="D">D</option></select> </div> <div class="form-group"> <label for="temperaturaAmbienteC-${id}">Temp. Ambiente</label> <select id="temperaturaAmbienteC-${id}"></select> </div> <div class="form-group"> <label for="resistividadeSolo-${id}">Resist. Solo</label> <select id="resistividadeSolo-${id}"></select> </div> <div class="form-group"> <label for="numCircuitosAgrupados-${id}">Ckt Agrupados</label> <select id="numCircuitosAgrupados-${id}"><option value="1" selected>1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option></select> </div> <div class="form-group"> <label for="limiteQuedaTensao-${id}">Limite DV (%)</label> <input type="number" id="limiteQuedaTensao-${id}" step="0.1" value="4.0"> </div> <div class="form-group"> <label for="tipoDisjuntor-${id}">Disjuntor</label> <select id="tipoDisjuntor-${id}"><option value="Minidisjuntor (DIN)">DIN</option><option value="Caixa Moldada (MCCB)">MCCB</option></select> </div> <div class="form-group"> <label for="dpsClasse-${id}">Classe DPS</label> <select id="dpsClasse-${id}"><option value="">Nenhum</option><option value="I">I</option><option value="II">II</option></select> </div> <div class="checkbox-group"> <input type="checkbox" id="requerDR-${id}"><label for="requerDR-${id}">Requer DR</label> </div> </div> </div> </div>`;
}

function initializeFeederListeners() {
    const fases = document.getElementById('feederFases');
    const tipoLigacao = document.getElementById('feederTipoLigacao');
    const tipoIsolacao = document.getElementById('feederTipoIsolacao');
    const temperaturaAmbiente = document.getElementById('feederTemperaturaAmbienteC');
    const resistividadeSolo = document.getElementById('feederResistividadeSolo');
    if (uiData) { populateSoilResistivityDropdown(resistividadeSolo, uiData.fatores_k2_solo); }
    const atualizarLigacoesFeeder = () => { const f = fases.value; const l = ligacoes[f] || []; tipoLigacao.innerHTML = ''; l.forEach(o => { const op = document.createElement('option'); op.value = o.value; op.textContent = o.text; tipoLigacao.appendChild(op); }); };
    const handleFeederInsulationChange = () => { const sel = tipoIsolacao.value; const t = (sel === 'EPR' || sel === 'XLPE') ? tempOptions.epr : tempOptions.pvc; populateTemperatureDropdown(temperaturaAmbiente, t); };
    fases.addEventListener('change', atualizarLigacoesFeeder);
    tipoIsolacao.addEventListener('change', handleFeederInsulationChange);
    atualizarLigacoesFeeder();
    handleFeederInsulationChange();
}

function handlePowerUnitChange(id, type) {
    const pW = document.getElementById(`potenciaW-${id}`);
    if (type === 'btu') { const btu = parseFloat(document.getElementById(`potenciaBTU-${id}`).value) || 0; pW.value = (btu * BTU_TO_WATTS_FACTOR).toFixed(2); }
    else { const cv = parseFloat(document.getElementById(`potenciaCV-${id}`).value) || 0; pW.value = (cv * CV_TO_WATTS_FACTOR).toFixed(2); }
    updateFeederPowerDisplay();
}

export function handleMainContainerInteraction(event) {
    const target = event.target;
    const qdcBlock = target.closest('.qdc-block');
    if (qdcBlock) {
        const qdcId = qdcBlock.dataset.id;
        if (target.classList.contains('add-circuit-to-qdc-btn')) { addCircuit(qdcId); }
        if (target.classList.contains('remove-qdc-btn')) { removeQdc(qdcId); }
        if (target.classList.contains('qdc-name-input') && event.type === 'input') { updateQdcParentDropdowns(); }
        const qdcHeader = target.closest('.qdc-header');
        if (qdcHeader && !target.closest('.qdc-header-right') && !target.closest('.qdc-header-left input') && !target.closest('.qdc-header-center select')) { qdcBlock.classList.toggle('collapsed'); }
    }
    const circuitBlock = target.closest('.circuit-block');
    if (circuitBlock) {
        const circuitId = circuitBlock.dataset.id;
        const circuitHeader = target.closest('.circuit-header');
        if (circuitHeader && !target.closest('.circuit-header-right')) { circuitBlock.classList.toggle('collapsed'); return; }
        if (target.id === `nomeCircuito-${circuitId}` && event.type === 'input') { document.getElementById(`nomeCircuitoLabel-${circuitId}`).textContent = target.value; }
        if (target.classList.contains('remove-circuit-btn')) { removeCircuit(circuitId); }
        else if (target.id === `tipoCircuito-${circuitId}`) { handleCircuitTypeChange(circuitId); }
        else if (target.id === `fases-${circuitId}`) { atualizarLigacoes(circuitId); }
        else if (target.id === `tipoIsolacao-${circuitId}`) { handleInsulationChange(circuitId); }
        else if (target.id === `potenciaBTU-${circuitId}` || target.id === `potenciaCV-${circuitId}`) { handlePowerUnitChange(circuitId, target.id.includes('BTU') ? 'btu' : 'cv'); }
        else if (target.id === `potenciaW-${circuitId}` || target.id === `fatorDemanda-${circuitId}`) { updateFeederPowerDisplay(); }
    }
}

function atualizarLigacoes(id) {
    const fases = document.getElementById(`fases-${id}`);
    const tipoLigacao = document.getElementById(`tipoLigacao-${id}`);
    const f = fases.value; const l = ligacoes[f] || []; tipoLigacao.innerHTML = ''; l.forEach(o => { const op = document.createElement('option'); op.value = o.value; op.textContent = o.text; tipoLigacao.appendChild(op); });
}

function handleInsulationChange(id) {
    const tipoIsolacao = document.getElementById(`tipoIsolacao-${id}`);
    const tempAmb = document.getElementById(`temperaturaAmbienteC-${id}`);
    const sel = tipoIsolacao.value; const t = (sel === 'EPR' || sel === 'XLPE') ? tempOptions.epr : tempOptions.pvc;
    populateTemperatureDropdown(tempAmb, t);
}

function handleCircuitTypeChange(id) {
    const tipo = document.getElementById(`tipoCircuito-${id}`); const fd = document.getElementById(`fatorDemanda-${id}`); const pw = document.getElementById(`potenciaW-${id}`); const btuG = document.getElementById(`potenciaBTU_group-${id}`); const cvG = document.getElementById(`potenciaCV_group-${id}`);
    const selType = tipo.value; btuG.classList.add('hidden'); cvG.classList.add('hidden'); pw.readOnly = false; fd.readOnly = false;
    if (selType === 'ar_condicionado') { btuG.classList.remove('hidden'); pw.readOnly = true; handlePowerUnitChange(id, 'btu'); }
    else if (selType === 'motores') { cvG.classList.remove('hidden'); pw.readOnly = true; handlePowerUnitChange(id, 'cv'); }
    else if (selType === 'aquecimento') { if (fd.value !== '100') { fd.value = '100'; } }
    updateFeederPowerDisplay();
}

// --- Funções de preenchimento de formulário ---
export function populateProjectList(projects) {
    const select = document.getElementById('savedProjectsSelect'); select.innerHTML = '<option value="">-- Selecione uma obra --</option>'; projects.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = `${p.project_code || 'S/C'} - ${p.project_name}`; select.appendChild(o); });
}
export function populateFormWithProjectData(project) {
    resetForm(false, project.client); // Reset without adding default QDC
    document.getElementById('currentProjectId').value = project.id;
    if (project.main_data) { Object.keys(project.main_data).forEach(id => { const el = document.getElementById(id); if (el) { el.value = project.main_data[id] || ''; } }); }
    document.getElementById('project_code').value = project.project_code || '';
    if (project.tech_data) { Object.keys(project.tech_data).forEach(id => { const el = document.getElementById(id); if (el) el.value = project.tech_data[id]; }); }
    if (project.feeder_data) { Object.keys(project.feeder_data).forEach(id => { const el = document.getElementById(id); if (el) { if (el.type === 'checkbox') el.checked = project.feeder_data[id]; else el.value = project.feeder_data[id]; } }); document.getElementById('feederFases').dispatchEvent(new Event('change')); document.getElementById('feederTipoLigacao').value = project.feeder_data['feederTipoLigacao']; }
    
    if (project.qdcs_data && Array.isArray(project.qdcs_data)) {
        project.qdcs_data.forEach((qdcData, index) => {
            const newQdcId = addQdcBlock(parseInt(qdcData.id), qdcData.name, qdcData.parentId); // Pass parentId
            if (qdcData.circuits && Array.isArray(qdcData.circuits)) {
                qdcData.circuits.forEach(circuitData => { addCircuit(newQdcId, circuitData); });
            }
            if (index > 0) { const qdcElem = document.getElementById(`qdc-${newQdcId}`); if(qdcElem) qdcElem.classList.add('collapsed'); }
        });
    } else { addQdcBlock(); } // Add default if none saved
    
    updateQdcParentDropdowns(); // Update dropdowns AFTER all QDCs are created
    updateFeederPowerDisplay();
}
export function populateUsersPanel(users) {
    const list = document.getElementById('adminUserList'); list.innerHTML = ''; if (!users || users.length === 0) { list.innerHTML = '<li>Nenhum usuário.</li>'; return; }
    users.forEach(u => { const li = document.createElement('li'); let act = '<div class="admin-user-actions">'; if (!u.is_approved) { act += `<button class="approve-user-btn btn-green" data-user-id="${u.id}">Aprovar</button>`; } else { act += u.is_blocked ? `<button class="block-user-btn btn-green" data-user-id="${u.id}" data-is-blocked="false">Desbloquear</button>` : `<button class="block-user-btn btn-block" data-user-id="${u.id}" data-is-blocked="true">Bloquear</button>`; } act += `<button class="edit-user-btn btn-edit" data-user-id="${u.id}">Editar</button><button class="remove-user-btn btn-red" data-user-id="${u.id}">Excluir</button></div>`; const st = u.is_blocked ? '<small style="color:var(--btn-red);">(Bloqueado)</small>' : ''; li.innerHTML = `<span><strong>${u.nome || u.email}</strong> ${st}<br><small>${u.email}</small></span>${act}`; list.appendChild(li); });
}
export function populateEditUserModal(d) { document.getElementById('editUserId').value = d.id; document.getElementById('editNome').value = d.nome || ''; document.getElementById('editEmail').value = d.email || ''; document.getElementById('editCpf').value = d.cpf || ''; document.getElementById('editTelefone').value = d.telefone || ''; document.getElementById('editCrea').value = d.crea || ''; openModal('editUserModalOverlay'); }
export function populateProjectsPanel(projects, clients, users, currentUserProfile) {
    const tb = document.getElementById('adminProjectsTableBody'); const th = document.querySelector('#adminProjectsTable thead tr'); const isAdmin = currentUserProfile?.is_admin || false; th.innerHTML = `<th>Cód</th><th>Obra</th><th>Dono</th><th>Cliente</th><th>Ações</th>`; tb.innerHTML = '';
    projects.forEach(p => { const r = document.createElement('tr'); const oN = p.owner?.nome || p.owner?.email || '?'; let aH = `<div class="action-cell">`; const cO = clients.map(c => `<option value="${c.id}" ${c.id === p.client_id ? 'selected' : ''}>${c.nome}</option>`).join(''); aH += `<div class="action-group"><label>Cli:</label><select class="transfer-client-select" data-project-id="${p.id}"><option value="">--</option>${cO}</select><button class="transfer-client-btn btn-green" data-project-id="${p.id}">Ok</button></div>`; if (isAdmin) { const ownO = users.map(u => `<option value="${u.id}" ${u.id === p.owner_id ? 'selected' : ''}>${u.nome || u.email}</option>`).join(''); aH += `<div class="action-group"><label>Dono:</label><select class="transfer-owner-select" data-project-id="${p.id}">${ownO}</select><button class="transfer-owner-btn btn-grey" data-project-id="${p.id}">Ok</button></div>`; } aH += `</div>`; r.innerHTML = `<td>${p.project_code || 'S/C'}</td><td>${p.project_name}</td><td>${oN}</td><td>${p.client?.nome || '-'}</td><td>${aH}</td>`; tb.appendChild(r); });
}
export function populateClientManagementModal(clients) {
    const list = document.getElementById('clientList'); list.innerHTML = ''; if (clients.length === 0) { list.innerHTML = '<li>Nenhum cliente.</li>'; return; }
    clients.forEach(c => { const hP = c.projects && c.projects.length > 0; const li = document.createElement('li'); li.innerHTML = `<span><strong>${c.nome}</strong> (${c.client_code || 'S/C'})<br><small>${c.documento_valor || '-'} - ${c.email || '-'}</small></span><div class="client-actions"><button class="edit-client-btn btn-edit" data-client-id="${c.id}">Edt</button><button class="delete-client-btn btn-red" data-client-id="${c.id}" ${hP ? 'disabled title="Cliente com obras"' : ''}>Exc</button></div>`; list.appendChild(li); });
}
export function resetClientForm() { const f = document.getElementById('clientForm'); f.reset(); document.getElementById('clientId').value = ''; document.getElementById('clientFormTitle').textContent = 'Novo Cliente'; document.getElementById('clientFormSubmitBtn').textContent = 'Salvar'; document.getElementById('clientFormCancelBtn').style.display = 'none'; }
export function openEditClientForm(c) { document.getElementById('clientId').value = c.id; document.getElementById('clientNome').value = c.nome; document.getElementById('clientDocumentoTipo').value = c.documento_tipo; document.getElementById('clientDocumentoValor').value = c.documento_valor; document.getElementById('clientEmail').value = c.email; document.getElementById('clientCelular').value = c.celular; document.getElementById('clientTelefone').value = c.telefone; document.getElementById('clientEndereco').value = c.endereco; document.getElementById('clientFormTitle').textContent = 'Editar Cliente'; document.getElementById('clientFormSubmitBtn').textContent = 'Atualizar'; document.getElementById('clientFormCancelBtn').style.display = 'inline-block'; }
export function populateSelectClientModal(clients, isChange = false) { const s = document.getElementById('clientSelectForNewProject'); s.innerHTML = '<option value="">-- Selecione --</option>'; clients.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = `${c.nome} (${c.client_code})`; o.dataset.client = JSON.stringify(c); s.appendChild(o); }); const t = document.querySelector('#selectClientModalOverlay h3'); const b = document.getElementById('confirmClientSelectionBtn'); if (isChange) { t.textContent = 'Vincular / Alterar Cliente'; b.textContent = 'Confirmar'; } else { t.textContent = 'Vincular Cliente'; b.textContent = 'Vincular'; } openModal('selectClientModalOverlay'); }

// --- FUNÇÕES DE GERAÇÃO DE PDF (Ainda precisam ser adaptadas para QDCs) ---
function getDpsText(dpsInfo) { if (!dpsInfo) return 'Não'; return `Sim, Classe ${dpsInfo.classe} (${dpsInfo.corrente_ka} kA)`; }
function drawHeader(x, y, projectData, totalPower) { const t = projectData.obra || "Diagrama"; const p = `(${totalPower.toFixed(2)} W)`; return `<g text-anchor="end"> <text x="${x}" y="${y}" style="font-family: Arial; font-size: 16px; font-weight: bold;">Q.D. ${t.toUpperCase()}</text> <text x="${x}" y="${y + 15}" style="font-family: Arial; font-size: 12px;">${p}</text> </g>`; }
function drawDisjuntor(x, y, text, fases = 'Monofasico') { let sP=''; switch(fases){ case 'Trifasico':sP=`<path d="M ${x-5} ${y-2} q 5 -10 10 0 M ${x-5} ${y+2} q 5 -10 10 0 M ${x-5} ${y+6} q 5 -10 10 0" stroke="black" stroke-width="1.5" fill="none"/>`;break; case 'Bifasico':sP=`<path d="M ${x-5} ${y} q 5 -10 10 0 M ${x-5} ${y+4} q 5 -10 10 0" stroke="black" stroke-width="1.5" fill="none"/>`;break; default:sP=`<path d="M ${x-5} ${y+2} q 5 -10 10 0" stroke="black" stroke-width="1.5" fill="none"/>`;break;} return `<g text-anchor="middle"> <circle cx="${x-12.5}" cy="${y}" r="1.5" fill="black"/> <circle cx="${x+12.5}" cy="${y}" r="1.5" fill="black"/> ${sP} <text x="${x}" y="${y-18}" style="font-family: Arial; font-size: 11px;">${text}</text> </g>`; }
function drawDR(x, y, text, fases = 'Monofasico') { const dC='#27ae60'; let iS=''; if(fases==='Trifasico'){iS=`<path d="M ${x-4} ${y-5} v 10 M ${x} ${y-5} v 10 M ${x+4} ${y-5} v 10 M ${x-4} ${y-5} h 8" stroke="${dC}" stroke-width="1" fill="none"/>`;} else {iS=`<path d="M ${x} ${y-5} v 10 M ${x-3} ${y-5} h 6" stroke="${dC}" stroke-width="1" fill="none"/>`;} return `<g text-anchor="middle"> <rect x="${x-12.5}" y="${y-12.5}" width="25" height="25" stroke="${dC}" stroke-width="1.5" fill="white"/> <text x="${x}" y="${y-18}" style="font-family: Arial; font-size: 10px; fill:${dC};">${text}</text> <text x="${x}" y="${y+4}" style="font-family: Arial; font-size: 11px; font-weight: bold; fill:${dC};">DR</text> ${iS} </g>`; }
function drawDPS(x, y, feederData) { const dC='#27ae60'; let n=feederData.fases==='Monofasico'?2:(feederData.fases==='Bifasico'?3:4); const dI=feederData.dpsInfo; const t=dI?`${n}x DPS Cl.${dI.classe} ${dI.corrente_ka}kA`:`${n}x DPS`; return `<g> <rect x="${x-45}" y="${y-12.5}" width="90" height="25" stroke="${dC}" stroke-width="1.5" fill="white"/> <text x="${x}" y="${y+4}" text-anchor="middle" style="font-family: Arial; font-size: 10px; fill:${dC};">${t}</text> <line x1="${x}" y1="${y+12.5}" x2="${x}" y2="${y+30}" stroke="black" stroke-width="1"/> ${drawGroundSymbol(x,y+30)} </g>`; }
function drawGroundSymbol(x, y) { return `<line x1="${x}" y1="${y}" x2="${x}" y2="${y+5}" stroke="black" stroke-width="1"/> <line x1="${x-8}" y1="${y+5}" x2="${x+8}" y2="${y+5}" stroke="black" stroke-width="1.5"/> <line x1="${x-5}" y1="${y+8}" x2="${x+5}" y2="${y+8}" stroke="black" stroke-width="1.5"/> <line x1="${x-2}" y1="${y+11}" x2="${x+2}" y2="${y+11}" stroke="black" stroke-width="1.5"/>`; }
function drawConductorSymbol(x, y, numConductors) { let p=''; for(let i=0;i<numConductors;i++){p+=` M ${x-5} ${y+5+(i*4)} l 10 -5`;} return `<path d="${p}" stroke="black" stroke-width="1" fill="none"/>`; }
function drawCircuitLine(result, x, y, index) { const {dados,calculos}=result; const yE=y+250; const fS=`font-family: Arial;`; return `<g text-anchor="middle"> ${drawDisjuntor(x,y,`${calculos.disjuntorRecomendado.nome}`,dados.fases)} <line x1="${x}" y1="${y+12.5}" x2="${x}" y2="${yE}" stroke="black" stroke-width="1"/> ${drawConductorSymbol(x,y+60,calculos.numCondutores)} <text x="${x}" y="${y+90}" style="${fS} font-size: 11px;">${calculos.bitolaRecomendadaMm2}</text> <text x="${x}" y="${yE+20}" style="${fS} font-size: 11px; font-weight: bold;">(${calculos.potenciaDemandada.toFixed(0)} W)</text> <text x="${x}" y="${yE+35}" style="${fS} font-size: 12px;">${index} - ${dados.nomeCircuito}</text> </g>`; }
function buildUnifilarSvgString(calculationResults) {
    if (!calculationResults || (!calculationResults.circuitResults && !calculationResults.qdcResults)) { return null; } // Adaptação inicial
    const { feederResult, circuitResults, qdcResults } = calculationResults; // Espera qdcResults
    
    // TEMPORÁRIO: Usa circuitResults se qdcResults não existir (compatibilidade)
    const allCircuits = circuitResults || qdcResults?.flatMap(q => q.circuitResults.map(c => c.result)) || [];
    if (!feederResult || allCircuits.length === 0) return null;

    const circuitsComDR = allCircuits.filter(c => c.dados.requerDR);
    const circuitsSemDR = allCircuits.filter(c => !c.dados.requerDR);
    const categorizedCircuits = {};
    circuitsComDR.forEach(c => { let tipo = c.dados.tipoCircuito; if (tipo === 'tue' && (c.dados.nomeCircuito.toLowerCase().includes('chuveiro') || c.calculos.potenciaDemandada > 4000)) { tipo = 'tue_potencia'; } if (!categorizedCircuits[tipo]) categorizedCircuits[tipo] = []; categorizedCircuits[tipo].push(c); });
    const finalGroups = [];
    const groupOrder = ['iluminacao', 'tug', 'tue', 'tue_potencia', 'ar_condicionado', 'motores', 'aquecimento'];
    groupOrder.forEach(category => { if (categorizedCircuits[category]) { const circuitsOfType = categorizedCircuits[category]; const chunkSize = (category === 'iluminacao') ? 8 : 5; for (let i = 0; i < circuitsOfType.length; i += chunkSize) { const chunk = circuitsOfType.slice(i, i + chunkSize); const isHighPower = chunk.some(c => c.calculos.potenciaDemandada >= 4000); const drCurrent = isHighPower ? '63A' : '40A'; finalGroups.push({ dr: { corrente: drCurrent, sensibilidade: '30mA' }, circuits: chunk }); } } });
    if (circuitsSemDR.length > 0) { finalGroups.push({ dr: null, circuits: circuitsSemDR }); }
    
    const yStart = 40, yBusbar = yStart + 150, circuitWidth = 100, marginLeft = 60, totalCircuits = allCircuits.length, svgWidth = (totalCircuits * circuitWidth) + marginLeft * 2, svgHeight = 600;
    let svgParts = [`<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">`];
    svgParts.push(drawHeader(svgWidth - 20, yStart, feederResult.dados, feederResult.calculos.potenciaDemandada));
    let currentX = marginLeft;
    svgParts.push(`<line x1="${currentX}" y1="${yStart}" x2="${currentX}" y2="${yBusbar - 50}" stroke="black" stroke-width="2"/>`);
    svgParts.push(drawDisjuntor(currentX, yBusbar - 50, `${feederResult.calculos.disjuntorRecomendado.nome}`, feederResult.dados.fases));
    svgParts.push(`<line x1="${currentX}" y1="${yBusbar - 37.5}" x2="${currentX}" y2="${yBusbar}" stroke="black" stroke-width="2"/>`);
    if (feederResult.dados.dpsClasse) { svgParts.push(`<line x1="${currentX}" y1="${yBusbar - 100}" x2="${currentX + 50}" y2="${yBusbar - 100}" stroke="black" stroke-width="1"/>`); svgParts.push(drawDPS(currentX + 95, yBusbar - 100, feederResult.dados)); }
    svgParts.push(drawGroundSymbol(marginLeft + (totalCircuits * circuitWidth) / 2, svgHeight - 40));
    const busbarStart = marginLeft, busbarEnd = busbarStart + totalCircuits * circuitWidth;
    svgParts.push(`<line x1="${busbarStart}" y1="${yBusbar}" x2="${busbarEnd}" y2="${yBusbar}" stroke="black" stroke-width="5"/>`);
    currentX += (circuitWidth / 2);
    let circuitIndex = 1;

    finalGroups.forEach(group => {
        const groupWidth = group.circuits.length * circuitWidth;
        const groupStartX = currentX - (circuitWidth/2);
        if (group.dr) {
            const isGroupTrifasico = group.circuits.some(c => c.dados.fases === 'Trifasico');
            const drFases = isGroupTrifasico ? 'Trifasico' : 'Monofasico';
            const drX = groupStartX + groupWidth / 2;
            svgParts.push(`<line x1="${drX}" y1="${yBusbar}" x2="${drX}" y2="${yBusbar + 40}" stroke="black" stroke-width="1"/>`);
            svgParts.push(`<circle cx="${drX}" cy="${yBusbar}" r="3" fill="black"/>`);
            svgParts.push(drawDR(drX, yBusbar + 40, `${group.dr.corrente}/${group.dr.sensibilidade}`, drFases));
            const subBusbarY = yBusbar + 65;
            svgParts.push(`<line x1="${groupStartX + circuitWidth/2}" y1="${subBusbarY}" x2="${groupStartX + groupWidth - circuitWidth/2}" y2="${subBusbarY}" stroke="black" stroke-width="3"/>`);
            svgParts.push(`<rect x="${groupStartX}" y="${yBusbar + 10}" width="${groupWidth}" height="350" fill="none" stroke="black" stroke-dasharray="5,5"/>`);
            group.circuits.forEach(result => { svgParts.push(`<line x1="${currentX}" y1="${subBusbarY}" x2="${currentX}" y2="${subBusbarY + 15}" stroke="black" stroke-width="1"/>`); svgParts.push(`<circle cx="${currentX}" cy="${subBusbarY}" r="3" fill="black"/>`); svgParts.push(drawCircuitLine(result, currentX, subBusbarY + 15, circuitIndex++)); currentX += circuitWidth; });
        } else {
            group.circuits.forEach(result => { svgParts.push(`<line x1="${currentX}" y1="${yBusbar}" x2="${currentX}" y2="${yBusbar + 15}" stroke="black" stroke-width="1"/>`); svgParts.push(`<circle cx="${currentX}" cy="${yBusbar}" r="3" fill="black"/>`); svgParts.push(drawCircuitLine(result, currentX, yBusbar + 15, circuitIndex++)); currentX += circuitWidth; });
        }
    });
    svgParts.push('</svg>');
    return svgParts.join('');
}
export async function generateUnifilarPdf(calculationResults) {
    // Esta função precisará de uma grande refatoração para desenhar múltiplos QDCs hierarquicamente.
    // Por enquanto, ela pode falhar ou desenhar incorretamente.
    alert("Geração de PDF Unifilar para múltiplos QDCs ainda não implementada.");

    // Código antigo mantido temporariamente (pode gerar erro ou resultado incorreto):
    const svgString = buildUnifilarSvgString(calculationResults);
    if (!svgString) { alert("Dados insuficientes para o diagrama."); return; }
    try {
        const { jsPDF } = window.jspdf; const doc = new jsPDF('l', 'mm', 'a3'); const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
        const svgElementForSize = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svgElementForSize.innerHTML = svgString; document.body.appendChild(svgElementForSize); const { width, height } = svgElementForSize.getBBox(); document.body.removeChild(svgElementForSize); canvas.width = width; canvas.height = height;
        const v = await Canvg.fromString(ctx, svgString); await v.render();
        const imgData = canvas.toDataURL('image/png'); const pdfW = doc.internal.pageSize.getWidth(); const pdfH = doc.internal.pageSize.getHeight(); const m = 10; let imgW = pdfW - (m * 2); let imgH = (height / width) * imgW; if (imgH > pdfH - (m*2)) { imgH = pdfH - (m*2); imgW = (width / height) * imgH; } let fY = m; if (imgH < (pdfH - (m * 2))) { fY = (pdfH - imgH) / 2; } let fX = (pdfW - imgW) / 2;
        doc.addImage(imgData, 'PNG', fX, fY, imgW, imgH);
        doc.save(`Unifilar_${document.getElementById('obra').value || 'Projeto'}.pdf`);
    } catch (e) { console.error("Erro PDF Unifilar:", e); alert("Erro ao gerar PDF."); }
}
export function generateMemorialPdf(calculationResults, currentUserProfile) {
    // Esta função também precisa ser adaptada para a hierarquia.
    alert("Geração de PDF do Memorial para múltiplos QDCs ainda não implementada.");

    // Código antigo mantido temporariamente:
    if (!calculationResults) { alert("Gere o cálculo primeiro."); return; }
    const { feederResult, circuitResults, qdcResults } = calculationResults; // Espera qdcResults
    const allCircuits = circuitResults || qdcResults?.flatMap(q => q.circuitResults.map(c => c.result)) || [];
    if (!feederResult || allCircuits.length === 0) { alert("Dados insuficientes."); return;}
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    let yPos = 20;
    const leftMargin = 15;
    const valueMargin = 75; 
    const addTitle = (title) => { doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.text(title, 105, yPos, { align: 'center' }); yPos += 12; };
    const addSection = (title) => { if (yPos > 260) { doc.addPage(); yPos = 20; } doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text(title, leftMargin, yPos); yPos += 8; };
    const addLineItem = (label, value) => { if (yPos > 270) { doc.addPage(); yPos = 20; } doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text(label, leftMargin, yPos); doc.setFont('helvetica', 'normal'); doc.text(String(value || '-'), valueMargin, yPos); yPos += 6; };
    addTitle("RELATÓRIO DE PROJETO ELÉTRICO");
    const reportData = feederResult.dados;
    addSection("DADOS DO CLIENTE");
    addLineItem("Cliente:", reportData.cliente);
    addLineItem(`Documento (${reportData.tipoDocumento}):`, reportData.documento);
    addLineItem("Celular:", reportData.celular);
    addLineItem("Telefone:", reportData.telefone);
    addLineItem("E-mail:", reportData.email);
    addLineItem("Endereço do Cliente:", reportData.enderecoCliente);
    yPos += 5;
    addSection("DADOS DA OBRA");
    addLineItem("Código da Obra:", reportData.projectCode);
    addLineItem("Nome da Obra:", reportData.obra);
    addLineItem("Cidade da Obra:", reportData.cidadeObra);
    addLineItem("Endereço da Obra:", reportData.enderecoObra);
    addLineItem("Área da Obra (m²):", reportData.areaObra);
    addLineItem("Unid. Residenciais:", reportData.unidadesResidenciais);
    addLineItem("Unid. Comerciais:", reportData.unidadesComerciais);
    addLineItem("Observações:", reportData.observacoes);
    yPos += 5;
    addSection("INFORMAÇÕES DO RESPONSÁVEL TÉCNICO");
    addLineItem("Nome:", document.getElementById('respTecnico').value);
    addLineItem("Título:", document.getElementById('titulo').value);
    addLineItem("CREA:", document.getElementById('crea').value);
    yPos += 5;
    addSection("INFORMAÇÕES DO RELATÓRIO");
    const dataFormatada = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    addLineItem("Gerado em:", dataFormatada);
    addLineItem("Gerado por:", currentUserProfile?.nome || 'N/A');
    yPos += 5;
    addSection("RESUMO DA ALIMENTAÇÃO GERAL");
    const feederBreakerType = feederResult.dados.tipoDisjuntor.includes('Caixa Moldada') ? 'MCCB' : 'DIN';
    const feederBreakerText = `${feederBreakerType} ${feederResult.calculos.disjuntorRecomendado.nome}`;
    const feederHead = [['Tensão/Fases', 'Disjuntor Geral', 'DR', 'DPS', 'Cabo (Isolação)', 'Eletroduto']];
    const feederBody = [[ `${feederResult.dados.tensaoV}V - ${feederResult.dados.fases}`, feederBreakerText, feederResult.dados.requerDR ? 'Sim' : 'Nao', getDpsText(feederResult.dados.dpsInfo), `${feederResult.calculos.bitolaRecomendadaMm2} mm² (${feederResult.dados.tipoIsolacao})`, feederResult.calculos.dutoRecomendado ]];
    doc.autoTable({ startY: yPos, head: feederHead, body: feederBody, theme: 'grid', headStyles: { fillColor: [44, 62, 80] }, styles: { fontSize: 8 } });
    yPos = doc.lastAutoTable.finalY + 10;
    if (circuitResults.length > 0) {
        addSection("RESUMO DOS CIRCUITOS");
        const head = [['Ckt', 'Nome', 'Disjuntor', 'DR', 'DPS', 'Cabo (Isolação)', 'Eletroduto']];
        const body = circuitResults.map((r, index) => {
            const circuitBreakerType = r.dados.tipoDisjuntor.includes('Caixa Moldada') ? 'MCCB' : 'DIN';
            const circuitBreakerText = `${circuitBreakerType} ${r.calculos.disjuntorRecomendado.nome}`;
            return [ index + 1, r.dados.nomeCircuito, circuitBreakerText, r.dados.requerDR ? 'Sim' : 'Nao', getDpsText(r.dados.dpsInfo), `${r.calculos.bitolaRecomendadaMm2} mm² (${r.dados.tipoIsolacao})`, r.calculos.dutoRecomendado ];
        });
        doc.autoTable({ startY: yPos, head: head, body: body, theme: 'grid', headStyles: { fillColor: [44, 62, 80] }, styles: { fontSize: 8 } });
    }
    const allCalculationsForMemorial = [feederResult, ...circuitResults];
    allCalculationsForMemorial.forEach((result, index) => {
        doc.addPage();
        yPos = 20;
        const { dados, calculos } = result;
        const potenciaDemandadaVA = dados.fatorPotencia > 0 ? (calculos.potenciaDemandada / dados.fatorPotencia).toFixed(2) : "0.00";
        const correnteCorrigidaTexto = isFinite(calculos.correnteCorrigidaA) ? `${calculos.correnteCorrigidaA.toFixed(2)} A` : "Incalculável";
        const title = dados.id === 'Geral' ? `MEMORIAL DE CÁLCULO - ALIMENTADOR GERAL` : `MEMORIAL DE CÁLCULO - CIRCUITO ${index}: ${dados.nomeCircuito}`;
        addTitle(title);
        addSection("-- PARÂMETROS DE ENTRADA --");
        if (dados.id !== 'Geral') { addLineItem("Tipo de Circuito:", dados.tipoCircuito); }
        addLineItem("Potência Instalada:", `${calculos.potenciaInstalada.toFixed(2)} W`);
        addLineItem("Fator de Demanda:", `${dados.fatorDemanda}%`);
        addLineItem("Potência Demandada:", `${potenciaDemandadaVA} VA`);
        addLineItem("Fator de Potência:", dados.fatorPotencia);
        addLineItem("Sistema de Fases:", dados.fases);
        addLineItem("Tipo de Ligação:", dados.tipoLigacao);
        addLineItem("Tensão (V):", `${dados.tensaoV} V`);
        addLineItem("Comprimento:", `${dados.comprimentoM} m`);
        addLineItem("Limite Queda de Tensão:", `${dados.limiteQuedaTensao}%`);
        yPos += 5;
        addSection("-- ESPECIFICAÇÕES DE INSTALAÇÃO E CORREÇÕES --");
        addLineItem("Material / Isolação:", `${dados.materialCabo} / ${dados.tipoIsolacao}`);
        addLineItem("Método de Instalação:", dados.metodoInstalacao);
        addLineItem("Temperatura Ambiente:", `${dados.temperaturaAmbienteC}°C`);
        if (dados.id !== 'Geral') { addLineItem("Circuitos Agrupados:", dados.numCircuitosAgrupados); if (dados.resistividadeSolo > 0) { addLineItem("Resist. do Solo (C.m/W):", dados.resistividadeSolo); } } 
        else { if (dados.resistividadeSolo > 0) { addLineItem("Resist. do Solo (C.m/W):", dados.resistividadeSolo); } }
        yPos += 5;
        addSection("-- RESULTADOS DE CÁLCULO E DIMENSIONAMENTO --");
        addLineItem("Corrente de Projeto:", `${calculos.correnteInstalada.toFixed(2)} A`);
        addLineItem("Corrente Demandada (Ib):", `${calculos.correnteDemandada.toFixed(2)} A`);
        addLineItem("Corrente Corrigida (I'):", correnteCorrigidaTexto);
        addLineItem("Bitola Recomendada:", `${calculos.bitolaRecomendadaMm2} mm²`);
        addLineItem("Queda de Tensão (DV):", `${calculos.quedaTensaoCalculada.toFixed(2)}%`);
        addLineItem("Corrente Máx. Cabo (Iz):", `${calculos.correnteMaximaCabo.toFixed(2)} A`);
        yPos += 5;
        addSection("-- PROTEÇÕES RECOMENDADAS --");
        addLineItem("Disjuntor:", `${dados.tipoDisjuntor}: ${calculos.disjuntorRecomendado.nome} (Icc: ${calculos.disjuntorRecomendado.icc} kA)`);
        addLineItem("Proteção DR:", dados.requerDR ? `Sim (${calculos.disjuntorRecomendado.nome.replace('A','')}A / 30mA)` : 'Não');
        addLineItem("Proteção DPS:", getDpsText(dados.dpsInfo));
    });
    doc.save(`Memorial_${document.getElementById('obra').value || 'Projeto'}.pdf`);
}