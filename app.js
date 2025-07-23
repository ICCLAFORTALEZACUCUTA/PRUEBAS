const APPS_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwpDK1BbSBCnx-3q8qaSdeS4DG0IEadNEty1sUARIbR1w1ZWWvfGbpaMq1tghHaB9Kk/exec'; // ¡REEMPLAZA ESTO!

// Elementos del DOM
const loginModule = document.getElementById('login-module');
const mainApp = document.getElementById('main-app');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const loginMessage = document.getElementById('login-message');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');

const dashboardNav = document.getElementById('dashboard-nav');
const aportesNav = document.getElementById('aportes-nav');
const participantesCrudNav = document.getElementById('participantes-crud-nav');

const dashboardModule = document.getElementById('dashboard-module');
const aportesParticipantesModule = document.getElementById('aportes-participantes-module');
const participantesCrudModule = document.getElementById('participantes-crud-module');

let currentUserRole = '';
let currentTutoraName = '';

// --- Funciones de Utilidad ---
function showModule(module) {
    dashboardModule.classList.add('hidden');
    aportesParticipantesModule.classList.add('hidden');
    participantesCrudModule.classList.add('hidden');
    if (module) {
        module.classList.remove('hidden');
    }
}

function showAdminElements() {
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
}

function hideAdminElements() {
    document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
}

async function fetchData(action, params = {}, method = 'GET', body = null) {
    const url = new URL(APPS_SCRIPT_WEB_APP_URL);
    url.searchParams.append('action', action);
    url.searchParams.append('username', usernameInput.value);
    url.searchParams.append('password', passwordInput.value);

    for (const key in params) {
        url.searchParams.append(key, params[key]);
    }

    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url.toString(), options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching data:', error);
        return { status: 'error', message: `Error al conectar con el servidor: ${error.message}` };
    }
}

// --- Autenticación ---
loginButton.addEventListener('click', async () => {
    const username = usernameInput.value;
    const password = passwordInput.value;

    loginMessage.textContent = 'Iniciando sesión...';
    // Llama a un endpoint 'login' en Apps Script
    // Asegúrate de que tu Apps Script tenga una lógica para 'login' que devuelva el rol
    const response = await fetchData('login', { username, password }, 'GET');

    if (response.status === 'success') {
        currentUserRole = response.role;
        currentTutoraName = response.tutoraName;
        loginModule.classList.add('hidden');
        mainApp.classList.remove('hidden');
        loginMessage.textContent = '';
        renderAppBasedOnRole();
    } else {
        loginMessage.textContent = response.message;
        loginMessage.className = 'message error'; // Aplica la clase de error
    }
});

logoutButton.addEventListener('click', () => {
    currentUserRole = '';
    currentTutoraName = '';
    usernameInput.value = '';
    passwordInput.value = '';
    loginModule.classList.remove('hidden');
    mainApp.classList.add('hidden');
    hideAdminElements();
    showModule(null); // Oculta todos los módulos
});

function renderAppBasedOnRole() {
    if (currentUserRole === 'admin') {
        showAdminElements();
        dashboardNav.click(); // Muestra el dashboard por defecto para administradores
    } else if (currentUserRole === 'tutora') {
        hideAdminElements();
        // Ocultar elementos que no debe ver la tutora en el módulo de aportes
        document.getElementById('filter-tutora').closest('.form-group').classList.add('hidden');
        document.getElementById('tutora-payment-view').classList.remove('hidden'); // Mostrar vista específica de tutora
        document.getElementById('payment-section').classList.add('hidden'); // Ocultar sección de registro de pago directo para tutoras
        aportesNav.click(); // Muestra el módulo de aportes por defecto para tutoras
    }
}


// --- Navegación ---
dashboardNav.addEventListener('click', () => {
    showModule(dashboardModule);
    loadDashboardStats();
});

