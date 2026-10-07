const serviceSelect = document.getElementById("serviceSelect");
const servicePicker = document.getElementById("servicePicker");
const serviceMenuBtn = document.getElementById("serviceMenuBtn");
const serviceMenuPanel = document.getElementById("serviceMenuPanel");
const serviceMenuList = document.getElementById("serviceMenuList");
const serviceSearch = document.getElementById("serviceSearch");
const serviceMenuHint = document.getElementById("serviceMenuHint");
const journeyServicesBarEl = document.getElementById("journeyServicesBar");
const multiServiceCountEl = document.getElementById("multiServiceCount");
const monitorMetricsSection = document.getElementById("monitorMetricsSection");
const serviceFocusListEl = document.getElementById("serviceFocusList");
const rangePreset = document.getElementById("rangePreset");
const startTimeInput = document.getElementById("startTime");
const endTimeInput = document.getElementById("endTime");
const customTimeWrap = document.getElementById("customTimeWrap");
const controlsBar = document.getElementById("controlsBar");
const rangeLabel = document.getElementById("rangeLabel");
const fetchBtn = document.getElementById("fetchBtn");
const pinBtn = document.getElementById("pinBtn");
const analyzeBtn = document.getElementById("analyzeBtn");
const analysisModelSelect = document.getElementById("analysisModelSelect");
const analysisBox = document.getElementById("analysisBox");
const analysisIncludeTracesEl = document.getElementById("analysisIncludeTraces");
const askInput = document.getElementById("askInput");
const askBtn = document.getElementById("askBtn");
const savePinBtn = document.getElementById("savePinBtn");
const askResponses = document.getElementById("askResponses");
const pinnedSelect = document.getElementById("pinnedSelect");
const loadPinnedBtn = document.getElementById("loadPinnedBtn");
const deletePinnedBtn = document.getElementById("deletePinnedBtn");
const projectSelect = document.getElementById("projectSelect");
const newProjectNameInput = document.getElementById("newProjectName");
const createProjectBtn = document.getElementById("createProjectBtn");
const deleteProjectBtn = document.getElementById("deleteProjectBtn");
const projectMenu = document.getElementById("projectMenu");
const projectMenuBtn = document.getElementById("projectMenuBtn");
const projectMenuPanel = document.getElementById("projectMenuPanel");
const projectMenuList = document.getElementById("projectMenuList");
const projectMenuLabel = document.getElementById("projectMenuLabel");
const testNameInput = document.getElementById("testName");
const projectTestCountEl = document.getElementById("projectTestCount");
const monitorView = document.getElementById("monitorView");
const compareView = document.getElementById("compareView");
const monitorTabBtn = document.getElementById("monitorTabBtn");
const compareTabBtn = document.getElementById("compareTabBtn");
const compareSavedModeBtn = document.getElementById("compareSavedModeBtn");
const compareRangeModeBtn = document.getElementById("compareRangeModeBtn");
const compareSavedPanel = document.getElementById("compareSavedPanel");
const compareRangePanel = document.getElementById("compareRangePanel");
const comparePinA = document.getElementById("comparePinA");
const comparePinB = document.getElementById("comparePinB");
const compareSavedBtn = document.getElementById("compareSavedBtn");
const compareRangeBtn = document.getElementById("compareRangeBtn");
const compareServiceSelect = document.getElementById("compareServiceSelect");
const compareRangeAPreset = document.getElementById("compareRangeAPreset");
const compareRangeBPreset = document.getElementById("compareRangeBPreset");
const compareRangeACustom = document.getElementById("compareRangeACustom");
const compareRangeBCustom = document.getElementById("compareRangeBCustom");
const compareRangeAStart = document.getElementById("compareRangeAStart");
const compareRangeAEnd = document.getElementById("compareRangeAEnd");
const compareRangeBStart = document.getElementById("compareRangeBStart");
const compareRangeBEnd = document.getElementById("compareRangeBEnd");
const compareStatus = document.getElementById("compareStatus");
const compareLegend = document.getElementById("compareLegend");
const compareLabelA = document.getElementById("compareLabelA");
const compareLabelB = document.getElementById("compareLabelB");
const compareTableCard = document.getElementById("compareTableCard");
const compareTableBody = document.getElementById("compareTableBody");
const compareChartsEl = document.getElementById("compareCharts");
const compareTracesEl = document.getElementById("compareTraces");
const compareTracesLabelA = document.getElementById("compareTracesLabelA");
const compareTracesLabelB = document.getElementById("compareTracesLabelB");
const compareTracesStatusA = document.getElementById("compareTracesStatusA");
const compareTracesStatusB = document.getElementById("compareTracesStatusB");
const compareTracesBodyA = document.getElementById("compareTracesBodyA");
const compareTracesBodyB = document.getElementById("compareTracesBodyB");

const avgCpuEl = document.getElementById("avgCpu");
const avgMemoryEl = document.getElementById("avgMemory");
const hpaCurrentEl = document.getElementById("hpaCurrent");
const hpaDesiredEl = document.getElementById("hpaDesired");
const maxRpmEl = document.getElementById("maxRpm");
const totalRpmEl = document.getElementById("totalRpm");
const endpointListEl = document.getElementById("endpointList");
const throughputTitleEl = document.getElementById("throughputTitle");
const throughputScopeEl = document.getElementById("throughputScope");
const throughputChartScopeEl = document.getElementById("throughputChartScope");
const latencyTitleEl = document.getElementById("latencyTitle");
const latencyScopeEl = document.getElementById("latencyScope");
const tracesScopeEl = document.getElementById("tracesScope");
const tracesStatusEl = document.getElementById("tracesStatus");
const tracesBreakdownFilterEl = document.getElementById("tracesBreakdownFilter");
const tracesTableBodyEl = document.getElementById("tracesTableBody");
const traceBreakdownEl = document.getElementById("traceBreakdown");
const traceBreakdownIdEl = document.getElementById("traceBreakdownId");
const traceBreakdownStatusEl = document.getElementById("traceBreakdownStatus");
const traceBreakdownBodyEl = document.getElementById("traceBreakdownBody");
const hpaNameEl = document.getElementById("hpaName");

let metricsCache = null;
let tracesCache = null;
let availableServices = [];
let selectedServices = [];
let multiMetricsCache = [];
let tracesByServiceCache = {};
let selectedEndpoint = "";
let endpointRequestId = 0;
let tracesRequestId = 0;
let selectedTraceId = "";
let cpuMemoryChart = null;
let hpaChart = null;
let latencyChart = null;
let throughputChart = null;
const compareCharts = {};
const IST_LOCALE = "en-IN";
const IST_TIME_ZONE = "Asia/Kolkata";
const ANALYSIS_SESSION_KEY = "monitor_analysis_session_id_v1";
let analysisConversation = [];
let analysisSessionId = localStorage.getItem(ANALYSIS_SESSION_KEY) || null;
let pinnedResults = [];
let projects = [];
/** When set, trace loads prefer saved journey_json traces instead of live NRQL. */
let activePinnedTracesPinId = null;

const RANGE_LABELS = {
    "now-5m": "Last 5 minutes",
    "now-15m": "Last 15 minutes",
    "now-30m": "Last 30 minutes",
    "now-1h": "Last 1 hour",
    "now-3h": "Last 3 hours",
    "now-6h": "Last 6 hours",
    "now-12h": "Last 12 hours",
    "now-24h": "Last 24 hours",
    "now-2d": "Last 2 days",
    "now-7d": "Last 7 days",
    "now-30d": "Last 30 days",
};

function formatTimestampIST(timestamp) {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return String(timestamp);
    return date.toLocaleString(IST_LOCALE, {
        timeZone: IST_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
}

function formatAxisTimestampIST(timestamp) {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return String(timestamp);
    return date.toLocaleString(IST_LOCALE, {
        timeZone: IST_TIME_ZONE,
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
}

function chartTickLimit(pointCount) {
    if (!pointCount || pointCount <= 24) {
        return 8;
    }
    if (pointCount <= 96) {
        return 10;
    }
    if (pointCount <= 288) {
        return 12;
    }
    return 8;
}

function chartAxisRotation(pointCount) {
    if (!pointCount || pointCount <= 96) {
        return { maxRotation: 35, minRotation: 18 };
    }
    return { maxRotation: 0, minRotation: 0 };
}

function getChartOptions(pointCount = 0) {
    const tickLimit = chartTickLimit(pointCount);
    const rotation = chartAxisRotation(pointCount);
    const decimationSamples = pointCount > 120 ? Math.min(180, Math.max(80, Math.floor(pointCount / 2))) : 0;

    const plugins = {
        legend: {
            display: false,
        },
        tooltip: {
            enabled: false,
            external: renderChartTooltip,
            callbacks: {
                title(items) {
                    if (!items || !items.length) return "";
                    const raw = String(items[0].label || "").replace(/\s*\(IST\)\s*$/i, "");
                    return raw ? `${raw} · IST` : "";
                },
            },
        },
    };

    if (decimationSamples > 0) {
        plugins.decimation = {
            enabled: true,
            algorithm: "lttb",
            samples: decimationSamples,
        };
    }

    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: "index",
            intersect: false,
        },
        plugins,
        scales: {
            x: {
                ticks: {
                    color: "#64748b",
                    autoSkip: true,
                    autoSkipPadding: 12,
                    maxTicksLimit: tickLimit,
                    ...rotation,
                },
                grid: {
                    color: "rgba(148, 163, 184, 0.22)",
                },
            },
            y: {
                ticks: {
                    color: "#64748b",
                    maxTicksLimit: 8,
                },
                grid: {
                    color: "rgba(148, 163, 184, 0.22)",
                },
            },
        },
    };
}

function renderChartLegendPills(chart, containerEl) {
    if (!chart || !containerEl) {
        return;
    }
    containerEl.innerHTML = "";
    chart.data.datasets.forEach((dataset, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "chart-legend-pill";
        const swatch = document.createElement("span");
        swatch.className = "chart-legend-swatch";
        swatch.style.background = dataset.borderColor || "#64748b";
        const label = document.createElement("span");
        label.className = "chart-legend-label";
        label.textContent = dataset.label || `Series ${index + 1}`;
        button.append(swatch, label);
        button.classList.toggle("is-off", !chart.isDatasetVisible(index));
        button.addEventListener("click", () => {
            const willShow = !chart.isDatasetVisible(index);
            chart.setDatasetVisibility(index, willShow);
            chart.update();
            button.classList.toggle("is-off", !willShow);
        });
        containerEl.appendChild(button);
    });
}

function formatChartNumber(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) {
        return "—";
    }
    const abs = Math.abs(num);
    if (Number.isInteger(num) || abs >= 1000) {
        return num.toLocaleString("en-US", { maximumFractionDigits: 0 });
    }
    if (abs >= 100) {
        return num.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    }
    return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

function splitDatasetLabel(label) {
    const text = String(label || "").trim();
    const match = text.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (match) {
        return { name: match[1].trim(), unit: match[2].trim() };
    }
    return { name: text || "Series", unit: "" };
}

function ensureChartTooltipEl(chart) {
    const parent = chart.canvas.parentNode;
    if (!parent) {
        return null;
    }
    let el = parent.querySelector(".chart-hover-tooltip");
    if (!el) {
        el = document.createElement("div");
        el.className = "chart-hover-tooltip";
        el.setAttribute("role", "tooltip");
        parent.appendChild(el);
    }
    return el;
}

function renderChartTooltip(context) {
    const { chart, tooltip } = context;
    const el = ensureChartTooltipEl(chart);
    if (!el) {
        return;
    }
    if (!tooltip || tooltip.opacity === 0 || !tooltip.dataPoints?.length) {
        el.classList.remove("is-visible");
        return;
    }

    const title = tooltip.title?.filter(Boolean).join(" ") || "";
    const rowsHtml = tooltip.dataPoints.map((point) => {
        const { name, unit } = splitDatasetLabel(point.dataset.label);
        const color = point.dataset.borderColor || "#64748b";
        const value = formatChartNumber(point.parsed?.y);
        const unitHtml = unit
            ? `<span class="chart-hover-tooltip-unit">${escapeHtml(unit)}</span>`
            : "";
        return `<div class="chart-hover-tooltip-row">
            <i class="chart-hover-tooltip-swatch" style="background:${escapeHtml(String(color))}"></i>
            <span class="chart-hover-tooltip-name">${escapeHtml(name)}</span>
            <span class="chart-hover-tooltip-value">${escapeHtml(value)}${unitHtml}</span>
        </div>`;
    }).join("");

    el.innerHTML = `${title ? `<div class="chart-hover-tooltip-time">${escapeHtml(title)}</div>` : ""}
        <div class="chart-hover-tooltip-rows">${rowsHtml}</div>`;
    el.classList.add("is-visible");

    const parent = chart.canvas.parentNode;
    const tw = el.offsetWidth;
    const th = el.offsetHeight;
    const parentW = parent.clientWidth;
    const parentH = parent.clientHeight;
    let left = tooltip.caretX + 16;
    let top = tooltip.caretY - th - 12;
    if (left + tw > parentW - 8) {
        left = tooltip.caretX - tw - 16;
    }
    if (left < 8) {
        left = 8;
    }
    if (top < 8) {
        top = tooltip.caretY + 16;
    }
    if (top + th > parentH - 8) {
        top = Math.max(8, parentH - th - 8);
    }
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
}

function latencyChartOptions(pointCount) {
    return getChartOptions(pointCount);
}

function syncChartRangeBadges() {
    const label = rangeLabel.textContent || "";
    document.querySelectorAll(".chart-range-sync").forEach((el) => {
        el.textContent = label;
    });
}

function formatPinnedLabel(item) {
    const name = item.testName || "Untitled test";
    const range = item.rangeLabel || "";
    return range ? `${name} | ${range}` : name;
}

async function refreshPinnedOptions() {
    const projectId = projectSelect.value;
    if (!projectId) {
        pinnedResults = [];
        pinnedSelect.innerHTML = `<option value="">Create or select a project</option>`;
        projectTestCountEl.textContent = "0 tests";
        fillComparePinSelects();
        return;
    }
    const response = await fetch(`/api/pins?project_id=${encodeURIComponent(projectId)}`);
    const data = await response.json();
    if (!response.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail));
    }

    pinnedResults = Array.isArray(data.items) ? data.items : [];
    projectTestCountEl.textContent = `${pinnedResults.length} ${pinnedResults.length === 1 ? "test" : "tests"}`;
    if (!pinnedResults.length) {
        pinnedSelect.innerHTML = `<option value="">No saved tests in this project</option>`;
        fillComparePinSelects();
        return;
    }

    pinnedSelect.innerHTML = "";
    for (const item of pinnedResults) {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = formatPinnedLabel(item);
        pinnedSelect.appendChild(option);
    }
    fillComparePinSelects();
}

