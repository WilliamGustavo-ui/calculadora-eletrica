// Arquivo: ui.js (CORRIGIDO - HTML Restaurado + Carga Hierárquica VISUAL + Debug Memorial)

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

    if (uiData?.fatores_k1 && Array.isArray(uiData.fatores_k1)) { // Adiciona verificação Array
        tempOptions.pvc = uiData.fatores_k1.filter(f => f.fator > 0).map(f => f.temperatura_c).sort((a, b) => a - b);
    } else {
        tempOptions.pvc = [30];
        console.warn("Dados de fatores_k1 (PVC) não encontrados, inválidos ou não são array.");
    }
    // Garante que pvc tenha pelo menos o valor 30
    if (!tempOptions.pvc.includes(30)) tempOptions.pvc.push(30);
    tempOptions.pvc.sort((a,b) => a - b);


    if (uiData?.fatores_k1_epr && Array.isArray(uiData.fatores_k1_epr)) { // Adiciona verificação Array
        tempOptions.epr = uiData.fatores_k1_epr.filter(f => f.fator > 0).map(f => f.temperatura_c).sort((a, b) => a - b);
    } else {
        tempOptions.epr = [...tempOptions.pvc]; // Copia do pvc se epr falhar
        console.warn("Dados de fatores_k1_epr não encontrados, inválidos ou não são array. Usando opções de PVC.");
    }
     // Garante que epr tenha pelo menos o valor 30 (ou o que veio do pvc)
    if (tempOptions.epr.length === 0) tempOptions.epr = [30];
    tempOptions.epr.sort((a,b) => a - b);
}

function populateTemperatureDropdown(selectElement, temperatures) {
    if (!selectElement || !temperatures || !Array.isArray(temperatures)) {
         console.warn("populateTemperatureDropdown: Elemento ou dados de temperatura inválidos/ausentes.");
         return;
    }
    const currentValue = selectElement.value; // Guarda valor atual ANTES de limpar
    selectElement.innerHTML = ''; // Limpa opções

    // Adiciona apenas temperaturas válidas
    const validTemps = temperatures.filter(temp => typeof temp === 'number' && !isNaN(temp));
    if (validTemps.length === 0) {
        console.warn("Nenhuma temperatura válida para popular dropdown.");
        validTemps.push(30); // Adiciona 30 como fallback se vazio
    }

    validTemps.forEach(temp => {
        const option = document.createElement('option');
        option.value = temp;
        option.textContent = `${temp}°C`;
        selectElement.appendChild(option);
    });

    // Tenta restaurar valor ou definir padrão
    if (validTemps.map(String).includes(currentValue)) {
        selectElement.value = currentValue;
    } else if (validTemps.includes(30)) {
        selectElement.value = '30';
    } else { // Se 30 não estiver na lista, seleciona o primeiro
        selectElement.value = validTemps[0];
    }
}

function populateBtuDropdown(selectElement, btuData) {
    if (!selectElement) return;
    selectElement.innerHTML = '<option value="">-- Selecione --</option>';
    if (!btuData || !Array.isArray(btuData)) { console.warn("Dados de BTU inválidos ou ausentes."); return; }
    btuData
        .map(item => ({ ...item, valor_btu: parseFloat(item.valor_btu) }))
        .filter(item => !isNaN(item.valor_btu))
        .sort((a, b) => a.valor_btu - b.valor_btu)
        .forEach(item => { const option = document.createElement('option'); option.value = item.valor_btu; option.textContent = item.descricao; selectElement.appendChild(option); });
}

function populateCvDropdown(selectElement, cvData) {
     if (!selectElement) return;
    selectElement.innerHTML = '<option value="">-- Selecione --</option>';
    if (!cvData || !Array.isArray(cvData)) { console.warn("Dados de CV inválidos ou ausentes."); return; }
     cvData
        .map(item => ({ ...item, valor_cv: parseFloat(item.valor_cv) }))
        .filter(item => !isNaN(item.valor_cv))
        .sort((a, b) => a.valor_cv - b.valor_cv)
        .forEach(item => { const option = document.createElement('option'); option.value = item.valor_cv; option.textContent = item.descricao; selectElement.appendChild(option); });
}

