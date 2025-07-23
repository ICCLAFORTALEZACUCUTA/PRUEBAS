const APPS_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwpDK1BbSBCnx-3q8qaSdeS4DG0IEadNEty1sUARIbR1w1ZWWvfGbpaMq1tghHaB9Kk/exec'; // ¡REEMPLAZA ESTO CON TU URL DEPLOYADA SI CAMBIA!

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
// Variable para almacenar el valor del aporte actual, obtenido del backend
let currentAporteValue = 0;

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
    // Siempre se envían username y password para la autenticación
    url.searchParams.append('username', usernameInput.value);
    url.searchParams.append('password', passwordInput.value);

    // Añadir otros parámetros específicos de la acción
    for (const key in params) {
        url.searchParams.append(key, params[key]);
    }

    const options = {
        method: method,
    };

    // SOLO añadir cabeceras y cuerpo si es una petición POST y tiene un 'body'
    if (method === 'POST' && body) {
        options.headers = {
            'Content-Type': 'application/json'
        };
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url.toString(), options);
        if (!response.ok) {
            // Log the full response status and text for debugging
            const errorText = await response.text();
            console.error(`HTTP error! Status: ${response.status}, Text: ${errorText}`);
            throw new Error(`HTTP error! status: ${response.status} - ${errorText.substring(0, 100)}...`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching data:', error);
        return { status: 'error', message: `Error al conectar con el servidor o error de red: ${error.message}` };
    }
}

