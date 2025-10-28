// Arquivo: ui.js (v2 - Com QDCs Suspensos e Lazy Loading de Circuitos)

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
    console.log("[UI] Dados do projeto armazenados para lazy loading.");
}

console.log("--- ui.js: Antes de definir exports ---");

export function setupDynamicData(data) {
    console.log("--- ui.js: setupDynamicData executado ---");
    uiData = data;
    // console.log("Dados recebidos em setupDynamicData:", uiData ? 'OK' : 'FALHA'); // Log Reduzido

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
     // console.log("Opções de Temperatura Carregadas:", tempOptions); // Log Reduzido
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
    // console.log(`populateBtuDropdown chamado.`); // Log removido
    if (!selectElement) { console.error("populateBtuDropdown: selectElement é nulo!"); return; }
    selectElement.innerHTML = '<option value="">-- Selecione --</option>';
    if (!btuData || !Array.isArray(btuData)) { console.warn("Dados de BTU inválidos ou ausentes."); return; }
    let count = 0;
    btuData.map(item => ({ ...item, valor_btu: parseFloat(item.valor_btu) })).filter(item => item && !isNaN(item.valor_btu)).sort((a, b) => a.valor_btu - b.valor_btu).forEach(item => { const option = document.createElement('option'); option.value = item.valor_btu; option.textContent = item.descricao; selectElement.appendChild(option); count++; });
    // console.log(`populateBtuDropdown: ${count} opções de BTU adicionadas.`); // Log removido
}

function populateCvDropdown(selectElement, cvData) {
    // console.log(`populateCvDropdown chamado.`); // Log removido
     if (!selectElement) { console.error("populateCvDropdown: selectElement é nulo!"); return; }
    selectElement.innerHTML = '<option value="">-- Selecione --</option>';
    if (!cvData || !Array.isArray(cvData)) { console.warn("Dados de CV inválidos ou ausentes."); return; }
     let count = 0;
     cvData.map(item => ({ ...item, valor_cv: parseFloat(item.valor_cv) })).filter(item => item && !isNaN(item.valor_cv)).sort((a, b) => a.valor_cv - b.valor_cv).forEach(item => { const option = document.createElement('option'); option.value = item.valor_cv; option.textContent = item.descricao; selectElement.appendChild(option); count++; });
    // console.log(`populateCvDropdown: ${count} opções de CV adicionadas.`); // Log removido
}