function populateSoilResistivityDropdown(selectElement, soilData) {
    if (!selectElement) return;
    selectElement.innerHTML = '<option value="0">Não Aplicável</option>';
    if (!soilData || !Array.isArray(soilData)) { console.warn("Dados de resistividade do solo inválidos ou ausentes."); return; }
    soilData
        .map(item => ({ ...item, resistividade: parseFloat(item.resistividade) }))
        .filter(item => !isNaN(item.resistividade))
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
export function openModal(modalId) { const modal = document.getElementById(modalId); if(modal) modal.style.display = 'flex'; }
export function closeModal(modalId) { const modal = document.getElementById(modalId); if(modal) modal.style.display = 'none'; }

// ========================================================================
// >>>>> FUNÇÃO REESCRITA: updateFeederPowerDisplay <<<<<
// Implementa cálculo e exibição hierárquica da carga DEMANDADA
// ========================================================================
function updateFeederPowerDisplay() {
    const qdcData = {}; // Armazena { installedDirect: number, demandedDirect: number, parentId: string, childrenIds: string[], aggregatedDemand: number }
    let totalInstalledGeneral = 0; // Instalada geral é sempre a soma direta

    // 1. Coleta dados diretos e estrutura hierárquica inicial
    document.querySelectorAll('#qdc-container .qdc-block').forEach(qdcBlock => {
        const qdcId = qdcBlock.dataset.id;
        if (!qdcId) return;

        let installedDirect = 0;
        let demandedDirect = 0;

        qdcBlock.querySelectorAll('.circuit-block').forEach(circuitBlock => {
            const id = circuitBlock.dataset.id;
             if (!id) return;
            const potenciaWInput = document.getElementById(`potenciaW-${id}`);
            const fatorDemandaInput = document.getElementById(`fatorDemanda-${id}`);
            if (potenciaWInput && fatorDemandaInput) {
                const potenciaW = parseFloat(potenciaWInput.value) || 0;
                const fatorDemanda = (parseFloat(fatorDemandaInput.value) || 100) / 100.0;
                installedDirect += potenciaW;
                demandedDirect += (potenciaW * fatorDemanda);
            }
        });

        totalInstalledGeneral += installedDirect;

        const parentSelect = document.getElementById(`qdcParent-${qdcId}`);
        const parentId = parentSelect ? parentSelect.value : 'feeder';

        qdcData[qdcId] = {
            installedDirect: installedDirect, demandedDirect: demandedDirect, parentId: parentId, childrenIds: [], aggregatedDemand: -1 // Marca como não calculado
        };

        const qdcPotInstEl = document.getElementById(`qdcPotenciaInstalada-${qdcId}`);
        if (qdcPotInstEl) qdcPotInstEl.value = installedDirect.toFixed(2);
    });

    // 2. Constrói a lista de filhos
    Object.keys(qdcData).forEach(qdcId => {
        const parentId = qdcData[qdcId].parentId;
        if (parentId !== 'feeder' && qdcData[parentId]) {
            qdcData[parentId].childrenIds.push(qdcId);
        }
    });

    // 3. Função recursiva para calcular demanda agregada
    const visited = new Set();
    function calculateAggregatedDemand(qdcId) {
        if (!qdcData[qdcId]) return 0;
        if (qdcData[qdcId].aggregatedDemand !== -1) return qdcData[qdcId].aggregatedDemand;
        if (visited.has(qdcId)) { console.error(`Loop detectado ${qdcId}`); return qdcData[qdcId].demandedDirect; }
        visited.add(qdcId);

        let aggregatedDemand = qdcData[qdcId].demandedDirect;
        qdcData[qdcId].childrenIds.forEach(childId => {
            aggregatedDemand += calculateAggregatedDemand(childId);
        });

        visited.delete(qdcId);
        qdcData[qdcId].aggregatedDemand = aggregatedDemand;
        return aggregatedDemand;
    }

    // 4. Calcula e atualiza displays
    let totalDemandAggregatedGeneral = 0;
    Object.keys(qdcData).forEach(qdcId => {
        visited.clear();
        const aggregatedDemand = calculateAggregatedDemand(qdcId);
        const qdcPotDemEl = document.getElementById(`qdcPotenciaDemandada-${qdcId}`);
        if (qdcPotDemEl) qdcPotDemEl.value = aggregatedDemand.toFixed(2);
        if (qdcData[qdcId].parentId === 'feeder') {
            totalDemandAggregatedGeneral += aggregatedDemand;
        }
    });

    // 5. Atualiza Alimentador Geral
    const feederPotInstaladaEl = document.getElementById('feederPotenciaInstalada');
    const feederSomaPotDemandadaEl = document.getElementById('feederSomaPotenciaDemandada');
    const feederFatorDemandaInput = document.getElementById('feederFatorDemanda');
    const feederPotDemandadaFinalEl = document.getElementById('feederPotenciaDemandada');

    if (feederPotInstaladaEl) feederPotInstaladaEl.value = totalInstalledGeneral.toFixed(2);
    if (feederSomaPotDemandadaEl) feederSomaPotDemandadaEl.value = totalDemandAggregatedGeneral.toFixed(2);

    const feederFatorDemanda = (parseFloat(feederFatorDemandaInput?.value) || 100) / 100.0;
    const finalDemandGeral = totalDemandAggregatedGeneral * feederFatorDemanda;

    if (feederPotDemandadaFinalEl) feederPotDemandadaFinalEl.value = finalDemandGeral.toFixed(2);

    // console.warn("Aviso: Exibição da carga hierárquica ATIVA. O dimensionamento real pela Edge Function ainda é PLANO."); // Removido por ser repetitivo
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
    if (linkedClient && clientLinkDisplay && currentClientIdInput) {
        clientLinkDisplay.textContent = `Cliente Vinculado: ${linkedClient.nome} (${linkedClient.client_code || 'S/C'})`;
        currentClientIdInput.value = linkedClient.id;
    } else if (clientLinkDisplay && currentClientIdInput){
        clientLinkDisplay.textContent = 'Cliente: Nenhum';
        currentClientIdInput.value = '';
    }

    initializeFeederListeners(); // Precisa ser chamado *antes* de addQdcBlock
    qdcCount = 0;
    circuitCount = 0;

    if (addDefaultQdc) {
        addQdcBlock();
    }
    // updateFeederPowerDisplay será chamado ao adicionar QDC/circuito
}

// ========================================================================
// >>>>> FUNÇÃO ATUALIZADA: getQdcHTML <<<<<
// HTML COMPLETO RESTAURADO
// ========================================================================
function getQdcHTML(id, name = `QDC ${id}`, parentId = 'feeder') {
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
    newQdcDiv.innerHTML = getQdcHTML(internalId, qdcName, parentId); // Usa a função com HTML completo
    const qdcElement = newQdcDiv.firstElementChild;
    if(!qdcElement) { console.error("Falha ao criar elemento QDC."); return; }

    const qdcContainer = document.getElementById('qdc-container');
    if(qdcContainer) qdcContainer.appendChild(qdcElement);
    else { console.error("Container principal de QDCs não encontrado."); return;}

    // Adiciona listener direto ao botão '+ Circuito' *DEPOIS* de adicionar ao DOM
    const addCircuitBtn = qdcElement.querySelector('.add-circuit-to-qdc-btn');
    if (addCircuitBtn) {
        addCircuitBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            console.log(`Botão + Circuito clicado para QDC ${internalId}`); // Log de clique
            addCircuit(internalId); // Usa o ID correto
        });
    } else {
        // Este log não deve mais ocorrer se getQdcHTML estiver correto
        console.error(`Botão '+ Circuito' não encontrado para QDC ${internalId} após adicionar ao DOM.`);
    }

    updateQdcParentDropdowns(); // Atualiza dropdowns
    initializeQdcListeners(internalId); // Adiciona outros listeners

    // Colapsa se necessário
    if ((isNewQdc && qdcCount > 1) || (!isNewQdc && qdcElement.previousElementSibling)) {
         if (!qdcElement.classList.contains('collapsed')) {
            qdcElement.classList.add('collapsed');
         }
    }

    // Adiciona circuito inicial se for novo
    if (isNewQdc) {
       addCircuit(internalId);
    }

    // Listener para recalcular cargas quando o parent mudar
    const parentSelect = qdcElement.querySelector('.qdc-parent-select');
    if(parentSelect) {
        parentSelect.addEventListener('change', updateFeederPowerDisplay);
    }

    updateFeederPowerDisplay(); // Atualiza display geral
    return internalId;
}

