// Arquivo: ui.js (v3 - Lazy Loading Otimizado, Correção Botão Ocultar, Correção Soma UI)

console.log("--- ui.js: Iniciando carregamento ---");

import { ligacoes, BTU_TO_WATTS_FACTOR, CV_TO_WATTS_FACTOR } from './utils.js';
import { debounce } from './utils.js';

let circuitCount = 0;
let qdcCount = 0;
let uiData = null;
let tempOptions = { pvc: [], epr: [] };
export let loadedProjectData = null; // Armazena dados do projeto carregado para lazy loading

// Função para definir os dados do projeto carregado (chamada por main.js)
export function setLoadedProjectData(projectData) {
    loadedProjectData = projectData;
    // console.log("[UI] Dados do projeto armazenados para lazy loading."); // Log Reduzido
}

export function setupDynamicData(data) {
    uiData = data;
    // Processamento K1 PVC
    if (uiData?.fatores_k1 && Array.isArray(uiData.fatores_k1)) {
        tempOptions.pvc = uiData.fatores_k1.filter(f => f && typeof f.fator === 'number' && f.fator > 0 && typeof f.temperatura_c === 'number').map(f => f.temperatura_c).sort((a, b) => a - b);
    } else { tempOptions.pvc = []; console.warn("Dados de fatores_k1 (PVC) não encontrados ou inválidos."); }
    if (!tempOptions.pvc.includes(30)) tempOptions.pvc.push(30);
    tempOptions.pvc = [...new Set(tempOptions.pvc)].sort((a,b) => a - b);

    // Processamento K1 EPR
    if (uiData?.fatores_k1_epr && Array.isArray(uiData.fatores_k1_epr)) {
        tempOptions.epr = uiData.fatores_k1_epr.filter(f => f && typeof f.fator === 'number' && f.fator > 0 && typeof f.temperatura_c === 'number').map(f => f.temperatura_c).sort((a, b) => a - b);
    } else { tempOptions.epr = []; console.warn("Dados de fatores_k1_epr não encontrados ou inválidos."); }
    if (tempOptions.epr.length === 0) tempOptions.epr = tempOptions.pvc.length > 0 ? [...tempOptions.pvc] : [30];
    tempOptions.epr = [...new Set(tempOptions.epr)].sort((a,b) => a - b);
}

function populateTemperatureDropdown(selectElement, temperatures) {
    if (!selectElement || !temperatures || !Array.isArray(temperatures)) { if(selectElement) selectElement.innerHTML = '<option value="30">30°C</option>'; return; }
    const currentValue = selectElement.value; selectElement.innerHTML = '';
    const validTemps = [...new Set(temperatures.filter(temp => typeof temp === 'number' && !isNaN(temp)))].sort((a,b)=> a-b);
    if (validTemps.length === 0) { validTemps.push(30); }
    if (temperatures === tempOptions.pvc && !validTemps.includes(30)) { validTemps.push(30); validTemps.sort((a,b)=> a-b); }
    validTemps.forEach(temp => { const option = document.createElement('option'); option.value = temp; option.textContent = `${temp}°C`; selectElement.appendChild(option); });
    if (validTemps.map(String).includes(currentValue)) { selectElement.value = currentValue; } else if (validTemps.includes(30)) { selectElement.value = '30'; } else if (validTemps.length > 0) { selectElement.value = validTemps[0]; }
}

function populateBtuDropdown(selectElement, btuData) {
    if (!selectElement) { console.error("populateBtuDropdown: selectElement é nulo!"); return; }
    selectElement.innerHTML = '<option value="">-- Selecione --</option>';
    if (!btuData || !Array.isArray(btuData)) { console.warn("Dados de BTU inválidos ou ausentes."); return; }
    btuData.map(item => ({ ...item, valor_btu: parseFloat(item.valor_btu) })).filter(item => item && !isNaN(item.valor_btu)).sort((a, b) => a.valor_btu - b.valor_btu).forEach(item => { const option = document.createElement('option'); option.value = item.valor_btu; option.textContent = item.descricao; selectElement.appendChild(option); });
}

function populateCvDropdown(selectElement, cvData) {
     if (!selectElement) { console.error("populateCvDropdown: selectElement é nulo!"); return; }
    selectElement.innerHTML = '<option value="">-- Selecione --</option>';
    if (!cvData || !Array.isArray(cvData)) { console.warn("Dados de CV inválidos ou ausentes."); return; }
     cvData.map(item => ({ ...item, valor_cv: parseFloat(item.valor_cv) })).filter(item => item && !isNaN(item.valor_cv)).sort((a, b) => a.valor_cv - b.valor_cv).forEach(item => { const option = document.createElement('option'); option.value = item.valor_cv; option.textContent = item.descricao; selectElement.appendChild(option); });
}

function populateSoilResistivityDropdown(selectElement, soilData) {
    if (!selectElement) return; selectElement.innerHTML = '<option value="0">Não Aplicável</option>'; if (!soilData || !Array.isArray(soilData)) { console.warn("Dados de resistividade do solo inválidos ou ausentes."); return; }
    soilData.map(item => ({ ...item, resistividade: parseFloat(item.resistividade) })).filter(item => item && !isNaN(item.resistividade)).sort((a, b) => a.resistividade - b.resistividade).forEach(item => { const option = document.createElement('option'); option.value = item.resistividade; option.textContent = `${item.resistividade}`; selectElement.appendChild(option); });
}

// --- FUNÇÕES DE VISIBILIDADE E MODAIS ---
export function showLoginView() { const l = document.getElementById('loginContainer'); if(l) l.style.display = 'block'; const a = document.getElementById('appContainer'); if(a) a.style.display = 'none'; const r = document.getElementById('resetPasswordContainer'); if(r) r.style.display = 'none'; }
export function showAppView(userProfile) { const l = document.getElementById('loginContainer'); if(l) l.style.display = 'none'; const a = document.getElementById('appContainer'); if(a) a.style.display = 'block'; const r = document.getElementById('resetPasswordContainer'); if(r) r.style.display = 'none'; const isAdmin = userProfile?.is_admin || false; const adminBtn = document.getElementById('adminPanelBtn'); if(adminBtn) adminBtn.style.display = isAdmin ? 'block' : 'none'; const clientBtn = document.getElementById('manageClientsBtn'); if(clientBtn) clientBtn.style.display = 'block'; const projBtn = document.getElementById('manageProjectsBtn'); if(projBtn) projBtn.style.display = 'block'; }
export function showResetPasswordView() { const l = document.getElementById('loginContainer'); if(l) l.style.display = 'none'; const a = document.getElementById('appContainer'); if(a) a.style.display = 'none'; const r = document.getElementById('resetPasswordContainer'); if(r) r.style.display = 'block'; }
export function openModal(modalId) { const modal = document.getElementById(modalId); if(modal) modal.style.display = 'flex'; else console.error(`Modal com ID '${modalId}' não encontrado.`); }
export function closeModal(modalId) { const modal = document.getElementById(modalId); if(modal) modal.style.display = 'none'; }

