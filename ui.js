// Arquivo: ui.js (Carga Hierárquica VISUAL e Debug Memorial)

import { ligacoes, BTU_TO_WATTS_FACTOR, CV_TO_WATTS_FACTOR } from './utils.js';
import { Canvg } from 'https://cdn.skypack.dev/canvg';

let circuitCount = 0;
let qdcCount = 0;
let uiData = null;
let tempOptions = { pvc: [], epr: [] };

export function setupDynamicData(data) { /* ... (inalterada) ... */ }
function populateTemperatureDropdown(selectElement, temperatures) { /* ... (inalterada) ... */ }
function populateBtuDropdown(selectElement, btuData) { /* ... (inalterada) ... */ }
function populateCvDropdown(selectElement, cvData) { /* ... (inalterada) ... */ }
function populateSoilResistivityDropdown(selectElement, soilData) { /* ... (inalterada) ... */ }
export function showLoginView() { /* ... (inalterada) ... */ }
export function showAppView(userProfile) { /* ... (inalterada) ... */ }
export function showResetPasswordView() { /* ... (inalterada) ... */ }
export function openModal(modalId) { /* ... (inalterada) ... */ }
export function closeModal(modalId) { /* ... (inalterada) ... */ }

// ========================================================================
// >>>>> FUNÇÃO REESCRITA: updateFeederPowerDisplay <<<<<
// Implementa cálculo e exibição hierárquica da carga DEMANDADA
// ========================================================================
function updateFeederPowerDisplay() {
    const qdcData = {}; // Armazena { installedDirect: number, demandedDirect: number, parentId: string, childrenIds: string[] }
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
            childrenIds: [] // Inicializa lista de filhos
        };

        // Atualiza display *direto* do QDC (instalada sempre direta, demandada será atualizada depois)
        const qdcPotInstEl = document.getElementById(`qdcPotenciaInstalada-${qdcId}`);
        if (qdcPotInstEl) qdcPotInstEl.value = installedDirect.toFixed(2);
    });

    // 2. Constrói a lista de filhos para cada QDC
    Object.keys(qdcData).forEach(qdcId => {
        const parentId = qdcData[qdcId].parentId;
        if (parentId !== 'feeder' && qdcData[parentId]) {
            qdcData[parentId].childrenIds.push(qdcId);
        }
    });

    // 3. Função recursiva para calcular a demanda agregada
    function calculateAggregatedDemand(qdcId) {
        if (!qdcData[qdcId]) return 0; // Caso base: QDC não existe

        let aggregatedDemand = qdcData[qdcId].demandedDirect; // Começa com a carga direta

        // Soma a carga agregada de cada filho
        qdcData[qdcId].childrenIds.forEach(childId => {
            aggregatedDemand += calculateAggregatedDemand(childId);
        });

        // Armazena o valor calculado para evitar recalcular (opcional, mas bom para performance)
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

    const feederFatorDemanda = (parseFloat(feederFatorDemandaInput.value) || 100) / 100.0;
    const finalDemandGeral = totalDemandAggregatedGeneral * feederFatorDemanda;

    if (feederPotDemandadaFinalEl) feederPotDemandadaFinalEl.value = finalDemandGeral.toFixed(2);

    // Aviso sobre o cálculo real ainda ser plano
    console.warn("Aviso: A exibição da carga foi atualizada hierarquicamente, mas o dimensionamento dos cabos/disjuntores pela Edge Function ainda opera de forma plana. A refatoração da Edge Function é necessária para cálculo hierárquico completo.");
}


// --- LÓGICA DE QDC E FORMULÁRIO (Funções resetForm, getQdcHTML, addQdcBlock, removeQdc, updateQdcParentDropdowns inalteradas da última versão) ---
export function resetForm(addDefaultQdc = true, linkedClient = null) { /* ... */ }
function getQdcHTML(id, name = `QDC ${id}`, parentId = 'feeder') { /* ... */ }
export function addQdcBlock(id = null, name = null, parentId = 'feeder') { /* ... (com listener direto e collapse) ... */ }
export function removeQdc(qdcId) { /* ... */ }
export function updateQdcParentDropdowns() { /* ... */ }