async function loadProjects(preferredId = "") {
    const response = await fetch("/api/projects");
    const data = await response.json();
    if (!response.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail));
    }
    projects = Array.isArray(data.items) ? data.items : [];
    projectSelect.innerHTML = "";
    for (const project of projects) {
        const option = document.createElement("option");
        option.value = project.id;
        option.textContent = `${project.name} (${project.testCount})`;
        projectSelect.appendChild(option);
    }
    if (preferredId && projects.some((project) => project.id === preferredId)) {
        projectSelect.value = preferredId;
    }
    renderProjectMenu();
    await refreshPinnedOptions();
}

function renderProjectMenu() {
    const selected = projects.find((project) => project.id === projectSelect.value);
    projectMenuLabel.textContent = selected ? selected.name : "Select project";
    projectMenuList.innerHTML = "";
    for (const project of projects) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `project-option${project.id === projectSelect.value ? " active" : ""}`;
        const name = document.createElement("span");
        name.textContent = project.name;
        const count = document.createElement("small");
        count.textContent = String(project.testCount);
        button.append(name, count);
        button.addEventListener("click", () => {
            projectSelect.value = project.id;
            projectSelect.dispatchEvent(new Event("change"));
            closeProjectMenu();
        });
        projectMenuList.appendChild(button);
    }
    deleteProjectBtn.disabled = projects.length <= 1;
}

function closeProjectMenu() {
    projectMenuPanel.hidden = true;
    projectMenuBtn.setAttribute("aria-expanded", "false");
}

function toggleProjectMenu() {
    const willOpen = projectMenuPanel.hidden;
    projectMenuPanel.hidden = !willOpen;
    projectMenuBtn.setAttribute("aria-expanded", String(willOpen));
}

async function deleteProject() {
    const projectId = projectSelect.value;
    const project = projects.find((item) => item.id === projectId);
    if (!project) {
        return;
    }
    if (projects.length <= 1) {
        analysisBox.textContent = "At least one project must remain.";
        return;
    }
    const confirmed = window.confirm(
        `Delete "${project.name}" and its ${project.testCount} saved tests?`
    );
    if (!confirmed) {
        return;
    }
    deleteProjectBtn.disabled = true;
    try {
        const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
            method: "DELETE",
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail));
        }
        closeProjectMenu();
        await loadProjects();
        analysisBox.textContent = `Project "${project.name}" deleted.`;
    } catch (error) {
        analysisBox.textContent = `Delete project error: ${error.message}`;
        deleteProjectBtn.disabled = projects.length <= 1;
    }
}

async function createProject() {
    const name = newProjectNameInput.value.trim();
    if (!name) {
        analysisBox.textContent = "Enter a project name first.";
        newProjectNameInput.focus();
        return;
    }
    createProjectBtn.disabled = true;
    try {
        const response = await fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail));
        }
        newProjectNameInput.value = "";
        closeProjectMenu();
        await loadProjects(data.id);
        analysisBox.textContent = `Project "${data.name}" created.`;
    } catch (error) {
        analysisBox.textContent = `Project error: ${error.message}`;
    } finally {
        createProjectBtn.disabled = false;
    }
}

function formatDateTimeLocalForLabel(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(IST_LOCALE, {
        timeZone: IST_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
}

function updateTimeRangeControls() {
    const enabled = rangePreset.value === "custom";
    customTimeWrap.classList.toggle("hidden", !enabled);
    if (controlsBar) {
        controlsBar.classList.toggle("has-custom-range", enabled);
    }
    startTimeInput.disabled = !enabled;
    endTimeInput.disabled = !enabled;

    if (enabled) {
        if (startTimeInput.value && endTimeInput.value) {
            rangeLabel.textContent = `${formatDateTimeLocalForLabel(startTimeInput.value)} to ${formatDateTimeLocalForLabel(endTimeInput.value)} (IST)`;
        } else {
            rangeLabel.textContent = "Custom absolute range (IST)";
        }
        syncChartRangeBadges();
        return;
    }

    const label = RANGE_LABELS[rangePreset.value] || rangePreset.value;
    rangeLabel.textContent = `${label} (to now)`;
    syncChartRangeBadges();
}

function toIsoLocal(date) {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

function setDefaultCustomTimes() {
    const end = new Date();
    const start = new Date(end.getTime() - 60 * 60 * 1000);
    startTimeInput.value = toIsoLocal(start);
    endTimeInput.value = toIsoLocal(end);
}

function presetDurationMs(preset) {
    const match = /^now-(\d+)([mhd])$/.exec(String(preset || ""));
    if (!match) {
        return null;
    }
    const unitMs = { m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
    return Number(match[1]) * unitMs[match[2]];
}

function savedAbsoluteRange() {
    const cached = metricsCache && metricsCache.time_range;
    const cachedStart = cached && cached.start_time;
    const cachedEnd = cached && cached.end_time;
    if (
        cachedStart
        && cachedEnd
        && !String(cachedStart).startsWith("now")
        && cachedEnd !== "now"
    ) {
        const start = new Date(cachedStart);
        const end = new Date(cachedEnd);
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
            return { start, end };
        }
    }

    const range = getRange();
    if (!String(range.start_time).startsWith("now") && range.end_time !== "now") {
        return { start: new Date(range.start_time), end: new Date(range.end_time) };
    }

    const end = new Date();
    const duration = presetDurationMs(range.start_time) || 0;
    return { start: new Date(end.getTime() - duration), end };
}

function applyAbsoluteRange(start, end) {
    rangePreset.value = "custom";
    startTimeInput.value = toIsoLocal(start);
    endTimeInput.value = toIsoLocal(end);
    updateTimeRangeControls();
}

function getRange() {
    if (rangePreset.value !== "custom") {
        return {
            start_time: rangePreset.value,
            end_time: "now",
        };
    }

    if (!startTimeInput.value || !endTimeInput.value) {
        throw new Error("Start and end time are required for custom range.");
    }

    const start = new Date(startTimeInput.value);
    const end = new Date(endTimeInput.value);
    if (start >= end) {
        throw new Error("'From' must be earlier than 'To'.");
    }

    return {
        start_time: start.toISOString(),
        end_time: end.toISOString(),
    };
}

function shortServiceName(name) {
    const value = String(name || "");
    return value.replace(/^paytv-load-test-/, "") || value;
}

function getSelectedServices() {
    return selectedServices.slice();
}

function syncPrimaryService() {
    if (!selectedServices.length) {
        serviceSelect.value = "";
        return;
    }
    if (![...serviceSelect.options].some((option) => option.value === selectedServices[0])) {
        return;
    }
    serviceSelect.value = selectedServices[0];
}

function updateServiceMenuButton() {
    if (!selectedServices.length) {
        serviceMenuBtn.textContent = "Select services";
        return;
    }
    if (selectedServices.length === 1) {
        serviceMenuBtn.textContent = selectedServices[0];
        return;
    }
    serviceMenuBtn.textContent = `${selectedServices.length} services selected`;
}

function setSelectedServices(names) {
    const unique = [];
    for (const name of names || []) {
        if (name && !unique.includes(name)) {
            unique.push(name);
        }
    }
    if (!unique.length && availableServices.length) {
        unique.push(availableServices[0]);
    }
    selectedServices = unique;
    if (unique[0] && ![...serviceSelect.options].some((option) => option.value === unique[0])) {
        const option = document.createElement("option");
        option.value = unique[0];
        option.textContent = unique[0];
        serviceSelect.appendChild(option);
    }
    serviceMenuList.querySelectorAll("input[type='checkbox']").forEach((input) => {
        input.checked = selectedServices.includes(input.value);
    });
    syncPrimaryService();
    updateServiceMenuButton();
    if (compareServiceSelect && serviceSelect.value) {
        compareServiceSelect.value = serviceSelect.value;
    }
}

function renderServiceMenu(services) {
    const query = (serviceSearch && serviceSearch.value || "").trim().toLowerCase();
    serviceMenuList.innerHTML = "";
    const filtered = services.filter((name) => !query || name.toLowerCase().includes(query));
    if (!filtered.length) {
        const empty = document.createElement("p");
        empty.className = "service-menu-hint";
        empty.textContent = "No matching services.";
        serviceMenuList.appendChild(empty);
        return;
    }
    for (const name of filtered) {
        const label = document.createElement("label");
        label.className = "service-option";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.value = name;
        input.checked = selectedServices.includes(name);
        input.addEventListener("change", () => {
            if (input.checked) {
                selectedServices.push(name);
            } else if (selectedServices.length > 1) {
                selectedServices = selectedServices.filter((item) => item !== name);
            } else {
                input.checked = true;
                serviceMenuHint.textContent = "Keep at least one service selected.";
                return;
            }
            serviceMenuHint.textContent = "Select every service included in this test.";
            syncPrimaryService();
            updateServiceMenuButton();
            if (compareServiceSelect && serviceSelect.value) {
                compareServiceSelect.value = serviceSelect.value;
            }
        });
        const text = document.createElement("span");
        text.textContent = name;
        label.append(input, text);
        serviceMenuList.appendChild(label);
    }
}

function toggleServiceMenu() {
    const willOpen = serviceMenuPanel.hidden;
    serviceMenuPanel.hidden = !willOpen;
    serviceMenuBtn.setAttribute("aria-expanded", willOpen ? "true" : "false");
    if (willOpen && serviceSearch) {
        serviceSearch.focus();
    }
}

function closeServiceMenu() {
    serviceMenuPanel.hidden = true;
    serviceMenuBtn.setAttribute("aria-expanded", "false");
}

async function loadServices() {
    serviceSelect.innerHTML = "<option>Loading services...</option>";
    serviceMenuBtn.textContent = "Loading services...";
    try {
        const response = await fetch("/api/services");
        const data = await response.json();

        if (!response.ok) {
            throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail));
        }

        availableServices = data.services || [];
        if (!availableServices.length) {
            serviceSelect.innerHTML = "<option>No services found</option>";
            compareServiceSelect.innerHTML = serviceSelect.innerHTML;
            serviceMenuBtn.textContent = "No services found";
            return;
        }

        serviceSelect.innerHTML = availableServices
            .map((name) => `<option value="${name}">${name}</option>`)
            .join("");
        compareServiceSelect.innerHTML = serviceSelect.innerHTML;
        const previous = selectedServices.filter((name) => availableServices.includes(name));
        setSelectedServices(previous.length ? previous : [availableServices[0]]);
        renderServiceMenu(availableServices);
    } catch (error) {
        serviceSelect.innerHTML = "<option>Failed to load services</option>";
        compareServiceSelect.innerHTML = serviceSelect.innerHTML;
        serviceMenuBtn.textContent = "Failed to load services";
        analysisBox.textContent = `Service load error: ${error.message}`;
    }
}

function setStatValue(element, value, fallback = "--") {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        element.textContent = fallback;
        return;
    }
    element.textContent = `${Number(value).toFixed(2)}`;
}

