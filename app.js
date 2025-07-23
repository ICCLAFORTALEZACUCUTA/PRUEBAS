const APPS_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwpDK1BbSBCnx-3q8qaSdeS4DG0IEadNEty1sUARIbR1w1ZWWvfGbpaMq1tghHaB9Kk/exec'; // ¡URL CONFIGURADA!

// DECLARACIÓN DE VARIABLES PARA ELEMENTOS DEL DOM (Inicialmente nulas o sin asignar)
// Serán asignadas DENTRO de DOMContentLoaded para asegurar que existan.
let loginModule;
let mainApp;
let loginButton;
let logoutButton;
let loginMessage;
let usernameInput;
let passwordInput;

let dashboardNav;
let aportesNav;
let participantesCrudNav;

let dashboardModule;
let aportesParticipantesModule;
let participantesCrudModule;

let currentUserRole = '';
let currentTutoraName = '';

// Elementos para el módulo de Aportes/Participantes
let filterMonthSelect;
let filterTutoraSelect;
let searchAportesInput;
let newAporteParticipantSelect;
let newAporteParticipantCode;
let newAporteParticipantCitizenship;
let newAporteLastPaidMonth;
let newAporteMesesPendientes;
let newAporteTotalPendiente;
let newAporteTutora;
let newAporteMontoInput;
let newAporteMesesInput;
let saveAporteButton;
let newAporteMessage;

// Elementos para el módulo CRUD de Participantes
let crudParticipanteList;
let addParticipanteButton;
let participanteForm;
let newParticipanteIdInput;
let newParticipanteCodeInput;
let newParticipanteNameInput;
let newParticipanteCitizenshipInput;
let newParticipanteTutoraSelect;
let saveParticipanteButton;
let cancelEditButton;
let crudMessage;

let currentEditingParticipantId = null; // Para saber si estamos editando o creando

// Variables globales para datos
let allAportes = [];
let allParticipants = [];

// --- Funciones de Utilidad ---
function showModule(module) {
    dashboardModule.classList.add('hidden');
    aportesParticipantesModule.classList.add('hidden');
    participantesCrudModule.classList.add('hidden');
    if (module) {
        module.classList.remove('hidden');
    }
}

async function fetchData(action, params = {}, method = 'GET', body = null) {
    let url = new URL(APPS_SCRIPT_WEB_APP_URL);
    url.searchParams.append('action', action);

    for (const key in params) {
        url.searchParams.append(key, params[key]);
    }

    const options = { method: method };
    if (body) {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url.toString(), options);
        if (!response.ok) {
            // Intenta leer el body del error si es posible
            const errorBody = await response.text();
            console.error(`Error HTTP! status: ${response.status}, body: ${errorBody}`);
            throw new Error(`HTTP error! status: ${response.status}. Details: ${errorBody}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching data for action "${action}": ${error.name}: ${error.message}`);
        throw error;
    }
}

function updateNavigationVisibility() {
    dashboardNav.classList.add('hidden');
    participantesCrudNav.classList.add('hidden');

    if (currentUserRole === 'admin' || currentUserRole === 'directora' || currentUserRole === 'asegurador') {
        dashboardNav.classList.remove('hidden');
        participantesCrudNav.classList.remove('hidden');
    }
    // Aportes/Participantes es visible para todos
    aportesNav.classList.remove('hidden');

    // Reset active state for all nav buttons
    const navButtons = document.querySelectorAll('.nav-button');
    navButtons.forEach(btn => btn.classList.remove('active'));
}

