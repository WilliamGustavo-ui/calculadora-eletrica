// Arquivo: ui.js (COMPLETO E CORRIGIDO - Com Event Delegation e Debounce GLOBAL)

console.log("--- ui.js: Iniciando carregamento ---");

import { ligacoes, BTU_TO_WATTS_FACTOR, CV_TO_WATTS_FACTOR } from './utils.js';
import { Canvg } from 'https://cdn.skypack.dev/canvg';
// >>>>> ALTERAÇÃO: Importa o debounce
import { debounce } from './utils.js';

let circuitCount = 0;
let qdcCount = 0; // Tracks the highest QDC number used
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

// >>>>> ALTERAÇÃO: Função renomeada para _internal_ e removido 'export'
function _internal_updateFeederPowerDisplay() {
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

// >>>>> ALTERAÇÃO: Criada a nova função 'debounced' que será exportada e usada por todos
export const updateFeederPowerDisplay = debounce(_internal_updateFeederPowerDisplay, 350);


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
        clientLinkDisplay.textContent = `Cliente: ${linkedClient.nome} (${linkedClient.client_code || 'S/C'})`;
        currentClientIdInput.value = linkedClient.id;
    }
    else if (clientLinkDisplay && currentClientIdInput){
        clientLinkDisplay.textContent = 'Cliente: Nenhum';
        currentClientIdInput.value = '';
    }

    initializeFeederListeners(); // Precisa ser chamado *antes* de addQdcBlock
    qdcCount = 0; circuitCount = 0; // <<<<< CONTADORES RESETADOS AQUI

    if (addDefaultQdc) { addQdcBlock(); }
    else { updateFeederPowerDisplay(); } // Atualiza display se não adicionar QDC default
}
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

// ========================================================================
// >>>>> FUNÇÃO ATUALIZADA (Recebe container opcional) <<<<<
// ========================================================================
export function addQdcBlock(id = null, name = null, parentId = 'feeder', container = null) { // Adiciona parâmetro container
    const isNewQdc = !id;

    let internalId;
    if (id) {
        internalId = id;
        const numericId = parseInt(String(id), 10);
        if (!isNaN(numericId)) {
            qdcCount = Math.max(qdcCount, numericId);
        }
    } else {
        qdcCount++;
        internalId = qdcCount;
    }

    const qdcName = name || `QDC ${internalId}`;
    console.log(`Adicionando QDC com internalId: ${internalId} (Novo: ${isNewQdc}, qdcCount agora: ${qdcCount})`);

    const newQdcDiv = document.createElement('div');
    newQdcDiv.innerHTML = getQdcHTML(internalId, qdcName, parentId);
    const qdcElement = newQdcDiv.firstElementChild;
    if(!qdcElement) { console.error("Falha ao criar elemento QDC."); return null; } // Retorna null em falha

    // <<<<< ALTERAÇÃO: Usa container fornecido ou busca o padrão >>>>>
    const targetContainer = container ? container : document.getElementById('qdc-container');
    if(targetContainer) {
        targetContainer.appendChild(qdcElement); // Adiciona ao fragmento ou ao DOM
    } else {
        console.error("Container principal de QDCs não encontrado.");
        return null; // Retorna null em falha
    }
    // <<<<< FIM DA ALTERAÇÃO >>>>>

    // Não atualiza dropdowns/listeners se estiver adicionando a um fragmento
    if (!(container instanceof DocumentFragment)) {
        updateQdcParentDropdowns();
        initializeQdcListeners(internalId);
    }

     // Colapsa se for novo QDC (exceto o primeiro) ou se for carregado e não for o primeiro
     // Ajuste: verifica previousElementSibling apenas se NÃO estiver em fragmento
     if ((isNewQdc && qdcCount > 1) || (!isNewQdc && !(container instanceof DocumentFragment) && qdcElement.previousElementSibling)) {
         if (!qdcElement.classList.contains('collapsed')) {
            qdcElement.classList.add('collapsed');
         }
    }


    // Adiciona circuito inicial se for QDC novo (criado pelo usuário via botão)
    // E NÃO estiver adicionando a um fragmento (será feito depois no populateForm)
    if (isNewQdc && !(container instanceof DocumentFragment)) {
       addCircuit(internalId);
    }

    // Não adiciona listener de change/updatePower aqui se for fragmento
    if (!(container instanceof DocumentFragment)) {
        // <<< ALTERAÇÃO: Listener de 'change' do parentSelect foi REMOVIDO daqui (Solução 2) >>>
        // É tratado por handleMainContainerInteraction
        
        // >>>>> ALTERAÇÃO: Esta chamada agora usa a versão debounced
        updateFeederPowerDisplay();
    }

    return internalId; // Retorna o ID que foi usado
}


export function removeQdc(qdcId) {
    if (!qdcId) return;
    const qdcElement = document.getElementById(`qdc-${qdcId}`);
    if (qdcElement) {
        if (confirm(`Tem certeza que deseja remover o quadro "${qdcElement.querySelector('.qdc-name-input')?.value || 'QDC'}" e todos os seus circuitos?`)) {
            // Reatribui filhos ao 'feeder' antes de remover
            const childQdcs = document.querySelectorAll(`.qdc-parent-select`);
            childQdcs.forEach(select => {
                if (select.value === `qdc-${qdcId}`) {
                    select.value = 'feeder'; // Move para o alimentador geral
                }
            });

            qdcElement.remove();
            updateQdcParentDropdowns(); // Atualiza lista de pais
            
            // >>>>> ALTERAÇÃO: Esta chamada agora usa a versão debounced
            updateFeederPowerDisplay(); // Recalcula cargas
        }
    }
}
export function updateQdcParentDropdowns() {
    const qdcBlocks = document.querySelectorAll('#qdc-container .qdc-block');
    const options = [{ value: 'feeder', text: 'Alimentador Geral' }];
    qdcBlocks.forEach(qdc => {
        const id = qdc.dataset.id;
        const name = qdc.querySelector(`#qdcName-${id}`)?.value || `QDC ${id}`;
        options.push({ value: `qdc-${id}`, text: name });
    });

    const selects = document.querySelectorAll('.qdc-parent-select');
    selects.forEach(select => {
        const currentQdcId = select.closest('.qdc-block')?.dataset.id;
        const initialValue = select.dataset.initialParent || select.value;
        select.innerHTML = '';

        options.forEach(opt => {
            // Um QDC não pode ser pai dele mesmo
            if (`qdc-${currentQdcId}` !== opt.value) {
                const optionEl = document.createElement('option');
                optionEl.value = opt.value;
                optionEl.textContent = opt.text;
                select.appendChild(optionEl);
            }
        });

        // Tenta restaurar o valor inicial/atual
        if (options.some(o => o.value === initialValue) && `qdc-${currentQdcId}` !== initialValue) {
            select.value = initialValue;
        } else {
            select.value = 'feeder'; // Fallback
        }
    });
}