function endpointLabel(name) {
    const cleaned = String(name || "").replace(/^WebTransaction\/[^/]+\//, "");
    return cleaned || name;
}

function renderRpmStats(throughput) {
    const series = throughput || {};
    const maxRpm = series.max_rpm || 0;
    const totalRpm = series.total_rpm || 0;

    maxRpmEl.textContent = Number.isFinite(Number(maxRpm))
        ? Number(maxRpm).toLocaleString("en-IN", { maximumFractionDigits: 2 })
        : "--";

    totalRpmEl.textContent = Number.isFinite(Number(totalRpm))
        ? Number(totalRpm).toLocaleString("en-IN", { maximumFractionDigits: 0 })
        : "--";
}

function renderStats(metrics) {
    const cpuMem = metrics.cpu_memory || {};
    const hpa = metrics.hpa_scaling || {};

    setStatValue(avgCpuEl, cpuMem.avg_cpu_percent);
    setStatValue(avgMemoryEl, cpuMem.avg_memory_percent);
    setStatValue(hpaCurrentEl, hpa.latest_current, "--");
    setStatValue(hpaDesiredEl, hpa.latest_desired, "--");
    renderRpmStats(metrics.throughput || {});
}

function destroyChart(chart) {
    if (chart) {
        chart.destroy();
    }
}

function renderCharts(metrics) {
    setSingleServiceLayout();
    const cpuMem = metrics.cpu_memory || {};
    const hpa = metrics.hpa_scaling || {};
    const cpuMemLabels = (cpuMem.timestamps || []).map(formatAxisTimestampIST);
    const hpaLabels = (hpa.timestamps || []).map(formatAxisTimestampIST);

    destroyChart(cpuMemoryChart);
    destroyChart(hpaChart);

    cpuMemoryChart = new Chart(document.getElementById("cpuMemoryChart"), {
        type: "line",
        data: {
            labels: cpuMemLabels,
            datasets: [
                {
                    label: "CPU %",
                    data: cpuMem.cpu_percent || [],
                    borderColor: "#4cafef",
                    backgroundColor: "rgba(76, 175, 239, 0.18)",
                    fill: true,
                    borderWidth: 2,
                    tension: 0.15,
                    pointRadius: 0,
                },
                {
                    label: "Memory %",
                    data: cpuMem.memory_percent || [],
                    borderColor: "#ffb74d",
                    backgroundColor: "rgba(255, 183, 77, 0.16)",
                    fill: true,
                    borderWidth: 2,
                    tension: 0.15,
                    pointRadius: 0,
                },
            ],
        },
        options: getChartOptions(cpuMemLabels.length),
    });
    renderChartLegendPills(cpuMemoryChart, document.getElementById("cpuMemoryLegend"));

    const hpaOptions = getChartOptions(hpaLabels.length);
    if (hpaNameEl) {
        hpaNameEl.textContent = hpa.hpa || "No HPA match";
        hpaNameEl.title = hpa.hpa || "";
    }
    hpaChart = new Chart(document.getElementById("hpaChart"), {
        type: "line",
        data: {
            labels: hpaLabels,
            datasets: [
                {
                    label: "Desired",
                    data: hpa.desired_replicas || [],
                    borderColor: "#f0d84f",
                    backgroundColor: "transparent",
                    borderWidth: 2,
                    stepped: true,
                    tension: 0,
                    pointRadius: 0,
                },
                {
                    label: "Running",
                    data: hpa.current_replicas || [],
                    borderColor: "#8ddf8a",
                    backgroundColor: "rgba(141, 223, 138, 0.16)",
                    fill: true,
                    borderWidth: 2,
                    stepped: true,
                    tension: 0,
                    pointRadius: 0,
                },
                {
                    label: "Max",
                    data: hpa.max_replicas || [],
                    borderColor: "#e66b7d",
                    backgroundColor: "transparent",
                    borderWidth: 2,
                    stepped: true,
                    tension: 0,
                    pointRadius: 0,
                },
                {
                    label: "Min",
                    data: hpa.min_replicas || [],
                    borderColor: "#6ea8ff",
                    backgroundColor: "transparent",
                    borderWidth: 2,
                    stepped: true,
                    tension: 0,
                    pointRadius: 0,
                },
            ],
        },
        options: {
            ...hpaOptions,
            scales: {
                ...hpaOptions.scales,
                y: {
                    ...hpaOptions.scales.y,
                    beginAtZero: true,
                },
            },
        },
    });
    renderChartLegendPills(hpaChart, document.getElementById("hpaLegend"));

    selectedEndpoint = "";
    renderLatency(metrics.response_time_ms || {}, "");
    renderThroughput(metrics.throughput || {}, "");
    renderEndpointList(metrics.endpoints || []);
    pulseServicePanel();
}

function setSingleServiceLayout() {
    if (monitorMetricsSection) {
        monitorMetricsSection.classList.remove("hidden");
    }
    const cpuTitle = document.getElementById("cpuMemoryTitle");
    const hpaTitle = document.getElementById("hpaTitle");
    if (cpuTitle) {
        cpuTitle.textContent = "CPU & Memory";
    }
    if (hpaTitle) {
        hpaTitle.textContent = "HPA Scaling";
    }
}

function renderServiceFocusChips() {
    if (!serviceFocusListEl || !journeyServicesBarEl) {
        return;
    }
    serviceFocusListEl.innerHTML = "";
    if (selectedServices.length < 2) {
        journeyServicesBarEl.classList.add("hidden");
        return;
    }
    journeyServicesBarEl.classList.remove("hidden");
    if (multiServiceCountEl) {
        multiServiceCountEl.textContent = `${selectedServices.length} services`;
    }
    for (const name of selectedServices) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `endpoint-chip${name === serviceSelect.value ? " active" : ""}`;
        button.textContent = shortServiceName(name);
        button.title = name;
        button.addEventListener("click", () => focusService(name));
        serviceFocusListEl.appendChild(button);
    }
}

function showServiceMetrics(metrics, traces) {
    metricsCache = metrics;
    selectedEndpoint = "";
    renderStats(metrics);
    renderCharts(metrics);
    renderServiceFocusChips();
    if (activePinnedTracesPinId && serviceSelect.value) {
        loadTraces("");
        return;
    }
    tracesCache = traces && Array.isArray(traces.items) ? traces : { items: [], count: 0 };
    if (tracesCache.items.length) {
        renderTraces(tracesCache, "");
    } else {
        loadTraces("");
    }
}

function focusService(name) {
    if (!selectedServices.includes(name)) {
        return;
    }
    selectedServices = [name, ...selectedServices.filter((item) => item !== name)];
    syncPrimaryService();
    updateServiceMenuButton();
    const found = multiMetricsCache.find((row) => row.service === name);
    if (!found) {
        return;
    }
    showServiceMetrics(found.metrics, tracesByServiceCache[name]);
}

function renderLatency(latency, endpointName) {
    const labels = (latency.timestamps || []).map(formatAxisTimestampIST);
    const seriesLabel = endpointName ? endpointLabel(endpointName) : "Overall";

    destroyChart(latencyChart);
    latencyChart = new Chart(document.getElementById("latencyChart"), {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "P50 (ms)",
                    data: latency.p50 || [],
                    borderColor: "#64b5f6",
                    backgroundColor: "transparent",
                    tension: 0.15,
                },
                {
                    label: "P90 (ms)",
                    data: latency.p90 || [],
                    borderColor: "#ba68c8",
                    backgroundColor: "transparent",
                    tension: 0.15,
                },
                {
                    label: "P95 (ms)",
                    data: latency.p95 || [],
                    borderColor: "#ef5350",
                    backgroundColor: "transparent",
                    tension: 0.15,
                },
            ],
        },
        options: latencyChartOptions(labels.length),
    });
    renderChartLegendPills(latencyChart, document.getElementById("latencyLegend"));

    latencyTitleEl.textContent = "Response Time (p50 / p90 / p95)";
    latencyScopeEl.textContent = seriesLabel;
    latencyScopeEl.title = endpointName || "Overall";
}

function renderThroughput(throughput, endpointName) {
    const labels = (throughput.timestamps || []).map(formatAxisTimestampIST);
    const seriesLabel = endpointName ? endpointLabel(endpointName) : "Overall";

    destroyChart(throughputChart);
    throughputChart = new Chart(document.getElementById("throughputChart"), {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: endpointName ? `${seriesLabel} RPM` : "Throughput RPM",
                    data: throughput.rpm || [],
                    borderColor: "#58d1c9",
                    backgroundColor: "rgba(88, 209, 201, 0.2)",
                    fill: true,
                    tension: 0.15,
                    pointRadius: 0,
                    borderWidth: 2,
                },
            ],
        },
        options: getChartOptions(labels.length),
    });
    renderChartLegendPills(throughputChart, document.getElementById("throughputLegend"));

    throughputTitleEl.textContent = "Throughput (RPM)";
    throughputScopeEl.textContent = seriesLabel;
    throughputScopeEl.title = endpointName || "Overall";
    throughputChartScopeEl.textContent = seriesLabel;
    throughputChartScopeEl.title = endpointName || "Overall";
    renderRpmStats(throughput);
}

function renderEndpointList(endpoints) {
    endpointListEl.innerHTML = "";
    const names = Array.isArray(endpoints) ? endpoints : [];

    const overall = document.createElement("button");
    overall.type = "button";
    overall.className = `endpoint-chip${selectedEndpoint ? "" : " active"}`;
    overall.textContent = "Overall";
    overall.addEventListener("click", () => selectEndpoint(""));
    endpointListEl.appendChild(overall);

    if (!names.length) {
        const empty = document.createElement("span");
        empty.className = "endpoint-empty";
        empty.textContent = "No endpoints in this range.";
        endpointListEl.appendChild(empty);
        return;
    }

    for (const name of names) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `endpoint-chip${selectedEndpoint === name ? " active" : ""}`;
        button.textContent = endpointLabel(name);
        button.title = name;
        button.addEventListener("click", () => selectEndpoint(name));
        endpointListEl.appendChild(button);
    }
}

function formatDurationMs(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return "--";
    }
    if (number >= 1000) {
        return `${(number / 1000).toFixed(2)} s`;
    }
    return `${number.toFixed(1)} ms`;
}

