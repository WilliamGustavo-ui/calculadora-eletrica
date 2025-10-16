// Arquivo: ui.js

import { ligacoes, BTU_TO_WATTS_FACTOR, CV_TO_WATTS_FACTOR } from './utils.js';
import { Canvg } from 'https://cdn.skypack.dev/canvg';

let circuitCount = 0;

// Não são mais necessários dados técnicos no front-end
export function setupDynamicData(techData) {
    // Função mantida para compatibilidade, mas não precisa fazer nada.
}

function updateFeederPowerDisplay() {
    let totalInstalada = 0;
    let totalDemandada = 0;
    const circuitBlocks = document.querySelectorAll('#circuits-container .circuit-block');
    circuitBlocks.forEach(block => {
        const id = block.dataset.id;
        const potenciaW = parseFloat(document.getElementById(`potenciaW-${id}`).value) || 0;
        const fatorDemanda = parseFloat(document.getElementById(`fatorDemanda-${id}`).value) || 100;
        totalInstalada += potenciaW;
        totalDemandada += potenciaW * (fatorDemanda / 100);
    });
    document.getElementById('feederPotenciaInstalada').value = totalInstalada.toFixed(2);
    document.getElementById('feederPotenciaDemandada').value = totalDemandada.toFixed(2);
}

// --- FUNÇÕES DE VISIBILIDADE E MODAIS (Inalteradas) ---
export function showLoginView() { document.getElementById('loginContainer').style.display = 'block'; document.getElementById('appContainer').style.display = 'none'; document.getElementById('resetPasswordContainer').style.display = 'none'; }
export function showAppView(userProfile) { document.getElementById('loginContainer').style.display = 'none'; document.getElementById('appContainer').style.display = 'block'; document.getElementById('resetPasswordContainer').style.display = 'none'; const isAdmin = userProfile?.is_admin || false; document.getElementById('adminPanelBtn').style.display = isAdmin ? 'block' : 'none'; document.getElementById('manageClientsBtn').style.display = 'block'; document.getElementById('manageProjectsBtn').style.display = 'block'; }
export function showResetPasswordView() { document.getElementById('loginContainer').style.display = 'none'; document.getElementById('appContainer').style.display = 'none'; document.getElementById('resetPasswordContainer').style.display = 'block'; }
export function openModal(modalId) { document.getElementById(modalId).style.display = 'flex'; }
export function closeModal(modalId) { document.getElementById(modalId).style.display = 'none'; }


// --- LÓGICA DE FORMULÁRIO E CIRCUITOS (Com nova UI) ---
export function resetForm(addFirst = true, linkedClient = null) {
    document.getElementById('main-form').reset();
    document.getElementById('tech-form').reset();
    document.getElementById('feeder-form').reset();
    document.getElementById('currentProjectId').value = '';
    document.getElementById('circuits-container').innerHTML = '';
    document.getElementById('report').textContent = 'O relatório aparecerá aqui.';
    document.getElementById('searchInput').value = '';
    const unifilarContainer = document.getElementById('unifilar-drawing');
    if (unifilarContainer) unifilarContainer.innerHTML = '';

    const clientLinkDisplay = document.getElementById('clientLinkDisplay');
    const currentClientIdInput = document.getElementById('currentClientId');
    if (linkedClient) {
        clientLinkDisplay.textContent = `Cliente Vinculado: ${linkedClient.nome} (${linkedClient.client_code})`;
        currentClientIdInput.value = linkedClient.id;
    } else {
        clientLinkDisplay.textContent = 'Cliente: Nenhum';
        currentClientIdInput.value = '';
    }

    initializeFeederListeners();
    circuitCount = 0;
    if (addFirst) {
        addCircuit();
    } else {
        updateFeederPowerDisplay();
    }
}

export function addCircuit() {
    circuitCount++;
    const newCircuitDiv = document.createElement('div');
    newCircuitDiv.innerHTML = getCircuitHTML(circuitCount);
    document.getElementById('circuits-container').appendChild(newCircuitDiv.firstElementChild);
    
    atualizarLigacoes(circuitCount);
    handleCircuitTypeChange(circuitCount);
}

export function removeCircuit(id) {
    document.getElementById(`circuit-${id}`)?.remove();
    updateFeederPowerDisplay();
}

