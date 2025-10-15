// Arquivo: calculator.worker.js (NOVO ARQUIVO)

// --- Lógica de Cálculo Pesado (Movida do utils.js) ---

function performCalculation(dados, potenciaInstalada, potenciaDemandada, technicalData, maxDownstreamBreakerAmps = 0) {
    const correnteInstalada = (dados.fases === 'Trifasico' && dados.tensaoV > 0 && dados.fatorPotencia > 0) ? (potenciaInstalada / (dados.tensaoV * 1.732 * dados.fatorPotencia)) : (dados.tensaoV > 0 && dados.fatorPotencia > 0) ? (potenciaInstalada / (dados.tensaoV * dados.fatorPotencia)) : 0;
    const correnteDemandada = (dados.fases === 'Trifasico' && dados.tensaoV > 0 && dados.fatorPotencia > 0) ? (potenciaDemandada / (dados.tensaoV * 1.732 * dados.fatorPotencia)) : (dados.tensaoV > 0 && dados.fatorPotencia > 0) ? (potenciaDemandada / (dados.tensaoV * dados.fatorPotencia)) : 0;
    
    const tempTable = (dados.tipoIsolacao === 'PVC') ? technicalData.fatores_k1 : technicalData.fatores_k1_epr;
    const fatorK1_obj = tempTable?.find(f => f.temperatura_c === dados.temperaturaAmbienteC);
    const fatorK1 = fatorK1_obj ? fatorK1_obj.fator : 1.0;
    
    const fatorK2 = (dados.resistividadeSolo > 0 && technicalData.fatores_k2) ? (technicalData.fatores_k2.find(f => f.resistividade == dados.resistividadeSolo)?.fator || 1.0) : 1.0;
    
    let fatorK3 = 1.0;
    if (dados.numCircuitosAgrupados > 1 && technicalData.fatores_k3) {
        const fatorK3_obj = technicalData.fatores_k3.find(f => f.num_circuitos === dados.numCircuitosAgrupados);
        if (fatorK3_obj) {
            const metodo = dados.metodoInstalacao;
            if (metodo.startsWith('A') || metodo.startsWith('B')) fatorK3 = fatorK3_obj.fator_metodo_a_b;
            else if (metodo.startsWith('C') || metodo.startsWith('D')) fatorK3 = fatorK3_obj.fator_metodo_c_d;
        }
    }
    
    const fatorDeCorrecaoTotal = fatorK1 * fatorK2 * fatorK3;
    const correnteCorrigidaA = (fatorDeCorrecaoTotal > 0) ? (correnteDemandada / fatorDeCorrecaoTotal) : Infinity;

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
            const Iz = capacidadeConducao * fatorDeCorrecaoTotal;
            
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
            dutoRecomendado = duto_obj.tamanho_nominal;
        }
    }

    const calculos = { potenciaInstalada, correnteInstalada, potenciaDemandada, correnteDemandada, fatorK1, fatorK2, fatorK3, correnteCorrigidaA, bitolaRecomendadaMm2, quedaTensaoCalculada, correnteMaximaCabo, disjuntorRecomendado, numCondutores, dutoRecomendado };
    return { dados, calculos };
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

function _calcularCircuitosIndividuais(formData, technicalData){
    const allResults = [];
    const { mainData, circuitsData, clientProfile } = formData;
    if (circuitsData.length === 0) return [];
    
    for (const circuit of circuitsData) {
        const dados = { ...mainData, ...clientProfile, ...circuit };
        dados.dpsInfo = findDps(technicalData.dps, dados.dpsClasse);
        const potenciaInstalada = dados.potenciaW;
        const potenciaDemandada = potenciaInstalada * (dados.fatorDemanda / 100.0);
        const result = performCalculation(dados, potenciaInstalada, potenciaDemandada, technicalData);
        allResults.push(result);
    }
    return allResults;
}

function _calcularAlimentadorGeral(formData, technicalData, potenciaTotal, maxCircuitBreakerAmps) {
    const { mainData, feederData, clientProfile } = formData;
    const dados = { ...mainData, ...clientProfile, ...feederData };

    dados.dpsInfo = findDps(technicalData.dps, dados.dpsClasse, 'highest');
    const potenciaInstalada = potenciaTotal;
    const potenciaDemandada = potenciaInstalada * (dados.fatorDemanda / 100);
    
    return performCalculation(dados, potenciaInstalada, potenciaDemandada, technicalData, maxCircuitBreakerAmps);
}

// --- Ponto de Entrada do Worker ---
self.onmessage = function(e) {
    const { formData, technicalData } = e.data;
    if (!technicalData) {
        self.postMessage({ error: "Os dados técnicos não foram carregados." });
        return;
    }

    try {
        const circuitResults = _calcularCircuitosIndividuais(formData, technicalData);
        
        let maxCircuitBreakerAmps = 0;
        if (circuitResults.length > 0) {
            maxCircuitBreakerAmps = Math.max(...circuitResults.map(r => {
                const breakerName = r.calculos.disjuntorRecomendado.nome;
                return parseInt(breakerName, 10) || 0;
            }));
        }

        const totalPotenciaDemandadaCircuitos = circuitResults.reduce((sum, result) => sum + result.calculos.potenciaDemandada, 0);
        const feederResult = _calcularAlimentadorGeral(formData, technicalData, totalPotenciaDemandadaCircuitos, maxCircuitBreakerAmps);
        
        if (!feederResult) {
            throw new Error("Falha ao calcular o alimentador geral.");
        }
        
        self.postMessage({ feederResult, circuitResults });

    } catch (error) {
        self.postMessage({ error: error.message });
    }
};