function populateSoilResistivityDropdown(selectElement, soilData) {
    if (!selectElement) return; selectElement.innerHTML = '<option value="0">Não Aplicável</option>'; if (!soilData || !Array.isArray(soilData)) { console.warn("Dados de resistividade do solo inválidos ou ausentes."); return; }
    soilData.map(item => ({ ...item, resistividade: parseFloat(item.resistividade) })).filter(item => item && !isNaN(item.resistividade)).sort((a, b) => a.resistividade - b.resistividade).forEach(item => { const option = document.createElement('option'); option.value = item.resistividade; option.textContent = `${item.resistividade}`; selectElement.appendChild(option); });
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

// --- FUNÇÃO DE ATUALIZAÇÃO HIERÁRQUICA DE CARGA VISUAL (sem alterações) ---
function _internal_updateFeederPowerDisplay() {
    const qdcData = {}; let totalInstalledGeneral = 0;
    document.querySelectorAll('#qdc-container .qdc-block').forEach(qdcBlock => { const qdcId = qdcBlock.dataset.id; if (!qdcId) return; let installedDirect = 0; let demandedDirect = 0;
        // Só soma circuitos que JÁ FORAM CARREGADOS no DOM
        qdcBlock.querySelectorAll('.circuit-block').forEach(circuitBlock => { const id = circuitBlock.dataset.id; if (!id) return; const potenciaWInput = circuitBlock.querySelector(`#potenciaW-${id}`); const fatorDemandaInput = circuitBlock.querySelector(`#fatorDemanda-${id}`); if (potenciaWInput && fatorDemandaInput) { const potenciaW = parseFloat(potenciaWInput.value) || 0; const fatorDemanda = (parseFloat(fatorDemandaInput.value) || 100) / 100.0; installedDirect += potenciaW; demandedDirect += (potenciaW * fatorDemanda); } });
        totalInstalledGeneral += installedDirect; const parentSelect = qdcBlock.querySelector(`#qdcParent-${qdcId}`); const parentId = parentSelect ? parentSelect.value : 'feeder'; qdcData[qdcId] = { installedDirect, demandedDirect, parentId, childrenIds: [], aggregatedDemand: -1 }; const qdcPotInstEl = qdcBlock.querySelector(`#qdcPotenciaInstalada-${qdcId}`); if (qdcPotInstEl) qdcPotInstEl.value = installedDirect.toFixed(2); const qdcDemPropriaEl = qdcBlock.querySelector(`#qdcDemandaPropria-${qdcId}`); if (qdcDemPropriaEl) qdcDemPropriaEl.value = demandedDirect.toFixed(2); });
    Object.keys(qdcData).forEach(qdcId => { const parentId = qdcData[qdcId].parentId; if (parentId !== 'feeder' && qdcData[parentId]) { qdcData[parentId].childrenIds.push(qdcId); } });
    const visited = new Set();
    function calculateAggregatedDemand(qdcId) { if (!qdcData[qdcId]) return 0; if (qdcData[qdcId].aggregatedDemand !== -1) return qdcData[qdcId].aggregatedDemand; if (visited.has(qdcId)) { console.error(`Loop detectado ${qdcId}`); return qdcData[qdcId].demandedDirect; } visited.add(qdcId); let aggregatedDemand = qdcData[qdcId].demandedDirect; qdcData[qdcId].childrenIds.forEach(childId => { aggregatedDemand += calculateAggregatedDemand(childId); }); visited.delete(qdcId); qdcData[qdcId].aggregatedDemand = aggregatedDemand; return aggregatedDemand; }
    let totalDemandAggregatedGeneral = 0;
    Object.keys(qdcData).forEach(qdcId => { visited.clear(); const aggregatedDemand = calculateAggregatedDemand(qdcId); const qdcPotDemEl = document.getElementById(`qdcPotenciaDemandada-${qdcId}`); if (qdcPotDemEl) qdcPotDemEl.value = aggregatedDemand.toFixed(2); if (qdcData[qdcId].parentId === 'feeder') { totalDemandAggregatedGeneral += aggregatedDemand; } });
    const feederPotInstaladaEl = document.getElementById('feederPotenciaInstalada'); const feederSomaPotDemandadaEl = document.getElementById('feederSomaPotenciaDemandada'); const feederFatorDemandaInput = document.getElementById('feederFatorDemanda'); const feederPotDemandadaFinalEl = document.getElementById('feederPotenciaDemandada');
    if (feederPotInstaladaEl) feederPotInstaladaEl.value = totalInstalledGeneral.toFixed(2); if (feederSomaPotDemandadaEl) feederSomaPotDemandadaEl.value = totalDemandAggregatedGeneral.toFixed(2); const feederFatorDemanda = (parseFloat(feederFatorDemandaInput?.value) || 100) / 100.0; const finalDemandGeral = totalDemandAggregatedGeneral * feederFatorDemanda; if (feederPotDemandadaFinalEl) feederPotDemandadaFinalEl.value = finalDemandGeral.toFixed(2);
}
export const updateFeederPowerDisplay = debounce(_internal_updateFeederPowerDisplay, 350);

// --- LÓGICA DE QDC E FORMULÁRIO ---
export function resetForm(addDefaultQdc = true, linkedClient = null) {
    console.log("resetForm chamado");
    loadedProjectData = null; // Limpa dados do projeto anterior
    const mainForm = document.getElementById('main-form'); if(mainForm) mainForm.reset();
    const techForm = document.getElementById('tech-form'); if(techForm) techForm.reset();
    const feederForm = document.getElementById('feeder-form'); if(feederForm) feederForm.reset();
    const currentProjId = document.getElementById('currentProjectId'); if(currentProjId) currentProjId.value = '';
    const qdcContainer = document.getElementById('qdc-container'); if(qdcContainer) qdcContainer.innerHTML = ''; // Limpa QDCs
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
    initializeFeederListeners(); // Reinicializa listeners do alimentador
    qdcCount = 0; // Reseta contagem de QDCs
    circuitCount = 0; // Reseta contagem de circuitos
    if (addDefaultQdc) {
        addQdcBlock(); // Adiciona um QDC inicial
    } else {
        updateFeederPowerDisplay(); // Atualiza display se nenhum QDC for adicionado
    }
}

// >>>>> getQdcHTML agora adiciona 'collapsed' e data attribute <<<<<
function getQdcHTML(id, name = `QDC ${id}`, parentId = 'feeder') {
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
                <button type="button" class="add-circuit-to-qdc-btn btn-green" data-qdc-id="${id}">+ Circuito</button>
                <button type="button" class="remove-qdc-btn btn-red" data-qdc-id="${id}">Remover QDC</button>
                <span class="toggle-arrow">▼</span>
            </div>
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
        internalId = String(id); // Garante que é string
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

    // Só inicializa listeners e dropdowns se NÃO estiver em um DocumentFragment (ao carregar projeto)
    if (!(container instanceof DocumentFragment)) {
        console.log(`Inicializando listeners para QDC ${internalId} adicionado diretamente ao DOM.`);
        updateQdcParentDropdowns();
        initializeQdcListeners(internalId);
        // Só adiciona circuito default se for um QDC NOVO adicionado pelo usuário
        if (isNewQdc) {
            console.log(`QDC ${internalId} é novo, adicionando circuito default.`);
            addCircuit(internalId); // Adiciona circuito inicial
             // Expande o QDC novo se for o primeiro, ou se for adicionado manualmente depois
             if(qdcCount === 1 || document.querySelectorAll('#qdc-container .qdc-block').length > 1){
                 qdcElement.classList.remove('collapsed');
                 qdcElement.dataset.circuitsLoaded = 'true'; // Marca como carregado pois adicionamos circuito
             }
        }
        updateFeederPowerDisplay();
    }
    // Não força colapso aqui, pois já vem colapsado do HTML

    return internalId;
}

export function removeQdc(qdcId) {
    if (!qdcId) return;
    const qdcElement = document.getElementById(`qdc-${qdcId}`);
    if (qdcElement) {
        if (confirm(`Tem certeza que deseja remover o quadro "${qdcElement.querySelector('.qdc-name-input')?.value || 'QDC'}" e todos os seus circuitos?`)) {
            // Verifica se algum outro QDC usa este como pai e reseta para 'feeder'
            const childQdcs = document.querySelectorAll(`.qdc-parent-select`);
            childQdcs.forEach(select => {
                if (select.value === `qdc-${qdcId}`) {
                    select.value = 'feeder'; // Reseta para o alimentador geral
                }
            });
            qdcElement.remove(); // Remove o elemento do DOM
            updateQdcParentDropdowns(); // Atualiza os dropdowns de parentesco
            updateFeederPowerDisplay(); // Recalcula potências
        }
    }
}

function _internal_updateQdcParentDropdowns() {
    const qdcBlocks = document.querySelectorAll('#qdc-container .qdc-block');
    const options = [{ value: 'feeder', text: 'Alimentador Geral' }];
    qdcBlocks.forEach(qdc => {
        const id = qdc.dataset.id;
        const nameInput = qdc.querySelector(`#qdcName-${id}`);
        const name = nameInput ? nameInput.value : `QDC ${id}`;
        options.push({ value: `qdc-${id}`, text: name });
    });

    const selects = document.querySelectorAll('.qdc-parent-select');
    selects.forEach(select => {
        const currentQdcBlock = select.closest('.qdc-block');
        const currentQdcId = currentQdcBlock ? currentQdcBlock.dataset.id : null;
        const currentValue = select.value; // Valor atual selecionado
        const initialValue = select.dataset.initialParent || currentValue; // Valor salvo ou atual

        select.innerHTML = ''; // Limpa opções antigas

        // Adiciona novas opções, exceto o próprio QDC
        options.forEach(opt => {
            if (`qdc-${currentQdcId}` !== opt.value) { // Não permite ser pai de si mesmo
                const optionElement = document.createElement('option');
                optionElement.value = opt.value;
                optionElement.textContent = opt.text;
                select.appendChild(optionElement);
            }
        });

        // Tenta restaurar a seleção salva ou a atual, se ainda for válida
        if (options.some(o => o.value === initialValue) && `qdc-${currentQdcId}` !== initialValue) {
            select.value = initialValue;
        } else if (options.some(o => o.value === currentValue) && `qdc-${currentQdcId}` !== currentValue) {
            select.value = currentValue; // Mantém valor atual se o salvo for inválido mas o atual ainda existe
        } else {
            select.value = 'feeder'; // Fallback para alimentador geral
        }
        // Atualiza o initialParent para o valor restaurado/definido
        select.dataset.initialParent = select.value;
    });
}
export const updateQdcParentDropdowns = debounce(_internal_updateQdcParentDropdowns, 400);

// --- LÓGICA DE CIRCUITO (addCircuit agora não tem mais logs excessivos) ---
export function addCircuit(qdcId, savedCircuitData = null, circuitContainer = null) {
    // console.log(`addCircuit for QDC ${qdcId}`); // Log Reduzido
    const isNewCircuit = !savedCircuitData;
    let internalId;
    if (savedCircuitData && savedCircuitData.id) {
        // Usa ID salvo e atualiza contador global
        internalId = parseInt(savedCircuitData.id, 10);
        if (!isNaN(internalId)) { circuitCount = Math.max(circuitCount, internalId); }
        else { console.warn("ID de circuito salvo inválido:", savedCircuitData.id); circuitCount++; internalId = circuitCount; } // Fallback se ID salvo for inválido
    } else {
        circuitCount++; // Incrementa contador global para novo circuito
        internalId = circuitCount;
    }
    // console.log(`Circuit ID: ${internalId} (New: ${isNewCircuit})`); // Log Reduzido

    const newCircuitDiv = document.createElement('div');
    newCircuitDiv.innerHTML = getCircuitHTML(internalId); // Gera HTML
    const circuitElement = newCircuitDiv.firstElementChild;
    if(!circuitElement) { console.error("Falha ao criar elemento Circuito."); return; }

    // Define container alvo (fragmento ou elemento no DOM)
    const targetContainer = circuitContainer instanceof DocumentFragment ? circuitContainer : document.getElementById(`circuits-for-qdc-${qdcId}`);
    if (targetContainer) {
        targetContainer.appendChild(circuitElement); // Adiciona ao container
    } else {
        console.error(`Container de circuitos para QDC ${qdcId} não encontrado!`);
        return;
    }

    // Busca elementos DENTRO do circuitElement recém-adicionado/criado
    const tipoCircuitoSelect = circuitElement.querySelector(`#tipoCircuito-${internalId}`);
    const potenciaBTUSelect = circuitElement.querySelector(`#potenciaBTU-${internalId}`);
    const potenciaCVSelect = circuitElement.querySelector(`#potenciaCV-${internalId}`);
    const btuGroup = circuitElement.querySelector(`#potenciaBTU_group-${internalId}`);
    const cvGroup = circuitElement.querySelector(`#potenciaCV_group-${internalId}`);
    const resistividadeSolo = circuitElement.querySelector(`#resistividadeSolo-${internalId}`);
    const fpInput = circuitElement.querySelector(`#fatorPotencia-${internalId}`);
    const drCheck = circuitElement.querySelector(`#requerDR-${internalId}`);

    // Preenche dados salvos, se houver
    if (savedCircuitData) {
        Object.keys(savedCircuitData).forEach(key => {
            // Tenta encontrar pelo ID completo (formato salvo)
            let element = circuitElement.querySelector(`#${key}`);
            // Fallback: Tenta construir ID (formato esperado no HTML)
            if (!element) { element = circuitElement.querySelector(`#${key}-${internalId}`); }

            if (element) {
                if (element.type === 'checkbox') { (element).checked = savedCircuitData[key]; }
                else { (element).value = savedCircuitData[key]; }
            }
        });
        // Atualiza label do nome
        const nameInput = circuitElement.querySelector(`#nomeCircuito-${internalId}`);
        const nameLabel = circuitElement.querySelector(`#nomeCircuitoLabel-${internalId}`);
        if(nameInput && nameLabel) nameLabel.textContent = nameInput.value || `Circuito ${internalId}`;
    }

    // Inicializa dropdowns dependentes (Fases -> Ligação, Isolação -> Temp)
    atualizarLigacoes(internalId);
    handleInsulationChange(internalId);

    // Popula dropdowns BTU/CV/Solo (APENAS se uiData estiver disponível)
    // console.log(`addCircuit (${internalId}): Populando dropdowns.`); // Log Reduzido
    if(uiData) {
        populateBtuDropdown(potenciaBTUSelect, uiData.ar_condicionado_btu);
        populateCvDropdown(potenciaCVSelect, uiData.motores_cv);
        populateSoilResistivityDropdown(resistividadeSolo, uiData.fatores_k2);
    } else {
        console.warn(`addCircuit (${internalId}): uiData não disponível.`);
    }

    // Aplica visibilidade e valores padrão baseados no tipo de circuito (mesmo se for preenchido depois)
    handleCircuitTypeChange(internalId, tipoCircuitoSelect, btuGroup, cvGroup, fpInput, drCheck);

    // Restaura valores salvos para BTU/CV/Solo DEPOIS de popular e aplicar visibilidade
    if (savedCircuitData) {
        const restoreSpecialValues = () => {
            // Usa IDs construídos para garantir
            const btuSelectRestored = document.getElementById(`potenciaBTU-${internalId}`);
            const cvSelectRestored = document.getElementById(`potenciaCV-${internalId}`);
            const soloSelectRestored = document.getElementById(`resistividadeSolo-${internalId}`);
            const btuGroupRestored = document.getElementById(`potenciaBTU_group-${internalId}`);
            const cvGroupRestored = document.getElementById(`potenciaCV_group-${internalId}`);


            if (btuSelectRestored && savedCircuitData[`potenciaBTU-${internalId}`]) {
                 btuSelectRestored.value = savedCircuitData[`potenciaBTU-${internalId}`];
                 // Dispara change APENAS se o grupo estiver visível
                 if(!btuGroupRestored?.classList.contains('hidden')) btuSelectRestored.dispatchEvent(new Event('change'));
            }
            if (cvSelectRestored && savedCircuitData[`potenciaCV-${internalId}`]) {
                 cvSelectRestored.value = savedCircuitData[`potenciaCV-${internalId}`];
                 // Dispara change APENAS se o grupo estiver visível
                 if(!cvGroupRestored?.classList.contains('hidden')) cvSelectRestored.dispatchEvent(new Event('change'));
            }
            if (soloSelectRestored && savedCircuitData[`resistividadeSolo-${internalId}`]) {
                 soloSelectRestored.value = savedCircuitData[`resistividadeSolo-${internalId}`];
            }
        };
        // Aplica imediatamente se estiver em fragmento, ou com delay se já no DOM
        if (!(circuitContainer instanceof DocumentFragment)) { setTimeout(restoreSpecialValues, 50); }
        else { restoreSpecialValues(); }
    }

    // Colapsa se for NOVO circuito e não o primeiro do QDC (e não em fragmento)
    if (isNewCircuit && !(circuitContainer instanceof DocumentFragment)) {
       const existingCircuits = targetContainer?.querySelectorAll('.circuit-block');
        if (existingCircuits && existingCircuits.length > 1) { // Maior que 1, pois acabamos de adicionar
            circuitElement.classList.add('collapsed');
        }
    }

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
        updateFeederPowerDisplay(); // Recalcula potências após remover
    }
}