function getCircuitHTML(id) {
    // >>>>>>>>>>>> NOVA ESTRUTURA DO CABEÇALHO <<<<<<<<<<<<<<
    return `<div class="circuit-block" id="circuit-${id}" data-id="${id}">
        <div class="circuit-header">
            <h3 class="circuit-header-left">Circuito <span class="circuit-number"></span></h3>
            <h3 class="circuit-header-center" id="nomeCircuitoLabel-${id}">Circuito ${id}</h3>
            <div class="circuit-header-right">
                <button type="button" class="remove-btn btn-danger" data-circuit-id="${id}">Remover</button>
                <span class="toggle-arrow">▼</span>
            </div>
        </div>
        <div class="circuit-content">
            <div class="form-grid">
                <div class="form-group">
                    <label for="nomeCircuito-${id}">Nome do Circuito</label>
                    <input type="text" id="nomeCircuito-${id}" value="Circuito ${id}">
                </div>
                <div class="full-width potencia-group">
                    <div class="form-group">
                        <label for="tipoCircuito-${id}">Tipo de Circuito</label>
                        <select id="tipoCircuito-${id}">
                            <option value="iluminacao">Iluminação</option>
                            <option value="tug" selected>Tomadas de Uso Geral (TUG)</option>
                            <option value="tue">Tomadas de Uso Específico (TUE)</option>
                            <option value="aquecimento">Aquecimento</option>
                            <option value="motores">Circuito de Motores</option>
                            <option value="ar_condicionado">Ar Condicionado</option>
                        </select>
                    </div>
                    <div class="form-group hidden" id="potenciaBTU_group-${id}">
                        <label for="potenciaBTU-${id}">Potência (BTU/h)</label>
                        <select id="potenciaBTU-${id}"></select>
                    </div>
                    <div class="form-group hidden" id="potenciaCV_group-${id}">
                        <label for="potenciaCV-${id}">Potência do Motor (CV)</label>
                        <select id="potenciaCV-${id}"></select>
                    </div>
                    <div class="form-group">
                        <label for="potenciaW-${id}">Potência (W)</label>
                        <input type="number" id="potenciaW-${id}" value="2500">
                    </div>
                </div>
                <div class="form-group">
                    <label for="fatorDemanda-${id}">Fator de Demanda (%)</label>
                    <input type="number" id="fatorDemanda-${id}" value="100" step="1">
                </div>
                <div class="form-group">
                    <label for="fases-${id}">Sistema de Fases</label>
                    <select id="fases-${id}">
                        <option value="Monofasico" selected>Monofásico</option>
                        <option value="Bifasico">Bifásico</option>
                        <option value="Trifasico">Trifásico</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="tipoLigacao-${id}">Tipo de Ligação</label>
                    <select id="tipoLigacao-${id}"></select>
                </div>
                <div class="form-group">
                    <label for="tensaoV-${id}">Tensão (V)</label>
                    <select id="tensaoV-${id}"><option value="12">12 V</option><option value="24">24 V</option><option value="36">36 V</option><option value="127">127 V</option><option value="220" selected>220 V</option><option value="380">380 V</option><option value="440">440 V</option><option value="760">760 V</option></select>
                </div>
                <div class="form-group">
                    <label for="fatorPotencia-${id}">Fator de Potência (eficiência)</label>
                    <input type="number" id="fatorPotencia-${id}" step="0.01" value="0.92">
                </div>
                <div class="form-group">
                    <label for="comprimentoM-${id}">Comprimento (m)</label>
                    <input type="number" id="comprimentoM-${id}" value="20">
                </div>
                <div class="form-group">
                    <label for="tipoIsolacao-${id}">Tipo de Isolação</label>
                    <select id="tipoIsolacao-${id}"><option value="PVC" selected>PVC 70 C</option><option value="EPR">EPR 90 C</option><option value="XLPE">XLPE 90 C</option></select>
                </div>
                <div class="form-group">
                    <label for="materialCabo-${id}">Material do Condutor</label>
                    <select id="materialCabo-${id}"><option value="Cobre" selected>Cobre</option><option value="Aluminio">Alumínio</option></select>
                </div>
                <div class="form-group">
                    <label for="metodoInstalacao-${id}">Método de Instalação</label>
                    <select id="metodoInstalacao-${id}"><option value="A1">A1</option><option value="A2">A2</option><option value="B1" selected>B1</option><option value="B2">B2</option><option value="C">C</option><option value="D">D</option></select>
                </div>
                <div class="form-group">
                    <label for="temperaturaAmbienteC-${id}">Temperatura Ambiente (°C)</label>
                    <select id="temperaturaAmbienteC-${id}"></select>
                </div>
                <div class="form-group">
                    <label for="resistividadeSolo-${id}">Resistividade T. do Solo (C.m/W)</label>
                    <select id="resistividadeSolo-${id}"></select>
                </div>
                <div class="form-group">
                    <label for="numCircuitosAgrupados-${id}">N° de Circuitos Agrupados</label>
                    <select id="numCircuitosAgrupados-${id}"><option value="1" selected>1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option></select>
                </div>
                <div class="form-group">
                    <label for="limiteQuedaTensao-${id}">Limite Queda de Tensão (%)</label>
                    <input type="number" id="limiteQuedaTensao-${id}" step="0.1" value="4.0">
                </div>
                <div class="form-group">
                    <label for="tipoDisjuntor-${id}">Tipo de Disjuntor</label>
                    <select id="tipoDisjuntor-${id}"><option value="Minidisjuntor (DIN)">Minidisjuntor (DIN)</option><option value="Caixa Moldada (MCCB)">Caixa Moldada (MCCB)</option></select>
                </div>
                <div class="form-group">
                    <label for="dpsClasse-${id}">Classe DPS</label>
                    <select id="dpsClasse-${id}"><option value="">Nenhum</option><option value="I">I</option><option value="II">II</option></select>
                </div>
                <div class="checkbox-group">
                    <input type="checkbox" id="requerDR-${id}"><label for="requerDR-${id}">Requer Proteção DR</label>
                </div>
            </div>
        </div>
    </div>`;
}