aportesNav.addEventListener('click', () => {
    showModule(aportesParticipantesModule);
    if (currentUserRole === 'admin') {
        loadAportesList();
        loadParticipantesForSelect();
        document.getElementById('tutora-payment-view').classList.add('hidden'); // Ocultar vista de tutora si es admin
        document.getElementById('payment-section').classList.remove('hidden'); // Mostrar sección de registro de pago
    } else if (currentUserRole === 'tutora') {
        loadTutoraParticipantes();
        document.getElementById('payment-section').classList.add('hidden'); // Ocultar sección de registro de pago para tutoras
        document.getElementById('tutora-payment-view').classList.remove('hidden'); // Mostrar vista específica de tutora
    }
});

participantesCrudNav.addEventListener('click', () => {
    showModule(participantesCrudModule);
    loadParticipantesCrudTable();
});

// --- Dashboard Module Logic ---
async function loadDashboardStats() {
    const response = await fetchData('getDashboardStats');
    if (response.status === 'success') {
        // Aportes Totales por Mes y Año
        const labels = Object.keys(response.totalAportesPorMesAno).sort();
        const data = labels.map(key => response.totalAportesPorMesAno[key]);
        const ctx = document.getElementById('total-aportes-chart').getContext('2d');
        if (window.myChart) { // Destroy previous chart instance if it exists
            window.myChart.destroy();
        }
        window.myChart = new Chart(ctx, { // Store new chart instance
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Aportes Totales',
                    data: data,
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        // Media de Aportes
        document.getElementById('media-aportes').textContent = `$${response.mediaAportes.toFixed(2)}`;

        // Últimos 10 Aportes
        const ultimosAportesList = document.getElementById('ultimos-aportes-list');
        ultimosAportesList.innerHTML = '';
        if (response.ultimosAportes && response.ultimosAportes.length > 0) {
            response.ultimosAportes.forEach(aporte => {
                const li = document.createElement('li');
                li.textContent = `ID: ${aporte.id_aporte.substring(0, 8)}... - Monto: $${aporte.monto} - Fecha: ${new Date(aporte.fecha).toLocaleDateString()}`;
                ultimosAportesList.appendChild(li);
            });
        } else {
            ultimosAportesList.innerHTML = '<li>No hay últimos aportes para mostrar.</li>';
        }

    } else {
        alert('Error al cargar las estadísticas del dashboard: ' + response.message);
    }
}

// --- Aportes / Participantes Module Logic (Admin View) ---
async function loadAportesList(monthFilter = '', tutoraFilter = '', searchTerm = '') {
    const aportesTableBody = document.getElementById('aportes-table-body');
    const noAportesMessage = document.getElementById('no-aportes-message');
    aportesTableBody.innerHTML = '';
    noAportesMessage.classList.add('hidden');

    const response = await fetchData('getAportes');
    if (response.status === 'success') {
        let filteredAportes = response.filter(aporte => {
            const aporteDate = new Date(aporte.fecha_aporte);
            const monthMatches = monthFilter ? (aporteDate.getFullYear() === new Date(monthFilter).getFullYear() && aporteDate.getMonth() === new Date(monthFilter).getMonth()) : true;
            const tutoraMatches = tutoraFilter ? (aporte.tutora.toLowerCase() === tutoraFilter.toLowerCase()) : true;
            const searchMatches = searchTerm ? (
                aporte.nombre_participante.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (aporte.id_participante && aporte.id_participante.toLowerCase().includes(searchTerm.toLowerCase())) // Asumiendo que el ID podría ser el 'código' buscado
            ) : true;
            return monthMatches && tutoraMatches && searchMatches;
        });

        if (filteredAportes.length > 0) {
            filteredAportes.forEach(aporte => {
                const row = `
                    <tr>
                        <td>${new Date(aporte.fecha_aporte).toLocaleDateString()}</td>
                        <td>${aporte.nombre_participante}</td>
                        <td class="admin-only">${aporte.tutora}</td>
                        <td>$${aporte.monto_total_pagado}</td>
                        <td>${aporte.meses_pagados || 'N/A'}</td>
                        <td>$${aporte.monto_abono || 0}</td>
                        <td>
                            <button class="view-aporte-details" data-id="${aporte.id_aporte}">Ver</button>
                        </td>
                    </tr>
                `;
                aportesTableBody.insertAdjacentHTML('beforeend', row);
            });
        } else {
            noAportesMessage.classList.remove('hidden');
        }
        // Configurar la visibilidad de la columna de tutora después de cargar los datos
        if (currentUserRole !== 'admin') {
            document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
        }
    } else {
        alert('Error al cargar la lista de aportes: ' + response.message);
    }
}

document.getElementById('apply-filters-button').addEventListener('click', () => {
    const month = document.getElementById('filter-month').value;
    const tutora = document.getElementById('filter-tutora').value;
    const searchTerm = document.getElementById('search-input').value;
    loadAportesList(month, tutora, searchTerm);
});


async function loadParticipantesForSelect() {
    const selectParticipante = document.getElementById('select-participante');
    selectParticipante.innerHTML = '<option value="">-- Seleccione un participante --</option>';

    const response = await fetchData('getParticipantes');
    if (response.status === 'success') {
        response.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = `${p.nombre} (${p.codigo})`;
            selectParticipante.appendChild(option);
        });
    } else {
        alert('Error al cargar participantes: ' + response.message);
    }
}

