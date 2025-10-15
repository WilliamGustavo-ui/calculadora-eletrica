// Arquivo: ui.js (VERSÃO COM DIAGRAMA PROFISSIONAL HORIZONTAL)

import { ligacoes, BTU_TO_WATTS_FACTOR, CV_TO_WATTS_FACTOR } from './utils.js';
import { Canvg } from 'https://cdn.skypack.dev/canvg';

let circuitCount = 0;
let technicalData = null;
let tempOptions = { pvc: [], epr: [] };

// --- FUNÇÕES DE SETUP E HELPERS ---

export function setupDynamicData(techData) {
    technicalData = techData;
    if (techData?.fatores_k1) {
        tempOptions.pvc = techData.fatores_k1.filter(f => f.fator > 0).map(f => f.temperatura_c).sort((a, b) => a - b);
    }
    if (techData?.fatores_k1_epr) {
        tempOptions.epr = techData.fatores_k1_epr.filter(f => f.fator > 0).map(f => f.temperatura_c).sort((a, b) => a - b);
    } else {
        tempOptions.epr = tempOptions.pvc;
    }
}

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

function populateBtuDropdown(selectElement, btuData) {
    selectElement.innerHTML = '';
    if (!btuData) return;
    btuData.sort((a, b) => a.valor_btu - b.valor_btu).forEach(item => {
        const option = document.createElement('option');
        option.value = item.valor_btu;
        option.textContent = item.descricao;
        selectElement.appendChild(option);
    });
}

function populateCvDropdown(selectElement, cvData) {
    selectElement.innerHTML = '';
    if (!cvData) return;
    cvData.sort((a, b) => a.valor_cv - b.valor_cv).forEach(item => {
        const option = document.createElement('option');
        option.value = item.valor_cv;
        option.textContent = item.descricao;
        selectElement.appendChild(option);
    });
}

function populateSoilResistivityDropdown(selectElement, soilData) {
    selectElement.innerHTML = '<option value="0">Não Aplicável</option>';
    if (!soilData) return;
    soilData.sort((a, b) => a.resistividade - b.resistividade).forEach(item => {
        const option = document.createElement('option');
        option.value = item.resistividade;
        option.textContent = `${item.resistividade}`;
        selectElement.appendChild(option);
    });
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

// --- FUNÇÕES DE VISIBILIDADE E MODAIS ---
export function showLoginView() { document.getElementById('loginContainer').style.display = 'block'; document.getElementById('appContainer').style.display = 'none'; document.getElementById('resetPasswordContainer').style.display = 'none'; }
export function showAppView(userProfile) {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    document.getElementById('resetPasswordContainer').style.display = 'none';
    const isAdmin = userProfile?.is_admin || false;
    document.getElementById('adminPanelBtn').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('manageClientsBtn').style.display = 'block';
    document.getElementById('manageProjectsBtn').style.display = 'block';
}
export function showResetPasswordView() { document.getElementById('loginContainer').style.display = 'none'; document.getElementById('appContainer').style.display = 'none'; document.getElementById('resetPasswordContainer').style.display = 'block'; }
export function openModal(modalId) { document.getElementById(modalId).style.display = 'flex'; }
export function closeModal(modalId) { document.getElementById(modalId).style.display = 'none'; }


// --- LÓGICA DE FORMULÁRIO E CIRCUITOS (COM ABAS) ---

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
    handleInsulationChange(circuitCount);
    handleCircuitTypeChange(circuitCount);

    const potenciaBTUSelect = document.getElementById(`potenciaBTU-${circuitCount}`);
    const potenciaCVSelect = document.getElementById(`potenciaCV-${circuitCount}`);
    const resistividadeSolo = document.getElementById(`resistividadeSolo-${circuitCount}`);
    populateBtuDropdown(potenciaBTUSelect, technicalData.ar_condicionado_btu);
    populateCvDropdown(potenciaCVSelect, technicalData.motores_cv);
    populateSoilResistivityDropdown(resistividadeSolo, technicalData.fatores_k2);
}

export function removeCircuit(id) {
    document.getElementById(`circuit-${id}`)?.remove();
    updateFeederPowerDisplay();
}