function renderTraces(payload, endpointName) {
    const items = Array.isArray(payload && payload.items) ? payload.items : [];
    const seriesLabel = endpointName ? endpointLabel(endpointName) : "Overall";
    tracesScopeEl.textContent = seriesLabel;
    tracesScopeEl.title = endpointName || "Overall";
    tracesTableBodyEl.innerHTML = "";
    if (!items.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 8;
        cell.textContent = "No transaction traces in this range.";
        row.appendChild(cell);
        tracesTableBodyEl.appendChild(row);
        tracesStatusEl.textContent = `No traces for ${seriesLabel} in the selected range.`;
        if (payload && payload.withBreakdown) {
            tracesStatusEl.textContent = `No traces with a span breakdown for ${seriesLabel} in the selected range.`;
        }
        resetTraceBreakdown();
        return;
    }

    for (const item of items) {
        const row = document.createElement("tr");
        row.classList.add("is-clickable");
        if (item.error) {
            row.classList.add("trace-error-row");
        }
        const traceKey = item.traceId || item.guid || "";
        if (traceKey && traceKey === selectedTraceId) {
            row.classList.add("is-selected");
        }
        const cells = [
            formatTimestampIST(item.timestamp) || "--",
            endpointLabel(item.name || endpointName || "Transaction"),
            formatDurationMs(item.durationMs),
            item.error ? `Error ${item.status || ""}`.trim() : (item.status || "OK"),
            item.uri || "--",
            item.host || "--",
            traceKey || "--",
        ];
        cells.forEach((value, index) => {
            const cell = document.createElement("td");
            cell.textContent = value;
            cell.title = value;
            if (index === 3 && item.error) {
                cell.className = "trace-error";
            }
            row.appendChild(cell);
        });
        const actionCell = document.createElement("td");
        const openBtn = document.createElement("button");
        openBtn.type = "button";
        openBtn.className = "trace-open-btn";
        openBtn.textContent = "Breakdown";
        openBtn.disabled = !traceKey;
        actionCell.appendChild(openBtn);
        row.appendChild(actionCell);
        const openBreakdown = (event) => {
            event.stopPropagation();
            if (!traceKey) {
                return;
            }
            loadTraceBreakdown(item);
        };
        row.addEventListener("click", openBreakdown);
        openBtn.addEventListener("click", openBreakdown);
        tracesTableBodyEl.appendChild(row);
    }
    tracesStatusEl.textContent = `Showing ${items.length} slowest traces for ${seriesLabel}. Click a row for span breakdown.`;
    if (payload && payload.withBreakdown) {
        tracesStatusEl.textContent = `Showing ${items.length} traces with span breakdown for ${seriesLabel}.`;
    }
}

function openTraceBreakdownModal() {
    if (!traceBreakdownEl) {
        return;
    }
    traceBreakdownEl.classList.remove("hidden");
    document.body.classList.add("modal-open");
}

function closeTraceBreakdownModal() {
    if (!traceBreakdownEl) {
        return;
    }
    traceBreakdownEl.classList.add("hidden");
    document.body.classList.remove("modal-open");
}

function resetTraceBreakdown() {
    selectedTraceId = "";
    closeTraceBreakdownModal();
    if (traceBreakdownIdEl) {
        traceBreakdownIdEl.textContent = "Select a trace";
    }
    if (traceBreakdownStatusEl) {
        traceBreakdownStatusEl.textContent = "Click a trace row to load its span breakdown.";
    }
    if (traceBreakdownBodyEl) {
        traceBreakdownBodyEl.innerHTML = "";
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 7;
        cell.textContent = "No breakdown loaded.";
        row.appendChild(cell);
        traceBreakdownBodyEl.appendChild(row);
    }
}

function formatSpanLabel(name) {
    const full = String(name || "span");
    const parts = full.split(/[./]/).filter(Boolean);
    if (parts.length <= 2) {
        return { short: full, rest: "" };
    }
    return {
        short: parts.slice(-2).join("."),
        rest: parts.slice(0, -2).join("."),
    };
}

function renderTraceBreakdown(payload) {
    const items = Array.isArray(payload && payload.items) ? payload.items : [];
    const maxDuration = Math.max(...items.map((item) => Number(item.durationMs) || 0), 1);
    traceBreakdownBodyEl.innerHTML = "";
    if (!items.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 7;
        cell.textContent = "No spans found for this trace.";
        row.appendChild(cell);
        traceBreakdownBodyEl.appendChild(row);
        traceBreakdownStatusEl.textContent = "No Span events were returned for this trace ID.";
        return;
    }
    for (const item of items) {
        const duration = Number(item.durationMs) || 0;
        const share = Math.round((duration / maxDuration) * 100);
        const label = formatSpanLabel(item.name);
        const indent = `${Math.min(Number(item.depth) || 0, 8) * 20}px`;
        const row = document.createElement("tr");

        const nameCell = document.createElement("td");
        const nameWrap = document.createElement("div");
        nameWrap.style.paddingLeft = indent;
        const name = document.createElement("div");
        name.className = "breakdown-span";
        name.textContent = label.short;
        name.title = item.name || "span";
        nameWrap.appendChild(name);
        if (label.rest) {
            const rest = document.createElement("div");
            rest.className = "breakdown-span-sub";
            rest.textContent = label.rest;
            rest.title = item.name || "";
            nameWrap.appendChild(rest);
        }
        nameCell.appendChild(nameWrap);

        const durationCell = document.createElement("td");
        durationCell.className = "breakdown-duration";
        durationCell.textContent = formatDurationMs(item.durationMs);
        const shareCell = document.createElement("td");
        shareCell.className = "breakdown-share";
        shareCell.textContent = `${share}%`;

        const timelineCell = document.createElement("td");
        const track = document.createElement("div");
        track.className = "breakdown-bar-track";
        const bar = document.createElement("span");
        bar.className = "breakdown-bar";
        bar.style.width = `${Math.max(6, share)}%`;
        track.appendChild(bar);
        timelineCell.appendChild(track);

        const serviceCell = document.createElement("td");
        serviceCell.className = "breakdown-muted";
        serviceCell.textContent = item.service || "--";
        serviceCell.title = item.service || "";
        const kindCell = document.createElement("td");
        kindCell.className = "breakdown-muted";
        kindCell.textContent = item.kind || "--";
        const detailCell = document.createElement("td");
        const detail = item.db || item.uri || "--";
        detailCell.className = "breakdown-muted";
        detailCell.textContent = detail;
        detailCell.title = detail;
        if (item.error) {
            durationCell.classList.add("trace-error");
            row.classList.add("trace-error-row");
        }
        row.append(nameCell, durationCell, shareCell, timelineCell, serviceCell, kindCell, detailCell);
        traceBreakdownBodyEl.appendChild(row);
    }
    traceBreakdownStatusEl.textContent = `Showing ${items.length} spans, nested by parent span.`;
}

async function loadTraceBreakdown(item) {
    const traceId = (item && (item.traceId || item.guid)) || "";
    if (!traceId) {
        tracesStatusEl.textContent = "This row has no trace ID, so a breakdown cannot be loaded.";
        return;
    }
    selectedTraceId = traceId;
    tracesTableBodyEl.querySelectorAll("tr").forEach((row) => {
        row.classList.toggle("is-selected", row.querySelector("td:nth-child(7)")?.textContent === traceId);
    });
    openTraceBreakdownModal();
    traceBreakdownIdEl.textContent = traceId;
    const cached = findCachedTrace(traceId)
        || (Array.isArray(item.spans) && item.spans.length ? item : null);
    if (cached && Array.isArray(cached.spans) && cached.spans.length) {
        renderTraceBreakdown({ items: cached.spans, traceId });
        return;
    }
    if (activePinnedTracesPinId) {
        traceBreakdownStatusEl.textContent = "No saved span breakdown for this trace.";
        traceBreakdownBodyEl.innerHTML = "";
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 7;
        cell.textContent = "This trace was saved without span data.";
        row.appendChild(cell);
        traceBreakdownBodyEl.appendChild(row);
        return;
    }
    traceBreakdownStatusEl.textContent = "Loading span breakdown...";
    try {
        const range = getRange();
        const response = await fetch("/api/trace-breakdown", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                service: serviceSelect.value,
                start_time: range.start_time,
                end_time: range.end_time,
                traceId,
                guid: item.guid || null,
            }),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail));
        }
        renderTraceBreakdown(data);
        if (Array.isArray(data.items)) {
            storeTraceSpans(traceId, data.items);
        }
    } catch (error) {
        traceBreakdownStatusEl.textContent = `Breakdown error: ${error.message}`;
        traceBreakdownBodyEl.innerHTML = "";
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 7;
        cell.textContent = "Could not load span breakdown.";
        row.appendChild(cell);
        traceBreakdownBodyEl.appendChild(row);
    }
}

async function loadTraces(endpointName = selectedEndpoint) {
    if (!serviceSelect.value) {
        return;
    }
    const requestId = ++tracesRequestId;
    const seriesLabel = endpointName ? endpointLabel(endpointName) : "Overall";
    tracesScopeEl.textContent = seriesLabel;
    tracesStatusEl.textContent = tracesBreakdownFilterEl && tracesBreakdownFilterEl.checked
        ? "Loading traces with span breakdown..."
        : "Loading traces...";
    resetTraceBreakdown();
    if (activePinnedTracesPinId) {
        const saved = resolveTracesForEndpoint(serviceSelect.value, endpointName);
        if (saved) {
            const data = applyTracesBreakdownFilter(saved);
            if (requestId !== tracesRequestId) {
                return;
            }
            renderTraces(data, endpointName);
            tracesCache = data;
            const savedNote = "Loaded from saved test.";
            if (data.withBreakdown || (tracesBreakdownFilterEl && tracesBreakdownFilterEl.checked)) {
                tracesStatusEl.textContent = `Showing ${data.count || 0} traces with span breakdown for ${seriesLabel}. ${savedNote}`;
            } else {
                tracesStatusEl.textContent = `Showing ${data.count || 0} slowest traces for ${seriesLabel}. ${savedNote}`;
            }
            return;
        }
    }
    try {
        const range = getRange();
        const response = await fetch("/api/traces", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                service: serviceSelect.value,
                start_time: range.start_time,
                end_time: range.end_time,
                endpoint: endpointName || null,
                withBreakdown: Boolean(tracesBreakdownFilterEl && tracesBreakdownFilterEl.checked),
            }),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail));
        }
        if (requestId !== tracesRequestId) {
            return;
        }
        renderTraces(data, endpointName);
        tracesCache = data;
    } catch (error) {
        if (requestId !== tracesRequestId) {
            return;
        }
        tracesTableBodyEl.innerHTML = "";
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 8;
        cell.textContent = "Could not load traces.";
        row.appendChild(cell);
        tracesTableBodyEl.appendChild(row);
        tracesStatusEl.textContent = `Traces error: ${error.message}`;
    }
}

function pulseServicePanel() {
    const panel = document.getElementById("servicePanel");
    if (!panel) {
        return;
    }
    panel.classList.remove("is-refreshing");
    void panel.offsetWidth;
    panel.classList.add("is-refreshing");
}

function setEndpointButtonsDisabled(disabled) {
    endpointListEl.querySelectorAll("button").forEach((button) => {
        button.disabled = disabled;
    });
}

async function selectEndpoint(name) {
    if (!metricsCache || name === selectedEndpoint) {
        return;
    }

    if (!name) {
        selectedEndpoint = "";
        renderEndpointList(metricsCache.endpoints || []);
        const overall = resolveEndpointMetrics(serviceSelect.value, "") || {
            throughput: metricsCache.throughput || {},
            response_time_ms: metricsCache.response_time_ms || {},
        };
        renderLatency(overall.response_time_ms || {}, "");
        renderThroughput(overall.throughput || {}, "");
        pulseServicePanel();
        loadTraces("");
        return;
    }

    if (activePinnedTracesPinId) {
        const saved = resolveEndpointMetrics(serviceSelect.value, name);
        if (saved) {
            selectedEndpoint = name;
            renderEndpointList(metricsCache.endpoints || []);
            renderLatency(saved.response_time_ms || {}, name);
            renderThroughput(saved.throughput || {}, name);
            pulseServicePanel();
            loadTraces(name);
            return;
        }
    }

    const requestId = ++endpointRequestId;
    selectedEndpoint = name;
    renderEndpointList(metricsCache.endpoints || []);
    setEndpointButtonsDisabled(true);
    throughputScopeEl.textContent = "Loading...";

    try {
        const range = getRange();
        const slice = await fetchEndpointMetricsSlice(
            serviceSelect.value,
            range.start_time,
            range.end_time,
            name,
        );
        if (requestId !== endpointRequestId) {
            return;
        }
        renderLatency(slice.response_time_ms || {}, name);
        renderThroughput(slice.throughput || {}, name);
        pulseServicePanel();
        loadTraces(name);
    } catch (error) {
        if (requestId !== endpointRequestId) {
            return;
        }
        selectedEndpoint = "";
        renderEndpointList(metricsCache.endpoints || []);
        renderLatency(metricsCache.response_time_ms || {}, "");
        renderThroughput(metricsCache.throughput || {}, "");
        analysisBox.textContent = `Endpoint metrics error: ${error.message}`;
    } finally {
        if (requestId === endpointRequestId) {
            setEndpointButtonsDisabled(false);
        }
    }
}

