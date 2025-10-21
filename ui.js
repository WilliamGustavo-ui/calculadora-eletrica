// Arquivo: ui.js (Carga Hierárquica VISUAL e Debug Memorial - Completo)

import { ligacoes, BTU_TO_WATTS_FACTOR, CV_TO_WATTS_FACTOR } from './utils.js';
import { Canvg } from 'https://cdn.skypack.dev/canvg';

console.log("--- ui.js: Iniciando carregamento ---"); // Log de Carregamento

let circuitCount = 0;
let qdcCount = 0;
let uiData = null;
let tempOptions = { pvc: [], epr: [] };

console.log("--- ui.js: Antes de definir exports ---"); // Log de Carregamento

export function setupDynamicData(data) {
    console.log("--- ui.js: setupDynamicData executado ---"); // Log de Carregamento
    uiData = data;

    if (uiData?.fatores_k1) {
        tempOptions.pvc = uiData.fatores_k1.filter(f => f.fator > 0).map(f => f.temperatura_c).sort((a, b) => a - b);
    } else {
        tempOptions.pvc = [30];
        console.warn("Dados de fatores_k1 (PVC) não encontrados ou inválidos.");
    }

    if (uiData?.fatores_k1_epr) {
        tempOptions.epr = uiData.fatores_k1_epr.filter(f => f.fator > 0).map(f => f.temperatura_c).sort((a, b) => a - b);
    } else {
        tempOptions.epr = tempOptions.pvc;
        console.warn("Dados de fatores_k1_epr não encontrados ou inválidos.");
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
    if (!btuData || !Array.isArray(btuData)) {
        console.warn("Dados de BTU inválidos ou ausentes.");
        return;
    }
    // Garante que valor_btu seja numérico para sort
    btuData
        .map(item => ({ ...item, valor_btu: parseFloat(item.valor_btu) }))
        .filter(item => !isNaN(item.valor_btu))
        .sort((a, b) => a.valor_btu - b.valor_btu)
        .forEach(item => {
            const option = document.createElement('option');
            option.value = item.valor_btu;
            option.textContent = item.descricao;
            selectElement.appendChild(option);
     });
}

function populateCvDropdown(selectElement, cvData) {
     if (!selectElement) return;
    selectElement.innerHTML = '<option value="">-- Selecione --</option>';
    if (!cvData || !Array.isArray(cvData)) {
        console.warn("Dados de CV inválidos ou ausentes.");
        return;
    };
     // Garante que valor_cv seja numérico para sort
     cvData
        .map(item => ({ ...item, valor_cv: parseFloat(item.valor_cv) }))
        .filter(item => !isNaN(item.valor_cv))
        .sort((a, b) => a.valor_cv - b.valor_cv)
        .forEach(item => {
            const option = document.createElement('option');
            option.value = item.valor_cv;
            option.textContent = item.descricao;
            selectElement.appendChild(option);
     });
}

function populateSoilResistivityDropdown(selectElement, soilData) {
    if (!selectElement) return;
    selectElement.innerHTML = '<option value="0">Não Aplicável</option>';
    if (!soilData || !Array.isArray(soilData)) {
         console.warn("Dados de resistividade do solo inválidos ou ausentes.");
        return;
    }
    // Garante que resistividade seja numérico para sort
    soilData
        .map(item => ({ ...item, resistividade: parseFloat(item.resistividade) }))
        .filter(item => !isNaN(item.resistividade))
        .sort((a, b) => a.resistividade - b.resistividade)
        .forEach(item => {
            const option = document.createElement('option');
            option.value = item.resistividade;
            option.textContent = `${item.resistividade}`; // Mantém como string no texto
            selectElement.appendChild(option);
     });
}


// --- FUNÇÕES DE VISIBILIDADE E MODAIS ---
console.log("--- ui.js: Definindo showLoginView ---");
export function showLoginView() { console.log("showLoginView chamada"); const l = document.getElementById('loginContainer'); if(l) l.style.display = 'block'; const a = document.getElementById('appContainer'); if(a) a.style.display = 'none'; const r = document.getElementById('resetPasswordContainer'); if(r) r.style.display = 'none'; }

console.log("--- ui.js: Definindo showAppView ---");
export function showAppView(userProfile) { console.log("showAppView chamada"); const l = document.getElementById('loginContainer'); if(l) l.style.display = 'none'; const a = document.getElementById('appContainer'); if(a) a.style.display = 'block'; const r = document.getElementById('resetPasswordContainer'); if(r) r.style.display = 'none'; const isAdmin = userProfile?.is_admin || false; const adminBtn = document.getElementById('adminPanelBtn'); if(adminBtn) adminBtn.style.display = isAdmin ? 'block' : 'none'; /*const clientBtn = document.getElementById('manageClientsBtn'); if(clientBtn) clientBtn.style.display = 'block'; const projBtn = document.getElementById('manageProjectsBtn'); if(projBtn) projBtn.style.display = 'block';*/ } // Comentado botões que podem não existir

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
        if (!qdcId) return; // Pula se o QDC não tiver ID (improvável, mas seguro)

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

        totalInstalledGeneral += installedDirect; // Soma instalada direta para o total geral

        const parentSelect = document.getElementById(`qdcParent-${qdcId}`);
        const parentId = parentSelect ? parentSelect.value : 'feeder';

        qdcData[qdcId] = {
            installedDirect: installedDirect,
            demandedDirect: demandedDirect,
            parentId: parentId,
            childrenIds: [], // Inicializa lista de filhos
            aggregatedDemand: -1 // Marca como não calculado ainda
        };

        // Atualiza display *instalado* do QDC (sempre direto)
        const qdcPotInstEl = document.getElementById(`qdcPotenciaInstalada-${qdcId}`);
        if (qdcPotInstEl) qdcPotInstEl.value = installedDirect.toFixed(2);
        // O campo de demanda será atualizado após o cálculo agregado
    });

    // 2. Constrói a lista de filhos para cada QDC
    Object.keys(qdcData).forEach(qdcId => {
        const parentId = qdcData[qdcId].parentId;
        // Garante que o pai existe e não é o feeder antes de adicionar como filho
        if (parentId !== 'feeder' && qdcData[parentId]) {
            qdcData[parentId].childrenIds.push(qdcId);
        }
    });

    // 3. Função recursiva para calcular a demanda agregada com memoização e detecção de loop simples
    const visited = new Set(); // Para detectar loops
    function calculateAggregatedDemand(qdcId) {
        if (!qdcData[qdcId]) return 0; // QDC não existe
        if (qdcData[qdcId].aggregatedDemand !== -1) { // Já calculado? Retorna cache
             return qdcData[qdcId].aggregatedDemand;
        }
        if (visited.has(qdcId)) { // Detecção de loop
            console.error(`Loop detectado na hierarquia de QDCs envolvendo ${qdcId}`);
            return qdcData[qdcId].demandedDirect; // Retorna apenas carga direta para quebrar loop
        }
        visited.add(qdcId); // Marca como visitado NESTA chamada recursiva

        let aggregatedDemand = qdcData[qdcId].demandedDirect; // Começa com a carga direta

        // Soma a carga agregada de cada filho recursivamente
        qdcData[qdcId].childrenIds.forEach(childId => {
            aggregatedDemand += calculateAggregatedDemand(childId);
        });

        visited.delete(qdcId); // Remove da visita atual ao retornar

        // Armazena o valor calculado
        qdcData[qdcId].aggregatedDemand = aggregatedDemand;
        return aggregatedDemand;
    }

    // 4. Calcula e atualiza a demanda agregada exibida para cada QDC
    let totalDemandAggregatedGeneral = 0;
    Object.keys(qdcData).forEach(qdcId => {
        visited.clear(); // Limpa detecção de loop para cada QDC raiz
        const aggregatedDemand = calculateAggregatedDemand(qdcId); // Calcula (ou pega do cache)

        // Atualiza o campo de demanda do QDC com o valor AGREGADO
        const qdcPotDemEl = document.getElementById(`qdcPotenciaDemandada-${qdcId}`);
        if (qdcPotDemEl) qdcPotDemEl.value = aggregatedDemand.toFixed(2);

        // Soma ao total geral APENAS se for um QDC de nível superior (ligado ao feeder)
        if (qdcData[qdcId].parentId === 'feeder') {
            totalDemandAggregatedGeneral += aggregatedDemand;
        }
    });

    // 5. Atualiza os campos do Alimentador Geral
    const feederPotInstaladaEl = document.getElementById('feederPotenciaInstalada');
    const feederSomaPotDemandadaEl = document.getElementById('feederSomaPotenciaDemandada');
    const feederFatorDemandaInput = document.getElementById('feederFatorDemanda');
    const feederPotDemandadaFinalEl = document.getElementById('feederPotenciaDemandada');

    if (feederPotInstaladaEl) feederPotInstaladaEl.value = totalInstalledGeneral.toFixed(2);
    if (feederSomaPotDemandadaEl) feederSomaPotDemandadaEl.value = totalDemandAggregatedGeneral.toFixed(2);

    const feederFatorDemanda = (parseFloat(feederFatorDemandaInput?.value) || 100) / 100.0;
    const finalDemandGeral = totalDemandAggregatedGeneral * feederFatorDemanda;

    if (feederPotDemandadaFinalEl) feederPotDemandadaFinalEl.value = finalDemandGeral.toFixed(2);

    console.warn("Aviso: Exibição da carga hierárquica ATIVA. O dimensionamento real pela Edge Function ainda é PLANO.");
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

    initializeFeederListeners(); // Precisa ser chamado *antes* de addQdcBlock se uiData já estiver carregado
    qdcCount = 0; // Reseta contadores
    circuitCount = 0;

    if (addDefaultQdc) {
        addQdcBlock(); // Adiciona o primeiro QDC
    }
    // updateFeederPowerDisplay será chamado implicitamente ao adicionar/remover QDCs/circuitos
}

