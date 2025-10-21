// Arquivo: ui.js (CORRIGIDO FINAL - HTML Restaurado + Carga Hierárquica VISUAL + Debug Memorial)

console.log("--- ui.js: Iniciando carregamento ---");

import { ligacoes, BTU_TO_WATTS_FACTOR, CV_TO_WATTS_FACTOR } from './utils.js';
import { Canvg } from 'https://cdn.skypack.dev/canvg';

let circuitCount = 0;
let qdcCount = 0;
let uiData = null;
let tempOptions = { pvc: [], epr: [] };

console.log("--- ui.js: Antes de definir exports ---");

export function setupDynamicData(data) {
    console.log("--- ui.js: setupDynamicData executado ---");
    uiData = data;

    // Garante que os dados existam e sejam arrays antes de processar
    if (uiData?.fatores_k1 && Array.isArray(uiData.fatores_k1)) {
        tempOptions.pvc = uiData.fatores_k1
            .filter(f => f && typeof f.fator === 'number' && f.fator > 0 && typeof f.temperatura_c === 'number')
            .map(f => f.temperatura_c)
            .sort((a, b) => a - b);
    } else {
        tempOptions.pvc = []; // Começa vazio se dados inválidos
        console.warn("Dados de fatores_k1 (PVC) não encontrados, inválidos ou não são array.");
    }
    if (!tempOptions.pvc.includes(30)) tempOptions.pvc.push(30);
    tempOptions.pvc = [...new Set(tempOptions.pvc)].sort((a,b) => a - b); // Remove duplicados e ordena


    if (uiData?.fatores_k1_epr && Array.isArray(uiData.fatores_k1_epr)) {
        tempOptions.epr = uiData.fatores_k1_epr
            .filter(f => f && typeof f.fator === 'number' && f.fator > 0 && typeof f.temperatura_c === 'number')
            .map(f => f.temperatura_c)
            .sort((a, b) => a - b);
    } else {
        tempOptions.epr = []; // Começa vazio
        console.warn("Dados de fatores_k1_epr não encontrados, inválidos ou não são array.");
    }
    if (tempOptions.epr.length === 0) tempOptions.epr = tempOptions.pvc.length > 0 ? [...tempOptions.pvc] : [30];
    tempOptions.epr = [...new Set(tempOptions.epr)].sort((a,b) => a - b); // Remove duplicados e ordena
     console.log("Opções de Temperatura Carregadas:", tempOptions);
}

function populateTemperatureDropdown(selectElement, temperatures) {
    if (!selectElement || !temperatures || !Array.isArray(temperatures)) {
         console.warn("populateTemperatureDropdown: Elemento ou dados de temperatura inválidos/ausentes.", selectElement, temperatures);
         if(selectElement) selectElement.innerHTML = '<option value="30">30°C</option>'; // Fallback
         return;
    }
    const currentValue = selectElement.value;
    selectElement.innerHTML = '';

    const validTemps = [...new Set(temperatures.filter(temp => typeof temp === 'number' && !isNaN(temp)))].sort((a,b)=> a-b);
    if (validTemps.length === 0) {
        console.warn("Nenhuma temperatura válida para popular dropdown, usando 30°C.");
        validTemps.push(30);
    }
     if (temperatures === tempOptions.pvc && !validTemps.includes(30)) {
        validTemps.push(30);
        validTemps.sort((a,b)=> a-b);
    }

    validTemps.forEach(temp => {
        const option = document.createElement('option');
        option.value = temp;
        option.textContent = `${temp}°C`;
        selectElement.appendChild(option);
    });

    if (validTemps.map(String).includes(currentValue)) {
        selectElement.value = currentValue;
    } else if (validTemps.includes(30)) {
        selectElement.value = '30';
    } else if (validTemps.length > 0) {
        selectElement.value = validTemps[0];
    }
}

function populateBtuDropdown(selectElement, btuData) {
    if (!selectElement) return;
    selectElement.innerHTML = '<option value="">-- Selecione --</option>';
    if (!btuData || !Array.isArray(btuData)) { console.warn("Dados de BTU inválidos ou ausentes."); return; }
    btuData
        .map(item => ({ ...item, valor_btu: parseFloat(item.valor_btu) }))
        .filter(item => item && !isNaN(item.valor_btu))
        .sort((a, b) => a.valor_btu - b.valor_btu)
        .forEach(item => { const option = document.createElement('option'); option.value = item.valor_btu; option.textContent = item.descricao; selectElement.appendChild(option); });
}