// --- Funciones de Login ---
async function handleLoginFrontend() {
    const username = usernameInput.value;
    const password = passwordInput.value;

    loginMessage.textContent = 'Iniciando sesión...';
    loginMessage.classList.remove('error');
    loginMessage.classList.remove('success');

    try {
        const data = await fetchData('login', { username, password });

        if (data.status === 'success') {
            currentUserRole = data.user.role;
            currentTutoraName = data.user.tutoraName;
            localStorage.setItem('currentUserRole', currentUserRole);
            localStorage.setItem('currentTutoraName', currentTutoraName);
            localStorage.setItem('isLoggedIn', 'true');

            loginModule.classList.add('hidden');
            mainApp.classList.remove('hidden');
            loginMessage.textContent = ''; // Limpiar mensaje en éxito
            updateNavigationVisibility(); // Actualizar visibilidad de módulos

            // Obtener configuración de aporte DESPUÉS del login exitoso
            getAporteValueFrontend(); // Esta es la llamada que genera el error reportado

            // Mostrar el módulo por defecto (Dashboard o Aportes/Participantes)
            if (currentUserRole === 'admin' || currentUserRole === 'directora' || currentUserRole === 'asegurador') {
                showModule(dashboardModule);
                dashboardNav.classList.add('active');
            } else { // Si es tutora, ir directamente al módulo de aportes/participantes
                showModule(aportesParticipantesModule);
                aportesNav.classList.add('active');
            }


        } else {
            loginMessage.textContent = data.message || 'Error de inicio de sesión. Usuario o contraseña incorrectos.';
            loginMessage.classList.add('error');
        }
    } catch (error) {
        console.error('Error durante el inicio de sesión:', error);
        loginMessage.textContent = 'Error al conectar con el servidor o error de red.';
        loginMessage.classList.add('error');
    }
}

function handleLogoutFrontend() {
    localStorage.removeItem('currentUserRole');
    localStorage.removeItem('currentTutoraName');
    localStorage.removeItem('isLoggedIn');
    currentUserRole = '';
    currentTutoraName = '';
    loginModule.classList.remove('hidden');
    mainApp.classList.add('hidden');
    loginMessage.textContent = '';
    usernameInput.value = '';
    passwordInput.value = '';
    // Limpiar módulos activos
    const navButtons = document.querySelectorAll('.nav-button');
    navButtons.forEach(btn => btn.classList.remove('active'));
    showModule(null); // Ocultar todos los módulos
}

// --- Funciones de Dashboard ---
async function loadDashboardData() {
    try {
        const data = await fetchData('getDashboardData');
        if (data.status === 'success') {
            document.getElementById('total-aportes-mes').textContent = `$${parseFloat(data.totalAportesMes).toLocaleString('es-CO')}`;
            document.getElementById('total-aportes-anuales').textContent = `$${parseFloat(data.totalAportesAnual).toLocaleString('es-CO')}`;
            document.getElementById('media-aportes-mes').textContent = `$${parseFloat(data.mediaAportesMes).toLocaleString('es-CO')}`;

            // Últimos 10 aportes
            const last10AportesBody = document.getElementById('last-10-aportes-body');
            last10AportesBody.innerHTML = '';
            data.last10Aportes.forEach(aporte => {
                const row = last10AportesBody.insertRow();
                row.insertCell(0).textContent = aporte.Fecha;
                row.insertCell(1).textContent = aporte.Participante;
                row.insertCell(2).textContent = `$${parseFloat(aporte.Monto).toLocaleString('es-CO')}`;
                row.insertCell(3).textContent = aporte.Tutora;
            });

            // Gráficas (Chart.js)
            renderCharts(data.aportesPorMesAnual, data.aportesPorTutora);

        } else {
            console.error('Error al cargar datos del dashboard:', data.message);
            // Puedes mostrar un mensaje al usuario en la UI
        }
    } catch (error) {
        console.error('Error en loadDashboardData:', error);
        // Mensaje de error genérico en la UI
    }
}

let monthlyChart = null;
let tutoraChart = null;

