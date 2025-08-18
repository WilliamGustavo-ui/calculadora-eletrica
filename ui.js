// Arquivo: ui.js

import { ligacoes } from './utils.js';

let circuitCount = 0;

// --- CONTROLE DE VISIBILIDADE E MODAIS ---
export function showLoginView() {
    document.getElementById('loginContainer').style.display = 'block';
    document.getElementById('appContainer').style.display = 'none';
    document.getElementById('resetPasswordContainer').style.display = 'none';
}

export function showAppView(userProfile) {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    document.getElementById('resetPasswordContainer').style.display = 'none';
    
    const isAdmin = userProfile?.is_admin || false;
    document.getElementById('clientManagementBtn').style.display = 'block'; 
    document.getElementById('adminPanelBtn').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('manageProjectsBtn').style.display = isAdmin ? 'block' : 'none';
}

export function showResetPasswordView() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('appContainer').style.display = 'none';
    document.getElementById('resetPasswordContainer').style.display = 'block';
}

/**
 * VERSÃO CORRIGIDA da função openModal.
 * Agora ela garante que todos os outros modais sejam fechados antes de abrir um novo.
 * Isso impede a sobreposição e o travamento da tela.
 */
export function openModal(modalId) {
    // Primeiro, esconde TODOS os modais para garantir que apenas um esteja visível.
    const allModals = document.querySelectorAll('.modal-overlay');
    allModals.forEach(modal => {
        modal.style.display = 'none';
    });

    // Agora, mostra apenas o modal solicitado.
    const modalToOpen = document.getElementById(modalId);
    if (modalToOpen) {
        modalToOpen.style.display = 'flex';
    }
}

export function closeModal(modalId) { 
    const modalToClose = document.getElementById(modalId);
    if (modalToClose) {
        modalToClose.style.display = 'none';
    }
}


// --- MANIPULAÇÃO DO FORMULÁRIO PRINCIPAL E CIRCUITOS ---
export function resetForm(addFirst = true) {
    document.getElementById('main-form').reset();
    document.getElementById('tech-form').reset();
    document.getElementById('currentProjectId').value = '';
    document.getElementById('circuits-container').innerHTML = '';
    document.getElementById('report').textContent = 'O relatório aparecerá aqui.';
    document.getElementById('searchInput').value = '';
    circuitCount = 0;
    if (addFirst) addCircuit();
}

export function addCircuit() {
    circuitCount++;
    const newCircuitDiv = document.createElement('div');
    newCircuitDiv.innerHTML = getCircuitHTML(circuitCount);
    document.getElementById('circuits-container').appendChild(newCircuitDiv.firstElementChild);
    initializeCircuitListeners(circuitCount);
}

export function removeCircuit(id) {
    document.getElementById(`circuit-${id}`)?.remove();
    renumberCircuits();
}

function renumberCircuits() {
    const circuitBlocks = document.querySelectorAll('.circuit-block');
    circuitCount = circuitBlocks.length;
    circuitBlocks.forEach((block, index) => {
        const newId = index + 1;
        const oldId = parseInt(block.dataset.id);
        if (oldId === newId) return;
        block.dataset.id = newId;
        block.id = `circuit-${newId}`;
        block.querySelectorAll('[id],[for],[data-circuit-id]').forEach(el => {
            const props=['id','htmlFor'];
            props.forEach(prop=>{
                if(el[prop] && String(el[prop]).includes(`-${oldId}`)){
                    el[prop] = el[prop].replace(`-${oldId}`,`-${newId}`)
                }
            });
            if (el.dataset.circuitId && el.dataset.circuitId.includes(`-${oldId}`)) {
                el.dataset.circuitId = el.dataset.circuitId.replace(`-${oldId}`, `-${newId}`);
            }
        });
        block.querySelector('h2').textContent = `Circuito ${newId}`;
    });
}

