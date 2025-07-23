const APPS_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwpDK1BbSBCnx-3q8qaSdeS4DG0IEadNEty1sUARIbR1w1ZWWvfGbpaMq1tghHaB9Kk/exec'; // ¡URL CONFIGURADA!

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

let allAportes = []; // Variable para guardar todos los aportes cargados
let allParticipants = []; // Variable global para todos los participantes

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
const filterMonthSelect = document.getElementById('filter-month');
const filterTutoraSelect = document.getElementById('filter-tutora');
const searchAportesInput = document.getElementById('search-aportes');

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

filterMonthSelect.addEventListener('change', applyAportesFilters);
filterTutoraSelect.addEventListener('change', applyAportesFilters);
searchAportesInput.addEventListener('input', applyAportesFilters);

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
const newAporteParticipantSelect = document.getElementById('new-aporte-participant-select');
const newAporteParticipantCode = document.getElementById('new-aporte-participant-code');
const newAporteParticipantCitizenship = document.getElementById('new-aporte-participant-citizenship');
const newAporteLastPaidMonth = document.getElementById('new-aporte-last-paid-month');
const newAporteMesesPendientes = document.getElementById('new-aporte-meses-pendientes');
const newAporteTotalPendiente = document.getElementById('new-aporte-total-pendiente');
const newAporteTutora = document.getElementById('new-aporte-tutora');
const newAporteMontoInput = document.getElementById('new-aporte-monto');
const newAporteMesesInput = document.getElementById('new-aporte-meses');
const saveAporteButton = document.getElementById('save-aporte-button');
const newAporteMessage = document.getElementById('new-aporte-message');


function populateParticipantSelect(participants) {
    newAporteParticipantSelect.innerHTML = '<option value="">-- Seleccione un Participante --</option>';
    participants.forEach(p => {
        const option = document.createElement('option');
        option.value = p.ID; // Asumiendo que el ID es un identificador único
        option.textContent = `${p.Nombre} (${p.Código})`;
        newAporteParticipantSelect.appendChild(option);
    });
}

