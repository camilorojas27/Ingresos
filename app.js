// ==========================================
// ESTADO GLOBAL Y CONFIGURACIÓN INICIAL
// ==========================================
const STORAGE_ORDERS_KEY = "techservice_orders_v1";
const STORAGE_CONFIG_KEY = "techservice_config_v1";

const DEFAULT_CONFIG = {
  workshopName: "CELDON STORE",
  workshopNit: "1121897207-7",
  workshopPhone: "310 000 0000",
  workshopAddress: "Centro Técnico Principal",
  workshopTerms:
    "1. Todo equipo apagado o mojado ingresa sin garantía de encendido. 2. Pasados 30 días sin reclamar el equipo, el taller no se hace responsable por almacenamiento. 3. La garantía cubre únicamente el repuesto instalado por defectos de fábrica (no cubre golpes ni humedad)."
};

let orders = JSON.parse(localStorage.getItem(STORAGE_ORDERS_KEY)) || [];
let config = { ...DEFAULT_CONFIG, ...(JSON.parse(localStorage.getItem(STORAGE_CONFIG_KEY)) || {}) };
let currentFilter = "Todos";
let activeTicketOrder = null;
let editingOrderId = null;
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
function switchTab(tabName) {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const views = document.querySelectorAll(".tab-view");

  tabBtns.forEach((b) => b.classList.toggle("active", b.dataset.tab === tabName));
  views.forEach((v) => v.classList.toggle("active", v.id === `tab-${tabName}`));

  if (tabName === "nuevo") {
    updateNextOrderBadge();
  }
}

function setupNavigation() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.tab === "nuevo" && editingOrderId) {
        resetIntakeFormMode();
      }
      switchTab(btn.dataset.tab);
    });
  });
}

// ==========================================
// GENERADOR DE NÚMERO DE ORDEN Y MONEDA
// ==========================================
function generateOrderNumber() {
  if (orders.length === 0) return "ORD-0001";
  const maxNum = orders.reduce((max, o) => {
    const num = parseInt((o.orderNumber || "").replace("ORD-", ""), 10) || 0;
    return num > max ? num : max;
  }, 0);
  return `ORD-${String(maxNum + 1).padStart(4, "0")}`;
}