document.getElementById('select-participante').addEventListener('change', async (event) => {
    const participantId = event.target.value;
    const participanteInfoDiv = document.getElementById('participante-info');
    const paymentSection = document.getElementById('payment-section');

    if (participantId) {
        const response = await fetchData('getParticipantDetails', { id: participantId });
        if (response.status === 'success') {
            document.getElementById('info-codigo').textContent = response.codigo || 'N/A';
            document.getElementById('info-nombre').textContent = response.nombre;
            document.getElementById('info-ciudadania').textContent = response.ciudadania;
            document.getElementById('info-ultimo-mes-pagado').textContent = response.ultimoMesPagado ? new Date(response.ultimoMesPagado).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : 'Nunca';
            document.getElementById('info-meses-pendientes').textContent = response.mesesPendientes;
            document.getElementById('info-total-pendiente').textContent = `$${response.totalPendiente.toFixed(2)}`;
            document.getElementById('info-tutora').textContent = response.tutora;
            participanteInfoDiv.classList.remove('hidden');
            paymentSection.classList.remove('hidden');
            generateMesesAPagarCheckboxes(response.mesesDisponiblesParaPagar);
            calculateTotalAmountDue(); // Calcular el monto inicial
        } else {
            alert('Error al obtener detalles del participante: ' + response.message);
            participanteInfoDiv.classList.add('hidden');
            paymentSection.classList.add('hidden');
        }
    } else {
        participanteInfoDiv.classList.add('hidden');
        paymentSection.classList.add('hidden');
    }
});

function generateMesesAPagarCheckboxes(meses) {
    const container = document.getElementById('meses-a-pagar-checkboxes');
    container.innerHTML = '';
    meses.forEach(mes => {
        const div = document.createElement('div');
        div.className = 'checkbox-item'; // Usar una clase CSS simple
        div.innerHTML = `
            <input type="checkbox" id="mes-${mes.replace(/\s/g, '-')}" value="${mes}">
            <label for="mes-${mes.replace(/\s/g, '-')}" >${mes}</label>
        `;
        container.appendChild(div);
    });
    // Añadir listener para recalcular cuando se seleccionan meses
    container.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', calculateTotalAmountDue);
    });
    document.getElementById('monto-abono').addEventListener('input', calculateTotalAmountDue);
}

async function calculateTotalAmountDue() {
    const selectedParticipantId = document.getElementById('select-participante').value;
    if (!selectedParticipantId) return;

    const selectedMonths = Array.from(document.querySelectorAll('#meses-a-pagar-checkboxes input:checked'))
                               .map(cb => cb.value);
    const abono = parseFloat(document.getElementById('monto-abono').value) || 0;

    const response = await fetchData('getParticipantDetails', { id: selectedParticipantId });
    if (response.status === 'success') {
        const currentAporteValue = await getAporteValueFrontend();

        const totalMesesCalculado = selectedMonths.length * currentAporteValue;
        const totalACobrar = totalMesesCalculado - abono;
        document.getElementById('monto-total-a-cobrar').value = `$${Math.max(0, totalACobrar).toFixed(2)}`;
    }
}