// HTML do circuito (sem alterações)
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

// Listeners e Handlers (sem alterações, exceto remoção de logs)
export function initializeFeederListeners() { const feederFases = document.getElementById('feederFases'); const feederTipoIsolacao = document.getElementById('feederTipoIsolacao'); const feederTemp = document.getElementById('feederTemperaturaAmbienteC'); const feederSolo = document.getElementById('feederResistividadeSolo'); if(feederFases) feederFases.addEventListener('change', () => { const tipoLigacaoSelect = document.getElementById('feederTipoLigacao'); const selectedFases = feederFases.value; if (tipoLigacaoSelect && ligacoes[selectedFases]) { const currentVal = tipoLigacaoSelect.value; tipoLigacaoSelect.innerHTML = ''; ligacoes[selectedFases].forEach(opt => { const option = document.createElement('option'); option.value = opt.value; option.textContent = opt.text; tipoLigacaoSelect.appendChild(option); }); if(ligacoes[selectedFases].some(o => o.value === currentVal)) tipoLigacaoSelect.value = currentVal; } }); if(feederTipoIsolacao) feederTipoIsolacao.addEventListener('change', () => { const isPVC = feederTipoIsolacao.value === 'PVC'; populateTemperatureDropdown(feederTemp, isPVC ? tempOptions.pvc : tempOptions.epr); }); if(feederFases) feederFases.dispatchEvent(new Event('change')); if(feederTipoIsolacao) feederTipoIsolacao.dispatchEvent(new Event('change')); if(uiData) populateSoilResistivityDropdown(feederSolo, uiData.fatores_k2); }
export function initializeQdcListeners(id) { atualizarQdcLigacoes(id); handleQdcInsulationChange(id); const resistividadeSolo = document.getElementById(`qdcResistividadeSolo-${id}`); if(uiData) populateSoilResistivityDropdown(resistividadeSolo, uiData.fatores_k2); }
function atualizarQdcLigacoes(id) { const fasesSelect = document.getElementById(`qdcFases-${id}`); const tipoLigacaoSelect = document.getElementById(`qdcTipoLigacao-${id}`); if (!fasesSelect || !tipoLigacaoSelect) return; const selectedFases = fasesSelect.value; const currentLigacao = tipoLigacaoSelect.value; if (ligacoes[selectedFases]) { tipoLigacaoSelect.innerHTML = ''; ligacoes[selectedFases].forEach(opt => { const option = document.createElement('option'); option.value = opt.value; option.textContent = opt.text; tipoLigacaoSelect.appendChild(option); }); if (ligacoes[selectedFases].some(o => o.value === currentLigacao)) { tipoLigacaoSelect.value = currentLigacao; } } }
function handleQdcInsulationChange(id) { const tipoIsolacao = document.getElementById(`qdcTipoIsolacao-${id}`); const tempAmbiente = document.getElementById(`qdcTemperaturaAmbienteC-${id}`); if (!tipoIsolacao || !tempAmbiente) return; const isPVC = tipoIsolacao.value === 'PVC'; populateTemperatureDropdown(tempAmbiente, isPVC ? tempOptions.pvc : tempOptions.epr); }
function handlePowerUnitChange(id, type) { const btuSelect = document.getElementById(`potenciaBTU-${id}`); const cvSelect = document.getElementById(`potenciaCV-${id}`); const wattsInput = document.getElementById(`potenciaW-${id}`); if (!wattsInput) return; if (type === 'btu' && btuSelect) { const btuValue = parseFloat(btuSelect.value); if (btuValue > 0) { wattsInput.value = (btuValue * BTU_TO_WATTS_FACTOR).toFixed(0); if(cvSelect) cvSelect.value = ""; } } else if (type === 'cv' && cvSelect) { const cvValue = parseFloat(cvSelect.value); if (cvValue > 0) { wattsInput.value = (cvValue * CV_TO_WATTS_FACTOR).toFixed(0); if(btuSelect) btuSelect.value = ""; } } }