function initializeCircuitListeners(id) {
    const tipoCircuito = document.getElementById(`tipoCircuito-${id}`);
    const fases = document.getElementById(`fases-${id}`);
    const tipoLigacao = document.getElementById(`tipoLigacao-${id}`);
    const potenciaWGroup = document.getElementById(`potenciaW_group-${id}`);
    const potenciaCVGroup = document.getElementById(`potenciaCV_group-${id}`);

    const atualizarLigacoes = () => {
        const faseSelecionada = fases.value;
        const ligacoesDisponiveis = ligacoes[faseSelecionada] || [];
        tipoLigacao.innerHTML = '';
        ligacoesDisponiveis.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.text;
            tipoLigacao.appendChild(option);
        });
    };

    tipoCircuito.addEventListener('change', () => {
        potenciaWGroup.classList.toggle('hidden', tipoCircuito.value === 'motores');
        potenciaCVGroup.classList.toggle('hidden', tipoCircuito.value !== 'motores');
    });

    fases.addEventListener('change', atualizarLigacoes);
    atualizarLigacoes();
}

function getCircuitHTML(id){
    return `<div class="circuit-block" id="circuit-${id}" data-id="${id}"><div class="circuit-header"><h2 id="circuit-title-${id}">Circuito ${id}</h2>${id>1?`<button type="button" class="remove-btn" data-circuit-id="${id}">Remover</button>`:''}</div><div class="form-grid"><div class="form-group"><label for="nomeCircuito-${id}">Nome do Circuito</label><input type="text" id="nomeCircuito-${id}" value="Circuito ${id}"></div><div class="form-group"><label for="tipoCircuito-${id}">Tipo de Circuito</label><select id="tipoCircuito-${id}"><option value="alimentacao_geral">Alimentacao Geral</option><option value="iluminacao">Iluminacao</option><option value="tug" selected>Tomadas de Uso Geral (TUG)</option><option value="tue">Tomadas de Uso Especifico (TUE)</option><option value="aquecimento">Aquecimento</option><option value="motores">Circuito de Motores</option><option value="ar_condicionado">Ar Condicionado</option></select></div><div class="form-group" id="potenciaW_group-${id}"><label for="potenciaW-${id}">Potencia (W)</label><input type="number" id="potenciaW-${id}" value="2500"></div><div class="form-group hidden" id="potenciaCV_group-${id}"><label for="potenciaCV-${id}">Potencia do Motor (CV)</label><select id="potenciaCV-${id}"><option value="0.25">1/4</option><option value="0.33">1/3</option><option value="0.5">1/2</option><option value="0.75">3/4</option><option value="1">1</option><option value="1.5">1 1/2</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="7.5">7 1/2</option><option value="10">10</option><option value="12.5">12 1/2</option><option value="15">15</option><option value="20">20</option><option value="25">25</option><option value="30">30</option></select></div><div class="form-group"><label for="fatorDemanda-${id}">Fator de Demanda</label><select id="fatorDemanda-${id}"><option value="0.50">0.50</option><option value="0.55">0.55</option><option value="0.60">0.60</option><option value="0.65">0.65</option><option value="0.70">0.70</option><option value="0.75">0.75</option><option value="0.80">0.80</option><option value="0.85">0.85</option><option value="0.90">0.90</option><option value="0.92">0.92</option><option value="0.95">0.95</option><option value="1" selected>1.00</option><option value="1.10">1.10</option><option value="1.15">1.15</option><option value="1.20">1.20</option><option value="1.25">1.25</option><option value="1.30">1.30</option></select></div><div class="form-group"><label for="fases-${id}">Sistema de Fases</label><select id="fases-${id}"><option value="Monofasico" selected>Monofasico</option><option value="Bifasico">Bifasico</option><option value="Trifasico">Trifasico</option></select></div><div class="form-group"><label for="tipoLigacao-${id}">Tipo de Ligacao</label><select id="tipoLigacao-${id}"></select></div><div class="form-group"><label for="tensaoV-${id}">Tensao (V)</label><select id="tensaoV-${id}"><option value="12">12 V</option><option value="24">24 V</option><option value="36">36 V</option><option value="127">127 V</option><option value="220" selected>220 V</option><option value="380">380 V</option><option value="440">440 V</option><option value="760">760 V</option></select></div><div class="form-group"><label for="fatorPotencia-${id}">Fator de Potencia (eficiencia)</label><input type="number" id="fatorPotencia-${id}" step="0.01" value="0.92"></div><div class="form-group"><label for="comprimentoM-${id}">Comprimento (m)</label><input type="number" id="comprimentoM-${id}" value="20"></div><div class="form-group"><label for="tipoIsolacao-${id}">Tipo de Isolacao</label><select id="tipoIsolacao-${id}"><option value="PVC" selected>PVC 70 C</option><option value="EPR">EPR/XLPE 90 C</option></select></div><div class="form-group"><label for="materialCabo-${id}">Material do Condutor</label><select id="materialCabo-${id}"><option value="Cobre" selected>Cobre</option><option value="Aluminio">Aluminio</option></select></div><div class="form-group"><label for="metodoInstalacao-${id}">Metodo de Instalacao</label><select id="metodoInstalacao-${id}"><option value="A1">A1</option><option value="A2">A2</option><option value="B1" selected>B1</option><option value="B2">B2</option><option value="C">C</option><option value="D">D</option></select></div><div class="form-group"><label for="temperaturaAmbienteC-${id}">Temperatura Ambiente (C)</label><select id="temperaturaAmbienteC-${id}"><option value="10">10</option><option value="15">15</option><option value="20">20</option><option value="25">25</option><option value="30" selected>30</option><option value="35">35</option><option value="40">40</option><option value="45">45</option><option value="50">50</option></select></div><div class="form-group"><label for="resistividadeSolo-${id}">Resistividade T. do Solo (C.m/W)</label><select id="resistividadeSolo-${id}"><option value="0" selected>Nao Aplicavel</option><option value="0.7">0.7</option><option value="0.8">0.8</option><option value="1.0">1.0</option><option value="1.5">1.5</option><option value="2.0">2.0</option><option value="2.5">2.5</option><option value="3.0">3.0</option></select></div><div class="form-group"><label for="numCircuitosAgrupados-${id}">N de Circuitos Agrupados</label><input type="number" id="numCircuitosAgrupados-${id}" value="1"></div><div class="form-group"><label for="limiteQuedaTensao-${id}">Limite Queda de Tensao (%)</label><input type="number" id="limiteQuedaTensao-${id}" step="0.1" value="4.0"></div><div class="form-group"><label for="tipoDisjuntor-${id}">Tipo de Disjuntor</label><select id="tipoDisjuntor-${id}"><option value="Minidisjuntor (DIN)">Minidisjuntor (DIN)</option><option value="Caixa Moldada (MCCB)">Caixa Moldada (MCCB)</option></select></div><div class="form-group"><label for="classeDPS-${id}">Protecao DPS</label><select id="classeDPS-${id}"><option value="Nenhum">Nenhuma</option><option value="Classe I">Classe I</option><option value="Classe II">Classe II</option><option value="Classe III">Classe III</option></select><div class="checkbox-group"><input type="checkbox" id="requerDR-${id}"><label for="requerDR-${id}">Requer Protecao DR</label></div></div></div></div>`;
}


