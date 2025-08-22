// Arquivo: ui.js

import { ligacoes } from './utils.js';

let circuitCount = 0;
let tempOptions = { pvc: [], epr: [] };

// --- PREPARAÇÃO DOS DADOS DE TEMPERATURA ---
export function setupDynamicTemperatures(techData) {
    if (techData?.fatores_k1) {
        tempOptions.pvc = techData.fatores_k1.filter(f => f.fator > 0).map(f => f.temperatura_c).sort((a, b) => a - b);
    }
    if (techData?.fatores_k1_epr) {
        tempOptions.epr = techData.fatores_k1_epr.filter(f => f.fator > 0).map(f => f.temperatura_c).sort((a, b) => a - b);
    } else {
        tempOptions.epr = tempOptions.pvc;
    }
}

// --- FUNÇÃO AUXILIAR PARA POPULAR DROPDOWNS ---
function populateTemperatureDropdown(selectElement, temperatures) {
    const currentValue = selectElement.value;
    selectElement.innerHTML = '';
    temperatures.forEach(temp => {
        const option = document.createElement('option');
        option.value = temp;
        option.textContent = `${temp}°C`;
        selectElement.appendChild(option);
    });
    if (temperatures.includes(parseInt(currentValue))) {
        selectElement.value = currentValue;
    } else if (temperatures.includes(30)) {
        selectElement.value = '30';
    } else if (temperatures.length > 0) {
        selectElement.value = temperatures[0];
    }
}

// --- CONTROLE DE VISIBILIDADE E MODAIS ---
export function showLoginView() { document.getElementById('loginContainer').style.display = 'block'; document.getElementById('appContainer').style.display = 'none'; document.getElementById('resetPasswordContainer').style.display = 'none'; }
export function showAppView(userProfile) {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    document.getElementById('resetPasswordContainer').style.display = 'none';
    
    const isAdmin = userProfile?.is_admin || false;
    
    // Botões visíveis apenas para administradores
    document.getElementById('adminPanelBtn').style.display = isAdmin ? 'block' : 'none';
    
    // Botões visíveis para todos os usuários
    document.getElementById('manageClientsBtn').style.display = 'block';
    document.getElementById('manageProjectsBtn').style.display = 'block';
}
export function showResetPasswordView() { document.getElementById('loginContainer').style.display = 'none'; document.getElementById('appContainer').style.display = 'none'; document.getElementById('resetPasswordContainer').style.display = 'block'; }
export function openModal(modalId) { document.getElementById(modalId).style.display = 'flex'; }
export function closeModal(modalId) { document.getElementById(modalId).style.display = 'none'; }

// --- MANIPULAÇÃO DO FORMULÁRIO PRINCIPAL E CIRCUITOS ---
export function resetForm(addFirst = true, linkedClient = null) {
    document.getElementById('main-form').reset();
    document.getElementById('tech-form').reset();
    document.getElementById('feeder-form').reset();
    document.getElementById('currentProjectId').value = '';
    document.getElementById('circuits-container').innerHTML = '';
    document.getElementById('report').textContent = 'O relatório aparecerá aqui.';
    document.getElementById('searchInput').value = '';

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
    if (addFirst) addCircuit();
}

export function addCircuit() { circuitCount++; const newCircuitDiv = document.createElement('div'); newCircuitDiv.innerHTML = getCircuitHTML(circuitCount); document.getElementById('circuits-container').appendChild(newCircuitDiv.firstElementChild); initializeCircuitListeners(circuitCount); }
export function removeCircuit(id) { document.getElementById(`circuit-${id}`)?.remove(); renumberCircuits(); }

function renumberCircuits() {
    const circuitBlocks = document.querySelectorAll('#circuits-container .circuit-block');
    circuitCount = circuitBlocks.length;
    circuitBlocks.forEach((block, index) => {
        const newId = index + 1;
        const oldId = parseInt(block.dataset.id);
        if (oldId === newId) return;
        block.dataset.id = newId;
        block.id = `circuit-${newId}`;
        block.querySelectorAll('[id],[for],[data-circuit-id]').forEach(el => {
            const props=['id','htmlFor'];
            props.forEach(prop=>{ if(el[prop] && String(el[prop]).includes(`-${oldId}`)){ el[prop] = el[prop].replace(`-${oldId}`,`-${newId}`) } });
            if (el.dataset.circuitId && el.dataset.circuitId.includes(`-${oldId}`)) { el.dataset.circuitId = el.dataset.circuitId.replace(`-${oldId}`, `-${newId}`); }
        });
        block.querySelector('h2').textContent = `Circuito ${newId}`;
    });
}

