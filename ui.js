// Arquivo: ui.js (COM CAMPOS DE CONFIGURAÇÃO NO QDC E CORREÇÃO DO PDF)

import { ligacoes, BTU_TO_WATTS_FACTOR, CV_TO_WATTS_FACTOR } from './utils.js';
import { Canvg } from 'https://cdn.skypack.dev/canvg';

let circuitCount = 0;
let qdcCount = 0;
let uiData = null;
let tempOptions = { pvc: [], epr: [] };

export function setupDynamicData(data) {
    uiData = data;
    
    if (uiData?.fatores_k1) { 
        tempOptions.pvc = uiData.fatores_k1.filter(f => f.fator > 0).map(f => f.temperatura_c).sort((a, b) => a - b);
    } else {
        tempOptions.pvc = [30]; 
    }

    if (uiData?.fatores_k1_epr) {
        tempOptions.epr = uiData.fatores_k1_epr.filter(f => f.fator > 0).map(f => f.temperatura_c).sort((a, b) => a - b);
    } else {
        tempOptions.epr = tempOptions.pvc; 
    }
}

function populateTemperatureDropdown(selectElement, temperatures) {
    if (!selectElement || !temperatures) return; 
    const currentValue = selectElement.value;
    selectElement.innerHTML = '';
    temperatures.forEach(temp => {
        const option = document.createElement('option');
        option.value = temp;
        option.textContent = `${temp}°C`;
        selectElement.appendChild(option);
    });
    
    if (temperatures.map(String).includes(currentValue)) { 
        selectElement.value = currentValue;
    } else if (temperatures.includes(30)) {
        selectElement.value = '30';
    } else if (temperatures.length > 0) {
        selectElement.value = temperatures[0];
    }
}

function populateBtuDropdown(selectElement, btuData) {
    if (!selectElement) return;
    selectElement.innerHTML = '<option value="">-- Selecione --</option>'; 
    if (!btuData) return;
    btuData.sort((a, b) => a.valor_btu - b.valor_btu).forEach(item => { const option = document.createElement('option'); option.value = item.valor_btu; option.textContent = item.descricao; selectElement.appendChild(option); });
}

function populateCvDropdown(selectElement, cvData) {
     if (!selectElement) return;
    selectElement.innerHTML = '<option value="">-- Selecione --</option>'; 
    if (!cvData) return;
    cvData.sort((a, b) => a.valor_cv - b.valor_cv).forEach(item => { const option = document.createElement('option'); option.value = item.valor_cv; option.textContent = item.descricao; selectElement.appendChild(option); });
}

function populateSoilResistivityDropdown(selectElement, soilData) {
    if (!selectElement) return;
    selectElement.innerHTML = '<option value="0">Não Aplicável</option>';
    if (!soilData) return;
    
    if(Array.isArray(soilData)) {
        soilData.sort((a, b) => a.resistividade - b.resistividade).forEach(item => { const option = document.createElement('option'); option.value = item.resistividade; option.textContent = `${item.resistividade}`; selectElement.appendChild(option); });
    } else {
        console.error("populateSoilResistivityDropdown: soilData não é um array", soilData);
    }
}

function updateFeederPowerDisplay() {
    let totalInstaladaGeral = 0;
    let totalDemandadaGeral = 0;

    document.querySelectorAll('.qdc-block').forEach(qdcBlock => {
        const qdcId = qdcBlock.dataset.id;
        let totalInstaladaQDC = 0;
        let totalDemandadaQDC = 0;

        qdcBlock.querySelectorAll('.circuit-block').forEach(circuitBlock => {
            const id = circuitBlock.dataset.id;
            const potenciaWInput = document.getElementById(`potenciaW-${id}`);
            const fatorDemandaInput = document.getElementById(`fatorDemanda-${id}`);

            if (potenciaWInput && fatorDemandaInput) {
                const potenciaW = parseFloat(potenciaWInput.value) || 0;
                const fatorDemanda = (parseFloat(fatorDemandaInput.value) || 100) / 100.0;
                
                totalInstaladaQDC += potenciaW;
                totalDemandadaQDC += (potenciaW * fatorDemanda);
            }
        });

        const qdcPotInst = document.getElementById(`qdcPotenciaInstalada-${id}`);
        const qdcPotDem = document.getElementById(`qdcPotenciaDemandada-${id}`);
        if (qdcPotInst) qdcPotInst.value = totalInstaladaQDC.toFixed(2);
        if (qdcPotDem) qdcPotDem.value = totalDemandadaQDC.toFixed(2);

        // A lógica de soma hierárquica ainda não está implementada
        // Por enquanto, somamos todos os QDCs no Alimentador Geral
        totalInstaladaGeral += totalInstaladaQDC;
        totalDemandadaGeral += totalDemandadaQDC;
    });

    const feederPotInstalada = document.getElementById('feederPotenciaInstalada');
    const feederSomaPotDemandada = document.getElementById('feederSomaPotenciaDemandada'); 
    const feederFatorDemandaInput = document.getElementById('feederFatorDemanda');
    const feederPotDemandadaFinal = document.getElementById('feederPotenciaDemandada'); 

    if (feederPotInstalada) feederPotInstalada.value = totalInstaladaGeral.toFixed(2);
    if (feederSomaPotDemandada) feederSomaPotDemandada.value = totalDemandadaGeral.toFixed(2);
    
    const feederFatorDemanda = (parseFloat(feederFatorDemandaInput.value) || 100) / 100.0;
    const finalDemand = totalDemandadaGeral * feederFatorDemanda;
    
    if (feederPotDemandadaFinal) feederPotDemandadaFinal.value = finalDemand.toFixed(2);
}


// --- FUNÇÕES DE VISIBILIDADE E MODAIS ---
export function showLoginView() { const l = document.getElementById('loginContainer'); if(l) l.style.display = 'block'; const a = document.getElementById('appContainer'); if(a) a.style.display = 'none'; const r = document.getElementById('resetPasswordContainer'); if(r) r.style.display = 'none'; }
export function showAppView(userProfile) { const l = document.getElementById('loginContainer'); if(l) l.style.display = 'none'; const a = document.getElementById('appContainer'); if(a) a.style.display = 'block'; const r = document.getElementById('resetPasswordContainer'); if(r) r.style.display = 'none'; const isAdmin = userProfile?.is_admin || false; const adminBtn = document.getElementById('adminPanelBtn'); if(adminBtn) adminBtn.style.display = isAdmin ? 'block' : 'none'; const clientBtn = document.getElementById('manageClientsBtn'); if(clientBtn) clientBtn.style.display = 'block'; const projBtn = document.getElementById('manageProjectsBtn'); if(projBtn) projBtn.style.display = 'block'; }
export function showResetPasswordView() { const l = document.getElementById('loginContainer'); if(l) l.style.display = 'none'; const a = document.getElementById('appContainer'); if(a) a.style.display = 'none'; const r = document.getElementById('resetPasswordContainer'); if(r) r.style.display = 'block'; }
export function openModal(modalId) { const modal = document.getElementById(modalId); if(modal) modal.style.display = 'flex'; }
export function closeModal(modalId) { const modal = document.getElementById(modalId); if(modal) modal.style.display = 'none'; }