export function removeQdc(qdcId) {
    // ... (inalterada) ...
}

export function updateQdcParentDropdowns() {
   // ... (inalterada) ...
}


// --- LÓGICA DE CIRCUITO ---
// addCircuit com collapse padrão
export function addCircuit(qdcId, savedCircuitData = null) {
    const isNewCircuit = !savedCircuitData;
    const internalId = savedCircuitData ? parseInt(savedCircuitData.id) : ++circuitCount;
    if (!savedCircuitData) circuitCount = Math.max(circuitCount, internalId);

    const newCircuitDiv = document.createElement('div');
    newCircuitDiv.innerHTML = getCircuitHTML(internalId); // Usa a função com HTML completo
    const circuitElement = newCircuitDiv.firstElementChild;
    if(!circuitElement) { console.error("Falha ao criar elemento Circuito."); return; }


    if (isNewCircuit) {
        circuitElement.classList.add('collapsed');
    }

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

    } else {
        console.error(`Circuit container for QDC ${qdcId} not found! Cannot add circuit.`);
        return;
    }

    // Preenche dados se existirem
    if (savedCircuitData) {
        Object.keys(savedCircuitData).forEach(key => {
            const element = document.getElementById(key); // Busca pelo ID completo (ex: potenciaW-5)
            if (element) {
                if (element.type === 'checkbox') { element.checked = !!savedCircuitData[key]; }
                else { element.value = savedCircuitData[key]; }
            }
        });
        const nameInput = document.getElementById(`nomeCircuito-${internalId}`);
        const nameLabel = document.getElementById(`nomeCircuitoLabel-${internalId}`);
        if(nameInput && nameInput.value && nameLabel) {
            nameLabel.textContent = nameInput.value;
        }
    }

    // Inicializa dropdowns dependentes e específicos
    atualizarLigacoes(internalId);
    handleInsulationChange(internalId);
    handleCircuitTypeChange(internalId); // Chama APÓS preencher dados salvos, se houver

    // Popula dropdowns de BTU/CV/Solo
    const potenciaBTUSelect = document.getElementById(`potenciaBTU-${internalId}`);
    const potenciaCVSelect = document.getElementById(`potenciaCV-${internalId}`);
    const resistividadeSolo = document.getElementById(`resistividadeSolo-${internalId}`);

    if(uiData) {
        populateBtuDropdown(potenciaBTUSelect, uiData.ar_condicionado_btu);
        populateCvDropdown(potenciaCVSelect, uiData.motores_cv);
        populateSoilResistivityDropdown(resistividadeSolo, uiData.fatores_k2);
    }

    // Restaura valores de dropdowns populados se existirem nos dados salvos
     if (savedCircuitData) {
        if(potenciaBTUSelect && savedCircuitData[`potenciaBTU-${internalId}`]) potenciaBTUSelect.value = savedCircuitData[`potenciaBTU-${internalId}`];
        if(potenciaCVSelect && savedCircuitData[`potenciaCV-${internalId}`]) potenciaCVSelect.value = savedCircuitData[`potenciaCV-${internalId}`];
        if(resistividadeSolo && savedCircuitData[`resistividadeSolo-${internalId}`]) resistividadeSolo.value = savedCircuitData[`resistividadeSolo-${internalId}`];

        // Restaura ligação e temperatura APÓS atualização inicial
        const tipoLigacaoSelect = document.getElementById(`tipoLigacao-${internalId}`);
        if(tipoLigacaoSelect && savedCircuitData[`tipoLigacao-${internalId}`]) {
            setTimeout(() => { if (document.getElementById(tipoLigacaoSelect.id)) tipoLigacaoSelect.value = savedCircuitData[`tipoLigacao-${internalId}`]; }, 0); // Adiciona verificação se elemento ainda existe
        }
        const temperaturaAmbiente = document.getElementById(`temperaturaAmbienteC-${internalId}`);
        if(temperaturaAmbiente && savedCircuitData[`temperaturaAmbienteC-${internalId}`]) {
             setTimeout(() => { if (document.getElementById(temperaturaAmbiente.id)) temperaturaAmbiente.value = savedCircuitData[`temperaturaAmbienteC-${internalId}`]; }, 0); // Adiciona verificação
        }
    }
     // Recalcula display geral APÓS adicionar um circuito
     updateFeederPowerDisplay();
}


export function removeCircuit(circuitId) {
    // ... (inalterada) ...
}

