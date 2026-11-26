// ==========================================
// ESTADO GLOBAL Y CONFIGURACIÓN INICIAL
// ==========================================
const STORAGE_ORDERS_KEY = "techservice_orders_v1";
const STORAGE_CONFIG_KEY = "techservice_config_v1";

const DEFAULT_CONFIG = {
  workshopName: "TechService Pro",
  workshopPhone: "310 000 0000",
  workshopAddress: "Centro Técnico Principal",
  workshopTerms:
    "1. Todo equipo apagado o mojado ingresa sin garantía de encendido. 2. Pasados 30 días sin reclamar el equipo, el taller no se hace responsable por almacenamiento. 3. La garantía cubre únicamente el repuesto instalado por defectos de fábrica (no cubre golpes ni humedad)."
};

let orders = JSON.parse(localStorage.getItem(STORAGE_ORDERS_KEY)) || [];
let config = JSON.parse(localStorage.getItem(STORAGE_CONFIG_KEY)) || { ...DEFAULT_CONFIG };
let currentFilter = "Todos";
let activeTicketOrder = null;
let patternSequence = [];
let isDrawingPattern = false;

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  applyWorkshopConfig();
  setupNavigation();
  setupPatternLock();
  setupFinanceCalculator();
  setupFormSubmit();
  setupFiltersAndSearch();
  setupConfigAndBackup();
  setupModalEvents();
  updateNextOrderBadge();
  renderOrders();
});

// ==========================================
// NAVEGACIÓN ENTRE PESTAÑAS
// ==========================================
function setupNavigation() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const views = document.querySelectorAll(".tab-view");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      views.forEach((v) => v.classList.remove("active"));

      btn.classList.add("active");
      const targetId = `tab-${btn.dataset.tab}`;
      document.getElementById(targetId).classList.add("active");

      if (btn.dataset.tab === "nuevo") {
        updateNextOrderBadge();
      }
    });
  });
}

// ==========================================
// GENERADOR DE NÚMERO DE ORDEN Y MONEDA
// ==========================================
function generateOrderNumber() {
  if (orders.length === 0) return "ORD-0001";
  const maxNum = orders.reduce((max, o) => {
    const num = parseInt(o.orderNumber.replace("ORD-", ""), 10) || 0;
    return num > max ? num : max;
  }, 0);
  return `ORD-${String(maxNum + 1).padStart(4, "0")}`;
}

function updateNextOrderBadge() {
  document.getElementById("nextOrderBadge").textContent = generateOrderNumber();
}

function formatMoney(amount) {
  const num = Number(amount) || 0;
  return "$" + num.toLocaleString("es-CO");
}

// ==========================================
// SELECTOR INTERACTIVO DE PATRÓN (9 PUNTOS)
// ==========================================
function setupPatternLock() {
  const pad = document.getElementById("patternPad");
  const dots = document.querySelectorAll(".pattern-dot");
  const clearBtn = document.getElementById("clearPatternBtn");

  const addDot = (dotEl) => {
    const val = dotEl.dataset.dot;
    if (!patternSequence.includes(val)) {
      patternSequence.push(val);
      dotEl.classList.add("active");
      updatePatternUI();
    }
  };

  dots.forEach((dot) => {
    dot.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      isDrawingPattern = true;
      addDot(dot);
    });

    dot.addEventListener("pointerenter", () => {
      if (isDrawingPattern) addDot(dot);
    });
  });

  // Soporte táctil continuo en móviles/tablets
  pad.addEventListener("pointermove", (e) => {
    if (!isDrawingPattern) return;
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const dotEl = target ? target.closest(".pattern-dot") : null;
    if (dotEl) addDot(dotEl);
  });

  window.addEventListener("pointerup", () => {
    isDrawingPattern = false;
  });

  clearBtn.addEventListener("click", resetPatternLock);
}

function resetPatternLock() {
  patternSequence = [];
  document.querySelectorAll(".pattern-dot").forEach((d) => d.classList.remove("active"));
  updatePatternUI();
}

function updatePatternUI() {
  const display = document.getElementById("patternDisplay");
  const svg = document.getElementById("patternLines");
  display.textContent = patternSequence.length ? patternSequence.join(" → ") : "Ninguna";

  // Dibujar líneas SVG conectando los puntos
  svg.innerHTML = "";
  const coords = {
    "1": [30, 30], "2": [90, 30], "3": [150, 30],
    "4": [30, 90], "5": [90, 90], "6": [150, 90],
    "7": [30, 150], "8": [90, 150], "9": [150, 150]
  };

  for (let i = 0; i < patternSequence.length - 1; i++) {
    const [x1, y1] = coords[patternSequence[i]];
    const [x2, y2] = coords[patternSequence[i + 1]];
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.setAttribute("stroke", "#3b82f6");
    line.setAttribute("stroke-width", "4");
    line.setAttribute("stroke-linecap", "round");
    svg.appendChild(line);
  }
}