// --- FUNÇÃO DE ATUALIZAÇÃO HIERÁRQUICA DE CARGA VISUAL ---
function _internal_updateFeederPowerDisplay() {
    // console.log("Recalculando potências..."); // Log Removido
    const qdcData = {};
    let totalInstalledGeneral = 0; // Soma das P.Inst. *diretas* de todos circuitos visíveis

    // 1. Coleta dados diretos (visíveis) e constrói mapa de parentesco
    document.querySelectorAll('#qdc-container .qdc-block').forEach(qdcBlock => {
        const qdcId = qdcBlock.dataset.id;
        if (!qdcId) return;

        let installedDirect = 0;
        let demandedDirect = 0;

        // Só soma circuitos que JÁ FORAM CARREGADOS no DOM (visíveis)
        qdcBlock.querySelectorAll('.circuit-block').forEach(circuitBlock => {
            const id = circuitBlock.dataset.id;
            if (!id) return;
            const potenciaWInput = circuitBlock.querySelector(`#potenciaW-${id}`);
            const fatorDemandaInput = circuitBlock.querySelector(`#fatorDemanda-${id}`);
            if (potenciaWInput && fatorDemandaInput) {
                const potenciaW = parseFloat(potenciaWInput.value) || 0;
                const fatorDemanda = (parseFloat(fatorDemandaInput.value) || 100) / 100.0;
                installedDirect += potenciaW;
                demandedDirect += (potenciaW * fatorDemanda);
            }
        });

        // P.Inst. Geral = Soma das P.Inst. de todos os circuitos visíveis em todos os QDCs
        // Esta soma está INCORRETA para hierarquia. Será corrigida no passo 3.
        // totalInstalledGeneral += installedDirect; // REMOVIDO TEMPORARIAMENTE
        
        const parentSelect = qdcBlock.querySelector(`#qdcParent-${qdcId}`);
        const parentId = parentSelect ? parentSelect.value : 'feeder'; // ex: 'feeder' ou 'qdc-1'

        qdcData[qdcId] = {
            installedDirect: installedDirect, // P.Inst. só dos circuitos filhos diretos visíveis
            demandedDirect: demandedDirect,   // P.Dem. só dos circuitos filhos diretos visíveis
            parentId: parentId,
            childrenIds: [],
            aggregatedInstalled: -1, // P.Inst. Agregada (inclui filhos)
            aggregatedDemand: -1     // P.Dem. Agregada (inclui filhos)
        };

        // Atualiza campos de exibição "Visíveis"
        const qdcPotInstEl = qdcBlock.querySelector(`#qdcPotenciaInstalada-${qdcId}`);
        if (qdcPotInstEl) qdcPotInstEl.value = installedDirect.toFixed(2);
        const qdcDemPropriaEl = qdcBlock.querySelector(`#qdcDemandaPropria-${qdcId}`);
        if (qdcDemPropriaEl) qdcDemPropriaEl.value = demandedDirect.toFixed(2);
    });

    // 2. Constrói a árvore
    Object.keys(qdcData).forEach(qdcId => {
        const parentId = qdcData[qdcId].parentId; // ex: 'qdc-1'
        if (parentId !== 'feeder') {
            const parentKey = parentId.replace('qdc-', ''); // '1'
            if (qdcData[parentKey]) {
                qdcData[parentKey].childrenIds.push(qdcId);
            }
        }
    });

    // 3. Funções Recursivas para calcular agregação
    const visitedDemand = new Set();
    function calculateAggregatedDemand(qdcId) {
        if (!qdcData[qdcId]) return 0;
        if (qdcData[qdcId].aggregatedDemand !== -1) return qdcData[qdcId].aggregatedDemand;
        if (visitedDemand.has(qdcId)) { console.error(`Loop de demanda detectado em ${qdcId}`); return qdcData[qdcId].demandedDirect; }
        visitedDemand.add(qdcId);

        // P.Dem. Agregada = P.Dem. Direta + SOMA(P.Dem. Agregadas dos Filhos)
        let aggregatedDemand = qdcData[qdcId].demandedDirect;
        qdcData[qdcId].childrenIds.forEach(childId => {
            aggregatedDemand += calculateAggregatedDemand(childId);
        });
        
        visitedDemand.delete(qdcId);
        qdcData[qdcId].aggregatedDemand = aggregatedDemand;
        return aggregatedDemand;
    }

    const visitedInstalled = new Set();
    function calculateAggregatedInstalled(qdcId) {
        if (!qdcData[qdcId]) return 0;
        if (qdcData[qdcId].aggregatedInstalled !== -1) return qdcData[qdcId].aggregatedInstalled;
        if (visitedInstalled.has(qdcId)) { console.error(`Loop de instalada detectado em ${qdcId}`); return qdcData[qdcId].installedDirect; }
        visitedInstalled.add(qdcId);

        // P.Inst. Agregada = P.Inst. Direta + SOMA(P.Inst. Agregadas dos Filhos)
        let aggregatedInstalled = qdcData[qdcId].installedDirect;
        qdcData[qdcId].childrenIds.forEach(childId => {
            aggregatedInstalled += calculateAggregatedInstalled(childId);
        });

        visitedInstalled.delete(qdcId);
        qdcData[qdcId].aggregatedInstalled = aggregatedInstalled;
        return aggregatedInstalled;
    }

    // 4. Calcula e preenche campos agregados
    let totalDemandAggregatedGeneral = 0;
    let totalInstalledAggregatedGeneral = 0;

    Object.keys(qdcData).forEach(qdcId => {
        visitedDemand.clear();
        visitedInstalled.clear();
        
        const aggregatedDemand = calculateAggregatedDemand(qdcId);
        const aggregatedInstalled = calculateAggregatedInstalled(qdcId); // Calcula P. Inst. Agregada

        const qdcPotDemEl = document.getElementById(`qdcPotenciaDemandada-${qdcId}`);
        if (qdcPotDemEl) qdcPotDemEl.value = aggregatedDemand.toFixed(2); // Exibe P. Dem. Agregada

        // Soma para o Alimentador Geral APENAS se for filho direto do 'feeder'
        if (qdcData[qdcId].parentId === 'feeder') {
            totalDemandAggregatedGeneral += aggregatedDemand;
            totalInstalledAggregatedGeneral += aggregatedInstalled; // Soma P. Inst. Agregada
        }
    });

    // 5. Atualiza campos do Alimentador Geral
    const feederPotInstaladaEl = document.getElementById('feederPotenciaInstalada');
    const feederSomaPotDemandadaEl = document.getElementById('feederSomaPotenciaDemandada');
    const feederFatorDemandaInput = document.getElementById('feederFatorDemanda');
    const feederPotDemandadaFinalEl = document.getElementById('feederPotenciaDemandada');

    // P. Inst. Geral = Soma das P.Inst. *Agregadas* dos QDCs raiz
    if (feederPotInstaladaEl) feederPotInstaladaEl.value = totalInstalledAggregatedGeneral.toFixed(2);
    // P. Dem. "Soma" = Soma das P.Dem. *Agregadas* dos QDCs raiz
    if (feederSomaPotDemandadaEl) feederSomaPotDemandadaEl.value = totalDemandAggregatedGeneral.toFixed(2);
    
    const feederFatorDemanda = (parseFloat(feederFatorDemandaInput?.value) || 100) / 100.0;
    // Demanda Final = (Soma P.Dem. Agregadas QDCs raiz) * FD Geral
    const finalDemandGeral = totalDemandAggregatedGeneral * feederFatorDemanda;
    if (feederPotDemandadaFinalEl) feederPotDemandadaFinalEl.value = finalDemandGeral.toFixed(2);
}
export const updateFeederPowerDisplay = debounce(_internal_updateFeederPowerDisplay, 350);