// ========================================================================
// >>>>> FUNÇÃO ATUALIZADA: getCircuitHTML <<<<<
// HTML COMPLETO RESTAURADO
// ========================================================================
function getCircuitHTML(id) {
    return `<div class="circuit-block" id="circuit-${id}" data-id="${id}"> <div class="circuit-header"> <h3 class="circuit-header-left">Circuito <span class="circuit-number"></span></h3> <h3 class="circuit-header-center" id="nomeCircuitoLabel-${id}">Circuito ${id}</h3> <div class="circuit-header-right"> <button type="button" class="remove-circuit-btn btn-red" data-circuit-id="${id}">Remover</button> <span class="toggle-arrow">▼</span> </div> </div> <div class="circuit-content"> <div class="form-grid"> <div class="form-group"> <label for="nomeCircuito-${id}">Nome do Circuito</label> <input type="text" id="nomeCircuito-${id}" value="Circuito ${id}"> </div> <div class="full-width potencia-group"> <div class="form-group"> <label for="tipoCircuito-${id}">Tipo de Circuito</label> <select id="tipoCircuito-${id}"> <option value="iluminacao">Iluminação</option> <option value="tug" selected>TUG</option> <option value="tue">TUE</option> <option value="aquecimento">Aquecimento</option> <option value="motores">Motores</option> <option value="ar_condicionado">Ar Condicionado</option> </select> </div> <div class="form-group hidden" id="potenciaBTU_group-${id}"> <label for="potenciaBTU-${id}">Potência (BTU/h)</label> <select id="potenciaBTU-${id}"></select> </div> <div class="form-group hidden" id="potenciaCV_group-${id}"> <label for="potenciaCV-${id}">Potência (CV)</label> <select id="potenciaCV-${id}"></select> </div> <div class="form-group"> <label for="potenciaW-${id}">Potência (W)</label> <input type="number" id="potenciaW-${id}" value="2500"> </div> </div> <div class="form-group"> <label for="fatorDemanda-${id}">Fator Demanda (%)</label> <input type="number" id="fatorDemanda-${id}" value="100" step="1"> </div> <div class="form-group"> <label for="fases-${id}">Fases</label> <select id="fases-${id}"> <option value="Monofasico" selected>Monofásico</option> <option value="Bifasico">Bifásico</option> <option value="Trifasico">Trifásico</option> </select> </div> <div class="form-group"> <label for="tipoLigacao-${id}">Ligação</label> <select id="tipoLigacao-${id}"></select> </div> <div class="form-group"> <label for="tensaoV-${id}">Tensão (V)</label> <select id="tensaoV-${id}"><option value="12">12</option><option value="24">24</option><option value="36">36</option><option value="127">127</option><option value="220" selected>220</option><option value="380">380</option><option value="440">440</option><option value="760">760</option></select> </div> <div class="form-group"> <label for="fatorPotencia-${id}">Fator Potência</label> <input type="number" id="fatorPotencia-${id}" step="0.01" value="0.92"> </div> <div class="form-group"> <label for="comprimentoM-${id}">Comprimento (m)</label> <input type="number" id="comprimentoM-${id}" value="20"> </div> <div class="form-group"> <label for="tipoIsolacao-${id}">Isolação</label> <select id="tipoIsolacao-${id}"><option value="PVC" selected>PVC 70°C</option><option value="EPR">EPR 90°C</option><option value="XLPE">XLPE 90°C</option></select> </div> <div class="form-group"> <label for="materialCabo-${id}">Condutor</label> <select id="materialCabo-${id}"><option value="Cobre" selected>Cobre</option><option value="Aluminio">Alumínio</option></select> </div> <div class="form-group"> <label for="metodoInstalacao-${id}">Instalação</label> <select id="metodoInstalacao-${id}"><option value="A1">A1</option><option value="A2">A2</option><option value="B1" selected>B1</option><option value="B2">B2</option><option value="C">C</option><option value="D">D</option></select> </div> <div class="form-group"> <label for="temperaturaAmbienteC-${id}">Temp. Ambiente</label> <select id="temperaturaAmbienteC-${id}"></select> </div> <div class="form-group"> <label for="resistividadeSolo-${id}">Resist. Solo</label> <select id="resistividadeSolo-${id}"></select> </div> <div class="form-group"> <label for="numCircuitosAgrupados-${id}">Ckt Agrupados</label> <select id="numCircuitosAgrupados-${id}"><option value="1" selected>1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option></select> </div> <div class="form-group"> <label for="limiteQuedaTensao-${id}">Limite DV (%)</label> <input type="number" id="limiteQuedaTensao-${id}" step="0.1" value="4.0"> </div> <div class="form-group"> <label for="tipoDisjuntor-${id}">Disjuntor</label> <select id="tipoDisjuntor-${id}"><option value="Minidisjuntor (DIN)">DIN</option><option value="Caixa Moldada (MCCB)">MCCB</option></select> </div> <div class="form-group"> <label for="dpsClasse-${id}">Classe DPS</label> <select id="dpsClasse-${id}"><option value="">Nenhum</option><option value="I">I</option><option value="II">II</option></select> </div> <div class="checkbox-group"> <input type="checkbox" id="requerDR-${id}"><label for="requerDR-${id}">Requer DR</label> </div> </div> </div> </div>`;
}

function initializeFeederListeners() {
    const feederForm = document.getElementById('feeder-form');
    if (!feederForm) return;

    const fases = feederForm.querySelector('#feederFases');
    const tipoLigacao = feederForm.querySelector('#feederTipoLigacao');
    const tipoIsolacao = feederForm.querySelector('#feederTipoIsolacao');
    const temperaturaAmbiente = feederForm.querySelector('#feederTemperaturaAmbienteC');
    const resistividadeSolo = feederForm.querySelector('#feederResistividadeSolo');
    const fatorDemanda = feederForm.querySelector('#feederFatorDemanda');

    if (uiData && uiData.fatores_k2) { populateSoilResistivityDropdown(resistividadeSolo, uiData.fatores_k2); } // Verifica uiData

    const atualizarLigacoesFeeder = () => { if(!fases || !tipoLigacao) return; const f = fases.value; const l = ligacoes[f] || []; const current = tipoLigacao.value; tipoLigacao.innerHTML = ''; l.forEach(o => { const op = document.createElement('option'); op.value = o.value; op.textContent = o.text; tipoLigacao.appendChild(op); }); if(l.some(o=>o.value === current)) tipoLigacao.value = current; };
    const handleFeederInsulationChange = () => { if(!tipoIsolacao || !temperaturaAmbiente) return; const sel = tipoIsolacao.value; const t = (sel === 'EPR' || sel === 'XLPE') ? tempOptions.epr : tempOptions.pvc; populateTemperatureDropdown(temperaturaAmbiente, t); };

    if(fases) fases.addEventListener('change', atualizarLigacoesFeeder);
    if(tipoIsolacao) tipoIsolacao.addEventListener('change', handleFeederInsulationChange);
    if(fatorDemanda) fatorDemanda.addEventListener('input', updateFeederPowerDisplay);

    atualizarLigacoesFeeder();
    handleFeederInsulationChange();
}