function populateCvDropdown(selectElement, cvData) {
     if (!selectElement) return;
    selectElement.innerHTML = '<option value="">-- Selecione --</option>';
    if (!cvData || !Array.isArray(cvData)) { console.warn("Dados de CV inválidos ou ausentes."); return; }
     cvData
        .map(item => ({ ...item, valor_cv: parseFloat(item.valor_cv) }))
        .filter(item => item && !isNaN(item.valor_cv))
        .sort((a, b) => a.valor_cv - b.valor_cv)
        .forEach(item => { const option = document.createElement('option'); option.value = item.valor_cv; option.textContent = item.descricao; selectElement.appendChild(option); });
}

function populateSoilResistivityDropdown(selectElement, soilData) {
    if (!selectElement) return;
    selectElement.innerHTML = '<option value="0">Não Aplicável</option>';
    if (!soilData || !Array.isArray(soilData)) { console.warn("Dados de resistividade do solo inválidos ou ausentes."); return; }
    soilData
        .map(item => ({ ...item, resistividade: parseFloat(item.resistividade) }))
        .filter(item => item && !isNaN(item.resistividade))
        .sort((a, b) => a.resistividade - b.resistividade)
        .forEach(item => { const option = document.createElement('option'); option.value = item.resistividade; option.textContent = `${item.resistividade}`; selectElement.appendChild(option); });
}


// --- FUNÇÕES DE VISIBILIDADE E MODAIS ---
console.log("--- ui.js: Definindo showLoginView ---");
export function showLoginView() { console.log("showLoginView chamada"); const l = document.getElementById('loginContainer'); if(l) l.style.display = 'block'; const a = document.getElementById('appContainer'); if(a) a.style.display = 'none'; const r = document.getElementById('resetPasswordContainer'); if(r) r.style.display = 'none'; }

console.log("--- ui.js: Definindo showAppView ---");
export function showAppView(userProfile) { console.log("showAppView chamada"); const l = document.getElementById('loginContainer'); if(l) l.style.display = 'none'; const a = document.getElementById('appContainer'); if(a) a.style.display = 'block'; const r = document.getElementById('resetPasswordContainer'); if(r) r.style.display = 'none'; const isAdmin = userProfile?.is_admin || false; const adminBtn = document.getElementById('adminPanelBtn'); if(adminBtn) adminBtn.style.display = isAdmin ? 'block' : 'none'; const clientBtn = document.getElementById('manageClientsBtn'); if(clientBtn) clientBtn.style.display = 'block'; const projBtn = document.getElementById('manageProjectsBtn'); if(projBtn) projBtn.style.display = 'block'; }

console.log("--- ui.js: Definindo showResetPasswordView ---");
export function showResetPasswordView() { console.log("showResetPasswordView chamada"); const l = document.getElementById('loginContainer'); if(l) l.style.display = 'none'; const a = document.getElementById('appContainer'); if(a) a.style.display = 'none'; const r = document.getElementById('resetPasswordContainer'); if(r) r.style.display = 'block'; }
export function openModal(modalId) { const modal = document.getElementById(modalId); if(modal) modal.style.display = 'flex'; else console.error(`Modal com ID '${modalId}' não encontrado.`); }
export function closeModal(modalId) { const modal = document.getElementById(modalId); if(modal) modal.style.display = 'none'; }