// --- LÓGICA DE QDC E FORMULÁRIO ---
export function resetForm(addDefaultQdc = true, linkedClient = null) {
    const mainForm = document.getElementById('main-form'); if(mainForm) mainForm.reset();
    const techForm = document.getElementById('tech-form'); if(techForm) techForm.reset();
    const feederForm = document.getElementById('feeder-form'); if(feederForm) feederForm.reset();
    
    const currentProjId = document.getElementById('currentProjectId'); if(currentProjId) currentProjId.value = '';
    const qdcContainer = document.getElementById('qdc-container'); if(qdcContainer) qdcContainer.innerHTML = '';
    const searchInput = document.getElementById('searchInput'); if(searchInput) searchInput.value = '';

    const clientLinkDisplay = document.getElementById('clientLinkDisplay');
    const currentClientIdInput = document.getElementById('currentClientId');
    if (linkedClient && clientLinkDisplay && currentClientIdInput) {
        clientLinkDisplay.textContent = `Cliente Vinculado: ${linkedClient.nome} (${linkedClient.client_code || 'S/C'})`;
        currentClientIdInput.value = linkedClient.id;
    } else if (clientLinkDisplay && currentClientIdInput){
        clientLinkDisplay.textContent = 'Cliente: Nenhum';
        currentClientIdInput.value = '';
    }

    initializeFeederListeners(); 
    qdcCount = 0;
    circuitCount = 0;
    
    if (addDefaultQdc) {
        addQdcBlock(); 
    } else {
         updateFeederPowerDisplay(); 
    }
}

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
            <div class="form-grid" style="padding-bottom: 15px; margin-bottom: 15px; border-bottom: 1px solid var(--border-color);">
                <div class="form-group">
                    <label for="qdcPotenciaInstalada-${id}">Potência Instalada (W)</label>
                    <input type="text" id="qdcPotenciaInstalada-${id}" value="0.00" readonly>
                </div>
                <div class="form-group">
                    <label for="qdcPotenciaDemandada-${id}">Potência Demandada (W)</label>
                    <input type="text" id="qdcPotenciaDemandada-${id}" value="0.00" readonly>
                </div>
            </div>
            
            <h4 style="margin-top: 0; margin-bottom: 10px; color: var(--label-color);">Configuração do Alimentador deste QDC</h4>
            <div class="form-grid qdc-config-grid">
                <div class="form-group"> <label for="qdcFatorDemanda-${id}">Fator Demanda (%)</label> <input type="number" id="qdcFatorDemanda-${id}" value="100" step="1"> </div>
                <div class="form-group"> <label for="qdcFases-${id}">Fases</label> <select id="qdcFases-${id}"> <option value="Monofasico">Monofásico</option> <option value="Bifasico">Bifásico</option> <option value="Trifasico" selected>Trifásico</option> </select> </div>
                <div class="form-group"> <label for="qdcTipoLigacao-${id}">Ligação</label> <select id="qdcTipoLigacao-${id}"></select> </div>
                <div class="form-group"> <label for="qdcTensaoV-${id}">Tensão (V)</label> <select id="qdcTensaoV-${id}"><option value="12">12</option><option value="24">24</option><option value="36">36</option><option value="127">127</option><option value="220" selected>220</option><option value="380">380</option><option value="440">440</option><option value="760">760</option></select> </div>
                <div class="form-group"> <label for="qdcFatorPotencia-${id}">Fator Potência</label> <input type="number" id="qdcFatorPotencia-${id}" step="0.01" value="0.92"> </div>
                <div class="form-group"> <label for="qdcComprimentoM-${id}">Comprimento (m)</label> <input type="number" id="qdcComprimentoM-${id}" value="10"> </div>
                <div class="form-group"> <label for="qdcTipoIsolacao-${id}">Isolação</label> <select id="qdcTipoIsolacao-${id}"><option value="PVC" selected>PVC 70°C</option><option value="EPR">EPR 90°C</option><option value="XLPE">XLPE 90°C</option></select> </div>
                <div class="form-group"> <label for="qdcMaterialCabo-${id}">Condutor</label> <select id="qdcMaterialCabo-${id}"><option value="Cobre" selected>Cobre</option><option value="Aluminio">Alumínio</option></select> </div>
                <div class="form-group"> <label for="qdcMetodoInstalacao-${id}">Instalação</label> <select id="qdcMetodoInstalacao-${id}"><option value="A1">A1</option><option value="A2">A2</option><option value="B1" selected>B1</option><option value="B2">B2</option><option value="C">C</option><option value="D">D</option></select> </div>
                <div class="form-group"> <label for="qdcTemperaturaAmbienteC-${id}">Temp. Ambiente</label> <select id="qdcTemperaturaAmbienteC-${id}"></select> </div>
                <div class="form-group"> <label for="qdcResistividadeSolo-${id}">Resist. Solo</label> <select id="qdcResistividadeSolo-${id}"></select> </div>
                <div class="form-group"> <label for="qdcNumCircuitosAgrupados-${id}">Ckt Agrupados</label> <select id="qdcNumCircuitosAgrupados-${id}"><option value="1" selected>1</option><option value="2">2</option><option value="3">3</option><option value_="">4</option><option value="5">5</option><option value="6">6</option></select> </div>
                <div class="form-group"> <label for="qdcLimiteQuedaTensao-${id}">Limite DV (%)</label> <input type="number" id="qdcLimiteQuedaTensao-${id}" step="0.1" value="2.0"> </div>
                <div class="form-group"> <label for="qdcTipoDisjuntor-${id}">Disjuntor</label> <select id="qdcTipoDisjuntor-${id}"><option value="Minidisjuntor (DIN)">DIN</option><option value="Caixa Moldada (MCCB)">MCCB</option></select> </div>
                <div class="form-group"> <label for="qdcDpsClasse-${id}">Classe DPS</label> <select id="qdcDpsClasse-${id}"><option value="">Nenhum</option><option value="I">I</option><option value="II">II</option></select> </div>
                <div class="checkbox-group"> <input type="checkbox" id="qdcRequerDR-${id}"><label for="qdcRequerDR-${id}">Requer DR</label> </div>
            </div>
            <h4 style="margin-top: 20px; margin-bottom: 10px; color: var(--label-color); border-top: 1px solid var(--border-color); padding-top: 15px;">Circuitos deste QDC</h4>
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
    if(qdcContainer) qdcContainer.appendChild(newQdcDiv.firstElementChild);

    updateQdcParentDropdowns();
    
    // Inicializa os listeners dos campos do QDC
    initializeQdcListeners(internalId);
    
    if (!id) {
       addCircuit(internalId); 
    }
    return internalId;
}

export function removeQdc(qdcId) {
    const qdcBlock = document.getElementById(`qdc-${qdcId}`);
    if (qdcBlock) {
        const qdcNameInput = qdcBlock.querySelector('.qdc-name-input');
        const qdcName = qdcNameInput ? qdcNameInput.value : `QDC ${qdcId}`;
        if (confirm(`Remover QDC "${qdcName}" e seus circuitos?`)) {
            qdcBlock.remove();
            updateQdcParentDropdowns();
            updateFeederPowerDisplay(); 
        }
    }
}