function initializeQdcListeners(id) {
    const qdcBlock = document.getElementById(`qdc-${id}`);
    if (!qdcBlock) return;

    const fases = qdcBlock.querySelector(`#qdcFases-${id}`);
    const tipoIsolacao = qdcBlock.querySelector(`#qdcTipoIsolacao-${id}`);
    //const temperaturaAmbiente = qdcBlock.querySelector(`#qdcTemperaturaAmbienteC-${id}`);
    const resistividadeSolo = qdcBlock.querySelector(`#qdcResistividadeSolo-${id}`);
    const fatorDemandaQDC = qdcBlock.querySelector(`#qdcFatorDemanda-${id}`);

    if (uiData && uiData.fatores_k2) { populateSoilResistivityDropdown(resistividadeSolo, uiData.fatores_k2); }

    if(fases) fases.addEventListener('change', () => atualizarQdcLigacoes(id));
    if(tipoIsolacao) tipoIsolacao.addEventListener('change', () => handleQdcInsulationChange(id));
    if(fatorDemandaQDC) fatorDemandaQDC.addEventListener('input', updateFeederPowerDisplay); // Recalcula agregação

    atualizarQdcLigacoes(id); // Popula ligação inicial
    handleQdcInsulationChange(id); // Popula temp inicial
}

function atualizarQdcLigacoes(id) {
    const fasesSelect = document.getElementById(`qdcFases-${id}`);
    const tipoLigacaoSelect = document.getElementById(`qdcTipoLigacao-${id}`);
    if (!fasesSelect || !tipoLigacaoSelect) return;
    const f = fasesSelect.value; const l = ligacoes[f] || [];
    const current = tipoLigacaoSelect.value;
    tipoLigacaoSelect.innerHTML = ''; l.forEach(o => { const op = document.createElement('option'); op.value = o.value; op.textContent = o.text; tipoLigacaoSelect.appendChild(op); });
    if(l.some(o=>o.value === current)) tipoLigacaoSelect.value = current; // Restaura se possível
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
    const btuInput = document.getElementById(`potenciaBTU-${id}`);
    const cvInput = document.getElementById(`potenciaCV-${id}`);

    if (type === 'btu' && btuInput) {
        const btu = parseFloat(btuInput.value) || 0;
        pW.value = (btu * BTU_TO_WATTS_FACTOR).toFixed(2);
    } else if (type === 'cv' && cvInput) {
        const cv = parseFloat(cvInput.value) || 0;
        pW.value = (cv * CV_TO_WATTS_FACTOR).toFixed(2);
    }
    updateFeederPowerDisplay(); // Recalcula
}


// handleMainContainerInteraction SEM a lógica do addCircuitBtn
export function handleMainContainerInteraction(event) {
    const target = event.target;

    // --- Lógica de QDC (Remover, Colapsar, Renomear, E NOVOS CAMPOS) ---
    const qdcBlock = target.closest('.qdc-block');
    if (qdcBlock) {
        const qdcId = qdcBlock.dataset.id;
        if (!qdcId) return;

        const removeQdcButton = target.closest('.remove-qdc-btn');
        if (removeQdcButton) { removeQdc(qdcId); return; }

        if (target.classList.contains('qdc-name-input') && event.type === 'input') { updateQdcParentDropdowns(); return; }
        if (target.classList.contains('qdc-parent-select') && event.type === 'change') { updateFeederPowerDisplay(); return; }

        // Gatilhos internos
        if (target.id === `qdcFases-${qdcId}`) { atualizarQdcLigacoes(qdcId); }
        else if (target.id === `qdcTipoIsolacao-${qdcId}`) { handleQdcInsulationChange(qdcId); }

        // Colapsar/Expandir
        const qdcHeader = target.closest('.qdc-header');
        if (qdcHeader && !target.closest('.qdc-header-right button, .qdc-header-left input, .qdc-header-center select')) { qdcBlock.classList.toggle('collapsed'); return; }
    }

    // --- Lógica de Circuito (Remover, Colapsar, etc.) ---
    const circuitBlock = target.closest('.circuit-block');
    if (circuitBlock) {
        const circuitId = circuitBlock.dataset.id;
        if (!circuitId) return;

        // Colapsar/Expandir
        const circuitHeader = target.closest('.circuit-header');
        if (circuitHeader && !target.closest('.remove-circuit-btn')) { circuitBlock.classList.toggle('collapsed'); /* Não retorna */ }

        // Ações internas
        if (target.id === `nomeCircuito-${circuitId}` && event.type === 'input') { const lbl = document.getElementById(`nomeCircuitoLabel-${circuitId}`); if(lbl) lbl.textContent = target.value || `Circuito ${circuitId}`; }

        const removeCircuitButton = target.closest('.remove-circuit-btn');
        if (removeCircuitButton) { removeCircuit(circuitId); }
        // Listeners de mudança
        else if (target.id === `tipoCircuito-${circuitId}`) { handleCircuitTypeChange(circuitId); }
        else if (target.id === `fases-${circuitId}`) { atualizarLigacoes(circuitId); }
        else if (target.id === `tipoIsolacao-${circuitId}`) { handleInsulationChange(circuitId); }
        // Potência/Demanda já têm listeners diretos
    }
}


function atualizarLigacoes(id) {
    const fasesSelect = document.getElementById(`fases-${id}`);
    const tipoLigacaoSelect = document.getElementById(`tipoLigacao-${id}`);
    if (!fasesSelect || !tipoLigacaoSelect) return;
    const f = fasesSelect.value; const l = ligacoes[f] || [];
    const currentValue = tipoLigacaoSelect.value;
    tipoLigacaoSelect.innerHTML = ''; l.forEach(o => { const op = document.createElement('option'); op.value = o.value; op.textContent = o.text; tipoLigacaoSelect.appendChild(op); });
    if (l.some(o => o.value === currentValue)) { tipoLigacaoSelect.value = currentValue; }
}