// --- FUNÇÃO DE ATUALIZAÇÃO HIERÁRQUICA DE CARGA VISUAL ---
function updateFeederPowerDisplay() {
    // console.log("Atualizando display de carga..."); // Log opcional
    const qdcData = {}; let totalInstalledGeneral = 0;
    document.querySelectorAll('#qdc-container .qdc-block').forEach(qdcBlock => {
        const qdcId = qdcBlock.dataset.id; if (!qdcId) return;
        let installedDirect = 0; let demandedDirect = 0;
        qdcBlock.querySelectorAll('.circuit-block').forEach(circuitBlock => {
            const id = circuitBlock.dataset.id; if (!id) return;
            const potenciaWInput = document.getElementById(`potenciaW-${id}`); const fatorDemandaInput = document.getElementById(`fatorDemanda-${id}`);
            if (potenciaWInput && fatorDemandaInput) { const potenciaW = parseFloat(potenciaWInput.value) || 0; const fatorDemanda = (parseFloat(fatorDemandaInput.value) || 100) / 100.0; installedDirect += potenciaW; demandedDirect += (potenciaW * fatorDemanda); }
        });
        totalInstalledGeneral += installedDirect;
        const parentSelect = document.getElementById(`qdcParent-${qdcId}`); const parentId = parentSelect ? parentSelect.value : 'feeder';
        qdcData[qdcId] = { installedDirect, demandedDirect, parentId, childrenIds: [], aggregatedDemand: -1 };
        const qdcPotInstEl = document.getElementById(`qdcPotenciaInstalada-${qdcId}`); if (qdcPotInstEl) qdcPotInstEl.value = installedDirect.toFixed(2);
    });
    Object.keys(qdcData).forEach(qdcId => { const parentId = qdcData[qdcId].parentId; if (parentId !== 'feeder' && qdcData[parentId]) { qdcData[parentId].childrenIds.push(qdcId); } });
    const visited = new Set();
    function calculateAggregatedDemand(qdcId) { if (!qdcData[qdcId]) return 0; if (qdcData[qdcId].aggregatedDemand !== -1) return qdcData[qdcId].aggregatedDemand; if (visited.has(qdcId)) { console.error(`Loop detectado ${qdcId}`); return qdcData[qdcId].demandedDirect; } visited.add(qdcId); let aggregatedDemand = qdcData[qdcId].demandedDirect; qdcData[qdcId].childrenIds.forEach(childId => { aggregatedDemand += calculateAggregatedDemand(childId); }); visited.delete(qdcId); qdcData[qdcId].aggregatedDemand = aggregatedDemand; return aggregatedDemand; }
    let totalDemandAggregatedGeneral = 0;
    Object.keys(qdcData).forEach(qdcId => { visited.clear(); const aggregatedDemand = calculateAggregatedDemand(qdcId); const qdcPotDemEl = document.getElementById(`qdcPotenciaDemandada-${qdcId}`); if (qdcPotDemEl) qdcPotDemEl.value = aggregatedDemand.toFixed(2); if (qdcData[qdcId].parentId === 'feeder') { totalDemandAggregatedGeneral += aggregatedDemand; } });
    const feederPotInstaladaEl = document.getElementById('feederPotenciaInstalada'); const feederSomaPotDemandadaEl = document.getElementById('feederSomaPotenciaDemandada'); const feederFatorDemandaInput = document.getElementById('feederFatorDemanda'); const feederPotDemandadaFinalEl = document.getElementById('feederPotenciaDemandada');
    if (feederPotInstaladaEl) feederPotInstaladaEl.value = totalInstalledGeneral.toFixed(2); if (feederSomaPotDemandadaEl) feederSomaPotDemandadaEl.value = totalDemandAggregatedGeneral.toFixed(2); const feederFatorDemanda = (parseFloat(feederFatorDemandaInput?.value) || 100) / 100.0; const finalDemandGeral = totalDemandAggregatedGeneral * feederFatorDemanda; if (feederPotDemandadaFinalEl) feederPotDemandadaFinalEl.value = finalDemandGeral.toFixed(2);
    // console.warn("Aviso: Exibição da carga hierárquica ATIVA. O dimensionamento real pela Edge Function ainda é PLANO.");
}



// --- LÓGICA DE QDC E FORMULÁRIO ---
export function resetForm(addDefaultQdc = true, linkedClient = null) {
    console.log("resetForm chamado");
    const mainForm = document.getElementById('main-form'); if(mainForm) mainForm.reset();
    const techForm = document.getElementById('tech-form'); if(techForm) techForm.reset();
    const feederForm = document.getElementById('feeder-form'); if(feederForm) feederForm.reset();

    const currentProjId = document.getElementById('currentProjectId'); if(currentProjId) currentProjId.value = '';
    const qdcContainer = document.getElementById('qdc-container'); if(qdcContainer) qdcContainer.innerHTML = '';
    const searchInput = document.getElementById('searchInput'); if(searchInput) searchInput.value = '';

    const clientLinkDisplay = document.getElementById('clientLinkDisplay');
    const currentClientIdInput = document.getElementById('currentClientId');
    if (linkedClient && clientLinkDisplay && currentClientIdInput) { /* ... (Define cliente) ... */ }
    else if (clientLinkDisplay && currentClientIdInput){ clientLinkDisplay.textContent = 'Cliente: Nenhum'; currentClientIdInput.value = ''; }

    initializeFeederListeners(); // Precisa ser chamado *antes* de addQdcBlock
    qdcCount = 0; circuitCount = 0;

    if (addDefaultQdc) { addQdcBlock(); }
    else { updateFeederPowerDisplay(); } // Atualiza display se não adicionar QDC default
}