export function updateQdcParentDropdowns() {
    const allQdcs = document.querySelectorAll('.qdc-block');
    const options = ['<option value="feeder">Alimentador Geral</option>'];
    allQdcs.forEach(qdc => {
        const id = qdc.dataset.id;
        const nameInput = document.getElementById(`qdcName-${id}`);
        const name = nameInput ? nameInput.value : `QDC ${id}`;
        options.push(`<option value="qdc-${id}">${name}</option>`);
    });

    allQdcs.forEach(qdc => {
        const id = qdc.dataset.id;
        const parentSelect = document.getElementById(`qdcParent-${id}`);
        if (!parentSelect) return; 

        const currentParent = parentSelect.dataset.initialParent || parentSelect.value;
        
        const filteredOptions = options.filter(opt => !opt.includes(`value="qdc-${id}"`));
        parentSelect.innerHTML = filteredOptions.join('');
        
        if (Array.from(parentSelect.options).some(option => option.value === currentParent)) {
             parentSelect.value = currentParent;
        } else {
             parentSelect.value = 'feeder';
        }
       
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
    if (circuitContainer) { 
        circuitContainer.appendChild(newCircuitDiv.firstElementChild);
    } else {
        console.error(`Container de circuitos para QDC ${qdcId} não encontrado.`);
        return; 
    }

    if (savedCircuitData) {
        Object.keys(savedCircuitData).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                if (element.type === 'checkbox') { element.checked = savedCircuitData[key]; }
                else { element.value = savedCircuitData[key]; }
            }
        });
        const nameInput = document.getElementById(`nomeCircuito-${internalId}`);
        const nameLabel = document.getElementById(`nomeCircuitoLabel-${internalId}`);
        if(nameInput && nameInput.value && nameLabel) {
            nameLabel.textContent = nameInput.value;
        }
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
        populateSoilResistivityDropdown(resistividadeSolo, uiData.fatores_k2);
        populateTemperatureDropdown(temperaturaAmbiente, tempOptions.pvc); 
    }

     if (savedCircuitData) {
        if(potenciaBTUSelect && savedCircuitData[`potenciaBTU-${internalId}`]) potenciaBTUSelect.value = savedCircuitData[`potenciaBTU-${internalId}`];
        if(potenciaCVSelect && savedCircuitData[`potenciaCV-${internalId}`]) potenciaCVSelect.value = savedCircuitData[`potenciaCV-${internalId}`];
        if(resistividadeSolo && savedCircuitData[`resistividadeSolo-${internalId}`]) resistividadeSolo.value = savedCircuitData[`resistividadeSolo-${internalId}`];
        
        handleInsulationChange(internalId); 
        if(temperaturaAmbiente && savedCircuitData[`temperaturaAmbienteC-${internalId}`]) {
             temperaturaAmbiente.value = savedCircuitData[`temperaturaAmbienteC-${internalId}`];
        }
    } else {
         handleInsulationChange(internalId); 
    }
}


export function removeCircuit(circuitId) {
    const circuitBlock = document.getElementById(`circuit-${circuitId}`);
    if (circuitBlock) { circuitBlock.remove(); updateFeederPowerDisplay(); }
}

function getCircuitHTML(id) {
    return `<div class="circuit-block" id="circuit-${id}" data-id="${id}"> <div class="circuit-header"> <h3 class="circuit-header-left">Circuito <span class="circuit-number"></span></h3> <h3 class="circuit-header-center" id="nomeCircuitoLabel-${id}">Circuito ${id}</h3> <div class="circuit-header-right"> <button type="button" class="remove-circuit-btn btn-red" data-circuit-id="${id}">Remover</button> <span class="toggle-arrow">▼</span> </div> </div> <div class="circuit-content"> <div class="form-grid"> <div class="form-group"> <label for="nomeCircuito-${id}">Nome do Circuito</label> <input type="text" id="nomeCircuito-${id}" value="Circuito ${id}"> </div> <div class="full-width potencia-group"> <div class="form-group"> <label for="tipoCircuito-${id}">Tipo de Circuito</label> <select id="tipoCircuito-${id}"> <option value="iluminacao">Iluminação</option> <option value="tug" selected>TUG</option> <option value="tue">TUE</option> <option value="aquecimento">Aquecimento</option> <option value="motores">Motores</option> <option value="ar_condicionado">Ar Condicionado</option> </select> </div> <div class="form-group hidden" id="potenciaBTU_group-${id}"> <label for="potenciaBTU-${id}">Potência (BTU/h)</label> <select id="potenciaBTU-${id}"></select> </div> <div class="form-group hidden" id="potenciaCV_group-${id}"> <label for="potenciaCV-${id}">Potência (CV)</label> <select id="potenciaCV-${id}"></select> </div> <div class="form-group"> <label for="potenciaW-${id}">Potência (W)</label> <input type="number" id="potenciaW-${id}" value="2500"> </div> </div> <div class="form-group"> <label for="fatorDemanda-${id}">Fator Demanda (%)</label> <input type="number" id="fatorDemanda-${id}" value="100" step="1"> </div> <div class="form-group"> <label for="fases-${id}">Fases</label> <select id="fases-${id}"> <option value="Monofasico" selected>Monofásico</option> <option value="Bifasico">Bifásico</option> <option value="Trifasico">Trifásico</option> </select> </div> <div class="form-group"> <label for="tipoLigacao-${id}">Ligação</label> <select id="tipoLigacao-${id}"></select> </div> <div class="form-group"> <label for="tensaoV-${id}">Tensão (V)</label> <select id="tensaoV-${id}"><option value="12">12</option><option value="24">24</option><option value="36">36</option><option value="127">127</option><option value="220" selected>220</option><option value="380">380</option><option value="440">440</option><option value="760">760</option></select> </div> <div class="form-group"> <label for="fatorPotencia-${id}">Fator Potência</label> <input type="number" id="fatorPotencia-${id}" step="0.01" value="0.92"> </div> <div class="form-group"> <label for="comprimentoM-${id}">Comprimento (m)</label> <input type="number" id="comprimentoM-${id}" value="20"> </div> <div class="form-group"> <label for="tipoIsolacao-${id}">Isolação</label> <select id="tipoIsolacao-${id}"><option value="PVC" selected>PVC 70°C</option><option value="EPR">EPR 90°C</option><option value="XLPE">XLPE 90°C</option></select> </div> <div class="form-group"> <label for="materialCabo-${id}">Condutor</label> <select id="materialCabo-${id}"><option value="Cobre" selected>Cobre</option><option value="Aluminio">Alumínio</option></select> </div> <div class="form-group"> <label for="metodoInstalacao-${id}">Instalação</label> <select id="metodoInstalacao-${id}"><option value="A1">A1</option><option value="A2">A2</option><option value="B1" selected>B1</option><option value="B2">B2</option><option value="C">C</option><option value="D">D</option></select> </div> <div class="form-group"> <label for="temperaturaAmbienteC-${id}">Temp. Ambiente</label> <select id="temperaturaAmbienteC-${id}"></select> </div> <div class="form-group"> <label for="resistividadeSolo-${id}">Resist. Solo</label> <select id="resistividadeSolo-${id}"></select> </div> <div class="form-group"> <label for="numCircuitosAgrupados-${id}">Ckt Agrupados</label> <select id="numCircuitosAgrupados-${id}"><option value="1" selected>1</option><option value="2">2</option><option value="3">3</option><option value_="">4</option><option value="5">5</option><option value="6">6</option></select> </div> <div class="form-group"> <label for="limiteQuedaTensao-${id}">Limite DV (%)</label> <input type="number" id="limiteQuedaTensao-${id}" step="0.1" value="4.0"> </div> <div class="form-group"> <label for="tipoDisjuntor-${id}">Disjuntor</label> <select id="tipoDisjuntor-${id}"><option value="Minidisjuntor (DIN)">DIN</option><option value="Caixa Moldada (MCCB)">MCCB</option></select> </div> <div class="form-group"> <label for="dpsClasse-${id}">Classe DPS</label> <select id="dpsClasse-${id}"><option value="">Nenhum</option><option value="I">I</option><option value="II">II</option></select> </div> <div class="checkbox-group"> <input type="checkbox" id="requerDR-${id}"><label for="requerDR-${id}">Requer DR</label> </div> </div> </div> </div>`;
}

function initializeFeederListeners() {
    const fases = document.getElementById('feederFases');
    const tipoLigacao = document.getElementById('feederTipoLigacao');
    const tipoIsolacao = document.getElementById('feederTipoIsolacao');
    const temperaturaAmbiente = document.getElementById('feederTemperaturaAmbienteC');
    const resistividadeSolo = document.getElementById('feederResistividadeSolo');
    const fatorDemanda = document.getElementById('feederFatorDemanda'); 
    
    if (uiData) { populateSoilResistivityDropdown(resistividadeSolo, uiData.fatores_k2); } 
    
    const atualizarLigacoesFeeder = () => { const f = fases.value; const l = ligacoes[f] || []; tipoLigacao.innerHTML = ''; l.forEach(o => { const op = document.createElement('option'); op.value = o.value; op.textContent = o.text; tipoLigacao.appendChild(op); }); };
    const handleFeederInsulationChange = () => { const sel = tipoIsolacao.value; const t = (sel === 'EPR' || sel === 'XLPE') ? tempOptions.epr : tempOptions.pvc; populateTemperatureDropdown(temperaturaAmbiente, t); };
    
    if(fases) fases.addEventListener('change', atualizarLigacoesFeeder);
    if(tipoIsolacao) tipoIsolacao.addEventListener('change', handleFeederInsulationChange);
    if(fatorDemanda) fatorDemanda.addEventListener('input', updateFeederPowerDisplay); 
    
    atualizarLigacoesFeeder();
    handleFeederInsulationChange();
}

