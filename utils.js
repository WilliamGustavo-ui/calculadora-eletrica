// Arquivo: utils.js

export const ligacoes = { Monofasico: [{value:'FN', text:'Fase-Neutro (FN)'}, {value:'FF', text:'Fase-Fase (FF)'}], Bifasico: [{value:'FF', text:'Fase-Fase (FF)'}, {value:'FFN', text:'Fase-Fase-Neutro (FFN)'}], Trifasico: [{value:'FFF', text:'Fase-Fase-Fase (FFF)'}, {value:'FFFN', text:'Fase-Fase-Fase-Neutro (FFFN)'}] };

// --- FUNÇÕES DE MÁSCARA ---
export function mascaraCPF(event){event.target.value=event.target.value.replace(/\D/g,"").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d{1,2})$/,"$1-$2")}
export function mascaraCelular(event){event.target.value=event.target.value.replace(/\D/g,'').replace(/^(\d{2})(\d)/g,'($1) $2').replace(/(\d{5})(\d{4})$/,'$1-$2')}
export function mascaraTelefone(event){event.target.value=event.target.value.replace(/\D/g,'').replace(/^(\d{2})(\d)/g,'($1) $2').replace(/(\d{4})(\d)/,'$1-$2')}
export function aplicarMascara(event){const tipoDoc=document.getElementById('tipoDocumento').value;let value=event.target.value.replace(/\D/g,"");if(tipoDoc==='CPF'){value=value.slice(0,11).replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d)/,"$1.$2").replace(/(\d{3})(\d{1,2})$/,"$1-$2")}else{value=value.slice(0,14).replace(/^(\d{2})(\d)/,'$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1/$2').replace(/(\d{4})(\d)/,'$1-$2')}
event.target.value=value}
export function atualizarMascaraDocumento(){const tipoDoc=document.getElementById('tipoDocumento').value;const inputDoc=document.getElementById('documento');inputDoc.value='';if(tipoDoc==='CPF'){inputDoc.placeholder='000.000.000-00';inputDoc.maxLength=14}else{inputDoc.placeholder='00.000.000/0000-00';inputDoc.maxLength=18}}

// --- FUNÇÃO PRINCIPAL DE CÁLCULO ---
export function calcularProjetoCompleto(technicalData) {
    if (!technicalData) {
        alert("Os dados técnicos não foram carregados. Verifique a conexão com o banco de dados.");
        return null;
    }

    const circuitResults = _calcularCircuitosIndividuais(technicalData);
    if (!circuitResults) {
        const feederResult = _calcularAlimentadorGeral(technicalData, 0, 0);
        return { feederResult, circuitResults: [] };
    };

    let maxCircuitBreakerAmps = 0;
    if (circuitResults.length > 0) {
        maxCircuitBreakerAmps = Math.max(...circuitResults.map(r => {
            const breakerName = r.calculos.disjuntorRecomendado.nome;
            return parseInt(breakerName, 10) || 0;
        }));
    }

    const totalPotenciaDemandadaCircuitos = circuitResults.reduce((sum, result) => sum + result.calculos.potenciaDemandada, 0);

    const feederResult = _calcularAlimentadorGeral(technicalData, totalPotenciaDemandadaCircuitos, maxCircuitBreakerAmps);
    if (!feederResult) return null;
    
    return { feederResult, circuitResults };
}

function getMainFormData() {
    return {
        projectCode: document.getElementById('projectCode').value,
        cliente: document.getElementById('cliente').value,
        tipoDocumento: document.getElementById('tipoDocumento').value,
        documento: document.getElementById('documento').value,
        telefone: document.getElementById('telefone').value,
        celular: document.getElementById('celular').value,
        email: document.getElementById('email').value,
        obra: document.getElementById('obra').value,
        endereco: document.getElementById('endereco').value,
        areaObra: document.getElementById('areaObra').value
    };
}

// --- FUNÇÕES AUXILIARES DE CÁLCULO ---

function _calcularAlimentadorGeral(technicalData, potenciaTotal, maxCircuitBreakerAmps) {
    const mainData = getMainFormData();
    const dados = {
        ...mainData,
        id: 'Geral',
        nomeCircuito: "Alimentador Geral",
        fatorDemanda: parseFloat(document.getElementById('feederFatorDemanda').value) || 1.0,
        fases: document.getElementById('feederFases').value,
        tipoLigacao: document.getElementById('feederTipoLigacao').value,
        tensaoV: parseFloat(document.getElementById('feederTensaoV').value),
        fatorPotencia: parseFloat(document.getElementById('feederFatorPotencia').value),
        comprimentoM: parseFloat(document.getElementById('feederComprimentoM').value),
        tipoIsolacao: document.getElementById('feederTipoIsolacao').value,
        materialCabo: document.getElementById('feederMaterialCabo').value,
        metodoInstalacao: document.getElementById('feederMetodoInstalacao').value,
        temperaturaAmbienteC: parseInt(document.getElementById('feederTemperaturaAmbienteC').value),
        limiteQuedaTensao: parseFloat(document.getElementById('feederLimiteQuedaTensao').value),
        tipoDisjuntor: document.getElementById('feederTipoDisjuntor').value,
        requerDR: document.getElementById('feederRequerDR').checked,
        dpsClasse: document.getElementById('feederDpsClasse').value,
    };

    dados.dpsInfo = findDps(technicalData.dps, dados.dpsClasse, 'highest');
    const potenciaInstalada = potenciaTotal;
    const potenciaDemandada = potenciaInstalada * dados.fatorDemanda;
    
    return performCalculation(dados, potenciaInstalada, potenciaDemandada, technicalData, maxCircuitBreakerAmps);
}