// >>>>> handleMainContainerInteraction para LAZY LOADING <<<<<
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

            // Lógica para expandir/colapsar QDC e carregar circuitos sob demanda
            const qdcHeader = target.closest('.qdc-header');
            // Verifica se o clique foi no header, MAS NÃO nos botões, input ou select dentro dele
            if (qdcHeader && !target.closest('.qdc-header-right button, .qdc-header-left input, .qdc-header-center select')) {
                const isCollapsed = qdcBlock.classList.contains('collapsed');
                if (isCollapsed) {
                    // Expandindo: Garante que os circuitos sejam carregados (se não foram ainda)
                    qdcBlock.classList.remove('collapsed'); // Expande PRIMEIRO para mostrar loading
                    ensureCircuitsLoaded(qdcBlock, qdcId); // Carrega em background
                } else {
                    // Colapsando: Apenas adiciona a classe
                    qdcBlock.classList.add('collapsed');
                }
                return; // Impede que outros handlers sejam acionados pelo clique no header
            }
        } else if (eventType === 'change') {
            // Lógica de 'change' para elementos dentro do QDC (config)
            if (target.classList.contains('qdc-parent-select')) { updateFeederPowerDisplay(); return; }
            if (target.id === `qdcFases-${qdcId}`) { atualizarQdcLigacoes(qdcId); return; }
            if (target.id === `qdcTipoIsolacao-${qdcId}`) { handleQdcInsulationChange(qdcId); return; }
            // 'input' event para nome já é tratado em setupEventListeners
        }
    }

    const circuitBlock = target.closest('.circuit-block');
    if (circuitBlock) {
        const circuitId = circuitBlock.dataset.id; if (!circuitId) return;
        if (eventType === 'click') {
            const removeCircuitButton = target.closest('.remove-circuit-btn');
            if (removeCircuitButton) {
                 event.stopPropagation(); // Impede colapso
                 removeCircuit(circuitId);
                 return;
            }
            // Lógica para expandir/colapsar Circuito
            const circuitHeader = target.closest('.circuit-header');
            if (circuitHeader && !target.closest('.remove-circuit-btn')) { // Clique no header (não no botão)
                circuitBlock.classList.toggle('collapsed');
                return;
            }
        } else if (eventType === 'change') {
            // Lógica de 'change' para elementos dentro do Circuito
            if (target.id === `potenciaBTU-${circuitId}`) { handlePowerUnitChange(circuitId, 'btu'); updateFeederPowerDisplay(); return; }
            if (target.id === `potenciaCV-${circuitId}`) { handlePowerUnitChange(circuitId, 'cv'); updateFeederPowerDisplay(); return; }
            if (target.id === `tipoCircuito-${circuitId}`) {
                const tipoSelect = target;
                const btuGroupEl = circuitBlock.querySelector(`#potenciaBTU_group-${circuitId}`);
                const cvGroupEl = circuitBlock.querySelector(`#potenciaCV_group-${circuitId}`);
                const fpInputEl = circuitBlock.querySelector(`#fatorPotencia-${circuitId}`);
                const drCheckEl = circuitBlock.querySelector(`#requerDR-${circuitId}`);
                handleCircuitTypeChange(circuitId, tipoSelect, btuGroupEl, cvGroupEl, fpInputEl, drCheckEl);
                return;
            }
            if (target.id === `fases-${circuitId}`) { atualizarLigacoes(circuitId); return; }
            if (target.id === `tipoIsolacao-${circuitId}`) { handleInsulationChange(circuitId); return; }
        }
    }
}