// Helper para obtener el valor del aporte (simulando la llamada a Apps Script)
async function getAporteValueFrontend() {
    const today = new Date();
    if (today >= new Date('2024-07-01')) {
        return 3000;
    } else {
        return 2000;
    }
}


document.getElementById('registrar-aporte-button').addEventListener('click', async () => {
    const participantId = document.getElementById('select-participante').value;
    const mesesAPagar = Array.from(document.querySelectorAll('#meses-a-pagar-checkboxes input:checked'))
                               .map(cb => cb.value);
    const montoTotalPagado = parseFloat(document.getElementById('monto-recibido').value) || 0;
    const abono = parseFloat(document.getElementById('monto-abono').value) || 0;
    const registroMessage = document.getElementById('registro-message');

    if (!participantId || mesesAPagar.length === 0 || montoTotalPagado <= 0) {
        registroMessage.textContent = 'Por favor, seleccione un participante, al menos un mes y el monto recibido.';
        registroMessage.className = 'message error';
        return;
    }

    const currentAporteValue = await getAporteValueFrontend();
    const valorMesesTeorico = mesesAPagar.length * currentAporteValue;
    let montoPagoMeses = valorMesesTeorico;
    let montoAbonoReal = abono;

    if (montoTotalPagado > valorMesesTeorico) {
        montoAbonoReal = montoTotalPagado - valorMesesTeorico;
    } else if (montoTotalPagado < valorMesesTeorico) {
        montoPagoMeses = montoTotalPagado - abono;
        if (montoPagoMeses < 0) {
            montoPagoMeses = 0;
        }
        montoAbonoReal = abono;
        registroMessage.textContent = 'Advertencia: El monto recibido es menor al total de los meses seleccionados. Se registrará un pago parcial.';
        registroMessage.className = 'message info';
    } else {
        montoAbonoReal = abono;
    }


    registroMessage.textContent = 'Registrando aporte...';
    registroMessage.className = 'message info';

    const data = {
        id_participante: participantId,
        mesesAPagar: mesesAPagar,
        montoTotalPagado: montoTotalPagado,
        montoPagoMeses: montoPagoMeses,
        abono: montoAbonoReal
    };

    const response = await fetchData('recordAporte', {}, 'POST', data);

    if (response.status === 'success') {
        registroMessage.textContent = 'Aporte registrado exitosamente!';
        registroMessage.className = 'message success';
        // Resetear formulario y recargar lista de aportes
        document.getElementById('select-participante').value = '';
        document.getElementById('participante-info').classList.add('hidden');
        document.getElementById('payment-section').classList.add('hidden');
        document.getElementById('monto-abono').value = '0';
        document.getElementById('monto-recibido').value = '';
        document.getElementById('monto-total-a-cobrar').value = '';
        loadAportesList();
        loadParticipantesForSelect(); // Recargar para actualizar "ultimo mes pagado"
    } else {
        registroMessage.textContent = 'Error al registrar aporte: ' + response.message;
        registroMessage.className = 'message error';
    }
});