function getCircuitHTML(id) {
    return `<div class="circuit-block" id="circuit-${id}" data-id="${id}">
        <div class="circuit-header">
            <h2>Circuito <span class="circuit-number"></span> <span id="nomeCircuitoLabel-${id}">- Circuito ${id}</span></h2>
            <div style="display: flex; align-items: center;">
                <button type="button" class="remove-btn btn-danger" data-circuit-id="${id}">Remover</button>
                <span class="toggle-arrow" style="margin-left: 15px;">▼</span>
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

// --- LÓGICA DE EVENTOS (COM ABAS) ---

function initializeFeederListeners() {
    const fases = document.getElementById('feederFases');
    const tipoLigacao = document.getElementById('feederTipoLigacao');
    const tipoIsolacao = document.getElementById('feederTipoIsolacao');
    const temperaturaAmbiente = document.getElementById('feederTemperaturaAmbienteC');
    const resistividadeSolo = document.getElementById('feederResistividadeSolo');

    populateSoilResistivityDropdown(resistividadeSolo, technicalData.fatores_k2);

    const atualizarLigacoesFeeder = () => {
        const faseSelecionada = fases.value;
        const ligacoesDisponiveis = ligacoes[faseSelecionada] || [];
        tipoLigacao.innerHTML = '';
        ligacoesDisponiveis.forEach(opt => { const option = document.createElement('option'); option.value = opt.value; option.textContent = opt.text; tipoLigacao.appendChild(option); });
    };

    const handleFeederInsulationChange = () => {
        const selectedInsulation = tipoIsolacao.value;
        const temps = (selectedInsulation === 'EPR' || selectedInsulation === 'XLPE') ? tempOptions.epr : tempOptions.pvc;
        populateTemperatureDropdown(temperaturaAmbiente, temps);
    };

    fases.addEventListener('change', atualizarLigacoesFeeder);
    tipoIsolacao.addEventListener('change', handleFeederInsulationChange);

    atualizarLigacoesFeeder();
    handleFeederInsulationChange();
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
        document.getElementById(`nomeCircuitoLabel-${id}`).textContent = ` - ${target.value}`;
    }

    if (target.classList.contains('remove-btn')) { removeCircuit(target.dataset.circuitId); }
    else if (target.id === `tipoCircuito-${id}`) { handleCircuitTypeChange(id); }
    else if (target.id === `fases-${id}`) { atualizarLigacoes(id); }
    else if (target.id === `tipoIsolacao-${id}`) { handleInsulationChange(id); }
    else if (target.id === `potenciaBTU-${id}` || target.id === `potenciaCV-${id}`) { handlePowerUnitChange(id, target.id.includes('BTU') ? 'btu' : 'cv'); }
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

function handleInsulationChange(id) {
    const tipoIsolacao = document.getElementById(`tipoIsolacao-${id}`);
    const temperaturaAmbiente = document.getElementById(`temperaturaAmbienteC-${id}`);
    const selectedInsulation = tipoIsolacao.value;
    const temps = (selectedInsulation === 'EPR' || selectedInsulation === 'XLPE') ? tempOptions.epr : tempOptions.pvc;
    populateTemperatureDropdown(temperaturaAmbiente, temps);
}

function handlePowerUnitChange(id, type) {
    const potenciaWInput = document.getElementById(`potenciaW-${id}`);
    if (type === 'btu') {
        const btuValue = parseFloat(document.getElementById(`potenciaBTU-${id}`).value) || 0;
        potenciaWInput.value = (btuValue * BTU_TO_WATTS_FACTOR).toFixed(2);
    } else { // cv
        const cvValue = parseFloat(document.getElementById(`potenciaCV-${id}`).value) || 0;
        potenciaWInput.value = (cvValue * CV_TO_WATTS_FACTOR).toFixed(2);
    }
    updateFeederPowerDisplay();
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
    fatorDemandaInput.readOnly = false;

    if (selectedType === 'ar_condicionado') {
        potenciaBTUGroup.classList.remove('hidden');
        potenciaWInput.readOnly = true;
        handlePowerUnitChange(id, 'btu');
    } else if (selectedType === 'motores') {
        potenciaCVGroup.classList.remove('hidden');
        potenciaWInput.readOnly = true;
        handlePowerUnitChange(id, 'cv');
    } else if (selectedType === 'aquecimento') {
        fatorDemandaInput.value = '100';
        fatorDemandaInput.readOnly = true;
    }
    updateFeederPowerDisplay();
}

// --- FUNÇÕES DE PREENCHIMENTO DE DADOS ---
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
    resetForm(false, project.client);

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
    
    if (project.tech_data) { Object.keys(project.tech_data).forEach(id => { const el = document.getElementById(id); if (el) el.value = project.tech_data[id]; }); }
    
    if (project.feeder_data) { 
        Object.keys(project.feeder_data).forEach(id => { 
            const el = document.getElementById(id); 
            if (el) { 
                if (el.type === 'checkbox') el.checked = project.feeder_data[id]; 
                else el.value = project.feeder_data[id]; 
            } 
        }); 
        document.getElementById('feederFases').dispatchEvent(new Event('change')); 
        document.getElementById('feederTipoLigacao').value = project.feeder_data['feederTipoLigacao']; 
        document.getElementById('feederTipoIsolacao').dispatchEvent(new Event('change')); 
    }
    
    if (project.circuits_data) {
        project.circuits_data.forEach((savedCircuitData, index) => {
            addCircuit();
            const currentId = circuitCount;
            if (index > 0) {
                document.getElementById(`circuit-${currentId}`).classList.add('collapsed');
            }

            Object.keys(savedCircuitData).forEach(savedId => {
                if (savedId === 'id' || savedId.endsWith('_value')) return;
                const newId = savedId.replace(`-${savedCircuitData.id}`, `-${currentId}`);
                const element = document.getElementById(newId);
                if (element) {
                    if (element.type === 'checkbox') { element.checked = savedCircuitData[savedId]; }
                    else { element.value = savedCircuitData[savedId]; }
                }
            });

            document.getElementById(`fases-${currentId}`).dispatchEvent(new Event('change'));
            document.getElementById(`tipoLigacao-${currentId}`).value = savedCircuitData[`tipoLigacao-${savedCircuitData.id}`];
            document.getElementById(`tipoIsolacao-${currentId}`).dispatchEvent(new Event('change'));
            document.getElementById(`tipoCircuito-${currentId}`).dispatchEvent(new Event('change'));
            document.getElementById(`nomeCircuito-${currentId}`).dispatchEvent(new Event('input', { bubbles: true }));

            if (savedCircuitData.tipoCircuito === 'ar_condicionado' && savedCircuitData.potenciaBTU_value) {
                document.getElementById(`potenciaBTU-${currentId}`).value = savedCircuitData.potenciaBTU_value;
                document.getElementById(`potenciaBTU-${currentId}`).dispatchEvent(new Event('change'));
            } else if (savedCircuitData.tipoCircuito === 'motores' && savedCircuitData.potenciaCV_value) {
                document.getElementById(`potenciaCV-${currentId}`).value = savedCircuitData.potenciaCV_value;
                document.getElementById(`potenciaCV-${currentId}`).dispatchEvent(new Event('change'));
            }
        });
    }
    updateFeederPowerDisplay();
}

export function populateUsersPanel(users) {
    const list = document.getElementById('adminUserList');
    list.innerHTML = '';
    if (!users || users.length === 0) { list.innerHTML = '<li>Nenhum usuário encontrado.</li>'; return; }
    users.forEach(user => {
        const li = document.createElement('li');
        li.innerHTML = `<span><strong>${user.nome || 'Nome não preenchido'}</strong><br><small>${user.email}</small></span><div class="admin-user-actions">${!user.is_approved ? `<button class="approve-user-btn btn-success" data-user-id="${user.id}">Aprovar</button>` : ''}<button class="edit-user-btn btn-secondary" data-user-id="${user.id}">Editar</button><button class="remove-user-btn btn-danger" data-user-id="${user.id}">Remover</button></div>`;
        list.appendChild(li);
    });
}
export function populateEditUserModal(userData) { document.getElementById('editUserId').value = userData.id; document.getElementById('editNome').value = userData.nome || ''; document.getElementById('editEmail').value = userData.email || ''; document.getElementById('editCpf').value = userData.cpf || ''; document.getElementById('editTelefone').value = userData.telefone || ''; document.getElementById('editCrea').value = userData.crea || ''; openModal('editUserModalOverlay'); }
export function populateProjectsPanel(projects, clients, users, currentUserProfile) {
    const tableBody = document.getElementById('adminProjectsTableBody');
    const tableHead = document.querySelector('#adminProjectsTable thead tr');
    const isAdmin = currentUserProfile?.is_admin || false;
    tableHead.innerHTML = `<th>Código</th><th>Obra</th><th>Dono (Login)</th><th>Cliente Vinculado</th><th>Ações</th>`;
    tableBody.innerHTML = '';
    projects.forEach(project => {
        const row = document.createElement('tr');
        const ownerName = project.owner?.nome || project.owner?.email || 'Desconhecido';
        let actionsHtml = `<div class="action-cell">`;
        const clientOptions = clients.map(c => `<option value="${c.id}" ${c.id === project.client_id ? 'selected' : ''}>${c.nome}</option>`).join('');
        actionsHtml += `<div class="action-group"><label>Cliente:</label><select class="transfer-client-select" data-project-id="${project.id}"><option value="">-- Desvincular --</option>${clientOptions}</select><button class="transfer-client-btn btn-success" data-project-id="${project.id}">Salvar</button></div>`;
        if (isAdmin) {
            const ownerOptions = users.map(u => `<option value="${u.id}" ${u.id === project.owner_id ? 'selected' : ''}>${u.nome || u.email}</option>`).join('');
            actionsHtml += `<div class="action-group"><label>Transferir Dono:</label><select class="transfer-owner-select" data-project-id="${project.id}">${ownerOptions}</select><button class="transfer-owner-btn btn-secondary" data-project-id="${project.id}">Transferir</button></div>`;
        }
        actionsHtml += `</div>`;
        row.innerHTML = `<td>${project.project_code || 'S/C'}</td><td>${project.project_name}</td><td>${ownerName}</td><td>${project.client?.nome || 'Nenhum'}</td><td>${actionsHtml}</td>`;
        tableBody.appendChild(row);
    });
}
export function populateClientManagementModal(clients) {
    const list = document.getElementById('clientList');
    list.innerHTML = '';
    if (clients.length === 0) { list.innerHTML = '<li>Nenhum cliente cadastrado.</li>'; return; }
    clients.forEach(client => {
        const hasProjects = client.projects && client.projects.length > 0;
        const li = document.createElement('li');
        li.innerHTML = `<span><strong>${client.nome}</strong> (${client.client_code || 'S/C'})<br><small>${client.documento_valor || 'Sem documento'} - ${client.email || 'Sem email'}</small></span><div class="client-actions"><button class="edit-client-btn btn-secondary" data-client-id="${client.id}">Editar</button><button class="delete-client-btn btn-danger" data-client-id="${client.id}" ${hasProjects ? 'disabled title="Cliente possui obras vinculadas"' : ''}>Excluir</button></div>`;
        list.appendChild(li);
    });
}
export function resetClientForm() { const form = document.getElementById('clientForm'); form.reset(); document.getElementById('clientId').value = ''; document.getElementById('clientFormTitle').textContent = 'Cadastrar Novo Cliente'; document.getElementById('clientFormSubmitBtn').textContent = 'Salvar Cliente'; document.getElementById('clientFormCancelBtn').style.display = 'none'; }
export function openEditClientForm(client) { document.getElementById('clientId').value = client.id; document.getElementById('clientNome').value = client.nome; document.getElementById('clientDocumentoTipo').value = client.documento_tipo; document.getElementById('clientDocumentoValor').value = client.documento_valor; document.getElementById('clientEmail').value = client.email; document.getElementById('clientCelular').value = client.celular; document.getElementById('clientTelefone').value = client.telefone; document.getElementById('clientEndereco').value = client.endereco; document.getElementById('clientFormTitle').textContent = 'Editar Cliente'; document.getElementById('clientFormSubmitBtn').textContent = 'Atualizar Cliente'; document.getElementById('clientFormCancelBtn').style.display = 'inline-block'; }
export function populateSelectClientModal(clients, isChange = false) { const select = document.getElementById('clientSelectForNewProject'); select.innerHTML = '<option value="">-- Selecione um cliente --</option>'; clients.forEach(client => { const option = document.createElement('option'); option.value = client.id; option.textContent = `${client.nome} (${client.client_code})`; option.dataset.client = JSON.stringify(client); select.appendChild(option); }); const title = document.querySelector('#selectClientModalOverlay h3'); const confirmBtn = document.getElementById('confirmClientSelectionBtn'); if (isChange) { title.textContent = 'Vincular / Alterar Cliente da Obra'; confirmBtn.textContent = 'Confirmar Alteração'; } else { title.textContent = 'Vincular Cliente à Nova Obra'; confirmBtn.textContent = 'Vincular e Continuar'; } openModal('selectClientModalOverlay'); }


// --- FUNÇÕES DE RENDERIZAÇÃO DE RELATÓRIO E DIAGRAMA ---

function getDpsText(dpsInfo) { if (!dpsInfo) return 'Não'; return `Sim, Classe ${dpsInfo.classe} (${dpsInfo.corrente_ka} kA)`; }

export function renderReport(calculationResults){
    if(!calculationResults) return;
    const { feederResult, circuitResults } = calculationResults;
    const dataHora = (new Date).toLocaleString('pt-BR');
    const formatLine = (label, value) => (label + ':').padEnd(30, ' ') + value;
    let reportText = `======================================================\n==           RELATÓRIO DE PROJETO ELÉTRICO           ==\n======================================================\n${formatLine('Gerado em', dataHora)}\n`;
    
    const reportData = feederResult.dados;
    reportText += `\n-- DADOS DA OBRA E CLIENTE --\n`;
    reportText += `${formatLine('Cliente', reportData.cliente || 'Não informado')}\n`;
    reportText += `${formatLine(`Documento (${reportData.tipoDocumento})`, reportData.documento || 'Não informado')}\n`;
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
        reportText += `\n-- RESPONSÁVEL TÉCNICO --\n`;
        reportText += `${formatLine('Nome', respTecnico)}\n`;
        reportText += `${formatLine('CREA', document.getElementById('crea').value)}\n`;
    }

    reportText += `\n-- QUADRO DE CARGAS RESUMIDO --\n`;
    reportText += `- Alimentador Geral\n`;
    circuitResults.forEach((result, index) => {
        reportText += `${formatLine(`- Circuito ${index + 1}`, result.dados.nomeCircuito)}\n`;
    });

    const allCalculations = [feederResult, ...circuitResults];
    allCalculations.forEach((result, index) => {
        const { dados, calculos } = result;
        const title = dados.id === 'Geral' ? 'ALIMENTADOR GERAL' : `CIRCUITO ${index}`;
        
        const potenciaDemandadaVA = dados.fatorPotencia > 0 ? (calculos.potenciaDemandada / dados.fatorPotencia).toFixed(2) : "0.00";
        const correnteCorrigidaTexto = isFinite(calculos.correnteCorrigidaA) ? `${calculos.correnteCorrigidaA.toFixed(2)} A` : "Incalculável";
        
        reportText += `\n\n======================================================\n==           MEMORIAL DE CÁLCULO - ${title.padEnd(16, ' ')} ==\n======================================================\n`;
        reportText += `\n-- PARÂMETROS DE ENTRADA --\n`;
        if (dados.id !== 'Geral') { reportText += `${formatLine('Nome do Circuito', dados.nomeCircuito)}\n`; reportText += `${formatLine('Tipo de Circuito', dados.tipoCircuito)}\n`; }
        reportText += `${formatLine('Potência Instalada', `${calculos.potenciaInstalada.toFixed(2)} W`)}\n`;
        reportText += `${formatLine('Fator de Demanda Aplicado (%)', `${dados.fatorDemanda}%`)}\n`;
        reportText += `${formatLine('Potência Demandada', `${potenciaDemandadaVA} VA`)}\n`;
        reportText += `${formatLine('Fator de Potência', dados.fatorPotencia)}\n`;
        reportText += `${formatLine('Sistema de Fases', dados.fases)}\n`;
        reportText += `${formatLine('Tipo de Ligação', dados.tipoLigacao)}\n`;
        reportText += `${formatLine('Tensão (V)', `${dados.tensaoV} V`)}\n`;
        reportText += `${formatLine('Comprimento (m)', `${dados.comprimentoM} m`)}\n`;
        reportText += `${formatLine('Limite Queda de Tensão (%)', `${dados.limiteQuedaTensao} %`)}\n`;

        reportText += `\n-- ESPECIFICAÇÕES DE INSTALAÇÃO E CORREÇÕES --\n`;
        reportText += `${formatLine('Material / Isolação', `${dados.materialCabo} / ${dados.tipoIsolacao}`)}\n`;
        reportText += `${formatLine('Método de Instalação', dados.metodoInstalacao)}\n`;
        reportText += `${formatLine('Temperatura Ambiente', `${dados.temperaturaAmbienteC}°C`)}\n`;
        if (dados.id !== 'Geral') {
             reportText += `${formatLine('Circuitos Agrupados', dados.numCircuitosAgrupados)}\n`;
             if (dados.resistividadeSolo && dados.resistividadeSolo > 0) { reportText += formatLine('Resist. do Solo (C.m/W)', dados.resistividadeSolo) + '\n'; }
        } else {
             if (dados.resistividadeSolo && dados.resistividadeSolo > 0) { reportText += formatLine('Resist. do Solo (C.m/W)', dados.resistividadeSolo) + '\n'; }
        }
        if(calculos.fatorK1) {
           reportText += `${formatLine('Fatores de Correção', `K1=${calculos.fatorK1.toFixed(2)}, K2=${calculos.fatorK2.toFixed(2)}, K3=${calculos.fatorK3.toFixed(2)}`)}\n`;
        }
        
        reportText += `\n-- RESULTADOS DE CÁLCULO E DIMENSIONAMENTO --\n`;
        reportText += `${formatLine('Corrente de Projeto', `${calculos.correnteInstalada.toFixed(2)} A`)}\n`;
        reportText += `${formatLine('Corrente Demandada (Ib)', `${calculos.correnteDemandada.toFixed(2)} A`)}\n`;
        reportText += `${formatLine('Corrente Corrigida (I\')', correnteCorrigidaTexto)}\n`;
        reportText += `${formatLine('Bitola Recomendada', `${calculos.bitolaRecomendadaMm2} mm²`)}\n`;
        reportText += `${formatLine('Queda de Tensão (DV)', `${calculos.quedaTensaoCalculada.toFixed(2)} % (Limite: ${dados.limiteQuedaTensao} %)`)}\n`;
        reportText += `${formatLine('Corrente Max. Cabo (Iz)', `${calculos.correnteMaximaCabo.toFixed(2)} A`)}\n`;

        reportText += `\n-- PROTEÇÕES RECOMENDADAS --\n`;
        reportText += `${formatLine(`Disjuntor (${dados.tipoDisjuntor})`, `${calculos.disjuntorRecomendado.nome} (Icc: ${calculos.disjuntorRecomendado.icc} kA)`)}\n`;
        reportText += `${formatLine('Proteção DR 30mA', dados.requerDR ? `Sim (usar ${calculos.disjuntorRecomendado.nome.replace('A','')}A / 30mA)` : 'Não')}\n`;
        reportText += `${formatLine('Proteção DPS', getDpsText(dados.dpsInfo))}\n`;
        reportText += `${formatLine('Eletroduto (aprox.)', `${calculos.dutoRecomendado} (${calculos.numCondutores} condutores)`)}\n`;
    });
    document.getElementById('report').textContent = reportText.trim();
}

// >>>>>>>>>>>> FUNÇÕES DE DESENHO DO DIAGRAMA (REFEITAS PARA PADRÃO PROFISSIONAL) <<<<<<<<<<<<<<

function drawHeader(x, y, projectData, totalPower) {
    const title = projectData.obra || "Diagrama Unifilar";
    const powerText = `(${totalPower.toFixed(2)} W)`;

    return `
        <g text-anchor="end">
            <text x="${x}" y="${y}" style="font-family: Arial; font-size: 16px; font-weight: bold;">Q.D. ${title.toUpperCase()}</text>
            <text x="${x}" y="${y + 15}" style="font-family: Arial; font-size: 12px;">${powerText}</text>
        </g>
    `;
}

function drawDisjuntor(x, y, text, fases = 'Monofasico') {
    let symbolPath = '';
    switch (fases) {
        case 'Trifasico':
            symbolPath = `<path d="M ${x - 5} ${y - 2} q 5 -10 10 0 M ${x - 5} ${y + 2} q 5 -10 10 0 M ${x - 5} ${y + 6} q 5 -10 10 0" stroke="black" stroke-width="1.5" fill="none" />`;
            break;
        case 'Bifasico':
            symbolPath = `<path d="M ${x - 5} ${y} q 5 -10 10 0 M ${x - 5} ${y + 4} q 5 -10 10 0" stroke="black" stroke-width="1.5" fill="none" />`;
            break;
        default: // Monofasico
            symbolPath = `<path d="M ${x - 5} ${y + 2} q 5 -10 10 0" stroke="black" stroke-width="1.5" fill="none" />`;
            break;
    }
    
    return `
        <g text-anchor="middle">
            <circle cx="${x - 12.5}" cy="${y}" r="1.5" fill="black"/>
            <circle cx="${x + 12.5}" cy="${y}" r="1.5" fill="black"/>
            ${symbolPath}
            <text x="${x}" y="${y - 18}" style="font-family: Arial; font-size: 11px;">${text}</text>
        </g>
    `;
}

function drawDR(x, y, text, fases = 'Monofasico') {
    const drColor = '#27ae60'; // Cor verde da legenda
    let internalSymbol = '';
    if (fases === 'Trifasico') {
        internalSymbol = `<path d="M ${x-4} ${y-5} v 10 M ${x} ${y-5} v 10 M ${x+4} ${y-5} v 10 M ${x-4} ${y-5} h 8" stroke="${drColor}" stroke-width="1" fill="none"/>`;
    } else {
        internalSymbol = `<path d="M ${x} ${y-5} v 10 M ${x-3} ${y-5} h 6" stroke="${drColor}" stroke-width="1" fill="none"/>`;
    }

    return `
        <g text-anchor="middle">
            <rect x="${x - 12.5}" y="${y - 12.5}" width="25" height="25" stroke="${drColor}" stroke-width="1.5" fill="white" />
            <text x="${x}" y="${y - 18}" style="font-family: Arial; font-size: 10px; fill: ${drColor};">${text}</text>
            <text x="${x}" y="${y+4}" style="font-family: Arial; font-size: 11px; font-weight: bold; fill: ${drColor};">DR</text>
            ${internalSymbol}
        </g>
    `;
}

function drawDPS(x, y, feederData) {
    const dpsColor = '#27ae60'; // Cor verde da legenda
    let numDPS = 0;
    if (feederData.fases === 'Monofasico') numDPS = 2;
    else if (feederData.fases === 'Bifasico') numDPS = 3;
    else if (feederData.fases === 'Trifasico') numDPS = 4;
    const dpsInfo = feederData.dpsInfo;
    const text = dpsInfo ? `${numDPS}x DPS Cl.${dpsInfo.classe} ${dpsInfo.corrente_ka}kA` : `${numDPS}x DPS`;
    return `
        <g>
            <rect x="${x - 45}" y="${y - 12.5}" width="90" height="25" stroke="${dpsColor}" stroke-width="1.5" fill="white" />
            <text x="${x}" y="${y + 4}" text-anchor="middle" style="font-family: Arial; font-size: 10px; fill:${dpsColor};">${text}</text>
            <line x1="${x}" y1="${y + 12.5}" x2="${x}" y2="${y + 30}" stroke="black" stroke-width="1" />
            ${drawGroundSymbol(x, y + 30)}
        </g>
    `;
}

function drawGroundSymbol(x, y) {
    return `
        <line x1="${x}" y1="${y}" x2="${x}" y2="${y + 5}" stroke="black" stroke-width="1" />
        <line x1="${x - 8}" y1="${y + 5}" x2="${x + 8}" y2="${y + 5}" stroke="black" stroke-width="1.5" />
        <line x1="${x - 5}" y1="${y + 8}" x2="${x + 5}" y2="${y + 8}" stroke="black" stroke-width="1.5" />
        <line x1="${x - 2}" y1="${y + 11}" x2="${x + 2}" y2="${y + 11}" stroke="black" stroke-width="1.5" />
    `;
}

function drawConductorSymbol(x, y, numConductors) {
    let path = '';
    for (let i = 0; i < numConductors; i++) {
        path += ` M ${x - 5} ${y + 5 + (i * 4)} l 10 -5`;
    }
    return `<path d="${path}" stroke="black" stroke-width="1" fill="none" />`;
}


function drawCircuitLine(result, x, y, index) {
    const { dados, calculos } = result;
    const yEnd = y + 250;
    const fontStyle = `font-family: Arial;`;

    return `
        <g text-anchor="middle">
            ${drawDisjuntor(x, y, `${calculos.disjuntorRecomendado.nome}`, dados.fases)}
            <line x1="${x}" y1="${y + 12.5}" x2="${x}" y2="${yEnd}" stroke="black" stroke-width="1" />
            ${drawConductorSymbol(x, y + 60, calculos.numCondutores)}
            <text x="${x}" y="${y + 90}" style="${fontStyle} font-size: 11px;">${calculos.bitolaRecomendadaMm2}</text>
            <text x="${x}" y="${yEnd + 20}" style="${fontStyle} font-size: 11px; font-weight: bold;">(${calculos.potenciaDemandada.toFixed(0)} W)</text>
            <text x="${x}" y="${yEnd + 35}" style="${fontStyle} font-size: 12px;">${index} - ${dados.nomeCircuito}</text>
        </g>
    `;
}

export function renderUnifilarDiagram(calculationResults) {
    const container = document.getElementById('unifilar-drawing');
    container.innerHTML = '';
    if (!calculationResults || !calculationResults.circuitResults) {
        container.innerHTML = '<p>Dados insuficientes para gerar o diagrama.</p>';
        return;
    }

    const { feederResult, circuitResults } = calculationResults;
    const circuitsComDR = circuitResults.filter(c => c.dados.requerDR);
    const circuitsSemDR = circuitResults.filter(c => !c.dados.requerDR);

    const categorizedCircuits = {};
    circuitsComDR.forEach(c => {
        let tipo = c.dados.tipoCircuito;
        if (tipo === 'tue' && (c.dados.nomeCircuito.toLowerCase().includes('chuveiro') || c.dados.nomeCircuito.toLowerCase().includes('aquecedor') || c.calculos.potenciaDemandada > 4000)) {
            tipo = 'tue_potencia';
        }
        if (!categorizedCircuits[tipo]) categorizedCircuits[tipo] = [];
        categorizedCircuits[tipo].push(c);
    });

    const finalGroups = [];
    const groupOrder = ['iluminacao', 'tug', 'tue', 'tue_potencia', 'ar_condicionado', 'motores', 'aquecimento'];
    
    groupOrder.forEach(category => {
        if (categorizedCircuits[category]) {
            const circuitsOfType = categorizedCircuits[category];
            const chunkSize = (category === 'iluminacao') ? 8 : 5;
            for (let i = 0; i < circuitsOfType.length; i += chunkSize) {
                const chunk = circuitsOfType.slice(i, i + chunkSize);
                const isHighPower = chunk.some(c => c.dados.tipoCircuito === 'tue_potencia' || c.calculos.potenciaDemandada >= 4000);
                const drCurrent = isHighPower ? '63A' : '40A';
                finalGroups.push({ dr: { corrente: drCurrent, sensibilidade: '30mA' }, circuits: chunk });
            }
        }
    });

    if (circuitsSemDR.length > 0) {
        finalGroups.push({ dr: null, circuits: circuitsSemDR });
    }
    
    // --- Lógica de Desenho Principal ---
    const yStart = 40;
    const yBusbar = yStart + 150;
    const circuitWidth = 100;
    const marginLeft = 60;
    const totalCircuits = circuitResults.length;
    const svgWidth = (totalCircuits * circuitWidth) + marginLeft * 2;
    const svgHeight = 600;

    let svgParts = [];
    svgParts.push(`<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">`);
    
    svgParts.push(drawHeader(svgWidth - 20, yStart, feederResult.dados, feederResult.calculos.potenciaDemandada));

    let currentX = marginLeft;
    svgParts.push(`<line x1="${currentX}" y1="${yStart}" x2="${currentX}" y2="${yBusbar - 50}" stroke="black" stroke-width="2"/>`);
    svgParts.push(drawDisjuntor(currentX, yBusbar - 50, `${feederResult.calculos.disjuntorRecomendado.nome}`, feederResult.dados.fases));
    svgParts.push(`<line x1="${currentX}" y1="${yBusbar - 37.5}" x2="${currentX}" y2="${yBusbar}" stroke="black" stroke-width="2"/>`);

    if (feederResult.dados.dpsClasse) {
        svgParts.push(`<line x1="${currentX}" y1="${yBusbar - 100}" x2="${currentX + 50}" y2="${yBusbar - 100}" stroke="black" stroke-width="1"/>`);
        svgParts.push(drawDPS(currentX + 95, yBusbar - 100, feederResult.dados));
    }
    svgParts.push(drawGroundSymbol(marginLeft + (totalCircuits * circuitWidth) / 2, svgHeight - 40));

    const busbarStart = marginLeft;
    const busbarEnd = busbarStart + totalCircuits * circuitWidth;
    svgParts.push(`<line x1="${busbarStart}" y1="${yBusbar}" x2="${busbarEnd}" y2="${yBusbar}" stroke="black" stroke-width="5"/>`);

    currentX += (circuitWidth / 2);
    let circuitIndex = 1;

    finalGroups.forEach(group => {
        const groupWidth = group.circuits.length * circuitWidth;
        const groupStartX = currentX - (circuitWidth/2);

        if (group.dr) {
            const isGroupTrifasico = group.circuits.some(c => c.dados.fases === 'Trifasico');
            const drFases = isGroupTrifasico ? 'Trifasico' : 'Monofasico';
            
            const drX = groupStartX + groupWidth / 2;
            svgParts.push(`<line x1="${drX}" y1="${yBusbar}" x2="${drX}" y2="${yBusbar + 40}" stroke="black" stroke-width="1"/>`);
            svgParts.push(`<circle cx="${drX}" cy="${yBusbar}" r="3" fill="black"/>`);
            svgParts.push(drawDR(drX, yBusbar + 40, `${group.dr.corrente}/${group.dr.sensibilidade}`, drFases));
            
            const subBusbarY = yBusbar + 65;
            svgParts.push(`<line x1="${groupStartX + circuitWidth/2}" y1="${subBusbarY}" x2="${groupStartX + groupWidth - circuitWidth/2}" y2="${subBusbarY}" stroke="black" stroke-width="3"/>`);

            svgParts.push(`<rect x="${groupStartX}" y="${yBusbar + 10}" width="${groupWidth}" height="350" fill="none" stroke="black" stroke-dasharray="5,5"/>`);
            
            group.circuits.forEach(result => {
                svgParts.push(`<line x1="${currentX}" y1="${subBusbarY}" x2="${currentX}" y2="${subBusbarY + 15}" stroke="black" stroke-width="1"/>`);
                svgParts.push(`<circle cx="${currentX}" cy="${subBusbarY}" r="3" fill="black"/>`);
                svgParts.push(drawCircuitLine(result, currentX, subBusbarY + 15, circuitIndex++));
                currentX += circuitWidth;
            });

        } else {
            group.circuits.forEach(result => {
                svgParts.push(`<line x1="${currentX}" y1="${yBusbar}" x2="${currentX}" y2="${yBusbar + 15}" stroke="black" stroke-width="1"/>`);
                svgParts.push(`<circle cx="${currentX}" cy="${yBusbar}" r="3" fill="black"/>`);
                svgParts.push(drawCircuitLine(result, currentX, yBusbar + 15, circuitIndex++));
                currentX += circuitWidth;
            });
        }
    });

    svgParts.push('</svg>');
    container.innerHTML = svgParts.join('');
}