// --- LÓGICA DE QDC E FORMULÁRIO ---
export function resetForm(addDefaultQdc = true, linkedClient = null) {
    // console.log("resetForm chamado"); // Log Removido
    loadedProjectData = null; // Limpa dados do projeto anterior
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

// >>>>> getQdcHTML com botão Exibir/Ocultar e placeholder <<<<<
function getQdcHTML(id, name = `QDC ${id}`, parentId = 'feeder') {
    // QDC começa 'collapsed' e com 'data-circuits-loaded="false"'
    return `
    <div class="qdc-block collapsed" id="qdc-${id}" data-id="${id}" data-circuits-loaded="false">
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
                <button type="button" class="toggle-circuits-btn btn-grey" data-qdc-id="${id}">Exibir Circuitos</button>
                <button type="button" class="add-circuit-to-qdc-btn btn-green" data-qdc-id="${id}">+ Circuito</button>
                <button type="button" class="remove-qdc-btn btn-red" data-qdc-id="${id}">Remover QDC</button>
                </div>
        </div>
        <div class="qdc-content">
            <div class="form-grid-3-col" style="padding-bottom: 15px; margin-bottom: 15px; border-bottom: 1px solid var(--border-color);">
                 <div class="form-group"> <label for="qdcPotenciaInstalada-${id}">Instalada (Circuitos Visíveis)</label> <input type="text" id="qdcPotenciaInstalada-${id}" value="0.00" readonly> </div>
                 <div class="form-group"> <label for="qdcDemandaPropria-${id}">Demandada (Circuitos Visíveis)</label> <input type="text" id="qdcDemandaPropria-${id}" value="0.00" readonly style="color: #007bff; font-weight: bold;"> </div>
                 <div class="form-group"> <label for="qdcPotenciaDemandada-${id}">Demandada Total (Agregada)</label> <input type="text" id="qdcPotenciaDemandada-${id}" value="0.00" readonly style="color: #28a745; font-weight: bold;"> </div>
            </div>
            <h4 style="margin-top: 0; margin-bottom: 10px; color: var(--label-color);">Configuração do Alimentador deste QDC</h4>
            <div class="form-grid qdc-config-grid">
                 <div class="form-group"> <label for="qdcFatorDemanda-${id}">FD (%)</label> <input type="number" id="qdcFatorDemanda-${id}" value="100" step="1"> </div>
                 <div class="form-group"> <label for="qdcFases-${id}">Fases</label> <select id="qdcFases-${id}"> <option value="Monofasico">Monofásico</option> <option value="Bifasico">Bifásico</option> <option value="Trifasico" selected>Trifásico</option> </select> </div>
                 <div class="form-group"> <label for="qdcTipoLigacao-${id}">Ligação</label> <select id="qdcTipoLigacao-${id}"></select> </div>
                 <div class="form-group"> <label for="qdcTensaoV-${id}">Tensão (V)</label> <select id="qdcTensaoV-${id}"><option value="12">12</option><option value="24">24</option><option value="36">36</option><option value="127">127</option><option value="220" selected>220</option><option value="380">380</option><option value="440">440</option><option value="760">760</option></select> </div>
                 <div class="form-group"> <label for="qdcFatorPotencia-${id}">FP</label> <input type="number" id="qdcFatorPotencia-${id}" step="0.01" value="0.92"> </div>
                 <div class="form-group"> <label for="qdcComprimentoM-${id}">Comp. (m)</label> <input type="number" id="qdcComprimentoM-${id}" value="10"> </div>
                 <div class="form-group"> <label for="qdcTipoIsolacao-${id}">Isolação</label> <select id="qdcTipoIsolacao-${id}"><option value="PVC" selected>PVC 70°C</option><option value="EPR">EPR 90°C</option><option value="XLPE">XLPE 90°C</option></select> </div>
                 <div class="form-group"> <label for="qdcMaterialCabo-${id}">Condutor</label> <select id="qdcMaterialCabo-${id}"><option value="Cobre" selected>Cobre</option><option value="Aluminio">Alumínio</option></select> </div>
                 <div class="form-group"> <label for="qdcMetodoInstalacao-${id}">Instalação</label> <select id="qdcMetodoInstalacao-${id}"><option value="A1">A1</option><option value="A2">A2</option><option value="B1" selected>B1</option><option value="B2">B2</option><option value="C">C</option><option value="D">D</option></select> </div>
                 <div class="form-group"> <label for="qdcTemperaturaAmbienteC-${id}">Temp. Amb.</label> <select id="qdcTemperaturaAmbienteC-${id}"></select> </div>
                 <div class="form-group"> <label for="qdcResistividadeSolo-${id}">Res. Solo</label> <select id="qdcResistividadeSolo-${id}"></select> </div>
                 <div class="form-group"> <label for="qdcNumCircuitosAgrupados-${id}">Ckt Agrup.</label> <select id="qdcNumCircuitosAgrupados-${id}"><option value="1" selected>1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option></select> </div>
                 <div class="form-group"> <label for="qdcLimiteQuedaTensao-${id}">Limite DV (%)</label> <input type="number" id="qdcLimiteQuedaTensao-${id}" step="0.1" value="2.0"> </div>
                 <div class="form-group"> <label for="qdcTipoDisjuntor-${id}">Disjuntor</label> <select id="qdcTipoDisjuntor-${id}"><option value="Minidisjuntor (DIN)">DIN</option><option value="Caixa Moldada (MCCB)">MCCB</option></select> </div>
                 <div class="form-group"> <label for="qdcDpsClasse-${id}">Classe DPS</label> <select id="qdcDpsClasse-${id}"><option value="">Nenhum</option><option value="I">I</option><option value="II">II</option></select> </div>
                 <div class="checkbox-group"> <input type="checkbox" id="qdcRequerDR-${id}"><label for="qdcRequerDR-${id}">Requer DR</label> </div>
            </div>
            <h4 style="margin-top: 20px; margin-bottom: 10px; color: var(--label-color); border-top: 1px solid var(--border-color); padding-top: 15px;">Circuitos deste QDC</h4>
            <div id="circuits-for-qdc-${id}" class="circuits-container-internal">
                 <p class="circuits-loading-placeholder" style="text-align:center; color:#888; display:none;">Carregando circuitos...</p>
            </div>
        </div>
    </div>`;
}

// >>>>> addQdcBlock não adiciona circuito automaticamente se não for novo <<<<<
export function addQdcBlock(id = null, name = null, parentId = 'feeder', container = null) {
    const isNewQdc = !id;
    let internalId;
    if (id) {
        internalId = String(id);
        const numericId = parseInt(internalId, 10);
        if (!isNaN(numericId)) { qdcCount = Math.max(qdcCount, numericId); }
    } else {
        qdcCount++;
        internalId = String(qdcCount);
    }
    const qdcName = name || `QDC ${internalId}`;
    // console.log(`Adicionando QDC ${internalId} (Novo: ${isNewQdc})`); // Log Reduzido
    const newQdcDiv = document.createElement('div');
    newQdcDiv.innerHTML = getQdcHTML(internalId, qdcName, parentId);
    const qdcElement = newQdcDiv.firstElementChild;
    if(!qdcElement) { console.error("Falha ao criar elemento QDC."); return null; }
    const targetContainer = container instanceof DocumentFragment ? container : document.getElementById('qdc-container');
    if(targetContainer) {
        targetContainer.appendChild(qdcElement);
    } else {
        console.error("Container principal de QDCs não encontrado."); return null;
    }

    // Só inicializa listeners e dropdowns se NÃO estiver em um DocumentFragment
    if (!(container instanceof DocumentFragment)) {
        // console.log(`Inicializando listeners para QDC ${internalId} adicionado ao DOM.`); // Log Reduzido
        updateQdcParentDropdowns();
        initializeQdcListeners(internalId);
        // Adiciona um circuito default APENAS se for um QDC NOVO
        if (isNewQdc) {
            // console.log(`QDC ${internalId} é novo, adicionando circuito default.`); // Log Reduzido
            addCircuit(internalId); // Adiciona circuito inicial
             // Expande o QDC novo automaticamente
             qdcElement.classList.remove('collapsed');
             qdcElement.dataset.circuitsLoaded = 'true'; // Marca como carregado pois adicionamos circuito
             const toggleBtn = qdcElement.querySelector('.toggle-circuits-btn');
             if(toggleBtn) toggleBtn.textContent = 'Ocultar Circuitos';
        }
        updateFeederPowerDisplay();
    }

    return internalId;
}

export function removeQdc(qdcId) {
    if (!qdcId) return;
    const qdcElement = document.getElementById(`qdc-${qdcId}`);
    if (qdcElement) {
        if (confirm(`Tem certeza que deseja remover o quadro "${qdcElement.querySelector('.qdc-name-input')?.value || 'QDC'}" e todos os seus circuitos?`)) {
            const childQdcs = document.querySelectorAll(`.qdc-parent-select`);
            childQdcs.forEach(select => { if (select.value === `qdc-${qdcId}`) { select.value = 'feeder'; } });
            qdcElement.remove();
            updateQdcParentDropdowns();
            updateFeederPowerDisplay();
        }
    }
}

function _internal_updateQdcParentDropdowns() {
    const qdcBlocks = document.querySelectorAll('#qdc-container .qdc-block');
    const options = [{ value: 'feeder', text: 'Alimentador Geral' }];
    qdcBlocks.forEach(qdc => { const id = qdc.dataset.id; const nameInput = qdc.querySelector(`#qdcName-${id}`); const name = nameInput ? nameInput.value : `QDC ${id}`; options.push({ value: `qdc-${id}`, text: name }); });
    const selects = document.querySelectorAll('.qdc-parent-select');
    selects.forEach(select => { const currentQdcBlock = select.closest('.qdc-block'); const currentQdcId = currentQdcBlock ? currentQdcBlock.dataset.id : null; const currentValue = select.value; const initialValue = select.dataset.initialParent || currentValue; select.innerHTML = ''; options.forEach(opt => { if (`qdc-${currentQdcId}` !== opt.value) { const optionElement = document.createElement('option'); optionElement.value = opt.value; optionElement.textContent = opt.text; select.appendChild(optionElement); } }); if (options.some(o => o.value === initialValue) && `qdc-${currentQdcId}` !== initialValue) { select.value = initialValue; } else if (options.some(o => o.value === currentValue) && `qdc-${currentQdcId}` !== currentValue) { select.value = currentValue; } else { select.value = 'feeder'; } select.dataset.initialParent = select.value; });
}
export const updateQdcParentDropdowns = debounce(_internal_updateQdcParentDropdowns, 400);

// --- LÓGICA DE CIRCUITO (addCircuit agora não tem mais logs excessivos) ---
export function addCircuit(qdcId, savedCircuitData = null, circuitContainer = null) {
    const isNewCircuit = !savedCircuitData;
    let internalId;
    if (savedCircuitData && savedCircuitData.id) {
        internalId = parseInt(savedCircuitData.id, 10);
        if (!isNaN(internalId)) { circuitCount = Math.max(circuitCount, internalId); }
        else { console.warn("ID de circuito salvo inválido:", savedCircuitData.id); circuitCount++; internalId = circuitCount; }
    } else {
        circuitCount++;
        internalId = circuitCount;
    }

    const newCircuitDiv = document.createElement('div');
    newCircuitDiv.innerHTML = getCircuitHTML(internalId);
    const circuitElement = newCircuitDiv.firstElementChild;
    if(!circuitElement) { console.error("Falha ao criar elemento Circuito."); return; }

    const targetContainer = circuitContainer instanceof DocumentFragment ? circuitContainer : document.getElementById(`circuits-for-qdc-${qdcId}`);
    if (targetContainer) {
        targetContainer.appendChild(circuitElement);
    } else {
        console.error(`Container de circuitos para QDC ${qdcId} não encontrado!`);
        return;
    }

    // Busca elementos DENTRO do circuitElement
    const tipoCircuitoSelect = circuitElement.querySelector(`#tipoCircuito-${internalId}`);
    const potenciaBTUSelect = circuitElement.querySelector(`#potenciaBTU-${internalId}`);
    const potenciaCVSelect = circuitElement.querySelector(`#potenciaCV-${internalId}`);
    const btuGroup = circuitElement.querySelector(`#potenciaBTU_group-${internalId}`);
    const cvGroup = circuitElement.querySelector(`#potenciaCV_group-${internalId}`);
    const resistividadeSolo = circuitElement.querySelector(`#resistividadeSolo-${internalId}`);
    const fpInput = circuitElement.querySelector(`#fatorPotencia-${internalId}`);
    const drCheck = circuitElement.querySelector(`#requerDR-${internalId}`);

    // Preenche dados salvos
    if (savedCircuitData) {
        Object.keys(savedCircuitData).forEach(key => {
            let element = circuitElement.querySelector(`#${key}`);
            if (!element) { element = circuitElement.querySelector(`#${key}-${internalId}`); }
            if (element) { if (element.type === 'checkbox') { (element).checked = savedCircuitData[key]; } else { (element).value = savedCircuitData[key]; } }
        });
        const nameInput = circuitElement.querySelector(`#nomeCircuito-${internalId}`);
        const nameLabel = circuitElement.querySelector(`#nomeCircuitoLabel-${internalId}`);
        if(nameInput && nameLabel) nameLabel.textContent = nameInput.value || `Circuito ${internalId}`;
    }

    // Inicializa dropdowns dependentes
    atualizarLigacoes(internalId);
    handleInsulationChange(internalId);

    // Popula dropdowns BTU/CV/Solo
    if(uiData) {
        populateBtuDropdown(potenciaBTUSelect, uiData.ar_condicionado_btu);
        populateCvDropdown(potenciaCVSelect, uiData.motores_cv);
        populateSoilResistivityDropdown(resistividadeSolo, uiData.fatores_k2);
    } else {
        console.warn(`addCircuit (${internalId}): uiData não disponível.`);
    }

    // Aplica visibilidade e valores padrão
    handleCircuitTypeChange(internalId, tipoCircuitoSelect, btuGroup, cvGroup, fpInput, drCheck);

    // Restaura valores salvos para BTU/CV/Solo
    if (savedCircuitData) {
        const restoreSpecialValues = () => {
            const btuSelectRestored = document.getElementById(`potenciaBTU-${internalId}`);
            const cvSelectRestored = document.getElementById(`potenciaCV-${internalId}`);
            const soloSelectRestored = document.getElementById(`resistividadeSolo-${internalId}`);
            const btuGroupRestored = document.getElementById(`potenciaBTU_group-${internalId}`);
            const cvGroupRestored = document.getElementById(`potenciaCV_group-${internalId}`);
            if (btuSelectRestored && savedCircuitData[`potenciaBTU-${internalId}`]) { btuSelectRestored.value = savedCircuitData[`potenciaBTU-${internalId}`]; if(!btuGroupRestored?.classList.contains('hidden')) btuSelectRestored.dispatchEvent(new Event('change')); }
            if (cvSelectRestored && savedCircuitData[`potenciaCV-${internalId}`]) { cvSelectRestored.value = savedCircuitData[`potenciaCV-${internalId}`]; if(!cvGroupRestored?.classList.contains('hidden')) cvSelectRestored.dispatchEvent(new Event('change')); }
            if (soloSelectRestored && savedCircuitData[`resistividadeSolo-${internalId}`]) { soloSelectRestored.value = savedCircuitData[`resistividadeSolo-${internalId}`]; }
        };
        if (!(circuitContainer instanceof DocumentFragment)) { setTimeout(restoreSpecialValues, 50); }
        else { restoreSpecialValues(); }
    }

    // Colapsa se for NOVO circuito e não o primeiro (e não em fragmento)
    if (isNewCircuit && !(circuitContainer instanceof DocumentFragment)) {
       const existingCircuits = targetContainer?.querySelectorAll('.circuit-block');
        if (existingCircuits && existingCircuits.length > 1) {
            circuitElement.classList.add('collapsed');
        } else {
             circuitElement.classList.remove('collapsed'); // Garante que o primeiro esteja expandido
        }
    }
    // Se não for novo (carregando de save), já vem colapsado do HTML

    // Atualiza display geral APENAS se não estiver operando em um fragmento
    if (!(circuitContainer instanceof DocumentFragment)) {
        updateFeederPowerDisplay();
    }
}

export function removeCircuit(circuitId) {
    if (!circuitId) return;
    const circuitElement = document.getElementById(`circuit-${circuitId}`);
    if (circuitElement) {
        circuitElement.remove();
        updateFeederPowerDisplay();
    }
}

// HTML do circuito (começa colapsado)
function getCircuitHTML(id) {
    return `
    <div class="circuit-block collapsed" id="circuit-${id}" data-id="${id}">
        <div class="circuit-header">
            <h3 class="circuit-header-left">Circuito <span class="circuit-number">${id}</span></h3>
            <h3 class="circuit-header-center" id="nomeCircuitoLabel-${id}">Circuito ${id}</h3>
            <div class="circuit-header-right">
                <button type="button" class="remove-circuit-btn btn-red" data-circuit-id="${id}">Remover</button>
                <span class="toggle-arrow">▼</span>
            </div>
        </div>
        <div class="circuit-content">
            <div class="form-grid">
                <div class="form-group"> <label for="nomeCircuito-${id}">Nome do Circuito</label> <input type="text" id="nomeCircuito-${id}" value="Circuito ${id}"> </div>
                <div class="full-width potencia-group">
                    <div class="form-group"> <label for="tipoCircuito-${id}">Tipo de Circuito</label> <select id="tipoCircuito-${id}"> <option value="iluminacao">Iluminação</option> <option value="tug" selected>TUG</option> <option value="tue">TUE</option> <option value="aquecimento">Aquecimento</option> <option value="motores">Motores</option> <option value="ar_condicionado">Ar Condicionado</option> </select> </div>
                    <div class="form-group hidden" id="potenciaBTU_group-${id}"> <label for="potenciaBTU-${id}">Potência (BTU/h)</label> <select id="potenciaBTU-${id}"></select> </div>
                    <div class="form-group hidden" id="potenciaCV_group-${id}"> <label for="potenciaCV-${id}">Potência (CV)</label> <select id="potenciaCV-${id}"></select> </div>
                    <div class="form-group"> <label for="potenciaW-${id}">Potência (W)</label> <input type="number" id="potenciaW-${id}" value="2500"> </div>
                </div>
                <div class="form-group"> <label for="fatorDemanda-${id}">Fator Demanda (%)</label> <input type="number" id="fatorDemanda-${id}" value="100" step="1"> </div>
                <div class="form-group"> <label for="fases-${id}">Fases</label> <select id="fases-${id}"> <option value="Monofasico" selected>Monofásico</option> <option value="Bifasico">Bifásico</option> <option value="Trifasico">Trifásico</option> </select> </div>
                <div class="form-group"> <label for="tipoLigacao-${id}">Ligação</label> <select id="tipoLigacao-${id}"></select> </div>
                <div class="form-group"> <label for="tensaoV-${id}">Tensão (V)</label> <select id="tensaoV-${id}"><option value="12">12</option><option value="24">24</option><option value="36">36</option><option value="127">127</option><option value="220" selected>220</option><option value="380">380</option><option value="440">440</option><option value="760">760</option></select> </div>
                <div class="form-group"> <label for="fatorPotencia-${id}">Fator Potência</label> <input type="number" id="fatorPotencia-${id}" step="0.01" value="0.92"> </div>
                <div class="form-group"> <label for="comprimentoM-${id}">Comprimento (m)</label> <input type="number" id="comprimentoM-${id}" value="20"> </div>
                <div class="form-group"> <label for="tipoIsolacao-${id}">Isolação</label> <select id="tipoIsolacao-${id}"><option value="PVC" selected>PVC 70°C</option><option value="EPR">EPR 90°C</option><option value="XLPE">XLPE 90°C</option></select> </div>
                <div class="form-group"> <label for="materialCabo-${id}">Condutor</label> <select id="materialCabo-${id}"><option value="Cobre" selected>Cobre</option><option value="Aluminio">Alumínio</option></select> </div>
                <div class="form-group"> <label for="metodoInstalacao-${id}">Instalação</label> <select id="metodoInstalacao-${id}"><option value="A1">A1</option><option value="A2">A2</option><option value="B1" selected>B1</option><option value="B2">B2</option><option value="C">C</option><option value="D">D</option></select> </div>
                <div class="form-group"> <label for="temperaturaAmbienteC-${id}">Temp. Ambiente</label> <select id="temperaturaAmbienteC-${id}"></select> </div>
                <div class="form-group"> <label for="resistividadeSolo-${id}">Resist. Solo</label> <select id="resistividadeSolo-${id}"></select> </div>
                <div class="form-group"> <label for="numCircuitosAgrupados-${id}">Ckt Agrupados</label> <select id="numCircuitosAgrupados-${id}"><option value="1" selected>1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option></select> </div>
                <div class="form-group"> <label for="limiteQuedaTensao-${id}">Limite DV (%)</label> <input type="number" id="limiteQuedaTensao-${id}" step="0.1" value="4.0"> </div>
                <div class="form-group"> <label for="tipoDisjuntor-${id}">Disjuntor</label> <select id="tipoDisjuntor-${id}"><option value="Minidisjuntor (DIN)">DIN</option><option value="Caixa Moldada (MCCB)">MCCB</option></select> </div>
                <div class="form-group"> <label for="dpsClasse-${id}">Classe DPS</label> <select id="dpsClasse-${id}"><option value="">Nenhum</option><option value="I">I</option><option value="II">II</option></select> </div>
                <div class="checkbox-group"> <input type="checkbox" id="requerDR-${id}"><label for="requerDR-${id}">Requer DR</label> </div>
            </div>
        </div>
    </div>`;
}

// Listeners e Handlers
export function initializeFeederListeners() { const feederFases = document.getElementById('feederFases'); const feederTipoIsolacao = document.getElementById('feederTipoIsolacao'); const feederTemp = document.getElementById('feederTemperaturaAmbienteC'); const feederSolo = document.getElementById('feederResistividadeSolo'); if(feederFases) feederFases.addEventListener('change', () => { const tipoLigacaoSelect = document.getElementById('feederTipoLigacao'); const selectedFases = feederFases.value; if (tipoLigacaoSelect && ligacoes[selectedFases]) { const currentVal = tipoLigacaoSelect.value; tipoLigacaoSelect.innerHTML = ''; ligacoes[selectedFases].forEach(opt => { const option = document.createElement('option'); option.value = opt.value; option.textContent = opt.text; tipoLigacaoSelect.appendChild(option); }); if(ligacoes[selectedFases].some(o => o.value === currentVal)) tipoLigacaoSelect.value = currentVal; } }); if(feederTipoIsolacao) feederTipoIsolacao.addEventListener('change', () => { const isPVC = feederTipoIsolacao.value === 'PVC'; populateTemperatureDropdown(feederTemp, isPVC ? tempOptions.pvc : tempOptions.epr); }); if(feederFases) feederFases.dispatchEvent(new Event('change')); if(feederTipoIsolacao) feederTipoIsolacao.dispatchEvent(new Event('change')); if(uiData) populateSoilResistivityDropdown(feederSolo, uiData.fatores_k2); }
export function initializeQdcListeners(id) { atualizarQdcLigacoes(id); handleQdcInsulationChange(id); const resistividadeSolo = document.getElementById(`qdcResistividadeSolo-${id}`); if(uiData) populateSoilResistivityDropdown(resistividadeSolo, uiData.fatores_k2); }
function atualizarQdcLigacoes(id) { const fasesSelect = document.getElementById(`qdcFases-${id}`); const tipoLigacaoSelect = document.getElementById(`qdcTipoLigacao-${id}`); if (!fasesSelect || !tipoLigacaoSelect) return; const selectedFases = fasesSelect.value; const currentLigacao = tipoLigacaoSelect.value; if (ligacoes[selectedFases]) { tipoLigacaoSelect.innerHTML = ''; ligacoes[selectedFases].forEach(opt => { const option = document.createElement('option'); option.value = opt.value; option.textContent = opt.text; tipoLigacaoSelect.appendChild(option); }); if (ligacoes[selectedFases].some(o => o.value === currentLigacao)) { tipoLigacaoSelect.value = currentLigacao; } } }
function handleQdcInsulationChange(id) { const tipoIsolacao = document.getElementById(`qdcTipoIsolacao-${id}`); const tempAmbiente = document.getElementById(`qdcTemperaturaAmbienteC-${id}`); if (!tipoIsolacao || !tempAmbiente) return; const isPVC = tipoIsolacao.value === 'PVC'; populateTemperatureDropdown(tempAmbiente, isPVC ? tempOptions.pvc : tempOptions.epr); }
function handlePowerUnitChange(id, type) { const btuSelect = document.getElementById(`potenciaBTU-${id}`); const cvSelect = document.getElementById(`potenciaCV-${id}`); const wattsInput = document.getElementById(`potenciaW-${id}`); if (!wattsInput) return; if (type === 'btu' && btuSelect) { const btuValue = parseFloat(btuSelect.value); if (btuValue > 0) { wattsInput.value = (btuValue * BTU_TO_WATTS_FACTOR).toFixed(0); if(cvSelect) cvSelect.value = ""; } } else if (type === 'cv' && cvSelect) { const cvValue = parseFloat(cvSelect.value); if (cvValue > 0) { wattsInput.value = (cvValue * CV_TO_WATTS_FACTOR).toFixed(0); if(btuSelect) btuSelect.value = ""; } } }

// >>>>> handleMainContainerInteraction para LAZY LOADING com BOTÃO DEDICADO <<<<<
export function handleMainContainerInteraction(event) {
    const target = event.target;
    const eventType = event.type;

    const qdcBlock = target.closest('.qdc-block');
    if (qdcBlock) {
        const qdcId = qdcBlock.dataset.id;
        if (!qdcId) return;

        if (eventType === 'click') {
            const addCircuitButton = target.closest('.add-circuit-to-qdc-btn');
            if (addCircuitButton) {
                event.stopPropagation(); // Impede que o clique no botão expanda/colapse o QDC
                // Garante que os circuitos sejam carregados antes de adicionar um novo
                ensureCircuitsLoaded(qdcBlock, qdcId).then(() => {
                   addCircuit(qdcId); // Adiciona um novo circuito
                   // Força a expansão se não estiver expandido ao adicionar circuito
                   if (qdcBlock.classList.contains('collapsed')) {
                       qdcBlock.classList.remove('collapsed');
                       const toggleBtn = qdcBlock.querySelector('.toggle-circuits-btn');
                       if(toggleBtn) toggleBtn.textContent = 'Ocultar Circuitos';
                   }
                });
                return; // Finaliza o handler aqui
            }
            const removeQdcButton = target.closest('.remove-qdc-btn');
            if (removeQdcButton) {
                event.stopPropagation(); // Impede que o clique no botão expanda/colapse o QDC
                removeQdc(qdcId);
                return; // Finaliza o handler aqui
            }

            // Botão dedicado para Exibir/Ocultar
            const toggleButton = target.closest('.toggle-circuits-btn');
            if (toggleButton) {
                event.stopPropagation(); // Impede outros cliques
                const isCollapsed = qdcBlock.classList.contains('collapsed');
                if (isCollapsed) {
                    // Expandindo
                    qdcBlock.classList.remove('collapsed'); // Expande visualmente
                    toggleButton.textContent = 'Ocultar Circuitos';
                    ensureCircuitsLoaded(qdcBlock, qdcId); // Carrega se necessário
                } else {
                    // Colapsando
                    qdcBlock.classList.add('collapsed');
                    toggleButton.textContent = 'Exibir Circuitos';
                }
                return;
            }
        } else if (eventType === 'change') {
            // Lógica de 'change' para config do QDC
            if (target.classList.contains('qdc-parent-select')) { updateFeederPowerDisplay(); return; }
            if (target.id === `qdcFases-${qdcId}`) { atualizarQdcLigacoes(qdcId); return; }
            if (target.id === `qdcTipoIsolacao-${qdcId}`) { handleQdcInsulationChange(qdcId); return; }
        }
    }

    const circuitBlock = target.closest('.circuit-block');
    if (circuitBlock) {
        const circuitId = circuitBlock.dataset.id; if (!circuitId) return;
        if (eventType === 'click') {
            const removeCircuitButton = target.closest('.remove-circuit-btn');
            if (removeCircuitButton) { event.stopPropagation(); removeCircuit(circuitId); return; }
            // Expande/Colapsa circuito pelo header
            const circuitHeader = target.closest('.circuit-header');
            if (circuitHeader && !target.closest('.remove-circuit-btn')) { circuitBlock.classList.toggle('collapsed'); return; }
        } else if (eventType === 'change') {
            // Lógica de 'change' para inputs do circuito
            if (target.id === `potenciaBTU-${circuitId}`) { handlePowerUnitChange(circuitId, 'btu'); updateFeederPowerDisplay(); return; }
            if (target.id === `potenciaCV-${circuitId}`) { handlePowerUnitChange(circuitId, 'cv'); updateFeederPowerDisplay(); return; }
            if (target.id === `tipoCircuito-${circuitId}`) { const tipoSelect = target; const btuGroupEl = circuitBlock.querySelector(`#potenciaBTU_group-${circuitId}`); const cvGroupEl = circuitBlock.querySelector(`#potenciaCV_group-${circuitId}`); const fpInputEl = circuitBlock.querySelector(`#fatorPotencia-${circuitId}`); const drCheckEl = circuitBlock.querySelector(`#requerDR-${circuitId}`); handleCircuitTypeChange(circuitId, tipoSelect, btuGroupEl, cvGroupEl, fpInputEl, drCheckEl); return; }
            if (target.id === `fases-${circuitId}`) { atualizarLigacoes(circuitId); return; }
            if (target.id === `tipoIsolacao-${circuitId}`) { handleInsulationChange(circuitId); return; }
        }
    }
}


// >>>>> ensureCircuitsLoaded (Função de Lazy Loading) <<<<<
async function ensureCircuitsLoaded(qdcBlock, qdcId) {
    if (!qdcBlock || qdcBlock.dataset.circuitsLoaded === 'true') {
        return; // Já carregado ou bloco inválido
    }

    const circuitContainer = qdcBlock.querySelector(`#circuits-for-qdc-${qdcId}`);
    const placeholder = circuitContainer?.querySelector('.circuits-loading-placeholder');
    if (!circuitContainer) {
        console.error(`[Lazy Load] Container de circuitos não encontrado para QDC ${qdcId}`);
        return;
    }

    if(placeholder) placeholder.style.display = 'block'; // Mostra placeholder

    // Marca como carregado IMEDIATAMENTE
    qdcBlock.dataset.circuitsLoaded = 'true';
    console.log(`[Lazy Load] Carregando circuitos para QDC ${qdcId}...`); // Log Mantido

    const projectQdcData = loadedProjectData?.qdcs_data?.find(q => String(q.id) === String(qdcId));
    const circuitsToLoad = projectQdcData?.circuits;

    if (circuitsToLoad && Array.isArray(circuitsToLoad) && circuitsToLoad.length > 0) {
        const fragment = document.createDocumentFragment();
        circuitsToLoad.forEach(circuitData => {
            addCircuit(qdcId, circuitData, fragment); // Adiciona ao fragmento
        });
        if(placeholder) placeholder.style.display = 'none'; // Esconde placeholder
        circuitContainer.appendChild(fragment); // Adiciona todos de uma vez
         updateFeederPowerDisplay(); // Atualiza potências após adicionar
    } else {
        // console.log(`[Lazy Load] Nenhum circuito salvo para QDC ${qdcId}.`); // Log Reduzido
        if(placeholder) placeholder.style.display = 'none'; // Esconde placeholder
    }
}

function atualizarLigacoes(id) { const fasesSelect = document.getElementById(`fases-${id}`); const tipoLigacaoSelect = document.getElementById(`tipoLigacao-${id}`); if (!fasesSelect || !tipoLigacaoSelect) return; const selectedFases = fasesSelect.value; const currentLigacao = tipoLigacaoSelect.value; if (ligacoes[selectedFases]) { tipoLigacaoSelect.innerHTML = ''; ligacoes[selectedFases].forEach(opt => { const option = document.createElement('option'); option.value = opt.value; option.textContent = opt.text; tipoLigacaoSelect.appendChild(option); }); if (ligacoes[selectedFases].some(o => o.value === currentLigacao)) { tipoLigacaoSelect.value = currentLigacao; } } }
function handleInsulationChange(id) { const tipoIsolacao = document.getElementById(`tipoIsolacao-${id}`); const tempAmbiente = document.getElementById(`temperaturaAmbienteC-${id}`); if (!tipoIsolacao || !tempAmbiente) return; const isPVC = tipoIsolacao.value === 'PVC'; populateTemperatureDropdown(tempAmbiente, isPVC ? tempOptions.pvc : tempOptions.epr); }

// >>>>> handleCircuitTypeChange (logs removidos) <<<<<
function handleCircuitTypeChange(id, tipoSelect, btuGroup, cvGroup, fpInput, drCheck) {
    const tipo = tipoSelect?.value;
    if (btuGroup) { const shouldShowBtu = (tipo === 'ar_condicionado'); btuGroup.classList.toggle('hidden', !shouldShowBtu); }
    if (cvGroup) { const shouldShowCv = (tipo === 'motores'); cvGroup.classList.toggle('hidden', !shouldShowCv); }
    if (fpInput) { if (tipo === 'motores' || tipo === 'ar_condicionado') { fpInput.value = '0.85'; } else if (tipo === 'iluminacao' || tipo === 'tug' || tipo === 'tue') { fpInput.value = '0.92'; } }
    if (drCheck) { if (tipo === 'tug' || tipo === 'aquecimento') { drCheck.checked = true; } else if (tipo === 'iluminacao' || tipo === 'motores') { drCheck.checked = false; } }
}

// --- Funções de preenchimento de formulário ---
export function populateProjectList(projects) { const select = document.getElementById('savedProjectsSelect'); if(!select) { console.error("Elemento 'savedProjectsSelect' não encontrado."); return; } const currentValue = select.value; select.innerHTML = '<option value="">-- Selecione uma obra --</option>'; if (projects && Array.isArray(projects)) { projects.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = `${p.project_code ?? 'S/C'} - ${p.project_name ?? 'Obra sem nome'}`; select.appendChild(o); }); if(projects.some(p => p.id == currentValue)) { select.value = currentValue; } } else { console.warn("Nenhum projeto encontrado ou dados inválidos para popular lista."); } }