function getQdcHTML(id, name = `QDC ${id}`, parentId = 'feeder') {
    // HTML inalterado (com value="4" correto)
    return `
    <div class="qdc-block" id="qdc-${id}" data-id="${id}">
        {...conteúdo HTML do QDC omitido para brevidade...}
            <div id="circuits-for-qdc-${id}" class="circuits-container-internal"></div>
        </div>
    </div>`;
}

export function addQdcBlock(id = null, name = null, parentId = 'feeder') {
    const isNewQdc = !id;
    const internalId = id || ++qdcCount;
    if (!id) qdcCount = Math.max(qdcCount, internalId);
    const qdcName = name || `QDC ${internalId}`;
    console.log(`Adicionando QDC ${internalId} (Novo: ${isNewQdc})`);

    const newQdcDiv = document.createElement('div');
    newQdcDiv.innerHTML = getQdcHTML(internalId, qdcName, parentId);
    const qdcElement = newQdcDiv.firstElementChild;
    if(!qdcElement) { console.error("Falha ao criar elemento QDC."); return; }

    const qdcContainer = document.getElementById('qdc-container');
    if(qdcContainer) qdcContainer.appendChild(qdcElement);
    else { console.error("Container principal de QDCs não encontrado."); return;}

    // Adiciona listener direto ao botão '+ Circuito'
    const addCircuitBtn = qdcElement.querySelector('.add-circuit-to-qdc-btn');
    if (addCircuitBtn) {
        addCircuitBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            addCircuit(internalId); // Usa o ID correto
        });
    } else {
        console.error(`Botão '+ Circuito' não encontrado para QDC ${internalId}`);
    }

    updateQdcParentDropdowns(); // Atualiza dropdowns APÓS adicionar ao DOM
    initializeQdcListeners(internalId); // Adiciona outros listeners (fases, isolação, etc.)

    // Colapsa se for novo E não for o primeiro, OU se for carregado E não for o primeiro
    if ((isNewQdc && qdcCount > 1) || (!isNewQdc && qdcElement.previousElementSibling)) {
         if (!qdcElement.classList.contains('collapsed')) {
            qdcElement.classList.add('collapsed');
         }
    }

    // Adiciona um circuito inicial APENAS se for um QDC novo
    if (isNewQdc) {
       addCircuit(internalId);
    }

    // Listener para recalcular cargas quando o parent mudar
    const parentSelect = qdcElement.querySelector('.qdc-parent-select');
    if(parentSelect) {
        parentSelect.addEventListener('change', updateFeederPowerDisplay);
    }

    // Atualiza o display geral APÓS adicionar um QDC (mesmo que vazio inicialmente)
    updateFeederPowerDisplay();

    return internalId;
}