// --- PREENCHIMENTO DE DADOS (OBRAS) ---
export function populateProjectList(projects) {
    const select = document.getElementById('savedProjectsSelect');
    select.innerHTML = '<option value="">-- Selecione uma obra --</option>';
    projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.project_name || `Obra Sem Nome (Cód: ${project.project_code})`;
        select.appendChild(option);
    });
}

export function populateFormWithProjectData(project) {
    document.getElementById('currentProjectId').value = project.id;
    document.getElementById('projectCode').value = project.project_code || '';
    Object.keys(project.main_data).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = project.main_data[id];
    });
    Object.keys(project.tech_data).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = project.tech_data[id];
    });
    document.getElementById('circuits-container').innerHTML = '';
    circuitCount = 0;
    (project.circuits_data || []).forEach(savedCircuitData => {
        addCircuit();
        const currentId = circuitCount;
        Object.keys(savedCircuitData).forEach(savedId => {
            if (savedId === 'id') return;
            const newId = savedId.replace(`-${savedCircuitData.id}`, `-${currentId}`);
            const element = document.getElementById(newId);
            if (element) {
                if (element.type === 'checkbox') element.checked = savedCircuitData[savedId];
                else element.value = savedCircuitData[savedId];
            }
        });
        document.getElementById(`fases-${currentId}`).dispatchEvent(new Event('change'));
        document.getElementById(`tipoLigacao-${currentId}`).value = savedCircuitData[`tipoLigacao-${savedCircuitData.id}`];
        document.getElementById(`tipoCircuito-${currentId}`).dispatchEvent(new Event('change'));
    });
}