// ========================================================================
// >>>>> FUNÇÃO ATUALIZADA: getQdcHTML <<<<<
// HTML COMPLETO RESTAURADO
// ========================================================================
function getQdcHTML(id, name = `QDC ${id}`, parentId = 'feeder') {
    // **HTML Completo Restaurado**
    return `
    <div class="qdc-block" id="qdc-${id}" data-id="${id}">
        <div class="qdc-header">
            <div class="form-group qdc-header-left"> <label for="qdcName-${id}">Nome do Quadro</label> <input type="text" id="qdcName-${id}" value="${name}" class="qdc-name-input"> </div>
            <div class="form-group qdc-header-center"> <label for="qdcParent-${id}">Alimentado por:</label> <select id="qdcParent-${id}" class="qdc-parent-select" data-initial-parent="${parentId}"></select> </div>
            <div class="qdc-header-right"> <button type="button" class="add-circuit-to-qdc-btn btn-green" data-qdc-id="${id}">+ Circuito</button> <button type="button" class="remove-qdc-btn btn-red" data-qdc-id="${id}">Remover QDC</button> <span class="toggle-arrow">▼</span> </div>
        </div>
        <div class="qdc-content">
            <div class="form-grid" style="padding-bottom: 15px; margin-bottom: 15px; border-bottom: 1px solid var(--border-color);">
                <div class="form-group"> <label for="qdcPotenciaInstalada-${id}">Potência Instalada (W)</label> <input type="text" id="qdcPotenciaInstalada-${id}" value="0.00" readonly> </div>
                <div class="form-group"> <label for="qdcPotenciaDemandada-${id}">Potência Demandada (W)</label> <input type="text" id="qdcPotenciaDemandada-${id}" value="0.00" readonly> </div>
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
                <div class="form-group"> <label for="qdcNumCircuitosAgrupados-${id}">Ckt Agrupados</label> <select id="qdcNumCircuitosAgrupados-${id}"><option value="1" selected>1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option></select> </div>
                <div class="form-group"> <label for="qdcLimiteQuedaTensao-${id}">Limite DV (%)</label> <input type="number" id="qdcLimiteQuedaTensao-${id}" step="0.1" value="2.0"> </div>
                <div class="form-group"> <label for="qdcTipoDisjuntor-${id}">Disjuntor</label> <select id="qdcTipoDisjuntor-${id}"><option value="Minidisjuntor (DIN)">DIN</option><option value="Caixa Moldada (MCCB)">MCCB</option></select> </div>
                <div class="form-group"> <label for="qdcDpsClasse-${id}">Classe DPS</label> <select id="qdcDpsClasse-${id}"><option value="">Nenhum</option><option value="I">I</option><option value="II">II</option></select> </div>
                <div class="checkbox-group"> <input type="checkbox" id="qdcRequerDR-${id}"><label for="qdcRequerDR-${id}">Requer DR</label> </div>
            </div>
            <h4 style="margin-top: 20px; margin-bottom: 10px; color: var(--label-color); border-top: 1px solid var(--border-color); padding-top: 15px;">Circuitos deste QDC</h4>
            <div id="circuits-for-qdc-${id}" class="circuits-container-internal"></div>
        </div>
    </div>`;
}