async function analyze(question = "") {
    if (!metricsCache) {
        return;
    }

    const selectedModel = analysisModelSelect ? analysisModelSelect.value.trim() : "";
    const history = analysisConversation
        .slice(-12)
        .map((entry) => ({
            role: String(entry.role || ""),
            content: String(entry.content || ""),
        }))
        .filter((entry) => (entry.role === "user" || entry.role === "assistant") && entry.content);
    if (question && history.length) {
        const last = history[history.length - 1];
        if (last.role === "user" && last.content === question) {
            history.pop();
        }
    }
    const includeTraces = Boolean(analysisIncludeTracesEl && analysisIncludeTracesEl.checked);
    const traces = includeTraces ? await collectTraceContext() : null;
    const payload = {
        service: serviceSelect.value,
        metrics: metricsCache,
        question: question || null,
        model: selectedModel || null,
        history,
        session: analysisSessionId || "new",
        includeTraces,
        traces,
    };

    const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail));
    }
    if (typeof data.session_id === "string" && data.session_id.trim()) {
        analysisSessionId = data.session_id.trim();
        localStorage.setItem(ANALYSIS_SESSION_KEY, analysisSessionId);
    }
    return data.analysis;
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function inlineMarkdown(text) {
    return text
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function normalizeAnalysisText(text) {
    let value = String(text || "").replace(/\r\n/g, "\n").trim();
    if (!value.includes("\n") && (value.match(/ \- /g) || []).length >= 2) {
        value = value.replace(/ \- /g, "\n- ");
        if (!value.startsWith("- ")) {
            value = `- ${value}`;
        }
    }
    return value;
}

function renderMarkdown(text) {
    const lines = escapeHtml(normalizeAnalysisText(text)).split("\n");
    const html = [];
    let inList = false;
    for (const line of lines) {
        const heading = line.match(/^(#{1,3})\s+(.+)$/);
        const bullet = line.match(/^[-*]\s+(.+)$/);
        if (heading) {
            if (inList) {
                html.push("</ul>");
                inList = false;
            }
            const level = heading[1].length;
            html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
            continue;
        }
        if (bullet) {
            if (!inList) {
                html.push("<ul>");
                inList = true;
            }
            html.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
            continue;
        }
        if (!line.trim()) {
            if (inList) {
                html.push("</ul>");
                inList = false;
            }
            continue;
        }
        if (inList) {
            html.push("</ul>");
            inList = false;
        }
        html.push(`<p>${inlineMarkdown(line)}</p>`);
    }
    if (inList) {
        html.push("</ul>");
    }
    return html.join("") || "<p></p>";
}

function renderConversation() {
    askResponses.innerHTML = "";
    if (!analysisConversation.length) {
        const empty = document.createElement("div");
        empty.className = "chat-empty";
        empty.textContent = "Run AI Analysis or ask a question about CPU, HPA, latency, throughput, or traces.";
        askResponses.appendChild(empty);
        return;
    }
    for (const entry of analysisConversation) {
        const item = document.createElement("div");
        item.className = `response-item ${entry.role}${entry.pending ? " pending" : ""}`;

        const meta = document.createElement("div");
        meta.className = "response-meta";
        const avatar = document.createElement("span");
        avatar.className = "response-avatar";
        avatar.textContent = entry.role === "user" ? "Y" : "AI";
        const role = document.createElement("div");
        role.className = "response-q";
        role.textContent = entry.role === "user" ? "You" : "Assistant";
        meta.append(avatar, role);

        const content = document.createElement("div");
        content.className = "response-a";
        if (entry.role === "assistant") {
            content.innerHTML = renderMarkdown(entry.content);
        } else {
            content.textContent = entry.content;
        }

        item.append(meta, content);
        askResponses.appendChild(item);
    }
    askResponses.scrollTop = askResponses.scrollHeight;
}

function currentMetricRange() {
    if (metricsCache && metricsCache.time_range) {
        return {
            start_time: metricsCache.time_range.start_time,
            end_time: metricsCache.time_range.end_time,
        };
    }
    return getRange();
}

function normalizeServiceMetricsBundle(metrics) {
    if (!metrics || typeof metrics !== "object") {
        return null;
    }
    const byEndpoint = metrics.byEndpoint && typeof metrics.byEndpoint === "object"
        ? { ...metrics.byEndpoint }
        : {};
    if (!byEndpoint[""]) {
        byEndpoint[""] = {
            throughput: metrics.throughput || {},
            response_time_ms: metrics.response_time_ms || {},
        };
    }
    return { ...metrics, byEndpoint };
}

function getServiceMetricsBundle(service) {
    const row = multiMetricsCache.find((entry) => entry.service === service);
    if (row?.metrics) {
        return row.metrics;
    }
    if (service === serviceSelect.value && metricsCache) {
        return metricsCache;
    }
    return null;
}

function resolveEndpointMetrics(service, endpointName) {
    const metrics = normalizeServiceMetricsBundle(getServiceMetricsBundle(service));
    if (!metrics) {
        return null;
    }
    const key = endpointName || "";
    return metrics.byEndpoint[key] || null;
}

async function fetchEndpointMetricsSlice(service, startTime, endTime, endpoint) {
    const response = await fetch("/api/throughput", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            service,
            start_time: startTime,
            end_time: endTime,
            endpoint: endpoint || null,
        }),
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail));
    }
    const { response_time_ms, ...throughput } = data;
    return {
        throughput,
        response_time_ms: response_time_ms || {},
    };
}

async function collectServiceMetricsForPin(service, range, baseMetrics) {
    const endpoints = Array.isArray(baseMetrics?.endpoints) ? baseMetrics.endpoints : [];
    const normalized = normalizeServiceMetricsBundle(baseMetrics);
    const byEndpoint = { ...(normalized?.byEndpoint || {}) };
    if (!byEndpoint[""]?.throughput?.timestamps?.length) {
        byEndpoint[""] = {
            throughput: baseMetrics.throughput || {},
            response_time_ms: baseMetrics.response_time_ms || {},
        };
    }
    for (const endpoint of endpoints) {
        if (!endpoint) {
            continue;
        }
        const existing = byEndpoint[endpoint];
        const hasSeries = Array.isArray(existing?.throughput?.timestamps) && existing.throughput.timestamps.length;
        if (!hasSeries) {
            byEndpoint[endpoint] = await fetchEndpointMetricsSlice(
                service,
                range.start_time,
                range.end_time,
                endpoint,
            );
        }
    }
    return { ...baseMetrics, byEndpoint };
}

function endpointTraceKey(endpointName) {
    return endpointName || "";
}

function normalizeServiceTracesBundle(bundle) {
    if (!bundle || typeof bundle !== "object") {
        return { items: [], count: 0, withBreakdown: true, byEndpoint: {} };
    }
    const byEndpoint = bundle.byEndpoint && typeof bundle.byEndpoint === "object"
        ? { ...bundle.byEndpoint }
        : {};
    if (!byEndpoint[""] && Array.isArray(bundle.items)) {
        byEndpoint[""] = {
            items: bundle.items,
            count: bundle.count ?? bundle.items.length,
            withBreakdown: Boolean(bundle.withBreakdown),
            endpoint: null,
        };
    }
    const overall = byEndpoint[""] || { items: [], count: 0, withBreakdown: true, endpoint: null };
    return {
        ...overall,
        items: overall.items || [],
        count: overall.count ?? (overall.items || []).length,
        withBreakdown: Boolean(overall.withBreakdown ?? bundle.withBreakdown),
        byEndpoint,
    };
}

function resolveTracesForEndpoint(service, endpointName) {
    const bundle = tracesByServiceCache[service];
    if (!bundle) {
        return null;
    }
    const normalized = normalizeServiceTracesBundle(bundle);
    const key = endpointTraceKey(endpointName);
    if (normalized.byEndpoint[key]) {
        return normalized.byEndpoint[key];
    }
    if (!endpointName) {
        return normalized;
    }
    return null;
}

function applyTracesBreakdownFilter(payload) {
    if (!payload) {
        return payload;
    }
    if (!tracesBreakdownFilterEl || !tracesBreakdownFilterEl.checked) {
        return payload;
    }
    const items = (Array.isArray(payload.items) ? payload.items : []).filter(
        (item) => Array.isArray(item.spans) && item.spans.length > 0,
    );
    return {
        ...payload,
        items,
        count: items.length,
        withBreakdown: true,
    };
}

function mergeTraceSpansIntoPayload(payload, traceId, spans) {
    if (!payload || !Array.isArray(payload.items)) {
        return payload;
    }
    const items = payload.items.map((item) => {
        if ((item.traceId || item.guid) === traceId) {
            return { ...item, spans };
        }
        return item;
    });
    return { ...payload, items, count: items.length };
}

function storeTraceSpansInServiceCache(service, endpointName, traceId, spans) {
    const bundle = tracesByServiceCache[service];
    if (!bundle) {
        return;
    }
    const normalized = normalizeServiceTracesBundle(bundle);
    const key = endpointTraceKey(endpointName);
    const keysToUpdate = new Set([key, ""]);
    if (normalized.byEndpoint) {
        for (const endpointKey of Object.keys(normalized.byEndpoint)) {
            const slice = normalized.byEndpoint[endpointKey];
            if (slice?.items?.some((item) => (item.traceId || item.guid) === traceId)) {
                keysToUpdate.add(endpointKey);
            }
        }
    }
    for (const endpointKey of keysToUpdate) {
        if (!normalized.byEndpoint[endpointKey]) {
            continue;
        }
        normalized.byEndpoint[endpointKey] = mergeTraceSpansIntoPayload(
            normalized.byEndpoint[endpointKey],
            traceId,
            spans,
        );
    }
    const overall = normalized.byEndpoint[""] || normalized;
    tracesByServiceCache[service] = {
        ...overall,
        items: overall.items || [],
        count: overall.count ?? (overall.items || []).length,
        byEndpoint: normalized.byEndpoint,
    };
}

function findCachedTrace(traceId) {
    const items = tracesCache && Array.isArray(tracesCache.items) ? tracesCache.items : [];
    const hit = items.find((item) => (item.traceId || item.guid) === traceId);
    if (hit) {
        return hit;
    }
    const service = serviceSelect.value;
    if (!service) {
        return null;
    }
    const bundle = resolveTracesForEndpoint(service, selectedEndpoint)
        || resolveTracesForEndpoint(service, "");
    const pool = bundle && Array.isArray(bundle.items) ? bundle.items : [];
    return pool.find((item) => (item.traceId || item.guid) === traceId) || null;
}

function storeTraceSpans(traceId, spans) {
    if (!tracesCache || !Array.isArray(tracesCache.items)) {
        tracesCache = { items: [], count: 0 };
    }
    tracesCache = mergeTraceSpansIntoPayload(tracesCache, traceId, spans);
    if (serviceSelect.value) {
        storeTraceSpansInServiceCache(serviceSelect.value, selectedEndpoint, traceId, spans);
    }
}

async function fetchSpanBreakdown(item, range, service) {
    const traceId = (item && (item.traceId || item.guid)) || "";
    if (!traceId) {
        return [];
    }
    const response = await fetch("/api/trace-breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            service,
            start_time: range.start_time,
            end_time: range.end_time,
            traceId,
            guid: item.guid || null,
        }),
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail));
    }
    return Array.isArray(data.items) ? data.items : [];
}

