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
  document.getElementById("nextOrderBadge").textContent = generateOrder