// --- Aportes / Participantes Module Logic (Tutora View) ---
async function loadTutoraParticipantes() {
    const tutoraParticipantesTableBody = document.getElementById('tutora-participantes-table-body');
    tutoraParticipantesTableBody.innerHTML = '';

    const response = await fetchData('getParticipantes', { tutoraName: currentTutoraName }); // Llama a la función específica de tutora
    if (response.status === 'success') {
        if (response.length > 0) {
            response.forEach(p => {
                const row = `
                    <tr>
                        <td>${p.codigo || 'N/A'}</td>
                        <td>${p.participante}</td>
                        <td>${p.ciudadania}</td>
                        <td>${p.ultimoMesPago ? new Date(p.ultimoMesPago).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : 'Nunca'}</td>
                        <td>${p.mesesEnDeuda}</td>
                        <td>$${p.totalAPagarEstarAlDia.toFixed(2)}</td>
                        <td>
                            <button class="view-payment-status" data-id="${p.id}" data-name="${p.participante}">Ver</button>
                        </td>
                        <td>
                            <button class="share-participant-url" data-id="${p.id}">Compartir URL</button>
                        </td>
                    </tr>
                `;
                tutoraParticipantesTableBody.insertAdjacentHTML('beforeend', row);
            });

            // Añadir event listeners para los botones "Ver Estado" y "Compartir URL"
            document.querySelectorAll('.view-payment-status').forEach(button => {
                button.addEventListener('click', (e) => {
                    const participantId = e.target.dataset.id;
                    const participantName = e.target.dataset.name;
                    showPaymentStatusModal(participantId, participantName);
                });
            });
            document.querySelectorAll('.share-participant-url').forEach(button => {
                button.addEventListener('click', (e) => {
                    const participantId = e.target.dataset.id;
                    generateAndShareParticipantUrl(participantId);
                });
            });

        } else {
            tutoraParticipantesTableBody.innerHTML = '<tr><td colspan="8" class="text-center">No tienes participantes asignados.</td></tr>';
        }
    } else {
        alert('Error al cargar participantes para la tutora: ' + response.message);
    }
}

async function showPaymentStatusModal(participantId, participantName) {
    const modal = document.getElementById('payment-status-modal');
    const modalParticipantName = document.getElementById('modal-participant-name');
    const paymentStatusGridContainer = document.getElementById('payment-status-grid-container');

    modalParticipantName.textContent = participantName;
    paymentStatusGridContainer.innerHTML = 'Cargando estado de pagos...';
    modal.classList.remove('hidden');

    const response = await fetchData('getPublicParticipantData', { id: participantId });
    if (response.status === 'success' && response.data) {
        const paymentStatus = response.data.paymentStatus;
        let gridHtml = `
            <div class="payment-grid">
                <div class="payment-grid-header">Año</div>
                <div class="payment-grid-header">Ene</div>
                <div class="payment-grid-header">Feb</div>
                <div class="payment-grid-header">Mar</div>
                <div class="payment-grid-header">Abr</div>
                <div class="payment-grid-header">May</div>
                <div class="payment-grid-header">Jun</div>
                <div class="payment-grid-header">Jul</div>
                <div class="payment-grid-header">Ago</div>
                <div class="payment-grid-header">Sep</div>
                <div class="payment-grid-header">Oct</div>
                <div class="payment-grid-header">Nov</div>
                <div class="payment-grid-header">Dic</div>
        `;

        for (let year = 2022; year <= 2025; year++) {
            gridHtml += `<div class="payment-grid-item font-bold">${year}</div>`;
            const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
            months.forEach(month => {
                const status = paymentStatus[year] && paymentStatus[year][month] ? paymentStatus[year][month] : '✗';
                const statusClass = status === '✓' ? 'paid' : 'unpaid';
                gridHtml += `<div class="payment-grid-item ${statusClass}">${status}</div>`;
            });
        }
        gridHtml += `</div>`;
        paymentStatusGridContainer.innerHTML = gridHtml;

    } else {
        paymentStatusGridContainer.innerHTML = `<p class="message error">Error al cargar el estado de pagos: ${response.message}</p>`;
    }
}

async function generateAndShareParticipantUrl(participantId) {
    const response = await fetchData('generateParticipantUrl', { id: participantId });
    if (response.status === 'success' && response.url) {
        prompt('Copia la siguiente URL para compartir con el participante:', response.url);
    } else {
        alert('Error al generar la URL: ' + response.message);
    }
}


// --- Gestionar Participantes Module Logic (Admin Only) ---
let currentEditParticipanteId = null;