// Funções para os Listeners dos campos do QDC
function initializeQdcListeners(id) {
    const fases = document.getElementById(`qdcFases-${id}`);
    const tipoIsolacao = document.getElementById(`qdcTipoIsolacao-${id}`);
    const temperaturaAmbiente = document.getElementById(`qdcTemperaturaAmbienteC-${id}`);
    const resistividadeSolo = document.getElementById(`qdcResistividadeSolo-${id}`);
    
    if (uiData) { 
        populateSoilResistivityDropdown(resistividadeSolo, uiData.fatores_k2); 
    } 
    
    if(fases) fases.addEventListener('change', () => atualizarQdcLigacoes(id));
    if(tipoIsolacao) tipoIsolacao.addEventListener('change', () => handleQdcInsulationChange(id));
    
    atualizarQdcLigacoes(id);
    handleQdcInsulationChange(id);
}

function atualizarQdcLigacoes(id) {
    const fasesSelect = document.getElementById(`qdcFases-${id}`);
    const tipoLigacaoSelect = document.getElementById(`qdcTipoLigacao-${id}`);
    if (!fasesSelect || !tipoLigacaoSelect) return;
    const f = fasesSelect.value; const l = ligacoes[f] || []; tipoLigacaoSelect.innerHTML = ''; l.forEach(o => { const op = document.createElement('option'); op.value = o.value; op.textContent = o.text; tipoLigacaoSelect.appendChild(op); });
}

function handleQdcInsulationChange(id) {
    const tipoIsolacaoSelect = document.getElementById(`qdcTipoIsolacao-${id}`);
    const tempAmbSelect = document.getElementById(`qdcTemperaturaAmbienteC-${id}`);
    if (!tipoIsolacaoSelect || !tempAmbSelect) return;
    const sel = tipoIsolacaoSelect.value; const t = (sel === 'EPR' || sel === 'XLPE') ? tempOptions.epr : tempOptions.pvc;
    populateTemperatureDropdown(tempAmbSelect, t);
}


function handlePowerUnitChange(id, type) {
    const pW = document.getElementById(`potenciaW-${id}`);
    if (!pW) return;
    if (type === 'btu') { const btuInput = document.getElementById(`potenciaBTU-${id}`); const btu = btuInput ? parseFloat(btuInput.value) || 0 : 0; pW.value = (btu * BTU_TO_WATTS_FACTOR).toFixed(2); }
    else { const cvInput = document.getElementById(`potenciaCV-${id}`); const cv = cvInput ? parseFloat(cvInput.value) || 0 : 0; pW.value = (cv * CV_TO_WATTS_FACTOR).toFixed(2); }
    updateFeederPowerDisplay();
}

export function handleMainContainerInteraction(event) {
    const target = event.target;

    // --- Lógica de Adicionar Circuito ---
    if (target.classList.contains('add-circuit-to-qdc-btn')) {
        const qdcId = target.dataset.qdcId; 
        if (qdcId) {
            addCircuit(qdcId);
        }
        return; 
    }

    // --- Lógica de QDC (Remover, Colapsar, Renomear, E NOVOS CAMPOS) ---
    const qdcBlock = target.closest('.qdc-block'); 
    if (qdcBlock) {
        const qdcId = qdcBlock.dataset.id; 
        
        if (target.classList.contains('remove-qdc-btn')) { 
            const idParaRemover = target.dataset.qdcId || qdcId;
            removeQdc(idParaRemover); 
            return; 
        }
        if (target.classList.contains('qdc-name-input') && event.type === 'input') { 
            updateQdcParentDropdowns(); 
        }
        
        // Gatilhos para os campos de config do QDC
        else if (target.id === `qdcFases-${qdcId}`) { 
            atualizarQdcLigacoes(qdcId); 
        }
        else if (target.id === `qdcTipoIsolacao-${qdcId}`) { 
            handleQdcInsulationChange(qdcId); 
        }

        // Lógica de Colapsar/Expandir QDC
        const qdcHeader = target.closest('.qdc-header');
        if (qdcHeader && !target.closest('.qdc-header-right') && !target.closest('.qdc-header-left input') && !target.closest('.qdc-header-center select')) { 
            qdcBlock.classList.toggle('collapsed'); 
            return; 
        }
    }
    
    // --- Lógica de Circuito (Remover, Colapsar, etc.) ---
    const circuitBlock = target.closest('.circuit-block'); 
    if (circuitBlock) {
        const circuitId = circuitBlock.dataset.id;
        
        // Lógica de Colapsar/Expandir Circuito
        const circuitHeader = target.closest('.circuit-header');
        if (circuitHeader && !target.closest('.circuit-header-right')) { 
            circuitBlock.classList.toggle('collapsed'); 
            return; 
        }
        
        // Lógica de Ações *dentro* do Circuito
        if (target.id === `nomeCircuito-${circuitId}` && event.type === 'input') { 
            const lbl = document.getElementById(`nomeCircuitoLabel-${circuitId}`); 
            if(lbl) lbl.textContent = target.value; 
        }
        if (target.classList.contains('remove-circuit-btn')) { 
            removeCircuit(target.dataset.circuitId || circuitId); 
        }
        else if (target.id === `tipoCircuito-${circuitId}`) { handleCircuitTypeChange(circuitId); }
        else if (target.id === `fases-${circuitId}`) { atualizarLigacoes(circuitId); }
        else if (target.id === `tipoIsolacao-${circuitId}`) { handleInsulationChange(circuitId); }
        else if (target.id === `potenciaBTU-${circuitId}` || target.id === `potenciaCV-${circuitId}`) { handlePowerUnitChange(circuitId, target.id.includes('BTU') ? 'btu' : 'cv'); }
        else if (target.id === `potenciaW-${circuitId}` || target.id === `fatorDemanda-${circuitId}`) { updateFeederPowerDisplay(); }
    }
}


function atualizarLigacoes(id) {
    const fasesSelect = document.getElementById(`fases-${id}`);
    const tipoLigacaoSelect = document.getElementById(`tipoLigacao-${id}`);
    if (!fasesSelect || !tipoLigacaoSelect) return;
    const f = fasesSelect.value; const l = ligacoes[f] || []; tipoLigacaoSelect.innerHTML = ''; l.forEach(o => { const op = document.createElement('option'); op.value = o.value; op.textContent = o.text; tipoLigacaoSelect.appendChild(op); });
}

function handleInsulationChange(id) {
    const tipoIsolacaoSelect = document.getElementById(`tipoIsolacao-${id}`);
    const tempAmbSelect = document.getElementById(`temperaturaAmbienteC-${id}`);
    if (!tipoIsolacaoSelect || !tempAmbSelect) return;
    const sel = tipoIsolacaoSelect.value; const t = (sel === 'EPR' || sel === 'XLPE') ? tempOptions.epr : tempOptions.pvc;
    populateTemperatureDropdown(tempAmbSelect, t);
}