function updateNextOrderBadge() {
  const badge = document.getElementById("nextOrderBadge");
  if (editingOrderId) {
    const existing = orders.find((o) => o.id === editingOrderId);
    badge.textContent = existing ? `${existing.orderNumber} (Editando)` : generateOrderNumber();
  } else {
    badge.textContent = generateOrderNumber();
  }
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

function setPatternSequence(seqArray) {
  resetPatternLock();
  seqArray.forEach((val) => {
    const dot = document.querySelector(`.pattern-dot[data-dot="${val}"]`);
    if (dot && !patternSequence.includes(val)) {
      patternSequence.push(val);
      dot.classList.add("active");
    }
  });
  updatePatternUI();
}

function updatePatternUI() {
  const display = document.getElementById("patternDisplay");
  const svg = document.getElementById("patternLines");
  display.textContent = patternSequence.length ? patternSequence.join(" → ") : "Ninguna";

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
function recalculateBalanceInput() {
  const total = parseFloat(document.getElementById("totalCost").value) || 0;
  const advance = parseFloat(document.getElementById("advancePay").value) || 0;
  const balance = Math.max(0, total - advance);
  document.getElementById("balanceDisplay").value = formatMoney(balance);
}

function setupFinanceCalculator() {
  document.getElementById("totalCost").addEventListener("input", recalculateBalanceInput);
  document.getElementById("advancePay").addEventListener("input", recalculateBalanceInput);
}

// ==========================================
// MODO CREAR / EDITAR ORDEN DE INGRESO
// ==========================================
function resetIntakeFormMode() {
  editingOrderId = null;
  document.getElementById("intakeForm").reset();
  resetPatternLock();
  document.getElementById("balanceDisplay").value = "$0";
  document.getElementById("formTitle").textContent = "Nueva Orden de Servicio Técnico";
  document.getElementById("formSubtitle").textContent =
    "Registra los datos del cliente, estado físico del equipo y presupuesto inicial.";
  document.getElementById("submitOrderBtn").textContent = "💾 Guardar Orden y Ver Ticket";
  document.getElementById("cancelEditBtn").classList.add("hidden");
  updateNextOrderBadge();
}

window.editOrderById = function (id) {
  const order = orders.find((o) => o.id === id);
  if (!order) return;

  document.getElementById("ticketModal").classList.add("hidden");
  editingOrderId = order.id;

  document.getElementById("formTitle").textContent = `Editar Orden ${order.orderNumber}`;
  document.getElementById("formSubtitle").textContent =
    "Modifica los datos del ticket o del servicio y guarda los cambios.";
  document.getElementById("submitOrderBtn").textContent = "💾 Guardar Cambios del Ticket";
  document.getElementById("cancelEditBtn").classList.remove("hidden");

  document.getElementById("clientName").value = order.clientName || "";
  document.getElementById("clientPhone").value = order.clientPhone || "";
  document.getElementById("clientDoc").value = order.clientDoc || "";

  const brandSelect = document.getElementById("deviceBrand");
  const hasBrandOption = Array.from(brandSelect.options).some((opt) => opt.value === order.deviceBrand);
  brandSelect.value = hasBrandOption ? order.deviceBrand : "Otra";

  document.getElementById("deviceModel").value = order.deviceModel || "";
  document.getElementById("deviceImei").value =
    order.deviceImei && order.deviceImei !== "No registrado" ? order.deviceImei : "";
  document.getElementById("deviceColor").value = order.deviceColor || "";
  document.getElementById("devicePin").value = order.devicePin || "";

  const parsedPattern = order.devicePattern
    ? order.devicePattern.split("-").map((s) => s.trim()).filter(Boolean)
    : [];
  setPatternSequence(parsedPattern);

  document.querySelectorAll("#conditionChecklist input[type='checkbox']").forEach((cb) => {
    cb.checked = Array.isArray(order.conditions) && order.conditions.includes(cb.value);
  });

  document.querySelectorAll("#accessoriesChecklist input[type='checkbox']").forEach((cb) => {
    cb.checked = Array.isArray(order.accessories) && order.accessories.includes(cb.value);
  });

  document.getElementById("reportedIssue").value = order.reportedIssue || "";
  document.getElementById("techNotes").value = order.techNotes || "";
  document.getElementById("totalCost").value = order.totalCost || 0;
  document.getElementById("advancePay").value = order.advancePay || 0;
  recalculateBalanceInput();

  document.getElementById("initialStatus").value = order.status || "Recibido";
  document.getElementById("deliveryDate").value = order.deliveryDate || "";

  updateNextOrderBadge();
  switchTab("nuevo");
  window.scrollTo({ top: 0, behavior: "smooth" });
};

function setupFormSubmit() {
  const form = document.getElementById("intakeForm");
  const resetBtn = document.getElementById("resetFormBtn");
  const cancelEditBtn = document.getElementById("cancelEditBtn");

  resetBtn.addEventListener("click", () => {
    form.reset();
    resetPatternLock();
    document.getElementById("balanceDisplay").value = "$0";
  });

  cancelEditBtn.addEventListener("click", () => {
    resetIntakeFormMode();
    switchTab("panel");
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
    const balance = Math.max(0, totalCost - advancePay);

    let savedOrder;

    if (editingOrderId) {
      const idx = orders.findIndex((o) => o.id === editingOrderId);
      if (idx !== -1) {
        savedOrder = {
          ...orders[idx],
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
          balance,
          status: document.getElementById("initialStatus").value,
          deliveryDate: document.getElementById("deliveryDate").value
        };
        orders[idx] = savedOrder;
      }
    } else {
      savedOrder = {
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
        balance,
        status: document.getElementById("initialStatus").value,
        deliveryDate: document.getElementById("deliveryDate").value
      };
      orders.unshift(savedOrder);
    }

    saveOrders();
    resetIntakeFormMode();
    renderOrders();
    switchTab("panel");

    if (savedOrder) {
      openTicketModal(savedOrder);
    }
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
            <button class="icon-btn" title="Ver Ticket" onclick="viewTicketById('${order.id}')">🧾 Ver Ticket</button>
            <button class="icon-btn" title="Editar Ticket" onclick="editOrderById('${order.id}')">✏️ Editar Ticket</button>
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
  if (editingOrderId === id) {
    resetIntakeFormMode();
  }
  orders = orders.filter((o) => o.id !== id);
  saveOrders();
  renderOrders();
};

window.viewTicketById = function (id) {
  const order = orders.find((o) => o.id === id);
  if (order) openTicketModal(order);
};

// ==========================================
// MODAL DE TICKET, EDICIÓN, IMPRESIÓN Y WHATSAPP
// ==========================================
function openTicketModal(order) {
  activeTicketOrder = order;

  document.getElementById("tWorkshopName").textContent = config.workshopName;
  document.getElementById("tWorkshopNit").textContent = `NIT: ${config.workshopNit || "1121897207-7"}`;
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

  document.getElementById("modalEditTicketBtn").addEventListener("click", () => {
    if (activeTicketOrder) {
      window.editOrderById(activeTicketOrder.id);
    }
  });

  document.getElementById("printTicketBtn").addEventListener("click", () => {
    window.print();
  });

  document.getElementById("whatsappBtn").addEventListener("click", () => {
    if (!activeTicketOrder) return;
    const o = activeTicketOrder;
    const cleanPhone = o.clientPhone.replace(/\D/g, "");
    const phoneWithCode = cleanPhone.length === 10 ? `57${cleanPhone}` : cleanPhone;

    const msg =
      `Hola *${o.clientName}*, recibimos tu equipo en *${config.workshopName}* (NIT: ${config.workshopNit}).\n\n` +
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
  document.getElementById("headerWorkshopNit").textContent =
    `NIT: ${config.workshopNit || "1121897207-7"} • Gestión Técnica de Celulares`;
  document.getElementById("cfgWorkshopName").value = config.workshopName;
  document.getElementById("cfgWorkshopNit").value = config.workshopNit || "1121897207-7";
  document.getElementById("cfgWorkshopPhone").value = config.workshopPhone;
  document.getElementById("cfgWorkshopAddress").value = config.workshopAddress;
  document.getElementById("cfgWorkshopTerms").value = config.workshopTerms;
}

function setupConfigAndBackup() {
  document.getElementById("settingsForm").addEventListener("submit", (e) => {
    e.preventDefault();
    config = {
      workshopName: document.getElementById("cfgWorkshopName").value.trim() || DEFAULT_CONFIG.workshopName,
      workshopNit: document.getElementById("cfgWorkshopNit").value.trim() || DEFAULT_CONFIG.workshopNit,
      workshopPhone: document.getElementById("cfgWorkshopPhone").value.trim(),
      workshopAddress: document.getElementById("cfgWorkshopAddress").value.trim(),
      workshopTerms: document.getElementById("cfgWorkshopTerms").value.trim()
    };
    localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(config));
    applyWorkshopConfig();
    alert("Configuración de CELDON STORE guardada correctamente.");
  });

  document.getElementById("exportDataBtn").addEventListener("click", () => {
    const dataStr = JSON.stringify({ config, orders }, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `respaldo-celdon-store-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

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