newAporteParticipantSelect.addEventListener('change', async () => {
    const participantId = newAporteParticipantSelect.value;
    if (participantId) {
        try {
            const data = await fetchData('getParticipantDetailsForAporte', { participantId: participantId });
            if (data.status === 'success' && data.participant) {
                const p = data.participant;
                newAporteParticipantCode.textContent = p.Código;
                newAporteParticipantCitizenship.textContent = p.Ciudadanía;
                newAporteLastPaidMonth.textContent = p.UltimoMesPago || 'N/A';
                newAporteMesesPendientes.textContent = p.MesesEnDeuda; // Ya calculado en Apps Script
                newAporteTotalPendiente.textContent = `$${parseFloat(p.TotalAPagar).toLocaleString('es-CO')}`; // Ya calculado en Apps Script
                newAporteTutora.textContent = p.Tutora;

                // Generar opciones para meses a pagar
                const mesesPendientesArray = p.MesesDisponiblesParaPago || [];
                newAporteMesesInput.innerHTML = ''; // Limpiar opciones anteriores
                mesesPendientesArray.forEach(mes => {
                    const option = document.createElement('option');
                    option.value = mes;
                    option.textContent = mes;
                    newAporteMesesInput.appendChild(option);
                });

                // Establecer el monto sugerido basado en el mes actual y la configuración
                newAporteMontoInput.value = parseFloat(data.currentAporteValue || 0).toFixed(2);
                updateMontoTotal(); // Actualizar el monto total si hay meses seleccionados por defecto

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

// Calcula el monto total a pagar según los meses seleccionados
newAporteMesesInput.addEventListener('change', updateMontoTotal);

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


saveAporteButton.addEventListener('click', async () => {
    const participantId = newAporteParticipantSelect.value;
    const monto = parseFloat(newAporteMontoInput.value);
    const mesesSeleccionados = Array.from(newAporteMesesInput.selectedOptions).map(option => option.value);
    const tutoraName = newAporteTutora.textContent; // Obtener el nombre de la tutora del campo de detalle

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
            meses: mesesSeleccionados, // Enviar como array
            tutoraName // Añadir tutoraName aquí
        });

        if (data.status === 'success') {
            newAporteMessage.textContent = 'Aporte registrado con éxito!';
            newAporteMessage.classList.add('success');
            clearNewAporteForm();
            loadAportesParticipantesData(); // Recargar datos para actualizar la tabla
            loadDashboardData(); // Actualizar dashboard también
            setTimeout(() => newAporteMessage.textContent = '', 3000); // Limpiar mensaje después de 3s
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
const crudParticipanteList = document.getElementById('crud-participante-list');
const addParticipanteButton = document.getElementById('add-participante-button');
const participanteForm = document.getElementById('participante-form');
const newParticipanteIdInput = document.getElementById('new-participante-id');
const newParticipanteCodeInput = document.getElementById('new-participante-code');
const newParticipanteNameInput = document.getElementById('new-participante-name');
const newParticipanteCitizenshipInput = document.getElementById('new-ciudadania');
const newParticipanteTutoraSelect = document.getElementById('new-tutora');
const saveParticipanteButton = document.getElementById('save-participante-button');
const cancelEditButton = document.getElementById('cancel-edit-button');
const crudMessage = document.getElementById('crud-message');

let currentEditingParticipantId = null; // Para saber si estamos editando o creando

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

addParticipanteButton.addEventListener('click', () => {
    currentEditingParticipantId = null;
    clearParticipanteForm();
    participanteForm.classList.remove('hidden');
    saveParticipanteButton.textContent = 'Guardar Participante';
    cancelEditButton.classList.add('hidden'); // Ocultar si es nuevo
});

cancelEditButton.addEventListener('click', () => {
    participanteForm.classList.add('hidden');
    clearParticipanteForm();
    crudMessage.textContent = '';
});


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

saveParticipanteButton.addEventListener('click', async () => {
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
        id: currentEditingParticipantId, // Solo relevante para update
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
            loadParticipantesCrudData(); // Recargar la tabla
            loadAportesParticipantesData(); // Recargar select de participantes en aportes
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


// --- Lógica de Inicialización ---
loginButton.addEventListener('click', handleLoginFrontend);
logoutButton.addEventListener('click', handleLogoutFrontend);

// Navegación
dashboardNav.addEventListener('click', () => {
    showModule(dashboardModule);
    dashboardNav.classList.add('active');
    aportesNav.classList.remove('active');
    participantesCrudNav.classList.remove('active');
    loadDashboardData(); // Cargar datos cuando se muestra el dashboard
});

aportesNav.addEventListener('click', () => {
    showModule(aportesParticipantesModule);
    aportesNav.classList.add('active');
    dashboardNav.classList.remove('active');
    participantesCrudNav.classList.remove('active');
    loadAportesParticipantesData(); // Cargar datos cuando se muestra el módulo
});

participantesCrudNav.addEventListener('click', () => {
    showModule(participantesCrudModule);
    participantesCrudNav.classList.add('active');
    dashboardNav.classList.remove('active');
    aportesNav.classList.remove('active');
    loadParticipantesCrudData(); // Cargar datos cuando se muestra el módulo
});


// Manejo de URL pública para participantes
async function loadPublicParticipantData(participantId) {
    try {
        const data = await fetchData('getPublicParticipantData', { id: participantId });
        if (data.status === 'success' && data.participant) {
            const p = data.participant;
            document.getElementById('public-participant-name').textContent = p.Nombre;
            document.getElementById('public-participant-code').textContent = p.Código;
            document.getElementById('public-participant-citizenship').textContent = p.Ciudadanía;
            document.getElementById('public-last-paid-month').textContent = p.UltimoMesPago || 'N/A';
            document.getElementById('public-months-in-debt').textContent = p.MesesEnDeuda;
            document.getElementById('public-total-to-pay').textContent = `$${parseFloat(p.TotalAPagar).toLocaleString('es-CO')}`;
            document.getElementById('public-tutora-name').textContent = p.Tutora;

            // Renderizar la tabla de estado de pagos
            const paymentStatus = data.paymentStatus || {}; // Asegurarse de tener un objeto
            let gridHtml = `
                <div class="payment-grid">
                    <div class="payment-grid-header empty-cell"></div>
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

            const currentYear = new Date().getFullYear();
            const maxYear = 2027; // Tu lógica de años de aporte

            for (let year = 2022; year <= maxYear; year++) {
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
    } catch (error) {
        console.error('Error al cargar datos del participante público:', error);
        document.getElementById('public-participant-details').innerHTML = `<p class="message error">Error al conectar con el servidor para cargar los datos del participante.</p>`;
        document.getElementById('public-payment-status-grid-container').innerHTML = '';
    }
}


// Lógica de carga inicial de la aplicación
document.addEventListener('DOMContentLoaded', () => {
    // Manejo de URLs públicas de participantes
    const urlParams = new URLSearchParams(window.location.search);
    const participantId = urlParams.get('pId');

    if (participantId) {
        // Si hay un pId en la URL, mostrar la vista pública
        loginModule.classList.add('hidden');
        mainApp.classList.remove('hidden'); // Asegúrate de que el contenedor principal esté visible
        document.getElementById('public-view-container').classList.remove('hidden'); // Muestra el contenedor específico de la vista pública
        loadPublicParticipantData(participantId);
    } else {
        // Si no es una URL pública de participante, proceder con el flujo de login normal
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        if (isLoggedIn) {
            currentUserRole = localStorage.getItem('currentUserRole');
            currentTutoraName = localStorage.getItem('currentTutoraName');
            loginModule.classList.add('hidden');
            mainApp.classList.remove('hidden');
            updateNavigationVisibility();
            getAporteValueFrontend(); // Obtener valor del aporte al cargar la app si ya está logueado
            // Mostrar módulo por defecto al recargar
            if (currentUserRole === 'admin' || currentUserRole === 'directora' || currentUserRole === 'asegurador') {
                showModule(dashboardModule);
                dashboardNav.classList.add('active');
                loadDashboardData(); // Cargar dashboard al inicio si es admin
            } else {
                showModule(aportesParticipantesModule);
                aportesNav.classList.add('active');
                loadAportesParticipantesData(); // Cargar aportes/participantes si es tutora
            }
        } else {
            loginModule.classList.remove('hidden');
            mainApp.classList.add('hidden');
        }
    }
});