// --- LÓGICA DE CIRCUITO (Funções addCircuit, removeCircuit, getCircuitHTML, listeners inalteradas da última versão) ---
export function addCircuit(qdcId, savedCircuitData = null) { /* ... (com collapse padrão) ... */ }
export function removeCircuit(circuitId) { /* ... */ }
function getCircuitHTML(id) { /* ... */ }
function initializeFeederListeners() { /* ... */ }
function initializeQdcListeners(id) { /* ... */ }
function atualizarQdcLigacoes(id) { /* ... */ }
function handleQdcInsulationChange(id) { /* ... */ }
function handlePowerUnitChange(id, type) { /* ... */ }
export function handleMainContainerInteraction(event) { /* ... (SEM a lógica do addCircuitBtn) ... */ }
function atualizarLigacoes(id) { /* ... */ }
function handleInsulationChange(id) { /* ... */ }
function handleCircuitTypeChange(id) { /* ... */ }

// --- Funções de preenchimento de formulário (Populate functions inalteradas) ---
export function populateProjectList(projects) { /* ... */ }
export function populateFormWithProjectData(project) { /* ... */ }
export function populateUsersPanel(users) { /* ... */ }
export function populateEditUserModal(d) { /* ... */ }
export function populateProjectsPanel(projects, clients, users, currentUserProfile) { /* ... */ }
export function populateClientManagementModal(clients) { /* ... */ }
export function resetClientForm() { /* ... */ }
export function openEditClientForm(c) { /* ... */ }
export function populateSelectClientModal(clients, isChange = false) { /* ... */ }

// --- FUNÇÕES DE GERAÇÃO DE PDF (buildUnifilarSvgString e generateUnifilarPdf inalteradas) ---
function getDpsText(dpsInfo) { /* ... */ }
function drawHeader(x, y, projectData, totalPower) { /* ... */ }
// ... (outras funções draw* inalteradas) ...
function buildUnifilarSvgString(calculationResults) { /* ... */ }
export async function generateUnifilarPdf(calculationResults) { /* ... */ }