// --- Autenticación ---
loginButton.addEventListener('click', async () => {
    loginMessage.textContent = 'Iniciando sesión...';
    loginMessage.className = 'message info';
    const response = await fetchData('login', {}, 'GET');

    if (response.status === 'success') {
        currentUserRole = response.role;
        currentTutoraName = response.tutoraName;
        loginModule.classList.add('hidden');
        mainApp.classList.remove('hidden');
        loginMessage.textContent = '';
        renderAppBasedOnRole();
        // Cargar el valor del aporte apenas se inicie la app
        currentAporteValue = await getAporteValueFrontend();
    } else {
        loginMessage.textContent = response.message;
        loginMessage.className = 'message error'; // Aplica la clase de error
        console.error('Login failed:', response.message); // Add console log for login errors
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
        // Ocultar elementos que no debe ver la tutora en el módulo de aportes (ya implementado)
        document.getElementById('filter-tutora').closest('.form-group').classList.add('hidden');
        // document.getElementById('tutora-payment-view').classList.remove('hidden'); // Esto se maneja en aportesNav.click()
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
        // Por ahora mantenemos la separación en el mismo módulo. Más adelante crearemos secciones separadas.
    } else if (currentUserRole === 'tutora') {
        loadTutoraParticipantes(); // Carga solo sus participantes
        document.getElementById('payment-section').classList.add('hidden'); // Ocultar sección de registro de pago para tutoras
        document.getElementById('tutora-payment-view').classList.remove('hidden'); // Mostrar vista específica de tutora (Tabla de tutoras)
        // Ocultar la sección de la tabla de todos los aportes para tutoras
        document.getElementById('aportes-list-section').classList.add('hidden'); // Asumiendo que esta es la sección de "Todos los aportes"
        document.getElementById('participante-selection-section').classList.add('hidden'); // Ocultar la selección de participante para el registro de aportes
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
            type: 'bar', // Manteniendo 'bar' por ahora. Mejoraremos las gráficas en un paso posterior.
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
                },
                // Añadir algunas opciones básicas para mejorar la visualización si está "muy lejos"
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `$${context.parsed.y.toFixed(2)}`;
                            }
                        }
                    }
                },
                layout: {
                    padding: {
                        left: 10,
                        right: 10,
                        top: 10,
                        bottom: 10
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
                li.textContent = `ID: ${aporte.id_aporte.substring(0, 8)}... - Monto: $${parseFloat(aporte.monto).toFixed(2)} - Fecha: ${new Date(aporte.fecha).toLocaleDateString()}`;
                ultimosAportesList.appendChild(li);
            });
        } else {
            ultimosAportesList.innerHTML = '<li>No hay últimos aportes para mostrar.</li>';
        }

    } else {
        alert('Error al cargar las estadísticas del dashboard: ' + response.message);
        console.error('Error loading dashboard stats:', response); // Detailed error
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
        let filteredAportes = response.data.filter(aporte => { // 'response.data' porque getAportes devuelve { status: 'success', data: [...] }
            const aporteDate = new Date(aporte.Fecha_Aporte);
            // Asegúrate de que monthFilter sea una fecha válida para la comparación
            const monthMatches = monthFilter ? (new Date(aporteDate.getFullYear(), aporteDate.getMonth()).getTime() === new Date(new Date(monthFilter).getFullYear(), new Date(monthFilter).getMonth()).getTime()) : true;
            const tutoraMatches = tutoraFilter ? (aporte.Tutora && String(aporte.Tutora).toLowerCase() === tutoraFilter.toLowerCase()) : true; // Asegurarse de que Tutora sea string
            const searchMatches = searchTerm ? (
                (aporte.Nombre_Participante && String(aporte.Nombre_Participante).toLowerCase().includes(searchTerm.toLowerCase())) ||
                (aporte.ID_Participante && String(aporte.ID_Participante).toLowerCase().includes(searchTerm.toLowerCase())) ||
                (aporte.Codigo_Participante && String(aporte.Codigo_Participante).toLowerCase().includes(searchTerm.toLowerCase())) // Añadir búsqueda por código
            ) : true;
            return monthMatches && tutoraMatches && searchMatches;
        });

        if (filteredAportes.length > 0) {
            // Ordenar los aportes de más reciente a más antiguo
            filteredAportes.sort((a, b) => new Date(b.Fecha_Aporte) - new Date(a.Fecha_Aporte));

            filteredAportes.forEach(aporte => {
                const row = `
                    <tr>
                        <td>${new Date(aporte.Fecha_Aporte).toLocaleDateString()}</td>
                        <td>${aporte.Nombre_Participante}</td>
                        <td class="admin-only">${aporte.Tutora}</td>
                        <td>$${parseFloat(aporte.Monto_Total_Pagado || 0).toFixed(2)}</td>
                        <td>${aporte.Meses_Pagados || 'N/A'}</td>
                        <td>$${parseFloat(aporte.Monto_Abono || 0).toFixed(2)}</td>
                        <td>
                            <button class="view-aporte-details" data-id="${aporte.ID_Aporte}">Ver</button>
                        </td>
                    </tr>
                `;
                aportesTableBody.insertAdjacentHTML('beforeend', row);
            });
            // Ocultar columna de tutora si no es admin, aunque esto debería ser manejado por CSS y showAdminElements
            if (currentUserRole !== 'admin') {
                 // Esto no es necesario aquí si showAdminElements/hideAdminElements se usan correctamente para la tabla
            }
        } else {
            noAportesMessage.classList.remove('hidden');
        }

    } else {
        alert('Error al cargar la lista de aportes: ' + response.message);
        console.error('Error loading aportes list:', response); // Detailed error
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

    const response = await fetchData('getParticipantes'); // Admin ve todos los participantes
    if (response.status === 'success') {
        response.data.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = `${p.nombre} (${p.codigo})`;
            selectParticipante.appendChild(option);
        });
    } else {
        alert('Error al cargar participantes para selección: ' + response.message);
        console.error('Error loading participants for select (admin):', response); // Detailed error
    }
}

