// Arquivo: ui.js (Parte 1 de 2 - Lógica Otimizada)
import { ligacoes, BTU_TO_WATTS_FACTOR, CV_TO_WATTS_FACTOR, debounce } from './utils.js';
import { supabase } from './supabaseClient.js';

let circuitCount = 0;
let qdcCount = 0;
let uiData = null;
let tempOptions = { pvc: [], epr: [] };
export let loadedProjectData = null; 

// Armazena os dados brutos do projeto para permitir o cálculo sem carregar o DOM
export function setLoadedProjectData(projectData) {
    loadedProjectData = projectData;
}

// --- NOVO SISTEMA DE CÁLCULO LEVE (BACKEND) ---

// Coleta dados dos inputs (se visíveis) ou do backup em memória (se colapsados/lazy load)
export async function collectFormDataForCalculation() {
    const qdcsData = [];
    const circuitsData = [];
    const allQdcBlocks = document.querySelectorAll('#qdc-container .qdc-block');
    
    for (const qdcBlock of allQdcBlocks) {
        const qdcId = qdcBlock.dataset.id;
        const parentId = document.getElementById(`qdcParent-${qdcId}`)?.value || 'feeder';
        const fdQdc = document.getElementById(`qdcFatorDemanda-${qdcId}`)?.value || 100;

        qdcsData.push({
            id: qdcId,
            parentId: parentId,
            config: { fatorDemanda: fdQdc }
        });

        const circuitsInDom = qdcBlock.querySelectorAll('.circuit-block');
        if (circuitsInDom.length > 0) {
            // Se o usuário abriu o QDC, pegamos os valores em tempo real da tela
            circuitsInDom.forEach(c => {
                const cId = c.dataset.id;
                circuitsData.push({
                    qdcId: qdcId,
                    potenciaW: document.getElementById(`potenciaW-${cId}`)?.value || 0
                });
            });
        } else {
            // Se o QDC nunca foi aberto, pegamos do backup (evita travamento do DOM)
            const savedQdc = loadedProjectData?.qdcs_data?.find(q => String(q.id) === String(qdcId));
            if (savedQdc?.circuits) {
                savedQdc.circuits.forEach(c => {
                    const potW = c[`potenciaW-${c.id}`] || c.potenciaW || 0;
                    circuitsData.push({ qdcId: qdcId, potenciaW: potW });
                });
            }
        }
    }
    return { qdcsData, circuitsData };
}

// Função principal que atualiza os visores de potência usando a Edge Function
async function _internal_updateFeederPowerDisplay() {
    const feederPotInstaladaEl = document.getElementById('feederPotenciaInstalada');
    const feederSomaPotDemandadaEl = document.getElementById('feederSomaPotenciaDemandada');
    const feederPotDemandadaFinalEl = document.getElementById('feederPotenciaDemandada');
    const fdGeral = document.getElementById('feederFatorDemanda')?.value || 100;

    try {
        const { qdcsData, circuitsData } = await collectFormDataForCalculation();
        
        // Chama a função no servidor para não travar o navegador do usuário
        const { data, error } = await supabase.functions.invoke('calcular-totais', {
            body: { 
                qdcsData, 
                circuitsData, 
                feederFatorDemanda: fdGeral 
            }
        });

        if (error) throw error;

        // Atualiza Alimentador Geral
        if (feederPotInstaladaEl) feederPotInstaladaEl.value = data.geral.instalada.toFixed(2);
        if (feederSomaPotDemandadaEl) feederSomaPotDemandadaEl.value = data.geral.somaDemandada.toFixed(2);
        if (feederPotDemandadaFinalEl) feederPotDemandadaFinalEl.value = data.geral.final.toFixed(2);

        // Atualiza cada QDC visível
        Object.keys(data.qdcs).forEach(qdcId => {
            const potInstEl = document.getElementById(`qdcPotenciaInstalada-${qdcId}`);
            const potDemAgregadaEl = document.getElementById(`qdcPotenciaDemandada-${qdcId}`);
            if (potInstEl) potInstEl.value = data.qdcs[qdcId].instalada.toFixed(2);
            if (potDemAgregadaEl) potDemAgregadaEl.value = data.qdcs[qdcId].demandada.toFixed(2);
        });
    } catch (err) {
        console.error("Erro no cálculo remoto:", err);
    }
}

// Debounce maior para reduzir o número de requisições ao servidor enquanto digita
export const updateFeederPowerDisplay = debounce(_internal_updateFeederPowerDisplay, 600);

// --- CONFIGURAÇÕES DE DADOS TÉCNICOS ---

export function setupDynamicData(data) {
    uiData = data;
    if (uiData?.fatores_k1) {
        tempOptions.pvc = uiData.fatores_k1.map(f => f.temperatura_c).sort((a, b) => a - b);
    }
    if (uiData?.fatores_k1_epr) {
        tempOptions.epr = uiData.fatores_k1_epr.map(f => f.temperatura_c).sort((a, b) => a - b);
    }
}