function initializeFeederListeners() {
    const fases = document.getElementById('feederFases');
    const tipoLigacao = document.getElementById('feederTipoLigacao');
    const tipoIsolacao = document.getElementById('feederTipoIsolacao');
    const temperaturaAmbiente = document.getElementById('feederTemperaturaAmbienteC');

    const atualizarLigacoesFeeder = () => {
        const faseSelecionada = fases.value;
        const ligacoesDisponiveis = ligacoes[faseSelecionada] || [];
        tipoLigacao.innerHTML = '';
        ligacoesDisponiveis.forEach(opt => { const option = document.createElement('option'); option.value = opt.value; option.textContent = opt.text; tipoLigacao.appendChild(option); });
    };
    
    const handleInsulationChange = () => {
        const selectedInsulation = tipoIsolacao.value;
        const temps = selectedInsulation === 'EPR' ? tempOptions.epr : tempOptions.pvc;
        populateTemperatureDropdown(temperaturaAmbiente, temps);
    };

    fases.addEventListener('change', atualizarLigacoesFeeder);
    tipoIsolacao.addEventListener('change', handleInsulationChange);
    
    atualizarLigacoesFeeder();
    handleInsulationChange();
}

function initializeCircuitListeners(id) {
    const tipoCircuito = document.getElementById(`tipoCircuito-${id}`);
    const fases = document.getElementById(`fases-${id}`);
    const tipoLigacao = document.getElementById(`tipoLigacao-${id}`);
    const tipoIsolacao = document.getElementById(`tipoIsolacao-${id}`);
    const temperaturaAmbiente = document.getElementById(`temperaturaAmbienteC-${id}`);
    const potenciaWGroup = document.getElementById(`potenciaW_group-${id}`);
    const potenciaCVGroup = document.getElementById(`potenciaCV_group-${id}`);
    const fatorDemandaInput = document.getElementById(`fatorDemanda-${id}`);

    const atualizarLigacoes = () => {
        const faseSelecionada = fases.value;
        const ligacoesDisponiveis = ligacoes[faseSelecionada] || [];
        tipoLigacao.innerHTML = '';
        ligacoesDisponiveis.forEach(opt => { const option = document.createElement('option'); option.value = opt.value; option.textContent = opt.text; tipoLigacao.appendChild(option); });
    };
    
    const handleInsulationChange = () => {
        const selectedInsulation = tipoIsolacao.value;
        const temps = selectedInsulation === 'EPR' ? tempOptions.epr : tempOptions.pvc;
        populateTemperatureDropdown(temperaturaAmbiente, temps);
    };

    const handleCircuitTypeChange = () => {
        const selectedType = tipoCircuito.value;
        potenciaWGroup.classList.toggle('hidden', selectedType === 'motores');
        potenciaCVGroup.classList.toggle('hidden', selectedType !== 'motores');
        if (selectedType === 'aquecimento') { fatorDemandaInput.value = '100'; fatorDemandaInput.readOnly = true; } else { fatorDemandaInput.readOnly = false; }
    };

    tipoCircuito.addEventListener('change', handleCircuitTypeChange);
    fases.addEventListener('change', atualizarLigacoes);
    tipoIsolacao.addEventListener('change', handleInsulationChange);

    atualizarLigacoes();
    handleCircuitTypeChange();
    handleInsulationChange();
}