// >>>>> NOVA FUNÇÃO: Garante que os circuitos de um QDC sejam carregados <<<<<
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

    // Mostra placeholder de carregamento
    if(placeholder) placeholder.style.display = 'block';

    // Marca como carregado IMEDIATAMENTE para evitar múltiplas chamadas
    qdcBlock.dataset.circuitsLoaded = 'true';
    console.log(`[Lazy Load] Carregando circuitos para QDC ${qdcId}...`);

    // Busca os dados dos circuitos do projeto armazenado (se houver)
    const projectQdcData = loadedProjectData?.qdcs_data?.find(q => String(q.id) === String(qdcId));
    const circuitsToLoad = projectQdcData?.circuits;

    // Pequeno delay simulado (opcional, para ver o loading)
    // await new Promise(resolve => setTimeout(resolve, 50));

    if (circuitsToLoad && Array.isArray(circuitsToLoad)) {
        console.log(`[Lazy Load] Encontrados ${circuitsToLoad.length} circuitos para carregar em QDC ${qdcId}.`);
        const fragment = document.createDocumentFragment();
        circuitsToLoad.forEach(circuitData => {
            addCircuit(qdcId, circuitData, fragment); // Adiciona ao fragmento
        });
        if(placeholder) placeholder.style.display = 'none'; // Esconde placeholder
        circuitContainer.appendChild(fragment); // Adiciona todos de uma vez
        console.log(`[Lazy Load] Circuitos adicionados ao DOM para QDC ${qdcId}.`);
         updateFeederPowerDisplay(); // Atualiza potências após adicionar
    } else {
        console.log(`[Lazy Load] Nenhum circuito salvo encontrado para QDC ${qdcId}.`);
        if(placeholder) placeholder.style.display = 'none'; // Esconde placeholder
        // Decide se adiciona um circuito default se não houver salvos
        // addCircuit(qdcId); // Descomente se quiser adicionar um circuito default ao expandir QDC vazio
    }
}