export function removeQdc(qdcId) {
    const qdcBlock = document.getElementById(`qdc-${qdcId}`);
    if (qdcBlock) {
        const qdcNameInput = qdcBlock.querySelector('.qdc-name-input');
        const qdcName = qdcNameInput ? qdcNameInput.value : `QDC ${qdcId}`;
        if (confirm(`Remover QDC "${qdcName}" e todos os seus circuitos?`)) {
            qdcBlock.remove();
            updateQdcParentDropdowns(); // Atualiza opções
            updateFeederPowerDisplay(); // Recalcula cargas
        }
    }
}

export function updateQdcParentDropdowns() {
    const allQdcs = document.querySelectorAll('#qdc-container .qdc-block'); // Busca no container correto
    const qdcOptions = [{ value: 'feeder', text: 'Alimentador Geral' }];
    allQdcs.forEach(qdc => {
        const id = qdc.dataset.id;
        const nameInput = document.getElementById(`qdcName-${id}`);
        qdcOptions.push({ value: `qdc-${id}`, text: nameInput ? nameInput.value : `QDC ${id}` });
    });

    allQdcs.forEach(qdc => {
        const currentQdcId = qdc.dataset.id;
        const parentSelect = document.getElementById(`qdcParent-${currentQdcId}`);
        if (!parentSelect) return;

        const currentParentValue = parentSelect.dataset.initialParent || parentSelect.value;
        parentSelect.innerHTML = ''; // Limpa

        qdcOptions.forEach(opt => {
            // Um QDC não pode ser alimentado por ele mesmo
            if (opt.value !== `qdc-${currentQdcId}`) {
                // TODO: Adicionar lógica anti-loop aqui se necessário
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.text;
                parentSelect.appendChild(option);
            }
        });

        // Restaura seleção
        if (Array.from(parentSelect.options).some(option => option.value === currentParentValue)) {
             parentSelect.value = currentParentValue;
        } else {
             parentSelect.value = 'feeder'; // Default
        }

        delete parentSelect.dataset.initialParent; // Limpa após primeiro uso
    });
}