function handleCircuitTypeChange(id) {
    const tipo = document.getElementById(`tipoCircuito-${id}`); const fd = document.getElementById(`fatorDemanda-${id}`); const pw = document.getElementById(`potenciaW-${id}`); const btuG = document.getElementById(`potenciaBTU_group-${id}`); const cvG = document.getElementById(`potenciaCV_group-${id}`);
    if (!tipo || !fd || !pw || !btuG || !cvG) return; 
    const selType = tipo.value; btuG.classList.add('hidden'); cvG.classList.add('hidden'); pw.readOnly = false; fd.readOnly = false;
    if (selType === 'ar_condicionado') { btuG.classList.remove('hidden'); pw.readOnly = true; handlePowerUnitChange(id, 'btu'); }
    else if (selType === 'motores') { cvG.classList.remove('hidden'); pw.readOnly = true; handlePowerUnitChange(id, 'cv'); }
    else if (selType === 'aquecimento') { if (fd.value !== '100') { fd.value = '100'; } }
    updateFeederPowerDisplay();
}

// --- Funções de preenchimento de formulário ---
export function populateProjectList(projects) {
    const select = document.getElementById('savedProjectsSelect'); if(!select) return; select.innerHTML = '<option value="">-- Selecione uma obra --</option>'; projects.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = `${p.project_code || 'S/C'} - ${p.project_name}`; select.appendChild(o); });
}

export function populateFormWithProjectData(project) {
    resetForm(false, project.client); 
    const currentProjId = document.getElementById('currentProjectId'); if(currentProjId) currentProjId.value = project.id;
    if (project.main_data) { Object.keys(project.main_data).forEach(id => { const el = document.getElementById(id); if (el) { el.value = project.main_data[id] || ''; } }); }
    const projCode = document.getElementById('project_code'); if(projCode) projCode.value = project.project_code || '';
    if (project.tech_data) { Object.keys(project.tech_data).forEach(id => { const el = document.getElementById(id); if (el) el.value = project.tech_data[id]; }); }
    if (project.feeder_data) { Object.keys(project.feeder_data).forEach(id => { const el = document.getElementById(id); if (el) { if (el.type === 'checkbox') el.checked = project.feeder_data[id]; else el.value = project.feeder_data[id]; } }); const feederFases = document.getElementById('feederFases'); if(feederFases) feederFases.dispatchEvent(new Event('change')); const feederTipoLig = document.getElementById('feederTipoLigacao'); if(feederTipoLig) feederTipoLig.value = project.feeder_data['feederTipoLigacao']; }
    
    const qdcContainer = document.getElementById('qdc-container'); if(qdcContainer) qdcContainer.innerHTML = ''; 
    
    qdcCount = 0; 
    circuitCount = 0;
    
    let maxQdcId = 0;
    let maxCircuitId = 0;
    if (project.qdcs_data && Array.isArray(project.qdcs_data)) {
        project.qdcs_data.forEach(qdcData => {
            maxQdcId = Math.max(maxQdcId, parseInt(qdcData.id) || 0);
            if (qdcData.circuits && Array.isArray(qdcData.circuits)) {
                qdcData.circuits.forEach(circuitData => {
                    maxCircuitId = Math.max(maxCircuitId, parseInt(circuitData.id) || 0);
                });
            }
        });
    }
    qdcCount = maxQdcId; 
    circuitCount = maxCircuitId; 

    
    if (project.qdcs_data && Array.isArray(project.qdcs_data)) {
        project.qdcs_data.forEach((qdcData, index) => {
            const newQdcId = addQdcBlock(parseInt(qdcData.id), qdcData.name, qdcData.parentId);
            
            if (qdcData.circuits && Array.isArray(qdcData.circuits)) {
                qdcData.circuits.forEach(circuitData => {
                    addCircuit(newQdcId, circuitData); 
                });
            }
            
            // Preenche os campos de configuração do QDC
            if (qdcData.config) {
                Object.keys(qdcData.config).forEach(key => {
                    const element = document.getElementById(key);
                    if (element) {
                        if (element.type === 'checkbox') { element.checked = qdcData.config[key]; }
                        else { element.value = qdcData.config[key]; }
                    }
                });

                // Dispara os listeners para carregar dropdowns dependentes
                atualizarQdcLigacoes(newQdcId); 
                handleQdcInsulationChange(newQdcId);

                // Repopula os valores que foram sobrescritos pelos listeners
                const qdcTipoLigacao = document.getElementById(`qdcTipoLigacao-${newQdcId}`);
                if (qdcTipoLigacao && qdcData.config[`qdcTipoLigacao-${newQdcId}`]) {
                    qdcTipoLigacao.value = qdcData.config[`qdcTipoLigacao-${newQdcId}`];
                }
                const qdcTemp = document.getElementById(`qdcTemperaturaAmbienteC-${newQdcId}`);
                if (qdcTemp && qdcData.config[`qdcTemperaturaAmbienteC-${newQdcId}`]) {
                    qdcTemp.value = qdcData.config[`qdcTemperaturaAmbienteC-${newQdcId}`];
                }
            }

            if (index > 0) { const qdcElem = document.getElementById(`qdc-${newQdcId}`); if(qdcElem) qdcElem.classList.add('collapsed'); }
        });
    } else { addQdcBlock(); } 
    
    updateQdcParentDropdowns();
    updateFeederPowerDisplay();
}
export function populateUsersPanel(users) {
    const list = document.getElementById('adminUserList'); if(!list) return; list.innerHTML = ''; if (!users || users.length === 0) { list.innerHTML = '<li>Nenhum usuário.</li>'; return; }
    users.forEach(u => { const li = document.createElement('li'); let act = '<div class="admin-user-actions">'; if (!u.is_approved) { act += `<button class="approve-user-btn btn-green" data-user-id="${u.id}">Aprovar</button>`; } else { act += u.is_blocked ? `<button class="block-user-btn btn-green" data-user-id="${u.id}" data-is-blocked="false">Desbloquear</button>` : `<button class="block-user-btn btn-block" data-user-id="${u.id}" data-is-blocked="true">Bloquear</button>`; } act += `<button class="edit-user-btn btn-edit" data-user-id="${u.id}">Editar</button><button class="remove-user-btn btn-red" data-user-id="${u.id}">Excluir</button></div>`; const st = u.is_blocked ? '<small style="color:var(--btn-red);">(Bloqueado)</small>' : ''; li.innerHTML = `<span><strong>${u.nome || u.email}</strong> ${st}<br><small>${u.email}</small></span>${act}`; list.appendChild(li); });
}
export function populateEditUserModal(d) { const uid = document.getElementById('editUserId'); if(uid) uid.value = d.id; const nm = document.getElementById('editNome'); if(nm) nm.value = d.nome || ''; const em = document.getElementById('editEmail'); if(em) em.value = d.email || ''; const cp = document.getElementById('editCpf'); if(cp) cp.value = d.cpf || ''; const tl = document.getElementById('editTelefone'); if(tl) tl.value = d.telefone || ''; const cr = document.getElementById('editCrea'); if(cr) cr.value = d.crea || ''; openModal('editUserModalOverlay'); }
export function populateProjectsPanel(projects, clients, users, currentUserProfile) {
    const tb = document.getElementById('adminProjectsTableBody'); const th = document.querySelector('#adminProjectsTable thead tr'); if(!tb || !th) return; const isAdmin = currentUserProfile?.is_admin || false; th.innerHTML = `<th>Cód</th><th>Obra</th><th>Dono</th><th>Cliente</th><th>Ações</th>`; tb.innerHTML = '';
    projects.forEach(p => { const r = document.createElement('tr'); const oN = p.owner?.nome || p.owner?.email || '?'; let aH = `<div class="action-cell">`; const cO = clients.map(c => `<option value="${c.id}" ${c.id === p.client_id ? 'selected' : ''}>${c.nome}</option>`).join(''); aH += `<div class="action-group"><label>Cli:</label><select class="transfer-client-select" data-project-id="${p.id}"><option value="">--</option>${cO}</select><button class="transfer-client-btn btn-green" data-project-id="${p.id}">Ok</button></div>`; if (isAdmin) { const ownO = users.map(u => `<option value="${u.id}" ${u.id === p.owner_id ? 'selected' : ''}>${u.nome || u.email}</option>`).join(''); aH += `<div class="action-group"><label>Dono:</label><select class="transfer-owner-select" data-project-id="${p.id}">${ownO}</select><button class="transfer-owner-btn btn-grey" data-project-id="${p.id}">Ok</button></div>`; } aH += `</div>`; r.innerHTML = `<td>${p.project_code || 'S/C'}</td><td>${p.project_name}</td><td>${oN}</td><td>${p.client?.nome || '-'}</td><td>${aH}</td>`; tb.appendChild(r); });
}
export function populateClientManagementModal(clients) {
    const list = document.getElementById('clientList'); if(!list) return; list.innerHTML = ''; if (clients.length === 0) { list.innerHTML = '<li>Nenhum cliente.</li>'; return; }
    clients.forEach(c => { const hP = c.projects && c.projects.length > 0; const li = document.createElement('li'); li.innerHTML = `<span><strong>${c.nome}</strong> (${c.client_code || 'S/C'})<br><small>${c.documento_valor || '-'} - ${c.email || '-'}</small></span><div class="client-actions"><button class="edit-client-btn btn-edit" data-client-id="${c.id}">Edt</button><button class="delete-client-btn btn-red" data-client-id="${c.id}" ${hP ? 'disabled title="Cliente com obras"' : ''}>Exc</button></div>`; list.appendChild(li); });
}
export function resetClientForm() { const f = document.getElementById('clientForm'); if(f) f.reset(); const cId = document.getElementById('clientId'); if(cId) cId.value = ''; const title = document.getElementById('clientFormTitle'); if(title) title.textContent = 'Novo Cliente'; const btn = document.getElementById('clientFormSubmitBtn'); if(btn) btn.textContent = 'Salvar'; const cancel = document.getElementById('clientFormCancelBtn'); if(cancel) cancel.style.display = 'none'; }
export function openEditClientForm(c) { const cId = document.getElementById('clientId'); if(cId) cId.value = c.id; const nm = document.getElementById('clientNome'); if(nm) nm.value = c.nome; const dt = document.getElementById('clientDocumentoTipo'); if(dt) dt.value = c.documento_tipo; const dv = document.getElementById('clientDocumentoValor'); if(dv) dv.value = c.documento_valor; const em = document.getElementById('clientEmail'); if(em) em.value = c.email; const cel = document.getElementById('clientCelular'); if(cel) cel.value = c.celular; const tel = document.getElementById('clientTelefone'); if(tel) tel.value = c.telefone; const end = document.getElementById('clientEndereco'); if(end) end.value = c.endereco; const title = document.getElementById('clientFormTitle'); if(title) title.textContent = 'Editar Cliente'; const btn = document.getElementById('clientFormSubmitBtn'); if(btn) btn.textContent = 'Atualizar'; const cancel = document.getElementById('clientFormCancelBtn'); if(cancel) cancel.style.display = 'inline-block'; }
export function populateSelectClientModal(clients, isChange = false) { const s = document.getElementById('clientSelectForNewProject'); if(!s) return; s.innerHTML = '<option value="">-- Selecione --</option>'; clients.forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = `${c.nome} (${c.client_code})`; o.dataset.client = JSON.stringify(c); s.appendChild(o); }); const t = document.querySelector('#selectClientModalOverlay h3'); const b = document.getElementById('confirmClientSelectionBtn'); if(t && b) { if (isChange) { t.textContent = 'Vincular / Alterar Cliente'; b.textContent = 'Confirmar'; } else { t.textContent = 'Vincular Cliente'; b.textContent = 'Vincular'; } } openModal('selectClientModalOverlay'); }