function _calcularCircuitosIndividuais(technicalData){
    const allResults=[];
    const circuitBlocks=document.querySelectorAll('#circuits-container .circuit-block');
    if(circuitBlocks.length === 0) return [];
    
    const mainData = getMainFormData();
    for (const block of circuitBlocks) {
        const id = block.dataset.id;
        
        const dados = {
            ...mainData,
            id:id,
            nomeCircuito:document.getElementById(`nomeCircuito-${id}`).value,
            tipoCircuito:document.getElementById(`tipoCircuito-${id}`).value,
            potenciaW:parseFloat(document.getElementById(`potenciaW-${id}`).value) || 0,
            potenciaCV:parseFloat(document.getElementById(`potenciaCV-${id}`).value) || 0,
            fatorDemanda:parseFloat(document.getElementById(`fatorDemanda-${id}`).value),
            fases:document.getElementById(`fases-${id}`).value,
            tipoLigacao:document.getElementById(`tipoLigacao-${id}`).value,
            tensaoV:parseFloat(document.getElementById(`tensaoV-${id}`).value),
            fatorPotencia:parseFloat(document.getElementById(`fatorPotencia-${id}`).value),
            comprimentoM:parseFloat(document.getElementById(`comprimentoM-${id}`).value),
            tipoIsolacao:document.getElementById(`tipoIsolacao-${id}`).value,
            materialCabo:document.getElementById(`materialCabo-${id}`).value,
            metodoInstalacao:document.getElementById(`metodoInstalacao-${id}`).value,
            temperaturaAmbienteC:parseInt(document.getElementById(`temperaturaAmbienteC-${id}`).value),
            resistividadeSolo:parseFloat(document.getElementById(`resistividadeSolo-${id}`).value),
            numCircuitosAgrupados:parseInt(document.getElementById(`numCircuitosAgrupados-${id}`).value),
            limiteQuedaTensao:parseFloat(document.getElementById(`limiteQuedaTensao-${id}`).value),
            tipoDisjuntor:document.getElementById(`tipoDisjuntor-${id}`).value,
            requerDR:document.getElementById(`requerDR-${id}`).checked,
            dpsClasse: document.getElementById(`dpsClasse-${id}`).value,
        };
        
        dados.dpsInfo = findDps(technicalData.dps, dados.dpsClasse);
        if (dados.tipoCircuito === 'motores') dados.potenciaW = dados.potenciaCV * 735.5;
        const potenciaInstalada = dados.potenciaW;
        const potenciaDemandada = potenciaInstalada * dados.fatorDemanda;
        
        const result = performCalculation(dados, potenciaInstalada, potenciaDemandada, technicalData);
        allResults.push(result);
    }
    return allResults;
}

function findDps(dpsList, dpsClasse, preference = 'lowest') {
    if (!dpsClasse || !dpsList) return null;
    
    const suitableDps = dpsList
        .filter(d => d.classe === dpsClasse)
        .sort((a, b) => {
            if (preference === 'highest') {
                return b.corrente_ka - a.corrente_ka;
            }
            return a.corrente_ka - b.corrente_ka;
        });
        
    return suitableDps.length > 0 ? suitableDps[0] : null;
}