async function loadParticipantesCrudTable() {
    const participantesCrudTableBody = document.getElementById('participantes-crud-table-body');
    participantesCrudTableBody.innerHTML = '';

    const response = await fetchData('getParticipantes');
    if (response.status === 'success') {
        if (response.length > 0) {
            response.forEach(p => {
                const row = `
                    <tr>
                        <td>${p.codigo || 'N/A'}</td>
                        <td>${p.nombre}</td>
                        <td>${p.ciudadania}</td>
                        <td>${p.tutora}</td>
                        <td>
                            <button class="edit-participante" data-id="${p.id}">Editar</button>
                            <button class="delete-participante" data-id="${p.id}">Eliminar</button>
                        </td>
                    </tr>
                `;
                participantesCrudTableBody.insertAdjacentHTML('beforeend', row);
            });

            document.querySelectorAll('.edit-participante').forEach(button => {
                button.addEventListener('click', (e) => editParticipante(e.target.dataset.id));
            });
            document.querySelectorAll('.delete-participante').forEach(button => {
                button.addEventListener('click', (e) => deleteParticipante(e.target.dataset.id));
            });
        } else {
            participantesCrudTableBody.innerHTML = '<tr><td colspan="5" class="text-center">No hay participantes registrados.</td></tr>';
        }
    } else {
        alert('Error al cargar la lista de participantes: ' + response.message);
    }
}

document.getElementById('save-participante-button').addEventListener('click', async () => {
    const id = document.getElementById('participante-id').value;
    const codigo = document.getElementById('new-codigo').value;
    const nombre = document.getElementById('new-nombre').value;
    const ciudadania = document.getElementById('new-ciudadania').value;
    const tutora = document.getElementById('new-tutora').value;
    const crudMessage = document.getElementById('crud-message');

    if (!nombre || !ciudadania || !tutora) {
        crudMessage.textContent = 'Nombre, Ciudadanía y Tutora son campos obligatorios.';
        crudMessage.className = 'message error';
        return;
    }

    crudMessage.textContent = 'Guardando participante...';
    crudMessage.className = 'message info';

    let response;
    const data = { codigo, nombre, ciudadania, tutora };

    if (id) { // Modificar
        data.id = id;
        response = await fetchData('updateParticipante', {}, 'POST', data);
    } else { // Registrar nuevo
        response = await fetchData('addParticipante', {}, 'POST', data);
    }

    if (response.status === 'success') {
        crudMessage.textContent = response.message;
        crudMessage.className = 'message success';
        resetParticipanteForm();
        loadParticipantesCrudTable();
    } else {
        crudMessage.textContent = 'Error: ' + response.message;
        crudMessage.className = 'message error';
    }
});

function editParticipante(id) {
    const participantesTableBody = document.getElementById('participantes-crud-table-body');
    const rows = Array.from(participantesTableBody.children);
    const rowToEdit = rows.find(row => {
        const editButton = row.querySelector('.edit-participante');
        return editButton && editButton.dataset.id === id;
    });

    if (rowToEdit) {
        document.getElementById('participante-id').value = id;
        document.getElementById('new-codigo').value = rowToEdit.cells[0].textContent !== 'N/A' ? rowToEdit.cells[0].textContent : '';
        document.getElementById('new-nombre').value = rowToEdit.cells[1].textContent;
        document.getElementById('new-ciudadania').value = rowToEdit.cells[2].textContent;
        document.getElementById('new-tutora').value = rowToEdit.cells[3].textContent.toLowerCase();

        document.getElementById('save-participante-button').textContent = 'Actualizar Participante';
        document.getElementById('cancel-edit-button').classList.remove('hidden');
        currentEditParticipanteId = id;
    }
}

document.getElementById('cancel-edit-button').addEventListener('click', resetParticipanteForm);

function resetParticipanteForm() {
    document.getElementById('participante-id').value = '';
    document.getElementById('new-codigo').value = '';
    document.getElementById('new-nombre').value = '';
    document.getElementById('new-ciudadania').value = '';
    document.getElementById('new-tutora').value = '';
    document.getElementById('save-participante-button').textContent = 'Guardar Participante';
    document.getElementById('cancel-edit-button').classList.add('hidden');
    document.getElementById('crud-message').textContent = '';
    currentEditParticipanteId = null;
}