// --- LÓGICA DE CIRCUITO ---
// addCircuit com collapse padrão
export function addCircuit(qdcId, savedCircuitData = null) {
    const isNewCircuit = !savedCircuitData;
    const internalId = savedCircuitData ? parseInt(savedCircuitData.id) : ++circuitCount;
    if (!savedCircuitData) circuitCount = Math.max(circuitCount, internalId);

    const newCircuitDiv = document.createElement('div');
    newCircuitDiv.innerHTML = getCircuitHTML(internalId);
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
         // Se mudar BTU/CV, handlePowerUnitChange chama updateFeederPowerDisplay
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

    // Popula dropdowns de BTU/CV/Solo (APÓS handleCircuitTypeChange, que pode ter alterado visibilidade)
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
            // Pequeno timeout para garantir que as opções de ligação foram populadas por atualizarLigacoes
            setTimeout(() => { tipoLigacaoSelect.value = savedCircuitData[`tipoLigacao-${internalId}`]; }, 0);
        }
        const temperaturaAmbiente = document.getElementById(`temperaturaAmbienteC-${internalId}`);
        if(temperaturaAmbiente && savedCircuitData[`temperaturaAmbienteC-${internalId}`]) {
             setTimeout(() => { temperaturaAmbiente.value = savedCircuitData[`temperaturaAmbienteC-${internalId}`]; }, 0);
        }
    }
     // Recalcula display geral APÓS adicionar um circuito
     // (importante caso seja o primeiro circuito ou carregado de save)
     updateFeederPowerDisplay();
}


export function removeCircuit(circuitId) {
    const circuitBlock = document.getElementById(`circuit-${circuitId}`);
    if (circuitBlock) {
        circuitBlock.remove();
        updateFeederPowerDisplay(); // Recalcula
    }
}

function getCircuitHTML(id) {
     // HTML inalterado (com value="4" correto)
     return `<div class="circuit-block" id="circuit-${id}" data-id="${id}"> {...conteúdo HTML do circuito omitido para brevidade...} </div>`;
}

function initializeFeederListeners() {
    // ... (inalterada) ...
}
function initializeQdcListeners(id) {
    // ... (inalterada) ...
}
function atualizarQdcLigacoes(id) {
    // ... (inalterada) ...
}
function handleQdcInsulationChange(id) {
    // ... (inalterada) ...
}
function handlePowerUnitChange(id, type) {
    // ... (inalterada, já chama updateFeederPowerDisplay) ...
}

