// Arquivo: ui.js (Carga Hierárquica VISUAL e Debug Memorial)

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


// ========================================================================
// >>>>> FUNÇÃO REESCRITA: updateFeederPowerDisplay <<<<<
// Implementa cálculo e exibição hierárquica da carga DEMANDADA
// ========================================================================
function updateFeederPowerDisplay() {
    const qdcData = {}; // Armazena { installedDirect: number, demandedDirect: number, parentId: string, childrenIds: string[], aggregatedDemand: number }
    let totalInstalledGeneral = 0; // Instalada geral é sempre a soma direta

    // 1. Coleta dados diretos e estrutura hierárquica inicial
    document.querySelectorAll('.qdc-block').forEach(qdcBlock => {
        const qdcId = qdcBlock.dataset.id;
        let installedDirect = 0;
        let demandedDirect = 0;

        qdcBlock.querySelectorAll('.circuit-block').forEach(circuitBlock => {
            const id = circuitBlock.dataset.id;
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
        if (parentId !== 'feeder' && qdcData[parentId]) {
            qdcData[parentId].childrenIds.push(qdcId);
        }
    });

    // 3. Função recursiva para calcular a demanda agregada com memoização
    function calculateAggregatedDemand(qdcId) {
        if (!qdcData[qdcId]) return 0; // QDC não existe
        if (qdcData[qdcId].aggregatedDemand !== -1) { // Já calculado? Retorna cache
             return qdcData[qdcId].aggregatedDemand;
        }

        let aggregatedDemand = qdcData[qdcId].demandedDirect; // Começa com a carga direta

        // Soma a carga agregada de cada filho recursivamente
        qdcData[qdcId].childrenIds.forEach(childId => {
            aggregatedDemand += calculateAggregatedDemand(childId);
        });

        // Armazena o valor calculado
        qdcData[qdcId].aggregatedDemand = aggregatedDemand;
        return aggregatedDemand;
    }

    // 4. Calcula e atualiza a demanda agregada exibida para cada QDC
    let totalDemandAggregatedGeneral = 0;
    Object.keys(qdcData).forEach(qdcId => {
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
    const feederSomaPotDemandadaEl = document.getElementById('feederSomaPotenciaDemandada'); // Soma agregada ANTES do fator geral
    const feederFatorDemandaInput = document.getElementById('feederFatorDemanda');
    const feederPotDemandadaFinalEl = document.getElementById('feederPotenciaDemandada'); // Final, após fator geral

    if (feederPotInstaladaEl) feederPotInstaladaEl.value = totalInstalledGeneral.toFixed(2);
    if (feederSomaPotDemandadaEl) feederSomaPotDemandadaEl.value = totalDemandAggregatedGeneral.toFixed(2);

    const feederFatorDemanda = (parseFloat(feederFatorDemandaInput?.value) || 100) / 100.0; // Adiciona verificação
    const finalDemandGeral = totalDemandAggregatedGeneral * feederFatorDemanda;

    if (feederPotDemandadaFinalEl) feederPotDemandadaFinalEl.value = finalDemandGeral.toFixed(2);

    // Aviso sobre o cálculo real ainda ser plano
    console.warn("Aviso: A exibição da carga foi atualizada hierarquicamente, mas o dimensionamento pela Edge Function ainda opera de forma plana.");
}


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
    // HTML inalterado (com value="4" correto)
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

    const newQdcDiv = document.createElement('div');
    newQdcDiv.innerHTML = getQdcHTML(internalId, qdcName, parentId);
    const qdcElement = newQdcDiv.firstElementChild;

    const qdcContainer = document.getElementById('qdc-container');
    if(qdcContainer) qdcContainer.appendChild(qdcElement);

    const addCircuitBtn = qdcElement.querySelector('.add-circuit-to-qdc-btn');
    if (addCircuitBtn) {
        addCircuitBtn.addEventListener('click', (event) => {
            event.stopPropagation(); // Impede que o clique no botão colapse/expanda o QDC
            addCircuit(internalId);
        });
    } else {
        console.error(`Botão '+ Circuito' não encontrado para QDC ${internalId}`);
    }

    updateQdcParentDropdowns(); // Atualiza dropdowns DEPOIS de adicionar ao DOM
    initializeQdcListeners(internalId);

    // Colapsa QDCs adicionados (exceto o primeiro) OU se for carregado e não for o primeiro
    if ((isNewQdc && qdcCount > 1) || (!isNewQdc && qdcElement.previousElementSibling)) {
         if (!qdcElement.classList.contains('collapsed')) { // Evita adicionar múltiplas vezes
            qdcElement.classList.add('collapsed');
         }
    }

    // Adiciona um circuito inicial apenas se for um QDC *novo*
    if (isNewQdc) {
       addCircuit(internalId);
    }

    // Adiciona listener para recalcular cargas quando o parent mudar
    const parentSelect = qdcElement.querySelector('.qdc-parent-select');
    if(parentSelect) {
        parentSelect.addEventListener('change', updateFeederPowerDisplay);
    }


    return internalId;
}

export function removeQdc(qdcId) {
    const qdcBlock = document.getElementById(`qdc-${qdcId}`);
    if (qdcBlock) {
        const qdcNameInput = qdcBlock.querySelector('.qdc-name-input');
        const qdcName = qdcNameInput ? qdcNameInput.value : `QDC ${qdcId}`;
        if (confirm(`Remover QDC "${qdcName}" e todos os seus circuitos?`)) { // Mensagem mais clara
            qdcBlock.remove();
            updateQdcParentDropdowns();
            updateFeederPowerDisplay(); // Recalcula cargas após remover
        }
    }
}

export function updateQdcParentDropdowns() {
    const allQdcs = document.querySelectorAll('.qdc-block');
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
        parentSelect.innerHTML = ''; // Limpa opções antigas

        qdcOptions.forEach(opt => {
            // Um QDC não pode ser alimentado por ele mesmo
            if (opt.value !== `qdc-${currentQdcId}`) {
                // *** Adicionar lógica para evitar loops (um QDC alimentar seu próprio descendente) seria complexo aqui ***
                const option = document.createElement('option');
                option.value = opt.value;
                option.textContent = opt.text;
                parentSelect.appendChild(option);
            }
        });

        // Restaura a seleção anterior se ainda for válida
        if (Array.from(parentSelect.options).some(option => option.value === currentParentValue)) {
             parentSelect.value = currentParentValue;
        } else {
             parentSelect.value = 'feeder'; // Padrão se a opção anterior sumiu
        }

        delete parentSelect.dataset.initialParent; // Limpa o valor inicial após o primeiro preenchimento
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

    if (isNewCircuit) {
        circuitElement.classList.add('collapsed');
    }

    const circuitContainer = document.getElementById(`circuits-for-qdc-${qdcId}`);
    if (circuitContainer) {
        circuitContainer.appendChild(circuitElement);
        // Adiciona listener para recalcular cargas quando potência ou demanda mudar
        const powerInput = circuitElement.querySelector(`#potenciaW-${internalId}`);
        const demandInput = circuitElement.querySelector(`#fatorDemanda-${internalId}`);
        if(powerInput) powerInput.addEventListener('input', updateFeederPowerDisplay);
        if(demandInput) demandInput.addEventListener('input', updateFeederPowerDisplay);

    } else {
        console.error(`Circuit container for QDC ${qdcId} not found! Cannot add circuit.`);
        return;
    }

    // Preenche dados se existirem
    if (savedCircuitData) {
        Object.keys(savedCircuitData).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                if (element.type === 'checkbox') { element.checked = !!savedCircuitData[key]; } // Garante boolean
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
    atualizarLigacoes(internalId); // Fases -> Ligação
    handleInsulationChange(internalId); // Isolação -> Temp Ambiente
    handleCircuitTypeChange(internalId); // Tipo -> Visibilidade BTU/CV

    const potenciaBTUSelect = document.getElementById(`potenciaBTU-${internalId}`);
    const potenciaCVSelect = document.getElementById(`potenciaCV-${internalId}`);
    const resistividadeSolo = document.getElementById(`resistividadeSolo-${internalId}`);
    //const temperaturaAmbiente = document.getElementById(`temperaturaAmbienteC-${internalId}`); // Já populado por handleInsulationChange

    if(uiData) {
        populateBtuDropdown(potenciaBTUSelect, uiData.ar_condicionado_btu);
        populateCvDropdown(potenciaCVSelect, uiData.motores_cv);
        populateSoilResistivityDropdown(resistividadeSolo, uiData.fatores_k2);
        // populateTemperatureDropdown já foi chamado
    }

    // Restaura valores específicos após dropdowns serem populados
     if (savedCircuitData) {
        if(potenciaBTUSelect && savedCircuitData[`potenciaBTU-${internalId}`]) potenciaBTUSelect.value = savedCircuitData[`potenciaBTU-${internalId}`];
        if(potenciaCVSelect && savedCircuitData[`potenciaCV-${internalId}`]) potenciaCVSelect.value = savedCircuitData[`potenciaCV-${internalId}`];
        if(resistividadeSolo && savedCircuitData[`resistividadeSolo-${internalId}`]) resistividadeSolo.value = savedCircuitData[`resistividadeSolo-${internalId}`];

        // Restaura ligação e temperatura se existirem nos dados salvos
        const tipoLigacaoSelect = document.getElementById(`tipoLigacao-${internalId}`);
        if(tipoLigacaoSelect && savedCircuitData[`tipoLigacao-${internalId}`]) {
            tipoLigacaoSelect.value = savedCircuitData[`tipoLigacao-${internalId}`];
        }
        const temperaturaAmbiente = document.getElementById(`temperaturaAmbienteC-${internalId}`);
        if(temperaturaAmbiente && savedCircuitData[`temperaturaAmbienteC-${internalId}`]) {
             temperaturaAmbiente.value = savedCircuitData[`temperaturaAmbienteC-${internalId}`];
        }
    }
     // Não precisa do 'else' aqui, pois handleInsulationChange já define um valor padrão
}


export function removeCircuit(circuitId) {
    const circuitBlock = document.getElementById(`circuit-${circuitId}`);
    if (circuitBlock) {
        circuitBlock.remove();
        updateFeederPowerDisplay(); // Recalcula cargas após remover
    }
}

function getCircuitHTML(id) {
    // HTML inalterado (com value="4" correto)
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

    if (uiData) { populateSoilResistivityDropdown(resistividadeSolo, uiData.fatores_k2); }

    const atualizarLigacoesFeeder = () => { if(!fases || !tipoLigacao) return; const f = fases.value; const l = ligacoes[f] || []; tipoLigacao.innerHTML = ''; l.forEach(o => { const op = document.createElement('option'); op.value = o.value; op.textContent = o.text; tipoLigacao.appendChild(op); }); };
    const handleFeederInsulationChange = () => { if(!tipoIsolacao || !temperaturaAmbiente) return; const sel = tipoIsolacao.value; const t = (sel === 'EPR' || sel === 'XLPE') ? tempOptions.epr : tempOptions.pvc; populateTemperatureDropdown(temperaturaAmbiente, t); };

    if(fases) fases.addEventListener('change', atualizarLigacoesFeeder);
    if(tipoIsolacao) tipoIsolacao.addEventListener('change', handleFeederInsulationChange);
    // Atualiza display geral quando fator de demanda geral muda
    if(fatorDemanda) fatorDemanda.addEventListener('input', updateFeederPowerDisplay);

    atualizarLigacoesFeeder();
    handleFeederInsulationChange();
}


// Funções para os Listeners dos campos do QDC
function initializeQdcListeners(id) {
    const qdcBlock = document.getElementById(`qdc-${id}`);
    if (!qdcBlock) return;

    const fases = qdcBlock.querySelector(`#qdcFases-${id}`);
    const tipoIsolacao = qdcBlock.querySelector(`#qdcTipoIsolacao-${id}`);
    const temperaturaAmbiente = qdcBlock.querySelector(`#qdcTemperaturaAmbienteC-${id}`);
    const resistividadeSolo = qdcBlock.querySelector(`#qdcResistividadeSolo-${id}`);
    const fatorDemandaQDC = qdcBlock.querySelector(`#qdcFatorDemanda-${id}`); // Listener para demanda do QDC

    if (uiData) {
        populateSoilResistivityDropdown(resistividadeSolo, uiData.fatores_k2);
    }

    if(fases) fases.addEventListener('change', () => atualizarQdcLigacoes(id));
    if(tipoIsolacao) tipoIsolacao.addEventListener('change', () => handleQdcInsulationChange(id));
    // Atualiza display GERAL se o fator de demanda de um QDC mudar (afeta agregação)
    if(fatorDemandaQDC) fatorDemandaQDC.addEventListener('input', updateFeederPowerDisplay);


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
    const btuInput = document.getElementById(`potenciaBTU-${id}`);
    const cvInput = document.getElementById(`potenciaCV-${id}`);

    if (type === 'btu' && btuInput) {
        const btu = parseFloat(btuInput.value) || 0;
        pW.value = (btu * BTU_TO_WATTS_FACTOR).toFixed(2);
    } else if (type === 'cv' && cvInput) {
        const cv = parseFloat(cvInput.value) || 0;
        pW.value = (cv * CV_TO_WATTS_FACTOR).toFixed(2);
    }
     // Recalcula display geral após mudança de potência
    updateFeederPowerDisplay();
}


// handleMainContainerInteraction SEM a lógica do addCircuitBtn
export function handleMainContainerInteraction(event) {
    const target = event.target;

    // --- Lógica de QDC (Remover, Colapsar, Renomear, E NOVOS CAMPOS) ---
    const qdcBlock = target.closest('.qdc-block');
    if (qdcBlock) {
        const qdcId = qdcBlock.dataset.id;

        const removeQdcButton = target.closest('.remove-qdc-btn');
        if (removeQdcButton) {
            const idParaRemover = removeQdcButton.dataset.qdcId || qdcId;
            removeQdc(idParaRemover);
            return;
        }

        if (target.classList.contains('qdc-name-input') && event.type === 'input') {
            updateQdcParentDropdowns(); // Atualiza nomes nos dropdowns
            return; // Evita colapsar ao digitar nome
        }
        if (target.classList.contains('qdc-parent-select') && event.type === 'change') {
             updateFeederPowerDisplay(); // Recalcula cargas se o parent mudar
             return; // Evita colapsar
        }


        // Gatilhos para campos internos (isolacao, fases) - não precisam de return
        if (target.id === `qdcFases-${qdcId}`) {
            atualizarQdcLigacoes(qdcId);
        } else if (target.id === `qdcTipoIsolacao-${qdcId}`) {
            handleQdcInsulationChange(qdcId);
        }

        // Lógica de Colapsar/Expandir QDC (Apenas se clicar no header, fora de inputs/selects/botões)
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

        // Lógica de Colapsar/Expandir Circuito (Apenas no header, fora do botão remover)
        const circuitHeader = target.closest('.circuit-header');
        if (circuitHeader && !target.closest('.remove-circuit-btn')) {
            circuitBlock.classList.toggle('collapsed');
            // Não retorna, pois pode haver interação interna no header
        }

        // Lógica de Ações *dentro* do Circuito
        if (target.id === `nomeCircuito-${circuitId}` && event.type === 'input') {
            const lbl = document.getElementById(`nomeCircuitoLabel-${circuitId}`);
            if(lbl) lbl.textContent = target.value || `Circuito ${circuitId}`; // Nome padrão se vazio
        }

        const removeCircuitButton = target.closest('.remove-circuit-btn');
        if (removeCircuitButton) {
            removeCircuit(removeCircuitButton.dataset.circuitId || circuitId);
        }
        // Listener de mudança para dropdowns/inputs que afetam outros campos ou cálculos
        else if (target.id === `tipoCircuito-${circuitId}`) { handleCircuitTypeChange(circuitId); }
        else if (target.id === `fases-${circuitId}`) { atualizarLigacoes(circuitId); }
        else if (target.id === `tipoIsolacao-${circuitId}`) { handleInsulationChange(circuitId); }
        else if (target.id === `potenciaBTU-${circuitId}` || target.id === `potenciaCV-${circuitId}`) {
             handlePowerUnitChange(circuitId, target.id.includes('BTU') ? 'btu' : 'cv');
        }
        // Recalcula display GERAL se potência ou demanda do circuito mudar (já adicionado em addCircuit tbm)
        // else if (target.id === `potenciaW-${circuitId}` || target.id === `fatorDemanda-${circuitId}`) {
        //     updateFeederPowerDisplay();
        // }
    }
}


function atualizarLigacoes(id) {
    const fasesSelect = document.getElementById(`fases-${id}`);
    const tipoLigacaoSelect = document.getElementById(`tipoLigacao-${id}`);
    if (!fasesSelect || !tipoLigacaoSelect) return;
    const f = fasesSelect.value; const l = ligacoes[f] || [];
    const currentValue = tipoLigacaoSelect.value; // Guarda valor atual
    tipoLigacaoSelect.innerHTML = '';
    l.forEach(o => { const op = document.createElement('option'); op.value = o.value; op.textContent = o.text; tipoLigacaoSelect.appendChild(op); });
    // Tenta restaurar valor se ainda existir
    if (l.some(o => o.value === currentValue)) {
        tipoLigacaoSelect.value = currentValue;
    }
}

function handleInsulationChange(id) {
    const tipoIsolacaoSelect = document.getElementById(`tipoIsolacao-${id}`);
    const tempAmbSelect = document.getElementById(`temperaturaAmbienteC-${id}`);
    if (!tipoIsolacaoSelect || !tempAmbSelect) return;
    const sel = tipoIsolacaoSelect.value; const t = (sel === 'EPR' || sel === 'XLPE') ? tempOptions.epr : tempOptions.pvc;
    populateTemperatureDropdown(tempAmbSelect, t); // Popula e define valor padrão
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
    btuG.classList.add('hidden');
    cvG.classList.add('hidden');
    pw.readOnly = false;
    // fd.readOnly = false; // Fator de demanda pode ser sempre editável?

    if (selType === 'ar_condicionado') {
        btuG.classList.remove('hidden');
        pw.readOnly = true;
        // Calcula W baseado no BTU selecionado (se houver)
        handlePowerUnitChange(id, 'btu');
    } else if (selType === 'motores') {
        cvG.classList.remove('hidden');
        pw.readOnly = true;
         // Calcula W baseado no CV selecionado (se houver)
        handlePowerUnitChange(id, 'cv');
    } else if (selType === 'aquecimento') {
        // Norma pode exigir 100% para aquecimento?
        // if (fd.value !== '100') { fd.value = '100'; }
        // fd.readOnly = true; // Ou apenas sugerir 100%?
    }
     // Recalcula display geral após mudança de tipo (pode afetar demanda)
    updateFeederPowerDisplay();
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
function getDpsText(dpsInfo) { if (!dpsInfo) return 'Não'; return `Sim, Classe ${dpsInfo.classe} (${dpsInfo.corrente_ka} kA)`; }
function drawHeader(x, y, projectData, totalPower) { const t = projectData?.obra || "Diagrama"; const p = `(${totalPower?.toFixed(2) || 0} W)`; return `<g text-anchor="end"> <text x="${x}" y="${y}" style="font-family: Arial; font-size: 16px; font-weight: bold;">Q.D. ${t.toUpperCase()}</text> <text x="${x}" y="${y + 15}" style="font-family: Arial; font-size: 12px;">${p}</text> </g>`; }
function drawDisjuntor(x, y, text, fases = 'Monofasico') { let sP=''; switch(fases){ case 'Trifasico':sP=`<path d="M ${x-5} ${y-2} q 5 -10 10 0 M ${x-5} ${y+2} q 5 -10 10 0 M ${x-5} ${y+6} q 5 -10 10 0" stroke="black" stroke-width="1.5" fill="none"/>`;break; case 'Bifasico':sP=`<path d="M ${x-5} ${y} q 5 -10 10 0 M ${x-5} ${y+4} q 5 -10 10 0" stroke="black" stroke-width="1.5" fill="none"/>`;break; default:sP=`<path d="M ${x-5} ${y+2} q 5 -10 10 0" stroke="black" stroke-width="1.5" fill="none"/>`;break;} return `<g text-anchor="middle"> <circle cx="${x-12.5}" cy="${y}" r="1.5" fill="black"/> <circle cx="${x+12.5}" cy="${y}" r="1.5" fill="black"/> ${sP} <text x="${x}" y="${y-18}" style="font-family: Arial; font-size: 11px;">${text||'?'}</text> </g>`; } // Adicionado '?' para texto nulo
function drawDR(x, y, text, fases = 'Monofasico') { const dC='#27ae60'; let iS=''; if(fases==='Trifasico'){iS=`<path d="M ${x-4} ${y-5} v 10 M ${x} ${y-5} v 10 M ${x+4} ${y-5} v 10 M ${x-4} ${y-5} h 8" stroke="${dC}" stroke-width="1" fill="none"/>`;} else {iS=`<path d="M ${x} ${y-5} v 10 M ${x-3} ${y-5} h 6" stroke="${dC}" stroke-width="1" fill="none"/>`;} return `<g text-anchor="middle"> <rect x="${x-12.5}" y="${y-12.5}" width="25" height="25" stroke="${dC}" stroke-width="1.5" fill="white"/> <text x="${x}" y="${y-18}" style="font-family: Arial; font-size: 10px; fill:${dC};">${text||'?'}</text> <text x="${x}" y="${y+4}" style="font-family: Arial; font-size: 11px; font-weight: bold; fill:${dC};">DR</text> ${iS} </g>`; }
function drawDPS(x, y, feederData) { if (!feederData) return ''; const dC='#27ae60'; let n=feederData.fases==='Monofasico'?2:(feederData.fases==='Bifasico'?3:4); const dI=feederData.dpsInfo; const t=dI?`${n}x DPS Cl.${dI.classe} ${dI.corrente_ka}kA`:`${n}x DPS`; return `<g> <rect x="${x-45}" y="${y-12.5}" width="90" height="25" stroke="${dC}" stroke-width="1.5" fill="white"/> <text x="${x}" y="${y+4}" text-anchor="middle" style="font-family: Arial; font-size: 10px; fill:${dC};">${t}</text> <line x1="${x}" y1="${y+12.5}" x2="${x}" y2="${y+30}" stroke="black" stroke-width="1"/> ${drawGroundSymbol(x,y+30)} </g>`; }
function drawGroundSymbol(x, y) { return `<line x1="${x}" y1="${y}" x2="${x}" y2="${y+5}" stroke="black" stroke-width="1"/> <line x1="${x-8}" y1="${y+5}" x2="${x+8}" y2="${y+5}" stroke="black" stroke-width="1.5"/> <line x1="${x-5}" y1="${y+8}" x2="${x+5}" y2="${y+8}" stroke="black" stroke-width="1.5"/> <line x1="${x-2}" y1="${y+11}" x2="${x+2}" y2="${y+11}" stroke="black" stroke-width="1.5"/>`; }
function drawConductorSymbol(x, y, numConductors = 0) { let p=''; for(let i=0;i<numConductors;i++){p+=` M ${x-5} ${y+5+(i*4)} l 10 -5`;} return `<path d="${p}" stroke="black" stroke-width="1" fill="none"/>`; }
function drawCircuitLine(result, x, y, index) { const {dados,calculos}=result || {}; if(!dados || !calculos) return ''; const yE=y+250; const fS=`font-family: Arial;`; return `<g text-anchor="middle"> ${drawDisjuntor(x,y,`${calculos.disjuntorRecomendado?.nome || '?'}`,dados.fases)} <line x1="${x}" y1="${y+12.5}" x2="${x}" y2="${yE}" stroke="black" stroke-width="1"/> ${drawConductorSymbol(x,y+60,calculos.numCondutores)} <text x="${x}" y="${y+90}" style="${fS} font-size: 11px;">${calculos.bitolaRecomendadaMm2||'?'}</text> <text x="${x}" y="${yE+20}" style="${fS} font-size: 11px; font-weight: bold;">(${calculos.potenciaDemandada?.toFixed(0) || 0} W)</text> <text x="${x}" y="${yE+35}" style="${fS} font-size: 12px;">${index} - ${dados.nomeCircuito||'?'}</text> </g>`; }


function buildUnifilarSvgString(calculationResults) {
    if (!calculationResults || !calculationResults.feederResult || !calculationResults.circuitResults) return null;

    const { feederResult, circuitResults } = calculationResults;
    const allCircuits = circuitResults || [];
    if (!feederResult || allCircuits.length === 0) return null; // Precisa do feeder e pelo menos 1 circuito

    // Filtra circuitos com dados válidos para desenhar
    const validCircuits = allCircuits.filter(c => c && c.dados && c.calculos);
    if (validCircuits.length === 0) return null; // Nenhum circuito válido para desenhar

    const circuitsComDR = validCircuits.filter(c => c.dados.requerDR);
    const circuitsSemDR = validCircuits.filter(c => !c.dados.requerDR);
    const categorizedCircuits = {};
    circuitsComDR.forEach(c => { let t=c.dados.tipoCircuito; if(t==='tue'&&(c.dados.nomeCircuito?.toLowerCase().includes('chuveiro')||c.calculos.potenciaDemandada>4000)){t='tue_potencia';} if(!categorizedCircuits[t]) categorizedCircuits[t]=[]; categorizedCircuits[t].push(c); });
    const finalGroups = [];
    const groupOrder = ['iluminacao', 'tug', 'tue', 'tue_potencia', 'ar_condicionado', 'motores', 'aquecimento'];
    groupOrder.forEach(cat => { if(categorizedCircuits[cat]){ const cT=categorizedCircuits[cat]; const cS=(cat==='iluminacao')?8:5; for(let i=0;i<cT.length;i+=cS){ const chunk=cT.slice(i,i+cS); const isHP=chunk.some(c=>c.calculos.potenciaDemandada>=4000); const drC=isHP?'63A':'40A'; finalGroups.push({dr:{corrente:drC,sensibilidade:'30mA'},circuits:chunk}); } } });
    if (circuitsSemDR.length > 0) { finalGroups.push({ dr: null, circuits: circuitsSemDR }); }

    const yS=40, yB=yS+150, cW=100, mL=60;
    const totalCircuitsToDraw = validCircuits.length; // Usa o total de circuitos VÁLIDOS
    const sW=(totalCircuitsToDraw*cW)+mL*2;
    const sH=600; // Altura fixa

    let svgParts=[`<svg width="${sW}" height="${sH}" xmlns="http://www.w3.org/2000/svg">`];
    svgParts.push(drawHeader(sW-20,yS,feederResult.dados,feederResult.calculos.potenciaDemandada));

    let currentX=mL;
    svgParts.push(`<line x1="${currentX}" y1="${yS}" x2="${currentX}" y2="${yB-50}" stroke="black" stroke-width="2"/>`);
    svgParts.push(drawDisjuntor(currentX,yB-50,`${feederResult.calculos.disjuntorRecomendado?.nome || '?'}`,feederResult.dados?.fases));
    svgParts.push(`<line x1="${currentX}" y1="${yB-37.5}" x2="${currentX}" y2="${yB}" stroke="black" stroke-width="2"/>`);
    if(feederResult.dados?.dpsClasse){ // Verifica se dpsClasse existe
        svgParts.push(`<line x1="${currentX}" y1="${yB-100}" x2="${currentX+50}" y2="${yB-100}" stroke="black" stroke-width="1"/>`);
        svgParts.push(drawDPS(currentX+95,yB-100,feederResult.dados));
    }
    svgParts.push(drawGroundSymbol(mL+(totalCircuitsToDraw*cW)/2,sH-40)); // Posição do terra baseada nos circuitos desenhados

    const barraStartX=mL;
    const barraEndX=barraStartX+totalCircuitsToDraw*cW;
    svgParts.push(`<line x1="${barraStartX}" y1="${yB}" x2="${barraEndX}" y2="${yB}" stroke="black" stroke-width="5"/>`); // Barra principal

    currentX+=(cW/2); // Começa a desenhar a partir do centro do primeiro espaço de circuito
    let circuitIndex=1; // Numeração sequencial geral no diagrama

    finalGroups.forEach(group => {
        const groupWidth = group.circuits.length * cW;
        const groupStartX = currentX - (cW / 2); // Início do grupo

        if(group.dr){
            const isGroupTrifasico=group.circuits.some(c=>c.dados.fases==='Trifasico');
            const drFases = isGroupTrifasico ? 'Trifasico' : 'Monofasico'; // Ajusta DR para trifásico se necessário
            const drCenterX = groupStartX + groupWidth / 2;

            svgParts.push(`<line x1="${drCenterX}" y1="${yB}" x2="${drCenterX}" y2="${yB+40}" stroke="black" stroke-width="1"/>`); // Linha Barra -> DR
            svgParts.push(`<circle cx="${drCenterX}" cy="${yB}" r="3" fill="black"/>`); // Conexão na barra
            svgParts.push(drawDR(drCenterX,yB+40,`${group.dr.corrente}/${group.dr.sensibilidade}`, drFases));

            const subBarY=yB+65; // Posição Y da sub-barra
            // Desenha sub-barra apenas se houver mais de um circuito no grupo
            if (group.circuits.length > 1) {
                 svgParts.push(`<line x1="${groupStartX+cW/2}" y1="${subBarY}" x2="${groupStartX+groupWidth-cW/2}" y2="${subBarY}" stroke="black" stroke-width="3"/>`); // Sub-barra
            } else {
                 // Se for só um circuito, conecta o DR direto à linha do circuito
                 svgParts.push(`<line x1="${drCenterX}" y1="${yB+52.5}" x2="${drCenterX}" y2="${subBarY+15}" stroke="black" stroke-width="1"/>`);
            }


           // svgParts.push(`<rect x="${groupStartX}" y="${yB+10}" width="${groupWidth}" height="350" fill="none" stroke="lightgrey" stroke-dasharray="5,5"/>`); // Caixa tracejada opcional

            group.circuits.forEach(result=>{
                // Conecta da sub-barra (ou do DR se for único) ao disjuntor do circuito
                 if (group.circuits.length > 1) {
                    svgParts.push(`<line x1="${currentX}" y1="${subBarY}" x2="${currentX}" y2="${subBarY+15}" stroke="black" stroke-width="1"/>`);
                    svgParts.push(`<circle cx="${currentX}" cy="${subBarY}" r="3" fill="black"/>`); // Conexão na sub-barra
                 }
                svgParts.push(drawCircuitLine(result,currentX,subBarY+15, circuitIndex++)); // Desenha linha e info do circuito
                currentX+=cW; // Move para a próxima posição
            });
        } else { // Circuitos sem DR
            group.circuits.forEach(result=>{
                svgParts.push(`<line x1="${currentX}" y1="${yB}" x2="${currentX}" y2="${yB+15}" stroke="black" stroke-width="1"/>`); // Linha Barra -> Disjuntor
                svgParts.push(`<circle cx="${currentX}" cy="${yB}" r="3" fill="black"/>`); // Conexão na barra
                svgParts.push(drawCircuitLine(result,currentX,yB+15, circuitIndex++)); // Desenha linha e info do circuito
                currentX+=cW; // Move para a próxima posição
            });
        }
    });

    svgParts.push('</svg>');
    return svgParts.join('');
}


export async function generateUnifilarPdf(calculationResults) {
    const svgString = buildUnifilarSvgString(calculationResults);
    if (!svgString) { alert("Dados insuficientes ou inválidos para gerar Diagrama Unifilar."); return; }
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a3'); // Paisagem A3

        // Usa Canvg para renderizar SVG em um Canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Adiciona um SVG temporário ao DOM para obter dimensões corretas
        const tempSvg = document.createElement('div');
        tempSvg.innerHTML = svgString;
        document.body.appendChild(tempSvg);
        const svgElement = tempSvg.querySelector('svg');
        const svgWidth = parseFloat(svgElement.getAttribute('width'));
        const svgHeight = parseFloat(svgElement.getAttribute('height'));
        document.body.removeChild(tempSvg);

        if (!svgWidth || !svgHeight) {
             throw new Error("Não foi possível determinar as dimensões do SVG.");
        }


        canvas.width = svgWidth;
        canvas.height = svgHeight;

        // Renderiza o SVG no canvas com Canvg
        const v = await Canvg.fromString(ctx, svgString, { ignoreMouse: true, ignoreAnimation: true });
        await v.render();

        const imgData = canvas.toDataURL('image/png'); // Converte canvas para PNG

        // Calcula dimensões e posição no PDF A3 paisagem (420 x 297 mm)
        const pdfW = doc.internal.pageSize.getWidth(); // ~420
        const pdfH = doc.internal.pageSize.getHeight(); // ~297
        const margin = 10; // Margem de 10mm
        const availableW = pdfW - (margin * 2);
        const availableH = pdfH - (margin * 2);

        let imgW = availableW;
        let imgH = (svgHeight / svgWidth) * imgW;

        // Se a altura calculada exceder a altura disponível, ajusta pela altura
        if (imgH > availableH) {
            imgH = availableH;
            imgW = (svgWidth / svgHeight) * imgH;
        }

        // Centraliza a imagem
        const xPos = (pdfW - imgW) / 2;
        const yPos = (pdfH - imgH) / 2;

        doc.addImage(imgData, 'PNG', xPos, yPos, imgW, imgH);
        doc.save(`Unifilar_${document.getElementById('obra')?.value || 'Projeto'}.pdf`);
    } catch (e) {
        console.error("Erro ao gerar PDF Unifilar:", e);
        alert("Erro ao gerar PDF Unifilar: " + e.message);
    }
}


// generateMemorialPdf com debug logs e agrupamento
export function generateMemorialPdf(calculationResults, currentUserProfile) {
    if (!calculationResults) { alert("Execute o cálculo primeiro."); return; }

    const { feederResult, circuitResults } = calculationResults;
     // Permite gerar mesmo sem circuitos, só com o alimentador
    if (!feederResult) { alert("Dados do alimentador geral ausentes. Não é possível gerar Memorial."); return;}

    console.log("--- Debugging generateMemorialPdf ---");
    console.log("Feeder Result Dados:", feederResult?.dados);
    console.log("Circuit Results Received:", circuitResults); // Log completo
    if (circuitResults && circuitResults.length > 0) {
        console.log("Checking for qdcId in first circuit:", circuitResults[0]?.dados?.qdcId);
        console.log("Data type of qdcId in first circuit:", typeof circuitResults[0]?.dados?.qdcId);
    }

    const circuitsByQdc = {};
    if (circuitResults && Array.isArray(circuitResults)) { // Verifica se é array
        circuitResults.forEach(result => {
            if (result && result.dados && (result.dados.qdcId !== undefined && result.dados.qdcId !== null)) { // Verifica se qdcId existe
                const qdcId = String(result.dados.qdcId); // Garante que seja string
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
    const addL = (l, v) => { if (yPos > 270) { doc.addPage(); yPos = 20; } doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text(l, lM, yPos); doc.setFont('helvetica', 'normal'); doc.text(String(v ?? '-'), vM, yPos); yPos += 6; }; // Usa ?? para tratar null/undefined

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
    addL("Nome:", document.getElementById('respTecnico')?.value); // Adiciona ?
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
         // Poderia adicionar tabela para eles aqui se quisesse
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
    const { dados, calculos } = result || {}; // Usa objeto vazio se result for nulo
    if (!dados || !calculos) {
        console.error("Dados ou Cálculos ausentes para gerar página do memorial:", titlePrefix, result);
        addT(`ERRO - ${titlePrefix}`);
        addS("Não foi possível gerar os detalhes. Dados ausentes.");
        return;
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