function renderCharts(monthlyData, tutoraData) {
    const monthlyCtx = document.getElementById('monthlyAportesChart').getContext('2d');
    const tutoraCtx = document.getElementById('tutoraAportesChart').getContext('2d');

    // Destruir gráficos anteriores si existen
    if (monthlyChart) monthlyChart.destroy();
    if (tutoraChart) tutoraChart.destroy();

    // Chart: Aportes por Mes/Año
    const monthlyLabels = Object.keys(monthlyData).sort((a, b) => {
        const [monthA, yearA] = a.split(' ');
        const [monthB, yearB] = b.split(' ');
        const dateA = new Date(`${monthA} 1, ${yearA}`);
        const dateB = new Date(`${monthB} 1, ${yearB}`);
        return dateA - dateB;
    });
    const monthlyValues = monthlyLabels.map(label => monthlyData[label]);

    monthlyChart = new Chart(monthlyCtx, {
        type: 'bar',
        data: {
            labels: monthlyLabels,
            datasets: [{
                label: 'Aportes Mensuales',
                data: monthlyValues,
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Monto ($)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Mes y Año'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Monto: $' + context.raw.toLocaleString('es-CO');
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'Aportes Totales por Mes y Año'
                }
            }
        }
    });

    // Chart: Aportes por Tutora
    const tutoraLabels = Object.keys(tutoraData);
    const tutoraValues = tutoraLabels.map(label => tutoraData[label]);

    tutoraChart = new Chart(tutoraCtx, {
        type: 'pie',
        data: {
            labels: tutoraLabels,
            datasets: [{
                label: 'Aportes por Tutora',
                data: tutoraValues,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.6)',
                    'rgba(54, 162, 235, 0.6)',
                    'rgba(255, 206, 86, 0.6)',
                    'rgba(75, 192, 192, 0.6)',
                    'rgba(153, 102, 255, 0.6)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let sum = 0;
                            let dataArr = context.chart.data.datasets[0].data;
                            dataArr.map(data => sum += data);
                            let percentage = (context.raw / sum * 100).toFixed(2) + '%';
                            return context.label + ': $' + context.raw.toLocaleString('es-CO') + ' (' + percentage + ')';
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'Distribución de Aportes por Tutora'
                }
            }
        }
    });
}


// --- Funciones de Aportes/Participantes (Módulo Principal) ---
async function loadAportesParticipantesData() {
    try {
        const data = await fetchData('getAllAportesAndParticipants');
        if (data.status === 'success') {
            displayAportes(data.allAportes);
            populateTutoraFilter(data.tutoras); // Asegúrate de que tu Apps Script devuelva 'tutoras'
            // Guardar todos los participantes para el buscador y registro de nuevo ingreso
            allParticipants = data.allParticipants; // Asignar a una variable global
            populateParticipantSelect(allParticipants);
        } else {
            console.error('Error al cargar datos de aportes/participantes:', data.message);
        }
    } catch (error) {
        console.error('Error en loadAportesParticipantesData:', error);
    }
}


function displayAportes(aportesToDisplay) {
    allAportes = aportesToDisplay; // Guardar la lista completa de aportes
    const tbody = document.getElementById('aportes-table-body');
    tbody.innerHTML = '';
    if (!aportesToDisplay || aportesToDisplay.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No hay aportes para mostrar.</td></tr>';
        return;
    }

    // Ordenar aportes por fecha descendente
    aportesToDisplay.sort((a, b) => new Date(b.Fecha) - new Date(a.Fecha));

    aportesToDisplay.forEach(aporte => {
        const row = tbody.insertRow();
        row.insertCell(0).textContent = aporte.Fecha;
        row.insertCell(1).textContent = aporte.Participante;
        row.insertCell(2).textContent = aporte.Código;
        row.insertCell(3).textContent = `$${parseFloat(aporte.Monto).toLocaleString('es-CO')}`;
        row.insertCell(4).textContent = aporte.Meses; // Meses pagados
        row.insertCell(5).textContent = aporte.Tutora;
        row.insertCell(6).innerHTML = `
            <button class="edit-btn" data-id="${aporte.ID}">Editar</button>
            <button class="delete-btn" data-id="${aporte.ID}">Eliminar</button>
        `;
    });
    addAporteEventListeners(); // Añadir listeners después de renderizar
}

function addAporteEventListeners() {
    document.querySelectorAll('.edit-btn').forEach(button => {
        button.onclick = (e) => openEditAporteModal(e.target.dataset.id);
    });
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.onclick = (e) => deleteAporte(e.target.dataset.id);
    });
}