// ==========================================
// CÁLCULO AUTOMÁTICO DE SALDO
// ==========================================
function setupFinanceCalculator() {
  const totalInput = document.getElementById("totalCost");
  const advanceInput = document.getElementById("advancePay");
  const balanceDisplay = document.getElementById("balanceDisplay");

  const recalc = () => {
    const total = parseFloat(totalInput.value) || 0;
    const advance = parseFloat(advanceInput.value) || 0;
    const balance = Math.max(0, total - advance);
    balanceDisplay.value = formatMoney(balance);
  };

  totalInput.addEventListener("input", recalc);
  advanceInput.addEventListener("input", recalc);
}

// ==========================================
// GUARDAR NUEVA ORDEN DE INGRESO
// ==========================================
function setupFormSubmit() {
  const form = document.getElementById("intakeForm");
  const resetBtn = document.getElementById("resetFormBtn");

  resetBtn.addEventListener("click", () => {
    form.reset();
    resetPatternLock();
    document.getElementById("balanceDisplay").value = "$0";
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const conditions = Array.from(
      document.querySelectorAll("#conditionChecklist input:checked")
    ).map((cb) => cb.value);

    const accessories = Array.from(
      document.querySelectorAll("#accessoriesChecklist input:checked")
    ).map((cb) => cb.value);

    const totalCost = parseFloat(document.getElementById("totalCost").value) || 0;
    const advancePay = parseFloat(document.getElementById("advancePay").value) || 0;

    const newOrder = {
      id: Date.now().toString(),
      orderNumber: generateOrderNumber(),
      createdAt: new Date().toLocaleDateString("es-CO"),
      clientName: document.getElementById("clientName").value.trim(),
      clientPhone: document.getElementById("clientPhone").value.trim(),
      clientDoc: document.getElementById("clientDoc").value.trim(),
      deviceBrand: document.getElementById("deviceBrand").value,
      deviceModel: document.getElementById("deviceModel").value.trim(),
      deviceImei: document.getElementById("deviceImei").value.trim() || "No registrado",
      deviceColor: document.getElementById("deviceColor").value.trim(),
      devicePin: document.getElementById("devicePin").value.trim(),
      devicePattern: patternSequence.length ? patternSequence.join("-") : "",
      conditions: conditions.length ? conditions : ["Sin novedades reportadas"],
      accessories: accessories.length ? accessories : ["Solo equipo"],
      reportedIssue: document.getElementById("reportedIssue").value.trim(),
      techNotes: document.getElementById("techNotes").value.trim(),
      totalCost,
      advancePay,
      balance: Math.max(0, totalCost - advancePay),
      status: document.getElementById("initialStatus").value,
      deliveryDate: document.getElementById("deliveryDate").value
    };

    orders.unshift(newOrder);
    saveOrders();

    form.reset();
    resetPatternLock();
    document.getElementById("balanceDisplay").value = "$0";
    updateNextOrderBadge();
    renderOrders();

    // Cambiar al panel y abrir el comprobante inmediatamente
    document.querySelector('.tab-btn[data-tab="panel"]').click();
    openTicketModal(newOrder);
  });
}

function saveOrders() {
  localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(orders));
}