// addQdcBlock com listener direto e collapse
export function addQdcBlock(id = null, name = null, parentId = 'feeder') {
    const isNewQdc = !id;
    const internalId = id || ++qdcCount;
    if (!id) qdcCount = Math.max(qdcCount, internalId);
    const qdcName = name || `QDC ${internalId}`;
    console.log(`Adicionando QDC ${internalId} (Novo: ${isNewQdc})`);

    const newQdcDiv = document.createElement('div');
    newQdcDiv.innerHTML = getQdcHTML(internalId, qdcName, parentId); // Usa HTML completo
    const qdcElement = newQdcDiv.firstElementChild;
    if(!qdcElement) { console.error("Falha ao criar elemento QDC."); return; }

    const qdcContainer = document.getElementById('qdc-container');
    if(qdcContainer) qdcContainer.appendChild(qdcElement);
    else { console.error("Container principal de QDCs não encontrado."); return;}

    // Listener direto no botão '+ Circuito'
    const addCircuitBtn = qdcElement.querySelector('.add-circuit-to-qdc-btn');
    if (addCircuitBtn) {
        addCircuitBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            console.log(`Botão + Circuito clicado para QDC ${internalId}`);
            addCircuit(internalId);
        });
    } else {
        console.error(`Botão '+ Circuito' NÃO encontrado para QDC ${internalId} após adicionar ao DOM.`); // Agora este erro indica problema
    }

    updateQdcParentDropdowns(); // Atualiza dropdowns
    initializeQdcListeners(internalId); // Adiciona listeners

    // Colapsa se necessário
    if ((isNewQdc && qdcCount > 1) || (!isNewQdc && qdcElement.previousElementSibling)) {
         if (!qdcElement.classList.contains('collapsed')) { qdcElement.classList.add('collapsed'); }
    }

    // Adiciona circuito inicial se for novo
    if (isNewQdc) { addCircuit(internalId); }

    // Listener para recalcular cargas quando o parent mudar
    const parentSelect = qdcElement.querySelector('.qdc-parent-select');
    if(parentSelect) { parentSelect.addEventListener('change', updateFeederPowerDisplay); }

    updateFeederPowerDisplay(); // Atualiza display geral
    return internalId;
}

export function removeQdc(qdcId) { /* ... (inalterada) ... */ }
export function updateQdcParentDropdowns() { /* ... (inalterada) ... */ }


// --- LÓGICA DE CIRCUITO ---
// addCircuit com collapse padrão
export function addCircuit(qdcId, savedCircuitData = null) {
    const isNewCircuit = !savedCircuitData;
    const internalId = savedCircuitData ? parseInt(savedCircuitData.id) : ++circuitCount;
    if (!savedCircuitData) circuitCount = Math.max(circuitCount, internalId);

    const newCircuitDiv = document.createElement('div');
    newCircuitDiv.innerHTML = getCircuitHTML(internalId); // Usa HTML completo
    const circuitElement = newCircuitDiv.firstElementChild;
    if(!circuitElement) { console.error("Falha ao criar elemento Circuito."); return; }

    if (isNewCircuit) { circuitElement.classList.add('collapsed'); }

    const circuitContainer = document.getElementById(`circuits-for-qdc-${qdcId}`);
    if (circuitContainer) {
        circuitContainer.appendChild(circuitElement);
        // Listeners para recalcular cargas
        const powerInput = circuitElement.querySelector(`#potenciaW-${internalId}`);
        const demandInput = circuitElement.querySelector(`#fatorDemanda-${internalId}`);
        const btuSelect = circuitElement.querySelector(`#potenciaBTU-${internalId}`);
        const cvSelect = circuitElement.querySelector(`#potenciaCV-${internalId}`);
        if(powerInput) powerInput.addEventListener('input', updateFeederPowerDisplay);
        if(demandInput) demandInput.addEventListener('input', updateFeederPowerDisplay);
        if(btuSelect) btuSelect.addEventListener('change', () => handlePowerUnitChange(internalId, 'btu'));
        if(cvSelect) cvSelect.addEventListener('change', () => handlePowerUnitChange(internalId, 'cv'));
    } else { console.error(`Circuit container for QDC ${qdcId} not found!`); return; }

    // Preenche dados se existirem
    if (savedCircuitData) { /* ... (lógica de preenchimento inalterada) ... */ }

    // Inicializa dropdowns dependentes e específicos
    atualizarLigacoes(internalId);
    handleInsulationChange(internalId);
    handleCircuitTypeChange(internalId);

    // Popula dropdowns de BTU/CV/Solo
    const potenciaBTUSelect = document.getElementById(`potenciaBTU-${internalId}`);
    const potenciaCVSelect = document.getElementById(`potenciaCV-${internalId}`);
    const resistividadeSolo = document.getElementById(`resistividadeSolo-${internalId}`);
    if(uiData) { populateBtuDropdown(potenciaBTUSelect, uiData.ar_condicionado_btu); populateCvDropdown(potenciaCVSelect, uiData.motores_cv); populateSoilResistivityDropdown(resistividadeSolo, uiData.fatores_k2); }

    // Restaura valores de dropdowns APÓS população e inicialização
     if (savedCircuitData) { setTimeout(() => { /* ... (lógica de restauração com timeouts) ... */ }, 10); }
     else { updateFeederPowerDisplay(); } // Atualiza display se for circuito novo
}