// --- LÓGICA DE CIRCUITO ---
// ========================================================================
// >>>>> FUNÇÃO ATUALIZADA (Recebe container opcional) <<<<<
// ========================================================================
export function addCircuit(qdcId, savedCircuitData = null, circuitContainer = null) { // Adiciona parâmetro circuitContainer
    console.log(`addCircuit called for QDC ID: ${qdcId}`);
    const isNewCircuit = !savedCircuitData;

    let internalId;
    if (savedCircuitData && savedCircuitData.id) {
        internalId = parseInt(savedCircuitData.id, 10);
        circuitCount = Math.max(circuitCount, internalId);
    } else {
        circuitCount++;
        internalId = circuitCount;
    }

    console.log(`Circuit internalId: ${internalId} (New: ${isNewCircuit}, circuitCount now: ${circuitCount})`);

    const newCircuitDiv = document.createElement('div');
    newCircuitDiv.innerHTML = getCircuitHTML(internalId);
    const circuitElement = newCircuitDiv.firstElementChild;
    if(!circuitElement) { console.error("Falha ao criar elemento Circuito."); return; }

    // Colapsa apenas se for NOVO circuito (não ao carregar) e não estiver em fragmento
    if (isNewCircuit && !(circuitContainer instanceof DocumentFragment)) {
       const existingCircuits = document.querySelectorAll(`#circuits-for-qdc-${qdcId} .circuit-block`);
        if (existingCircuits.length > 0) {
            circuitElement.classList.add('collapsed');
        }
    }

    // <<<<< ALTERAÇÃO: Usa container fornecido ou busca o padrão >>>>>
    const targetContainer = circuitContainer ? circuitContainer : document.getElementById(`circuits-for-qdc-${qdcId}`);
    console.log(`Target container for circuit ${internalId}:`, targetContainer);
    if (targetContainer) {
        targetContainer.appendChild(circuitElement); // Adiciona ao fragmento ou ao DOM
    } else {
        console.error(`Circuit container for QDC ${qdcId} not found! Cannot add circuit ${internalId}.`);
        return;
    }
    // <<<<< FIM DA ALTERAÇÃO >>>>>

    // <<< ALTERAÇÃO: REMOVIDOS TODOS OS addEventListener (Solução 2) >>>
    // A lógica de input/change será tratada por handleMainContainerInteraction

    // Preenche dados se existirem
    if (savedCircuitData) {
        // Preenche todos os inputs e selects
        Object.keys(savedCircuitData).forEach(key => {
            // Key no savedCircuitData pode ser 'nomeCircuito-1', etc.
            const el = document.getElementById(key);
            if (el) {
                if (el.type === 'checkbox') {
                    el.checked = savedCircuitData[key];
                } else {
                    el.value = savedCircuitData[key];
                }
            } else {
                // Se o ID não for encontrado diretamente, tenta construir (menos comum)
                const constructedId = `${key}-${internalId}`;
                const elConstructed = document.getElementById(constructedId);
                if (elConstructed) {
                     if (elConstructed.type === 'checkbox') {
                        elConstructed.checked = savedCircuitData[key];
                    } else {
                        elConstructed.value = savedCircuitData[key];
                    }
                }
            }
        });
        // Garante que o nome no header seja atualizado
         const nameInput = document.getElementById(`nomeCircuito-${internalId}`);
         const nameLabel = document.getElementById(`nomeCircuitoLabel-${internalId}`);
         if(nameInput && nameLabel) nameLabel.textContent = nameInput.value || `Circuito ${internalId}`;
    }

    // Inicializa dropdowns e popula dados dinâmicos (pode ser feito mesmo em fragmento)
    atualizarLigacoes(internalId);
    handleInsulationChange(internalId);
    handleCircuitTypeChange(internalId); // Esconde/mostra BTU/CV

    const potenciaBTUSelect = document.getElementById(`potenciaBTU-${internalId}`);
    const potenciaCVSelect = document.getElementById(`potenciaCV-${internalId}`);
    const resistividadeSolo = document.getElementById(`resistividadeSolo-${internalId}`);
    if(uiData) {
        populateBtuDropdown(potenciaBTUSelect, uiData.ar_condicionado_btu);
        populateCvDropdown(potenciaCVSelect, uiData.motores_cv);
        populateSoilResistivityDropdown(resistividadeSolo, uiData.fatores_k2);
    }

    // Restaura valores específicos APÓS população (pode ser feito mesmo em fragmento)
    if (savedCircuitData) {
        const restoreValues = () => {
            if (savedCircuitData[`potenciaBTU-${internalId}`]) potenciaBTUSelect.value = savedCircuitData[`potenciaBTU-${internalId}`];
            if (savedCircuitData[`potenciaCV-${internalId}`]) potenciaCVSelect.value = savedCircuitData[`potenciaCV-${internalId}`];
            if (savedCircuitData[`resistividadeSolo-${internalId}`]) resistividadeSolo.value = savedCircuitData[`resistividadeSolo-${internalId}`];
            
            // Dispara change para recalcular W se necessário (importante fazer DEPOIS de setar valor)
            if (potenciaBTUSelect.value) potenciaBTUSelect.dispatchEvent(new Event('change'));
            if (potenciaCVSelect.value) potenciaCVSelect.dispatchEvent(new Event('change'));
            
            // <<< ALTERAÇÃO: REMOVIDO updateFeederPowerDisplay (Solução 2) >>>
        };

        if (!(circuitContainer instanceof DocumentFragment)) {
            setTimeout(restoreValues, 50);
        } else {
            restoreValues(); // Executa imediatamente se for fragmento
        }
    } else {
        // <<< ALTERAÇÃO: REMOVIDO updateFeederPowerDisplay (Solução 2) >>>
    }
    
    // Atualiza o display DEPOIS de adicionar (apenas se não for fragmento)
    if (!(circuitContainer instanceof DocumentFragment)) {
        // >>>>> ALTERAÇÃO: Esta chamada agora usa a versão debounced
        updateFeederPowerDisplay();
    }
}

export function removeCircuit(circuitId) {
    if (!circuitId) return;
    const circuitElement = document.getElementById(`circuit-${circuitId}`);
    if (circuitElement) {
        // Não precisa de confirmação para remover circuito
        circuitElement.remove();
        
        // >>>>> ALTERAÇÃO: Esta chamada agora usa a versão debounced
        updateFeederPowerDisplay(); // Recalcula cargas
    }
}
function getCircuitHTML(id) {
    return `<div class="circuit-block" id="circuit-${id}" data-id="${id}"> <div class="circuit-header"> <h3 class="circuit-header-left">Circuito <span class="circuit-number"></span></h3> <h3 class="circuit-header-center" id="nomeCircuitoLabel-${id}">Circuito ${id}</h3> <div class="circuit-header-right"> <button type="button" class="remove-circuit-btn btn-red" data-circuit-id="${id}">Remover</button> <span class="toggle-arrow">▼</span> </div> </div> <div class="circuit-content"> <div class="form-grid"> <div class="form-group"> <label for="nomeCircuito-${id}">Nome do Circuito</label> <input type="text" id="nomeCircuito-${id}" value="Circuito ${id}"> </div> <div class="full-width potencia-group"> <div class="form-group"> <label for="tipoCircuito-${id}">Tipo de Circuito</label> <select id="tipoCircuito-${id}"> <option value="iluminacao">Iluminação</option> <option value="tug" selected>TUG</option> <option value="tue">TUE</option> <option value="aquecimento">Aquecimento</option> <option value="motores">Motores</option> <option value="ar_condicionado">Ar Condicionado</option> </select> </div> <div class="form-group hidden" id="potenciaBTU_group-${id}"> <label for="potenciaBTU-${id}">Potência (BTU/h)</label> <select id="potenciaBTU-${id}"></select> </div> <div class="form-group hidden" id="potenciaCV_group-${id}"> <label for="potenciaCV-${id}">Potência (CV)</label> <select id="potenciaCV-${id}"></select> </div> <div class="form-group"> <label for="potenciaW-${id}">Potência (W)</label> <input type="number" id="potenciaW-${id}" value="2500"> </div> </div> <div class="form-group"> <label for="fatorDemanda-${id}">Fator Demanda (%)</label> <input type="number" id="fatorDemanda-${id}" value="100" step="1"> </div> <div class="form-group"> <label for="fases-${id}">Fases</label> <select id="fases-${id}"> <option value="Monofasico" selected>Monofásico</option> <option value="Bifasico">Bifásico</option> <option value="Trifasico">Trifásico</option> </select> </div> <div class="form-group"> <label for="tipoLigacao-${id}">Ligação</label> <select id="tipoLigacao-${id}"></select> </div> <div class="form-group"> <label for="tensaoV-${id}">Tensão (V)</label> <select id="tensaoV-${id}"><option value="12">12</option><option value="24">24</option><option value="36">36</option><option value="127">127</option><option value="220" selected>220</option><option value="380">380</option><option value="440">440</option><option value="760">760</option></select> </div> <div class="form-group"> <label for="fatorPotencia-${id}">Fator Potência</label> <input type="number" id="fatorPotencia-${id}" step="0.01" value="0.92"> </div> <div class="form-group"> <label for="comprimentoM-${id}">Comprimento (m)</label> <input type="number" id="comprimentoM-${id}" value="20"> </div> <div class="form-group"> <label for="tipoIsolacao-${id}">Isolação</label> <select id="tipoIsolacao-${id}"><option value="PVC" selected>PVC 70°C</option><option value="EPR">EPR 90°C</option><option value="XLPE">XLPE 90°C</option></select> </div> <div class="form-group"> <label for="materialCabo-${id}">Condutor</label> <select id="materialCabo-${id}"><option value="Cobre" selected>Cobre</option><option value="Aluminio">Alumínio</option></select> </div> <div class="form-group"> <label for="metodoInstalacao-${id}">Instalação</label> <select id="metodoInstalacao-${id}"><option value="A1">A1</option><option value="A2">A2</option><option value_."B1" selected>B1</option><option value="B2">B2</option><option value="C">C</option><option value="D">D</option></select> </div> <div class="form-group"> <label for="temperaturaAmbienteC-${id}">Temp. Ambiente</label> <select id="temperaturaAmbienteC-${id}"></select> </div> <div class="form-group"> <label for="resistividadeSolo-${id}">Resist. Solo</label> <select id="resistividadeSolo-${id}"></select> </div> <div class="form-group"> <label for="numCircuitosAgrupados-${id}">Ckt Agrupados</label> <select id="numCircuitosAgrupados-${id}"><option value="1" selected>1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option></select> </div> <div class="form-group"> <label for="limiteQuedaTensao-${id}">Limite DV (%)</label> <input type="number" id="limiteQuedaTensao-${id}" step="0.1" value="4.0"> </div> <div class="form-group"> <label for="tipoDisjuntor-${id}">Disjuntor</label> <select id="tipoDisjuntor-${id}"><option value="Minidisjuntor (DIN)">DIN</option><option value="Caixa Moldada (MCCB)">MCCB</option></select> </div> <div class="form-group"> <label for="dpsClasse-${id}">Classe DPS</label> <select id="dpsClasse-${id}"><option value="">Nenhum</option><option value="I">I</option><option value="II">II</option></select> </div> <div class="checkbox-group"> <input type="checkbox" id="requerDR-${id}"><label for="requerDR-${id}">Requer DR</label> </div> </div> </div> </div>`;
}
function initializeFeederListeners() {
    const feederFases = document.getElementById('feederFases');
    const feederTipoIsolacao = document.getElementById('feederTipoIsolacao');
    const feederTemp = document.getElementById('feederTemperaturaAmbienteC');
    const feederSolo = document.getElementById('feederResistividadeSolo');

    if(feederFases) feederFases.addEventListener('change', () => {
        const tipoLigacaoSelect = document.getElementById('feederTipoLigacao');
        const selectedFases = feederFases.value;
        if (tipoLigacaoSelect && ligacoes[selectedFases]) {
            tipoLigacaoSelect.innerHTML = '';
            ligacoes[selectedFases].forEach(opt => {
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.text;
                tipoLigacaoSelect.appendChild(option);
            });
        }
    });

    if(feederTipoIsolacao) feederTipoIsolacao.addEventListener('change', () => {
        const isPVC = feederTipoIsolacao.value === 'PVC';
        populateTemperatureDropdown(feederTemp, isPVC ? tempOptions.pvc : tempOptions.epr);
    });

    // Inicialização
    if(feederFases) feederFases.dispatchEvent(new Event('change'));
    if(feederTipoIsolacao) feederTipoIsolacao.dispatchEvent(new Event('change'));
    if(uiData) populateSoilResistivityDropdown(feederSolo, uiData.fatores_k2);
}
function initializeQdcListeners(id) {
    const qdcFases = document.getElementById(`qdcFases-${id}`);
    const qdcTipoIsolacao = document.getElementById(`qdcTipoIsolacao-${id}`);

    // <<< ALTERAÇÃO: REMOVIDOS addEventListener (Solução 2) >>>
    // Apenas chamamos as funções de inicialização
    
    // Inicialização
    atualizarQdcLigacoes(id);
    handleQdcInsulationChange(id);

    const resistividadeSolo = document.getElementById(`qdcResistividadeSolo-${id}`);
    if(uiData) populateSoilResistivityDropdown(resistividadeSolo, uiData.fatores_k2);
}
function atualizarQdcLigacoes(id) {
    const fasesSelect = document.getElementById(`qdcFases-${id}`);
    const tipoLigacaoSelect = document.getElementById(`qdcTipoLigacao-${id}`);
    if (!fasesSelect || !tipoLigacaoSelect) return;

    const selectedFases = fasesSelect.value;
    const currentLigacao = tipoLigacaoSelect.value;

    if (ligacoes[selectedFases]) {
        tipoLigacaoSelect.innerHTML = '';
        ligacoes[selectedFases].forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.text;
            tipoLigacaoSelect.appendChild(option);
        });

        if (ligacoes[selectedFases].some(o => o.value === currentLigacao)) {
            tipoLigacaoSelect.value = currentLigacao;
        }
    }
}
function handleQdcInsulationChange(id) {
    const tipoIsolacao = document.getElementById(`qdcTipoIsolacao-${id}`);
    const tempAmbiente = document.getElementById(`qdcTemperaturaAmbienteC-${id}`);
    if (!tipoIsolacao || !tempAmbiente) return;

    const isPVC = tipoIsolacao.value === 'PVC';
    populateTemperatureDropdown(tempAmbiente, isPVC ? tempOptions.pvc : tempOptions.epr);
}
function handlePowerUnitChange(id, type) {
    const btuSelect = document.getElementById(`potenciaBTU-${id}`);
    const cvSelect = document.getElementById(`potenciaCV-${id}`);
    const wattsInput = document.getElementById(`potenciaW-${id}`);
    if (!wattsInput) return;

    if (type === 'btu' && btuSelect) {
        const btuValue = parseFloat(btuSelect.value);
        if (btuValue > 0) {
            wattsInput.value = (btuValue * BTU_TO_WATTS_FACTOR).toFixed(0);
            if(cvSelect) cvSelect.value = "";
        }
    } else if (type === 'cv' && cvSelect) {
        const cvValue = parseFloat(cvSelect.value);
        if (cvValue > 0) {
            wattsInput.value = (cvValue * CV_TO_WATTS_FACTOR).toFixed(0);
            if(btuSelect) btuSelect.value = "";
        }
    }
    // <<< ALTERAÇÃO: REMOVIDO updateFeederPowerDisplay (Solução 2) >>>
    // Esta função agora é chamada de dentro do handleMainContainerInteraction
    // ou pelo debouncer em main.js
}

