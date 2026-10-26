const API_URL = 'https://sheetdb.io/api/v1/g399tc5631z3w';
const VALOR_TARJETA = 66000; // $66.000 por persona

let datosInvitados = [];

// Métricas globales calculadas
let metricasActuales = {
    totalConfirmados: 0,
    totalPersonas: 0,
    totalRecaudado: 0,
    personasPagadas: 0,
    tradicional: 0,
    celiaco: 0,
    infantil: 0
};

// Cargar los invitados desde SheetDB
async function cargarInvitados() {
    const cuerpo = document.getElementById('listaCuerpo');
    cuerpo.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 30px;">Actualizando datos con Google Sheets...</td></tr>';

    try {
        const res = await fetch(API_URL);
        datosInvitados = await res.json();
        
        // Invertir para mostrar primero las confirmaciones más recientes
        datosInvitados.reverse();

        calcularMetricas(datosInvitados);
        renderizarTabla(datosInvitados);
    } catch (error) {
        console.error("Error al cargar datos:", error);
        cuerpo.innerHTML = '<tr><td colspan="7" style="text-align:center; color: #c53030; padding: 25px;">Error al conectar con el servidor. Revisá tu conexión.</td></tr>';
    }
}

// Verifica si la columna "pago" en Google Sheets está marcada
function estaPagado(inv) {
    const val = String(inv.pago || '').trim().toUpperCase();
    return val === 'SI' || val === 'TRUE' || val === '1';
}

// Calcula los totales de confirmados, catering y dinero recaudado
function calcularMetricas(lista) {
    let totalPersonas = 0;
    let tradicional = 0;
    let celiaco = 0;
    let infantil = 0;
    let totalDinero = 0;
    let totalPagaron = 0;

    lista.forEach(inv => {
        const cantPersonas = parseInt(inv.integrantes || 0, 10);
        totalPersonas += cantPersonas;

        // Sumar al acumulado si está pagado
        if (estaPagado(inv)) {
            totalDinero += cantPersonas * VALOR_TARJETA;
            totalPagaron += cantPersonas;
        }

        const menuStr = inv.menu || '';
        const matchTrad = menuStr.match(/Tradicional:\s*(\d+)/i);
        if (matchTrad) tradicional += parseInt(matchTrad[1], 10);

        const matchCel = menuStr.match(/Celíaco:\s*(\d+)/i);
        if (matchCel) celiaco += parseInt(matchCel[1], 10);

        const matchInf = menuStr.match(/Infantil:\s*(\d+)/i);
        if (matchInf) infantil += parseInt(matchInf[1], 10);
    });

    metricasActuales = {
        totalConfirmados: lista.length,
        totalPersonas,
        totalRecaudado: totalDinero,
        personasPagadas: totalPagaron,
        tradicional,
        celiaco,
        infantil
    };

    // Actualización de carteles en el HTML
    document.getElementById('countConfirm').innerText = lista.length;
    document.getElementById('totalGuests').innerText = totalPersonas;
    
    const elRecaudado = document.getElementById('totalRecaudado');
    if (elRecaudado) elRecaudado.innerText = `$${totalDinero.toLocaleString('es-AR')}`;

    const elSubPagados = document.getElementById('subPagados');
    if (elSubPagados) elSubPagados.innerText = `${totalPagaron} de ${totalPersonas} personas abonadas`;

    document.getElementById('totalTradicional').innerText = tradicional;
    document.getElementById('totalCeliaco').innerText = celiaco;
    document.getElementById('totalInfantil').innerText = infantil;
}