// Filtros y Buscador
function applyAportesFilters() {
    const selectedMonth = filterMonthSelect.value;
    const selectedTutora = filterTutoraSelect.value;
    const searchTerm = searchAportesInput.value.toLowerCase();

    let filteredAportes = allAportes.filter(aporte => {
        const matchesMonth = selectedMonth === '' || new Date(aporte.Fecha).getMonth() === parseInt(selectedMonth);
        const matchesTutora = selectedTutora === '' || aporte.Tutora === selectedTutora;
        const matchesSearch = searchTerm === '' ||
                              aporte.Participante.toLowerCase().includes(searchTerm) ||
                              aporte.Código.toLowerCase().includes(searchTerm);
        return matchesMonth && matchesTutora && matchesSearch;
    });
    displayAportes(filteredAportes);
}


function populateTutoraFilter(tutoras) {
    filterTutoraSelect.innerHTML = '<option value="">Todas las Tutoras</option>';
    tutoras.forEach(tutora => {
        const option = document.createElement('option');
        option.value = tutora;
        option.textContent = tutora;
        filterTutoraSelect.appendChild(option);
    });
}


// --- Registrar Nuevo Ingreso (Formulario) ---
function populateParticipantSelect(participants) {
    newAporteParticipantSelect.innerHTML = '<option value="">-- Seleccione un Participante --</option>';
    participants.forEach(p => {
        const option = document.createElement('option');
        option.value = p.ID; // Asumiendo que el ID es un identificador único
        option.textContent = `${p.Nombre} (${p.Código})`;
        newAporteParticipantSelect.appendChild(option);
    });
}


// Calcula el monto total a pagar según los meses seleccionados
async function updateMontoTotal() {
    const selectedMonths = Array.from(newAporteMesesInput.selectedOptions).map(option => option.value);
    const participantId = newAporteParticipantSelect.value;

    if (selectedMonths.length > 0 && participantId) {
        try {
            // Llama a Apps Script para obtener el monto total basado en los meses seleccionados
            const data = await fetchData('calculateTotalAporte', {
                participantId: participantId,
                months: JSON.stringify(selectedMonths)
            });

            if (data.status === 'success' && data.totalAporte !== undefined) {
                newAporteMontoInput.value = parseFloat(data.totalAporte).toFixed(2);
            } else {
                console.error('Error al calcular monto total:', data.message);
                newAporteMontoInput.value = '0.00';
            }
        } catch (error) {
            console.error('Error en updateMontoTotal:', error);
            newAporteMontoInput.value = '0.00';
        }
    } else {
        // Si no hay meses seleccionados o participante, el monto es 0
        newAporteMontoInput.value = '0.00';
    }
}


function clearNewAporteForm() {
    newAporteParticipantSelect.value = '';
    newAporteParticipantCode.textContent = '';
    newAporteParticipantCitizenship.textContent = '';
    newAporteLastPaidMonth.textContent = '';
    newAporteMesesPendientes.textContent = '';
    newAporteTotalPendiente.textContent = '';
    newAporteTutora.textContent = '';
    newAporteMontoInput.value = '0.00';
    newAporteMesesInput.innerHTML = ''; // Limpiar opciones de meses
    newAporteMessage.textContent = '';
}


// --- Funciones de Gestión de Participantes (CRUD) ---
async function loadParticipantesCrudData() {
    try {
        const data = await fetchData('getAllParticipants');
        if (data.status === 'success') {
            displayParticipantesCrud(data.participants);
            // Asegúrate de poblar el select de tutoras en el formulario CRUD
            populateCrudTutoraSelect(data.tutoras); // Asumiendo que Apps Script devuelve una lista de tutoras
        } else {
            console.error('Error al cargar participantes para CRUD:', data.message);
        }
    } catch (error) {
        console.error('Error en loadParticipantesCrudData:', error);
    }
}