// ========================================================================
// >>>>> FUNÇÃO MODIFICADA: generateMemorialPdf <<<<<
// Adicionado console.log para depurar o agrupamento
// ========================================================================
export function generateMemorialPdf(calculationResults, currentUserProfile) {
    if (!calculationResults) { alert("Execute o cálculo primeiro."); return; }

    const { feederResult, circuitResults } = calculationResults;
    if (!feederResult || !circuitResults) { alert("Dados insuficientes para gerar Memorial."); return;}

    // --- DEBUGGING LOG: Verifica os dados recebidos ---
    console.log("--- Debugging generateMemorialPdf ---");
    console.log("Feeder Result Dados:", feederResult?.dados);
    console.log("Circuit Results Received (first 5):", circuitResults?.slice(0, 5)); // Mostra os 5 primeiros
    // Verifica se qdcId está presente nos dados recebidos
    if (circuitResults && circuitResults.length > 0) {
        console.log("Checking for qdcId in first circuit:", circuitResults[0]?.dados?.qdcId);
    }
    // --- FIM DEBUGGING LOG ---

    // --- Agrupar resultados por QDC ID ---
    const circuitsByQdc = {};
    if (circuitResults) { // Adiciona verificação
        circuitResults.forEach(result => {
            // Verifica se 'dados' e 'qdcId' existem
            if (result && result.dados && result.dados.qdcId) {
                const qdcId = result.dados.qdcId;
                if (!circuitsByQdc[qdcId]) {
                    circuitsByQdc[qdcId] = [];
                }
                circuitsByQdc[qdcId].push(result);
            } else {
                console.warn("Resultado de circuito inválido ou sem qdcId:", result);
                // Opcional: Agrupar em uma categoria 'sem QDC'
                if (!circuitsByQdc['unknown']) circuitsByQdc['unknown'] = [];
                circuitsByQdc['unknown'].push(result);
            }
        });
    }
    // --- FIM Agrupamento ---

    // --- DEBUGGING LOG: Verifica o resultado do agrupamento ---
    console.log("Circuits Grouped by QDC:", circuitsByQdc);
    console.log("------------------------------------");
    // --- FIM DEBUGGING LOG ---


    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    let yPos = 20;
    const lM = 15;
    const vM = 75;

    const addT = (t) => { /* ... (inalterada) ... */ doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.text(t, 105, yPos, { align: 'center' }); yPos += 12; };
    const addS = (t) => { /* ... (inalterada) ... */ if (yPos > 260) { doc.addPage(); yPos = 20; } doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text(t, lM, yPos); yPos += 8; };
    const addL = (l, v) => { /* ... (inalterada) ... */ if (yPos > 270) { doc.addPage(); yPos = 20; } doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text(l, lM, yPos); doc.setFont('helvetica', 'normal'); doc.text(String(v || '-'), vM, yPos); yPos += 6; };

    const reportData = feederResult?.dados || {}; // Usa objeto vazio se feederResult for inválido

    // --- Página 1: Dados Gerais e Resumos ---
    addT("RELATÓRIO DE PROJETO ELÉTRICO");
    addS("DADOS DO CLIENTE"); /* ... (igual antes) ... */
    addL("Cliente:", reportData.cliente);
    addL(`Documento (${reportData.tipoDocumento}):`, reportData.documento);
    addL("Celular:", reportData.celular);
    addL("Telefone:", reportData.telefone);
    addL("E-mail:", reportData.email);
    addL("Endereço do Cliente:", reportData.enderecoCliente);
    yPos += 5;
    addS("DADOS DA OBRA"); /* ... (igual antes) ... */
    addL("Código da Obra:", reportData.projectCode);
    addL("Nome da Obra:", reportData.obra);
    addL("Cidade da Obra:", reportData.cidadeObra);
    addL("Endereço da Obra:", reportData.enderecoObra);
    addL("Área da Obra (m²):", reportData.areaObra);
    addL("Unid. Residenciais:", reportData.unidadesResidenciais);
    addL("Unid. Comerciais:", reportData.unidadesComerciais);
    addL("Observações:", reportData.observacoes);
    yPos += 5;
    addS("INFORMAÇÕES DO RESPONSÁVEL TÉCNICO"); /* ... (igual antes) ... */
    addL("Nome:", document.getElementById('respTecnico').value);
    addL("Título:", document.getElementById('titulo').value);
    addL("CREA:", document.getElementById('crea').value);
    yPos += 5;
    addS("INFORMAÇÕES DO RELATÓRIO"); /* ... (igual antes) ... */
    const dataFormatada = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    addL("Gerado em:", dataFormatada);
    addL("Gerado por:", currentUserProfile?.nome || 'N/A');
    yPos += 5;

    addS("RESUMO DA ALIMENTAÇÃO GERAL"); /* ... (igual antes) ... */
    if (feederResult?.calculos?.disjuntorRecomendado) { // Verifica se há dados
        const feederBreakerType = feederResult.dados.tipoDisjuntor.includes('Caixa Moldada') ? 'MCCB' : 'DIN';
        const feederBreakerText = `${feederBreakerType} ${feederResult.calculos.disjuntorRecomendado.nome}`;
        const feederHead = [['Tensão/Fases', 'Disjuntor Geral', 'DR', 'DPS', 'Cabo (Isolação)', 'Eletroduto']];
        const feederBody = [[ `${feederResult.dados.tensaoV}V - ${feederResult.dados.fases}`, feederBreakerText, feederResult.dados.requerDR ? 'Sim' : 'Nao', getDpsText(feederResult.dados.dpsInfo), `${feederResult.calculos.bitolaRecomendadaMm2} mm² (${feederResult.dados.tipoIsolacao})`, feederResult.calculos.dutoRecomendado ]];
        doc.autoTable({ startY: yPos, head: feederHead, body: feederBody, theme: 'grid', headStyles: { fillColor: [44, 62, 80] }, styles: { fontSize: 8 } });
        yPos = doc.lastAutoTable.finalY + 10;
    } else {
         addL("Alimentador Geral:", "Dados indisponíveis ou erro no cálculo.");
         yPos += 5;
    }

    // --- Loop pelos QDCs para Resumo dos Circuitos ---
    const qdcOrder = Object.keys(circuitsByQdc).filter(id => id !== 'unknown').sort((a,b) => parseInt(a) - parseInt(b)); // Ordena QDCs válidos

    qdcOrder.forEach(qdcId => {
        const qdcNameEl = document.getElementById(`qdcName-${qdcId}`);
        const qdcName = qdcNameEl ? qdcNameEl.value : `QDC ${qdcId}`; // Pega nome do DOM
        const qdcCircuits = circuitsByQdc[qdcId];

        if (qdcCircuits && qdcCircuits.length > 0) {
            if (yPos > 240) { doc.addPage(); yPos = 20; }
            addS(`RESUMO DOS CIRCUITOS - ${qdcName.toUpperCase()}`);
            const head = [['Ckt', 'Nome', 'Disjuntor', 'DR', 'DPS', 'Cabo (Isolação)', 'Eletroduto']];
            const body = qdcCircuits.map((r, index) => {
                const circuitBreakerType = r.dados?.tipoDisjuntor?.includes('Caixa Moldada') ? 'MCCB' : 'DIN';
                const circuitBreakerText = `${circuitBreakerType} ${r.calculos?.disjuntorRecomendado?.nome || 'N/C'}`; // N/C = Não Calculado
                return [
                    index + 1,
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
     // Adiciona seção para circuitos sem QDC identificado, se houver
    if (circuitsByQdc['unknown'] && circuitsByQdc['unknown'].length > 0) {
         if (yPos > 240) { doc.addPage(); yPos = 20; }
         addS(`RESUMO DOS CIRCUITOS - QDC NÃO IDENTIFICADO`);
         // (poderia gerar a tabela aqui também, similar ao loop acima)
         addL("Erro:", "Alguns circuitos não puderam ser associados a um QDC.");
         yPos += 5;
    }

    // --- Páginas de Memorial Detalhado ---

    // Memorial do Alimentador Geral
    if (feederResult) { // Gera apenas se houver resultado
        doc.addPage();
        yPos = 20;
        generateMemorialPage(doc, feederResult, "ALIMENTADOR GERAL", 0, addT, addS, addL, () => yPos, (newY) => yPos = newY);
    }

    // --- Loop pelos QDCs para memoriais dos circuitos ---
    qdcOrder.forEach(qdcId => {
        const qdcNameEl = document.getElementById(`qdcName-${qdcId}`);
        const qdcName = qdcNameEl ? qdcNameEl.value : `QDC ${qdcId}`;
        const qdcCircuits = circuitsByQdc[qdcId];

        if (qdcCircuits) {
            qdcCircuits.forEach((result, index) => {
                // Adiciona verificação antes de gerar a página
                if (result && result.dados && result.calculos) {
                    doc.addPage();
                    yPos = 20;
                    generateMemorialPage(doc, result, `CIRCUITO ${index + 1} (${qdcName})`, index + 1, addT, addS, addL, () => yPos, (newY) => yPos = newY);
                } else {
                    console.error(`Dados inválidos para memorial do circuito ${index+1} do ${qdcName}:`, result);
                }
            });
        }
    });

    doc.save(`Memorial_${document.getElementById('obra').value || 'Projeto'}.pdf`);
}

// --- Função auxiliar para gerar uma página do memorial (inalterada) ---
function generateMemorialPage(doc, result, titlePrefix, circuitIndex, addT, addS, addL, getY, setY) {
     const { dados, calculos } = result;
    // Adiciona verificação defensiva
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
    addL("Potência Instalada:", `${calculos.potenciaInstalada?.toFixed(2) || '?'} W`);
    addL("Fator de Demanda:", `${dados.fatorDemanda || '?'}%`);
    const potenciaDemandadaVA = dados.fatorPotencia > 0 ? (calculos.potenciaDemandada / dados.fatorPotencia).toFixed(2) : "0.00";
    addL("Potência Demandada:", `${potenciaDemandadaVA} VA (${calculos.potenciaDemandada?.toFixed(2) || '?'} W)`);
    addL("Fator de Potência:", dados.fatorPotencia);
    addL("Sistema de Fases:", dados.fases);
    addL("Tipo de Ligação:", dados.tipoLigacao);
    addL("Tensão (V):", `${dados.tensaoV || '?'} V`);
    addL("Comprimento:", `${dados.comprimentoM || '?'} m`);
    addL("Limite Queda de Tensão:", `${dados.limiteQuedaTensao || '?'}%`);
    yPos = getY() + 5; setY(yPos);

    addS("-- ESPECIFICAÇÕES DE INSTALAÇÃO E CORREÇÕES --");
    addL("Material / Isolação:", `${dados.materialCabo || '?'} / ${dados.tipoIsolacao || '?'}`);
    addL("Método de Instalação:", dados.metodoInstalacao);
    addL("Temperatura Ambiente:", `${dados.temperaturaAmbienteC || '?'}°C`);
    if (!isFeeder) {
        addL("Circuitos Agrupados:", dados.numCircuitosAgrupados);
    }
    if (dados.resistividadeSolo > 0) {
        addL("Resist. do Solo (C.m/W):", dados.resistividadeSolo);
    }
    yPos = getY() + 5; setY(yPos);

    addS("-- RESULTADOS DE CÁLCULO E DIMENSIONAMENTO --");
    addL("Corrente de Projeto (Nominal):", `${calculos.correnteInstalada?.toFixed(2) || '?'} A`);
    addL("Corrente Demandada (Ib):", `${calculos.correnteDemandada?.toFixed(2) || '?'} A`);
    const fatorK1 = calculos.fatorK1 ?? 1;
    const fatorK2 = calculos.fatorK2 ?? 1;
    const fatorK3 = isFeeder ? 1 : (calculos.fatorK3 ?? 1);
    const fatorCorrecaoTotal = (fatorK1 * fatorK2 * fatorK3).toFixed(3);
    addL(`Fatores Correção (K1*K2${isFeeder ? '' : '*K3'}):`, `${fatorK1.toFixed(2)} * ${fatorK2.toFixed(2)}${isFeeder ? '' : ' * ' + fatorK3.toFixed(2)} = ${fatorCorrecaoTotal}`);
    const correnteCorrigidaTexto = isFinite(calculos.correnteCorrigidaA) ? `${calculos.correnteCorrigidaA.toFixed(2)} A` : "Incalculável";
    addL("Corrente Corrigida (I'z = Ib/Fator):", correnteCorrigidaTexto);
    addL("Bitola Recomendada (Seção):", `${calculos.bitolaRecomendadaMm2 || '?'} mm²`);
    addL("Capacidade Cabo (Iz = Cap.Nominal*Fator):", `${calculos.correnteMaximaCabo?.toFixed(2) || '?'} A`);

    // Critérios de dimensionamento (com verificações)
    const ib = calculos.correnteDemandada;
    const inom = parseFloat(calculos.disjuntorRecomendado?.nome);
    const iz = calculos.correnteMaximaCabo;
    const dvCalc = calculos.quedaTensaoCalculada;
    const dvLimit = dados.limiteQuedaTensao;

    const criterio1Ok = !isNaN(ib) && !isNaN(inom) && !isNaN(iz) && ib <= inom && inom <= iz;
    addL("Critério Disjuntor (Ib <= In <= Iz):", `${ib?.toFixed(2) || '?'}A <= ${calculos.disjuntorRecomendado?.nome || '?'} <= ${iz?.toFixed(2) || '?'}A ${criterio1Ok ? ' (OK)' : ' (FALHA)'}`);

    const criterioDvOk = !isNaN(dvCalc) && !isNaN(dvLimit) && dvCalc <= dvLimit;
    addL("Critério Queda Tensão (DV <= Limite):", `${dvCalc?.toFixed(2) || '?'}% <= ${dvLimit || '?'}% ${criterioDvOk ? ' (OK)' : ' (FALHA)'}`);
    yPos = getY() + 5; setY(yPos);

    addS("-- PROTEÇÕES RECOMENDADAS --");
    addL("Disjuntor:", `${dados.tipoDisjuntor || '?'}: ${calculos.disjuntorRecomendado?.nome || '?'} (Curva: ${calculos.disjuntorRecomendado?.curva || 'N/A'}, Icu: ${calculos.disjuntorRecomendado?.icc || '?'} kA)`);
    addL("Proteção DR:", dados.requerDR ? `Sim (${calculos.disjuntorRecomendado?.nome?.replace('A','') || '?'}A / 30mA)` : 'Não');
    addL("Proteção DPS:", getDpsText(dados.dpsInfo));
    addL("Eletroduto Recomendado:", calculos.dutoRecomendado || '?');
}