async function attachSpanBreakdowns(items, range, service) {
    return Promise.all(
        (Array.isArray(items) ? items : []).map(async (item) => {
            if (Array.isArray(item.spans) && item.spans.length) {
                return item;
            }
            try {
                const spans = await fetchSpanBreakdown(item, range, service);
                return { ...item, spans };
            } catch (_error) {
                return { ...item, spans: Array.isArray(item.spans) ? item.spans : [] };
            }
        }),
    );
}

async function collectTracesSliceForPin(service, range, endpointName, metrics) {
    const existing = resolveTracesForEndpoint(service, endpointName);
    const hasSavedSpans = existing
        && Array.isArray(existing.items)
        && existing.items.length
        && existing.items.every((item) => Array.isArray(item.spans) && item.spans.length);
    if (hasSavedSpans) {
        return {
            ...existing,
            endpoint: endpointName || null,
            withBreakdown: true,
        };
    }
    const base = await fetchTracesPayload(
        service,
        range.start_time,
        range.end_time,
        true,
        endpointName || null,
    );
    const items = await attachSpanBreakdowns(base.items || [], range, service);
    return {
        ...base,
        endpoint: endpointName || null,
        items,
        count: items.length,
        withBreakdown: true,
    };
}

async function collectServiceTracesForPin(service, range, metrics) {
    const endpoints = Array.isArray(metrics?.endpoints) ? metrics.endpoints : [];
    const overall = await collectTracesSliceForPin(service, range, "", metrics);
    const byEndpoint = { "": overall };
    for (const endpoint of endpoints) {
        if (!endpoint) {
            continue;
        }
        byEndpoint[endpoint] = await collectTracesSliceForPin(service, range, endpoint, metrics);
    }
    return {
        ...overall,
        byEndpoint,
    };
}

async function collectTracesForPin() {
    const range = currentMetricRange();
    const names = selectedServices.length ? selectedServices : [serviceSelect.value];
    const metricsLookup = Object.fromEntries(
        (multiMetricsCache.length ? multiMetricsCache : [{ service: serviceSelect.value, metrics: metricsCache }])
            .filter((row) => row.service && row.metrics)
            .map((row) => [row.service, row.metrics]),
    );
    const byService = {};
    for (const service of names) {
        if (!service) {
            continue;
        }
        byService[service] = await collectServiceTracesForPin(
            service,
            range,
            metricsLookup[service] || metricsCache,
        );
    }
    tracesByServiceCache = byService;
    const focused = serviceSelect.value;
    const focusedSlice = resolveTracesForEndpoint(focused, selectedEndpoint)
        || resolveTracesForEndpoint(focused, "")
        || { items: [], count: 0 };
    tracesCache = focusedSlice;
    return {
        ...focusedSlice,
        byService,
    };
}

async function collectTraceContext() {
    const range = currentMetricRange();
    const traces = await collectTracesForPin();
    const items = Array.isArray(traces.items) ? traces.items.slice(0, 5) : [];
    return {
        count: traces.count || items.length,
        withBreakdown: true,
        error: traces.error || null,
        items: items.map((item) => ({
            timestamp: item.timestamp,
            name: item.name,
            durationMs: item.durationMs,
            error: Boolean(item.error),
            uri: item.uri,
            host: item.host,
            traceId: item.traceId || item.guid || "",
            spans: (Array.isArray(item.spans) ? item.spans : []).slice(0, 20).map((span) => ({
                name: span.name,
                durationMs: span.durationMs,
                service: span.service,
                kind: span.kind,
                depth: span.depth,
                error: Boolean(span.error),
            })),
        })),
    };
}

function resetAnalysisSession() {
    analysisSessionId = null;
    localStorage.removeItem(ANALYSIS_SESSION_KEY);
}

async function fetchMetrics() {
    try {
        if (!projectSelect.value) {
            throw new Error("Create or select a project first.");
        }
        if (!testNameInput.value.trim()) {
            testNameInput.focus();
            throw new Error("Enter a test name before fetching metrics.");
        }
        fetchBtn.disabled = true;
        analyzeBtn.disabled = true;
        fetchBtn.textContent = "Loading...";
        analysisBox.textContent = "Fetching metrics...";

        const range = getRange();
        const services = getSelectedServices();
        if (!services.length) {
            throw new Error("Select at least one service.");
        }
        activePinnedTracesPinId = null;
        if (services.length === 1) {
            const data = await fetchMetricsPayload(services[0], range.start_time, range.end_time);
            tracesByServiceCache = {};
            multiMetricsCache = [{ service: services[0], metrics: data }];
            showServiceMetrics(data, null);
        } else {
            analysisBox.textContent = `Fetching metrics for ${services.length} services...`;
            const settled = await Promise.allSettled(
                services.map((service) => fetchMetricsPayload(service, range.start_time, range.end_time)),
            );
            const rows = [];
            settled.forEach((result, index) => {
                if (result.status === "fulfilled") {
                    rows.push({ service: services[index], metrics: result.value });
                }
            });
            if (!rows.length) {
                throw new Error("Could not fetch metrics for the selected services.");
            }
            multiMetricsCache = rows;
            tracesByServiceCache = {};
            tracesCache = null;
            selectedServices = rows.map((row) => row.service);
            syncPrimaryService();
            updateServiceMenuButton();
            showServiceMetrics(rows[0].metrics, null);
        }
        analysisConversation = [];
        resetAnalysisSession();
        renderConversation();
        askInput.value = "";
        analysisBox.textContent = "Metrics loaded. Click 'Run AI Analysis' to generate insights.";
        analyzeBtn.disabled = false;
        pinBtn.disabled = false;
    } catch (error) {
        analysisBox.textContent = `Error: ${error.message}`;
    } finally {
        fetchBtn.disabled = false;
        fetchBtn.textContent = "Fetch Metrics";
    }
}

async function runAiAnalysis() {
    if (!metricsCache) {
        analysisBox.textContent = "Fetch metrics first, then run AI analysis.";
        return;
    }

    analyzeBtn.disabled = true;
    const includeTraces = Boolean(analysisIncludeTracesEl && analysisIncludeTracesEl.checked);
    try {
        analysisBox.textContent = includeTraces
            ? "Collecting traces with breakdowns, then generating analysis..."
            : "Generating AI analysis...";
        const autoAnalysis = await analyze();
        analysisConversation = [];
        if (autoAnalysis) {
            analysisConversation.push({ role: "assistant", content: autoAnalysis });
            renderConversation();
            analysisBox.textContent = "Analysis ready. Ask follow-up questions below.";
        } else {
            analysisBox.textContent = "No analysis returned.";
        }
    } catch (error) {
        analysisBox.textContent = `Analysis error: ${error.message}`;
    } finally {
        analyzeBtn.disabled = false;
    }
}

async function buildPinPayload() {
    const absolute = savedAbsoluteRange();
    applyAbsoluteRange(absolute.start, absolute.end);
    const savedAtIST = new Date().toLocaleString(IST_LOCALE, {
        timeZone: IST_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
    let traces = tracesCache || { items: [], count: 0 };
    try {
        traces = await collectTracesForPin();
    } catch (_error) {
        traces = tracesCache || traces;
    }
    const metricRange = currentMetricRange();
    const metricRows = multiMetricsCache.length
        ? multiMetricsCache
        : [{ service: serviceSelect.value, metrics: metricsCache }];
    const metricsByService = {};
    for (const row of metricRows) {
        if (!row.service || !row.metrics) {
            continue;
        }
        metricsByService[row.service] = await collectServiceMetricsForPin(
            row.service,
            metricRange,
            row.metrics,
        );
    }
    const primaryMetrics = metricsByService[serviceSelect.value] || metricsCache;
    if (primaryMetrics) {
        metricsCache = primaryMetrics;
    }
    multiMetricsCache = Object.entries(metricsByService).map(([service, metrics]) => ({
        service,
        metrics,
    }));
    return {
        projectId: projectSelect.value,
        testName: testNameInput.value.trim(),
        service: serviceSelect.value,
        rangePreset: "custom",
        rangeLabel: rangeLabel.textContent,
        startTimeInput: startTimeInput.value || null,
        endTimeInput: endTimeInput.value || null,
        startTime: absolute.start.toISOString(),
        endTime: absolute.end.toISOString(),
        metrics: primaryMetrics || metricsCache,
        analysis: analysisBox.textContent || "",
        analysisConversation,
        analysisSessionId,
        model: analysisModelSelect ? analysisModelSelect.value || null : null,
        savedAtIST,
        traces,
        services: selectedServices,
        metricsByService,
        tracesByService: traces.byService || tracesByServiceCache || {},
    };
}

async function pinCurrentResult() {
    if (!metricsCache) {
        analysisBox.textContent = "Fetch metrics first, then save the test.";
        return;
    }
    if (!projectSelect.value || !testNameInput.value.trim()) {
        analysisBox.textContent = "Select a project and enter a test name.";
        return;
    }

    try {
        pinBtn.disabled = true;
        analysisBox.textContent = "Saving traces and breakdowns with this test...";
        const item = await buildPinPayload();
        const response = await fetch("/api/pins", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail));
        }

        await loadProjects(projectSelect.value);
        if (data.id) {
            pinnedSelect.value = data.id;
            activePinnedTracesPinId = data.id;
        }
        analysisBox.textContent = "Test saved with traces and breakdowns.";
    } catch (error) {
        analysisBox.textContent = `Save test error: ${error.message}`;
    } finally {
        pinBtn.disabled = false;
    }
}