// Funções de Admin e Cliente
export function populateUsersPanel(users) { const list = document.getElementById('adminUserList'); if (!list) return; list.innerHTML = ''; if (!users || users.length === 0) { list.innerHTML = '<li>Nenhum usuário encontrado.</li>'; return; } users.forEach(user => { const li = document.createElement('li'); const blockButtonClass = user.is_blocked ? 'btn-green' : 'btn-orange'; const blockButtonText = user.is_blocked ? 'Desbloquear' : 'Bloquear'; li.innerHTML = ` <span> <strong>${user.nome || 'Usuário sem nome'}</strong><br> <small>${user.email} ${user.is_admin ? '(Admin)' : ''} ${user.is_approved ? '' : '(Pendente)'}</small><br> <small>CREA: ${user.crea || 'N/A'}</small> </span> <div class="admin-user-actions"> ${!user.is_approved ? `<button class="btn-green approve-user-btn" data-user-id="${user.id}">Aprovar</button>` : ''} <button class="btn-blue-dark edit-user-btn" data-user-id="${user.id}">Editar</button> <button class="${blockButtonClass} block-user-btn" data-user-id="${user.id}" data-is-blocked="${user.is_blocked}"> ${blockButtonText} </button> <button class="btn-red remove-user-btn" data-user-id="${user.id}">Excluir</button> </div> `; list.appendChild(li); }); }
export function populateEditUserModal(user) { if (!user) return; document.getElementById('editUserId').value = user.id; document.getElementById('editNome').value = user.nome || ''; document.getElementById('editEmail').value = user.email || ''; document.getElementById('editCpf').value = user.cpf || ''; document.getElementById('editTelefone').value = user.telefone || ''; document.getElementById('editCrea').value = user.crea || ''; openModal('editUserModalOverlay'); }
export function populateProjectsPanel(projects, clients, users, currentUserProfile) { const tableBody = document.getElementById('adminProjectsTableBody'); if (!tableBody) return; tableBody.innerHTML = ''; const clientOptions = clients.map(c => `<option value="${c.id}">${c.nome}</option>`).join(''); const userOptions = users.map(u => `<option value="${u.id}">${u.nome || u.email}</option>`).join(''); if (!projects || projects.length === 0) { tableBody.innerHTML = '<tr><td colspan="5">Nenhuma obra encontrada.</td></tr>'; return; } projects.forEach(p => { const tr = document.createElement('tr'); const owner = p.owner; const client = p.client; const canTransfer = currentUserProfile.is_admin || currentUserProfile.id === p.owner_id; tr.innerHTML = ` <td>${p.project_code || 'S/C'}</td> <td>${p.project_name || 'Obra sem nome'}</td> <td>${owner ? (owner.nome || owner.email) : 'N/A'}</td> <td>${client ? client.nome : 'Nenhum'}</td> <td class="action-cell"> <div class="action-group"> <label>Cliente:</label> <select class="transfer-client-select" ${!canTransfer ? 'disabled' : ''}> <option value="">-- Nenhum --</option> ${clientOptions} </select> <button class="btn-blue-dark transfer-client-btn" data-project-id="${p.id}" ${!canTransfer ? 'disabled' : ''}>Salvar</button> </div> ${currentUserProfile.is_admin ? ` <div class="action-group"> <label>Dono:</label> <select class="transfer-owner-select"> ${userOptions} </select> <button class="btn-orange transfer-owner-btn" data-project-id="${p.id}">Transferir</button> </div> ` : ''} </td> `; const clientSelect = tr.querySelector('.transfer-client-select'); if (clientSelect && p.client_id) { (clientSelect).value = p.client_id; } const ownerSelect = tr.querySelector('.transfer-owner-select'); if (ownerSelect && p.owner_id) { (ownerSelect).value = p.owner_id; } tableBody.appendChild(tr); }); }
export function populateClientManagementModal(clients) { const list = document.getElementById('clientList'); if (!list) return; list.innerHTML = ''; if (!clients || clients.length === 0) { list.innerHTML = '<li>Nenhum cliente cadastrado.</li>'; return; } clients.forEach(c => { const li = document.createElement('li'); li.innerHTML = ` <span> <strong>${c.nome || 'Cliente sem nome'}</strong> (Projetos: ${c.projects?.length || 0})<br> <small>${c.documento_tipo || 'Doc'}: ${c.documento_valor || 'N/A'}</small><br> <small>Email: ${c.email || 'N/A'} | Celular: ${c.celular || 'N/A'}</small> </span> <div class="client-actions"> <button class="btn-edit edit-client-btn" data-client-id="${c.id}">Editar</button> <button class="btn-danger delete-client-btn" data-client-id="${c.id}" ${c.projects?.length > 0 ? 'disabled' : ''}>Excluir</button> </div> `; list.appendChild(li); }); }
export function resetClientForm() { const form = document.getElementById('clientForm'); if(form) form.reset(); (document.getElementById('clientId')).value = ''; (document.getElementById('clientFormTitle')).textContent = 'Cadastrar Novo Cliente'; (document.getElementById('clientFormSubmitBtn')).textContent = 'Salvar Cliente'; (document.getElementById('clientFormCancelBtn')).style.display = 'none'; }
export function openEditClientForm(client) { if (!client) return; (document.getElementById('clientId')).value = client.id; (document.getElementById('clientNome')).value = client.nome || ''; (document.getElementById('clientDocumentoTipo')).value = client.documento_tipo || 'CPF'; (document.getElementById('clientDocumentoValor')).value = client.documento_valor || ''; (document.getElementById('clientEmail')).value = client.email || ''; (document.getElementById('clientCelular')).value = client.celular || ''; (document.getElementById('clientTelefone')).value = client.telefone || ''; (document.getElementById('clientEndereco')).value = client.endereco || ''; (document.getElementById('clientFormTitle')).textContent = 'Editar Cliente'; (document.getElementById('clientFormSubmitBtn')).textContent = 'Salvar Alterações'; (document.getElementById('clientFormCancelBtn')).style.display = 'inline-block'; }
export function populateSelectClientModal(clients, isChange = false) { const select = document.getElementById('clientSelectForNewProject'); const title = document.querySelector('#selectClientModalOverlay h3'); const continueBtn = document.getElementById('continueWithoutClientBtn'); if (title) title.textContent = isChange ? 'Vincular / Alterar Cliente' : 'Vincular Cliente à Nova Obra'; if (continueBtn) continueBtn.style.display = isChange ? 'none' : 'inline-block'; if (!select) return; select.innerHTML = ''; if (!clients || clients.length === 0) { select.innerHTML = '<option value="">Nenhum cliente cadastrado</option>'; return; } select.innerHTML = '<option value="">-- Selecione um Cliente --</option>'; clients.forEach(c => { const opt = document.createElement('option'); opt.value = c.id; opt.textContent = `${c.nome} (${c.client_code || 'S/C'})`; select.appendChild(opt); }); if (isChange) { const currentClientId = (document.getElementById('currentClientId')).value; if (currentClientId) { select.value = currentClientId; } } openModal('selectClientModalOverlay'); }

console.log("--- ui.js: Fim do arquivo ---"); // Log Mantido