// Renderiza los registros en la tabla HTML
function renderizarTabla(lista) {
    const cuerpo = document.getElementById('listaCuerpo');
    cuerpo.innerHTML = '';

    if (lista.length === 0) {
        cuerpo.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 25px; color: #8c8275;">No se encontraron registros.</td></tr>';
        return;
    }

    lista.forEach((inv, index) => {
        const pagado = estaPagado(inv);
        const cantPersonas = parseInt(inv.integrantes || 1, 10);
        const subtotal = cantPersonas * VALOR_TARJETA;

        const cleanPhone = String(inv.telefono || '').replace(/\D/g, '');
        const telLink = cleanPhone ? `<a class="phone-link" href="https://wa.me/${cleanPhone}" target="_blank" title="Enviar WhatsApp">${inv.telefono}</a>` : (inv.telefono || '-');

        cuerpo.innerHTML += `
            <tr class="${pagado ? 'row-paid' : ''}" id="row-${index}">
                <td style="text-align: center;">
                    <div class="payment-check-container">
                        <input type="checkbox" 
                               class="payment-checkbox" 
                               id="chk-${index}"
                               ${pagado ? 'checked' : ''} 
                               onchange="actualizarPagoEnSheet(${index})" 
                               title="Marcar como pagado en Google Sheets">
                    </div>
                </td>
                <td class="guest-name">${inv.nombre || ''} ${inv.apellido || ''}</td>
                <td>${telLink}</td>
                <td style="text-align: center;"><span class="guest-badge">${cantPersonas}</span></td>
                <td class="amount-cell">
                    $${subtotal.toLocaleString('es-AR')}
                    <span class="status-badge ${pagado ? 'status-paid' : 'status-pending'}" id="badge-${index}">
                        ${pagado ? 'Pagado' : 'Pendiente'}
                    </span>
                </td>
                <td><span class="menu-pill">${inv.menu || 'Estándar'}</span></td>
                <td class="date-col">${inv.fecha || '-'}</td>
            </tr>
        `;
    });
}

// Actualiza el campo "pago" en Google Sheets vía SheetDB
async function actualizarPagoEnSheet(index) {
    const inv = datosInvitados[index];
    const checkbox = document.getElementById(`chk-${index}`);
    const badge = document.getElementById(`badge-${index}`);
    const row = document.getElementById(`row-${index}`);

    const nuevoEstado = checkbox.checked ? 'SI' : 'NO';

    checkbox.disabled = true;

    try {
        // SheetDB actualiza buscando por columna (usamos teléfono o nombre)
        let endpoint = `${API_URL}/telefono/${encodeURIComponent(inv.telefono)}`;
        if (!inv.telefono) {
            endpoint = `${API_URL}/nombre/${encodeURIComponent(inv.nombre)}`;
        }

        const res = await fetch(endpoint, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: { "pago": nuevoEstado }
            })
        });

        if (res.ok) {
            inv.pago = nuevoEstado;

            if (nuevoEstado === 'SI') {
                row.classList.add('row-paid');
                badge.className = 'status-badge status-paid';
                badge.innerText = 'Pagado';
            } else {
                row.classList.remove('row-paid');
                badge.className = 'status-badge status-pending';
                badge.innerText = 'Pendiente';
            }

            calcularMetricas(datosInvitados);
        } else {
            alert("No se pudo actualizar en Google Sheets. Verificá que la columna 'pago' exista en la fila 1.");
            checkbox.checked = !checkbox.checked;
        }
    } catch (err) {
        console.error("Error al actualizar pago:", err);
        alert("Error de conexión al guardar el pago en Google Sheets.");
        checkbox.checked = !checkbox.checked;
    } finally {
        checkbox.disabled = false;
    }
}

// Filtrado en vivo al escribir en el buscador
function filtrarInvitados() {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    const filtrados = datosInvitados.filter(inv => {
        const nombreCompleto = `${inv.nombre || ''} ${inv.apellido || ''}`.toLowerCase();
        const telefono = String(inv.telefono || '').toLowerCase();
        const menu = String(inv.menu || '').toLowerCase();
        return nombreCompleto.includes(query) || telefono.includes(query) || menu.includes(query);
    });
    renderizarTabla(filtrados);
}