// --- FUNÇÕES DE GERAÇÃO DE PDF ---
function getDpsText(dpsInfo) { if (!dpsInfo) return 'Não'; return `Sim, Classe ${dpsInfo.classe} (${dpsInfo.corrente_ka} kA)`; }
function drawHeader(x, y, projectData, totalPower) { const t = projectData.obra || "Diagrama"; const p = `(${totalPower.toFixed(2)} W)`; return `<g text-anchor="end"> <text x="${x}" y="${y}" style="font-family: Arial; font-size: 16px; font-weight: bold;">Q.D. ${t.toUpperCase()}</text> <text x="${x}" y="${y + 15}" style="font-family: Arial; font-size: 12px;">${p}</text> </g>`; }
function drawDisjuntor(x, y, text, fases = 'Monofasico') { let sP=''; switch(fases){ case 'Trifasico':sP=`<path d="M ${x-5} ${y-2} q 5 -10 10 0 M ${x-5} ${y+2} q 5 -10 10 0 M ${x-5} ${y+6} q 5 -10 10 0" stroke="black" stroke-width="1.5" fill="none"/>`;break; case 'Bifasico':sP=`<path d="M ${x-5} ${y} q 5 -10 10 0 M ${x-5} ${y+4} q 5 -10 10 0" stroke="black" stroke-width="1.5" fill="none"/>`;break; default:sP=`<path d="M ${x-5} ${y+2} q 5 -10 10 0" stroke="black" stroke-width="1.5" fill="none"/>`;break;} return `<g text-anchor="middle"> <circle cx="${x-12.5}" cy="${y}" r="1.5" fill="black"/> <circle cx="${x+12.5}" cy="${y}" r="1.5" fill="black"/> ${sP} <text x="${x}" y="${y-18}" style="font-family: Arial; font-size: 11px;">${text}</text> </g>`; }
function drawDR(x, y, text, fases = 'Monofasico') { const dC='#27ae60'; let iS=''; if(fases==='Trifasico'){iS=`<path d="M ${x-4} ${y-5} v 10 M ${x} ${y-5} v 10 M ${x+4} ${y-5} v 10 M ${x-4} ${y-5} h 8" stroke="${dC}" stroke-width="1" fill="none"/>`;} else {iS=`<path d="M ${x} ${y-5} v 10 M ${x-3} ${y-5} h 6" stroke="${dC}" stroke-width="1" fill="none"/>`;} return `<g text-anchor="middle"> <rect x="${x-12.5}" y="${y-12.5}" width="25" height="25" stroke="${dC}" stroke-width="1.5" fill="white"/> <text x="${x}" y="${y-18}" style="font-family: Arial; font-size: 10px; fill:${dC};">${text}</text> <text x="${x}" y="${y+4}" style="font-family: Arial; font-size: 11px; font-weight: bold; fill:${dC};">DR</text> ${iS} </g>`; }
function drawDPS(x, y, feederData) { const dC='#27ae60'; let n=feederData.fases==='Monofasico'?2:(feederData.fases==='Bifasico'?3:4); const dI=feederData.dpsInfo; const t=dI?`${n}x DPS Cl.${dI.classe} ${dI.corrente_ka}kA`:`${n}x DPS`; return `<g> <rect x="${x-45}" y="${y-12.5}" width="90" height="25" stroke="${dC}" stroke-width="1.5" fill="white"/> <text x="${x}" y="${y+4}" text-anchor="middle" style="font-family: Arial; font-size: 10px; fill:${dC};">${t}</text> <line x1="${x}" y1="${y+12.5}" x2="${x}" y2="${y+30}" stroke="black" stroke-width="1"/> ${drawGroundSymbol(x,y+30)} </g>`; }
function drawGroundSymbol(x, y) { return `<line x1="${x}" y1="${y}" x2="${x}" y2="${y+5}" stroke="black" stroke-width="1"/> <line x1="${x-8}" y1="${y+5}" x2="${x+8}" y2="${y+5}" stroke="black" stroke-width="1.5"/> <line x1="${x-5}" y1="${y+8}" x2="${x+5}" y2="${y+8}" stroke="black" stroke-width="1.5"/> <line x1="${x-2}" y1="${y+11}" x2="${x+2}" y2="${y+11}" stroke="black" stroke-width="1.5"/>`; }
function drawConductorSymbol(x, y, numConductors) { let p=''; for(let i=0;i<numConductors;i++){p+=` M ${x-5} ${y+5+(i*4)} l 10 -5`;} return `<path d="${p}" stroke="black" stroke-width="1" fill="none"/>`; }
function drawCircuitLine(result, x, y, index) { const {dados,calculos}=result; const yE=y+250; const fS=`font-family: Arial;`; return `<g text-anchor="middle"> ${drawDisjuntor(x,y,`${calculos.disjuntorRecomendado.nome}`,dados.fases)} <line x1="${x}" y1="${y+12.5}" x2="${x}" y2="${yE}" stroke="black" stroke-width="1"/> ${drawConductorSymbol(x,y+60,calculos.numConductors)} <text x="${x}" y="${y+90}" style="${fS} font-size: 11px;">${calculos.bitolaRecomendadaMm2}</text> <text x="${x}" y="${yE+20}" style="${fS} font-size: 11px; font-weight: bold;">(${calculos.potenciaDemandada.toFixed(0)} W)</text> <text x="${x}" y="${yE+35}" style="${fS} font-size: 12px;">${index} - ${dados.nomeCircuito}</text> </g>`; }