document.getElementById('select-participante').addEventListener('change', async (event) => {
    const participantId = event.target.value;
    const participanteInfoDiv = document.getElementById('participante-info');
    const paymentSection = document.getElementById('payment-section');

    if (participantId) {
        const response = await fetchData('getParticipantDetails', { id: participantId });
        console.log('Respuesta de getParticipantDetails:', response); // *** LOGGING PARA DEPURACIÓN DEL ERROR ***
        if (response.status === 'success' && response.data) { // Se espera { status: 'success', data: {...} }
            const participantData = response.data; // Acceder directamente a los datos
            document.getElementById('info-codigo').textContent = participantData.codigo || 'N/A';
            document.getElementById('info-nombre').textContent = participantData.nombre;
            document.getElementById('info-ciudadania').textContent = participantData.ciudadania;
            document.getElementById('info-ultimo-mes-pagado').textContent = participantData.ultimoMesPago ? new Date(participantData.ultimoMesPago).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : 'Nunca';
            document.getElementById('info-meses-pendientes').textContent = participantData.mesesPendientes;
            document.getElementById('info-total-pendiente').textContent = `$${participantData.totalPendiente.toFixed(2)}`;
            document.getElementById('info-tutora').textContent = participantData.tutora;
            participanteInfoDiv.classList.remove('hidden');
            paymentSection.classList.remove('hidden');
            generateMesesAPagarCheckboxes(participantData.mesesDisponiblesParaPagar);
            calculateTotalAmountDue(); // Calcular el monto inicial
        } else {
            alert('Error al obtener detalles del participante: ' + response.message);
            console.error('getParticipantDetails failed:', response); // Muestra el objeto de error completo en consola
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
    if (!meses || meses.length === 0) {
        container.innerHTML = '<p>Este participante no tiene meses pendientes para pagar.</p>';
        return;
    }
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
    const abonoInput = parseFloat(document.getElementById('monto-abono').value) || 0;

    // Usamos el valor del aporte obtenido al inicio de la app
    const montoPorMes = currentAporteValue;

    const totalMesesCalculado = selectedMonths.length * montoPorMes;
    const totalACobrar = totalMesesCalculado - abonoInput; // Resta el abono del monto a cobrar
    
    document.getElementById('monto-total-a-cobrar').value = `$${Math.max(0, totalACobrar).toFixed(2)}`;
    // Opcional: si quieres que el "Monto Recibido" se autocomplete con el total a cobrar, podrías hacerlo aquí
    // document.getElementById('monto-recibido').value = Math.max(0, totalACobrar).toFixed(2);
}

// Helper para obtener el valor del aporte DINAMICO desde Apps Script
async function getAporteValueFrontend() {
    const response = await fetchData('getAporteConfig'); // Nueva llamada al Apps Script
    if (response.status === 'success' && response.hasOwnProperty('aporteValue')) {
        console.log('Valor del aporte obtenido del servidor:', response.aporteValue);
        return parseFloat(response.aporteValue);
    } else {
        console.error('Error al obtener el valor del aporte desde el servidor. Usando valor por defecto:', response);
        // Fallback a la lógica anterior si el servidor falla
        const today = new Date();
        const todayMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const julio2024Start = new Date(2024, 6, 1); // Mes 6 es Julio

        if (todayMonthStart >= julio2024Start) {
            return 3000;
        } else { // Asumiendo que el aporte de 2000 es antes de Julio 2024
            return 2000;
        }
    }
}


document.getElementById('registrar-aporte-button').addEventListener('click', async () => {
    const participantId = document.getElementById('select-participante').value;
    const mesesAPagar = Array.from(document.querySelectorAll('#meses-a-pagar-checkboxes input:checked'))
                               .map(cb => cb.value);
    const montoRecibido = parseFloat(document.getElementById('monto-recibido').value) || 0;
    const abonoInput = parseFloat(document.getElementById('monto-abono').value) || 0;
    const registroMessage = document.getElementById('registro-message');

    registroMessage.textContent = ''; // Limpiar mensajes anteriores
    registroMessage.className = 'message';

    if (!participantId || mesesAPagar.length === 0 || montoRecibido <= 0) {
        registroMessage.textContent = 'Por favor, seleccione un participante, al menos un mes y el monto recibido.';
        registroMessage.className = 'message error';
        return;
    }

    const montoPorMes = currentAporteValue; // Usar el valor dinámico
    const valorMesesTeorico = mesesAPagar.length * montoPorMes;
    
    let montoTotalPagado = montoRecibido; // El monto real entregado por el padre
    let montoAbonoTransaccion = 0;   // El abono generado en esta transacción
    let montoCubiertoMeses = 0;      // El monto que efectivamente cubre meses en esta transacción

    // Determinar cuánto del 'montoRecibido' cubre meses y cuánto es abono
    if (montoRecibido >= valorMesesTeorico) {
        montoCubiertoMeses = valorMesesTeorico;
        montoAbonoTransaccion = montoRecibido - valorMesesTeorico;
    } else {
        // Si el monto recibido es menor a lo que cubren los meses
        // Primero, se considera si el usuario quiso dejar un abono explícito (abonoInput)
        // Y el resto cubre meses.
        if (montoRecibido > abonoInput) {
            montoCubiertoMeses = montoRecibido - abonoInput;
            montoAbonoTransaccion = abonoInput;
        } else { // Si el monto recibido es <= al abonoInput, todo es abono
            montoCubiertoMeses = 0;
            montoAbonoTransaccion = montoRecibido;
        }
        registroMessage.textContent = 'Advertencia: El monto recibido es menor al total de los meses seleccionados. Se registrará un pago parcial.';
        registroMessage.className = 'message info';
    }


    registroMessage.textContent = 'Registrando aporte...';
    registroMessage.className = 'message info';

    const data = {
        id_participante: participantId,
        mesesAPagar: mesesAPagar,
        montoTotalRecibido: montoTotalPagado,     // Lo que el padre entregó
        montoCubiertoMeses: montoCubiertoMeses,   // Parte que cubre meses
        montoAbonoTransaccion: montoAbonoTransaccion // Parte que es abono en esta transacción
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
        // Limpiar checkboxes
        document.getElementById('meses-a-pagar-checkboxes').innerHTML = '';
        
        loadAportesList();
        loadParticipantesForSelect(); // Recargar para actualizar "ultimo mes pagado"
    } else {
        registroMessage.textContent = 'Error al registrar aporte: ' + response.message;
        registroMessage.className = 'message error';
        console.error('Error al registrar aporte:', response); // Detailed error
    }
});


// --- Aportes / Participantes Module Logic (Tutora View) ---
async function loadTutoraParticipantes() {
    const tutoraParticipantesTableBody = document.getElementById('tutora-participantes-table-body');
    tutoraParticipantesTableBody.innerHTML = '';

    // El Apps Script (Code.gs) para 'getParticipantes' DEBE filtrar por 'tutoraName'
    // cuando se detecte que la petición viene de una tutora (ej: e.parameter.tutoraName)
    const response = await fetchData('getParticipantes', { tutoraName: currentTutoraName });
    if (response.status === 'success') {
        if (response.data.length > 0) { // Acceder a 'response.data'
            for (const p of response.data) { // Usar for...of para await dentro
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${p.codigo || 'N/A'}</td>
                    <td>${p.nombre}</td>
                    <td>${p.ciudadania}</td>
                    <td>${p.ultimoMesPago ? new Date(p.ultimoMesPago).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) : 'Nunca'}</td>
                    <td>${p.mesesEnDeuda}</td>
                    <td>$${p.totalAPagarEstarAlDia ? p.totalAPagarEstarAlDia.toFixed(2) : '0.00'}</td>
                    <td>
                        <button class="view-payment-status" data-id="${p.id}" data-name="${p.nombre}">Ver Estado</button>
                    </td>
                    <td>
                        <button class="share-participant-url" data-id="${p.id}">Compartir URL</button>
                    </td>
                `;
                tutoraParticipantesTableBody.appendChild(row);

                // *** INTEGRACIÓN DEL CUADRO DE ESTADO DE PAGOS DIRECTAMENTE BAJO EL PARTICIPANTE ***
                // No lo mostraremos en una tabla, sino en un div expandible o similar si es necesario.
                // Por ahora, el modal sigue siendo la forma en que se muestra al hacer clic en "Ver Estado".
                // Para mostrarlo directamente, se requeriría un cambio significativo en el HTML base y CSS.
                // Lo mantendremos en el modal por ahora y lo revisaremos en una fase posterior si es crucial que esté en línea.
            }

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
        console.error('Error loading tutora participants:', response); // Detailed error
    }
}

async function showPaymentStatusModal(participantId, participantName) {
    const modal = document.getElementById('payment-status-modal');
    const modalParticipantName = document.getElementById('modal-participant-name');
    const paymentStatusGridContainer = document.getElementById('payment-status-grid-container');

    modalParticipantName.textContent = participantName;
    paymentStatusGridContainer.innerHTML = 'Cargando estado de pagos...';
    modal.classList.remove('hidden');

    // La función 'getPublicParticipantData' ya existe y es adecuada para obtener el estado de pagos
    const response = await fetchData('getPublicParticipantData', { id: participantId });
    if (response.status === 'success' && response.data) {
        const participantInfo = response.data.participantInfo;
        const paymentStatus = response.data.paymentStatus;

        document.getElementById('modal-participant-name').textContent = participantInfo.nombre; // Actualizar el nombre en el modal
        
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

        // Generar años desde 2022 hasta el año actual + 2 (para ver un poco a futuro)
        const currentYear = new Date().getFullYear();
        const maxYear = Math.max(currentYear + 2, 2027); // Asegurar que llega al menos a 2027

        for (let year = 2022; year <= maxYear; year++) {
            gridHtml += `<div class="payment-grid-item font-bold">${year}</div>`;
            const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
            months.forEach((month, index) => {
                // Formatear mes para buscar en paymentStatus: Ej. "Julio 2024"
                const fullMonthName = new Date(year, index).toLocaleDateString('es-ES', { month: 'long' });
                const status = paymentStatus[year] && paymentStatus[year][fullMonthName] ? paymentStatus[year][fullMonthName] : '✗';
                const statusClass = status === '✓' ? 'paid' : 'unpaid';
                gridHtml += `<div class="payment-grid-item ${statusClass}">${status}</div>`;
            });
        }
        gridHtml += `</div>`;
        paymentStatusGridContainer.innerHTML = gridHtml;

    } else {
        paymentStatusGridContainer.innerHTML = `<p class="message error">Error al cargar el estado de pagos: ${response.message}</p>`;
        console.error('Error loading payment status modal:', response);
    }
}

async function generateAndShareParticipantUrl(participantId) {
    const response = await fetchData('generateParticipantUrl', { id: participantId });
    if (response.status === 'success' && response.url) {
        prompt('Copia la siguiente URL para compartir con el participante:', response.url);
    } else {
        alert('Error al generar la URL: ' + response.message);
        console.error('Error generating participant URL:', response);
    }
}


// --- Gestionar Participantes Module Logic (Admin Only) ---
let currentEditParticipanteId = null;

async function loadParticipantesCrudTable() {
    const participantesCrudTableBody = document.getElementById('participantes-crud-table-body');
    participantesCrudTableBody.innerHTML = '';

    const response = await fetchData('getParticipantes');
    if (response.status === 'success') {
        if (response.data.length > 0) { // Acceder a 'response.data'
            response.data.forEach(p => {
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
        alert('Error al cargar la lista de participantes (CRUD): ' + response.message);
        console.error('Error loading participants for CRUD:', response);
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
        console.error('Error saving participant:', response);
    }
});

function editParticipante(id) {
    const participantesTableBody = document.getElementById('participantes-crud-table-body');
    const rows = Array.from(participantesTableBody.children);
    const rowToEdit = Array.from(rows).find(row => {
        const editButton = row.querySelector('.edit-participante');
        return editButton && editButton.dataset.id === id;
    });

    if (rowToEdit) {
        document.getElementById('participante-id').value = id;
        document.getElementById('new-codigo').value = rowToEdit.cells[0].textContent !== 'N/A' ? rowToEdit.cells[0].textContent : '';
        document.getElementById('new-nombre').value = rowToEdit.cells[1].textContent;
        document.getElementById('new-ciudadania').value = rowToEdit.cells[2].textContent;
        // Al editar, la tutora debe coincidir con el valor de la opción del select
        document.getElementById('new-tutora').value = rowToEdit.cells[3].textContent; // No usar toLowerCase aquí
        
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
            console.error('Error deleting participant:', response);
        }
    }
}

// Event listener para manejar el estado público del participante si se accede directamente por URL
window.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    const participantId = urlParams.get('id');

    // Inicializar el valor del aporte si se carga la página principal
    if (!action && !participantId) {
         currentAporteValue = await getAporteValueFrontend();
    }


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
                <p><strong>Total a Pagar (al día):</strong> $${participantInfo.totalAPagarEstarAlDia ? participantInfo.totalAPagarEstarAlDia.toFixed(2) : '0.00'}</p>
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

            const currentYear = new Date().getFullYear();
            const maxYear = Math.max(currentYear + 2, 2027); // Tu lógica de años de aporte

            for (let year = 2022; year <= maxYear; year++) {
                gridHtml += `<div class="payment-grid-item font-bold">${year}</div>`;
                const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
                months.forEach((month, index) => {
                    const fullMonthName = new Date(year, index).toLocaleDateString('es-ES', { month: 'long' });
                    const status = paymentStatus[year] && paymentStatus[year][fullMonthName] ? paymentStatus[year][fullMonthName] : '✗';
                    const statusClass = status === '✓' ? 'paid' : 'unpaid';
                    gridHtml += `<div class="payment-grid-item ${statusClass}">${status}</div>`;
                });
            }
            gridHtml += `</div>`;
            document.getElementById('public-payment-status-grid-container').innerHTML = gridHtml;

        } else {
            document.getElementById('public-participant-details').innerHTML = `<p class="message error">Error al cargar la información del participante o participante no encontrado.</p>`;
            document.getElementById('public-payment-status-grid-container').innerHTML = '';
            console.error('Error loading public participant data:', response);
        }
    } else {
        // Si no es una URL pública de participante, mostrar el módulo de login
        loginModule.classList.remove('hidden');
    }
});