function performCalculation(dados, potenciaInstalada, potenciaDemandada, technicalData, maxDownstreamBreakerAmps = 0) {
    const correnteInstalada = (dados.fases === 'Trifasico' && dados.tensaoV > 0 && dados.fatorPotencia > 0) ? (potenciaInstalada / (dados.tensaoV * 1.732 * dados.fatorPotencia)) : (dados.tensaoV > 0 && dados.fatorPotencia > 0) ? (potenciaInstalada / (dados.tensaoV * dados.fatorPotencia)) : 0;
    const correnteDemandada = (dados.fases === 'Trifasico' && dados.tensaoV > 0 && dados.fatorPotencia > 0) ? (potenciaDemandada / (dados.tensaoV * 1.732 * dados.fatorPotencia)) : (dados.tensaoV > 0 && dados.fatorPotencia > 0) ? (potenciaDemandada / (dados.tensaoV * dados.fatorPotencia)) : 0;
    
    let fatorK1 = 1.0;
    if (dados.temperaturaAmbienteC && technicalData.fatores_k1) {
        const fatorObj = technicalData.fatores_k1.find(f => 
            f.isolacao === dados.tipoIsolacao && 
            f.temperatura_c === dados.temperaturaAmbienteC
        );
        if (fatorObj) {
            fatorK1 = fatorObj.fator;
        }
    }
    
    const fatorK2 = (dados.resistividadeSolo > 0 && technicalData.fatores_k2) ? (technicalData.fatores_k2.find(f => f.resistividade === dados.resistividadeSolo)?.fator || 1.0) : 1.0;
    
    let fatorK3 = 1.0;
    if (dados.numCircuitosAgrupados > 1 && technicalData.fatores_k3) {
        const fatorK3_obj = technicalData.fatores_k3.find(f => f.num_circuitos === dados.numCircuitosAgrupados);
        if (fatorK3_obj) {
            const metodo = dados.metodoInstalacao;
            if (metodo.startsWith('A') || metodo.startsWith('B')) fatorK3 = fatorK3_obj.fator_metodo_a_b;
            else if (metodo.startsWith('C') || metodo.startsWith('D')) fatorK3 = fatorK3_obj.fator_metodo_c_d;
        }
    }

    const correnteCorrigidaA = correnteDemandada > 0 && (fatorK1 * fatorK2 * fatorK3 > 0) ? correnteDemandada / (fatorK1 * fatorK2 * fatorK3) : 0;
    let bitolaRecomendadaMm2="Nao encontrada", quedaTensaoCalculada=0, correnteMaximaCabo=0, disjuntorRecomendado={nome:"Coord. Inadequada",icc:0};
    
    const disjuntorCandidato = technicalData.disjuntores
        ?.filter(d =>
            d.tipo === dados.tipoDisjuntor &&
            d.corrente_a >= correnteDemandada &&
            d.corrente_a >= maxDownstreamBreakerAmps
        )
        .sort((a,b) => a.corrente_a - b.corrente_a)[0];

    if (disjuntorCandidato && technicalData.cabos) {
        let bitolaMinima = (dados.tipoCircuito === 'iluminacao') ? 1.5 : (dados.tipoCircuito ? 2.5 : 0);
        if (dados.id === 'Geral') bitolaMinima = 0;

        const tabelaCaboSelecionada = technicalData.cabos.filter(c => c.material === dados.materialCabo && c.isolacao === dados.tipoIsolacao && c.secao_mm2 >= bitolaMinima);
        
        for (const cabo of tabelaCaboSelecionada) {
            const capacidadeConducao = cabo[`capacidade_${dados.metodoInstalacao.toLowerCase()}`] || 0;
            const Iz = capacidadeConducao * fatorK1 * fatorK2 * fatorK3;
            
            if (Iz >= disjuntorCandidato.corrente_a) {
                const resistividade = (dados.materialCabo === 'Cobre') ? 0.0172 : 0.0282;
                const quedaVolts = (cabo.secao_mm2 > 0) ? ((dados.fases === 'Trifasico') ? ((1.732 * resistividade * dados.comprimentoM * correnteDemandada) / cabo.secao_mm2) : ((2 * resistividade * dados.comprimentoM * correnteDemandada) / cabo.secao_mm2)) : 0;
                const quedaPercentual = (dados.tensaoV > 0) ? (quedaVolts / dados.tensaoV) * 100.0 : 0;
                
                if (quedaPercentual <= dados.limiteQuedaTensao) {
                    bitolaRecomendadaMm2 = cabo.secao_mm2.toString();
                    quedaTensaoCalculada = quedaPercentual;
                    correnteMaximaCabo = Iz;
                    disjuntorRecomendado = { nome: disjuntorCandidato.nome, icc: disjuntorCandidato.icc_ka };
                    break;
                }
            }
        }
    }

    let numCondutores=0;
    if(dados.fases==='Monofasico'){numCondutores=2}else if(dados.fases==='Bifasico'){if(dados.tipoLigacao==='FF')numCondutores=2;else if(dados.tipoLigacao==='FFN')numCondutores=3}else if(dados.fases==='Trifasico'){if(dados.tipoLigacao==='FFF')numCondutores=3;else if(dados.tipoLigacao==='FFFN')numCondutores=4}
    
    let dutoRecomendado = "Nao encontrado";
    const bitolaNum = parseFloat(bitolaRecomendadaMm2);
    if (bitolaNum && technicalData.eletrodutos) {
        const duto_obj = technicalData.eletrodutos.find(e => e.num_condutores === numCondutores && e.secao_cabo_mm2 === bitolaNum);
        if (duto_obj) {
            const match = String(duto_obj.tamanho_nominal).match(/\((.*?)\)/);
            dutoRecomendado = match ? match[1] : duto_obj.tamanho_nominal;
        }
    }

    const calculos = { potenciaInstalada, correnteInstalada, potenciaDemandada, correnteDemandada, fatorK1, fatorK2, fatorK3, correnteCorrigidaA, bitolaRecomendadaMm2, quedaTensaoCalculada, correnteMaximaCabo, disjuntorRecomendado, numCondutores, dutoRecomendado };
    return { dados, calculos };
}