function displayParticipantesCrud(participants) {
    const tbody = document.getElementById('crud-participantes-table-body');
    tbody.innerHTML = '';
    if (!participants || participants.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No hay participantes registrados.</td></tr>';
        return;
    }

    // Ordenar participantes por nombre alfabéticamente
    participants.sort((a, b) => a.Nombre.localeCompare(b.Nombre));

    participants.forEach(p => {
        const row = tbody.insertRow();
        row.insertCell(0).textContent = p.ID;
        row.insertCell(1).textContent = p.Código;
        row.insertCell(2).textContent = p.Nombre;
        row.insertCell(3).textContent = p.Ciudadanía;
        row.insertCell(4).textContent = p.Tutora;
        row.insertCell(5).textContent = p.UltimoMesPago || 'N/A'; // Puede no tener pagos
        row.insertCell(6).innerHTML = `
            <button class="edit-crud-btn" data-id="${p.ID}">Editar</button>
            <button class="delete-crud-btn" data-id="${p.ID}">Eliminar</button>
        `;
    });
    addCrudEventListeners();
}

function addCrudEventListeners() {
    document.querySelectorAll('.edit-crud-btn').forEach(button => {
        button.onclick = (e) => openEditParticipanteForm(e.target.dataset.id);
    });
    document.querySelectorAll('.delete-crud-btn').forEach(button => {
        button.onclick = (e) => deleteParticipante(e.target.dataset.id);
    });
}

function populateCrudTutoraSelect(tutoras) {
    newParticipanteTutoraSelect.innerHTML = '<option value="">-- Seleccione Tutora --</option>';
    tutoras.forEach(tutora => {
        const option = document.createElement('option');
        option.value = tutora;
        option.textContent = tutora;
        newParticipanteTutoraSelect.appendChild(option);
    });
}


async function openEditParticipanteForm(id) {
    currentEditingParticipantId = id;
    try {
        const data = await fetchData('getParticipantById', { id: id });
        if (data.status === 'success' && data.participant) {
            const p = data.participant;
            newParticipanteIdInput.value = p.ID;
            newParticipanteCodeInput.value = p.Código;
            newParticipanteNameInput.value = p.Nombre;
            newParticipanteCitizenshipInput.value = p.Ciudadanía;
            newParticipanteTutoraSelect.value = p.Tutora; // Asegúrate de que el valor coincide con las opciones del select

            participanteForm.classList.remove('hidden');
            saveParticipanteButton.textContent = 'Actualizar Participante';
            cancelEditButton.classList.remove('hidden'); // Mostrar botón de cancelar
        } else {
            crudMessage.textContent = data.message || 'Participante no encontrado para edición.';
            crudMessage.classList.add('error');
        }
    } catch (error) {
        console.error('Error al abrir formulario de edición:', error);
        crudMessage.textContent = 'Error al obtener datos del participante para edición.';
        crudMessage.classList.add('error');
    }
}


async function deleteParticipante(id) {
    if (!confirm('¿Está seguro de que desea eliminar este participante? Esto también eliminará sus aportes.')) {
        return;
    }

    crudMessage.textContent = 'Eliminando participante...';
    crudMessage.classList.remove('error');
    crudMessage.classList.remove('success');

    try {
        const data = await fetchData('deleteParticipant', null, 'POST', { id: id });

        if (data.status === 'success') {
            crudMessage.textContent = data.message || 'Participante eliminado con éxito.';
            crudMessage.classList.add('success');
            loadParticipantesCrudData(); // Recargar la tabla
            loadAportesParticipantesData(); // Recargar select de participantes en aportes
            setTimeout(() => crudMessage.textContent = '', 3000);
        } else {
            crudMessage.textContent = data.message || 'Error al eliminar el participante.';
            crudMessage.classList.add('error');
        }
    } catch (error) {
        console.error('Error al eliminar participante:', error);
        crudMessage.textContent = 'Error al conectar con el servidor para eliminar el participante.';
        crudMessage.classList.add('error');
    }
}

function clearParticipanteForm() {
    newParticipanteIdInput.value = '';
    newParticipanteCodeInput.value = '';
    newParticipanteNameInput.value = '';
    newParticipanteCitizenshipInput.value = '';
    newParticipanteTutoraSelect.value = '';
    crudMessage.textContent = '';
    currentEditingParticipantId = null;
    saveParticipanteButton.textContent = 'Guardar Participante'; // Restablecer texto del botón
    cancelEditButton.classList.add('hidden'); // Ocultar si se limpia el form
}