// --- CONTROLE DE MODAIS E VISIBILIDADE ---

export function openModal(modalId) { 
    if (modalId === 'qdcManagerModalOverlay') populateQdcManagerModal();
    const m = document.getElementById(modalId); 
    if(m) m.style.display = 'flex'; 
}

export function closeModal(modalId) { 
    const m = document.getElementById(modalId); 
    if(m) m.style.display = 'none'; 
}

export function showAppView(userProfile) {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    const isAdmin = userProfile?.is_admin || false;
    document.getElementById('adminPanelBtn').style.display = isAdmin ? 'block' : 'none';
}

export function showLoginView() {
    document.getElementById('loginContainer').style.display = 'block';
    document.getElementById('appContainer').style.display = 'none';
}

export function resetForm(addDefault = true, client = null) {
    loadedProjectData = null;
    document.getElementById('main-form').reset();
    document.getElementById('feeder-form').reset();
    document.getElementById('qdc-container').innerHTML = '';
    
    if (client) {
        document.getElementById('clientLinkDisplay').textContent = `Cliente: ${client.nome} (${client.client_code || 'S/C'})`;
        document.getElementById('currentClientId').value = client.id;
    } else {
        document.getElementById('clientLinkDisplay').textContent = 'Cliente: Nenhum';
        document.getElementById('currentClientId').value = '';
    }
    
    if (addDefault) addQdcBlock();
    updateFeederPowerDisplay();
}
// Arquivo: ui.js (Parte 2 de 2 - Templates HTML e Interações)

// --- TEMPLATES HTML ORIGINAIS ---

function getQdcHTML(id, name = `QDC ${id}`, parentId = 'feeder') {
    // QDC inicia colapsado e com flag de circuitos não carregados
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
                 <div class="form-group"> <label>Instalada (Total)</label> <input type="text" id="qdcPotenciaInstalada-${id}" value="0.00" readonly> </div>
                 <div class="form-group"> <label>Demandada (Agregada)</label> <input type="text" id="qdcPotenciaDemandada-${id}" value="0.00" readonly style="color: #28a745; font-weight: bold;"> </div>
                 <div class="form-group"> <label for="qdcFatorDemanda-${id}">FD (%)</label> <input type="number" id="qdcFatorDemanda-${id}" value="100" step="1"> </div>
            </div>
            <h4 style="margin-top: 0; margin-bottom: 10px; color: var(--label-color);">Configuração do Alimentador</h4>
            <div class="form-grid qdc-config-grid">
                 <div class="form-group"> <label>Fases</label> <select id="qdcFases-${id}"> <option value="Monofasico">Monofásico</option> <option value="Bifasico">Bifásico</option> <option value="Trifasico" selected>Trifásico</option> </select> </div>
                 <div class="form-group"> <label>Ligação</label> <select id="qdcTipoLigacao-${id}"></select> </div>
                 <div class="form-group"> <label>Tensão (V)</label> <select id="qdcTensaoV-${id}"><option value="127">127</option><option value="220" selected>220</option><option value="380">380</option></select> </div>
                 <div class="form-group"> <label>Isolação</label> <select id="qdcTipoIsolacao-${id}"><option value="PVC" selected>PVC 70°C</option><option value="EPR">EPR 90°C</option></select> </div>
                 <div class="form-group"> <label>Comp. (m)</label> <input type="number" id="qdcComprimentoM-${id}" value="10"> </div>
                 <div class="form-group"> <label>Temp. Amb.</label> <select id="qdcTemperaturaAmbienteC-${id}"></select> </div>
            </div>
            <h4 style="margin-top: 20px; color: var(--label-color); border-top: 1px solid var(--border-color); padding-top: 15px;">Circuitos</h4>
            <div id="circuits-for-qdc-${id}" class="circuits-container-internal">
                 <p class="circuits-loading-placeholder" style="text-align:center; color:#888; display:none;">Carregando circuitos...</p>
            </div>
        </div>
    </div>`;
}

function getCircuitHTML(id) {
    return `
    <div class="circuit-block collapsed" id="circuit-${id}" data-id="${id}">
        <div class="circuit-header">
            <h3 class="circuit-header-left">Ckt <span class="circuit-number">${id}</span></h3>
            <h3 class="circuit-header-center" id="nomeCircuitoLabel-${id}">Circuito ${id}</h3>
            <div class="circuit-header-right">
                <button type="button" class="remove-circuit-btn btn-red" data-circuit-id="${id}">Remover</button>
                <span class="toggle-arrow">▼</span>
            </div>
        </div>
        <div class="circuit-content">
            <div class="form-grid">
                <div class="form-group"> <label>Nome</label> <input type="text" id="nomeCircuito-${id}" value="Circuito ${id}"> </div>
                <div class="form-group"> <label>Potência (W)</label> <input type="number" id="potenciaW-${id}" value="1000"> </div>
                <div class="form-group"> <label>Fases</label> <select id="fases-${id}"> <option value="Monofasico" selected>Monofásico</option> <option value="Bifasico">Bifásico</option> </select> </div>
            </div>
        </div>
    </div>`;
}

// --- LÓGICA DE RENDERIZAÇÃO E EVENTOS ---

export function addQdcBlock(id = null, name = null, parentId = 'feeder', container = null) {
    const isNewQdc = !id;
    let internalId = id ? String(id) : String(++qdcCount);
    if (!id) qdcCount = Math.max(qdcCount, parseInt(internalId));

    const newQdcDiv = document.createElement('div');
    newQdcDiv.innerHTML = getQdcHTML(internalId, name || `QDC ${internalId}`, parentId);
    
    const targetContainer = container instanceof DocumentFragment ? container : document.getElementById('qdc-container');
    targetContainer.appendChild(newQdcDiv.firstElementChild);

    if (!(container instanceof DocumentFragment)) {
        updateQdcParentDropdowns();
        if (isNewQdc) {
            addCircuit(internalId); // Adiciona circuito inicial se for novo
            const el = document.getElementById(`qdc-${internalId}`);
            el.classList.remove('collapsed');
            el.dataset.circuitsLoaded = 'true';
        }
        updateFeederPowerDisplay();
    }
    return internalId;
}

export function addCircuit(qdcId, savedData = null, container = null) {
    const id = savedData?.id || ++circuitCount;
    const div = document.createElement('div');
    div.innerHTML = getCircuitHTML(id);
    const circuitElement = div.firstElementChild;

    if (savedData) {
        // Restaura valores originais do seu objeto de banco de dados
        Object.keys(savedData).forEach(key => {
            const el = circuitElement.querySelector(`#${key}`) || circuitElement.querySelector(`#${key}-${id}`);
            if (el) el.value = savedData[key];
        });
    }

    const target = container || document.getElementById(`circuits-for-qdc-${qdcId}`);
    target.appendChild(circuitElement);
}