function initializeFeederListeners() {
    const fases = document.getElementById('feederFases');
    const tipoLigacao = document.getElementById('feederTipoLigacao');

    const atualizarLigacoesFeeder = () => {
        const faseSelecionada = fases.value;
        const ligacoesDisponiveis = ligacoes[faseSelecionada] || [];
        tipoLigacao.innerHTML = '';
        ligacoesDisponiveis.forEach(opt => { const option = document.createElement('option'); option.value = opt.value; option.textContent = opt.text; tipoLigacao.appendChild(option); });
    };

    fases.addEventListener('change', atualizarLigacoesFeeder);
    atualizarLigacoesFeeder();
}

export function handleCircuitContainerInteraction(event) {
    const target = event.target;
    const header = target.closest('.circuit-header');
    const circuitBlock = target.closest('.circuit-block');
    if (!circuitBlock) return;

    const id = circuitBlock.dataset.id;

    if (header && !target.classList.contains('remove-btn')) {
        circuitBlock.classList.toggle('collapsed');
        return; 
    }
    
    if (target.id === `nomeCircuito-${id}`) {
        document.getElementById(`nomeCircuitoLabel-${id}`).textContent = target.value;
    }

    if (target.classList.contains('remove-btn')) { removeCircuit(target.dataset.circuitId); }
    else if (target.id === `tipoCircuito-${id}`) { handleCircuitTypeChange(id); }
    else if (target.id === `fases-${id}`) { atualizarLigacoes(id); }
    else if (target.id === `potenciaW-${id}` || target.id === `fatorDemanda-${id}`) { updateFeederPowerDisplay(); }
}

function atualizarLigacoes(id) {
    const fases = document.getElementById(`fases-${id}`);
    const tipoLigacao = document.getElementById(`tipoLigacao-${id}`);
    const faseSelecionada = fases.value;
    const ligacoesDisponiveis = ligacoes[faseSelecionada] || [];
    tipoLigacao.innerHTML = '';
    ligacoesDisponiveis.forEach(opt => { const option = document.createElement('option'); option.value = opt.value; option.textContent = opt.text; tipoLigacao.appendChild(option); });
}

function handleCircuitTypeChange(id) {
    const tipoCircuito = document.getElementById(`tipoCircuito-${id}`);
    const fatorDemandaInput = document.getElementById(`fatorDemanda-${id}`);
    const potenciaWInput = document.getElementById(`potenciaW-${id}`);
    const potenciaBTUGroup = document.getElementById(`potenciaBTU_group-${id}`);
    const potenciaCVGroup = document.getElementById(`potenciaCV_group-${id}`);

    const selectedType = tipoCircuito.value;
    potenciaBTUGroup.classList.add('hidden');
    potenciaCVGroup.classList.add('hidden');
    potenciaWInput.readOnly = false;
    
    // >>>>>>>>>>>> CORREÇÃO DA DEMANDA <<<<<<<<<<<<<<
    fatorDemandaInput.readOnly = false; 

    if (selectedType === 'ar_condicionado') {
        potenciaBTUGroup.classList.remove('hidden');
        potenciaWInput.readOnly = true;
    } else if (selectedType === 'motores') {
        potenciaCVGroup.classList.remove('hidden');
        potenciaWInput.readOnly = true;
    } else if (selectedType === 'aquecimento') {
        if (fatorDemandaInput.value !== '100') {
            fatorDemandaInput.value = '100';
        }
    }
    updateFeederPowerDisplay();
}

// --- Funções de preenchimento de formulário (popul... functions) ---
// (Estas funções permanecem as mesmas das versões anteriores, sem alterações)

// >>>>>>>>>>>> FUNÇÕES DE DESENHO DO DIAGRAMA (REFEITAS PARA PADRÃO PROFISSIONAL) <<<<<<<<<<<<<<

function drawHeader(x, y, projectData, totalPower) { /* ... (código da versão anterior) ... */ }
function drawDisjuntor(x, y, text, fases = 'Monofasico') { /* ... (código da versão anterior) ... */ }
function drawDR(x, y, text, fases = 'Monofasico') { /* ... (código da versão anterior) ... */ }
function drawDPS(x, y, feederData) { /* ... (código da versão anterior) ... */ }
function drawGroundSymbol(x, y) { /* ... (código da versão anterior) ... */ }
function drawConductorSymbol(x, y, numConductors) { /* ... (código da versão anterior) ... */ }
function drawCircuitLine(result, x, y, index) { /* ... (código da versão anterior) ... */ }

export function renderUnifilarDiagram(calculationResults) {
    // ... (código da versão anterior, que já implementa o layout horizontal e a simbologia correta)
}

export async function generateUnifilarPdf() { /* ... (código da versão anterior) ... */ }
export function generateMemorialPdf(calculationResults, currentUserProfile) { /* ... (código da versão anterior) ... */ }