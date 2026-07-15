const inputSections = [
  {
    title: "Well Information",
    fields: [
      ["wellName", "Well name", "", "text"],
      ["client", "Client", "", "text"],
      ["date", "Date", "", "date"],
      ["producedBy", "Produced by", "", "text"],
    ],
  },
  {
    title: "Geometry",
    fields: [
      ["currentDepthMd", "Current well depth (MD)", "ft"],
      ["anchorMd", "Anchor point / BOC (MD)", "ft"],
      ["anchorTvd", "Anchor point / BOC (TVD)", "ft"],
      ["casingMd", "Casing depth (MD)", "ft"],
      ["casingTvd", "Casing depth (TVD)", "ft"],
      ["spotMd", "Spot depth (MD)", "ft"],
      ["spotTvd", "Spot depth (TVD)", "ft"],
      ["openHoleDia", "Open hole diameter", "in"],
      ["odDp", "OD drill pipe", "in"],
      ["idDp", "ID drill pipe", "in"],
      ["idCasing", "ID casing", "in"],
    ],
  },
  {
    title: "Fluid and Pressure",
    fields: [
      ["desiredEmw", "Desired EMW at anchor point", "ppge"],
      ["currentMw", "Current MW", "ppg"],
      ["kmw", "KMW", "ppg"],
      ["pumpDisp", "Pump displacement", "bbl/stk"],
      ["sbpConnection", "SBP on connection", "psi"],
      ["fit", "FIT", "ppge"],
      ["maxFlowRate", "Max flow rate", "gpm"],
    ],
  },
  {
    title: "Operational Settings",
    fields: [
      ["desiredResolution", "Desired resolution", "bbl"],
      ["initialFlowRate", "Initial flow rate", "gpm"],
      ["staticStrippingPressure", "Static stripping pressure", "psi", "output"],
      ["maxDynamicSbp", "Max dynamic SBP", "psi", "output"],
      ["overbalanceSlug", "Over balance pressure for slug", "psi"],
      ["safevisionNoSlug", "Safevision AP ECD, no slug", "ppge"],
      ["safevisionSlug", "Safevision AP ECD, with slug", "ppge"],
      ["sectionType", "Section type", "", "select", ["Production", "Intermediate"]],
    ],
  },
  {
    title: "Offline Cement Pill",
    fields: [
      ["cementDesiredEsd", "Desired ESD", "ppge"],
      ["newCasingOd", "New casing OD", "in"],
      ["newCasingId", "New casing ID", "in"],
      ["cementMw", "MW", "ppg"],
      ["tdDepth", "TD depth", "ft"],
    ],
  },
];

const slugOnlyFields = new Set(["overbalanceSlug", "safevisionSlug"]);

const defaults = {
  pillMode: "noSlug",
  wellName: "",
  client: "",
  date: new Date().toISOString().slice(0, 10),
  producedBy: "",
  sectionType: "Production",
  currentDepthMd: "",
  anchorMd: "",
  anchorTvd: "",
  casingMd: "",
  casingTvd: "",
  spotMd: "",
  spotTvd: "",
  openHoleDia: "",
  desiredEmw: "",
  odDp: "",
  idDp: "",
  idCasing: "",
  currentMw: "",
  pumpDisp: "",
  kmw: "",
  sbpConnection: "",
  fit: "",
  maxFlowRate: "",
  desiredResolution: "",
  initialFlowRate: "",
  overbalanceSlug: "",
  safevisionNoSlug: "",
  safevisionSlug: "",
  cementDesiredEsd: "",
  newCasingOd: "",
  newCasingId: "",
  cementMw: "",
  tdDepth: "",
};

const example = {
  wellName: "RIG - WELL",
  client: "Client",
  producedBy: "Engineering",
  currentDepthMd: 17650,
  anchorMd: 13900,
  anchorTvd: 11250,
  casingMd: 10450,
  casingTvd: 10125,
  spotMd: 15400,
  spotTvd: 11120,
  openHoleDia: 8.5,
  desiredEmw: 13.9,
  odDp: 5,
  idDp: 4.276,
  idCasing: 8.681,
  currentMw: 12.4,
  pumpDisp: 0.095,
  kmw: 15.8,
  sbpConnection: 320,
  fit: 15.6,
  maxFlowRate: 300,
  desiredResolution: 25,
  initialFlowRate: 180,
  overbalanceSlug: 100,
  safevisionNoSlug: 12.85,
  safevisionSlug: 13.1,
  sectionType: "Production",
  cementDesiredEsd: 14.2,
  newCasingOd: 7,
  newCasingId: 6.276,
  cementMw: 12.4,
  tdDepth: 17650,
};

const tripTables = {
  "6.75": [
    [40, 0.16],
    [80, 0.26],
    [100, 0.34],
    [150, 0.49],
    [200, 0.6],
    [250, 0.64],
    [300, 0.69],
  ],
  "7.875": [
    [40, 0.12],
    [80, 0.19],
    [100, 0.26],
    [150, 0.41],
    [200, 0.47],
    [250, 0.53],
    [300, 0.6],
  ],
  "8.5": [
    [40, 0.07],
    [80, 0.12],
    [100, 0.18],
    [150, 0.25],
    [200, 0.33],
    [250, 0.39],
    [300, 0.46],
  ],
  other: [
    [40, 0.05],
    [80, 0.1],
    [100, 0.16],
    [150, 0.23],
    [200, 0.31],
    [250, 0.37],
    [300, 0.44],
  ],
};