// --- Obtener Valor de Aporte (Frontend) ---
// Esta función es llamada en la carga inicial y después de un login exitoso
// El error original que veías en consola venía del catch de esta función
async function getAporteValueFrontend() {
    try {
        const data = await fetchData('getAporteConfig');
        if (data.status === 'success') {
            console.log("Configuración de aporte obtenida:", data);
            document.getElementById('current-aporte-value').textContent = `$${parseFloat(data.currentAporteValue).toLocaleString('es-CO')}`;
            // Puedes actualizar otros elementos de UI si los tienes para aporteValueHastaJun2024 y aporteValueDesdeJul2024
        } else {
            console.error('Error al obtener configuración de aporte (status no success):', data.message);
            // Si hay un error, usa un valor por defecto o indica un problema en la UI
            document.getElementById('current-aporte-value').textContent = `Error al obtener el valor del aporte. Usando valor por defecto: $${(3000).toLocaleString('es-CO')}`;
        }
    } catch (error) {
        // Este catch se activará si fetchData lanza un error (ej. red, URL incorrecta, CORS fallido)
        console.error('Error al obtener el valor del aporte desde el servidor. Usando valor por defecto:', error);
        document.getElementById('current-aporte-value').textContent = `Error al obtener el valor del aporte. Usando valor por defecto: $${(3000).toLocaleString('es-CO')}`;
    }
}