// handleMainContainerInteraction SEM a lógica do addCircuitBtn
export function handleMainContainerInteraction(event) {
    const target = event.target;

    // --- Lógica de QDC (Remover, Colapsar, Renomear, E NOVOS CAMPOS) ---
    const qdcBlock = target.closest('.qdc-block');
    if (qdcBlock) {
        const qdcId = qdcBlock.dataset.id;
        if (!qdcId) return; // Segurança

        const removeQdcButton = target.closest('.remove-qdc-btn');
        if (removeQdcButton) {
            removeQdc(qdcId); // Usa o ID do bloco pai
            return;
        }

        if (target.classList.contains('qdc-name-input') && event.type === 'input') {
            updateQdcParentDropdowns();
            return; // Evita colapsar
        }
        if (target.classList.contains('qdc-parent-select') && event.type === 'change') {
             updateFeederPowerDisplay(); // Já tem listener direto, mas redundância ok
             return; // Evita colapsar
        }

        // Gatilhos para campos internos
        if (target.id === `qdcFases-${qdcId}`) {
            atualizarQdcLigacoes(qdcId);
        } else if (target.id === `qdcTipoIsolacao-${qdcId}`) {
            handleQdcInsulationChange(qdcId);
        }
        // Listener para fator demanda já adicionado em initializeQdcListeners

        // Colapsar/Expandir
        const qdcHeader = target.closest('.qdc-header');
        if (qdcHeader && !target.closest('.qdc-header-right button, .qdc-header-left input, .qdc-header-center select')) {
            qdcBlock.classList.toggle('collapsed');
            return;
        }
    }

    // --- Lógica de Circuito (Remover, Colapsar, etc.) ---
    const circuitBlock = target.closest('.circuit-block');
    if (circuitBlock) {
        const circuitId = circuitBlock.dataset.id;
         if (!circuitId) return; // Segurança

        // Colapsar/Expandir
        const circuitHeader = target.closest('.circuit-header');
        if (circuitHeader && !target.closest('.remove-circuit-btn')) {
            circuitBlock.classList.toggle('collapsed');
            // Não retorna, permite outras ações no header
        }

        // Ações internas
        if (target.id === `nomeCircuito-${circuitId}` && event.type === 'input') {
            const lbl = document.getElementById(`nomeCircuitoLabel-${circuitId}`);
            if(lbl) lbl.textContent = target.value || `Circuito ${circuitId}`;
        }

        const removeCircuitButton = target.closest('.remove-circuit-btn');
        if (removeCircuitButton) {
            removeCircuit(circuitId); // Usa ID do bloco pai
        }
        // Listeners de mudança
        else if (target.id === `tipoCircuito-${circuitId}`) { handleCircuitTypeChange(circuitId); }
        else if (target.id === `fases-${circuitId}`) { atualizarLigacoes(circuitId); }
        else if (target.id === `tipoIsolacao-${circuitId}`) { handleInsulationChange(circuitId); }
        // Potência/Demanda já tem listeners diretos que chamam updateFeederPowerDisplay
    }
}


function atualizarLigacoes(id) {
    // ... (inalterada) ...
}
function handleInsulationChange(id) {
    // ... (inalterada) ...
}
function handleCircuitTypeChange(id) {
   // ... (inalterada) ...
}

// --- Funções de preenchimento de formulário ---
// ... (Populate functions inalteradas) ...
export function populateProjectList(projects) { /* ... */ }
export function populateFormWithProjectData(project) { /* ... */ }
export function populateUsersPanel(users) { /* ... */ }
export function populateEditUserModal(d) { /* ... */ }
export function populateProjectsPanel(projects, clients, users, currentUserProfile) { /* ... */ }
export function populateClientManagementModal(clients) { /* ... */ }
export function resetClientForm() { /* ... */ }
export function openEditClientForm(c) { /* ... */ }
export function populateSelectClientModal(clients, isChange = false) { /* ... */ }

// --- FUNÇÕES DE GERAÇÃO DE PDF ---
// ... (Funções draw* e buildUnifilarSvgString inalteradas) ...
function getDpsText(dpsInfo) { /* ... */ }
function drawHeader(x, y, projectData, totalPower) { /* ... */ }
function drawDisjuntor(x, y, text, fases = 'Monofasico') { /* ... */ }
function drawDR(x, y, text, fases = 'Monofasico') { /* ... */ }
function drawDPS(x, y, feederData) { /* ... */ }
function drawGroundSymbol(x, y) { /* ... */ }
function drawConductorSymbol(x, y, numConductors = 0) { /* ... */ }
function drawCircuitLine(result, x, y, index) { /* ... */ }
function buildUnifilarSvgString(calculationResults) { /* ... */ }
export async function generateUnifilarPdf(calculationResults) { /* ... */ }