function handleInsulationChange(id) {
    const tipoIsolacaoSelect = document.getElementById(`tipoIsolacao-${id}`);
    const tempAmbSelect = document.getElementById(`temperaturaAmbienteC-${id}`);
    if (!tipoIsolacaoSelect || !tempAmbSelect) return;
    const sel = tipoIsolacaoSelect.value; const t = (sel === 'EPR' || sel === 'XLPE') ? tempOptions.epr : tempOptions.pvc;
    populateTemperatureDropdown(tempAmbSelect, t);
}

function handleCircuitTypeChange(id) {
    const tipo = document.getElementById(`tipoCircuito-${id}`);
    const fd = document.getElementById(`fatorDemanda-${id}`);
    const pw = document.getElementById(`potenciaW-${id}`);
    const btuG = document.getElementById(`potenciaBTU_group-${id}`);
    const cvG = document.getElementById(`potenciaCV_group-${id}`);
    const btuSelect = document.getElementById(`potenciaBTU-${id}`);
    const cvSelect = document.getElementById(`potenciaCV-${id}`);

    if (!tipo || !fd || !pw || !btuG || !cvG || !btuSelect || !cvSelect) return;

    const selType = tipo.value;
    btuG.classList.add('hidden'); cvG.classList.add('hidden');
    pw.readOnly = false;

    if (selType === 'ar_condicionado') {
        btuG.classList.remove('hidden'); pw.readOnly = true;
        handlePowerUnitChange(id, 'btu'); // Calcula W inicial
    } else if (selType === 'motores') {
        cvG.classList.remove('hidden'); pw.readOnly = true;
        handlePowerUnitChange(id, 'cv'); // Calcula W inicial
    }
    // Não força 100% demanda para aquecimento, apenas calcula
    updateFeederPowerDisplay(); // Recalcula display geral
}