function atualizarLigacoes(id) { const fasesSelect = document.getElementById(`fases-${id}`); const tipoLigacaoSelect = document.getElementById(`tipoLigacao-${id}`); if (!fasesSelect || !tipoLigacaoSelect) return; const selectedFases = fasesSelect.value; const currentLigacao = tipoLigacaoSelect.value; if (ligacoes[selectedFases]) { tipoLigacaoSelect.innerHTML = ''; ligacoes[selectedFases].forEach(opt => { const option = document.createElement('option'); option.value = opt.value; option.textContent = opt.text; tipoLigacaoSelect.appendChild(option); }); if (ligacoes[selectedFases].some(o => o.value === currentLigacao)) { tipoLigacaoSelect.value = currentLigacao; } } }
function handleInsulationChange(id) { const tipoIsolacao = document.getElementById(`tipoIsolacao-${id}`); const tempAmbiente = document.getElementById(`temperaturaAmbienteC-${id}`); if (!tipoIsolacao || !tempAmbiente) return; const isPVC = tipoIsolacao.value === 'PVC'; populateTemperatureDropdown(tempAmbiente, isPVC ? tempOptions.pvc : tempOptions.epr); }

// >>>>> handleCircuitTypeChange (logs removidos) <<<<<
function handleCircuitTypeChange(id, tipoSelect, btuGroup, cvGroup, fpInput, drCheck) {
    const tipo = tipoSelect?.value;
    // console.log(`handleCircuitTypeChange (${id}): Tipo: ${tipo}`); // Log Removido

    if (btuGroup) { const shouldShowBtu = (tipo === 'ar_condicionado'); btuGroup.classList.toggle('hidden', !shouldShowBtu); }
    if (cvGroup) { const shouldShowCv = (tipo === 'motores'); cvGroup.classList.toggle('hidden', !shouldShowCv); }

    if (fpInput) { if (tipo === 'motores' || tipo === 'ar_condicionado') { fpInput.value = '0.85'; } else if (tipo === 'iluminacao' || tipo === 'tug' || tipo === 'tue') { fpInput.value = '0.92'; } }
    if (drCheck) { if (tipo === 'tug' || tipo === 'aquecimento') { drCheck.checked = true; } else if (tipo === 'iluminacao' || tipo === 'motores') { drCheck.checked = false; } }
}