// --- Lógica de Inicialización (se ejecuta cuando el DOM está completamente cargado) ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Asignar elementos DOM (¡AHORA ES SEGURO HACERLO!)
    loginModule = document.getElementById('login-module');
    mainApp = document.getElementById('main-app');
    loginButton = document.getElementById('login-button');
    logoutButton = document.getElementById('logout-button');
    loginMessage = document.getElementById('login-message');
    usernameInput = document.getElementById('username');
    passwordInput = document.getElementById('password');

    dashboardNav = document.getElementById('dashboard-nav');
    aportesNav = document.getElementById('aportes-nav');
    participantesCrudNav = document.getElementById('participantes-crud-nav');

    dashboardModule = document.getElementById('dashboard-module');
    aportesParticipantesModule = document.getElementById('aportes-participantes-module');
    participantesCrudModule = document.getElementById('participantes-crud-module');

    // Elementos del módulo de Aportes/Participantes
    filterMonthSelect = document.getElementById('filter-month');
    filterTutoraSelect = document.getElementById('filter-tutora');
    searchAportesInput = document.getElementById('search-aportes');
    newAporteParticipantSelect = document.getElementById('new-aporte-participant-select');
    newAporteParticipantCode = document.getElementById('new-aporte-participant-code');
    newAporteParticipantCitizenship = document.getElementById('new-aporte-participant-citizenship');
    newAporteLastPaidMonth = document.getElementById('new-aporte-last-paid-month');
    newAporteMesesPendientes = document.getElementById('new-aporte-meses-pendientes');
    newAporteTotalPendiente = document.getElementById('new-aporte-total-pendiente');
    newAporteTutora = document.getElementById('new-aporte-tutora');
    newAporteMontoInput = document.getElementById('new-aporte-monto');
    newAporteMesesInput = document.getElementById('new-aporte-meses');
    saveAporteButton = document.getElementById('save-aporte-button');
    newAporteMessage = document.getElementById('new-aporte-message');

    // Elementos del módulo CRUD de Participantes
    crudParticipanteList = document.getElementById('crud-participante-list');
    addParticipanteButton = document.getElementById('add-participante-button');
    participanteForm = document.getElementById('participante-form');
    newParticipanteIdInput = document.getElementById('new-participante-id');
    newParticipanteCodeInput = document.getElementById('new-participante-code');
    newParticipanteNameInput = document.getElementById('new-participante-name');
    newParticipanteCitizenshipInput = document.getElementById('new-ciudadania');
    newParticipanteTutoraSelect = document.getElementById('new-tutora');
    saveParticipanteButton = document.getElementById('save-participante-button');
    cancelEditButton = document.getElementById('cancel-edit-button');
    crudMessage = document.getElementById('crud-message');


    // 2. Adjuntar Listeners (¡AHORA ES SEGURO HACERLO!)
    if (loginButton) loginButton.addEventListener('click', handleLoginFrontend);
    if (logoutButton) logoutButton.addEventListener('click', handleLogoutFrontend);
    if (filterMonthSelect) filterMonthSelect.addEventListener('change', applyAportesFilters);
    if (filterTutoraSelect) filterTutoraSelect.addEventListener('change', applyAportesFilters);
    if (searchAportesInput) searchAportesInput.addEventListener('input', applyAportesFilters);
    if (newAporteParticipantSelect) newAporteParticipantSelect.addEventListener('change', async () => {
        const participantId = newAporteParticipantSelect.value;
        if (participantId) {
            try {
                const data = await fetchData('getParticipantDetailsForAporte', { participantId: participantId });
                if (data.status === 'success' && data.participant) {
                    const p = data.participant;
                    newAporteParticipantCode.textContent = p.Código;
                    newAporteParticipantCitizenship.textContent = p.Ciudadanía;
                    newAporteLastPaidMonth.textContent = p.UltimoMesPago || 'N/A';
                    newAporteMesesPendientes.textContent = p.MesesEnDeuda;
                    newAporteTotalPendiente.textContent = `$${parseFloat(p.TotalAPagar).toLocaleString('es-CO')}`;
                    newAporteTutora.textContent = p.Tutora;

                    const mesesPendientesArray = p.MesesDisponiblesParaPago || [];
                    newAporteMesesInput.innerHTML = '';
                    mesesPendientesArray.forEach(mes => {
                        const option = document.createElement('option');
                        option.value = mes;
                        option.textContent = mes;
                        newAporteMesesInput.appendChild(option);
                    });

                    newAporteMontoInput.value = parseFloat(data.currentAporteValue || 0).toFixed(2);
                    updateMontoTotal();

                } else {
                    newAporteMessage.textContent = 'Error: Participante no encontrado.';
                    clearNewAporteForm();
                }
            } catch (error) {
                console.error('Error al cargar detalles del participante para aporte:', error);
                newAporteMessage.textContent = 'Error al obtener detalles del participante.';
                clearNewAporteForm();
            }
        } else {
            clearNewAporteForm();
        }
    });

    if (newAporteMesesInput) newAporteMesesInput.addEventListener('change', updateMontoTotal);
    if (saveAporteButton) saveAporteButton.addEventListener('click', async () => {
        const participantId = newAporteParticipantSelect.value;
        const monto = parseFloat(newAporteMontoInput.value);
        const mesesSeleccionados = Array.from(newAporteMesesInput.selectedOptions).map(option => option.value);
        const tutoraName = newAporteTutora.textContent;

        if (!participantId || isNaN(monto) || monto <= 0 || mesesSeleccionados.length === 0 || !tutoraName) {
            newAporteMessage.textContent = 'Por favor, complete todos los campos requeridos (participante, monto, meses, tutora).';
            newAporteMessage.classList.add('error');
            return;
        }

        newAporteMessage.textContent = 'Registrando aporte...';
        newAporteMessage.classList.remove('error');
        newAporteMessage.classList.remove('success');

        try {
            const data = await fetchData('registerAporte', null, 'POST', {
                participantId,
                monto,
                meses: mesesSeleccionados,
                tutoraName
            });

            if (data.status === 'success') {
                newAporteMessage.textContent = 'Aporte registrado con éxito!';
                newAporteMessage.classList.add('success');
                clearNewAporteForm();
                loadAportesParticipantesData();
                loadDashboardData();
                setTimeout(() => newAporteMessage.textContent = '', 3000);
            } else {
                newAporteMessage.textContent = data.message || 'Error al registrar el aporte.';
                newAporteMessage.classList.add('error');
            }
        } catch (error) {
            console.error('Error al registrar aporte:', error);
            newAporteMessage.textContent = 'Error al conectar con el servidor para registrar el aporte.';
            newAporteMessage.classList.add('error');
        }
    });

    if (addParticipanteButton) addParticipanteButton.addEventListener('click', () => {
        currentEditingParticipantId = null;
        clearParticipanteForm();
        participanteForm.classList.remove('hidden');
        saveParticipanteButton.textContent = 'Guardar Participante';
        cancelEditButton.classList.add('hidden');
    });

    if (cancelEditButton) cancelEditButton.addEventListener('click', () => {
        participanteForm.classList.add('hidden');
        clearParticipanteForm();
        crudMessage.textContent = '';
    });

    if (saveParticipanteButton) saveParticipanteButton.addEventListener('click', async () => {
        const id = newParticipanteIdInput.value.trim();
        const codigo = newParticipanteCodeInput.value.trim();
        const nombre = newParticipanteNameInput.value.trim();
        const ciudadania = newParticipanteCitizenshipInput.value.trim();
        const tutora = newParticipanteTutoraSelect.value;

        if (!codigo || !nombre || !ciudadania || !tutora) {
            crudMessage.textContent = 'Todos los campos son obligatorios.';
            crudMessage.classList.add('error');
            return;
        }

        crudMessage.textContent = 'Guardando participante...';
        crudMessage.classList.remove('error');
        crudMessage.classList.remove('success');

        let action = currentEditingParticipantId ? 'updateParticipant' : 'addParticipant';
        let body = {
            id: currentEditingParticipantId,
            codigo,
            nombre,
            ciudadania,
            tutora
        };

        try {
            const data = await fetchData(action, null, 'POST', body);

            if (data.status === 'success') {
                crudMessage.textContent = data.message || 'Participante guardado con éxito!';
                crudMessage.classList.add('success');
                participanteForm.classList.add('hidden');
                clearParticipanteForm();
                loadParticipantesCrudData();
                loadAportesParticipantesData();
                setTimeout(() => crudMessage.textContent = '', 3000);
            } else {
                crudMessage.textContent = data.message || 'Error al guardar el participante.';
                crudMessage.classList.add('error');
            }
        } catch (error) {
            console.error('Error al guardar participante:', error);
            crudMessage.textContent = 'Error al conectar con el servidor para guardar el participante.';
            crudMessage.classList.add('error');
        }
    });

    // Navegación (Asegúrate de que los botones de navegación también estén adjuntos después de cargarse)
    if (dashboardNav) dashboardNav.addEventListener('click', () => {
        showModule(dashboardModule);
        dashboardNav.classList.add('active');
        aportesNav.classList.remove('active');
        participantesCrudNav.classList.remove('active');
        loadDashboardData();
    });

    if (aportesNav) aportesNav.addEventListener('click', () => {
        showModule(aportesParticipantesModule);
        aportesNav.classList.add('active');
        dashboardNav.classList.remove('active');
        participantesCrudNav.classList.remove('active');
        loadAportesParticipantesData();
    });

    if (participantesCrudNav) participantesCrudNav.addEventListener('click', () => {
        showModule(participantesCrudModule);
        participantesCrudNav.classList.add('active');
        dashboardNav.classList.remove('active');
        aportesNav.classList.remove('active');
        loadParticipantesCrudData();
    });


    // Lógica de carga inicial de la aplicación (dentro de DOMContentLoaded)
    const urlParams = new URLSearchParams(window.location.search);
    const participantId = urlParams.get('pId');

    if (participantId) {
        loginModule.classList.add('hidden');
        mainApp.classList.remove('hidden');
        document.getElementById('public-view-container').classList.remove('hidden');
        loadPublicParticipantData(participantId);
    } else {
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        if (isLoggedIn) {
            currentUserRole = localStorage.getItem('currentUserRole');
            currentTutoraName = localStorage.getItem('currentTutoraName');
            loginModule.classList.add('hidden');
            mainApp.classList.remove('hidden');
            updateNavigationVisibility();
            getAporteValueFrontend();
            if (currentUserRole === 'admin' || currentUserRole === 'directora' || currentUserRole === 'asegurador') {
                showModule(dashboardModule);
                dashboardNav.classList.add('active');
                loadDashboardData();
            } else {
                showModule(aportesParticipantesModule);
                aportesNav.classList.add('active');
                loadAportesParticipantesData();
            }
        } else {
            loginModule.classList.remove('hidden');
            mainApp.classList.add('hidden');
        }
    }
});