export function removeCircuit(circuitId) { /* ... (inalterada) ... */ }

// ========================================================================
// >>>>> FUNÇÃO ATUALIZADA: getCircuitHTML <<<<<
// HTML COMPLETO RESTAURADO
// ========================================================================
function getCircuitHTML(id) {
    // **HTML Completo Restaurado**
    return `<div class="circuit-block" id="circuit-${id}" data-id="${id}"> <div class="circuit-header"> <h3 class="circuit-header-left">Circuito <span class="circuit-number"></span></h3> <h3 class="circuit-header-center" id="nomeCircuitoLabel-${id}">Circuito ${id}</h3> <div class="circuit-header-right"> <button type="button" class="remove-circuit-btn btn-red" data-circuit-id="${id}">Remover</button> <span class="toggle-arrow">▼</span> </div> </div> <div class="circuit-content"> <div class="form-grid"> <div class="form-group"> <label for="nomeCircuito-${id}">Nome do Circuito</label> <input type="text" id="nomeCircuito-${id}" value="Circuito ${id}"> </div> <div class="full-width potencia-group"> <div class="form-group"> <label for="tipoCircuito-${id}">Tipo de Circuito</label> <select id="tipoCircuito-${id}"> <option value="iluminacao">Iluminação</option> <option value="tug" selected>TUG</option> <option value="tue">TUE</option> <option value="aquecimento">Aquecimento</option> <option value="motores">Motores</option> <option value="ar_condicionado">Ar Condicionado</option> </select> </div> <div class="form-group hidden" id="potenciaBTU_group-${id}"> <label for="potenciaBTU-${id}">Potência (BTU/h)</label> <select id="potenciaBTU-${id}"></select> </div> <div class="form-group hidden" id="potenciaCV_group-${id}"> <label for="potenciaCV-${id}">Potência (CV)</label> <select id="potenciaCV-${id}"></select> </div> <div class="form-group"> <label for="potenciaW-${id}">Potência (W)</label> <input type="number" id="potenciaW-${id}" value="2500"> </div> </div> <div class="form-group"> <label for="fatorDemanda-${id}">Fator Demanda (%)</label> <input type="number" id="fatorDemanda-${id}" value="100" step="1"> </div> <div class="form-group"> <label for="fases-${id}">Fases</label> <select id="fases-${id}"> <option value="Monofasico" selected>Monofásico</option> <option value="Bifasico">Bifásico</option> <option value="Trifasico">Trifásico</option> </select> </div> <div class="form-group"> <label for="tipoLigacao-${id}">Ligação</label> <select id="tipoLigacao-${id}"></select> </div> <div class="form-group"> <label for="tensaoV-${id}">Tensão (V)</label> <select id="tensaoV-${id}"><option value="12">12</option><option value="24">24</option><option value="36">36</option><option value="127">127</option><option value="220" selected>220</option><option value="380">380</option><option value="440">440</option><option value="760">760</option></select> </div> <div class="form-group"> <label for="fatorPotencia-${id}">Fator Potência</label> <input type="number" id="fatorPotencia-${id}" step="0.01" value="0.92"> </div> <div class="form-group"> <label for="comprimentoM-${id}">Comprimento (m)</label> <input type="number" id="comprimentoM-${id}" value="20"> </div> <div class="form-group"> <label for="tipoIsolacao-${id}">Isolação</label> <select id="tipoIsolacao-${id}"><option value="PVC" selected>PVC 70°C</option><option value="EPR">EPR 90°C</option><option value="XLPE">XLPE 90°C</option></select> </div> <div class="form-group"> <label for="materialCabo-${id}">Condutor</label> <select id="materialCabo-${id}"><option value="Cobre" selected>Cobre</option><option value="Aluminio">Alumínio</option></select> </div> <div class="form-group"> <label for="metodoInstalacao-${id}">Instalação</label> <select id="metodoInstalacao-${id}"><option value="A1">A1</option><option value="A2">A2</option><option value="B1" selected>B1</option><option value="B2">B2</option><option value="C">C</option><option value="D">D</option></select> </div> <div class="form-group"> <label for="temperaturaAmbienteC-${id}">Temp. Ambiente</label> <select id="temperaturaAmbienteC-${id}"></select> </div> <div class="form-group"> <label for="resistividadeSolo-${id}">Resist. Solo</label> <select id="resistividadeSolo-${id}"></select> </div> <div class="form-group"> <label for="numCircuitosAgrupados-${id}">Ckt Agrupados</label> <select id="numCircuitosAgrupados-${id}"><option value="1" selected>1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option></select> </div> <div class="form-group"> <label for="limiteQuedaTensao-${id}">Limite DV (%)</label> <input type="number" id="limiteQuedaTensao-${id}" step="0.1" value="4.0"> </div> <div class="form-group"> <label for="tipoDisjuntor-${id}">Disjuntor</label> <select id="tipoDisjuntor-${id}"><option value="Minidisjuntor (DIN)">DIN</option><option value="Caixa Moldada (MCCB)">MCCB</option></select> </div> <div class="form-group"> <label for="dpsClasse-${id}">Classe DPS</label> <select id="dpsClasse-${id}"><option value="">Nenhum</option><option value="I">I</option><option value="II">II</option></select> </div> <div class="checkbox-group"> <input type="checkbox" id="requerDR-${id}"><label for="requerDR-${id}">Requer DR</label> </div> </div> </div> </div>`;
}