function getCircuitHTML(id){
    return `<div class="circuit-block" id="circuit-${id}" data-id="${id}"><div class="circuit-header"><h2 id="circuit-title-${id}">Circuito ${id}</h2>${id>1?`<button type="button" class="remove-btn" data-circuit-id="${id}">Remover</button>`:''}</div><div class="form-grid"><div class="form-group"><label for="nomeCircuito-${id}">Nome do Circuito</label><input type="text" id="nomeCircuito-${id}" value="Circuito ${id}"></div><div class="form-group"><label for="tipoCircuito-${id}">Tipo de Circuito</label><select id="tipoCircuito-${id}"><option value="iluminacao">Iluminacao</option><option value="tug" selected>Tomadas de Uso Geral (TUG)</option><option value="tue">Tomadas de Uso Especifico (TUE)</option><option value="aquecimento">Aquecimento</option><option value="motores">Circuito de Motores</option><option value="ar_condicionado">Ar Condicionado</option></select></div><div class="form-group" id="potenciaW_group-${id}"><label for="potenciaW-${id}">Potencia (W)</label><input type="number" id="potenciaW-${id}" value="2500"></div><div class="form-group hidden" id="potenciaCV_group-${id}"><label for="potenciaCV-${id}">Potencia do Motor (CV)</label><select id="potenciaCV-${id}"><option value="0.25">1/4</option><option value="1">1</option></select></div><div class="form-group"><label for="fatorDemanda-${id}">Fator de Demanda (%)</label><input type="number" id="fatorDemanda-${id}" value="100" step="1"></div><div class="form-group"><label for="fases-${id}">Sistema de Fases</label><select id="fases-${id}"><option value="Monofasico" selected>Monofasico</option><option value="Bifasico">Bifasico</option><option value="Trifasico">Trifasico</option></select></div><div class="form-group"><label for="tipoLigacao-${id}">Tipo de Ligacao</label><select id="tipoLigacao-${id}"></select></div><div class="form-group"><label for="tensaoV-${id}">Tensao (V)</label><select id="tensaoV-${id}"><option value="127">127 V</option><option value="220" selected>220 V</option></select></div><div class="form-group"><label for="fatorPotencia-${id}">Fator de Potencia (eficiencia)</label><input type="number" id="fatorPotencia-${id}" step="0.01" value="0.92"></div><div class="form-group"><label for="comprimentoM-${id}">Comprimento (m)</label><input type="number" id="comprimentoM-${id}" value="20"></div><div class="form-group"><label for="tipoIsolacao-${id}">Tipo de Isolacao</label><select id="tipoIsolacao-${id}"><option value="PVC" selected>PVC 70 C</option><option value="EPR">EPR/XLPE 90 C</option></select></div><div class="form-group"><label for="materialCabo-${id}">Material do Condutor</label><select id="materialCabo-${id}"><option value="Cobre" selected>Cobre</option><option value="Aluminio">Aluminio</option></select></div><div class="form-group"><label for="metodoInstalacao-${id}">Metodo de Instalacao</label><select id="metodoInstalacao-${id}"><option value="B1" selected>B1</option></select></div><div class="form-group"><label for="temperaturaAmbienteC-${id}">Temperatura Ambiente (C)</label><select id="temperaturaAmbienteC-${id}"></select></div><div class="form-group"><label for="resistividadeSolo-${id}">Resistividade T. do Solo (C.m/W)</label><select id="resistividadeSolo-${id}"><option value="0" selected>Nao Aplicavel</option></select></div><div class="form-group"><label for="numCircuitosAgrupados-${id}">N de Circuitos Agrupados</label><select id="numCircuitosAgrupados-${id}"><option value="1" selected>1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option></select></div><div class="form-group"><label for="limiteQuedaTensao-${id}">Limite Queda de Tensao (%)</label><input type="number" id="limiteQuedaTensao-${id}" step="0.1" value="4.0"></div><div class="form-group"><label for="tipoDisjuntor-${id}">Tipo de Disjuntor</label><select id="tipoDisjuntor-${id}"><option value="Minidisjuntor (DIN)">Minidisjuntor (DIN)</option><option value="Caixa Moldada (MCCB)">Caixa Moldada (MCCB)</option></select></div><div class="form-group"><label for="dpsClasse-${id}">Classe DPS</label><select id="dpsClasse-${id}"><option value="">Nenhum</option><option value="I">I</option><option value="II">II</option></select></div><div class="checkbox-group"><input type="checkbox" id="requerDR-${id}"><label for="requerDR-${id}">Requer Protecao DR</label></div></div></div>`;
}

// --- PREENCHIMENTO DE DADOS ---
export function populateProjectList(projects) {
    const select = document.getElementById('savedProjectsSelect');
    select.innerHTML = '<option value="">-- Selecione uma obra --</option>';
    projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = `${project.project_code || 'S/C'} - ${project.project_name}`;
        select.appendChild(option);
    });
}