// ========================================================================
// >>>>> FUNÇÃO ATUALIZADA (Solução 1 e 2) <<<<<
// Esta função agora trata TODOS os eventos de click e change
// ========================================================================
export function handleMainContainerInteraction(event) {
    const target = event.target;
    const eventType = event.type; // 'click' ou 'change'

    // --- Lógica de QDC ---
    const qdcBlock = target.closest('.qdc-block');
    if (qdcBlock) {
        const qdcId = qdcBlock.dataset.id;
        if (!qdcId) return;

        if (eventType === 'click') {
            // ADICIONAR CIRCUITO (Botão '+ Circuito')
            const addCircuitButton = target.closest('.add-circuit-to-qdc-btn');
            if (addCircuitButton) {
                event.stopPropagation(); // Impede o colapso
                addCircuit(qdcId);
                return;
            }
            // REMOVER QDC (Botão 'Remover QDC')
            const removeQdcButton = target.closest('.remove-qdc-btn');
            if (removeQdcButton) {
                removeQdc(qdcId);
                return;
            }
            // COLAPSAR QDC (Click no Header)
            const qdcHeader = target.closest('.qdc-header');
            if (qdcHeader && !target.closest('.qdc-header-right button, .qdc-header-left input, .qdc-header-center select')) {
                qdcBlock.classList.toggle('collapsed');
                return;
            }
        } 
        else if (eventType === 'change') {
            // MUDAR PARENT (Select 'Alimentado por:')
            if (target.classList.contains('qdc-parent-select')) {
                // >>>>> ALTERAÇÃO: Esta chamada agora usa a versão debounced
                updateFeederPowerDisplay(); // Recalcula a carga
                return;
            }
            // MUDAR FASES QDC
            if (target.id === `qdcFases-${qdcId}`) {
                atualizarQdcLigacoes(qdcId);
                return;
            }
            // MUDAR ISOLAÇÃO QDC
            if (target.id === `qdcTipoIsolacao-${qdcId}`) {
                handleQdcInsulationChange(qdcId);
                return;
            }
            // MUDAR NOME DO QDC (agora no 'change' e não 'input')
            if (target.classList.contains('qdc-name-input')) {
                updateQdcParentDropdowns();
                return;
            }
        }
    } // Fim da lógica de QDC

    // --- Lógica de Circuito ---
    const circuitBlock = target.closest('.circuit-block');
    if (circuitBlock) {
        const circuitId = circuitBlock.dataset.id;
        if (!circuitId) return;

        if (eventType === 'click') {
            // REMOVER CIRCUITO
            const removeCircuitButton = target.closest('.remove-circuit-btn');
            if (removeCircuitButton) {
                removeCircuit(circuitId);
                return;
            }
            // COLAPSAR CIRCUITO
            const circuitHeader = target.closest('.circuit-header');
            if (circuitHeader && !target.closest('.remove-circuit-btn')) {
                circuitBlock.classList.toggle('collapsed');
                return;
            }
        } 
        else if (eventType === 'change') {
            // --- ESTA É A LÓGICA MOVIDA DO addCircuit (Solução 2) ---
            
            // MUDAR POTÊNCIA BTU
            if (target.id === `potenciaBTU-${circuitId}`) {
                handlePowerUnitChange(circuitId, 'btu');
                // >>>>> ALTERAÇÃO: Esta chamada agora usa a versão debounced
                updateFeederPowerDisplay(); // Atualiza a potência
                return;
            }
            // MUDAR POTÊNCIA CV
            if (target.id === `potenciaCV-${circuitId}`) {
                handlePowerUnitChange(circuitId, 'cv');
                // >>>>> ALTERAÇÃO: Esta chamada agora usa a versão debounced
                updateFeederPowerDisplay(); // Atualiza a potência
                return;
            }
            // MUDAR TIPO DE CIRCUITO
            if (target.id === `tipoCircuito-${circuitId}`) {
                handleCircuitTypeChange(circuitId);
                return;
            }
            // MUDAR FASES CIRCUITO
            if (target.id === `fases-${circuitId}`) {
                atualizarLigacoes(circuitId);
                return;
            }
            // MUDAR ISOLAÇÃO CIRCUITO
            if (target.id === `tipoIsolacao-${circuitId}`) {
                handleInsulationChange(circuitId);
                return;
            }
        }
    } // Fim da lógica de Circuito
}
// ========================================================================
// >>>>> FIM DA FUNÇÃO ALTERADA <<<<<
// ========================================================================