function initializeFeederListeners() { /* ... (inalterada) ... */ }
function initializeQdcListeners(id) { /* ... (inalterada) ... */ }
function atualizarQdcLigacoes(id) { /* ... (inalterada) ... */ }
function handleQdcInsulationChange(id) { /* ... (inalterada) ... */ }
function handlePowerUnitChange(id, type) { /* ... (inalterada) ... */ }
export function handleMainContainerInteraction(event) { /* ... (inalterada) ... */ }
function atualizarLigacoes(id) { /* ... (inalterada) ... */ }
function handleInsulationChange(id) { /* ... (inalterada) ... */ }
function handleCircuitTypeChange(id) { /* ... (inalterada) ... */ }

// --- Funções de preenchimento de formulário ---
// ... (Populate functions inalteradas, exceto populateProjectList) ...
export function populateProjectList(projects) {
    const select = document.getElementById('savedProjectsSelect');
    if(!select) { console.error("Elemento 'savedProjectsSelect' não encontrado."); return; }
    const currentValue = select.value;
    select.innerHTML = '<option value="">-- Selecione uma obra --</option>';
    if (projects && Array.isArray(projects)) {
        projects.forEach(p => {
            const o = document.createElement('option');
            o.value = p.id;
            o.textContent = `${p.project_code ?? 'S/C'} - ${p.project_name ?? 'Obra sem nome'}`;
            select.appendChild(o);
        });
        if(projects.some(p => p.id == currentValue)) { select.value = currentValue; }
    } else { console.warn("Nenhum projeto encontrado ou dados inválidos para popular lista."); }
}
export function populateFormWithProjectData(project) { /* ... (inalterada) ... */ }
export function populateUsersPanel(users) { /* ... */ }
export function populateEditUserModal(d) { /* ... */ }
export function populateProjectsPanel(projects, clients, users, currentUserProfile) { /* ... */ }
export function populateClientManagementModal(clients) { /* ... */ }
export function resetClientForm() { /* ... */ }
export function openEditClientForm(c) { /* ... */ }
export function populateSelectClientModal(clients, isChange = false) { /* ... */ }