function buildUnifilarSvgString(calculationResults) {
    if (!calculationResults) return null; 
    
    const { feederResult, circuitResults } = calculationResults;
    if (!feederResult || !circuitResults || circuitResults.length === 0) return null;
    
    const allCircuits = circuitResults; 
    
    const circuitsComDR = allCircuits.filter(c => c.dados.requerDR);
    const circuitsSemDR = allCircuits.filter(c => !c.dados.requerDR);
    const categorizedCircuits = {};
    circuitsComDR.forEach(c => { let t=c.dados.tipoCircuito; if(t==='tue'&&(c.dados.nomeCircuito.toLowerCase().includes('chuveiro')||c.calculos.potenciaDemandada>4000)){t='tue_potencia';} if(!categorizedCircuits[t]) categorizedCircuits[t]=[]; categorizedCircuits[t].push(c); });
    const finalGroups = [];
    const groupOrder = ['iluminacao', 'tug', 'tue', 'tue_potencia', 'ar_condicionado', 'motores', 'aquecimento'];
    groupOrder.forEach(cat => { if(categorizedCircuits[cat]){ const cT=categorizedCircuits[cat]; const cS=(cat==='iluminacao')?8:5; for(let i=0;i<cT.length;i+=cS){ const chunk=cT.slice(i,i+cS); const isHP=chunk.some(c=>c.calculos.potenciaDemandada>=4000); const drC=isHP?'63A':'40A'; finalGroups.push({dr:{corrente:drC,sensibilidade:'30mA'},circuits:chunk}); } } });
    if (circuitsSemDR.length > 0) { finalGroups.push({ dr: null, circuits: circuitsSemDR }); }
    const yS=40, yB=yS+150, cW=100, mL=60, tC=allCircuits.length, sW=(tC*cW)+mL*2, sH=600;
    let sP=[`<svg width="${sW}" height="${sH}" xmlns="http://www.w3.org/2000/svg">`];
    sP.push(drawHeader(sW-20,yS,feederResult.dados,feederResult.calculos.potenciaDemandada));
    let cX=mL; sP.push(`<line x1="${cX}" y1="${yS}" x2="${cX}" y2="${yB-50}" stroke="black" stroke-width="2"/>`); sP.push(drawDisjuntor(cX,yB-50,`${feederResult.calculos.disjuntorRecomendado.nome}`,feederResult.dados.fases)); sP.push(`<line x1="${cX}" y1="${yB-37.5}" x2="${cX}" y2="${yB}" stroke="black" stroke-width="2"/>`); if(feederResult.dados.dpsClasse){sP.push(`<line x1="${cX}" y1="${yB-100}" x2="${cX+50}" y2="${yB-100}" stroke="black" stroke-width="1"/>`);sP.push(drawDPS(cX+95,yB-100,feederResult.dados));} sP.push(drawGroundSymbol(mL+(tC*cW)/2,sH-40)); const bS=mL, bE=bS+tC*cW; sP.push(`<line x1="${bS}" y1="${yB}" x2="${bE}" y2="${yB}" stroke="black" stroke-width="5"/>`); cX+=(cW/2); let cI=1;
    finalGroups.forEach(g => { const gW=g.circuits.length*cW; const gSX=cX-(cW/2); if(g.dr){ const isGT=g.circuits.some(c=>c.dados.fases==='Trifasico'); const drF=isGT?'Trifasico':'Monofasico'; const drX=gSX+gW/2; sP.push(`<line x1="${drX}" y1="${yB}" x2="${drX}" y2="${yB+40}" stroke="black" stroke-width="1"/>`); sP.push(`<circle cx="${drX}" cy="${yB}" r="3" fill="black"/>`); sP.push(drawDR(drX,yB+40,`${g.dr.corrente}/${g.dr.sensibilidade}`,drF)); const sBY=yB+65; sP.push(`<line x1="${gSX+cW/2}" y1="${sBY}" x2="${gSX+gW-cW/2}" y2="${sBY}" stroke="black" stroke-width="3"/>`); sP.push(`<rect x="${gSX}" y="${yB+10}" width="${gW}" height="350" fill="none" stroke="black" stroke-dasharray="5,5"/>`); g.circuits.forEach(r=>{sP.push(`<line x1="${cX}" y1="${sBY}" x2="${cX}" y2="${sBY+15}" stroke="black" stroke-width="1"/>`); sP.push(`<circle cx="${cX}" cy="${sBY}" r="3" fill="black"/>`); sP.push(drawCircuitLine(r,cX,sBY+15,cI++)); cX+=cW;});} else { g.circuits.forEach(r=>{sP.push(`<line x1="${cX}" y1="${yB}" x2="${cX}" y2="${yB+15}" stroke="black" stroke-width="1"/>`); sP.push(`<circle cx="${cX}" cy="${yB}" r="3" fill="black"/>`); sP.push(drawCircuitLine(r,cX,yB+15,cI++)); cX+=cW;});}});
    sP.push('</svg>'); return sP.join('');
}

export async function generateUnifilarPdf(calculationResults) {
    const svgString = buildUnifilarSvgString(calculationResults);
    if (!svgString) { alert("Dados insuficientes para gerar Diagrama Unifilar."); return; }
    try { const { jsPDF } = window.jspdf; const doc = new jsPDF('l', 'mm', 'a3'); const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svgEl.innerHTML = svgString; document.body.appendChild(svgEl); const { width, height } = svgEl.getBBox(); document.body.removeChild(svgEl); canvas.width = width || 800; canvas.height = height || 600; const v = await Canvg.fromString(ctx, svgString); await v.render(); const imgData = canvas.toDataURL('image/png'); const pdfW = doc.internal.pageSize.getWidth(); const pdfH = doc.internal.pageSize.getHeight(); const m = 10; let imgW = pdfW - (m * 2); let imgH = (canvas.height / canvas.width) * imgW; if (imgH > pdfH - (m*2)) { imgH = pdfH - (m*2); imgW = (canvas.width / canvas.height) * imgH; } let fY = m; if (imgH < (pdfH - (m * 2))) { fY = (pdfH - imgH) / 2; } let fX = (pdfW - imgW) / 2; doc.addImage(imgData, 'PNG', fX, fY, imgW, imgH); doc.save(`Unifilar_${document.getElementById('obra').value || 'Projeto'}.pdf`); } catch (e) { console.error("Erro PDF Unifilar:", e); alert("Erro ao gerar PDF Unifilar."); }
}