function atualizarLigacoes(id) {
    const fasesSelect = document.getElementById(`fases-${id}`);
    const tipoLigacaoSelect = document.getElementById(`tipoLigacao-${id}`);
    if (!fasesSelect || !tipoLigacaoSelect) return;

    const selectedFases = fasesSelect.value;
    const currentLigacao = tipoLigacaoSelect.value;

    if (ligacoes[selectedFases]) {
        tipoLigacaoSelect.innerHTML = '';
        ligacoes[selectedFases].forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.text;
            tipoLigacaoSelect.appendChild(option);
        });

        if (ligacoes[selectedFases].some(o => o.value === currentLigacao)) {
            tipoLigacaoSelect.value = currentLigacao;
        }
    }
}
function handleInsulationChange(id) {
    const tipoIsolacao = document.getElementById(`tipoIsolacao-${id}`);
    const tempAmbiente = document.getElementById(`temperaturaAmbienteC-${id}`);
    if (!tipoIsolacao || !tempAmbiente) return;

    const isPVC = tipoIsolacao.value === 'PVC';
    populateTemperatureDropdown(tempAmbiente, isPVC ? tempOptions.pvc : tempOptions.epr);
}
function handleCircuitTypeChange(id) {
    const tipo = document.getElementById(`tipoCircuito-${id}`)?.value;
    const btuGroup = document.getElementById(`potenciaBTU_group-${id}`);
    const cvGroup = document.getElementById(`potenciaCV_group-${id}`);
    const fpInput = document.getElementById(`fatorPotencia-${id}`);
    const drCheck = document.getElementById(`requerDR-${id}`);

    if (btuGroup) btuGroup.classList.toggle('hidden', tipo !== 'ar_condicionado');
    if (cvGroup) cvGroup.classList.toggle('hidden', tipo !== 'motores');

    // Ajusta FP e DR padrão
    if (fpInput) {
        if (tipo === 'motores' || tipo === 'ar_condicionado') {
            fpInput.value = '0.85';
        } else if (tipo === 'iluminacao' || tipo === 'tug' || tipo === 'tue') {
            fpInput.value = '0.92';
        }
    }
    if (drCheck) {
        if (tipo === 'tug' || tipo === 'aquecimento') { // Ex: Chuveiro
             drCheck.checked = true;
        } else if (tipo === 'iluminacao' || tipo === 'motores') {
             drCheck.checked = false;
        }
    }
}

// --- Funções de preenchimento de formulário ---
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

// ========================================================================
// >>>>> FUNÇÃO ATUALIZADA (Usa DocumentFragment) <<<<<
// ========================================================================
export function populateFormWithProjectData(project) {
    console.time("populateForm"); // Mede o tempo de execução
    if (!project) return;

    // 1. Reseta o formulário SEM adicionar QDC padrão
    resetForm(false, project.client);

    // 2. Popula dados principais
    document.getElementById('currentProjectId').value = project.id;
    if (project.main_data) {
        Object.keys(project.main_data).forEach(key => {
            const el = document.getElementById(key); // IDs no HTML devem bater (ex: 'obra')
            if (el) el.value = project.main_data[key];
        });
    }
     document.getElementById('project_code').value = project.project_code || ''; // Garante código

    // 3. Popula dados técnicos
    if (project.tech_data) {
        Object.keys(project.tech_data).forEach(key => {
            const el = document.getElementById(key); // ex: 'respTecnico'
            if (el) el.value = project.tech_data[key];
        });
    }

    // 4. Popula dados do alimentador
    if (project.feeder_data) {
        Object.keys(project.feeder_data).forEach(key => {
            const el = document.getElementById(key); // ex: 'feederFases'
            if (el) {
                if (el.type === 'checkbox') el.checked = project.feeder_data[key];
                else el.value = project.feeder_data[key];
            }
        });
        // Re-dispara eventos para popular dropdowns dependentes
        document.getElementById('feederFases')?.dispatchEvent(new Event('change'));
        document.getElementById('feederTipoIsolacao')?.dispatchEvent(new Event('change'));
    }

    // 5. Recria QDCs e Circuitos usando DocumentFragment
    const qdcContainerTarget = document.getElementById('qdc-container');
    if (project.qdcs_data && Array.isArray(project.qdcs_data) && qdcContainerTarget) {
        const fragment = document.createDocumentFragment(); // Cria o fragmento

        // Ordena QDCs para garantir que os pais sejam criados antes dos filhos
        const qdcMap = new Map();
        project.qdcs_data.forEach(qdc => qdcMap.set(String(qdc.id), qdc)); // Garante ID como string

        const sortedQdcs = [];
        const visited = new Set();

        function visit(qdcId) { // Visita por ID
            if (!qdcId || visited.has(qdcId)) return;
            const qdc = qdcMap.get(qdcId);
            if (!qdc) return; // QDC não encontrado no mapa

            visited.add(qdcId);
            const parentValue = qdc.parentId; // e.g., 'feeder' or 'qdc-1'
            if (parentValue && parentValue !== 'feeder') {
                const parentId = parentValue.replace('qdc-', '');
                visit(parentId); // Visita o pai primeiro
            }
            if(!sortedQdcs.some(sq => sq.id == qdc.id)) { // Evita adicionar duplicados
                 sortedQdcs.push(qdc);
            }
        }

        project.qdcs_data.forEach(qdc => visit(String(qdc.id))); // Inicia visita por ID (string)

        console.log("QDCs ordenados para renderização:", sortedQdcs.map(q => q.id));

        // Cria QDCs e Circuitos DENTRO do fragmento
        sortedQdcs.forEach(qdc => {
            // Chama addQdcBlock passando o fragmento como container
            const renderedQdcId = addQdcBlock(String(qdc.id), qdc.name, qdc.parentId, fragment); // Passa fragment

            // Encontra o elemento QDC DENTRO do fragmento para popular config e adicionar circuitos
            const qdcElementInFragment = fragment.querySelector(`#qdc-${renderedQdcId}`);
            if (!qdcElementInFragment) {
                console.error(`Elemento QDC ${renderedQdcId} não encontrado no fragmento.`);
                return; // Pula este QDC se não for encontrado
            }


            // Popula config do QDC (lê do qdc.config, escreve no elemento DENTRO do fragmento)
            if (qdc.config) {
                Object.keys(qdc.config).forEach(key => {
                    const el = qdcElementInFragment.querySelector(`#${key}`); // Busca DENTRO do elemento QDC no fragmento
                    if (el) {
                        if (el.type === 'checkbox') el.checked = qdc.config[key];
                        else el.value = qdc.config[key];
                    }
                });
                // Dispara eventos DEPOIS que o fragmento for adicionado ao DOM
            }

            // Adiciona circuitos AO FRAGMENTO (dentro do container de circuitos do QDC no fragmento)
            if (qdc.circuits && Array.isArray(qdc.circuits)) {
                  const circuitContainerInFragment = qdcElementInFragment.querySelector(`#circuits-for-qdc-${renderedQdcId}`);
                  if (circuitContainerInFragment) {
                      qdc.circuits.forEach(circuit => {
                          // Chama addCircuit passando o container DENTRO do fragmento
                          addCircuit(renderedQdcId, circuit, circuitContainerInFragment);
                      });
                  } else {
                       console.error(`Container de circuitos para QDC ${renderedQdcId} não encontrado no fragmento.`);
                  }
            }
        });

        // <<<<< ALTERAÇÃO: Adiciona o fragmento inteiro ao DOM DE UMA SÓ VEZ >>>>>
        qdcContainerTarget.appendChild(fragment);
        // <<<<< FIM DA ALTERAÇÃO >>>>>

        // AGORA, após adicionar ao DOM, inicializa listeners e dispara eventos
        sortedQdcs.forEach(qdc => {
            const renderedQdcId = String(qdc.id); // O ID original é o ID renderizado
            initializeQdcListeners(renderedQdcId); // Adiciona listeners agora que está no DOM
             // Dispara eventos de change para Fases e Isolação
             document.getElementById(`qdcFases-${renderedQdcId}`)?.dispatchEvent(new Event('change'));
             document.getElementById(`qdcTipoIsolacao-${renderedQdcId}`)?.dispatchEvent(new Event('change'));

             // <<< ALTERAÇÃO: REMOVIDO addEventListener do parentSelect (Solução 2) >>>

             // Restaura valores de BTU/CV/Solo e dispara change nos circuitos AGORA
             if (qdc.circuits) {
                 qdc.circuits.forEach(circuit => {
                     const circuitId = circuit.id;
                     const btuSelect = document.getElementById(`potenciaBTU-${circuitId}`);
                     const cvSelect = document.getElementById(`potenciaCV-${circuitId}`);
                     const soloSelect = document.getElementById(`resistividadeSolo-${circuitId}`);

                     if (btuSelect && circuit[`potenciaBTU-${circuitId}`]) {
                         btuSelect.value = circuit[`potenciaBTU-${circuitId}`];
                         btuSelect.dispatchEvent(new Event('change')); // Mantido para calcular W
                     }
                     if (cvSelect && circuit[`potenciaCV-${circuitId}`]) {
                         cvSelect.value = circuit[`potenciaCV-${circuitId}`];
                         cvSelect.dispatchEvent(new Event('change')); // Mantido para calcular W
                     }
                      if (soloSelect && circuit[`resistividadeSolo-${circuitId}`]) {
                         soloSelect.value = circuit[`resistividadeSolo-${circuitId}`];
                         // Não precisa disparar change para solo geralmente
                     }

                     // <<< ALTERAÇÃO: REMOVIDOS addEventListener de power/demand (Solução 2) >>>
                 });
             }
        });

         // Atualiza TODOS os dropdowns de parent DEPOIS que todos QDCs estão no DOM
         updateQdcParentDropdowns();
         // Restaura a seleção do parent salva no BD
         setTimeout(() => { // Delay para garantir que dropdowns foram populados
             sortedQdcs.forEach(qdc => {
                 const parentSelect = document.getElementById(`qdcParent-${qdc.id}`);
                 if (parentSelect && qdc.parentId) {
                     // Verifica se a opção ainda existe antes de setar
                     if (Array.from(parentSelect.options).some(opt => opt.value === qdc.parentId)) {
                         parentSelect.value = qdc.parentId;
                          parentSelect.dataset.initialParent = qdc.parentId; // Atualiza data attribute
                     } else {
                         console.warn(`Parent ID ${qdc.parentId} salvo para QDC ${qdc.id} não encontrado no dropdown. Resetando para feeder.`);
                         parentSelect.value = 'feeder';
                          parentSelect.dataset.initialParent = 'feeder';
                     }
                 }
             });
             // >>>>> ALTERAÇÃO: Esta chamada agora usa a versão debounced
             updateFeederPowerDisplay(); // Calcula display final
         }, 100); // Pequeno delay
    } else {
         // Se não há QDCs, apenas calcula o display (caso raro de projeto sem QDC)
         // >>>>> ALTERAÇÃO: Esta chamada agora usa a versão debounced
         updateFeederPowerDisplay();
    }
    console.timeEnd("populateForm"); // Termina medição
}