// --- FUNÇÕES DE GERAÇÃO DE PDF ---
// ... (Funções draw* e buildUnifilarSvgString com verificações ??) ...
// generateMemorialPdf com debug logs e agrupamento (inalterada da última resposta)
export function generateMemorialPdf(calculationResults, currentUserProfile) {
    if (!calculationResults) { alert("Execute o cálculo primeiro."); return; }
    const { feederResult, circuitResults } = calculationResults;
    if (!feederResult) { alert("Dados do alimentador geral ausentes. Não é possível gerar Memorial."); return;}

    console.log("--- Debugging generateMemorialPdf ---");
    console.log("Feeder Result Dados:", feederResult?.dados);
    console.log("Circuit Results Received:", circuitResults);
    if (circuitResults && circuitResults.length > 0 && circuitResults[0]?.dados) { // Verifica dados no primeiro
        console.log("Checking for qdcId in first circuit:", circuitResults[0].dados.qdcId);
        console.log("Data type of qdcId in first circuit:", typeof circuitResults[0].dados.qdcId);
    }

    const circuitsByQdc = {};
    if (circuitResults && Array.isArray(circuitResults)) {
        circuitResults.forEach(result => {
            // Garante que qdcId seja tratado como string para chave do objeto
            if (result?.dados && (result.dados.qdcId !== undefined && result.dados.qdcId !== null)) {
                const qdcId = String(result.dados.qdcId);
                if (!circuitsByQdc[qdcId]) circuitsByQdc[qdcId] = [];
                circuitsByQdc[qdcId].push(result);
            } else {
                console.warn("Resultado de circuito inválido ou sem qdcId:", result);
                if (!circuitsByQdc['unknown']) circuitsByQdc['unknown'] = [];
                if(result) circuitsByQdc['unknown'].push(result);
            }
        });
    } else { console.warn("circuitResults não é um array ou está vazio:", circuitResults); }

    console.log("Circuits Grouped by QDC:", circuitsByQdc);
    console.log("------------------------------------");

    const { jsPDF } = window.jspdf; const doc = new jsPDF('p', 'mm', 'a4'); let yPos = 20; const lM = 15; const vM = 75;
    const addT = (t) => { doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.text(t, 105, yPos, { align: 'center' }); yPos += 12; };
    const addS = (t) => { if (yPos > 260) { doc.addPage(); yPos = 20; } doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text(t, lM, yPos); yPos += 8; };
    const addL = (l, v) => { if (yPos > 270) { doc.addPage(); yPos = 20; } doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text(l, lM, yPos); doc.setFont('helvetica', 'normal'); doc.text(String(v ?? '-'), vM, yPos, { maxWidth: doc.internal.pageSize.width - vM - lM }); yPos += 6; };
    const reportData = feederResult?.dados || {};

    // --- Página 1: Dados Gerais e Resumos ---
    addT("RELATÓRIO DE PROJETO ELÉTRICO"); addS("DADOS DO CLIENTE"); /*...*/ yPos += 5; addS("DADOS DA OBRA"); /*...*/ yPos += 5; addS("INFORMAÇÕES DO RESPONSÁVEL TÉCNICO"); /*...*/ yPos += 5; addS("INFORMAÇÕES DO RELATÓRIO"); /*...*/ yPos += 5; addS("RESUMO DA ALIMENTAÇÃO GERAL"); /*...*/

    // Loop Resumo Circuitos por QDC
    const qdcOrder = Object.keys(circuitsByQdc).filter(id => id !== 'unknown').sort((a,b) => parseInt(a) - parseInt(b));
    qdcOrder.forEach(qdcId => { /* ... (igual antes) ... */ });
    if (circuitsByQdc['unknown']?.length > 0) { /* ... (igual antes) ... */ }

    // Páginas Detalhadas
    if (feederResult) { doc.addPage(); yPos = 20; generateMemorialPage(doc, feederResult, "ALIMENTADOR GERAL", 0, addT, addS, addL, () => yPos, (newY) => yPos = newY); }
    qdcOrder.forEach(qdcId => { /* ... (igual antes) ... */ });

    try { doc.save(`Memorial_${document.getElementById('obra')?.value || 'Projeto'}.pdf`); } catch (e) { console.error("Erro ao salvar PDF Memorial:", e); alert("Erro ao salvar PDF Memorial: " + e.message); }
}

function generateMemorialPage(doc, result, titlePrefix, circuitIndex, addT, addS, addL, getY, setY) {
    const { dados, calculos } = result || {}; if (!dados || !calculos) { /* ... (erro) ... */ return; }
    // ... (restante da função inalterada) ...
}
// generateUnifilarPdf (inalterada)
export async function generateUnifilarPdf(calculationResults) { /* ... */ }


console.log("--- ui.js: Fim do arquivo ---");