// --- Funções de preenchimento de formulário ---
export function populateProjectList(projects) { const select = document.getElementById('savedProjectsSelect'); if(!select) { console.error("Elemento 'savedProjectsSelect' não encontrado."); return; } const currentValue = select.value; select.innerHTML = '<option value="">-- Selecione uma obra --</option>'; if (projects && Array.isArray(projects)) { projects.forEach(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = `${p.project_code ?? 'S/C'} - ${p.project_name ?? 'Obra sem nome'}`; select.appendChild(o); }); if(projects.some(p => p.id == currentValue)) { select.value = currentValue; } } else { console.warn("Nenhum projeto encontrado ou dados inválidos para popular lista."); } }

// >>>>> populateFormWithProjectData para LAZY LOADING <<<<<
// (Esta função deve estar em main.js agora, não aqui)
/* >>>>> MOVIDA PARA MAIN.JS <<<<<
export function populateFormWithProjectData(project) { ... }
*/

// Funções de Admin e Cliente (sem alterações)
export function populateUsersPanel(users) { const list = document.getElementById('adminUserList'); if (!list) return; list.innerHTML = ''; if (!users || users.length === 0) { list.innerHTML = '<li>Nenhum usuário encontrado.</li>'; return; } users.forEach(user => { const li = document.createElement('li'); const blockButtonClass = user.is_blocked ? 'btn-green' : 'btn-orange'; const blockButtonText = user.is_blocked ? 'Desbloquear' : 'Bloquear'; li.innerHTML = ` <span> <strong>${user.nome || 'Usuário sem nome'}</strong><br> <small>${user.email} ${user.is_admin ? '(Admin)' : ''} ${user.is_approved ? '' : '(Pendente)'}</small><br> <small>CREA: ${user.crea || 'N/A'}</small> </span> <div class="admin-user-actions"> ${!user.is_approved ? `<button class="btn-green approve-user-btn" data-user-id="${user.id}">Aprovar</button>` : ''} <button class="btn-blue-dark edit-user-btn" data-user-id="${user.id}">Editar</button> <button class="${blockButtonClass} block-user-btn" data-user-id="${user.id}" data-is-blocked="${user.is_blocked}"> ${blockButtonText} </button> <button class="btn-red remove-user-btn" data-user-id="${user.id}">Excluir</button> </div> `; list.appendChild(li); }); }
export function populateEditUserModal(user) { if (!user) return; document.getElementById('editUserId').value = user.id; document.getElementById('editNome').value = user.nome || ''; document.getElementById('editEmail').value = user.email || ''; document.getElementById('editCpf').value = user.cpf || ''; document.getElementById('editTelefone').value = user.telefone || ''; document.getElementById('editCrea').value = user.crea || ''; openModal('editUserModalOverlay'); }
export function populateProjectsPanel(projects, clients, users, currentUserProfile) { const tableBody = document.getElementById('adminProjectsTableBody'); if (!tableBody) return; tableBody.innerHTML = ''; const clientOptions = clients.map(c => `<option value="${c.id}">${c.nome}</option>`).join(''); const userOptions = users.map(u => `<option value="${u.id}">${u.nome || u.email}</option>`).join(''); if (!projects || projects.length === 0) { tableBody.innerHTML = '<tr><td colspan="5">Nenhuma obra encontrada.</td></tr>'; return; } projects.forEach(p => { const tr = document.createElement('tr'); const owner = p.owner; const client = p.client; const canTransfer = currentUserProfile.is_admin || currentUserProfile.id === p.owner_id; tr.innerHTML = ` <td>${p.project_code || 'S/C'}</td> <td>${p.project_name || 'Obra sem nome'}</td> <td>${owner ? (owner.nome || owner.email) : 'N/A'}</td> <td>${client ? client.nome : 'Nenhum'}</td> <td class="action-cell"> <div class="action-group"> <label>Cliente:</label> <select class="transfer-client-select" ${!canTransfer ? 'disabled' : ''}> <option value="">-- Nenhum --</option> ${clientOptions} </select> <button class="btn-blue-dark transfer-client-btn" data-project-id="${p.id}" ${!canTransfer ? 'disabled' : ''}>Salvar</button> </div> ${currentUserProfile.is_admin ? ` <div class="action-group"> <label>Dono:</label> <select class="transfer-owner-select"> ${userOptions} </select> <button class="btn-orange transfer-owner-btn" data-project-id="${p.id}">Transferir</button> </div> ` : ''} </td> `; const clientSelect = tr.querySelector('.transfer-client-select'); if (clientSelect && p.client_id) { (clientSelect).value = p.client_id; } const ownerSelect = tr.querySelector('.transfer-owner-select'); if (ownerSelect && p.owner_id) { (ownerSelect).value = p.owner_id; } tableBody.appendChild(tr); }); }
export function populateClientManagementModal(clients) { const list = document.getElementById('clientList'); if (!list) return; list.innerHTML = ''; if (!clients || clients.length === 0) { list.innerHTML = '<li>Nenhum cliente cadastrado.</li>'; return; } clients.forEach(c => { const li = document.createElement('li'); li.innerHTML = ` <span> <strong>${c.nome || 'Cliente sem nome'}</strong> (Projetos: ${c.projects?.length || 0})<br> <small>${c.documento_tipo || 'Doc'}: ${c.documento_valor || 'N/A'}</small><br> <small>Email: ${c.email || 'N/A'} | Celular: ${c.celular || 'N/A'}</small> </span> <div class="client-actions"> <button class="btn-edit edit-client-btn" data-client-id="${c.id}">Editar</button> <button class="btn-danger delete-client-btn" data-client-id="${c.id}" ${c.projects?.length > 0 ? 'disabled' : ''}>Excluir</button> </div> `; list.appendChild(li); }); }
export function resetClientForm() { const form = document.getElementById('clientForm'); if(form) form.reset(); (document.getElementById('clientId')).value = ''; (document.getElementById('clientFormTitle')).textContent = 'Cadastrar Novo Cliente'; (document.getElementById('clientFormSubmitBtn')).textContent = 'Salvar Cliente'; (document.getElementById('clientFormCancelBtn')).style.display = 'none'; }
export function openEditClientForm(client) { if (!client) return; (document.getElementById('clientId')).value = client.id; (document.getElementById('clientNome')).value = client.nome || ''; (document.getElementById('clientDocumentoTipo')).value = client.documento_tipo || 'CPF'; (document.getElementById('clientDocumentoValor')).value = client.documento_valor || ''; (document.getElementById('clientEmail')).value = client.email || ''; (document.getElementById('clientCelular')).value = client.celular || ''; (document.getElementById('clientTelefone')).value = client.telefone || ''; (document.getElementById('clientEndereco')).value = client.endereco || ''; (document.getElementById('clientFormTitle')).textContent = 'Editar Cliente'; (document.getElementById('clientFormSubmitBtn')).textContent = 'Salvar Alterações'; (document.getElementById('clientFormCancelBtn')).style.display = 'inline-block'; }
export function populateSelectClientModal(clients, isChange = false) { const select = document.getElementById('clientSelectForNewProject'); const title = document.querySelector('#selectClientModalOverlay h3'); const continueBtn = document.getElementById('continueWithoutClientBtn'); if (title) title.textContent = isChange ? 'Vincular / Alterar Cliente' : 'Vincular Cliente à Nova Obra'; if (continueBtn) continueBtn.style.display = isChange ? 'none' : 'inline-block'; if (!select) return; select.innerHTML = ''; if (!clients || clients.length === 0) { select.innerHTML = '<option value="">Nenhum cliente cadastrado</option>'; return; } select.innerHTML = '<option value="">-- Selecione um Cliente --</option>'; clients.forEach(c => { const opt = document.createElement('option'); opt.value = c.id; opt.textContent = `${c.nome} (${c.client_code || 'S/C'})`; select.appendChild(opt); }); if (isChange) { const currentClientId = (document.getElementById('currentClientId')).value; if (currentClientId) { select.value = currentClientId; } } openModal('selectClientModalOverlay'); }

console.log("--- ui.js: Fim do arquivo ---");