// --- UI DE CLIENTES ---
export function toggleLegalRepSection() {
    const docType = document.getElementById('clientDocumentType').value;
    const legalRepSection = document.getElementById('legalRepSection');
    legalRepSection.classList.toggle('hidden', docType !== 'CNPJ');
}

export function populateClientList(clients, currentClient) {
    const list = document.getElementById('clientList');
    list.innerHTML = '';
    if (!clients || clients.length === 0) {
        list.innerHTML = '<li>Nenhum cliente encontrado.</li>';
        return;
    }
    clients.forEach(client => {
        const li = document.createElement('li');
        li.dataset.clientId = client.id;
        li.textContent = client.name || 'Cliente Sem Nome';
        if (currentClient && client.id === currentClient.id) {
            li.classList.add('selected');
        }
        list.appendChild(li);
    });
}

export function populateClientForm(client) {
    document.getElementById('clientForm').reset();
    document.getElementById('currentClientId').value = client.id;
    document.getElementById('clientCode').value = client.client_code;
    document.getElementById('clientName').value = client.name;
    document.getElementById('clientDocumentType').value = client.document_type;
    document.getElementById('clientDocumentNumber').value = client.document_number;
    document.getElementById('clientAddress').value = client.address;
    document.getElementById('clientPhone').value = client.phone;
    document.getElementById('clientMobile').value = client.mobile_phone;
    document.getElementById('clientEmail').value = client.email;
    document.getElementById('clientBillingEmail').value = client.billing_email;

    if (client.document_type === 'CNPJ') {
        document.getElementById('legalRepName').value = client.legal_rep_name;
        document.getElementById('legalRepCpf').value = client.legal_rep_cpf;
        document.getElementById('legalRepPhone').value = client.legal_rep_phone;
        document.getElementById('legalRepMobile').value = client.legal_rep_mobile;
        document.getElementById('legalRepEmail').value = client.legal_rep_email;
    }
    toggleLegalRepSection();
    document.getElementById('clientProjectsSection').classList.remove('hidden');
    document.getElementById('userAccessSection').classList.remove('hidden');
}

export function resetClientForm() {
    document.getElementById('clientForm').reset();
    document.getElementById('currentClientId').value = '';
    document.getElementById('clientCode').value = '';
    document.getElementById('clientProjectsSection').classList.add('hidden');
    document.getElementById('userAccessSection').classList.add('hidden');
    document.getElementById('clientProjectsList').innerHTML = '';
    document.getElementById('userAccessList').innerHTML = '';
    toggleLegalRepSection();
}

export function populateClientProjectsList(projects) {
    const list = document.getElementById('clientProjectsList');
    list.innerHTML = '';
    if (!projects || projects.length === 0) {
        list.innerHTML = '<li>Nenhuma obra vinculada.</li>';
        return;
    }
    projects.forEach(p => {
        const li = document.createElement('li');
        li.textContent = `${p.project_code || 'S/Cód.'} - ${p.project_name}`;
        list.appendChild(li);
    });
}