export async function generateUnifilarPdf() {
    try {
        const svgElement = document.querySelector('#unifilar-drawing svg');
        if (!svgElement) {
            alert("O diagrama unifilar não foi encontrado. Por favor, gere o cálculo primeiro.");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4'); 

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const svgString = new XMLSerializer().serializeToString(svgElement);
        const { width, height } = svgElement.getBoundingClientRect();

        canvas.width = width;
        canvas.height = height;
        
        const v = await Canvg.fromString(ctx, svgString);
        await v.render();

        const imgData = canvas.toDataURL('image/png');

        const pdfWidth = doc.internal.pageSize.getWidth();
        const pdfHeight = doc.internal.pageSize.getHeight();
        const margin = 10;

        const imgWidth = pdfWidth - (margin * 2);
        const imgHeight = (height / width) * imgWidth;
        
        let finalY = margin;
        if (imgHeight < (pdfHeight - (margin * 2))) {
            finalY = (pdfHeight - imgHeight) / 2;
        }

        doc.addImage(imgData, 'PNG', margin, finalY, imgWidth, imgHeight);
        doc.save(`Unifilar_${document.getElementById('obra').value || 'Projeto'}.pdf`);

    } catch (error) {
        console.error("Erro ao gerar PDF do Unifilar:", error);
        alert("Ocorreu um erro ao gerar o PDF do diagrama. Verifique o console para mais detalhes.");
    }
}

export function generateMemorialPdf(calculationResults, currentUserProfile) {
    if (!calculationResults) {
        alert("Por favor, gere o cálculo primeiro.");
        return;
    }
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
    const feederHead = [['Tensão/Fases', 'Disjuntor Geral', 'DR', 'DPS', 'Cabo (Isolação)', 'Eletroduto']];
    const feederBody = [[ `${feederResult.dados.tensaoV}V - ${feederResult.dados.fases}`, feederBreakerText, feederResult.dados.requerDR ? 'Sim' : 'Nao', getDpsText(feederResult.dados.dpsInfo), `${feederResult.calculos.bitolaRecomendadaMm2} mm² (${feederResult.dados.tipoIsolacao})`, feederResult.calculos.dutoRecomendado ]];
    doc.autoTable({ startY: yPos, head: feederHead, body: feederBody, theme: 'grid', headStyles: { fillColor: [44, 62, 80] }, styles: { fontSize: 8 } });
    yPos = doc.lastAutoTable.finalY + 10;

    if (circuitResults.length > 0) {
        addSection("RESUMO DOS CIRCUITOS");
        const head = [['Ckt', 'Nome', 'Disjuntor', 'DR', 'DPS', 'Cabo (Isolação)', 'Eletroduto']];
        const body = circuitResults.map((r, index) => {
            const circuitBreakerType = r.dados.tipoDisjuntor.includes('Caixa Moldada') ? 'MCCB' : 'DIN';
            const circuitBreakerText = `${circuitBreakerType} ${r.calculos.disjuntorRecomendado.nome}`;
            return [ index + 1, r.dados.nomeCircuito, circuitBreakerText, r.dados.requerDR ? 'Sim' : 'Nao', getDpsText(r.dados.dpsInfo), `${r.calculos.bitolaRecomendadaMm2} mm² (${r.dados.tipoIsolacao})`, r.calculos.dutoRecomendado ];
        });
        doc.autoTable({ startY: yPos, head: head, body: body, theme: 'grid', headStyles: { fillColor: [44, 62, 80] }, styles: { fontSize: 8 } });
    }
    
    const allCalculationsForMemorial = [feederResult, ...circuitResults];
    allCalculationsForMemorial.forEach((result, index) => {
        doc.addPage();
        yPos = 20;
        const { dados, calculos } = result;
        const potenciaDemandadaVA = dados.fatorPotencia > 0 ? (calculos.potenciaDemandada / dados.fatorPotencia).toFixed(2) : "0.00";
        const correnteCorrigidaTexto = isFinite(calculos.correnteCorrigidaA) ? `${calculos.correnteCorrigidaA.toFixed(2)} A` : "Incalculável";

        const title = dados.id === 'Geral' 
            ? `MEMORIAL DE CÁLCULO - ALIMENTADOR GERAL`
            : `MEMORIAL DE CÁLCULO - CIRCUITO ${index}: ${dados.nomeCircuito}`;

        addTitle(title);
        
        addSection("-- PARÂMETROS DE ENTRADA --");
        if (dados.id !== 'Geral') { addLineItem("Tipo de Circuito:", dados.tipoCircuito); }
        addLineItem("Potência Instalada:", `${calculos.potenciaInstalada.toFixed(2)} W`);
        addLineItem("Fator de Demanda:", `${dados.fatorDemanda}%`);
        addLineItem("Potência Demandada:", `${potenciaDemandadaVA} VA`);
        addLineItem("Fator de Potência:", dados.fatorPotencia);
        addLineItem("Sistema de Fases:", dados.fases);
        addLineItem("Tipo de Ligação:", dados.tipoLigacao);
        addLineItem("Tensão (V):", `${dados.tensaoV} V`);
        addLineItem("Comprimento:", `${dados.comprimentoM} m`);
        addLineItem("Limite Queda de Tensão:", `${dados.limiteQuedaTensao}%`);
        yPos += 5;

        addSection("-- ESPECIFICAÇÕES DE INSTALAÇÃO E CORREÇÕES --");
        addLineItem("Material / Isolação:", `${dados.materialCabo} / ${dados.tipoIsolacao}`);
        addLineItem("Método de Instalação:", dados.metodoInstalacao);
        addLineItem("Temperatura Ambiente:", `${dados.temperaturaAmbienteC}°C`);
        if (dados.id !== 'Geral') {
            addLineItem("Circuitos Agrupados:", dados.numCircuitosAgrupados);
            if (dados.resistividadeSolo && dados.resistividadeSolo > 0) {
                addLineItem("Resist. do Solo (C.m/W):", dados.resistividadeSolo);
            }
        } else {
             if (dados.resistividadeSolo && dados.resistividadeSolo > 0) {
                addLineItem("Resist. do Solo (C.m/W):", dados.resistividadeSolo);
            }
        }
        yPos += 5;
        
        addSection("-- RESULTADOS DE CÁLCULO E DIMENSIONAMENTO --");
        addLineItem("Corrente de Projeto:", `${calculos.correnteInstalada.toFixed(2)} A`);
        addLineItem("Corrente Demandada (Ib):", `${calculos.correnteDemandada.toFixed(2)} A`);
        addLineItem("Corrente Corrigida (I'):", correnteCorrigidaTexto);
        addLineItem("Bitola Recomendada:", `${calculos.bitolaRecomendadaMm2} mm²`);
        addLineItem("Queda de Tensão (DV):", `${calculos.quedaTensaoCalculada.toFixed(2)}%`);
        addLineItem("Corrente Máx. Cabo (Iz):", `${calculos.correnteMaximaCabo.toFixed(2)} A`);
        yPos += 5;

        addSection("-- PROTEÇÕES RECOMENDADAS --");
        addLineItem("Disjuntor:", `${dados.tipoDisjuntor}: ${calculos.disjuntorRecomendado.nome} (Icc: ${calculos.disjuntorRecomendado.icc} kA)`);
        addLineItem("Proteção DR:", dados.requerDR ? `Sim (${calculos.disjuntorRecomendado.nome.replace('A','')}A / 30mA)` : 'Não');
        addLineItem("Proteção DPS:", getDpsText(dados.dpsInfo));
    });

    doc.save(`Memorial_${document.getElementById('obra').value || 'Projeto'}.pdf`);
}