export function populateUsersPanel(users) {
    const list = document.getElementById('adminUserList');
    if (!list) return;
    list.innerHTML = ''; // Limpa lista

    if (!users || users.length === 0) {
        list.innerHTML = '<li>Nenhum usuário encontrado.</li>';
        return;
    }

    users.forEach(user => {
        const li = document.createElement('li');

        // Determina a classe e texto do botão de bloquear/desbloquear
        // <<<<< ALTERAÇÃO: Cores dos botões >>>>>
        const blockButtonClass = user.is_blocked ? 'btn-green' : 'btn-orange'; // Verde para Desbloquear, Laranja para Bloquear
        const blockButtonText = user.is_blocked ? 'Desbloquear' : 'Bloquear';

        li.innerHTML = `
            <span>
                <strong>${user.nome || 'Usuário sem nome'}</strong><br>
                <small>${user.email} ${user.is_admin ? '(Admin)' : ''}</small><br>
                <small>CREA: ${user.crea || 'N/A'}</small>
            </span>
            <div class="admin-user-actions">
                ${!user.is_approved ? `<button class="btn-green approve-user-btn" data-user-id="${user.id}">Aprovar</button>` : ''}
                <button class="btn-blue-dark edit-user-btn" data-user-id="${user.id}">Editar</button> <button class="${blockButtonClass} block-user-btn" data-user-id="${user.id}" data-is-blocked="${user.is_blocked}"> ${blockButtonText}
                </button>
                <button class="btn-red remove-user-btn" data-user-id="${user.id}">Excluir</button> </div>
            `;
        // <<<<< FIM DA ALTERAÇÃO >>>>>
        list.appendChild(li);
    });
}
export function populateEditUserModal(user) {
    if (!user) return;
    document.getElementById('editUserId').value = user.id;
    document.getElementById('editNome').value = user.nome || '';
    document.getElementById('editEmail').value = user.email || '';
    document.getElementById('editCpf').value = user.cpf || '';
    document.getElementById('editTelefone').value = user.telefone || '';
    document.getElementById('editCrea').value = user.crea || '';
    openModal('editUserModalOverlay');
}
export function populateProjectsPanel(projects, clients, users, currentUserProfile) {
    const tableBody = document.getElementById('adminProjectsTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const clientOptions = clients.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
    const userOptions = users.map(u => `<option value="${u.id}">${u.nome || u.email}</option>`).join('');

    if (!projects || projects.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5">Nenhuma obra encontrada.</td></tr>';
        return;
    }

    projects.forEach(p => {
        const tr = document.createElement('tr');
        const owner = p.owner;
        const client = p.client;

        // Só permite transferir se for admin ou o dono atual
        const canTransfer = currentUserProfile.is_admin || currentUserProfile.id === p.owner_id;

        tr.innerHTML = `
            <td>${p.project_code || 'S/C'}</td>
            <td>${p.project_name || 'Obra sem nome'}</td>
            <td>${owner ? (owner.nome || owner.email) : 'N/A'}</td>
            <td>${client ? client.nome : 'Nenhum'}</td>
            <td class="action-cell">
                <div class="action-group">
                    <label>Cliente:</label>
                    <select class="transfer-client-select" ${!canTransfer ? 'disabled' : ''}>
                        <option value="">-- Nenhum --</option>
                        ${clientOptions}
                    </select>
                    <button class="btn-blue-dark transfer-client-btn" data-project-id="${p.id}" ${!canTransfer ? 'disabled' : ''}>Salvar</button>
                </div>
                ${currentUserProfile.is_admin ? `
                <div class="action-group">
                    <label>Dono:</label>
                    <select class="transfer-owner-select">
                        ${userOptions}
                    </select>
                    <button class="btn-orange transfer-owner-btn" data-project-id="${p.id}">Transferir</button>
                </div>
                ` : ''}
            </td>
        `;

        const clientSelect = tr.querySelector('.transfer-client-select');
        if (clientSelect && p.client_id) {
            clientSelect.value = p.client_id;
        }
        const ownerSelect = tr.querySelector('.transfer-owner-select');
        if (ownerSelect && p.owner_id) {
            ownerSelect.value = p.owner_id;
        }

        tableBody.appendChild(tr);
    });
}
export function populateClientManagementModal(clients) {
    const list = document.getElementById('clientList');
    if (!list) return;
    list.innerHTML = '';

    if (!clients || clients.length === 0) {
        list.innerHTML = '<li>Nenhum cliente cadastrado.</li>';
        return;
    }

    clients.forEach(c => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>
                <strong>${c.nome || 'Cliente sem nome'}</strong> (Projetos: ${c.projects?.length || 0})<br>
                <small>${c.documento_tipo || 'Doc'}: ${c.documento_valor || 'N/A'}</small><br>
                <small>Email: ${c.email || 'N/A'} | Celular: ${c.celular || 'N/A'}</small>
            </span>
            <div class="client-actions">
                <button class="btn-edit edit-client-btn" data-client-id="${c.id}">Editar</button>
                <button class="btn-danger delete-client-btn" data-client-id="${c.id}" ${c.projects?.length > 0 ? 'disabled' : ''}>Excluir</button>
            </div>
        `;
        list.appendChild(li);
    });
}
export function resetClientForm() {
    const form = document.getElementById('clientForm');
    if(form) form.reset();
    document.getElementById('clientId').value = '';
    document.getElementById('clientFormTitle').textContent = 'Cadastrar Novo Cliente';
    document.getElementById('clientFormSubmitBtn').textContent = 'Salvar Cliente';
    document.getElementById('clientFormCancelBtn').style.display = 'none';
}
export function openEditClientForm(client) {
    if (!client) return;
    document.getElementById('clientId').value = client.id;
    document.getElementById('clientNome').value = client.nome || '';
    document.getElementById('clientDocumentoTipo').value = client.documento_tipo || 'CPF';
    document.getElementById('clientDocumentoValor').value = client.documento_valor || '';
    document.getElementById('clientEmail').value = client.email || '';
    document.getElementById('clientCelular').value = client.celular || '';
    document.getElementById('clientTelefone').value = client.telefone || '';
    document.getElementById('clientEndereco').value = client.endereco || '';

    document.getElementById('clientFormTitle').textContent = 'Editar Cliente';
    document.getElementById('clientFormSubmitBtn').textContent = 'Salvar Alterações';
    document.getElementById('clientFormCancelBtn').style.display = 'inline-block';
}
export function populateSelectClientModal(clients, isChange = false) {
    const select = document.getElementById('clientSelectForNewProject');
    const title = document.querySelector('#selectClientModalOverlay h3');
    const continueBtn = document.getElementById('continueWithoutClientBtn');

    if (title) title.textContent = isChange ? 'Vincular / Alterar Cliente' : 'Vincular Cliente à Nova Obra';
    if (continueBtn) continueBtn.style.display = isChange ? 'none' : 'inline-block';

    if (!select) return;
    select.innerHTML = '';

    if (!clients || clients.length === 0) {
        select.innerHTML = '<option value="">Nenhum cliente cadastrado</option>';
        return;
    }

    select.innerHTML = '<option value="">-- Selecione um Cliente --</option>';
    clients.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.nome} (${c.client_code || 'S/C'})`;
        select.appendChild(opt);
    });

    if (isChange) {
        const currentClientId = document.getElementById('currentClientId').value;
        if (currentClientId) {
            select.value = currentClientId;
        }
    }

    openModal('selectClientModalOverlay');
}


