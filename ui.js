// Arquivo: ui.js (COMPLETO E CORRIGIDO - Com verificação em restoreValues)

console.log("--- ui.js: Iniciando carregamento ---");

import { ligacoes, BTU_TO_WATTS_FACTOR, CV_TO_WATTS_FACTOR } from './utils.js';
// >>>>> ALTERAÇÃO: 'Canvg' foi removido das importações
// Importa o debounce
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

// Função renomeada para _internal_ e removido 'export'
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
        
        // >>>>> ALTERAÇÃO AQUI (1 de 2): Popula o novo campo "Demandada (Própria)"
        const qdcDemPropriaEl = document.getElementById(`qdcDemandaPropria-${qdcId}`); 
        if (qdcDemPropriaEl) qdcDemPropriaEl.value = demandedDirect.toFixed(2);
        
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

// Criada a nova função 'debounced' que será exportada e usada por todos
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

// >>>>> ALTERAÇÃO AQUI (2 de 2): Ajusta o HTML do QDC
function getQdcHTML(id, name = `QDC ${id}`, parentId = 'feeder') {
    return `
    <div class="qdc-block" id="qdc-${id}" data-id="${id}">
        <div class="qdc-header">
            <div class="form-group qdc-header-left"> <label for="qdcName-${id}">Nome do Quadro</label> <input type="text" id="qdcName-${id}" value="${name}" class="qdc-name-input"> </div>
            <div class="form-group qdc-header-center"> <label for="qdcParent-${id}">Alimentado por:</label> <select id="qdcParent-${id}" class="qdc-parent-select" data-initial-parent="${parentId}"></select> </div>
            <div class="qdc-header-right"> <button type="button" class="add-circuit-to-qdc-btn btn-green" data-qdc-id="${id}">+ Circuito</button> <button type="button" class="remove-qdc-btn btn-red" data-qdc-id="${id}">Remover QDC</button> <span class="toggle-arrow">▼</span> </div>
        </div>
        <div class="qdc-content">
            <div class="form-grid-3-col" style="padding-bottom: 15px; margin-bottom: 15px; border-bottom: 1px solid var(--border-color);">
                <div class="form-group"> <label for="qdcPotenciaInstalada-${id}">Instalada (Própria) (W)</label> <input type="text" id="qdcPotenciaInstalada-${id}" value="0.00" readonly> </div>
                <div class="form-group"> <label for="qdcDemandaPropria-${id}">Demandada (Própria) (W)</label> <input type="text" id="qdcDemandaPropria-${id}" value="0.00" readonly style="color: #007bff; font-weight: bold;"> </div>
                <div class="form-group"> <label for="qdcPotenciaDemandada-${id}">Demandada (Total) (W)</label> <input type="text" id="qdcPotenciaDemandada-${id}" value="0.00" readonly style="color: #28a745; font-weight: bold;"> </div>
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
        
        // Esta chamada agora usa a versão debounced
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
            
            // Esta chamada agora usa a versão debounced
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
        // >>>>> INÍCIO DA CORREÇÃO <<<<<
        const restoreValues = () => {
            // Verifica se o elemento existe ANTES de tentar setar o valor
            if (potenciaBTUSelect && savedCircuitData[`potenciaBTU-${internalId}`]) {
                potenciaBTUSelect.value = savedCircuitData[`potenciaBTU-${internalId}`];
                // Dispara o evento change APENAS se o valor foi setado e não é vazio
                if (potenciaBTUSelect.value) {
                     potenciaBTUSelect.dispatchEvent(new Event('change'));
                }
            }
            // Verifica se o elemento existe ANTES de tentar setar o valor
            if (potenciaCVSelect && savedCircuitData[`potenciaCV-${internalId}`]) {
                potenciaCVSelect.value = savedCircuitData[`potenciaCV-${internalId}`];
                 // Dispara o evento change APENAS se o valor foi setado e não é vazio
                if (potenciaCVSelect.value) {
                    potenciaCVSelect.dispatchEvent(new Event('change'));
                }
            }
            // Verifica se o elemento existe ANTES de tentar setar o valor
            if (resistividadeSolo && savedCircuitData[`resistividadeSolo-${internalId}`]) {
                resistividadeSolo.value = savedCircuitData[`resistividadeSolo-${internalId}`];
                // Geralmente não precisa disparar 'change' para resistividade
            }
        };
        // >>>>> FIM DA CORREÇÃO <<<<<

        // A lógica do setTimeout permanece a mesma
        if (!(circuitContainer instanceof DocumentFragment)) {
            setTimeout(restoreValues, 50); // Adia a execução ligeiramente
        } else {
            restoreValues(); // Executa imediatamente se for fragmento
        }
    } else {
       // updateFeederPowerDisplay(); // Chamada removida anteriormente
    }
    
    // Atualiza o display DEPOIS de adicionar (apenas se não for fragmento)
    if (!(circuitContainer instanceof DocumentFragment)) {
        updateFeederPowerDisplay();
    }
} // Fim da função addCircuit


export function removeCircuit(circuitId) {
    if (!circuitId) return;
    const circuitElement = document.getElementById(`circuit-${circuitId}`);
    if (circuitElement) {
        // Não precisa de confirmação para remover circuito
        circuitElement.remove();
        
        // Esta chamada agora usa a versão debounced
        updateFeederPowerDisplay(); // Recalcula cargas
    }
}
function getCircuitHTML(id) {
    return `<div class="circuit-block" id="circuit-${id}" data-id="${id}"> <div class="circuit-header"> <h3 class="circuit-header-left">Circuito <span class="circuit-number"></span></h3> <h3 class="circuit-header-center" id="nomeCircuitoLabel-${id}">Circuito ${id}</h3> <div class="circuit-header-right"> <button type="button" class="remove-circuit-btn btn-red" data-circuit-id="${id}">Remover</button> <span class="toggle-arrow">▼</span> </div> </div> <div class="circuit-content"> <div class="form-grid"> <div class="form-group"> <label for="nomeCircuito-${id}">Nome do Circuito</label> <input type="text" id="nomeCircuito-${id}" value="Circuito ${id}"> </div> <div class="full-width potencia-group"> <div class="form-group"> <label for="tipoCircuito-${id}">Tipo de Circuito</label> <select id="tipoCircuito-${id}"> <option value="iluminacao">Iluminação</option> <option value="tug" selected>TUG</option> <option value="tue">TUE</option> <option value="aquecimento">Aquecimento</option> <option value="motores">Motores</option> <option value="ar_condicionado">Ar Condicionado</option> </select> </div> <div class="form-group hidden" id="potenciaBTU_group-${id}"> <label for="potenciaBTU-${id}">Potência (BTU/h)</label> <select id="potenciaBTU-${id}"></select> </div> <div class="form-group hidden" id="potenciaCV_group-${id}"> <label for="potenciaCV-${id}">Potência (CV)</label> <select id="potenciaCV-${id}"></select> </div> <div class="form-group"> <label for="potenciaW-${id}">Potência (W)</label> <input type="number" id="potenciaW-${id}" value="2500"> </div> </div> <div class="form-group"> <label for="fatorDemanda-${id}">Fator Demanda (%)</label> <input type="number" id="fatorDemanda-${id}" value="100" step="1"> </div> <div class="form-group"> <label for="fases-${id}">Fases</label> <select id="fases-${id}"> <option value="Monofasico" selected>Monofásico</option> <option value="Bifasico">Bifásico</option> <option value="Trifasico">Trifásico</option> </select> </div> <div class="form-group"> <label for="tipoLigacao-${id}">Ligação</label> <select id="tipoLigacao-${id}"></select> </div> <div class="form-group"> <label for="tensaoV-${id}">Tensão (V)</label> <select id="tensaoV-${id}"><option value="12">12</option><option value="24">24</option><option value="36">36</option><option value="127">127</option><option value="220" selected>220</option><option value="380">380</option><option value="440">440</option><option value="760">760</option></select> </div> <div class="form-group"> <label for="fatorPotencia-${id}">Fator Potência</label> <input type="number" id="fatorPotencia-${id}" step="0.01" value="0.92"> </div> <div class="form-group"> <label for="comprimentoM-${id}">Comprimento (m)</label> <input type="number" id="comprimentoM-${id}" value="20"> </div> <div class="form-group"> <label for="tipoIsolacao-${id}">Isolação</label> <select id="tipoIsolacao-${id}"><option value="PVC" selected>PVC 70°C</option><option value="EPR">EPR 90°C</option><option value="XLPE">XLPE 90°C</option></select> </div> <div class="form-group"> <label for="materialCabo-${id}">Condutor</label> <select id="materialCabo-${id}"><option value="Cobre" selected>Cobre</option><option value="Aluminio">Alumínio</option></select> </div> <div class="form-group"> <label for="metodoInstalacao-${id}">Instalação</label> <select id="metodoInstalacao-${id}"><option value="A1">A1</option><option value="A2">A2</option><option value="B1" selected>B1</option><option value="B2">B2</option><option value="C">C</option><option value."D">D</option></select> </div> <div class="form-group"> <label for="temperaturaAmbienteC-${id}">Temp. Ambiente</label> <select id="temperaturaAmbienteC-${id}"></select> </div> <div class="form-group"> <label for="resistividadeSolo-${id}">Resist. Solo</label> <select id="resistividadeSolo-${id}"></select> </div> <div class="form-group"> <label for="numCircuitosAgrupados-${id}">Ckt Agrupados</label> <select id="numCircuitosAgrupados-${id}"><option value="1" selected>1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option></select> </div> <div class="form-group"> <label for="limiteQuedaTensao-${id}">Limite DV (%)</label> <input type="number" id="limiteQuedaTensao-${id}" step="0.1" value="4.0"> </div> <div class="form-group"> <label for="tipoDisjuntor-${id}">Disjuntor</label> <select id="tipoDisjuntor-${id}"><option value="Minidisjuntor (DIN)">DIN</option><option value="Caixa Moldada (MCCB)">MCCB</option></select> </div> <div class="form-group"> <label for="dpsClasse-${id}">Classe DPS</label> <select id="dpsClasse-${id}"><option value="">Nenhum</option><option value="I">I</option><option value="II">II</option></select> </div> <div class="checkbox-group"> <input type="checkbox" id="requerDR-${id}"><label for="requerDR-${id}">Requer DR</label> </div> </div> </div> </div>`;
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
                // Esta chamada agora usa a versão debounced
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
                // Esta chamada agora usa a versão debounced
                updateFeederPowerDisplay(); // Atualiza a potência
                return;
            }
            // MUDAR POTÊNCIA CV
            if (target.id === `potenciaCV-${circuitId}`) {
                handlePowerUnitChange(circuitId, 'cv');
                // Esta chamada agora usa a versão debounced
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
             // Esta chamada agora usa a versão debounced
             updateFeederPowerDisplay(); // Calcula display final
         }, 100); // Pequeno delay
    } else {
         // Se não há QDCs, apenas calcula o display (caso raro de projeto sem QDC)
         // Esta chamada agora usa a versão debounced
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
// >>>>> ALTERAÇÃO: TODO O BLOCO DE FUNÇÕES DE PDF (generateMemorialPdf, generateMemorialPage, generateUnifilarPdf, buildUnifilarSvgString, drawDisjuntor, drawText) FOI REMOVIDO DESTE ARQUIVO.


console.log("--- ui.js: Fim do arquivo ---");