export function populateFormWithProjectData(project) {
    document.getElementById('main-form').reset();
    document.getElementById('tech-form').reset();
    document.getElementById('feeder-form').reset();
    document.getElementById('currentProjectId').value = project.id;
    if (project.main_data) {
        Object.keys(project.main_data).forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (el.type === 'textarea') el.value = project.main_data[id] || '';
                else el.value = project.main_data[id];
            }
        });
    }
    document.getElementById('project_code').value = project.project_code || '';

    const clientLinkDisplay = document.getElementById('clientLinkDisplay');
    const currentClientIdInput = document.getElementById('currentClientId');
    if (project.client) {
        clientLinkDisplay.textContent = `Cliente Vinculado: ${project.client.nome} (${project.client.client_code})`;
        currentClientIdInput.value = project.client.id;
    } else {
        clientLinkDisplay.textContent = 'Cliente: Nenhum';
        currentClientIdInput.value = '';
    }

    if (project.tech_data) { Object.keys(project.tech_data).forEach(id => { const el = document.getElementById(id); if (el) el.value = project.tech_data[id]; }); }
    if (project.feeder_data) { Object.keys(project.feeder_data).forEach(id => { const el = document.getElementById(id); if (el) { if (el.type === 'checkbox') el.checked = project.feeder_data[id]; else el.value = project.feeder_data[id]; } }); document.getElementById('feederFases').dispatchEvent(new Event('change')); document.getElementById('feederTipoLigacao').value = project.feeder_data['feederTipoLigacao']; document.getElementById('feederTipoIsolacao').dispatchEvent(new Event('change')); }
    
    document.getElementById('circuits-container').innerHTML = '';
    circuitCount = 0;
    if(project.circuits_data) {
        project.circuits_data.forEach(savedCircuitData => {
            addCircuit();
            const currentId = circuitCount;
            Object.keys(savedCircuitData).forEach(savedId => {
                if (savedId === 'id') return;
                const newId = savedId.replace(`-${savedCircuitData.id}`, `-${currentId}`);
                const element = document.getElementById(newId);
                if (element) {
                    if (element.type === 'checkbox') { element.checked = savedCircuitData[savedId]; } else { element.value = savedCircuitData[savedId]; }
                }
            });
            document.getElementById(`fases-${currentId}`).dispatchEvent(new Event('change'));
            document.getElementById(`tipoLigacao-${currentId}`).value = savedCircuitData[`tipoLigacao-${savedCircuitData.id}`];
            document.getElementById(`tipoCircuito-${currentId}`).dispatchEvent(new Event('change'));
            document.getElementById(`tipoIsolacao-${currentId}`).dispatchEvent(new Event('change'));
        });
    }
}