const state = { ...defaults };
const storageKey = "mpd360.savedScenario.v2";
let scheduleCache = [];
let scheduleCutoffRow = null;
let scheduleMeta = { mode: "noSlug", finalVolume: NaN };

const byId = (id) => document.getElementById(id);
const isNum = (value) => Number.isFinite(value);
const n = (key) => {
  if (state[key] === "" || state[key] === null || state[key] === undefined) return NaN;
  const value = Number(state[key]);
  return Number.isFinite(value) ? value : NaN;
};
const safeDiv = (a, b) => (isNum(a) && isNum(b) && Math.abs(b) > 1e-9 ? a / b : NaN);
const round = (v, digits = 0) =>
  isNum(v) ? Number(v.toFixed(Math.max(0, digits))) : NaN;
const roundup = (v, digits = 0) => {
  if (!isNum(v)) return NaN;
  const factor = 10 ** digits;
  return Math.ceil(v * factor) / factor;
};
const floorTo = (v, step) => (isNum(v) ? Math.floor(v / step) * step : NaN);
const ceilMath = (v, significance = 1) =>
  isNum(v) && significance ? Math.ceil(v / significance) * significance : NaN;
const nonNegative = (value) => (isNum(value) ? Math.max(0, value) : NaN);
const textOrDash = (value) =>
  value === "" || value === null || value === undefined ? "-" : value;

function fmt(value, unit = "", digits = 1) {
  if (!isNum(value)) return `<span class="pending">Pending</span>`;
  const rounded = Math.abs(value) >= 100 ? round(value, 0) : round(value, digits);
  return `${rounded.toLocaleString(undefined, {
    maximumFractionDigits: digits,
  })}${unit ? ` ${unit}` : ""}`;
}