export function linkClientToProjectForm(client) {
    document.getElementById('clientSearch').value = client.client_code;
    document.getElementById('cliente').value = client.name;
    document.getElementById('tipoDocumento').value = client.document_type;
    document.getElementById('documento').value = client.document_number;
}

export function clearProjectClientInfo() {
    document.getElementById('clientSearch').value = '';
    document.getElementById('cliente').value = '';
    document.getElementById('documento').value = '';
}


// --- PAINEL DE ADMINISTRAÇÃO ---
export function populateUsersPanel(users) {
    const userList = document.getElementById('adminUserList');
    userList.innerHTML = '';
    users.forEach(user => {
        const li = document.createElement('li');
        let actions = '';
        if(!user.is_admin) {
            if (user.is_approved) {
                actions = `<button class="edit-user-btn" data-user-id="${user.id}">Editar</button>
                           <button class="remove-user-btn" data-user-id="${user.id}">Remover</button>`;
            } else {
                actions = `<button class="approve-user-btn" data-user-id="${user.id}">Aprovar</button>`;
            }
        }
        li.innerHTML = `<span>${user.nome || user.email} ${user.is_admin ? '(Admin)' : (user.is_approved ? '' : '(Pendente)')}</span><div class="admin-user-actions">${actions}</div>`;
        userList.appendChild(li);
    });
}

export function populateEditUserModal(userData) {
    document.getElementById('editUserId').value = userData.id;
    document.getElementById('editNome').value = userData.nome || '';
    document.getElementById('editCpf').value = userData.cpf || '';
    document.getElementById('editTelefone').value = userData.telefone || '';
    document.getElementById('editEmail').value = userData.email || '';
    document.getElementById('editCrea').value = userData.crea || '';
    openModal('editUserModalOverlay');
}

export function populateProjectsPanel_Admin(projects, allUsers, allClients) {
    const tableBody = document.getElementById('adminProjectsTableBody');
    tableBody.innerHTML = '';
    projects.forEach(project => {
        const row = document.createElement('tr');
        
        const userOptions = allUsers.map(user => `<option value="${user.id}" ${user.id === project.owner_id ? 'selected' : ''}>${user.nome}</option>`).join('');
        const clientOptions = allClients.map(client => `<option value="${client.id}" ${client.id === project.client_id ? 'selected' : ''}>${client.name}</option>`).join('');

        row.innerHTML = `
            <td>${project.project_name}</td>
            <td>${project.profile?.nome || 'Desconhecido'}</td>
            <td>${project.client?.name || 'Nenhum'}</td>
            <td class="actions">
                <div>
                    <select class="transfer-user-select">${userOptions}</select>
                    <button class="transfer-btn transfer-user-btn" data-project-id="${project.id}">Transferir Usuário</button>
                </div>
                <div>
                    <select class="transfer-client-select">${clientOptions}</select>
                    <button class="transfer-btn transfer-client-btn" data-project-id="${project.id}">Transferir Cliente</button>
                </div>
            </td>`;
        tableBody.appendChild(row);
    });
}

export function populateUserPermissions(allUsers, permittedUserIds) {
    const list = document.getElementById('userAccessList');
    list.innerHTML = '';
    const nonAdminUsers = allUsers.filter(u => !u.is_admin);

    nonAdminUsers.forEach(user => {
        const li = document.createElement('li');
        const isPermitted = permittedUserIds.includes(user.id);
        li.innerHTML = `
            <input type="checkbox" id="user-perm-${user.id}" value="${user.id}" ${isPermitted ? 'checked' : ''}>
            <label for="user-perm-${user.id}">${user.nome || user.email}</label>
        `;
        list.appendChild(li);
    });
}


// --- RELATÓRIOS E PDF ---
export function renderReport(allResults){
    // Este código permanece o mesmo
}

export function generatePdf(allResults, currentUserProfile) {
    // Este código permanece o mesmo
}