async function deleteParticipante(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este participante? Esta acción es irreversible.')) {
        const crudMessage = document.getElementById('crud-message');
        crudMessage.textContent = 'Eliminando participante...';
        crudMessage.className = 'message info';

        const response = await fetchData('deleteParticipante', {}, 'POST', { id: id });
        if (response.status === 'success') {
            crudMessage.textContent = response.message;
            crudMessage.className = 'message success';
            loadParticipantesCrudTable();
        } else {
            crudMessage.textContent = 'Error al eliminar participante: ' + response.message;
            crudMessage.className = 'message error';
        }
    }
}

// Event listener para manejar el estado público del participante si se accede directamente por URL
window.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    const participantId = urlParams.get('id');

    if (action === 'getPublicParticipantData' && participantId) {
        loginModule.classList.add('hidden');
        mainApp.classList.add('hidden'); // Ocultar la aplicación principal

        const publicViewContainer = document.createElement('div');
        publicViewContainer.className = 'container'; // Aplicar tu clase de contenedor
        publicViewContainer.innerHTML = `
            <h2>Estado de Aportes del Participante</h2>
            <div id="public-participant-details" class="section-card">
                <p>Cargando información...</p>
            </div>
            <div id="public-payment-status-grid-container" class="section-card">
                </div>
        `;
        document.body.appendChild(publicViewContainer);

        const response = await fetchData('getPublicParticipantData', { id: participantId });
        if (response.status === 'success' && response.data) {
            const participantInfo = response.data.participantInfo;
            const paymentStatus = response.data.paymentStatus;

            document.getElementById('public-participant-details').innerHTML = `
                <p><strong>Código:</strong> ${participantInfo.codigo || 'N/A'}</p>
                <p><strong>Nombre:</strong> ${participantInfo.nombre}</p>
                <p><strong>Ciudadanía:</strong> ${participantInfo.ciudadania}</p>
                <p><strong>Último Mes Pago:</strong> ${participantInfo.ultimoMesPago ? new Date(participantInfo.ultimoMesPago).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : 'Nunca'}</p>
                <p><strong>Meses en Deuda:</strong> ${participantInfo.mesesEnDeuda}</p>
                <p><strong>Total a Pagar (al día):</strong> $${participantInfo.totalAPagarEstarAlDia.toFixed(2)}</p>
            `;

            let gridHtml = `
                <h3>Historial de Pagos</h3>
                <div class="payment-grid">
                    <div class="payment-grid-header">Año</div>
                    <div class="payment-grid-header">Ene</div>
                    <div class="payment-grid-header">Feb</div>
                    <div class="payment-grid-header">Mar</div>
                    <div class="payment-grid-header">Abr</div>
                    <div class="payment-grid-header">May</div>
                    <div class="payment-grid-header">Jun</div>
                    <div class="payment-grid-header">Jul</div>
                    <div class="payment-grid-header">Ago</div>
                    <div class="payment-grid-header">Sep</div>
                    <div class="payment-grid-header">Oct</div>
                    <div class="payment-grid-header">Nov</div>
                    <div class="payment-grid-header">Dic</div>
            `;

            for (let year = 2022; year <= 2025; year++) {
                gridHtml += `<div class="payment-grid-item font-bold">${year}</div>`;
                const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
                months.forEach(month => {
                    const status = paymentStatus[year] && paymentStatus[year][month] ? paymentStatus[year][month] : '✗';
                    const statusClass = status === '✓' ? 'paid' : 'unpaid';
                    gridHtml += `<div class="payment-grid-item ${statusClass}">${status}</div>`;
                });
            }
            gridHtml += `</div>`;
            document.getElementById('public-payment-status-grid-container').innerHTML = gridHtml;

        } else {
            document.getElementById('public-participant-details').innerHTML = `<p class="message error">Error al cargar la información del participante o participante no encontrado.</p>`;
            document.getElementById('public-payment-status-grid-container').innerHTML = '';
        }
    } else {
        // Si no es una URL pública de participante, mostrar el módulo de login
        loginModule.classList.remove('hidden');
    }
});