// ========================================================================
// >>>>> FUNÇÃO CORRIGIDA: generateMemorialPdf <<<<<
// Corrigido os nomes das funções (addS, addL, addT) e a definição de reportData
// ========================================================================
export function generateMemorialPdf(calculationResults, currentUserProfile) {
    if (!calculationResults) { alert("Execute o cálculo primeiro."); return; }
    
    const { feederResult, circuitResults } = calculationResults;
    if (!feederResult || !circuitResults || circuitResults.length === 0) { alert("Dados insuficientes para gerar Memorial."); return;}
    
    const { jsPDF } = window.jspdf; 
    const doc = new jsPDF('p', 'mm', 'a4'); 
    let yPos = 20; // Renomeado para yPos para evitar conflito
    const lM = 15; 
    const vM = 75;

    // Definições das funções auxiliares (como no arquivo original)
    const addT = (t) => { doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.text(t, 105, yPos, { align: 'center' }); yPos += 12; }; 
    const addS = (t) => { if (yPos > 260) { doc.addPage(); yPos = 20; } doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text(t, lM, yPos); yPos += 8; }; 
    const addL = (l, v) => { if (yPos > 270) { doc.addPage(); yPos = 20; } doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text(l, lM, yPos); doc.setFont('helvetica', 'normal'); doc.text(String(v || '-'), vM, yPos); yPos += 6; };
    
    // **CORREÇÃO 1: Definir reportData**
    // Os dados do cliente/obra estão dentro do resultado do alimentador
    const reportData = feederResult.dados;

    addT("RELATÓRIO DE PROJETO ELÉTRICO"); 
    
    // **CORREÇÃO 2: Usar addS e addL (em vez de addSection/addLineItem)**
    addS("DADOS DO CLIENTE");
    addL("Cliente:", reportData.cliente);
    addL(`Documento (${reportData.tipoDocumento}):`, reportData.documento);
    addL("Celular:", reportData.celular);
    addL("Telefone:", reportData.telefone);
    addL("E-mail:", reportData.email);
    addL("Endereço do Cliente:", reportData.enderecoCliente);
    yPos += 5;
    addS("DADOS DA OBRA");
    addL("Código da Obra:", reportData.projectCode);
    addL("Nome da Obra:", reportData.obra);
    addL("Cidade da Obra:", reportData.cidadeObra);
    addL("Endereço da Obra:", reportData.enderecoObra);
    addL("Área da Obra (m²):", reportData.areaObra);
    addL("Unid. Residenciais:", reportData.unidadesResidenciais);
    addL("Unid. Comerciais:", reportData.unidadesComerciais);
    addL("Observações:", reportData.observacoes);
    yPos += 5;
    addS("INFORMAÇÕES DO RESPONSÁVEL TÉCNICO");
    addL("Nome:", document.getElementById('respTecnico').value);
    addL("Título:", document.getElementById('titulo').value);
    addL("CREA:", document.getElementById('crea').value);
    yPos += 5;
    addS("INFORMAÇÕES DO RELATÓRIO");
    const dataFormatada = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    addL("Gerado em:", dataFormatada);
    addL("Gerado por:", currentUserProfile?.nome || 'N/A');
    yPos += 5;
    addS("RESUMO DA ALIMENTAÇÃO GERAL");
    
    // (O restante da função já usava 'doc.autoTable' e estava correto)
    const feederBreakerType = feederResult.dados.tipoDisjuntor.includes('Caixa Moldada') ? 'MCCB' : 'DIN';
    const feederBreakerText = `${feederBreakerType} ${feederResult.calculos.disjuntorRecomendado.nome}`;
    const feederHead = [['Tensão/Fases', 'Disjuntor Geral', 'DR', 'DPS', 'Cabo (Isolação)', 'Eletroduto']];
    const feederBody = [[ `${feederResult.dados.tensaoV}V - ${feederResult.dados.fases}`, feederBreakerText, feederResult.dados.requerDR ? 'Sim' : 'Nao', getDpsText(feederResult.dados.dpsInfo), `${feederResult.calculos.bitolaRecomendadaMm2} mm² (${feederResult.dados.tipoIsolacao})`, feederResult.calculos.dutoRecomendado ]];
    doc.autoTable({ startY: yPos, head: feederHead, body: feederBody, theme: 'grid', headStyles: { fillColor: [44, 62, 80] }, styles: { fontSize: 8 } });
    yPos = doc.lastAutoTable.finalY + 10;
    
    if (circuitResults.length > 0) {
        addS("RESUMO DOS CIRCUITOS"); // **CORREÇÃO 2 (continuação)**
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
        
        // **CORREÇÃO 3: Usar addT, addS, addL dentro do loop**
        addT(title); // Era addTitle
        addS("-- PARÂMETROS DE ENTRADA --"); // Era addSection
        if (dados.id !== 'Geral') { addL("Tipo de Circuito:", dados.tipoCircuito); } // Era addLineItem
        addL("Potência Instalada:", `${calculos.potenciaInstalada.toFixed(2)} W`);
        addL("Fator de Demanda:", `${dados.fatorDemanda}%`);
        addL("Potência Demandada:", `${potenciaDemandadaVA} VA`);
        addL("Fator de Potência:", dados.fatorPotencia);
        addL("Sistema de Fases:", dados.fases);
        addL("Tipo de Ligação:", dados.tipoLigacao);
        addL("Tensão (V):", `${dados.tensaoV} V`);
        addL("Comprimento:", `${dados.comprimentoM} m`);
        addL("Limite Queda de Tensão:", `${dados.limiteQuedaTensao}%`);
        yPos += 5;
        addS("-- ESPECIFICAÇÕES DE INSTALAÇÃO E CORREÇÕES --");
        addL("Material / Isolação:", `${dados.materialCabo} / ${dados.tipoIsolacao}`);
        addL("Método de Instalação:", dados.metodoInstalacao);
        addL("Temperatura Ambiente:", `${dados.temperaturaAmbienteC}°C`);
        if (dados.id !== 'Geral') { addL("Circuitos Agrupados:", dados.numCircuitosAgrupados); if (dados.resistividadeSolo > 0) { addL("Resist. do Solo (C.m/W):", dados.resistividadeSolo); } } 
        else { if (dados.resistividadeSolo > 0) { addL("Resist. do Solo (C.m/W):", dados.resistividadeSolo); } }
        yPos += 5;
        addS("-- RESULTADOS DE CÁLCULO E DIMENSIONAMENTO --");
        addL("Corrente de Projeto:", `${calculos.correnteInstalada.toFixed(2)} A`);
        addL("Corrente Demandada (Ib):", `${calculos.correnteDemandada.toFixed(2)} A`);
        addL("Corrente Corrigida (I'):", correnteCorrigidaTexto);
        addL("Bitola Recomendada:", `${calculos.bitolaRecomendadaMm2} mm²`);
        addL("Queda de Tensão (DV):", `${calculos.quedaTensaoCalculada.toFixed(2)}%`);
        addL("Corrente Máx. Cabo (Iz):", `${calculos.correnteMaximaCabo.toFixed(2)} A`);
        yPos += 5;
        addS("-- PROTEÇÕES RECOMENDADAS --");
        addL("Disjuntor:", `${dados.tipoDisjuntor}: ${calculos.disjuntorRecomendado.nome} (Icc: ${calculos.disjuntorRecomendado.icc} kA)`);
        addL("Proteção DR:", dados.requerDR ? `Sim (${calculos.disjuntorRecomendado.nome.replace('A','')}A / 30mA)` : 'Não');
        addL("Proteção DPS:", getDpsText(dados.dpsInfo));
    });

    doc.save(`Memorial_${document.getElementById('obra').value || 'Projeto'}.pdf`);
}