// ==========================================
// RENDERIZADO DEL PANEL Y KPIs
// ==========================================
function renderOrders() {
  const listEl = document.getElementById("ordersList");
  const query = document.getElementById("searchInput").value.toLowerCase().trim();

  // Actualizar KPIs
  const totalOrders = orders.length;
  const inProcess = orders.filter((o) =>
    ["Recibido", "En Diagnóstico", "En Reparación"].includes(o.status)
  ).length;
  const ready = orders.filter((o) => o.status === "Listo para Entrega").length;
  const pendingBalance = orders
    .filter((o) => o.status !== "Entregado")
    .reduce((sum, o) => sum + (o.balance || 0), 0);

  document.getElementById("kpiTotal").textContent = totalOrders;
  document.getElementById("kpiProceso").textContent = inProcess;
  document.getElementById("kpiListos").textContent = ready;
  document.getElementById("kpiSaldo").textContent = formatMoney(pendingBalance);

  // Filtrar lista
  const filtered = orders.filter((o) => {
    const matchesStatus = currentFilter === "Todos" || o.status === currentFilter;
    const matchesQuery =
      !query ||
      o.orderNumber.toLowerCase().includes(query) ||
      o.clientName.toLowerCase().includes(query) ||
      o.clientPhone.toLowerCase().includes(query) ||
      o.deviceModel.toLowerCase().includes(query) ||
      o.deviceBrand.toLowerCase().includes(query) ||
      o.deviceImei.toLowerCase().includes(query);
    return matchesStatus && matchesQuery;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="card" style="grid-column: 1/-1; text-align:center; padding:36px;">
      <p class="text-muted">No hay órdenes de ingreso que coincidan con la búsqueda o filtro actual.</p>
    </div>`;
    return;
  }

  listEl.innerHTML = filtered
    .map(
      (order) => `
      <article class="order-card">
        <div>
          <div class="order-top">
            <span class="order-id">${order.orderNumber}</span>
            <span class="status-badge status-${order.status}">${order.status}</span>
          </div>
          <h3 class="order-device">${order.deviceBrand} ${order.deviceModel}</h3>
          <p class="order-client">👤 ${order.clientName} • 📞 ${order.clientPhone}</p>
          <p class="order-issue"><strong>Falla:</strong> ${order.reportedIssue}</p>
        </div>

        <div class="order-footer">
          <div class="order-money">
            Saldo: <span style="color:${order.balance > 0 ? "#dc2626" : "#16a34a"}">
              ${formatMoney(order.balance)}
            </span>
          </div>
          <div class="order-actions">
            <select class="status-select" onchange="changeOrderStatus('${order.id}', this.value)">
              <option value="Recibido" ${order.status === "Recibido" ? "selected" : ""}>Recibido</option>
              <option value="En Diagnóstico" ${order.status === "En Diagnóstico" ? "selected" : ""}>En Diagnóstico</option>
              <option value="En Reparación" ${order.status === "En Reparación" ? "selected" : ""}>En Reparación</option>
              <option value="Listo para Entrega" ${order.status === "Listo para Entrega" ? "selected" : ""}>Listo</option>
              <option value="Entregado" ${order.status === "Entregado" ? "selected" : ""}>Entregado</option>
            </select>
            <button class="icon-btn" title="Ver Ticket" onclick="viewTicketById('${order.id}')">🧾</button>
            <button class="icon-btn danger" title="Eliminar" onclick="deleteOrder('${order.id}')">🗑️</button>
          </div>
        </div>
      </article>
    `
    )
    .join("");
}

function setupFiltersAndSearch() {
  document.getElementById("searchInput").addEventListener("input", renderOrders);

  document.querySelectorAll("#statusFilters .pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      document.querySelectorAll("#statusFilters .pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentFilter = pill.dataset.filter;
      renderOrders();
    });
  });
}

window.changeOrderStatus = function (id, newStatus) {
  const idx = orders.findIndex((o) => o.id === id);
  if (idx !== -1) {
    orders[idx].status = newStatus;
    saveOrders();
    renderOrders();
  }
};

window.deleteOrder = function (id) {
  if (!confirm("¿Seguro que deseas eliminar esta orden de servicio?")) return;
  orders = orders.filter((o) => o.id !== id);
  saveOrders();
  renderOrders();
};

window.viewTicketById = function (id) {
  const order = orders.find((o) => o.id === id);
  if (order) openTicketModal(order);
};

// ==========================================
// MODAL DE TICKET, IMPRESIÓN Y WHATSAPP
// ==========================================
function openTicketModal(order) {
  activeTicketOrder = order;

  document.getElementById("tWorkshopName").textContent = config.workshopName;
  document.getElementById("tWorkshopInfo").textContent = `Tel: ${config.workshopPhone} | ${config.workshopAddress}`;
  document.getElementById("tOrderNumber").textContent = order.orderNumber;
  document.getElementById("tDate").textContent = `Ingreso: ${order.createdAt}`;

  document.getElementById("tClientName").textContent = order.clientName;
  document.getElementById("tClientPhone").textContent = order.clientPhone;
  document.getElementById("tClientDoc").textContent = order.clientDoc ? `(Doc: ${order.clientDoc})` : "";

  document.getElementById("tDevice").textContent = `${order.deviceBrand} ${order.deviceModel} ${order.deviceColor ? "(" + order.deviceColor + ")" : ""}`;
  document.getElementById("tImei").textContent = order.deviceImei;

  let secText = [];
  if (order.devicePin) secText.push(`PIN/Clave: ${order.devicePin}`);
  if (order.devicePattern) secText.push(`Patrón: ${order.devicePattern}`);
  document.getElementById("tSecurity").textContent = secText.length ? secText.join(" | ") : "Sin bloqueo";

  document.getElementById("tConditions").textContent = order.conditions.join(", ");
  document.getElementById("tAccessories").textContent = order.accessories.join(", ");
  document.getElementById("tIssue").textContent = order.reportedIssue;
  document.getElementById("tNotes").textContent = order.techNotes ? `Obs: ${order.techNotes}` : "";

  document.getElementById("tTotal").textContent = formatMoney(order.totalCost);
  document.getElementById("tAdvance").textContent = formatMoney(order.advancePay);
  document.getElementById("tBalance").textContent = formatMoney(order.balance);
  document.getElementById("tTerms").textContent = config.workshopTerms;

  document.getElementById("ticketModal").classList.remove("hidden");
}

function setupModalEvents() {
  const modal = document.getElementById("ticketModal");
  const closeFn = () => modal.classList.add("hidden");

  document.getElementById("closeModalBtn").addEventListener("click", closeFn);
  document.getElementById("closeModalBackdrop").addEventListener("click", closeFn);

  document.getElementById("printTicketBtn").addEventListener("click", () => {
    window.print();
  });

  document.getElementById("whatsappBtn").addEventListener("click", () => {
    if (!activeTicketOrder) return;
    const o = activeTicketOrder;
    const cleanPhone = o.clientPhone.replace(/\D/g, "");
    const phoneWithCode = cleanPhone.length === 10 ? `57${cleanPhone}` : cleanPhone;

    const msg =
      `Hola *${o.clientName}*, recibimos tu equipo en *${config.workshopName}*.\n\n` +
      `📋 *Orden:* ${o.orderNumber}\n` +
      `📱 *Equipo:* ${o.deviceBrand} ${o.deviceModel}\n` +
      `🛠️ *Falla:* ${o.reportedIssue}\n` +
      `📌 *Estado:* ${o.status}\n` +
      `💰 *Total:* ${formatMoney(o.totalCost)} | *Abono:* ${formatMoney(o.advancePay)}\n` +
      `💵 *Saldo pendiente:* ${formatMoney(o.balance)}\n\n` +
      `Te avisaremos apenas esté listo.`;

    window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(msg)}`, "_blank");
  });
}