async function saveToCurrentPin() {
    if (!metricsCache) {
        analysisBox.textContent = "Fetch or load a test first.";
        return;
    }
    const pinId = pinnedSelect.value;
    if (!pinId) {
        analysisBox.textContent = "Select a saved test first.";
        return;
    }

    try {
        savePinBtn.disabled = true;
        analysisBox.textContent = "Updating test with traces and breakdowns...";
        const payload = await buildPinPayload();
        const response = await fetch(`/api/pins/${encodeURIComponent(pinId)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail));
        }
        await loadProjects(projectSelect.value);
        pinnedSelect.value = pinId;
        analysisBox.textContent = "Test, traces, and conversation updated.";
    } catch (error) {
        analysisBox.textContent = `Update test error: ${error.message}`;
    } finally {
        savePinBtn.disabled = false;
    }
}

async function loadPinnedResult() {
    const selectedId = pinnedSelect.value;
    if (!selectedId) return;

    let item;
    try {
        const response = await fetch(`/api/pins/${encodeURIComponent(selectedId)}`);
        const data = await response.json();
        if (!response.ok) {
            throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail));
        }
        item = data;
    } catch (error) {
        analysisBox.textContent = `Load pin error: ${error.message}`;
        return;
    }

    const services = Array.isArray(item.services) && item.services.length
        ? item.services
        : [item.service];
    setSelectedServices(services);
    if (item.projectId) {
        projectSelect.value = item.projectId;
    }
    testNameInput.value = item.testName || "";
    rangePreset.value = item.rangePreset || "custom";
    startTimeInput.value = item.startTimeInput || "";
    endTimeInput.value = item.endTimeInput || "";
    updateTimeRangeControls();

    const metricsByService = item.metricsByService && typeof item.metricsByService === "object"
        ? item.metricsByService
        : {};
    const rawTracesByService = item.tracesByService && typeof item.tracesByService === "object"
        ? item.tracesByService
        : (item.traces && item.traces.byService) || {};
    tracesByServiceCache = {};
    for (const [name, bundle] of Object.entries(rawTracesByService)) {
        tracesByServiceCache[name] = normalizeServiceTracesBundle(bundle);
    }
    if (!Object.keys(tracesByServiceCache).length && item.traces) {
        const legacyService = item.service || services[0];
        if (legacyService) {
            tracesByServiceCache[legacyService] = normalizeServiceTracesBundle(item.traces);
        }
    }
    activePinnedTracesPinId = selectedId;
    multiMetricsCache = services.map((name) => {
        const raw = metricsByService[name] || (name === item.service ? item.metrics : null);
        const metrics = normalizeServiceMetricsBundle(raw);
        return metrics ? { service: name, metrics } : null;
    }).filter(Boolean);
    const focused = multiMetricsCache.find((row) => row.service === item.service) || multiMetricsCache[0];
    if (focused) {
        showServiceMetrics(focused.metrics, tracesByServiceCache[focused.service] || item.traces);
        analysisBox.textContent =
            item.analysis || "Saved test loaded. Click 'Run AI Analysis' to refresh analysis.";
        analysisConversation = Array.isArray(item.analysisConversation) ? item.analysisConversation : [];
        if (typeof item.analysisSessionId === "string" && item.analysisSessionId.trim()) {
            analysisSessionId = item.analysisSessionId.trim();
            localStorage.setItem(ANALYSIS_SESSION_KEY, analysisSessionId);
        } else {
            resetAnalysisSession();
        }
        renderConversation();
        analyzeBtn.disabled = false;
        pinBtn.disabled = false;
        askInput.value = "";
    }
}

async function deletePinnedResult() {
    const selectedId = pinnedSelect.value;
    if (!selectedId) return;

    try {
        const response = await fetch(`/api/pins/${encodeURIComponent(selectedId)}`, {
            method: "DELETE",
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail));
        }

        await loadProjects(projectSelect.value);
        analysisBox.textContent = "Saved test deleted.";
    } catch (error) {
        analysisBox.textContent = `Delete test error: ${error.message}`;
    }
}

async function askQuestion() {
    const question = askInput.value.trim();
    if (!question) {
        return;
    }
    if (!metricsCache) {
        analysisBox.textContent = "Fetch metrics first before asking questions.";
        return;
    }

    askBtn.disabled = true;
    try {
        analysisConversation.push({ role: "user", content: question });
        const pendingIndex = analysisConversation.push({
            role: "assistant",
            content: "Thinking...",
            pending: true,
        }) - 1;
        renderConversation();
        askInput.value = "";
        const answer = await analyze(question);
        analysisConversation[pendingIndex] = {
            role: "assistant",
            content: answer || "No answer returned.",
        };
        renderConversation();
        analysisBox.textContent = "Conversation updated.";
    } catch (error) {
        const last = analysisConversation[analysisConversation.length - 1];
        if (last && last.role === "assistant" && last.pending) {
            analysisConversation.pop();
        }
        analysisConversation.push({
            role: "assistant",
            content: `I hit an error: ${error.message}`,
        });
        renderConversation();
        analysisBox.textContent = `Ask error: ${error.message}`;
    } finally {
        askBtn.disabled = false;
    }
}

function fillComparePinSelects() {
    const previousA = comparePinA.value;
    const previousB = comparePinB.value;
    const placeholder = pinnedResults.length
        ? "Select a saved test"
        : "No saved tests in this project";
    comparePinA.innerHTML = "";
    comparePinB.innerHTML = "";
    const emptyA = document.createElement("option");
    emptyA.value = "";
    emptyA.textContent = placeholder;
    comparePinA.appendChild(emptyA);
    comparePinB.appendChild(emptyA.cloneNode(true));
    for (const item of pinnedResults) {
        const optionA = document.createElement("option");
        optionA.value = item.id;
        optionA.textContent = formatPinnedLabel(item);
        comparePinA.appendChild(optionA);
        comparePinB.appendChild(optionA.cloneNode(true));
    }
    if (previousA && pinnedResults.some((item) => item.id === previousA)) {
        comparePinA.value = previousA;
    }
    if (previousB && pinnedResults.some((item) => item.id === previousB)) {
        comparePinB.value = previousB;
    } else if (pinnedResults.length > 1) {
        comparePinA.value = previousA || pinnedResults[0].id;
        comparePinB.value = pinnedResults[1].id;
    }
}

function fillRangePresetSelect(selectEl, selected = "now-1h") {
    selectEl.innerHTML = Object.entries(RANGE_LABELS)
        .map(([value, label]) => `<option value="${value}">${label}</option>`)
        .join("") + `<option value="custom">Custom</option>`;
    selectEl.value = selected;
}

function bindCompareRangeControls(presetEl, wrapEl, startEl, endEl) {
    const update = () => {
        const enabled = presetEl.value === "custom";
        wrapEl.classList.toggle("hidden", !enabled);
        startEl.disabled = !enabled;
        endEl.disabled = !enabled;
    };
    presetEl.addEventListener("change", update);
    update();
}

function getRangeFrom(presetEl, startEl, endEl) {
    if (presetEl.value !== "custom") {
        return {
            start_time: presetEl.value,
            end_time: "now",
        };
    }
    if (!startEl.value || !endEl.value) {
        throw new Error("Start and end time are required for custom range.");
    }
    const start = new Date(startEl.value);
    const end = new Date(endEl.value);
    if (start >= end) {
        throw new Error("'From' must be earlier than 'To'.");
    }
    return {
        start_time: start.toISOString(),
        end_time: end.toISOString(),
    };
}

function describeRange(presetEl, startEl, endEl) {
    if (presetEl.value === "custom") {
        if (startEl.value && endEl.value) {
            return `${formatDateTimeLocalForLabel(startEl.value)} to ${formatDateTimeLocalForLabel(endEl.value)}`;
        }
        return "Custom range";
    }
    return RANGE_LABELS[presetEl.value] || presetEl.value;
}

function showDashboardView(view) {
    const isCompare = view === "compare";
    monitorView.hidden = isCompare;
    compareView.hidden = !isCompare;
    monitorTabBtn.classList.toggle("is-active", !isCompare);
    compareTabBtn.classList.toggle("is-active", isCompare);
    monitorTabBtn.setAttribute("aria-selected", String(!isCompare));
    compareTabBtn.setAttribute("aria-selected", String(isCompare));
    requestAnimationFrame(() => {
        [cpuMemoryChart, hpaChart, latencyChart, throughputChart, ...Object.values(compareCharts)]
            .filter(Boolean)
            .forEach((chart) => chart.resize());
    });
}

function setCompareMode(mode) {
    const isSaved = mode === "saved";
    compareSavedModeBtn.classList.toggle("is-active", isSaved);
    compareRangeModeBtn.classList.toggle("is-active", !isSaved);
    compareSavedPanel.classList.toggle("hidden", !isSaved);
    compareRangePanel.classList.toggle("hidden", isSaved);
}

function average(values) {
    const nums = (values || []).map(Number).filter((value) => Number.isFinite(value));
    if (!nums.length) {
        return null;
    }
    return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function metricSummary(metrics) {
    const cpu = metrics.cpu_memory || {};
    const hpa = metrics.hpa_scaling || {};
    const throughput = metrics.throughput || {};
    const latency = metrics.response_time_ms || {};
    return {
        avgCpu: cpu.avg_cpu_percent,
        avgMem: cpu.avg_memory_percent,
        hpaCurrent: hpa.latest_current,
        hpaDesired: hpa.latest_desired,
        maxRpm: throughput.max_rpm,
        totalRpm: throughput.total_rpm,
        p50: average(latency.p50),
        p90: average(latency.p90),
        p95: average(latency.p95),
    };
}

function formatCompareNumber(value, digits = 2) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return "--";
    }
    return Number(value).toLocaleString("en-IN", { maximumFractionDigits: digits });
}

function formatCompareDelta(a, b, lowerIsBetter) {
    const left = Number(a);
    const right = Number(b);
    if (!Number.isFinite(left) || !Number.isFinite(right)) {
        return { text: "--", className: "" };
    }
    const delta = right - left;
    const pct = left !== 0 ? (delta / Math.abs(left)) * 100 : null;
    const sign = delta > 0 ? "+" : "";
    const pctText = pct === null ? "" : ` (${sign}${pct.toFixed(1)}%)`;
    let className = "";
    if (delta !== 0 && lowerIsBetter !== null) {
        const improved = lowerIsBetter ? delta < 0 : delta > 0;
        className = improved ? "compare-delta-better" : "compare-delta-worse";
    }
    return {
        text: `${sign}${delta.toLocaleString("en-IN", { maximumFractionDigits: 2 })}${pctText}`,
        className,
    };
}

function elapsedPoints(timestamps, values) {
    const points = [];
    const times = timestamps || [];
    const series = values || [];
    let origin = null;
    for (let i = 0; i < times.length; i += 1) {
        const stamp = new Date(times[i]).getTime();
        if (!Number.isFinite(stamp)) {
            continue;
        }
        if (origin === null) {
            origin = stamp;
        }
        const y = Number(series[i]);
        if (!Number.isFinite(y)) {
            continue;
        }
        points.push({ x: (stamp - origin) / 60000, y });
    }
    return points;
}

function overlayChartOptions(unit, pointCount = 0) {
    const options = getChartOptions(pointCount);
    const tickLimit = chartTickLimit(pointCount);
    options.scales = {
        ...options.scales,
        x: {
            type: "linear",
            title: {
                display: true,
                text: unit,
                color: "#64748b",
            },
            ticks: {
                color: "#64748b",
                autoSkip: true,
                maxTicksLimit: tickLimit,
            },
            grid: {
                color: "rgba(148, 163, 184, 0.22)",
            },
        },
    };
    options.plugins = {
        ...options.plugins,
        tooltip: {
            ...options.plugins.tooltip,
            callbacks: {
                ...(options.plugins.tooltip?.callbacks || {}),
                title(items) {
                    if (!items || !items.length) return "";
                    return `${Number(items[0].parsed.x).toFixed(1)} min from start`;
                },
            },
        },
    };
    return options;
}

function renderOverlayChart(canvasId, titleA, pointsA, titleB, pointsB, colorA, colorB, legendId) {
    destroyChart(compareCharts[canvasId]);
    compareCharts[canvasId] = new Chart(document.getElementById(canvasId), {
        type: "line",
        data: {
            datasets: [
                {
                    label: titleA,
                    data: pointsA,
                    borderColor: colorA,
                    backgroundColor: "transparent",
                    borderWidth: 2,
                    tension: 0.15,
                    pointRadius: 0,
                },
                {
                    label: titleB,
                    data: pointsB,
                    borderColor: colorB,
                    backgroundColor: "transparent",
                    borderWidth: 2,
                    tension: 0.15,
                    pointRadius: 0,
                    borderDash: [6, 4],
                },
            ],
        },
        options: overlayChartOptions("Minutes from start", Math.max(pointsA.length, pointsB.length)),
    });
    renderChartLegendPills(compareCharts[canvasId], document.getElementById(legendId));
}

function renderCompare(metricsA, metricsB, labelA, labelB, tracesA, tracesB) {
    const summaryA = metricSummary(metricsA);
    const summaryB = metricSummary(metricsB);
    const rows = [
        ["Avg CPU (%)", summaryA.avgCpu, summaryB.avgCpu, true, 2],
        ["Avg Memory (%)", summaryA.avgMem, summaryB.avgMem, true, 2],
        ["HPA current", summaryA.hpaCurrent, summaryB.hpaCurrent, null, 2],
        ["HPA desired", summaryA.hpaDesired, summaryB.hpaDesired, null, 2],
        ["Max RPM", summaryA.maxRpm, summaryB.maxRpm, false, 2],
        ["Total RPM", summaryA.totalRpm, summaryB.totalRpm, false, 0],
        ["Avg p50 (ms)", summaryA.p50, summaryB.p50, true, 2],
        ["Avg p90 (ms)", summaryA.p90, summaryB.p90, true, 2],
        ["Avg p95 (ms)", summaryA.p95, summaryB.p95, true, 2],
    ];
    if (tracesA || tracesB) {
        const statsA = summarizeTraces(tracesA);
        const statsB = summarizeTraces(tracesB);
        rows.push(
            ["Slowest traces", statsA.count, statsB.count, null, 0],
            ["Slowest duration (ms)", statsA.slowest, statsB.slowest, true, 1],
            ["Error traces", statsA.errors, statsB.errors, true, 0],
        );
    }

    compareTableBody.innerHTML = "";
    for (const [name, a, b, lowerIsBetter, digits] of rows) {
        const delta = formatCompareDelta(a, b, lowerIsBetter);
        const tr = document.createElement("tr");
        const metricCell = document.createElement("td");
        metricCell.textContent = name;
        const aCell = document.createElement("td");
        aCell.textContent = formatCompareNumber(a, digits);
        const bCell = document.createElement("td");
        bCell.textContent = formatCompareNumber(b, digits);
        const dCell = document.createElement("td");
        dCell.textContent = delta.text;
        if (delta.className) {
            dCell.className = delta.className;
        }
        tr.append(metricCell, aCell, bCell, dCell);
        compareTableBody.appendChild(tr);
    }

    compareLabelA.textContent = labelA;
    compareLabelB.textContent = labelB;
    compareLegend.classList.remove("hidden");
    compareTableCard.classList.remove("hidden");
    compareChartsEl.classList.remove("hidden");
    renderCompareTraces(tracesA, tracesB, labelA, labelB);

    const cpuA = metricsA.cpu_memory || {};
    const cpuB = metricsB.cpu_memory || {};
    const hpaA = metricsA.hpa_scaling || {};
    const hpaB = metricsB.hpa_scaling || {};
    const latA = metricsA.response_time_ms || {};
    const latB = metricsB.response_time_ms || {};
    const rpmA = metricsA.throughput || {};
    const rpmB = metricsB.throughput || {};

    renderOverlayChart("compareCpuChart", `${labelA} CPU`, elapsedPoints(cpuA.timestamps, cpuA.cpu_percent), `${labelB} CPU`, elapsedPoints(cpuB.timestamps, cpuB.cpu_percent), "#2563eb", "#f59e0b", "compareCpuLegend");
    renderOverlayChart("compareMemChart", `${labelA} Memory`, elapsedPoints(cpuA.timestamps, cpuA.memory_percent), `${labelB} Memory`, elapsedPoints(cpuB.timestamps, cpuB.memory_percent), "#2563eb", "#f59e0b", "compareMemLegend");
    renderOverlayChart("compareHpaChart", `${labelA} HPA`, elapsedPoints(hpaA.timestamps, hpaA.current_replicas), `${labelB} HPA`, elapsedPoints(hpaB.timestamps, hpaB.current_replicas), "#2563eb", "#f59e0b", "compareHpaLegend");
    renderOverlayChart("compareLatencyChart", `${labelA} p95`, elapsedPoints(latA.timestamps, latA.p95), `${labelB} p95`, elapsedPoints(latB.timestamps, latB.p95), "#2563eb", "#f59e0b", "compareLatencyLegend");
    renderOverlayChart("compareRpmChart", `${labelA} RPM`, elapsedPoints(rpmA.timestamps, rpmA.rpm), `${labelB} RPM`, elapsedPoints(rpmB.timestamps, rpmB.rpm), "#2563eb", "#f59e0b", "compareRpmLegend");
}

function summarizeTraces(payload) {
    const items = Array.isArray(payload && payload.items) ? payload.items : [];
    const durations = items
        .map((item) => Number(item.durationMs))
        .filter((value) => Number.isFinite(value));
    return {
        count: items.length,
        slowest: durations.length ? Math.max(...durations) : null,
        errors: items.filter((item) => item.error).length,
    };
}

function renderCompareTraceTable(bodyEl, statusEl, payload, label) {
    const items = Array.isArray(payload && payload.items) ? payload.items : [];
    bodyEl.innerHTML = "";
    if (!items.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 5;
        cell.textContent = payload && payload.error ? payload.error : "No transaction traces in this range.";
        row.appendChild(cell);
        bodyEl.appendChild(row);
        statusEl.textContent = payload && payload.error
            ? `Traces error for ${label}.`
            : `No traces for ${label}.`;
        return;
    }
    for (const item of items) {
        const row = document.createElement("tr");
        if (item.error) {
            row.classList.add("trace-error-row");
        }
        const cells = [
            formatTimestampIST(item.timestamp) || "--",
            endpointLabel(item.name || "Transaction"),
            formatDurationMs(item.durationMs),
            item.error ? `Error ${item.status || ""}`.trim() : (item.status || "OK"),
            item.uri || "--",
        ];
        cells.forEach((value, index) => {
            const cell = document.createElement("td");
            cell.textContent = value;
            cell.title = value;
            if (index === 3 && item.error) {
                cell.className = "trace-error";
            }
            row.appendChild(cell);
        });
        bodyEl.appendChild(row);
    }
    statusEl.textContent = `Showing ${items.length} slowest traces for ${label}.`;
}

function renderCompareTraces(tracesA, tracesB, labelA, labelB) {
    if (!compareTracesEl) {
        return;
    }
    compareTracesEl.classList.remove("hidden");
    compareTracesLabelA.textContent = labelA;
    compareTracesLabelB.textContent = labelB;
    renderCompareTraceTable(compareTracesBodyA, compareTracesStatusA, tracesA, labelA);
    renderCompareTraceTable(compareTracesBodyB, compareTracesStatusB, tracesB, labelB);
}

async function fetchTracesPayload(service, startTime, endTime, withBreakdown = false, endpoint = null) {
    if (!service || !startTime || !endTime) {
        return { items: [], count: 0 };
    }
    try {
        const response = await fetch("/api/traces", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                service,
                start_time: startTime,
                end_time: endTime,
                endpoint: endpoint || null,
                withBreakdown: Boolean(withBreakdown),
            }),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail));
        }
        return data;
    } catch (error) {
        return { items: [], count: 0, error: error.message };
    }
}

async function fetchMetricsPayload(service, startTime, endTime) {
    const response = await fetch("/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            service,
            start_time: startTime,
            end_time: endTime,
        }),
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail));
    }
    return data;
}

async function fetchPinById(pinId) {
    const response = await fetch(`/api/pins/${encodeURIComponent(pinId)}`);
    const data = await response.json();
    if (!response.ok) {
        throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail));
    }
    return data;
}

async function compareSavedTests() {
    const idA = comparePinA.value;
    const idB = comparePinB.value;
    if (!idA || !idB) {
        compareStatus.textContent = "Select two saved tests to compare.";
        return;
    }
    if (idA === idB) {
        compareStatus.textContent = "Choose two different saved tests.";
        return;
    }
    compareSavedBtn.disabled = true;
    compareStatus.textContent = "Loading saved tests...";
    try {
        const [pinA, pinB] = await Promise.all([fetchPinById(idA), fetchPinById(idB)]);
        if (!pinA.metrics || !pinB.metrics) {
            throw new Error("One of the saved tests has no metrics.");
        }
        const labelA = pinA.testName || "A";
        const labelB = pinB.testName || "B";
        const tracesA = pinA.traces && Array.isArray(pinA.traces.items) && pinA.traces.items.length
            ? pinA.traces
            : await fetchTracesPayload(pinA.service, pinA.startTime, pinA.endTime);
        const tracesB = pinB.traces && Array.isArray(pinB.traces.items) && pinB.traces.items.length
            ? pinB.traces
            : await fetchTracesPayload(pinB.service, pinB.startTime, pinB.endTime);
        renderCompare(pinA.metrics, pinB.metrics, labelA, labelB, tracesA, tracesB);
        compareStatus.textContent = `Compared "${labelA}" with "${labelB}".`;
    } catch (error) {
        compareStatus.textContent = `Compare error: ${error.message}`;
    } finally {
        compareSavedBtn.disabled = false;
    }
}

async function compareTimeRanges() {
    const service = compareServiceSelect.value;
    if (!service) {
        compareStatus.textContent = "Select a service first.";
        return;
    }
    compareRangeBtn.disabled = true;
    compareStatus.textContent = "Fetching both time ranges...";
    try {
        const rangeA = getRangeFrom(compareRangeAPreset, compareRangeAStart, compareRangeAEnd);
        const rangeB = getRangeFrom(compareRangeBPreset, compareRangeBStart, compareRangeBEnd);
        const [metricsA, metricsB, tracesA, tracesB] = await Promise.all([
            fetchMetricsPayload(service, rangeA.start_time, rangeA.end_time),
            fetchMetricsPayload(service, rangeB.start_time, rangeB.end_time),
            fetchTracesPayload(service, rangeA.start_time, rangeA.end_time),
            fetchTracesPayload(service, rangeB.start_time, rangeB.end_time),
        ]);
        const labelA = describeRange(compareRangeAPreset, compareRangeAStart, compareRangeAEnd);
        const labelB = describeRange(compareRangeBPreset, compareRangeBStart, compareRangeBEnd);
        renderCompare(metricsA, metricsB, labelA, labelB, tracesA, tracesB);
        compareStatus.textContent = `Compared ${labelA} with ${labelB} for ${service}.`;
    } catch (error) {
        compareStatus.textContent = `Compare error: ${error.message}`;
    } finally {
        compareRangeBtn.disabled = false;
    }
}

rangePreset.value = "now-1h";

rangePreset.addEventListener("change", updateTimeRangeControls);
startTimeInput.addEventListener("change", updateTimeRangeControls);
endTimeInput.addEventListener("change", updateTimeRangeControls);
projectSelect.addEventListener("change", () => {
    renderProjectMenu();
    refreshPinnedOptions().catch((error) => {
        analysisBox.textContent = `Saved tests error: ${error.message}`;
    });
});
projectMenuBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleProjectMenu();
});
deleteProjectBtn.addEventListener("click", deleteProject);
document.addEventListener("click", (event) => {
    if (!projectMenu.contains(event.target)) {
        closeProjectMenu();
    }
    if (servicePicker && !servicePicker.contains(event.target)) {
        closeServiceMenu();
    }
});
createProjectBtn.addEventListener("click", createProject);
newProjectNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        createProject();
    }
});
fetchBtn.addEventListener("click", fetchMetrics);
if (serviceMenuBtn) {
    serviceMenuBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleServiceMenu();
    });
}
if (serviceSearch) {
    serviceSearch.addEventListener("input", () => renderServiceMenu(availableServices));
}
if (tracesBreakdownFilterEl) {
    tracesBreakdownFilterEl.addEventListener("change", () => {
        if (serviceSelect.value) {
            loadTraces(selectedEndpoint);
        }
    });
}
pinBtn.addEventListener("click", pinCurrentResult);
analyzeBtn.addEventListener("click", runAiAnalysis);
const traceBreakdownCloseEl = document.getElementById("traceBreakdownClose");
const traceBreakdownBackdropEl = document.getElementById("traceBreakdownBackdrop");
if (traceBreakdownCloseEl) {
    traceBreakdownCloseEl.addEventListener("click", closeTraceBreakdownModal);
}
if (traceBreakdownBackdropEl) {
    traceBreakdownBackdropEl.addEventListener("click", closeTraceBreakdownModal);
}
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && traceBreakdownEl && !traceBreakdownEl.classList.contains("hidden")) {
        closeTraceBreakdownModal();
    }
});
askBtn.addEventListener("click", askQuestion);
savePinBtn.addEventListener("click", saveToCurrentPin);
askInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        askQuestion();
    }
});
loadPinnedBtn.addEventListener("click", loadPinnedResult);
deletePinnedBtn.addEventListener("click", deletePinnedResult);
monitorTabBtn.addEventListener("click", () => showDashboardView("monitor"));
compareTabBtn.addEventListener("click", () => showDashboardView("compare"));
compareSavedModeBtn.addEventListener("click", () => setCompareMode("saved"));
compareRangeModeBtn.addEventListener("click", () => setCompareMode("ranges"));
compareSavedBtn.addEventListener("click", compareSavedTests);
compareRangeBtn.addEventListener("click", compareTimeRanges);

fillRangePresetSelect(compareRangeAPreset, "now-15m");
fillRangePresetSelect(compareRangeBPreset, "now-5m");
bindCompareRangeControls(compareRangeAPreset, compareRangeACustom, compareRangeAStart, compareRangeAEnd);
bindCompareRangeControls(compareRangeBPreset, compareRangeBCustom, compareRangeBStart, compareRangeBEnd);

setDefaultCustomTimes();
syncChartRangeBadges();
compareRangeAStart.value = startTimeInput.value;
compareRangeAEnd.value = endTimeInput.value;
compareRangeBStart.value = startTimeInput.value;
compareRangeBEnd.value = endTimeInput.value;
updateTimeRangeControls();
analyzeBtn.disabled = true;
pinBtn.disabled = true;
askInput.addEventListener("input", () => {
    askInput.style.height = "auto";
    askInput.style.height = `${Math.min(askInput.scrollHeight, 120)}px`;
});
loadProjects().catch((error) => {
    analysisBox.textContent = `Project load error: ${error.message}`;
});
loadServices();
renderConversation();