// Exportación a archivo PDF estilizado con estado de cuenta
function exportarPDF() {
    if (!datosInvitados || datosInvitados.length === 0) {
        alert("No hay confirmaciones disponibles para exportar.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();

    // 1. Cabecera Elegante
    doc.setFont("times", "bold");
    doc.setFontSize(22);
    doc.setTextColor(43, 40, 36);
    doc.text("Boda Laura & Julio", pageWidth / 2, 20, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(181, 155, 97);
    doc.text("LISTA DE INVITADOS, CATERING & CONTROL DE PAGOS", pageWidth / 2, 26, { align: "center" });

    doc.setDrawColor(235, 217, 184);
    doc.setLineWidth(0.5);
    doc.line(20, 30, pageWidth - 20, 30);

    // 2. Bloque Resumen Financiero y Asistencia
    doc.setFontSize(9);
    doc.setTextColor(80, 75, 70);
    const fechaEmision = new Date().toLocaleDateString('es-AR');
    doc.text(`Fecha de exportación: ${fechaEmision}`, 20, 36);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(43, 40, 36);
    const resumenTexto = `Confirmaciones: ${metricasActuales.totalConfirmados}  |  Total Asistentes: ${metricasActuales.totalPersonas} personas`;
    doc.text(resumenTexto, 20, 42);

    doc.setTextColor(140, 115, 62);
    doc.text(`Total Recaudado: $${metricasActuales.totalRecaudado.toLocaleString('es-AR')} (${metricasActuales.personasPagadas} de ${metricasActuales.totalPersonas} abonados)`, 20, 47);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 95, 90);
    const cateringTexto = `Catering: Tradicional (${metricasActuales.tradicional})  ·  Celíaco (${metricasActuales.celiaco})  ·  Infantil (${metricasActuales.infantil})`;
    doc.text(cateringTexto, 20, 52);

    // 3. Preparación de Filas de la Tabla
    const bodyData = datosInvitados.map((inv, index) => {
        const pagado = estaPagado(inv);
        const cantPersonas = parseInt(inv.integrantes || 1, 10);
        const subtotal = cantPersonas * VALOR_TARJETA;

        return [
            (index + 1).toString(),
            pagado ? 'PAGADO' : 'PENDIENTE',
            `${inv.nombre || ''} ${inv.apellido || ''}`.trim(),
            inv.telefono || '-',
            cantPersonas.toString(),
            `$${subtotal.toLocaleString('es-AR')}`,
            inv.menu || 'Estándar',
            String(inv.fecha || '').replace(/^'/, '')
        ];
    });

    // 4. Renderizado de la tabla con jspdf-autotable
    doc.autoTable({
        startY: 57,
        head: [['#', 'Estado', 'Invitado', 'Teléfono', 'Pers.', 'Total', 'Detalle de Menú', 'Fecha']],
        body: bodyData,
        theme: 'striped',
        styles: {
            font: 'helvetica',
            fontSize: 8,
            cellPadding: 3,
            textColor: [60, 55, 50],
            valign: 'middle'
        },
        headStyles: {
            fillColor: [181, 155, 97],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'left'
        },
        alternateRowStyles: {
            fillColor: [253, 250, 245]
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 7 },
            1: { halign: 'center', fontStyle: 'bold', cellWidth: 18 },
            2: { fontStyle: 'bold', cellWidth: 34 },
            3: { cellWidth: 24 },
            4: { halign: 'center', cellWidth: 11 },
            5: { halign: 'right', fontStyle: 'bold', cellWidth: 22 },
            6: { cellWidth: 46 },
            7: { cellWidth: 26, fontSize: 7 }
        },
        didDrawPage: function (data) {
            const pageCount = doc.internal.getNumberOfPages();
            doc.setFontSize(8);
            doc.setTextColor(160, 150, 140);
            doc.text(
                `Página ${doc.internal.getCurrentPageInfo().pageNumber} de ${pageCount}`,
                pageWidth / 2,
                doc.internal.pageSize.getHeight() - 10,
                { align: 'center' }
            );
        }
    });

    // 5. Descarga directa del archivo PDF
    doc.save("Lista_Invitados_Pagos_Boda_Laura_y_Julio.pdf");
}

// Listeners e inicialización
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('searchInput').addEventListener('input', filtrarInvitados);
    document.getElementById('reloadBtn').addEventListener('click', cargarInvitados);
    document.getElementById('exportBtn').addEventListener('click', exportarPDF);

    cargarInvitados();
});