function numberText(value, digits = 0) {
  if (!isNum(value)) return "Pending";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function tripTableKey(diameter) {
  if (Math.abs(diameter - 6.75) < 0.001) return "6.75";
  if (Math.abs(diameter - 7.875) < 0.001) return "7.875";
  if (Math.abs(diameter - 8.5) < 0.001) return "8.5";
  return "other";
}

function inputValue(key) {
  return state[key] ?? "";
}

function buildInputs() {
  const root = byId("inputSections");
  root.innerHTML = inputSections
    .map(
      (section) => `
        <section class="input-section">
          <h3>${section.title}</h3>
          <div class="field-grid">
            ${section.fields
              .map(([key, label, unit, type = "number", options]) => {
                const control =
                  type === "output"
                    ? `<output id="${key}" class="field-output" aria-live="polite">Pending</output>`
                    : type === "select"
                    ? `<select id="${key}" data-key="${key}">
                        ${options
                          .map(
                            (option) =>
                              `<option value="${option}" ${inputValue(key) === option ? "selected" : ""}>${option}</option>`,
                          )
                          .join("")}
                      </select>`
                    : `<input id="${key}" data-key="${key}" type="${type}" value="${inputValue(key)}" ${type === "number" ? 'step="any"' : ""} />`;
                return `
                  <div class="field" data-field-key="${key}" ${slugOnlyFields.has(key) ? 'data-mode-only="withSlug"' : ""}>
                    <label for="${key}">
                      <span>${label}</span>
                      <span class="unit">${unit}</span>
                    </label>
                    ${control}
                  </div>
                `;
              })
              .join("")}
          </div>
        </section>
      `,
    )
    .join("");

  root.querySelectorAll("[data-key]").forEach((control) => {
    control.addEventListener("input", (event) => {
      state[event.target.dataset.key] = event.target.value;
      render();
    });
  });
}

function calc() {
  const currentMw = n("currentMw");
  const kmw = n("kmw");
  const anchorTvd = n("anchorTvd");
  const casingTvd = n("casingTvd");
  const casingMd = n("casingMd");
  const spotMd = n("spotMd");
  const spotTvd = n("spotTvd");
  const idDp = n("idDp");
  const odDp = n("odDp");
  const idCasing = n("idCasing");
  const openHoleDia = n("openHoleDia");
  const desiredEmw = n("desiredEmw");
  const desiredResolution = n("desiredResolution");
  const pumpDisp = n("pumpDisp");
  const fit = n("fit");
  const overbalanceSlug = n("overbalanceSlug");
  const safevisionNoSlug = n("safevisionNoSlug");
  const safevisionSlug = n("safevisionSlug");

  const staticStrippingPressure = (desiredEmw - currentMw) * 0.052 * anchorTvd;
  const selectedTripTable = tripTableKey(openHoleDia);
  const tripPressures = (tripTables[selectedTripTable] ?? tripTables.other).map(
    ([speed, ppge]) => {
      const swabPressure = ceilMath(ppge * 0.052 * anchorTvd, 10);
      return {
        speed,
        ppge,
        swabPressure,
        dynamicPressure: staticStrippingPressure + swabPressure,
      };
    },
  );
  const maxSwabPressure = tripPressures.at(-1)?.swabPressure;
  const maxDynamicSbp = staticStrippingPressure + maxSwabPressure;
  const pressureGradient = (kmw - currentMw) * 0.052;
  const targetPressure = (desiredEmw - currentMw) * 0.052 * anchorTvd;
  const masp = (fit - currentMw) * 0.052 * casingTvd;
  const initialApl = (safevisionNoSlug - currentMw) * 0.052 * casingTvd;
  const drillStringCap = idDp ** 2 / 1029.4;
  const drillStringVolAtSpot = round(drillStringCap * spotMd, 0);
  const casingCap = idCasing ** 2 / 1029.4;
  const annularCap = (idCasing ** 2 - odDp ** 2) / 1029.4;
  const annularBelowShoe =
    spotMd <= casingMd ? 0 : (openHoleDia ** 2 - odDp ** 2) / 1029.4;
  const drillStringOpenHole = spotMd <= casingMd ? 0 : spotMd - casingMd;
  const openHoleCap = (openHoleDia ** 2 - odDp ** 2) / 1029.4;
  const volumeBelowShoe = drillStringOpenHole * openHoleCap;
  const casingVolAtSpot =
    spotMd <= casingMd ? casingCap * spotMd : casingCap * casingMd - volumeBelowShoe;
  const annularAtSpot =
    spotMd <= casingMd
      ? annularCap * spotMd
      : annularCap * (spotMd - drillStringOpenHole) +
        annularBelowShoe * drillStringOpenHole;
  const heightPillNoDp = ceilMath(safeDiv(targetPressure, pressureGradient), 10);
  const totalPillVol = roundup(heightPillNoDp * casingCap, 0);
  const requiredVolAnnulus = heightPillNoDp * annularCap;
  const calculatedChase =
    drillStringCap * spotMd - (totalPillVol - requiredVolAnnulus);
  const correctedChase = calculatedChase <= 0 ? 0 : calculatedChase;
  const correctedPillVol = round(
    correctedChase === 0 ? requiredVolAnnulus - calculatedChase : requiredVolAnnulus,
    0,
  );
  const finalKwm = correctedChase === 0 ? drillStringVolAtSpot : totalPillVol - requiredVolAnnulus;
  const minHeightWithDp =
    safeDiv(totalPillVol, (idCasing ** 2 - odDp ** 2 + idDp ** 2) / 1029.4) +
    safeDiv(volumeBelowShoe, (openHoleDia ** 2 - odDp ** 2 + idDp ** 2) / 1029.4);
  const balancedAdditionalPsi = (minHeightWithDp - heightPillNoDp) * pressureGradient;
  const addPpgCsg = safeDiv(balancedAdditionalPsi, 0.052 * casingTvd);
  const addPpgTarget = safeDiv(balancedAdditionalPsi, 0.052 * anchorTvd);
  const esdCasingNoDp =
    spotMd <= casingMd
      ? safeDiv(targetPressure, 0.052 * casingTvd) + currentMw
      : ((heightPillNoDp - spotTvd + casingTvd) * (kmw - currentMw)) /
          casingTvd +
        currentMw;
  const balancedEsdCasing = esdCasingNoDp + addPpgCsg;
  const anchorPointEsd = desiredEmw + addPpgTarget;
  const resolutionHeightGain = safeDiv(desiredResolution, annularCap);
  const resolutionPressureGain = (kmw - currentMw) * resolutionHeightGain * 0.052;
  const pressureDifferential = (desiredEmw - safevisionNoSlug) * 0.052 * anchorTvd;
  const pressureDifferentialSlug = (desiredEmw - safevisionSlug) * 0.052 * anchorTvd;
  const slugPressure = maxDynamicSbp + overbalanceSlug;
  const slugPillVol = safeDiv(slugPressure, pressureGradient) * drillStringCap;
  const strokesToPumpSlug = safeDiv(slugPillVol, pumpDisp);
  const pillVolAtSpot = totalPillVol - slugPillVol;
  const slugFits = drillStringVolAtSpot > slugPillVol;
  const slugFallOut = slugFits ? 0 : slugPillVol - drillStringVolAtSpot;
  const slugFallHeight = safeDiv(slugFallOut, casingCap);
  const chaseWithSlug = pillVolAtSpot + correctedChase;
  const slugPpgEquivalent = safeDiv(slugFallHeight * pressureGradient, 0.052 * anchorTvd);
  const slugPsiEquivalent = slugPpgEquivalent * 0.052 * anchorTvd;
  const slugApl = (safevisionSlug - currentMw) * 0.052 * anchorTvd;
  const correctedSlugPill = correctedPillVol + slugFallOut;
  const combinedPillCapacity =
    (idCasing ** 2 - odDp ** 2 + idDp ** 2) / 1029.4;
  const pillHeightPosition =
    minHeightWithDp < spotMd && spotMd > heightPillNoDp
      ? minHeightWithDp - spotMd
      : 0;
  const correctedTotalPillAtSpot =
    totalPillVol - round(pillHeightPosition * combinedPillCapacity, 0);
  const totalPillVolAtSpotNoSlug =
    spotMd > minHeightWithDp ? totalPillVol : correctedTotalPillAtSpot;
  const totalPillVolAtSpotWithSlug =
    pillVolAtSpot < annularAtSpot ? totalPillVol : correctedTotalPillAtSpot;
  const topOfPillWithDp =
    isNum(spotMd) && isNum(minHeightWithDp)
      ? spotMd > minHeightWithDp
        ? spotMd - minHeightWithDp
        : "Surface"
      : NaN;
  const topOfPillNoDp = spotMd - heightPillNoDp;
  const kwmPlusChase = roundup(totalPillVol + correctedChase, 0);

  const cement = calcCement();

  return {
    masp,
    initialApl,
    drillStringCap,
    drillStringVolAtSpot,
    casingCap,
    casingVolAtSpot,
    annularCap,
    annularBelowShoe,
    annularAtSpot,
    openHoleCap,
    heightPillNoDp,
    totalPillVol,
    drillStringOpenHole,
    volumeBelowShoe,
    requiredVolAnnulus,
    correctedPillVol,
    calculatedChase,
    correctedChase,
    finalKwm,
    minHeightWithDp,
    balancedAdditionalPsi,
    addPpgCsg,
    addPpgTarget,
    balancedEsdCasing,
    esdCasingNoDp,
    anchorPointEsd,
    resolutionHeightGain,
    resolutionPressureGain,
    pressureDifferential,
    pressureDifferentialSlug,
    staticStrippingPressure,
    maxDynamicSbp,
    maxSwabPressure,
    selectedTripTable,
    tripPressures,
    slugPressure,
    slugPillVol,
    strokesToPumpSlug,
    pillVolAtSpot,
    slugFits,
    slugFallOut,
    slugFallHeight,
    chaseWithSlug,
    slugPpgEquivalent,
    slugPsiEquivalent,
    slugApl,
    correctedSlugPill,
    correctedTotalPillAtSpot,
    totalPillVolAtSpotNoSlug,
    totalPillVolAtSpotWithSlug,
    topOfPillWithDp,
    topOfPillNoDp,
    kwmPlusChase,
    cement,
  };
}

function calcCement() {
  const desiredEsd = n("cementDesiredEsd");
  const newCasingOd = n("newCasingOd");
  const newCasingId = n("newCasingId");
  const cementMw = n("cementMw");
  const tdDepth = n("tdDepth");
  const anchorMd = n("anchorMd");
  const casingMd = n("casingMd");
  const idCasing = n("idCasing");
  const openHoleDia = n("openHoleDia");
  const currentMw = n("currentMw");
  const kmw = n("kmw");
  const casingTvd = n("casingTvd");

  const staticPressure = (desiredEsd - cementMw) * 0.052 * casingTvd;
  const annularCapacity = (idCasing ** 2 - newCasingOd ** 2) / 1029.4;
  const openHoleCapacity = (openHoleDia ** 2 - newCasingOd ** 2) / 1029.4;
  const casingStringCapacity = newCasingId ** 2 / 1029.4;
  const openHoleToBoc = tdDepth - anchorMd;
  const bocToShoe = anchorMd - casingMd;
  const requiredPillHeight = ceilMath(safeDiv(staticPressure, (kmw - cementMw) * 0.052), 10);
  const requiredCementPillVol = roundup(requiredPillHeight * annularCapacity, 0);
  const totalCasingStringVol = casingStringCapacity * tdDepth;
  const chaseToTd = totalCasingStringVol - requiredCementPillVol;
  const chaseExitCasing = requiredCementPillVol;
  const chaseBocToShoe = openHoleToBoc * openHoleCapacity;
  const chaseBocShoePlusPill = bocToShoe * openHoleCapacity + requiredCementPillVol;
  const totalChase = chaseBocShoePlusPill + chaseBocToShoe + totalCasingStringVol;
  const topOfPill = casingMd - requiredPillHeight;

  return {
    staticPressure,
    annularCapacity,
    openHoleCapacity,
    casingStringCapacity,
    openHoleToBoc,
    bocToShoe,
    requiredPillHeight,
    requiredCementPillVol,
    totalCasingStringVol,
    chaseToTd,
    chaseExitCasing,
    chaseBocToShoe,
    chaseBocShoePlusPill,
    totalChase,
    topOfPill,
  };
}

function metricRow(name, value, unit, digits = 1) {
  return `
    <div class="metric-row">
      <div class="metric-name">${name}</div>
      <div class="metric-value">${fmt(value, unit, digits)}</div>
    </div>
  `;
}

function modeLabel(mode = state.pillMode) {
  return mode === "withSlug" ? "With Slug" : "No Slug";
}

function renderModeUi() {
  const withSlug = state.pillMode === "withSlug";
  document.body.dataset.pillMode = state.pillMode;
  document.querySelectorAll('[data-mode-only="withSlug"]').forEach((field) => {
    field.hidden = !withSlug;
  });
  document.querySelectorAll('input[name="pillMode"]').forEach((control) => {
    control.checked = control.value === state.pillMode;
  });
  byId("slugSection").hidden = !withSlug;
  byId("summarySplit").classList.toggle("single-mode", !withSlug);
  byId("scheduleTitle").textContent = `Standard Pill - ${modeLabel()}`;
}

function renderJobStrip() {
  byId("jobWell").textContent = textOrDash(state.wellName);
  byId("jobClient").textContent = textOrDash(state.client);
  byId("jobDate").textContent = textOrDash(state.date);
  byId("jobSection").textContent = textOrDash(state.sectionType);
}

function renderDerivedOutputs(results) {
  byId("staticStrippingPressure").textContent = numberText(
    results.staticStrippingPressure,
    0,
  );
  byId("maxDynamicSbp").textContent = numberText(results.maxDynamicSbp, 0);
}

function renderScenarioMetrics(results) {
  const saved = localStorage.getItem(storageKey);
  byId("scenarioMetrics").innerHTML = [
    ["Well", state.wellName || "-", ""],
    ["Client", state.client || "-", ""],
    ["Produced by", state.producedBy || "-", ""],
    ["Pill mode", modeLabel(), ""],
    ["Workbook source", "MPD 360 (2026) - RIG - WELL", ""],
    ["Last saved locally", saved ? "Available" : "None", ""],
  ]
    .map(([name, value]) => `
      <div class="metric-row">
        <div class="metric-name">${name}</div>
        <div class="metric-value">${value}</div>
      </div>
    `)
    .join("");
}
function renderKpis(results) {
  const kpis = state.pillMode === "withSlug"
    ? [
        ["MASP", results.masp, "psi", 0],
        ["Total Pill Volume", results.totalPillVol, "bbl", 0],
        ["Slug Volume", results.slugPillVol, "bbl", 1],
        ["Chase with Slug", results.chaseWithSlug, "bbl", 0],
      ]
    : [
        ["MASP", results.masp, "psi", 0],
        ["Total Pill Volume", results.totalPillVol, "bbl", 0],
        ["Corrected Chase", results.correctedChase, "bbl", 0],
        ["Anchor Point ESD", results.anchorPointEsd, "ppge", 2],
      ];
  byId("kpiGrid").innerHTML = kpis
    .map(
      ([label, value, unit, digits]) => `
        <article class="kpi">
          <div class="label">${label}</div>
          <div class="value">${fmt(value, "", digits)}</div>
          <div class="unit-text">${unit}</div>
        </article>
      `,
    )
    .join("");
}

function renderMetrics(results) {
  byId("pillMetrics").innerHTML = [
    ["Initial flowrate annular friction", results.initialApl, "psi", 0],
    ["Drill string capacity", results.drillStringCap, "bbl/ft", 4],
    ["Drill string volume at spot depth", results.drillStringVolAtSpot, "bbl", 0],
    ["Casing capacity", results.casingCap, "bbl/ft", 4],
    ["Annular capacity", results.annularCap, "bbl/ft", 4],
    ["Open hole capacity", results.openHoleCap, "bbl/ft", 4],
    ["Height of pill without DP", results.heightPillNoDp, "ft", 0],
    ["Required pill volume in annulus", results.requiredVolAnnulus, "bbl", 0],
    ["Corrected pill volume in annulus", results.correctedPillVol, "bbl", 0],
    ["Final KWM in drill string", results.finalKwm, "bbl", 0],
    ["Minimum height of pill with DP", results.minHeightWithDp, "ft", 0],
    ["Balanced case additional pressure", results.balancedAdditionalPsi, "psi", 0],
    ["Balanced ESD at casing shoe", results.balancedEsdCasing, "ppge", 2],
    ["Top of pill without DP", results.topOfPillNoDp, "ft", 0],
  ]
    .map((row) => metricRow(...row))
    .join("");

  byId("slugMetrics").innerHTML = [
    ["Initial pressure differential", results.pressureDifferential, "psi", 0],
    ["Slug pressure", results.slugPressure, "psi", 0],
    ["Slug pill volume of KMW", results.slugPillVol, "bbl", 1],
    ["Strokes to pump slug", results.strokesToPumpSlug, "stk", 0],
    ["Pill volume to pump at spot depth", results.pillVolAtSpot, "bbl", 0],
    ["Capacity vs. slug logic check", results.slugFits ? 0 : -1, "", 0],
    ["Slug fall out", results.slugFallOut, "bbl", 1],
    ["Height equivalent of slug fall", results.slugFallHeight, "ft", 0],
    ["Chase volume total with slug", results.chaseWithSlug, "bbl", 0],
    ["PPG equivalent at anchor point", results.slugPpgEquivalent, "ppge", 2],
    ["PSI equivalent at anchor point", results.slugPsiEquivalent, "psi", 0],
    ["APL PSI value for initial flow rate", results.slugApl, "psi", 0],
    ["Corrected pill volume for slug", results.correctedSlugPill, "bbl", 0],
  ]
    .map((row) => metricRow(...row))
    .join("");
}

function procedureValue(value, unit, digits) {
  if (typeof value === "string") return value;
  if (!isNum(value)) return `<span class="pending">Pending</span>`;
  return `${numberText(value, digits)}${unit ? ` ${unit}` : ""}`;
}

function procedureRows(rows) {
  return rows
    .map(
      ([label, value, unit, digits]) => `
        <div class="procedure-result-row">
          <span>${label}</span>
          <strong>${procedureValue(value, unit, digits)}</strong>
        </div>
      `,
    )
    .join("");
}

function renderProcedureResults(results) {
  const withSlug = state.pillMode === "withSlug";
  const atSurface = results.topOfPillWithDp === "Surface";
  const totalAtSpot = withSlug
    ? results.totalPillVolAtSpotWithSlug
    : results.totalPillVolAtSpotNoSlug;
  const esdCasingWithDp = atSurface
    ? results.esdCasingNoDp
    : results.balancedEsdCasing;
  const esdTargetWithDp = atSurface ? n("desiredEmw") : results.anchorPointEsd;
  const pillHeightWithDp = atSurface
    ? results.heightPillNoDp
    : results.minHeightWithDp;

  byId("procedureOutcome").innerHTML = `
    This procedure will result in
    <strong>${procedureValue(results.correctedPillVol, "bbl", 1)}</strong>
    of the heavy pill into the annulus and leave the remaining
    <strong>${procedureValue(results.finalKwm, "bbl", 1)}</strong>
    in the drill string.
  `;
  byId("placementResults").innerHTML = procedureRows([
    ["Total Pill Volume", results.totalPillVol, "bbl", 1],
    ["Total Pill Volume @ Spot Depth", totalAtSpot, "bbl", 1],
    ["Top of Pill w/ DP", results.topOfPillWithDp, "ft", 0],
    ["Top of Pill w/o DP", results.topOfPillNoDp, "ft", 0],
  ]);
  byId("withDpResults").innerHTML = procedureRows([
    ["ESD @ Casing Shoe", esdCasingWithDp, "ppg", 2],
    ["ESD @ Target", esdTargetWithDp, "ppg", 2],
    ["Pill Height w/ DP", pillHeightWithDp, "ft", 0],
  ]);
  byId("withoutDpResults").innerHTML = procedureRows([
    ["ESD @ Casing Shoe", results.esdCasingNoDp, "ppg", 2],
    ["ESD @ Anchor Point", n("desiredEmw"), "ppg", 2],
    ["Pill Height w/o DP", results.heightPillNoDp, "ft", 0],
  ]);
}

function renderTripTable(results) {
  const label = results.selectedTripTable === "other" ? "Other" : results.selectedTripTable;
  byId("tripTableLabel").textContent = `Auto: ${label} in`;
  byId("tripSpeedRows").innerHTML = results.tripPressures
    .map(({ speed, ppge, swabPressure, dynamicPressure }) => {
      return `
        <tr>
          <td>${speed} ft/hr</td>
          <td>${fmt(ppge, "ppge", 2)}</td>
          <td>${fmt(swabPressure, "psi", 0)}</td>
          <td>${fmt(dynamicPressure, "psi", 0)}</td>
        </tr>
      `;
    })
    .join("");
}

function makeScheduleRows(results, mode = state.pillMode) {
  const activeMode = mode === "withSlug" ? "withSlug" : "noSlug";
  const withSlug = activeMode === "withSlug";
  const resolution = n("desiredResolution");
  const flow = n("initialFlowRate");
  const pumpDisp = n("pumpDisp");
  const currentMw = n("currentMw");
  const kmw = n("kmw");
  const odDp = n("odDp");
  const heavyVolume = nonNegative(
    withSlug ? results.pillVolAtSpot : results.totalPillVol,
  );
  const fullPillAtSpot =
    !withSlug ||
    !isNum(results.minHeightWithDp) ||
    !isNum(n("spotMd")) ||
    n("spotMd") > results.minHeightWithDp;
  const normalFinalVolume = nonNegative(
    withSlug ? results.chaseWithSlug : results.kwmPlusChase,
  );
  const correctedFinalVolume = nonNegative(results.correctedSlugPill);
  const finalVolume =
    withSlug && !fullPillAtSpot && isNum(correctedFinalVolume)
      ? correctedFinalVolume
      : normalFinalVolume;
  const required = [
    resolution,
    flow,
    pumpDisp,
    currentMw,
    kmw,
    odDp,
    results.drillStringVolAtSpot,
    results.totalPillVol,
    heavyVolume,
    finalVolume,
    results.staticStrippingPressure,
    results.resolutionPressureGain,
    results.pressureDifferential,
  ];
  if (withSlug) {
    required.push(
      results.pressureDifferentialSlug,
      results.slugFallOut,
      results.slugPsiEquivalent,
    );
  }
  if (
    required.some((value) => !isNum(value)) ||
    resolution <= 0 ||
    pumpDisp <= 0 ||
    heavyVolume <= 0 ||
    finalVolume <= 0 ||
    (withSlug && typeof results.slugFits !== "boolean")
  ) {
    return {
      rows: [],
      cutoff: null,
      mode: activeMode,
      heavyVolume,
      finalVolume,
    };
  }

  const noSlugInitialVolume = Math.min(
    heavyVolume,
    nonNegative(results.drillStringVolAtSpot),
  );
  const slugInitialVolume =
    results.totalPillVol < results.drillStringVolAtSpot
      ? heavyVolume
      : Math.min(resolution, finalVolume);
  let volume = Math.min(
    withSlug ? slugInitialVolume : noSlugInitialVolume,
    finalVolume,
  );
  let hiddenSbp = withSlug
    ? results.pressureDifferentialSlug
    : results.pressureDifferential;
  let priorStaticSbp = NaN;
  const rows = [];

  for (let step = 1; step <= 200; step += 1) {
    let sbp = "Open Choke";
    if (step === 1 && hiddenSbp > 0) {
      sbp = hiddenSbp;
    } else if (!withSlug && step === 2 && odDp > 0 && hiddenSbp > 0) {
      sbp = results.pressureDifferential;
    } else if (withSlug && step === 2 && results.slugFits) {
      hiddenSbp = results.pressureDifferential;
      if (hiddenSbp > 0) sbp = hiddenSbp;
    } else if (step > 2 && hiddenSbp > 50) {
      hiddenSbp =
        hiddenSbp > results.resolutionPressureGain
          ? Math.max(hiddenSbp - results.resolutionPressureGain, 50)
          : 50;
      sbp = hiddenSbp;
    } else if (withSlug && step === 2 && hiddenSbp > 50) {
      hiddenSbp =
        hiddenSbp > results.resolutionPressureGain
          ? Math.max(hiddenSbp - results.resolutionPressureGain, 50)
          : 50;
      sbp = hiddenSbp;
    }

    const slugPressureOffset =
      withSlug && results.slugPsiEquivalent > 0 ? results.slugPsiEquivalent : 0;
    let staticSbp;
    if (slugPressureOffset > 0) {
      if (step === 1) {
        staticSbp = Math.max(0, results.staticStrippingPressure - slugPressureOffset);
      } else if (step === 2) {
        staticSbp = Math.max(
          0,
          results.staticStrippingPressure - slugPressureOffset * 2,
        );
      } else {
        staticSbp = Math.max(
          0,
          priorStaticSbp - results.resolutionPressureGain - slugPressureOffset,
        );
      }
    } else {
      staticSbp = Math.max(
        0,
        results.staticStrippingPressure - (step - 1) * results.resolutionPressureGain,
      );
    }
    priorStaticSbp = staticSbp;

    rows.push({
      step,
      sbp,
      flow,
      volume,
      strokes: safeDiv(volume, pumpDisp),
      density: volume <= heavyVolume ? kmw : currentMw,
      staticSbp,
      activityNotes: "",
    });

    if (volume >= finalVolume - 1e-9) break;

    let nextVolume = volume + resolution;
    const remainingPill = heavyVolume - volume;
    if (remainingPill > 0 && remainingPill < resolution) {
      nextVolume = heavyVolume;
    }
    nextVolume = Math.min(nextVolume, finalVolume);
    if (nextVolume <= volume + 1e-9) break;
    volume = nextVolume;
  }

  const last = rows.at(-1);
  const cutoff = last && last.volume >= finalVolume - 1e-9
    ? {
        ...last,
        step: "",
        activityNotes: "Excluded: Total strokes repeat",
      }
    : null;
  return {
    rows,
    cutoff,
    mode: activeMode,
    heavyVolume,
    finalVolume,
    fullPillAtSpot,
  };
}

function renderSchedule(results) {
  const generated = makeScheduleRows(results, state.pillMode);
  scheduleCache = generated.rows;
  scheduleCutoffRow = generated.cutoff;
  scheduleMeta = generated;
  const showCutoff = byId("showCutoff").checked && scheduleCutoffRow;
  const displayRows = showCutoff ? [...scheduleCache, scheduleCutoffRow] : scheduleCache;

  byId("scheduleStaticPressure").textContent = numberText(
    results.staticStrippingPressure,
    0,
  );
  byId("scheduleMaxDynamic").textContent = numberText(results.maxDynamicSbp, 0);
  byId("scheduleFinalVolume").textContent = numberText(generated.finalVolume, 0);
  byId("scheduleFinalStrokes").textContent = numberText(
    safeDiv(generated.finalVolume, n("pumpDisp")),
    0,
  );
  byId("scheduleMode").textContent = !scheduleCache.length
    ? "Waiting for inputs"
    : scheduleCutoffRow
      ? `${modeLabel(generated.mode)} · ${scheduleCache.length} rows · repeat trimmed`
      : `${modeLabel(generated.mode)} · ${scheduleCache.length} rows · review resolution`;

  byId("scheduleRows").innerHTML = displayRows
    .map(
      (row) => `
        <tr class="${row === scheduleCutoffRow ? "cutoff-row" : ""}">
          <td>${row === scheduleCutoffRow ? "Cutoff" : row.step}</td>
          <td>${isNum(row.sbp) ? numberText(row.sbp, 0) : row.sbp}</td>
          <td>${numberText(row.flow, 0)}</td>
          <td>${numberText(row.volume, 0)}</td>
          <td>${numberText(row.strokes, 0)}</td>
          <td class="density-cell">${numberText(row.density, 2)}</td>
          <td>${numberText(row.staticSbp, 0)}</td>
          <td>${row.activityNotes}</td>
        </tr>
      `,
    )
    .join("");
}
function renderCement(results) {
  const cement = results.cement;
  const kpis = [
    ["Static Pressure", cement.staticPressure, "psi", 0],
    ["Required Cement Volume", cement.requiredCementPillVol, "bbl", 0],
    ["Total Chase Volume", cement.totalChase, "bbl", 0],
  ];
  byId("cementGrid").innerHTML = kpis
    .map(
      ([label, value, unit, digits]) => `
        <article class="kpi">
          <div class="label">${label}</div>
          <div class="value">${fmt(value, "", digits)}</div>
          <div class="unit-text">${unit}</div>
        </article>
      `,
    )
    .join("");

  byId("cementMetrics").innerHTML = [
    ["Annular capacity", cement.annularCapacity, "bbl/ft", 4],
    ["Open hole capacity", cement.openHoleCapacity, "bbl/ft", 4],
    ["Casing string capacity", cement.casingStringCapacity, "bbl/ft", 4],
    ["Open hole length TD to BOC", cement.openHoleToBoc, "ft", 0],
    ["Open hole length BOC to casing shoe", cement.bocToShoe, "ft", 0],
    ["Required pill height", cement.requiredPillHeight, "ft", 0],
    ["Total casing string volume", cement.totalCasingStringVol, "bbl", 0],
    ["Chase after pumping KWM to TD", cement.chaseToTd, "bbl", 0],
    ["Chase to exit casing string", cement.chaseExitCasing, "bbl", 0],
    ["Chase from casing exit to BOC", cement.chaseBocToShoe, "bbl", 0],
    ["Chase BOC to casing shoe plus pill", cement.chaseBocShoePlusPill, "bbl", 0],
    ["Top of pill", cement.topOfPill, "ft", 0],
  ]
    .map((row) => metricRow(...row))
    .join("");
}

function renderWarnings(results) {
  const warnings = [];
  const withSlug = state.pillMode === "withSlug";
  const required = [
    ["anchorTvd", "Anchor point TVD"],
    ["casingTvd", "Casing depth TVD"],
    ["spotMd", "Spot depth MD"],
    ["openHoleDia", "Open hole diameter"],
    ["desiredEmw", "Desired EMW"],
    ["currentMw", "Current MW"],
    ["kmw", "KMW"],
    ["idDp", "ID drill pipe"],
    ["odDp", "OD drill pipe"],
    ["idCasing", "ID casing"],
    ["pumpDisp", "Pump displacement"],
    ["desiredResolution", "Desired resolution"],
    ["initialFlowRate", "Initial flow rate"],
    ["safevisionNoSlug", "Safevision AP ECD, no slug"],
  ];
  if (withSlug) {
    required.push(
      ["overbalanceSlug", "Over balance pressure for slug"],
      ["safevisionSlug", "Safevision AP ECD, with slug"],
    );
  }
  const missing = required.filter(([key]) => !isNum(n(key))).map(([, label]) => label);
  if (missing.length) {
    warnings.push({
      level: "error",
      text: `Missing required values: ${missing.join(", ")}.`,
    });
  }
  if (isNum(n("kmw")) && isNum(n("currentMw")) && n("kmw") <= n("currentMw")) {
    warnings.push({
      level: "error",
      text: "KMW must be greater than current MW for the pill height formulas.",
    });
  }
  if (isNum(results.totalPillVol) && isNum(results.drillStringVolAtSpot) && results.totalPillVol > results.drillStringVolAtSpot * 2) {
    warnings.push({
      level: "",
      text: "Total pill volume is high relative to drill string volume at spot depth.",
    });
  }
  if (isNum(results.masp) && isNum(results.pressureDifferential) && results.pressureDifferential > results.masp) {
    warnings.push({
      level: "error",
      text: "Calculated pressure differential is above MASP.",
    });
  }
  if (
    withSlug &&
    isNum(results.slugPillVol) &&
    isNum(results.totalPillVol) &&
    results.slugPillVol >= results.totalPillVol
  ) {
    warnings.push({
      level: "error",
      text: "Calculated slug volume leaves no remaining pill volume for the spotting schedule.",
    });
  }
  if (withSlug && results.slugFits === false && isNum(results.slugFallOut)) {
    warnings.push({
      level: "",
      text: `Slug exceeds drill string volume at spot depth; ${numberText(results.slugFallOut, 1)} bbl of fallout compensation is applied.`,
    });
  }
  if (!warnings.length) {
    warnings.push({ level: "good", text: "Inputs are sufficient for the primary calculations." });
  }
  byId("warnings").innerHTML = warnings
    .map((warning) => `<div class="warning ${warning.level}">${warning.text}</div>`)
    .join("");
  byId("validityPill").textContent = warnings.some((w) => w.level === "error")
    ? "Needs review"
    : "Calculated";
}

function render() {
  renderModeUi();
  const results = calc();
  renderDerivedOutputs(results);
  renderJobStrip();
  renderScenarioMetrics(results);
  renderKpis(results);
  renderMetrics(results);
  renderProcedureResults(results);
  renderTripTable(results);
  renderSchedule(results);
  renderCement(results);
  renderWarnings(results);
}

function reset(values = defaults) {
  Object.keys(state).forEach((key) => {
    state[key] = values[key] ?? "";
  });
  state.date = values.date ?? new Date().toISOString().slice(0, 10);
  state.sectionType = values.sectionType ?? "Production";
  state.pillMode = values.pillMode === "withSlug" ? "withSlug" : "noSlug";
  document.querySelectorAll("[data-key]").forEach((control) => {
    control.value = inputValue(control.dataset.key);
  });
  render();
}

function initTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
      document
        .querySelectorAll(".tab-panel")
        .forEach((item) => item.classList.remove("active"));
      tab.classList.add("active");
      byId(tab.dataset.tab).classList.add("active");
    });
  });
}