// --- FUNÇÕES DE GERAÇÃO DE PDF ---

// ========================================================================
// >>>>> FUNÇÃO ATUALIZADA (Gerenciamento yPos com autoTable) <<<<<
// ========================================================================
export function generateMemorialPdf(calculationResults, currentUserProfile, formData) {
    if (!calculationResults) { alert("Execute o cálculo primeiro."); return; }
    const { feederResult, qdcFeederResults, circuitResults } = calculationResults;
    if (!feederResult) { alert("Dados do alimentador geral ausentes. Não é possível gerar Memorial."); return;}

    // Agrupa circuitos por QDC (apenas os bem-sucedidos)
    const circuitsByQdc = {};
    if (circuitResults && Array.isArray(circuitResults)) {
        circuitResults.forEach(result => {
            if (result?.dados && result?.calculos && (result.dados.qdcId !== undefined && result.dados.qdcId !== null)) {
                const qdcId = String(result.dados.qdcId);
                if (!circuitsByQdc[qdcId]) circuitsByQdc[qdcId] = [];
                circuitsByQdc[qdcId].push(result);
            } else {
                console.warn("Resultado de circuito inválido, sem qdcId ou com cálculo falho:", result);
                if (!circuitsByQdc['failed']) circuitsByQdc['failed'] = [];
                if(result) circuitsByQdc['failed'].push(result);
            }
        });
    } else { console.warn("circuitResults não é um array ou está vazio:", circuitResults); }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    let yPos = 20;
    const lM = 15; // Left Margin
    const vM = 75; // Value Margin
    const pageHeight = doc.internal.pageSize.height;
    const bottomMargin = 15;

    doc.setFont('helvetica', 'normal');

    // Funções auxiliares mantêm o controle de yPos
    const addT = (t) => { doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.text(t, 105, yPos, { align: 'center' }); yPos += 12; };
    const addS = (t) => { if (yPos > pageHeight - bottomMargin - 20) { doc.addPage(); yPos = 20; doc.setFont('helvetica', 'normal'); } doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text(t, lM, yPos); yPos += 8; };
    const addL = (l, v) => { if (yPos > pageHeight - bottomMargin - 10) { doc.addPage(); yPos = 20; doc.setFont('helvetica', 'normal'); } doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text(l, lM, yPos); doc.setFont('helvetica', 'normal'); doc.text(String(v ?? '-'), vM, yPos, { maxWidth: doc.internal.pageSize.width - vM - lM }); yPos += 6; };
    const drawSeparator = () => { if (yPos > pageHeight - bottomMargin - 15) { doc.addPage(); yPos = 20; } doc.setDrawColor(180, 180, 180); doc.line(lM, yPos, doc.internal.pageSize.width - lM, yPos); yPos += 5; doc.setDrawColor(0,0,0); };

    // Pega os dados do formData
    const mainData = formData?.mainData || {};
    const clientProfile = formData?.clientProfile || {};
    const techData = formData?.techData || {};


    // --- Página 1: Dados Gerais e Resumos ---
    addT("RELATÓRIO DE PROJETO ELÉTRICO");

    addS("DADOS DO CLIENTE");
    addL("Nome:", clientProfile.cliente || mainData.cliente || 'N/A');
    addL("Documento:", `${clientProfile.documento_tipo || 'N/A'}: ${clientProfile.documento_valor || 'N/A'}`);
    addL("Endereço:", clientProfile.endereco || 'N/A');
    addL("Contato:", `Email: ${clientProfile.email || 'N/A'} | Cel: ${clientProfile.celular || 'N/A'}`);
    yPos += 5;

    addS("DADOS DA OBRA");
    addL("Nome/Obra:", mainData.obra || 'N/A');
    addL("Código da Obra:", mainData.projectCode || 'N/A');
    addL("Endereço:", mainData.endereco || 'N/A');
    addL("Concessionária:", techData.concessionaria || 'N/A');
    addL("Tipo de Fornecimento:", techData.tipoFornecimento || 'N/A');
    addL("Tensão de Fornecimento (V):", techData.tensaoFornecimentoV || 'N/A');
    yPos += 5;

    addS("INFORMAÇÕES DO RESPONSÁVEL TÉCNICO");
    addL("Nome:", techData.respTecnico || currentUserProfile.nome || 'N/A');
    addL("CREA:", techData.crea || currentUserProfile.crea || 'N/A');
    addL("Contato:", techData.contatoResp || currentUserProfile.telefone || currentUserProfile.email || 'N/A');
    yPos += 5;
    
    addS("INFORMAÇÕES DO RELATÓRIO");
    addL("Data de Geração:", new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
    addL("Software:", "Calculi Engenharia (App)");
    yPos += 5;

    addS("RESUMO DA ALIMENTAÇÃO GERAL");
    const fc = feederResult.calculos;
    addL("Potência Instalada Total:", `${fc?.potenciaInstalada?.toFixed(2) || 'N/A'} W`);
    addL("Potência Demandada Total:", `${fc?.potenciaDemandada?.toFixed(2) || 'N/A'} W`);
    addL("Corrente de Projeto (A):", `${fc?.correnteDemandada?.toFixed(2) || 'N/A'} A`);
    addL("Cabo Recomendado:", `${fc?.bitolaRecomendadaMm2 || 'N/A'} mm²`);
    addL("Disjuntor Recomendado:", fc?.disjuntorRecomendado?.nome || 'N/A');
    addL("Eletroduto:", fc?.dutoRecomendado || 'N/A');
    yPos += 5;

    const qdcOrder = Object.keys(circuitsByQdc)
                           .filter(id => id !== 'failed')
                           .sort((a, b) => parseInt(a) - parseInt(b));

    qdcOrder.forEach(qdcId => {
        const qdcName = document.getElementById(`qdcName-${qdcId}`)?.value || `QDC ${qdcId}`;
        const circuits = circuitsByQdc[qdcId];
        if (circuits && circuits.length > 0) {
            // Verifica espaço ANTES de adicionar o título da seção
            if (yPos > pageHeight - bottomMargin - 40) { // Estima altura minima (título + header tabela)
                doc.addPage();
                yPos = 20;
                doc.setFont('helvetica', 'normal');
            }
            addS(`RESUMO - ${qdcName.toUpperCase()}`);

            const tableHead = [["Ckt nº", "Nome", "Disjuntor", "DR", "DPS", "Cabo", "Eletroduto"]];
            const tableBody = [];
            circuits.forEach((c, idx) => {
                const cD = c.dados;
                const cC = c.calculos;
                tableBody.push([
                    idx + 1,
                    cD.nomeCircuito || `Circuito ${idx + 1}`,
                    cC.disjuntorRecomendado?.nome || 'Falha',
                    cD.requerDR ? "Sim" : "Não",
                    cD.dpsClasse || "N/A",
                    `${cC.bitolaRecomendadaMm2 || 'N/A'} mm²`,
                    cC.dutoRecomendado || 'N/A'
                ]);
            });

            // <<<<< ALTERAÇÃO: Captura o y final da tabela >>>>>
            doc.autoTable({
                head: tableHead,
                body: tableBody,
                startY: yPos, // Inicia onde yPos está
                theme: 'grid',
                styles: { font: 'helvetica', fontSize: 7, cellPadding: 1 },
                headStyles: { fillColor: '#3f51b5', textColor: '#ffffff', font: 'helvetica', fontStyle: 'bold', fontSize: 8, cellPadding: 1.5 },
                columnStyles: {
                    0: { cellWidth: 10 },    // Ckt nº
                    1: { cellWidth: 28 },    // Nome (reduzido)
                    2: { cellWidth: 32 },    // Disjuntor (reduzido)
                    3: { cellWidth: 15 },    // DR
                    4: { cellWidth: 15 },    // DPS
                    5: { cellWidth: 'auto' }, // Cabo
                    6: { cellWidth: 20 },    // Eletroduto
                },
                didDrawPage: (data) => {
                    // Se uma nova página foi criada pela tabela, atualiza yPos para a nova página
                    if (data.pageNumber > doc.internal.getNumberOfPages()) {
                        yPos = data.cursor.y + 5;
                        doc.setFont('helvetica', 'normal'); // Reseta fonte na nova página
                    }
                     // Garante reset da fonte mesmo se não mudou de página
                    doc.setFont('helvetica', 'normal');
                },
                margin: { left: lM, right: lM, bottom: bottomMargin + 5 }
            });
             // Atualiza yPos para a posição final da tabela na PÁGINA ATUAL
             yPos = (doc).lastAutoTable.finalY + 10; // Adiciona um espaço após a tabela
            // <<<<< FIM DA ALTERAÇÃO >>>>>
        }
    });

    if (circuitsByQdc['failed']?.length > 0) {
        if (yPos > pageHeight - bottomMargin - 40) { doc.addPage(); yPos = 20; doc.setFont('helvetica', 'normal'); }
        addS("CIRCUITOS COM FALHA NO CÁLCULO");
        circuitsByQdc['failed'].forEach(c => {
            addL("ID (interno):", c?.dados?.id || 'N/A');
        });
    }


    // --- Páginas Detalhadas ---
    // Alimentador Geral
    if (feederResult) {
        doc.addPage();
        yPos = 20;
        doc.setFont('helvetica', 'normal');
        generateMemorialPage(doc, feederResult, "ALIMENTADOR GERAL", 0, addT, addS, addL, () => yPos, (newY) => yPos = newY, lM);
    }

    // Alimentadores QDCs
    if (qdcFeederResults && Array.isArray(qdcFeederResults) && qdcFeederResults.length > 0) {
        let needsPageForSeparator = true; // Flag para adicionar página apenas uma vez

        // Ordena os resultados dos alimentadores de QDC pelo ID do QDC
        qdcFeederResults.sort((a,b) => parseInt(a.dados?.qdcId || '0') - parseInt(b.dados?.qdcId || '0'));

        qdcFeederResults.forEach(qdcResult => {
            if (qdcResult?.dados && qdcResult?.calculos) {
                 // Adiciona página e separador ANTES do primeiro alimentador de QDC
                if (needsPageForSeparator) {
                    doc.addPage();
                    yPos = 20;
                    doc.setFont('helvetica', 'normal');
                    drawSeparator();
                    addS("QUADROS DE DISTRIBUIÇÃO (ALIMENTADORES)");
                    yPos += 5;
                    needsPageForSeparator = false; // Só faz isso uma vez
                }

                const qdcName = document.getElementById(`qdcName-${qdcResult.dados.qdcId}`)?.value || `QDC ${qdcResult.dados.qdcId}`;

                // Verifica se precisa de nova página ANTES de chamar generateMemorialPage
                // (generateMemorialPage cuidará de page breaks internos se necessário)
                const estimatedHeight = 150; // Chute
                if (yPos + estimatedHeight > pageHeight - bottomMargin) {
                    doc.addPage();
                    yPos = 20;
                    doc.setFont('helvetica', 'normal');
                }

                generateMemorialPage(doc, qdcResult, `ALIMENTADOR - ${qdcName.toUpperCase()}`, 0, addT, addS, addL, () => yPos, (newY) => yPos = newY, lM);
                // yPos é atualizado DENTRO de generateMemorialPage
            }
        });
    }

    // Circuitos Terminais
    qdcOrder.forEach(qdcId => {
        const circuits = circuitsByQdc[qdcId];
        const qdcName = document.getElementById(`qdcName-${qdcId}`)?.value || `QDC ${qdcId}`;
        if (circuits && circuits.length > 0) {
            circuits.forEach((c, idx) => {
                doc.addPage();
                yPos = 20;
                doc.setFont('helvetica', 'normal');
                const title = `CIRCUITO ${idx + 1} (QDC: ${qdcName})`;
                generateMemorialPage(doc, c, title, (idx + 1), addT, addS, addL, () => yPos, (newY) => yPos = newY, lM);
                 // yPos é atualizado DENTRO de generateMemorialPage
            });
        }
    });

    try {
        doc.save(`Memorial_${document.getElementById('obra')?.value || 'Projeto'}.pdf`);
    } catch (e) {
        console.error("Erro ao salvar PDF Memorial:", e);
        alert("Erro ao salvar PDF Memorial: " + e.message);
    }
}


// ========================================================================
// >>>>> FUNÇÃO ATUALIZADA (Lógica do Retângulo Simplificada) <<<<<
// ========================================================================
function generateMemorialPage(doc, result, titlePrefix, circuitIndex, addT, addS, addL, getY, setY, lM) {
    const { dados, calculos, logs } = result || {};
    // Pega o Y antes de adicionar qualquer conteúdo nesta página/seção
    const startY = getY();

    // Adiciona o conteúdo normalmente
    if (!dados || !calculos || !calculos.disjuntorRecomendado) {
        addT(titlePrefix);
        addS("ERRO");
        addL("Status:", "Falha no cálculo. Dados incompletos ou cálculo falhou.");
        addL("Logs:", JSON.stringify(result));
    } else {
        addT(`${titlePrefix}${dados.nomeCircuito ? `: ${dados.nomeCircuito}` : ''}`);
        
        addS("DADOS DE ENTRADA");
        addL("Potência (W):", calculos.potenciaInstalada?.toFixed(2));
        addL("Fator Demanda (%):", dados.fatorDemanda);
        addL("Potência Demandada (W):", calculos.potenciaDemandada?.toFixed(2));
        addL("Tensão (V):", dados.tensaoV);
        addL("Sistema:", `${dados.fases} (${dados.tipoLigacao})`);
        addL("Fator de Potência:", dados.fatorPotencia);
        addL("Comprimento (m):", dados.comprimentoM);
        addL("Queda de Tensão Limite (%):", dados.limiteQuedaTensao);
        setY(getY() + 5);

        addS("DADOS AMBIENTAIS E INSTALAÇÃO");
        addL("Método de Instalação:", dados.metodoInstalacao);
        addL("Isolação:", dados.tipoIsolacao);
        addL("Material Condutor:", dados.materialCabo);
        addL("Temp. Ambiente (°C):", dados.temperaturaAmbienteC);
        addL("Resist. Solo (K.m/W):", dados.resistividadeSolo || 'N/A');
        addL("Circuitos Agrupados:", dados.numCircuitosAgrupados);
        setY(getY() + 5);

        addS("CÁLCULO DE CORRENTE");
        addL("Corrente de Projeto (A):", calculos.correnteDemandada?.toFixed(2));
        addL("Fator K1 (Temp.):", calculos.fatorK1);
        addL("Fator K2 (Solo):", calculos.fatorK2);
        addL("Fator K3 (Agrup.):", calculos.fatorK3);
        const kTotal = (calculos.fatorK1 || 1) * (calculos.fatorK2 || 1) * (calculos.fatorK3 || 1);
        addL("Fator K Total (K1*K2*K3):", kTotal.toFixed(3));
        addL("Corrente Corrigida (A):", calculos.correnteCorrigidaA?.toFixed(2));
        setY(getY() + 5);

        addS("CRITÉRIOS DE DIMENSIONAMENTO");
        addL("Cabo (Capacidade):", `${calculos.bitolaRecomendadaMm2 || 'N/A'} mm²`);
        addL("Capacidade Corrente Cabo (A):", calculos.correnteMaximaCabo);
        addL("Disjuntor (Capacidade):", calculos.disjuntorRecomendado?.nome || 'N/A');
        addL("Queda de Tensão Calculada (%):", calculos.quedaTensaoCalculada?.toFixed(3));
        setY(getY() + 5);

        addS("RESULTADO FINAL");
        const numCondutores = calculos.numCondutores || (dados.fases === 'Monofasico' ? 2 : (dados.fases === 'Bifasico' ? 3 : 4)); // Fallback
        const fasesCabo = (numCondutores - (dados.tipoLigacao.includes('N') ? 1 : 0));
        const terraCabo = calculos.bitolaRecomendadaMm2; // Assumindo terra=fase
        const caboStr = `${fasesCabo}x${calculos.bitolaRecomendadaMm2 || 'N/A'}mm²` +
                       (dados.tipoLigacao.includes('N') ? `+ N ${calculos.bitolaRecomendadaMm2 || 'N/A'}mm²` : '') +
                       `+ T ${terraCabo || 'N/A'}mm² (${dados.tipoIsolacao})`;
        addL("Cabo Recomendado:", caboStr);
        addL("Disjuntor Recomendado:", `${calculos.disjuntorRecomendado?.nome || 'N/A'} (ICC: ${calculos.disjuntorRecomendado?.icc || 'N/A'} kA)`);
        addL("DR Recomendado:", dados.requerDR ? "Sim" : "Não");
        addL("DPS Recomendado:", dados.dpsClasse ? `Classe ${dados.dpsClasse}` : "Nenhum");
        addL("Eletroduto:", calculos.dutoRecomendado || 'N/A');
        setY(getY() + 5);

        if (logs && logs.length > 0) {
            addS("LOGS DE CÁLCULO");
            logs.forEach(log => {
                // Verifica se há espaço para o log antes de adicioná-lo
                 if (getY() > doc.internal.pageSize.height - 15 - 10) { // pageHeight - bottomMargin - lineHeight
                    doc.addPage();
                    setY(20); // yPos = 20
                    doc.setFont('helvetica', 'normal');
                }
                addL(log.startsWith("INFO:") ? "Info:" : log.startsWith("WARN:") ? "Aviso:" : "Log:",
                     log.replace("INFO: ", "").replace("WARN: ", "").replace("ERROR: ", ""));
            });
        }
    }

    // Pega o Y final APÓS adicionar todo o conteúdo
    const endY = getY();

    // <<<<< ALTERAÇÃO: Desenha o retângulo APÓS todo o conteúdo >>>>>
    // Adiciona um pequeno padding visual
    const rectStartY = startY - 10;
    const rectHeight = (endY - rectStartY) + 5; // Altura baseada no conteúdo + padding
    const rectWidth = doc.internal.pageSize.width - (lM - 5) * 2;
    const rectX = lM - 5;

    // Verifica se o retângulo cabe na página atual (considerando margem inferior)
    if (rectStartY + rectHeight < doc.internal.pageSize.height - 15) {
        doc.setDrawColor(180, 180, 180); // Cor cinza para a borda
        doc.roundedRect(rectX, rectStartY, rectWidth, rectHeight, 3, 3, 'S');
        doc.setDrawColor(0,0,0); // Reseta a cor de desenho para preto
        setY(endY + 10); // Adiciona espaço após o retângulo
    } else {
        // Se não couber (improvável com page breaks nas funções addS/addL, mas por segurança)
        // Apenas adiciona o espaço final sem desenhar o retângulo quebrado
        setY(endY + 10);
         console.warn("Retângulo não desenhado pois excederia a página:", titlePrefix);
    }
    // <<<<< FIM DA ALTERAÇÃO >>>>>
}


export async function generateUnifilarPdf(calculationResults) {
    if (!calculationResults || !calculationResults.feederResult || !calculationResults.circuitResults) {
        alert("Dados de cálculo insuficientes para gerar Diagrama Unifilar.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); // Paisagem (Landscape)
    const { feederResult, circuitResults } = calculationResults;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Agrupa circuitos por QDC
    const qdcs = {};
    circuitResults.forEach(c => {
        if (!c.dados || !c.calculos) return; // Pula circuitos com falha

        const qdcId = c.dados?.qdcId || 'unknown';
        if (!qdcs[qdcId]) {
             qdcs[qdcId] = {
                 name: document.getElementById(`qdcName-${qdcId}`)?.value || `QDC ${qdcId}`,
                 circuits: []
             };
        }
        qdcs[qdcId].circuits.push(c);
    });

    try {
        const svgString = buildUnifilarSvgString(feederResult, qdcs);

        // Define o tamanho do canvas (A4 paisagem em pixels a 96 DPI)
        const svgWidth = 1122;
        const svgHeight = 794;

        canvas.width = svgWidth;
        canvas.height = svgHeight;

        // Usa Canvg para renderizar o SVG no Canvas
        const v = await Canvg.from(ctx, svgString, {
            ignoreDimensions: true,
            scaleWidth: svgWidth,
            scaleHeight: svgHeight
        });
        await v.render();

        // Adiciona o canvas como imagem ao PDF
        const imgData = canvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', 0, 0, 297, 210); // Adiciona imagem (largura, altura A4)
        doc.save(`Diagrama_Unifilar_${document.getElementById('obra')?.value || 'Projeto'}.pdf`);

    } catch (e) {
        console.error("Erro ao gerar PDF Unifilar:", e);
        alert("Erro ao gerar PDF Unifilar: " + e.message);
    }
}
function buildUnifilarSvgString(feeder, qdcs) {
    const fC = feeder.calculos; // Feeder Calculos
    const fD = feeder.dados; // Feeder Data

    // Pega dados do formulário (que estão em fD)
    const obra = fD.mainData?.obra || 'Projeto';
    const projectCode = fD.mainData?.projectCode || 'S/C';
    const cliente = fD.clientProfile?.cliente || 'N/A';

    let yPos = 80;
    const xStart = 20;
    const qdcWidth = 200;
    const qdcMargin = 20;
    let circuitElements = '';
    let qdcElements = '';
    let qdcIndex = 0;

    for (const qdcId in qdcs) {
        const qdc = qdcs[qdcId];
        const qdcX = xStart + (qdcWidth + qdcMargin) * qdcIndex;

        let cktYPos = yPos + 100;
        let cktLines = '';

        qdc.circuits.sort((a,b) => (a.dados?.id || 0) - (b.dados?.id || 0)); // Ordena

        qdc.circuits.forEach((c, idx) => {
            const cC = c.calculos;
            const cD = c.dados;
            const cktNum = idx + 1;
            const cabo = `${cC.bitolaRecomendadaMm2 || 'N/A'} mm²`;

            cktLines += `
                <line x1="${qdcX + 100}" y1="${cktYPos}" x2="${qdcX + 100}" y2="${cktYPos + 60}" stroke="black" stroke-width="1"/>
                ${drawDisjuntor(qdcX + 100, cktYPos + 15, (cC.disjuntorRecomendado?.curva || 'C'), (cC.disjuntorRecomendado?.nome || 'N/A').replace('A',''), cD.fases)}
                ${drawText(cabo, qdcX + 115, cktYPos + 45, 10)}
                ${drawText(`Ckt ${cktNum}: ${cD.nomeCircuito}`, qdcX + 100, cktYPos + 75, 10, 'middle')}
                ${drawText(`${cD.potenciaW} W`, qdcX + 100, cktYPos + 88, 9, 'middle')}
            `;
            cktYPos += 95;
        });

        const qdcHeight = (cktYPos - (yPos + 100)) + 40; // Altura baseada nos circuitos

        qdcElements += `
            <line x1="${xStart + 150}" y1="${yPos}" x2="${qdcX + 100}" y2="${yPos}" stroke="black" stroke-width="2"/>
            <line x1="${qdcX + 100}" y1="${yPos}" x2="${qdcX + 100}" y2="${yPos + 50}" stroke="black" stroke-width="2"/>
            <rect x="${qdcX}" y="${yPos + 50}" width="${qdcWidth}" height="${qdcHeight}" stroke="black" stroke-width="2" fill="none" />
            <text x="${qdcX + 100}" y="${yPos + 70}" font-size="14" font-weight="bold" text-anchor="middle">${qdc.name}</text>
            <line x1="${qdc}" y1="${yPos + 80}" x2="${qdcX + 200}" y2="${yPos + 80}" stroke="black" stroke-width="1" />
            ${cktLines}
        `;
        qdcIndex++;
    }

    const feederCabo = `${fC.bitolaRecomendadaMm2 || 'N/A'} mm²`;
    const feederDR = fD.requerDR ? "DR Geral" : "Nenhum DR";
    const feederDPS = fD.dpsClasse ? `DPS Classe ${fD.dpsClasse}` : "Nenhum DPS";

    return `
    <svg width="1122" height="794" xmlns="http://www.w3.org/2000/svg" style="background-color: white; font-family: Arial, sans-serif;">
        <rect x="0" y="0" width="1122" height="50" fill="#f0f0f0" />
        <text x="561" y="30" font-size="20" font-weight="bold" text-anchor="middle">DIAGRAMA UNIFILAR</text>
        <text x="10" y="20" font-size="12">Obra: ${obra}</text>
        <text x="10" y="35" font-size="12">Cliente: ${cliente}</text>
        <text x="1000" y="20" font-size="12">Código: ${projectCode}</text>
        <text x="1000" y="35" font-size="12">Data: ${new Date().toLocaleDateString('pt-BR')}</text>

        <g id="alimentador-geral">
            <line x1="${xStart + 150}" y1="${yPos}" x2="${xStart + 150}" y2="${yPos - 30}" stroke="black" stroke-width="2" />
            <text x="${xStart}" y="${yPos - 15}" font-size="12">REDE</text>

            ${drawDisjuntor(xStart + 150, yPos - 15, (fC.disjuntorRecomendado?.curva || 'C'), (fC.disjuntorRecomendado?.nome || 'N/A').replace('A',''), fD.fases)}
            ${drawText(feederDR, xStart + 100, yPos + 10, 10)}
            ${drawText(feederDPS, xStart + 100, yPos + 25, 10)}
            ${drawText(feederCabo, xStart + 165, yPos + 15, 10)}

            <rect x="${xStart + 50}" y="${yPos + 40}" width="200" height="40" stroke="blue" stroke-width="1" fill="none" />
            <text x="${xStart + 150}" y="${yPos + 65}" font-size="12" text-anchor="middle">QG (Alimentador Geral)</text>
            <line x1="${xStart + 150}" y1="${yPos + 80}" x2="${xStart + 150}" y2="${yPos + 100}" stroke="black" stroke-width="2" />

            <line x1="${xStart + 150}" y1="${yPos}" x2="${xStart + 150 + (qdcIndex > 0 ? ((qdcWidth + qdcMargin) * (qdcIndex -1)) : 0)}" y2="${yPos}" stroke="black" stroke-width="2" />

        </g>

        <g id="qdcs-e-circuitos">
            ${qdcElements}
        </g>
    </svg>
    `;
}
function drawDisjuntor(x, y, curva, corrente, fases) {
    const polos = (fases === 'Monofasico' ? 1 : (fases === 'Bifasico' ? 2 : 3));
    const label = `${curva}-${corrente}A`;
    return `
        <g transform="translate(${x}, ${y})">
            <rect x="-10" y="-10" width="20" height="20" stroke="black" stroke-width="1" fill="white" />
            <line x1="-10" y1="-10" x2="0" y2="0" stroke="black" stroke-width="1" />
            <text x="0" y="22" font-size="10" text-anchor="middle">${label} (${polos}P)</text>
        </g>
    `;
}
function drawText(text, x, y, size = 12, anchor = 'start') {
    if (!text || text === 'N/A' || text === 'Nenhum' || text.includes('undefined')) return '';
    // Remove a unidade 'A' que pode vir do nome do disjuntor
    const cleanedText = String(text).replace(/ A$/,'A');
    return `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}">${cleanedText}</text>`;
}


console.log("--- ui.js: Fim do arquivo ---");