// --- LAZY LOADING: SÓ CARREGA CIRCUITOS QUANDO O USUÁRIO EXIBE O QUADRO ---

export async function ensureCircuitsLoaded(qdcBlock, qdcId) {
    if (qdcBlock.dataset.circuitsLoaded === 'true') return;
    
    const container = document.getElementById(`circuits-for-qdc-${qdcId}`);
    const placeholder = container.querySelector('.circuits-loading-placeholder');
    if(placeholder) placeholder.style.display = 'block';

    qdcBlock.dataset.circuitsLoaded = 'true';
    
    // Busca circuitos no objeto 'loadedProjectData' definido no Parte 1
    const savedQdc = loadedProjectData?.qdcs_data?.find(q => String(q.id) === String(qdcId));
    if (savedQdc?.circuits) {
        const fragment = document.createDocumentFragment();
        savedQdc.circuits.forEach(c => addCircuit(qdcId, c, fragment));
        container.appendChild(fragment);
    }
    
    if(placeholder) placeholder.style.display = 'none';
}

export function handleMainContainerInteraction(event) {
    const target = event.target;
    const qdcBlock = target.closest('.qdc-block');
    if (!qdcBlock) return;
    const qdcId = qdcBlock.dataset.id;

    if (target.classList.contains('toggle-circuits-btn')) {
        const isCollapsed = qdcBlock.classList.contains('collapsed');
        if (isCollapsed) {
            qdcBlock.classList.remove('collapsed');
            target.textContent = 'Ocultar Circuitos';
            ensureCircuitsLoaded(qdcBlock, qdcId);
        } else {
            qdcBlock.classList.add('collapsed');
            target.textContent = 'Exibir Circuitos';
        }
    }
}

export function updateQdcParentDropdowns() {
    // Mantido conforme original para gerenciar hierarquia
    const options = [{ value: 'feeder', text: 'Alimentador Geral' }];
    document.querySelectorAll('.qdc-block').forEach(q => {
        const id = q.dataset.id;
        const name = document.getElementById(`qdcName-${id}`)?.value || `QDC ${id}`;
        options.push({ value: `qdc-${id}`, text: name });
    });
    
    document.querySelectorAll('.qdc-parent-select').forEach(select => {
        const currentQdcId = select.closest('.qdc-block').dataset.id;
        const initialValue = select.dataset.initialParent || select.value;
        select.innerHTML = '';
        options.forEach(opt => {
            if (`qdc-${currentQdcId}` !== opt.value) {
                const o = document.createElement('option');
                o.value = opt.value; o.textContent = opt.text; select.appendChild(o);
            }
        });
        select.value = initialValue;
    });
}