function saveScenario() {
  localStorage.setItem(storageKey, JSON.stringify({ savedAt: new Date().toISOString(), state }));
  byId("saveStatus").textContent = "Saved locally";
  render();
}

function loadSavedScenario() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) {
    byId("saveStatus").textContent = "No saved scenario found";
    return;
  }
  const parsed = JSON.parse(saved);
  reset({ ...defaults, ...(parsed.state || {}) });
  byId("saveStatus").textContent = "Loaded saved scenario";
}

function csvCell(value) {
  const clean = isNum(value) ? String(round(value, 3)) : String(value ?? "");
  return `"${clean.replaceAll('"', '""')}"`;
}

function exportScheduleCsv() {
  if (!scheduleCache.length) render();
  const header = [
    "Step",
    "SBP psi",
    "Flow Rate gpm",
    "Volume bbls",
    "Total Strokes stks",
    "Density In ppg",
    "Static SBP psi",
    "Activity Notes",
  ];
  const rows = scheduleCache.map((row) => [
    row.step,
    row.sbp,
    isNum(row.flow) ? round(row.flow, 3) : "",
    isNum(row.volume) ? round(row.volume, 3) : "",
    isNum(row.strokes) ? round(row.strokes, 3) : "",
    isNum(row.density) ? round(row.density, 3) : "",
    isNum(row.staticSbp) ? round(row.staticSbp, 3) : "",
    row.activityNotes,
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const well = (state.wellName || "mpd-360").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  link.href = url;
  const mode = scheduleMeta.mode === "withSlug" ? "with-slug" : "no-slug";
  link.download = `${well || "mpd-360"}-${mode}-schedule.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
function initActions() {
  document.querySelectorAll('input[name="pillMode"]').forEach((control) => {
    control.addEventListener("change", () => {
      if (!control.checked) return;
      state.pillMode = control.value === "withSlug" ? "withSlug" : "noSlug";
      render();
    });
  });
  byId("showCutoff").addEventListener("change", render);
  byId("loadExample").addEventListener("click", () => reset({ ...defaults, ...example }));
  byId("saveScenario").addEventListener("click", saveScenario);
  byId("loadScenario").addEventListener("click", loadSavedScenario);
  byId("exportSchedule").addEventListener("click", exportScheduleCsv);
  byId("resetInputs").addEventListener("click", () => reset(defaults));
  byId("printReport").addEventListener("click", () => window.print());
}

buildInputs();
initTabs();
initActions();
render();