// --- Funções de preenchimento de formulário ---
// ... (Populate functions inalteradas) ...
export function populateProjectList(projects) { /* ... */ }
export function populateFormWithProjectData(project) {
     console.log("Populando formulário com dados do projeto:", project);
     resetForm(false, project.client); // Não adiciona QDC default, passa cliente

    const currentProjIdInput = document.getElementById('currentProjectId');
    if(currentProjIdInput) currentProjIdInput.value = project.id;

    // Preenche dados principais da obra
    if (project.main_data) {
        Object.keys(project.main_data).forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.value = project.main_data[id] ?? ''; } // Usa ?? para tratar null/undefined
        });
    }
    const projCodeInput = document.getElementById('project_code');
    if(projCodeInput) projCodeInput.value = project.project_code || ''; // Código gerado

    // Preenche dados técnicos
    if (project.tech_data) {
        Object.keys(project.tech_data).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = project.tech_data[id] ?? '';
        });
    }

    // Preenche dados do alimentador
    if (project.feeder_data) {
        Object.keys(project.feeder_data).forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (el.type === 'checkbox') el.checked = !!project.feeder_data[id]; // Garante boolean
                else el.value = project.feeder_data[id] ?? '';
            }
        });
        // Dispara eventos para atualizar dropdowns dependentes do alimentador
        const feederFases = document.getElementById('feederFases');
        if(feederFases) feederFases.dispatchEvent(new Event('change')); // Atualiza Tipo Ligação
        const feederTipoIsol = document.getElementById('feederTipoIsolacao');
        if(feederTipoIsol) feederTipoIsol.dispatchEvent(new Event('change')); // Atualiza Temp Ambiente

        // Restaura valores específicos APÓS eventos de change
        setTimeout(() => {
            const feederTipoLig = document.getElementById('feederTipoLigacao');
            if(feederTipoLig && project.feeder_data['feederTipoLigacao']) {
                 feederTipoLig.value = project.feeder_data['feederTipoLigacao'];
            }
             const feederTemp = document.getElementById('feederTemperaturaAmbienteC');
            if(feederTemp && project.feeder_data['feederTemperaturaAmbienteC']) {
                 feederTemp.value = project.feeder_data['feederTemperaturaAmbienteC'];
            }
        }, 0); // Timeout para garantir que opções foram populadas
    }

    // Limpa container de QDCs antes de adicionar os salvos
    const qdcContainer = document.getElementById('qdc-container');
    if(qdcContainer) qdcContainer.innerHTML = '';

    qdcCount = 0; circuitCount = 0; // Reseta contadores antes de recalcular máximos
    let maxQdcId = 0; let maxCircuitId = 0;

    // Adiciona QDCs e Circuitos salvos
    if (project.qdcs_data && Array.isArray(project.qdcs_data)) {
        project.qdcs_data.forEach((qdcData, index) => {
            const currentQdcId = parseInt(qdcData.id);
             if (isNaN(currentQdcId)) {
                console.warn("ID de QDC inválido encontrado nos dados salvos:", qdcData.id);
                return; // Pula QDC inválido
            }
            maxQdcId = Math.max(maxQdcId, currentQdcId); // Atualiza ID máximo

            // Passa 'false' para isNewQdc implícito dentro de addQdcBlock
            const newQdcIdReturned = addQdcBlock(currentQdcId, qdcData.name, qdcData.parentId);

            if (qdcData.circuits && Array.isArray(qdcData.circuits)) {
                qdcData.circuits.forEach(circuitData => {
                    const currentCircuitId = parseInt(circuitData.id);
                     if (!isNaN(currentCircuitId)) {
                         maxCircuitId = Math.max(maxCircuitId, currentCircuitId); // Atualiza ID máximo
                         // Passa os dados salvos para addCircuit
                         addCircuit(newQdcIdReturned, circuitData); // Usa o ID retornado por addQdcBlock
                     } else {
                          console.warn(`ID de Circuito inválido (${circuitData.id}) encontrado no QDC ${newQdcIdReturned}`);
                     }
                });
            }

            // Preenche os campos de configuração do QDC (após addQdcBlock ter criado os elementos)
            if (qdcData.config) {
                Object.keys(qdcData.config).forEach(elementId => { // Renomeado para elementId
                    const element = document.getElementById(elementId);
                    if (element) {
                        if (element.type === 'checkbox') { element.checked = !!qdcData.config[elementId]; }
                        else { element.value = qdcData.config[elementId] ?? ''; }
                    }
                });

                // Dispara eventos para atualizar dropdowns dependentes do QDC
                const qdcFases = document.getElementById(`qdcFases-${newQdcIdReturned}`);
                if(qdcFases) qdcFases.dispatchEvent(new Event('change'));
                const qdcTipoIsol = document.getElementById(`qdcTipoIsolacao-${newQdcIdReturned}`);
                 if(qdcTipoIsol) qdcTipoIsol.dispatchEvent(new Event('change'));

                // Restaura valores específicos APÓS eventos de change
                setTimeout(() => {
                    const qdcTipoLigacao = document.getElementById(`qdcTipoLigacao-${newQdcIdReturned}`);
                    if (qdcTipoLigacao && qdcData.config[`qdcTipoLigacao-${newQdcIdReturned}`]) {
                       if (document.getElementById(qdcTipoLigacao.id)) qdcTipoLigacao.value = qdcData.config[`qdcTipoLigacao-${newQdcIdReturned}`];
                    }
                    const qdcTemp = document.getElementById(`qdcTemperaturaAmbienteC-${newQdcIdReturned}`);
                    if (qdcTemp && qdcData.config[`qdcTemperaturaAmbienteC-${newQdcIdReturned}`]) {
                       if (document.getElementById(qdcTemp.id)) qdcTemp.value = qdcData.config[`qdcTemperaturaAmbienteC-${newQdcIdReturned}`];
                    }
                }, 50); // Aumenta timeout ligeiramente para garantir renderização
            }

            // Colapsa QDCs carregados (exceto o primeiro) - Lógica movida para addQdcBlock
            // if (index > 0) {
            //     const qdcElem = document.getElementById(`qdc-${newQdcIdReturned}`);
            //     if(qdcElem) qdcElem.classList.add('collapsed');
            // }
        });
    } else if (project.main_data) { // Se tem dados da obra mas nenhum QDC salvo, adiciona o default
         console.log("Nenhum QDC encontrado nos dados salvos, adicionando QDC 1 padrão.");
         addQdcBlock();
    }

    // Define os contadores globais para os próximos IDs a serem gerados
    qdcCount = maxQdcId;
    circuitCount = maxCircuitId;

    // Atualiza todos os dropdowns 'Alimentado por:' APÓS todos os QDCs terem sido adicionados
    updateQdcParentDropdowns();

    // Recalcula e atualiza o display de todas as cargas hierárquicas
    updateFeederPowerDisplay();
}

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
    if (circuitResults && circuitResults.length > 0) {
        console.log("Checking for qdcId in first circuit:", circuitResults[0]?.dados?.qdcId);
        console.log("Data type of qdcId in first circuit:", typeof circuitResults[0]?.dados?.qdcId);
    }

    const circuitsByQdc = {};
    if (circuitResults && Array.isArray(circuitResults)) {
        circuitResults.forEach(result => {
            // Verifica se qdcId existe e não é nulo/undefined
            if (result?.dados && (result.dados.qdcId !== undefined && result.dados.qdcId !== null)) {
                const qdcId = String(result.dados.qdcId); // Garante string
                if (!circuitsByQdc[qdcId]) {
                    circuitsByQdc[qdcId] = [];
                }
                circuitsByQdc[qdcId].push(result);
            } else {
                console.warn("Resultado de circuito inválido ou sem qdcId:", result);
                if (!circuitsByQdc['unknown']) circuitsByQdc['unknown'] = [];
                if(result) circuitsByQdc['unknown'].push(result); // Adiciona apenas se 'result' existir
            }
        });
    } else {
         console.warn("circuitResults não é um array ou está vazio:", circuitResults);
    }

    console.log("Circuits Grouped by QDC:", circuitsByQdc);
    console.log("------------------------------------");


    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    let yPos = 20;
    const lM = 15;
    const vM = 75;

    const addT = (t) => { doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.text(t, 105, yPos, { align: 'center' }); yPos += 12; };
    const addS = (t) => { if (yPos > 260) { doc.addPage(); yPos = 20; } doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text(t, lM, yPos); yPos += 8; };
    const addL = (l, v) => { if (yPos > 270) { doc.addPage(); yPos = 20; } doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text(l, lM, yPos); doc.setFont('helvetica', 'normal'); doc.text(String(v ?? '-'), vM, yPos, { maxWidth: doc.internal.pageSize.width - vM - lM }); yPos += 6; }; // Adiciona maxWidth

    const reportData = feederResult?.dados || {};

    // --- Página 1: Dados Gerais e Resumos ---
    addT("RELATÓRIO DE PROJETO ELÉTRICO");
    addS("DADOS DO CLIENTE");
    addL("Cliente:", reportData.cliente);
    addL(`Documento (${reportData.tipoDocumento || '?'}):`, reportData.documento);
    addL("Celular:", reportData.celular);
    addL("Telefone:", reportData.telefone);
    addL("E-mail:", reportData.email);
    addL("Endereço do Cliente:", reportData.enderecoCliente);
    yPos += 5;
    addS("DADOS DA OBRA");
    addL("Código da Obra:", reportData.projectCode || document.getElementById('project_code')?.value); // Tenta pegar do form se não veio
    addL("Nome da Obra:", reportData.obra || document.getElementById('obra')?.value);
    addL("Cidade da Obra:", reportData.cidadeObra || document.getElementById('cidadeObra')?.value);
    addL("Endereço da Obra:", reportData.enderecoObra || document.getElementById('enderecoObra')?.value);
    addL("Área da Obra (m²):", reportData.areaObra || document.getElementById('areaObra')?.value);
    addL("Unid. Residenciais:", reportData.unidadesResidenciais || document.getElementById('unidadesResidenciais')?.value);
    addL("Unid. Comerciais:", reportData.unidadesComerciais || document.getElementById('unidadesComerciais')?.value);
    addL("Observações:", reportData.observacoes || document.getElementById('observacoes')?.value);
    yPos += 5;
    addS("INFORMAÇÕES DO RESPONSÁVEL TÉCNICO");
    addL("Nome:", document.getElementById('respTecnico')?.value);
    addL("Título:", document.getElementById('titulo')?.value);
    addL("CREA:", document.getElementById('crea')?.value);
    yPos += 5;
    addS("INFORMAÇÕES DO RELATÓRIO");
    const dataFormatada = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    addL("Gerado em:", dataFormatada);
    addL("Gerado por:", currentUserProfile?.nome || 'N/A');
    yPos += 5;

    addS("RESUMO DA ALIMENTAÇÃO GERAL");
    if (feederResult?.calculos?.disjuntorRecomendado) {
        const feederBreakerType = feederResult.dados?.tipoDisjuntor?.includes('Caixa Moldada') ? 'MCCB' : 'DIN';
        const feederBreakerText = `${feederBreakerType} ${feederResult.calculos.disjuntorRecomendado.nome}`;
        const feederHead = [['Tensão/Fases', 'Disjuntor Geral', 'DR', 'DPS', 'Cabo (Isolação)', 'Eletroduto']];
        const feederBody = [[ `${feederResult.dados?.tensaoV}V - ${feederResult.dados?.fases}`, feederBreakerText, feederResult.dados?.requerDR ? 'Sim' : 'Nao', getDpsText(feederResult.dados?.dpsInfo), `${feederResult.calculos?.bitolaRecomendadaMm2} mm² (${feederResult.dados?.tipoIsolacao})`, feederResult.calculos?.dutoRecomendado ]];
        doc.autoTable({ startY: yPos, head: feederHead, body: feederBody, theme: 'grid', headStyles: { fillColor: [44, 62, 80] }, styles: { fontSize: 8 } });
        yPos = doc.lastAutoTable.finalY + 10;
    } else { addL("Alimentador Geral:", "Dados indisponíveis."); yPos += 5; }

    // --- Loop pelos QDCs para Resumo dos Circuitos ---
    const qdcOrder = Object.keys(circuitsByQdc).filter(id => id !== 'unknown').sort((a,b) => parseInt(a) - parseInt(b));
    qdcOrder.forEach(qdcId => {
        const qdcNameEl = document.getElementById(`qdcName-${qdcId}`);
        const qdcName = qdcNameEl ? qdcNameEl.value : `QDC ${qdcId}`;
        const qdcCircuits = circuitsByQdc[qdcId];
        if (qdcCircuits && qdcCircuits.length > 0) {
            if (yPos > 240) { doc.addPage(); yPos = 20; }
            addS(`RESUMO DOS CIRCUITOS - ${qdcName.toUpperCase()}`);
            const head = [['Ckt', 'Nome', 'Disjuntor', 'DR', 'DPS', 'Cabo (Isolação)', 'Eletroduto']];
            const body = qdcCircuits.map((r, index) => { /* ... (igual antes, com verificações ??) ... */ });
            doc.autoTable({ startY: yPos, head: head, body: body, theme: 'grid', headStyles: { fillColor: [44, 62, 80] }, styles: { fontSize: 8 } });
            yPos = doc.lastAutoTable.finalY + 10;
        }
    });
    if (circuitsByQdc['unknown'] && circuitsByQdc['unknown'].length > 0) {
         if (yPos > 240) { doc.addPage(); yPos = 20; }
         addS(`RESUMO DOS CIRCUITOS - QDC NÃO IDENTIFICADO`);
         addL("Aviso:", `${circuitsByQdc['unknown'].length} circuito(s) não puderam ser associados a um QDC.`); yPos+=5;
    }

    // --- Páginas de Memorial Detalhado ---
    if (feederResult) {
        doc.addPage(); yPos = 20;
        generateMemorialPage(doc, feederResult, "ALIMENTADOR GERAL", 0, addT, addS, addL, () => yPos, (newY) => yPos = newY);
    }
    qdcOrder.forEach(qdcId => {
        const qdcNameEl = document.getElementById(`qdcName-${qdcId}`);
        const qdcName = qdcNameEl ? qdcNameEl.value : `QDC ${qdcId}`;
        const qdcCircuits = circuitsByQdc[qdcId];
        if (qdcCircuits) {
            qdcCircuits.forEach((result, index) => {
                if (result?.dados && result?.calculos) { // Verifica validade
                    doc.addPage(); yPos = 20;
                    generateMemorialPage(doc, result, `CIRCUITO ${index + 1} (${qdcName})`, index + 1, addT, addS, addL, () => yPos, (newY) => yPos = newY);
                } else { console.error(`Dados inválidos para memorial do circuito ${index+1} do ${qdcName}:`, result); }
            });
        }
    });

    try { // Adiciona try-catch para salvar
       doc.save(`Memorial_${document.getElementById('obra')?.value || 'Projeto'}.pdf`);
    } catch (e) {
       console.error("Erro ao salvar PDF Memorial:", e);
       alert("Erro ao salvar PDF Memorial: " + e.message);
    }
}

// Função auxiliar generateMemorialPage (com mais verificações ??)
function generateMemorialPage(doc, result, titlePrefix, circuitIndex, addT, addS, addL, getY, setY) {
    const { dados, calculos } = result || {};
    if (!dados || !calculos) { /* ... (erro) ... */ return; }
    // ... (restante da função inalterada) ...
}


console.log("--- ui.js: Fim do arquivo ---"); // Log de Carregamento