// ==========================================
// CONFIGURACIÓN DEL TALLER Y RESPALDO JSON
// ==========================================
function applyWorkshopConfig() {
  document.getElementById("headerWorkshopName").textContent = config.workshopName;
  document.getElementById("cfgWorkshopName").value = config.workshopName;
  document.getElementById("cfgWorkshopPhone").value = config.workshopPhone;
  document.getElementById("cfgWorkshopAddress").value = config.workshopAddress;
  document.getElementById("cfgWorkshopTerms").value = config.workshopTerms;
}

function setupConfigAndBackup() {
  document.getElementById("settingsForm").addEventListener("submit", (e) => {
    e.preventDefault();
    config = {
      workshopName: document.getElementById("cfgWorkshopName").value.trim() || DEFAULT_CONFIG.workshopName,
      workshopPhone: document.getElementById("cfgWorkshopPhone").value.trim(),
      workshopAddress: document.getElementById("cfgWorkshopAddress").value.trim(),
      workshopTerms: document.getElementById("cfgWorkshopTerms").value.trim()
    };
    localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(config));
    applyWorkshopConfig();
    alert("Configuración del taller guardada correctamente.");
  });

  // Exportar JSON
  document.getElementById("exportDataBtn").addEventListener("click", () => {
    const dataStr = JSON.stringify({ config, orders }, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `respaldo-taller-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Importar JSON
  document.getElementById("importDataInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (Array.isArray(parsed.orders)) {
          orders = parsed.orders;
          saveOrders();
        }
        if (parsed.config) {
          config = { ...DEFAULT_CONFIG, ...parsed.config };
          localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(config));
          applyWorkshopConfig();
        }
        renderOrders();
        updateNextOrderBadge();
        alert("Respaldo restaurado con éxito.");
      } catch (err) {
        alert("El archivo seleccionado no es un respaldo válido.");
      }
    };
    reader.readAsText(file);
  });
}
