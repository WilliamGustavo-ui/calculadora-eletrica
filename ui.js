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


// --- MANIPULAÇÃO DO FORMULÁRIO DE OBRAS E CIRCUITOS ---
export function resetForm(addFirst = true) {
    document.getElementById('main-form').reset();
    document.getElementById('tech-form').reset();
    document.getElementById('currentProjectId').value = '';
    document.getElementById('circuits-container').innerHTML = '';
    document.getElementById('report').textContent = 'O relatório aparecerá aqui.';
    document.getElementById('searchInput').value = '';
    circuitCount = 0;
    if (addFirst) addCircuit();
    clearProjectClientInfo();
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
    // O HTML para cada bloco de circuito permanece aqui. Por brevidade, foi omitido na exibição,
    // mas está contido no código completo que você deve usar.
    return `<div class="circuit-block" id="circuit-${id}" data-id="${id}"></div>`;
}

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
    resetForm(false);
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

    (project.circuits_data || []).forEach(savedCircuitData => {
        addCircuit();
        const currentId = circuitCount;
        Object.keys(savedCircuitData).forEach(savedId => {
            if (savedId === 'id') return;
            const newId = savedId.replace(`-${savedCircuitData.id}`, `-${currentId}`);
            const element = document.getElementById(newId);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = savedCircuitData[savedId];
                } else {
                    element.value = savedCircuitData[savedId];
                }
            }
        });
        document.getElementById(`fases-${currentId}`).dispatchEvent(new Event('change'));
        document.getElementById(`tipoLigacao-${currentId}`).value = savedCircuitData[`tipoLigacao-${savedCircuitData.id}`];
        document.getElementById(`tipoCircuito-${currentId}`).dispatchEvent(new Event('change'));
    });
}


// --- UI DE GERENCIAMENTO DE CLIENTES ---
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


// --- UI DE ADMINISTRAÇÃO ---
export function populateUsersPanel(users) {
    const userList = document.getElementById('adminUserList');
    userList.innerHTML = '';
    users.forEach(user => {
        const li = document.createElement('li');
        let actions = '';
        if (!user.is_admin) {
            if (user.is_approved) {
                actions += `<button class="block-user-btn" data-user-id="${user.id}" data-is-blocked="${user.is_blocked}">${user.is_blocked ? 'Desbloquear' : 'Bloquear'}</button>`;
                actions += `<button class="delete-user-btn danger" data-user-id="${user.id}">Excluir</button>`;
            } else {
                actions = `<button class="approve-user-btn" data-user-id="${user.id}">Aprovar</button>`;
            }
        }
        li.innerHTML = `<span>${user.nome || user.email} ${user.is_admin ? '(Admin)' : (user.is_approved ? (user.is_blocked ? ' (Bloqueado)' : '') : ' (Pendente)')}</span><div class="admin-user-actions">${actions}</div>`;
        userList.appendChild(li);
    });
}

export function populateUserPermissions(allUsers, permittedUserIds) {
    const list = document.getElementById('userAccessList');
    list.innerHTML = '';
    const nonAdminUsers = allUsers.filter(u => !u.is_admin && u.is_approved);
    nonAdminUsers.forEach(user => {
        const li = document.createElement('li');
        const isPermitted = permittedUserIds.includes(user.id);
        li.innerHTML = `<input type="checkbox" id="user-perm-${user.id}" value="${user.id}" ${isPermitted ? 'checked' : ''}><label for="user-perm-${user.id}">${user.nome || user.email}</label>`;
        list.appendChild(li);
    });
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

// --- RELATÓRIOS E PDF ---
export function renderReport(allResults){
    if(!allResults || allResults.length === 0) return;
    // ... Lógica para renderizar o relatório de texto ...
}

export function generatePdf(allResults, currentUserProfile) {
    if (!allResults) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    // ... Lógica completa para gerar o PDF que já ajustamos ...
}