// --- PAINEL DE ADMINISTRAÇÃO ---
export function populateUsersPanel(users) {
    const list = document.getElementById('adminUserList');
    list.innerHTML = '';
    if (!users || users.length === 0) {
        list.innerHTML = '<li>Nenhum usuário encontrado.</li>';
        return;
    }
    users.forEach(user => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>
                <strong>${user.nome || 'Nome não preenchido'}</strong><br>
                <small>${user.email}</small>
            </span>
            <div class="admin-user-actions">
                ${!user.is_approved ? `<button class="approve-user-btn btn-success" data-user-id="${user.id}">Aprovar</button>` : ''}
                <button class="edit-user-btn btn-secondary" data-user-id="${user.id}">Editar</button>
                <button class="remove-user-btn btn-danger" data-user-id="${user.id}">Remover</button>
            </div>
        `;
        list.appendChild(li);
    });
}
export function populateEditUserModal(userData) {
    document.getElementById('editUserId').value = userData.id;
    document.getElementById('editNome').value = userData.nome || '';
    document.getElementById('editEmail').value = userData.email || '';
    document.getElementById('editCpf').value = userData.cpf || '';
    document.getElementById('editTelefone').value = userData.telefone || '';
    document.getElementById('editCrea').value = userData.crea || '';
    openModal('editUserModalOverlay');
}

export function populateProjectsPanel(projects, clients, users, currentUserProfile) {
    const tableBody = document.getElementById('adminProjectsTableBody');
    const tableHead = document.querySelector('#adminProjectsTable thead tr');

    const isAdmin = currentUserProfile?.is_admin || false;

    // Atualiza o cabeçalho da tabela
    tableHead.innerHTML = `
        <th>Código</th>
        <th>Obra</th>
        <th>Dono (Login)</th>
        <th>Cliente Vinculado</th>
        <th>Ações</th>
    `;

    tableBody.innerHTML = '';
    projects.forEach(project => {
        const row = document.createElement('tr');
        const ownerName = project.owner?.nome || project.owner?.email || 'Desconhecido';

        // HTML para as ações (pode ser complexo, então construímos em partes)
        let actionsHtml = `<div class="action-cell">`;

        // Ação 1: Transferir Cliente (visível para todos)
        const clientOptions = clients.map(c => 
            `<option value="${c.id}" ${c.id === project.client_id ? 'selected' : ''}>${c.nome}</option>`
        ).join('');
        actionsHtml += `
            <div class="action-group">
                <label>Cliente:</label>
                <select class="transfer-client-select" data-project-id="${project.id}">
                    <option value="">-- Desvincular --</option>
                    ${clientOptions}
                </select>
                <button class="transfer-client-btn btn-success" data-project-id="${project.id}">Salvar</button>
            </div>
        `;

        // Ação 2: Transferir Dono (visível apenas para Admins)
        if (isAdmin) {
            const ownerOptions = users.map(u => 
                `<option value="${u.id}" ${u.id === project.owner_id ? 'selected' : ''}>${u.nome || u.email}</option>`
            ).join('');
            actionsHtml += `
                <div class="action-group">
                    <label>Transferir Dono:</label>
                    <select class="transfer-owner-select" data-project-id="${project.id}">
                        ${ownerOptions}
                    </select>
                    <button class="transfer-owner-btn btn-secondary" data-project-id="${project.id}">Transferir</button>
                </div>
            `;
        }

        actionsHtml += `</div>`; // Fecha action-cell
        
        row.innerHTML = `
            <td>${project.project_code || 'S/C'}</td>
            <td>${project.project_name}</td>
            <td>${ownerName}</td>
            <td>${project.client?.nome || 'Nenhum'}</td>
            <td>${actionsHtml}</td>
        `;
        tableBody.appendChild(row);
    });
}

// --- GERENCIAMENTO DE CLIENTES ---
export function populateClientManagementModal(clients) {
    const list = document.getElementById('clientList');
    list.innerHTML = '';
    if (clients.length === 0) {
        list.innerHTML = '<li>Nenhum cliente cadastrado.</li>';
        return;
    }
    clients.forEach(client => {
        const hasProjects = client.projects && client.projects.length > 0;
        const li = document.createElement('li');
        li.innerHTML = `
            <span>
                <strong>${client.nome}</strong> (${client.client_code || 'S/C'})<br>
                <small>${client.documento_valor || 'Sem documento'} - ${client.email || 'Sem email'}</small>
            </span>
            <div class="client-actions">
                <button class="edit-client-btn btn-secondary" data-client-id="${client.id}">Editar</button>
                <button class="delete-client-btn btn-danger" data-client-id="${client.id}" ${hasProjects ? 'disabled title="Cliente possui obras vinculadas"' : ''}>Excluir</button>
            </div>
        `;
        list.appendChild(li);
    });
}

export function resetClientForm() {
    const form = document.getElementById('clientForm');
    form.reset();
    document.getElementById('clientId').value = '';
    document.getElementById('clientFormTitle').textContent = 'Cadastrar Novo Cliente';
    document.getElementById('clientFormSubmitBtn').textContent = 'Salvar Cliente';
    document.getElementById('clientFormCancelBtn').style.display = 'none';
}

export function openEditClientForm(client) {
    document.getElementById('clientId').value = client.id;
    document.getElementById('clientNome').value = client.nome;
    document.getElementById('clientDocumentoTipo').value = client.documento_tipo;
    document.getElementById('clientDocumentoValor').value = client.documento_valor;
    document.getElementById('clientEmail').value = client.email;
    document.getElementById('clientCelular').value = client.celular;
    document.getElementById('clientTelefone').value = client.telefone;
    document.getElementById('clientEndereco').value = client.endereco;
    document.getElementById('clientFormTitle').textContent = 'Editar Cliente';
    document.getElementById('clientFormSubmitBtn').textContent = 'Atualizar Cliente';
    document.getElementById('clientFormCancelBtn').style.display = 'inline-block';
}

export function populateSelectClientModal(clients, isChange = false) {
    const select = document.getElementById('clientSelectForNewProject');
    select.innerHTML = '<option value="">-- Selecione um cliente --</option>';
    clients.forEach(client => {
        const option = document.createElement('option');
        option.value = client.id;
        option.textContent = `${client.nome} (${client.client_code})`;
        option.dataset.client = JSON.stringify(client);
        select.appendChild(option);
    });

    const title = document.querySelector('#selectClientModalOverlay h3');
    const confirmBtn = document.getElementById('confirmClientSelectionBtn');
    if (isChange) {
        title.textContent = 'Vincular / Alterar Cliente da Obra';
        confirmBtn.textContent = 'Confirmar Alteração';
    } else {
        title.textContent = 'Vincular Cliente à Nova Obra';
        confirmBtn.textContent = 'Vincular e Continuar';
    }

    openModal('selectClientModalOverlay');
}

// --- RELATÓRIOS E PDF ---
// Funções renderReport e generatePdf permanecem inalteradas...
function getDpsText(dpsInfo) {
    if (!dpsInfo) return 'Nao';
    return `Sim, Classe ${dpsInfo.classe} (${dpsInfo.corrente_ka} kA)`;
}
export function renderReport(calculationResults){
    if(!calculationResults) return;
    const { feederResult, circuitResults } = calculationResults;
    const dataHora = (new Date).toLocaleString('pt-BR');
    const formatLine = (label, value) => (label + ':').padEnd(30, ' ') + value;
    let reportText = `======================================================\n==           RELATORIO DE PROJETO ELETRICO           ==\n======================================================\n${formatLine('Gerado em', dataHora)}\n`;
    
    const reportData = feederResult.dados;
    reportText += `\n-- DADOS DA OBRA E CLIENTE --\n`;
    reportText += `${formatLine('Cliente', reportData.cliente || 'Nao informado')}\n`;
    reportText += `${formatLine(`Documento (${reportData.tipoDocumento})`, reportData.documento || 'Nao informado')}\n`;
    reportText += `${formatLine('Celular', reportData.celular || '-')}\n`;
    reportText += `${formatLine('Telefone', reportData.telefone || '-')}\n`;
    reportText += `${formatLine('E-mail', reportData.email || '-')}\n`;
    reportText += `${formatLine('Endereço do Cliente', reportData.enderecoCliente || '-')}\n`;
    reportText += `\n-- DADOS DA OBRA --\n`;
    reportText += `${formatLine('Código da Obra', reportData.projectCode || '-')}\n`;
    reportText += `${formatLine('Nome da Obra', reportData.obra || '-')}\n`;
    reportText += `${formatLine('Cidade da Obra', reportData.cidadeObra || '-')}\n`;
    reportText += `${formatLine('Endereço da Obra', reportData.enderecoObra || '-')}\n`;
    reportText += `${formatLine('Área da Obra (m²)', reportData.areaObra || '-')}\n`;
    reportText += `${formatLine('Unid. Residenciais', reportData.unidadesResidenciais || '-')}\n`;
    reportText += `${formatLine('Unid. Comerciais', reportData.unidadesComerciais || '-')}\n`;
    reportText += `${formatLine('Observações', reportData.observacoes || '-')}\n`;

    const respTecnico = document.getElementById('respTecnico').value;
    if (respTecnico) {
        reportText += `\n-- RESPONSAVEL TECNICO --\n`;
        reportText += `${formatLine('Nome', respTecnico)}\n`;
        reportText += `${formatLine('CREA', document.getElementById('crea').value)}\n`;
    }

    reportText += `\n-- QUADRO DE CARGAS RESUMIDO --\n`;
    reportText += `${formatLine(`Alimentador Geral`, `Carga Total: ${feederResult.calculos.potenciaDemandada.toFixed(2)} W`)}\n`;
    circuitResults.forEach(result => {
        reportText += `${formatLine(`Circuito ${result.dados.id}`, `${result.dados.nomeCircuito} - ${result.calculos.potenciaDemandada.toFixed(2)} W`)}\n`;
    });

    const allCalculations = [feederResult, ...circuitResults];
    allCalculations.forEach(result => {
        const { dados, calculos } = result;
        const title = dados.id === 'Geral' ? 'ALIMENTADOR GERAL' : `CIRCUITO ${dados.id}`;
        const correnteCorrigidaTexto = isFinite(calculos.correnteCorrigidaA) ? `${calculos.correnteCorrigidaA.toFixed(2)} A` : "Incalculável (Fator de Correção Zero)";
        
        reportText += `\n\n======================================================\n==           MEMORIAL DE CALCULO - ${title.padEnd(16, ' ')} ==\n======================================================\n`;
        reportText += `\n-- IDENTIFICACAO DO CIRCUITO --\n`;
        reportText += `${formatLine('Nome do Circuito', dados.nomeCircuito)}\n`;
        reportText += `\n-- CARGA E DEMANDA --\n`;
        reportText += `${formatLine('Potencia Instalada', `${calculos.potenciaInstalada.toFixed(2)} W`)}\n`;
        reportText += `${formatLine('Corrente Instalada', `${calculos.correnteInstalada.toFixed(2)} A`)}\n`;
        reportText += `${formatLine('Fator de Demanda Aplicado (%)', `${dados.fatorDemanda}%`)}\n`;
        reportText += `${formatLine('Potencia Demandada', `${calculos.potenciaDemandada.toFixed(2)} W`)}\n`;
        reportText += `${formatLine('Corrente Demandada (Ib)', `${calculos.correnteDemandada.toFixed(2)} A`)}\n`;
        
        reportText += `\n-- ESPECIFICACOES DO CABO E CORRECOES --\n`;
        reportText += `${formatLine('Sistema de Fases', dados.fases)}\n`;
        reportText += `${formatLine('Tipo de Ligação', dados.tipoLigacao)}\n`;
        reportText += `${formatLine('Tensão (V)', `${dados.tensaoV} V`)}\n`;
        reportText += `${formatLine('Material / Isolacao', `${dados.materialCabo} / ${dados.tipoIsolacao}`)}\n`;
        reportText += `${formatLine('Metodo de Instalacao', dados.metodoInstalacao)}\n`;
        reportText += `${formatLine('Comprimento (m)', `${dados.comprimentoM} m`)}\n`;
        reportText += `${formatLine('Temperatura Ambiente', `${dados.temperaturaAmbienteC}°C`)}\n`;
        if (dados.id !== 'Geral') {
             reportText += `${formatLine('Circuitos Agrupados', dados.numCircuitosAgrupados)}\n`;
        }
        if(dados.id !== 'Geral' && calculos.fatorK1) {
           reportText += `${formatLine('Fatores de Correcao', `K1=${calculos.fatorK1.toFixed(2)}, K2=${calculos.fatorK2.toFixed(2)}, K3=${calculos.fatorK3.toFixed(2)}`)}\n`;
        }
        reportText += `${formatLine('Corrente p/ Dimensionar', correnteCorrigidaTexto)}\n`;

        reportText += `\n-- RESULTADOS DE DIMENSIONAMENTO --\n`;
        reportText += `${formatLine('Bitola Recomendada', `${calculos.bitolaRecomendadaMm2} mm²`)}\n`;
        reportText += `${formatLine('Queda de Tensao (DV)', `${calculos.quedaTensaoCalculada.toFixed(2)} %`)}\n`;
        reportText += `${formatLine('Corrente Max. Cabo (Iz)', `${calculos.correnteMaximaCabo.toFixed(2)} A`)}\n`;
        reportText += `\n-- PROTECOES RECOMENDADAS --\n`;
        reportText += `${formatLine(`Disjuntor (${dados.tipoDisjuntor})`, `${calculos.disjuntorRecomendado.nome} (Icc: ${calculos.disjuntorRecomendado.icc} kA)`)}\n`;
        reportText += `${formatLine('Protecao DR 30mA', dados.requerDR ? `Sim (usar ${calculos.disjuntorRecomendado.nome.replace('A','')}A / 30mA)` : 'Nao')}\n`;
        reportText += `${formatLine('Protecao DPS', getDpsText(dados.dpsInfo))}\n`;
        reportText += `${formatLine('Eletroduto (aprox.)', `${calculos.dutoRecomendado} (${calculos.numCondutores} condutores)`)}\n`;
    });
    document.getElementById('report').textContent = reportText.trim();
}
export function generatePdf(calculationResults, currentUserProfile) {
    if (!calculationResults) return;
    const { feederResult, circuitResults } = calculationResults;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    let yPos = 20;
    const leftMargin = 15;
    const valueMargin = 75; 

    doc.setFont('helvetica', 'normal');
    
    const addTitle = (title) => { doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.text(title, 105, yPos, { align: 'center' }); yPos += 12; };
    const addSection = (title) => { if (yPos > 260) { doc.addPage(); yPos = 20; } doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text(title, leftMargin, yPos); yPos += 8; };
    const addLineItem = (label, value) => { if (yPos > 270) { doc.addPage(); yPos = 20; } doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.text(label, leftMargin, yPos); doc.setFont('helvetica', 'normal'); doc.text(String(value || '-'), valueMargin, yPos); yPos += 6; };
    
    addTitle("RELATÓRIO DE PROJETO ELÉTRICO");

    const reportData = feederResult.dados;
    
    addSection("DADOS DO CLIENTE");
    addLineItem("Cliente:", reportData.cliente);
    addLineItem(`Documento (${reportData.tipoDocumento}):`, reportData.documento);
    addLineItem("Celular:", reportData.celular);
    addLineItem("Telefone:", reportData.telefone);
    addLineItem("E-mail:", reportData.email);
    addLineItem("Endereço do Cliente:", reportData.enderecoCliente);
    yPos += 5;

    addSection("DADOS DA OBRA");
    addLineItem("Código da Obra:", reportData.projectCode);
    addLineItem("Nome da Obra:", reportData.obra);
    addLineItem("Cidade da Obra:", reportData.cidadeObra);
    addLineItem("Endereço da Obra:", reportData.enderecoObra);
    addLineItem("Área da Obra (m²):", reportData.areaObra);
    addLineItem("Unid. Residenciais:", reportData.unidadesResidenciais);
    addLineItem("Unid. Comerciais:", reportData.unidadesComerciais);
    addLineItem("Observações:", reportData.observacoes);
    yPos += 5;

    addSection("INFORMAÇÕES DO RESPONSÁVEL TÉCNICO");
    addLineItem("Nome:", document.getElementById('respTecnico').value);
    addLineItem("Título:", document.getElementById('titulo').value);
    addLineItem("CREA:", document.getElementById('crea').value);
    yPos += 5;

    addSection("INFORMAÇÕES DO RELATÓRIO");
    const dataFormatada = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    addLineItem("Gerado em:", dataFormatada);
    addLineItem("Gerado por:", currentUserProfile?.nome || 'N/A');
    yPos += 5;

    addSection("RESUMO DA ALIMENTAÇÃO GERAL");
    const feederBreakerType = feederResult.dados.tipoDisjuntor.includes('Caixa Moldada') ? 'MCCB' : 'DIN';
    const feederBreakerText = `${feederBreakerType} ${feederResult.calculos.disjuntorRecomendado.nome}`;
    const feederHead = [['Carga Total', 'Tensão/Fases', 'Disjuntor Geral', 'DR', 'DPS', 'Cabo', 'Eletroduto']];
    const feederBody = [[
        `${feederResult.calculos.potenciaDemandada.toFixed(2)} W`,
        `${feederResult.dados.tensaoV}V - ${feederResult.dados.fases}`,
        feederBreakerText,
        feederResult.dados.requerDR ? 'Sim' : 'Nao',
        getDpsText(feederResult.dados.dpsInfo),
        `${feederResult.calculos.bitolaRecomendadaMm2} mm²`,
        feederResult.calculos.dutoRecomendado
    ]];
    doc.autoTable({ startY: yPos, head: feederHead, body: feederBody, theme: 'grid', headStyles: { fillColor: [44, 62, 80] }, styles: { fontSize: 8 } });
    yPos = doc.lastAutoTable.finalY + 10;

    if (circuitResults.length > 0) {
        addSection("RESUMO DOS CIRCUITOS");
        const head = [['Ckt', 'Nome', 'Pot. (W)', 'Disjuntor', 'DR', 'DPS', 'Cabo', 'Eletroduto']];
        const body = circuitResults.map(r => {
            const circuitBreakerType = r.dados.tipoDisjuntor.includes('Caixa Moldada') ? 'MCCB' : 'DIN';
            const circuitBreakerText = `${circuitBreakerType} ${r.calculos.disjuntorRecomendado.nome}`;
            return [
                r.dados.id,
                r.dados.nomeCircuito,
                r.calculos.potenciaDemandada.toFixed(2),
                circuitBreakerText,
                r.dados.requerDR ? 'Sim' : 'Nao',
                getDpsText(r.dados.dpsInfo),
                `${r.calculos.bitolaRecomendadaMm2} mm²`,
                r.calculos.dutoRecomendado
            ];
        });
        doc.autoTable({ startY: yPos, head: head, body: body, theme: 'grid', headStyles: { fillColor: [44, 62, 80] }, styles: { fontSize: 8 } });
    }
    
    const allCalculationsForMemorial = [feederResult, ...circuitResults];
    allCalculationsForMemorial.forEach(result => {
        doc.addPage();
        yPos = 20;
        const { dados, calculos } = result;
        const correnteCorrigidaTexto = isFinite(calculos.correnteCorrigidaA) ? `${calculos.correnteCorrigidaA.toFixed(2)} A` : "Incalculável";

        const title = dados.id === 'Geral' 
            ? `MEMORIAL DE CÁLCULO - ALIMENTADOR GERAL`
            : `MEMORIAL DE CÁLCULO - CIRCUITO ${dados.id}: ${dados.nomeCircuito}`;

        addTitle(title);
        addSection("-- CARGA E DEMANDA --");
        addLineItem("Potência Instalada:", `${calculos.potenciaInstalada.toFixed(2)} W`);
        addLineItem("Fator de Demanda (%):", `${dados.fatorDemanda}%`);
        addLineItem("Potência Demandada:", `${calculos.potenciaDemandada.toFixed(2)} W`);
        addLineItem("Corrente Demandada:", `${calculos.correnteDemandada.toFixed(2)} A`);
        addLineItem("Corrente Corrigida (I'):", correnteCorrigidaTexto);
        addLineItem("Queda de Tensão:", `${calculos.quedaTensaoCalculada.toFixed(2)}% (Limite: ${dados.limiteQuedaTensao}%)`);
        yPos += 5;

        addSection("-- DIMENSIONAMENTO DE INFRA --");
        addLineItem("Sistema de Fases:", dados.fases);
        addLineItem("Tipo de Ligação:", dados.tipoLigacao);
        addLineItem("Tensão (V):", `${dados.tensaoV} V`);
        addLineItem("Material / Isolação:", `${dados.materialCabo} / ${dados.tipoIsolacao}`);
        addLineItem("Método de Instalação:", dados.metodoInstalacao);
        addLineItem("Distância:", `${dados.comprimentoM} m`);
        addLineItem("Temperatura Ambiente:", `${dados.temperaturaAmbienteC}°C`);
        if (dados.id !== 'Geral') {
            addLineItem("Circuitos Agrupados:", dados.numCircuitosAgrupados);
        }
        yPos += 5;

        addSection("-- PROTEÇÕES RECOMENDADAS --");
        addLineItem("Disjuntor:", `${dados.tipoDisjuntor}: ${calculos.disjuntorRecomendado.nome} (Icc: ${calculos.disjuntorRecomendado.icc} kA)`);
        addLineItem("Proteção DR:", dados.requerDR ? `Sim (${calculos.disjuntorRecomendado.nome.replace('A','')}A / 30mA)` : 'Não');
        addLineItem("Proteção DPS:", getDpsText(dados.dpsInfo));
    });

    doc.save(`Relatorio_${document.getElementById('obra').value || 'Projeto'}.pdf`);
}