// generateMemorialPdf com debug logs e agrupamento (inalterada da última resposta)
export function generateMemorialPdf(calculationResults, currentUserProfile) {
    if (!calculationResults) { alert("Execute o cálculo primeiro."); return; }

    const { feederResult, circuitResults } = calculationResults;
    if (!feederResult) { alert("Dados do alimentador geral ausentes. Não é possível gerar Memorial."); return;}

    console.log("--- Debugging generateMemorialPdf ---");
    console.log("Feeder Result Dados:", feederResult?.dados);
    console.log("Circuit Results Received:", circuitResults); // Log completo
    if (circuitResults && circuitResults.length > 0) {
        console.log("Checking for qdcId in first circuit:", circuitResults[0]?.dados?.qdcId);
        console.log("Data type of qdcId in first circuit:", typeof circuitResults[0]?.dados?.qdcId);
    }

    const circuitsByQdc = {};
    if (circuitResults && Array.isArray(circuitResults)) {
        circuitResults.forEach(result => {
            if (result && result.dados && (result.dados.qdcId !== undefined && result.dados.qdcId !== null)) {
                const qdcId = String(result.dados.qdcId); // Garante string
                if (!circuitsByQdc[qdcId]) {
                    circuitsByQdc[qdcId] = [];
                }
                circuitsByQdc[qdcId].push(result);
            } else {
                console.warn("Resultado de circuito inválido ou sem qdcId:", result);
                if (!circuitsByQdc['unknown']) circuitsByQdc['unknown'] = [];
                circuitsByQdc['unknown'].push(result);
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
    const addL = (l, v) => { if (yPos > 270) { doc.addPage(); yPos = 20; } doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text(l, lM, yPos); doc.setFont('helvetica', 'normal'); doc.text(String(v ?? '-'), vM, yPos); yPos += 6; };

    const reportData = feederResult?.dados || {};

    // --- Página 1: Dados Gerais e Resumos ---
    addT("RELATÓRIO DE PROJETO ELÉTRICO");
    addS("DADOS DO CLIENTE"); /* ... */
    addL("Cliente:", reportData.cliente);
    addL(`Documento (${reportData.tipoDocumento}):`, reportData.documento);
    addL("Celular:", reportData.celular);
    addL("Telefone:", reportData.telefone);
    addL("E-mail:", reportData.email);
    addL("Endereço do Cliente:", reportData.enderecoCliente);
    yPos += 5;
    addS("DADOS DA OBRA"); /* ... */
    addL("Código da Obra:", reportData.projectCode);
    addL("Nome da Obra:", reportData.obra);
    addL("Cidade da Obra:", reportData.cidadeObra);
    addL("Endereço da Obra:", reportData.enderecoObra);
    addL("Área da Obra (m²):", reportData.areaObra);
    addL("Unid. Residenciais:", reportData.unidadesResidenciais);
    addL("Unid. Comerciais:", reportData.unidadesComerciais);
    addL("Observações:", reportData.observacoes);
    yPos += 5;
    addS("INFORMAÇÕES DO RESPONSÁVEL TÉCNICO"); /* ... */
    addL("Nome:", document.getElementById('respTecnico')?.value);
    addL("Título:", document.getElementById('titulo')?.value);
    addL("CREA:", document.getElementById('crea')?.value);
    yPos += 5;
    addS("INFORMAÇÕES DO RELATÓRIO"); /* ... */
    const dataFormatada = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    addL("Gerado em:", dataFormatada);
    addL("Gerado por:", currentUserProfile?.nome || 'N/A');
    yPos += 5;

    addS("RESUMO DA ALIMENTAÇÃO GERAL"); /* ... */
    if (feederResult?.calculos?.disjuntorRecomendado) {
        const feederBreakerType = feederResult.dados?.tipoDisjuntor?.includes('Caixa Moldada') ? 'MCCB' : 'DIN';
        const feederBreakerText = `${feederBreakerType} ${feederResult.calculos.disjuntorRecomendado.nome}`;
        const feederHead = [['Tensão/Fases', 'Disjuntor Geral', 'DR', 'DPS', 'Cabo (Isolação)', 'Eletroduto']];
        const feederBody = [[ `${feederResult.dados?.tensaoV}V - ${feederResult.dados?.fases}`, feederBreakerText, feederResult.dados?.requerDR ? 'Sim' : 'Nao', getDpsText(feederResult.dados?.dpsInfo), `${feederResult.calculos?.bitolaRecomendadaMm2} mm² (${feederResult.dados?.tipoIsolacao})`, feederResult.calculos?.dutoRecomendado ]];
        doc.autoTable({ startY: yPos, head: feederHead, body: feederBody, theme: 'grid', headStyles: { fillColor: [44, 62, 80] }, styles: { fontSize: 8 } });
        yPos = doc.lastAutoTable.finalY + 10;
    } else {
         addL("Alimentador Geral:", "Dados indisponíveis."); yPos += 5;
    }

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
            const body = qdcCircuits.map((r, index) => {
                const circuitBreakerType = r.dados?.tipoDisjuntor?.includes('Caixa Moldada') ? 'MCCB' : 'DIN';
                const circuitBreakerText = `${circuitBreakerType} ${r.calculos?.disjuntorRecomendado?.nome || 'N/C'}`;
                return [
                    index + 1, // Renumeração
                    r.dados?.nomeCircuito || '?',
                    circuitBreakerText,
                    r.dados?.requerDR ? 'Sim' : 'Nao',
                    getDpsText(r.dados?.dpsInfo),
                    `${r.calculos?.bitolaRecomendadaMm2 || '?'} mm² (${r.dados?.tipoIsolacao || '?'})`,
                    r.calculos?.dutoRecomendado || '?'
                ];
            });
            doc.autoTable({ startY: yPos, head: head, body: body, theme: 'grid', headStyles: { fillColor: [44, 62, 80] }, styles: { fontSize: 8 } });
            yPos = doc.lastAutoTable.finalY + 10;
        }
    });
     // Seção para circuitos 'unknown'
    if (circuitsByQdc['unknown'] && circuitsByQdc['unknown'].length > 0) {
         if (yPos > 240) { doc.addPage(); yPos = 20; }
         addS(`RESUMO DOS CIRCUITOS - QDC NÃO IDENTIFICADO`);
         addL("Aviso:", `${circuitsByQdc['unknown'].length} circuito(s) não puderam ser associados a um QDC.`); yPos+=5;
    }

    // --- Páginas de Memorial Detalhado ---
    if (feederResult) {
        doc.addPage();
        yPos = 20;
        generateMemorialPage(doc, feederResult, "ALIMENTADOR GERAL", 0, addT, addS, addL, () => yPos, (newY) => yPos = newY);
    }

    qdcOrder.forEach(qdcId => {
        const qdcNameEl = document.getElementById(`qdcName-${qdcId}`);
        const qdcName = qdcNameEl ? qdcNameEl.value : `QDC ${qdcId}`;
        const qdcCircuits = circuitsByQdc[qdcId];

        if (qdcCircuits) {
            qdcCircuits.forEach((result, index) => {
                if (result && result.dados && result.calculos) { // Verifica validade
                    doc.addPage();
                    yPos = 20;
                    generateMemorialPage(doc, result, `CIRCUITO ${index + 1} (${qdcName})`, index + 1, addT, addS, addL, () => yPos, (newY) => yPos = newY);
                } else {
                    console.error(`Dados inválidos para memorial do circuito ${index+1} do ${qdcName}:`, result);
                }
            });
        }
    });

    doc.save(`Memorial_${document.getElementById('obra')?.value || 'Projeto'}.pdf`);
}

// Função auxiliar generateMemorialPage (com mais verificações ??)
function generateMemorialPage(doc, result, titlePrefix, circuitIndex, addT, addS, addL, getY, setY) {
    const { dados, calculos } = result || {};
    if (!dados || !calculos) {
        console.error("Dados ou Cálculos ausentes para gerar página do memorial:", titlePrefix, result);
        addT(`ERRO - ${titlePrefix}`); addS("Não foi possível gerar os detalhes. Dados ausentes."); return;
    }

    const isFeeder = dados.id === 'feeder';
    const pageTitle = isFeeder ? `MEMORIAL DE CÁLCULO - ${titlePrefix}` : `MEMORIAL DE CÁLCULO - ${titlePrefix}: ${dados.nomeCircuito}`;
    let yPos = getY();
    addT(pageTitle);

    addS("-- PARÂMETROS DE ENTRADA --");
    if (!isFeeder) { addL("Tipo de Circuito:", dados.tipoCircuito); }
    addL("Potência Instalada:", `${calculos.potenciaInstalada?.toFixed(2) ?? '?'} W`);
    addL("Fator de Demanda:", `${dados.fatorDemanda ?? '?'}%`);
    const potenciaDemandadaVA = dados.fatorPotencia > 0 ? (calculos.potenciaDemandada / dados.fatorPotencia).toFixed(2) : "0.00";
    addL("Potência Demandada:", `${potenciaDemandadaVA} VA (${calculos.potenciaDemandada?.toFixed(2) ?? '?'} W)`);
    addL("Fator de Potência:", dados.fatorPotencia);
    addL("Sistema de Fases:", dados.fases);
    addL("Tipo de Ligação:", dados.tipoLigacao);
    addL("Tensão (V):", `${dados.tensaoV ?? '?'} V`);
    addL("Comprimento:", `${dados.comprimentoM ?? '?'} m`);
    addL("Limite Queda de Tensão:", `${dados.limiteQuedaTensao ?? '?'}%`);
    yPos = getY() + 5; setY(yPos);

    addS("-- ESPECIFICAÇÕES DE INSTALAÇÃO E CORREÇÕES --");
    addL("Material / Isolação:", `${dados.materialCabo ?? '?'} / ${dados.tipoIsolacao ?? '?'}`);
    addL("Método de Instalação:", dados.metodoInstalacao);
    addL("Temperatura Ambiente:", `${dados.temperaturaAmbienteC ?? '?'}°C`);
    if (!isFeeder) { addL("Circuitos Agrupados:", dados.numCircuitosAgrupados); }
    if ((dados.resistividadeSolo ?? 0) > 0) { addL("Resist. do Solo (C.m/W):", dados.resistividadeSolo); }
    yPos = getY() + 5; setY(yPos);

    addS("-- RESULTADOS DE CÁLCULO E DIMENSIONAMENTO --");
    addL("Corrente de Projeto (Nominal):", `${calculos.correnteInstalada?.toFixed(2) ?? '?'} A`);
    addL("Corrente Demandada (Ib):", `${calculos.correnteDemandada?.toFixed(2) ?? '?'} A`);
    const fatorK1 = calculos.fatorK1 ?? 1; const fatorK2 = calculos.fatorK2 ?? 1; const fatorK3 = isFeeder ? 1 : (calculos.fatorK3 ?? 1);
    const fatorCorrecaoTotal = (fatorK1 * fatorK2 * fatorK3).toFixed(3);
    addL(`Fatores Correção (K1*K2${isFeeder ? '' : '*K3'}):`, `${fatorK1.toFixed(2)} * ${fatorK2.toFixed(2)}${isFeeder ? '' : ' * ' + fatorK3.toFixed(2)} = ${fatorCorrecaoTotal}`);
    const correnteCorrigidaTexto = isFinite(calculos.correnteCorrigidaA) ? `${calculos.correnteCorrigidaA.toFixed(2)} A` : "Incalculável";
    addL("Corrente Corrigida (I'z = Ib/Fator):", correnteCorrigidaTexto);
    addL("Bitola Recomendada (Seção):", `${calculos.bitolaRecomendadaMm2 ?? '?'} mm²`);
    addL("Capacidade Cabo (Iz = Cap.Nominal*Fator):", `${calculos.correnteMaximaCabo?.toFixed(2) ?? '?'} A`);

    const ib = calculos.correnteDemandada; const inom = parseFloat(calculos.disjuntorRecomendado?.nome); const iz = calculos.correnteMaximaCabo;
    const dvCalc = calculos.quedaTensaoCalculada; const dvLimit = dados.limiteQuedaTensao;
    const criterio1Ok = !isNaN(ib) && !isNaN(inom) && !isNaN(iz) && ib <= inom && inom <= iz;
    addL("Critério Disjuntor (Ib <= In <= Iz):", `${ib?.toFixed(2) ?? '?'}A <= ${calculos.disjuntorRecomendado?.nome ?? '?'} <= ${iz?.toFixed(2) ?? '?'}A ${criterio1Ok ? ' (OK)' : ' (FALHA)'}`);
    const criterioDvOk = !isNaN(dvCalc) && !isNaN(dvLimit) && dvCalc <= dvLimit;
    addL("Critério Queda Tensão (DV <= Limite):", `${dvCalc?.toFixed(2) ?? '?'}% <= ${dvLimit ?? '?'}% ${criterioDvOk ? ' (OK)' : ' (FALHA)'}`);
    yPos = getY() + 5; setY(yPos);

    addS("-- PROTEÇÕES RECOMENDADAS --");
    addL("Disjuntor:", `${dados.tipoDisjuntor ?? '?'}: ${calculos.disjuntorRecomendado?.nome ?? '?'} (Curva: ${calculos.disjuntorRecomendado?.curva || 'N/A'}, Icu: ${calculos.disjuntorRecomendado?.icc ?? '?'} kA)`);
    addL("Proteção DR:", dados.requerDR ? `Sim (${calculos.disjuntorRecomendado?.nome?.replace('A','') ?? '?'}A / 30mA)` : 'Não');
    addL("Proteção DPS:", getDpsText(dados.dpsInfo));
    addL("Eletroduto Recomendado:", calculos.dutoRecomendado ?? '?');
}

console.log("--- ui.js: Fim do arquivo ---"); // Log de Carregamento