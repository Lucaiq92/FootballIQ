window.addEventListener("error", (event) => {
  if (event.target && event.target !== window && event.target.tagName === "IMG") {
    return;
  }
  const status = document.querySelector("#appStatus");
  document.body.classList.remove("is-loading");
  document.body.classList.add("app-error");
  if (status) {
    status.textContent = `Errore caricamento: ${event.message || "script non disponibile"}`;
  }
});

const appData = window.WC_DATA || {};
const {
  teams = [],
  fixtures = [],
  meta = { timezoneUser: "Europe/Rome" },
  squads = {},
  dailyNews = [],
  playerProfiles = {},
} = appData;

const teamById = new Map(teams.map((team) => [team.id, enrichTeam(team)]));
const groupLetters = "ABCDEFGHIJKL".split("");
const mainPanelIds = new Set(["home", "calendar", "groups", "teams", "predictor"]);
const detailPanelIds = new Set(["teamDetail", "matchDetail", "playerDetail"]);
const routeStorageKey = "footballiq.route.v1";
let timeMode = "rome";
let playerDetailBackTarget = "home";

const playerWatchlist = {
  arg: "Lionel Messi",
  bra: "Neymar",
  por: "Cristiano Ronaldo",
  fra: "Kylian Mbappe",
  eng: "Harry Kane",
  ger: "Florian Wirtz",
  esp: "Lamine Yamal",
  cro: "Luka Modric",
  ned: "Cody Gakpo",
  bel: "Kevin De Bruyne",
  nor: "Erling Haaland",
  col: "Luis Diaz",
  mar: "Achraf Hakimi",
  usa: "Christian Pulisic",
  mex: "Santiago Gimenez",
  can: "Jonathan David",
  jpn: "Takefusa Kubo",
  kor: "Son Heung-min",
  uru: "Federico Valverde",
};

const stageLabels = {
  "Group Stage": "Fase a gironi",
  "Round of 32": "Sedicesimi",
  "Round of 16": "Ottavi",
  "Quarter-finals": "Quarti",
  "Semi-finals": "Semifinali",
  "Third place": "Finale 3 posto",
  Final: "Finale",
};

const federationCodes = {
  mex: "FMF",
  rsa: "SAFA",
  kor: "KFA",
  cze: "FACR",
  can: "CAN",
  bih: "NSBIH",
  qat: "QFA",
  sui: "SFA",
  bra: "CBF",
  mar: "FRMF",
  hai: "FHF",
  sco: "SFA",
  usa: "USSF",
  par: "APF",
  aus: "FA",
  tur: "TFF",
  ger: "DFB",
  cur: "FFK",
  civ: "FIF",
  ecu: "FEF",
  ned: "KNVB",
  jpn: "JFA",
  swe: "SvFF",
  tun: "FTF",
  bel: "RBFA",
  egy: "EFA",
  irn: "FFIRI",
  nzl: "NZF",
  esp: "RFEF",
  cpv: "FCF",
  ksa: "SAFF",
  uru: "AUF",
  fra: "FFF",
  sen: "FSF",
  irq: "IFA",
  nor: "NFF",
  arg: "AFA",
  alg: "FAF",
  aut: "OFB",
  jor: "JFA",
  por: "FPF",
  cod: "FECOFA",
  uzb: "UFA",
  col: "FCF",
  eng: "FA",
  cro: "HNS",
  gha: "GFA",
  pan: "FEPAFUT",
};

const selectors = {
  tabs: document.querySelectorAll(".tab"),
  panels: document.querySelectorAll(".panel"),
  stageFilter: document.querySelector("#stageFilter"),
  groupFilter: document.querySelector("#groupFilter"),
  teamFilter: document.querySelector("#teamFilter"),
  matchList: document.querySelector("#matchList"),
  groupGrid: document.querySelector("#groupGrid"),
  teamGrid: document.querySelector("#teamGrid"),
  teamSearch: document.querySelector("#teamSearch"),
  confedFilter: document.querySelector("#confedFilter"),
  confedSelect: document.querySelector("#confedSelect"),
  confedSelectButton: document.querySelector("#confedSelectButton"),
  confedSelectLabel: document.querySelector("#confedSelectLabel"),
  confedMenu: document.querySelector("#confedMenu"),
  matchPredictSelect: document.querySelector("#matchPredictSelect"),
  predictionCard: document.querySelector("#predictionCard"),
  homeBestPick: document.querySelector("#homeBestPick"),
  dailyNewsCard: document.querySelector("#dailyNewsCard"),
  timeModeButton: document.querySelector("#timeModeButton"),
  timeModeLabel: document.querySelector("#timeModeLabel"),
  teamDetail: document.querySelector("#teamDetail"),
  teamDetailBack: document.querySelector("#teamDetailBack"),
  teamDetailFlag: document.querySelector("#teamDetailFlag"),
  teamDetailTitle: document.querySelector("#team-detail-title"),
  teamDetailRating: document.querySelector("#teamDetailRating"),
  teamDetailInfo: document.querySelector("#teamDetailInfo"),
  teamDetailSchedule: document.querySelector("#teamDetailSchedule"),
  teamDetailResults: document.querySelector("#teamDetailResults"),
  teamDetailScorer: document.querySelector("#teamDetailScorer"),
  teamDetailSquad: document.querySelector("#teamDetailSquad"),
  matchDetail: document.querySelector("#matchDetail"),
  matchDetailBack: document.querySelector("#matchDetailBack"),
  matchDetailContent: document.querySelector("#matchDetailContent"),
  playerDetail: document.querySelector("#playerDetail"),
  playerDetailBack: document.querySelector("#playerDetailBack"),
  playerDetailContent: document.querySelector("#playerDetailContent"),
};

function enrichTeam(team) {
  const rankScore = clamp(101 - team.rank * 0.82, 28, 100);
  const titleBoost = Math.min(team.titles * 3.4, 14);
  const hostBoost = team.host ? 4.5 : 0;
  const attack = clamp(Math.round(rankScore * 0.72 + team.form * 0.28 + titleBoost), 38, 96);
  const defense = clamp(Math.round(rankScore * 0.78 + team.form * 0.22 + titleBoost * 0.7), 38, 96);
  const rating = clamp(Math.round(rankScore * 0.42 + team.form * 0.24 + attack * 0.17 + defense * 0.17 + titleBoost + hostBoost), 35, 98);

  return { ...team, attack, defense, rating };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function bootstrap() {
  setupAppMode();
  setupGlobalFallbacks();
  hydrateFilters();
  bindEvents();
  renderCalendar();
  renderGroups();
  renderTeams();
  renderPredictorOptions();
  applyRouteState();
  renderPrediction();
  renderHomeBestPick();
  renderDailyNews();
  enhancePlayerCarousel();
  document.body.classList.remove("is-loading");
  const route = getRouteState();
  ensureRouteInUrl(route);
  syncRouteToView({ scroll: false });
}

function setupAppMode() {
  const standaloneQuery = window.matchMedia("(display-mode: standalone)");
  const updateStandaloneMode = () => {
    const isStandalone = standaloneQuery.matches || window.navigator.standalone === true;
    document.body.classList.toggle("is-standalone", isStandalone);
  };

  updateStandaloneMode();
  if (standaloneQuery.addEventListener) {
    standaloneQuery.addEventListener("change", updateStandaloneMode);
  } else if (standaloneQuery.addListener) {
    standaloneQuery.addListener(updateStandaloneMode);
  }

  const canUseServiceWorker =
    "serviceWorker" in navigator &&
    (window.isSecureContext || ["localhost", "127.0.0.1"].includes(window.location.hostname));

  if (canUseServiceWorker) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {});
    });
  }
}

function setupGlobalFallbacks() {
  document.addEventListener(
    "error",
    (event) => {
      if (event.target && event.target.tagName === "IMG") {
        applyImageFallback(event.target);
      }
    },
    true,
  );

  window.addEventListener("unhandledrejection", () => {
    showAppNotice("Dati in aggiornamento");
  });

  document.querySelectorAll("img").forEach((image) => {
    if (image.complete && image.naturalWidth === 0) {
      applyImageFallback(image);
    }
  });
}

function applyImageFallback(image) {
  if (!image || image.dataset.fallbackApplied === "true") return;

  image.dataset.fallbackApplied = "true";
  image.classList.add("is-broken-image");

  const placeholder = document.createElement("span");
  placeholder.className = "image-placeholder";
  const isTeamFlag =
    image.classList.contains("sticker-flag") ||
    image.closest(".team-tiny, .team-identity-badges, .team-detail-title");
  placeholder.textContent = isTeamFlag ? "FIQ" : "FootballIQ";
  placeholder.setAttribute("aria-hidden", "true");
  image.insertAdjacentElement("afterend", placeholder);
}

function resetImageFallback(image) {
  if (!image) return;

  image.dataset.fallbackApplied = "false";
  image.classList.remove("is-broken-image");

  const placeholder = image.nextElementSibling;
  if (placeholder?.classList.contains("image-placeholder")) {
    placeholder.remove();
  }
}

function showAppNotice(message) {
  const status = document.querySelector("#appStatus");
  if (!status) return;

  status.textContent = message;
  status.style.display = "block";
}

function bindEvents() {
  selectors.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      if (tab.dataset.tab === "teams") {
        delete selectors.teamDetail.dataset.teamId;
      }
      showPanel(tab.dataset.tab, { updateRoute: true });
    });
  });

  window.addEventListener("hashchange", () => {
    syncRouteToView({ scroll: false });
  });
  window.addEventListener("popstate", () => {
    syncRouteToView({ scroll: false });
  });

  [selectors.stageFilter, selectors.groupFilter, selectors.teamFilter].forEach((filter) => {
    filter.addEventListener("change", renderCalendar);
  });

  selectors.teamSearch.addEventListener("input", renderTeams);
  selectors.confedFilter.addEventListener("change", () => {
    updateConfedSelect();
    renderTeams();
  });
  selectors.confedSelectButton.addEventListener("click", () => {
    const isOpen = selectors.confedSelect.classList.toggle("is-open");
    selectors.confedSelectButton.setAttribute("aria-expanded", String(isOpen));
  });
  selectors.confedMenu.addEventListener("click", (event) => {
    const option = event.target.closest("[data-confed-option]");
    if (!option) return;
    selectors.confedFilter.value = option.dataset.confedOption;
    selectors.confedFilter.dispatchEvent(new Event("change"));
    selectors.confedSelect.classList.remove("is-open");
    selectors.confedSelectButton.setAttribute("aria-expanded", "false");
  });
  document.addEventListener("click", (event) => {
    if (!selectors.confedSelect.contains(event.target)) {
      selectors.confedSelect.classList.remove("is-open");
      selectors.confedSelectButton.setAttribute("aria-expanded", "false");
    }
  });
  selectors.matchPredictSelect.addEventListener("change", () => {
    renderPrediction();
    if (getRouteState().panel === "predictor") {
      updateRoute("predictor");
    }
  });
  selectors.matchList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-match-link]");
    if (button && !button.disabled) {
      openMatchDetail(Number(button.dataset.matchLink));
    }
  });
  selectors.groupGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-team-link]");
    if (button) {
      openTeamDetail(button.dataset.teamLink);
    }
  });
  selectors.teamGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-team-link]");
    if (button) {
      openTeamDetail(button.dataset.teamLink);
    }
  });
  selectors.teamDetailBack.addEventListener("click", () => {
    delete selectors.teamDetail.dataset.teamId;
    showPanel("teams", { updateRoute: true });
  });
  selectors.matchDetailBack.addEventListener("click", () => showPanel("calendar", { updateRoute: true }));
  selectors.playerDetailBack.addEventListener("click", () => {
    showPanel(playerDetailBackTarget, { updateRoute: playerDetailBackTarget === "home" });
  });
  selectors.teamDetailSquad.addEventListener("click", (event) => {
    const button = event.target.closest("[data-squad-player]");
    if (!button) return;
    openSquadPlayerDetail(button.dataset.squadPlayer, button.dataset.teamId, button.dataset.role);
  });
  selectors.timeModeButton.addEventListener("click", () => {
    timeMode = timeMode === "rome" ? "et" : "rome";
    selectors.timeModeLabel.textContent = timeMode === "rome" ? "Italia" : "ET";
    renderCalendar();
    renderPrediction();
    renderHomeBestPick();
    const activePlayerId = selectors.playerDetail.dataset.playerId;
    if (activePlayerId && playerProfiles?.[activePlayerId]) {
      selectors.playerDetailContent.innerHTML = renderPlayerProfile(playerProfiles[activePlayerId]);
    }
  });
}

function enhancePlayerCarousel() {
  const carousel = document.querySelector(".player-carousel");
  if (!carousel) return;

  const slides = [...carousel.querySelectorAll(".player-slide")];
  if (!slides.length) return;

  const openSlidePlayer = (slide) => {
    if (slide?.dataset.player) {
      openPlayerDetail(slide.dataset.player);
    }
  };

  slides.forEach((slide) => {
    slide.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openSlidePlayer(slide);
    });
    slide.addEventListener("keydown", (event) => {
      if (!["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      openSlidePlayer(slide);
    });
  });

  carousel.addEventListener("click", (event) => {
    openSlidePlayer(event.target.closest("[data-player]"));
  });

  carousel.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    const slide = event.target.closest("[data-player]");
    if (!slide) return;
    event.preventDefault();
    openSlidePlayer(slide);
  });

  let frame = 0;
  const updateActiveSlide = () => {
    frame = 0;
    const carouselBox = carousel.getBoundingClientRect();
    const center = carouselBox.left + carouselBox.width / 2;
    let activeSlide = slides[0];
    let activeDistance = Number.POSITIVE_INFINITY;

    slides.forEach((slide) => {
      const box = slide.getBoundingClientRect();
      const slideCenter = box.left + box.width / 2;
      const distance = slideCenter - center;
      const strength = Math.max(-28, Math.min(28, distance / 10));

      slide.style.setProperty("--parallax-shift", `${strength * 0.16}px`);
      slide.style.setProperty("--parallax-tilt", `${strength * -0.12}deg`);
      if (Math.abs(distance) < activeDistance) {
        activeDistance = Math.abs(distance);
        activeSlide = slide;
      }
    });

    slides.forEach((slide) => {
      slide.classList.toggle("is-active", slide === activeSlide);
    });
  };

  const requestUpdate = () => {
    if (!frame) {
      frame = window.requestAnimationFrame(updateActiveSlide);
    }
  };

  carousel.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
  updateActiveSlide();
}

function showPanel(panelId, options = {}) {
  const targetPanelId = mainPanelIds.has(panelId) || detailPanelIds.has(panelId) ? panelId : "home";
  document.body.classList.toggle("home-active", targetPanelId === "home");
  selectors.panels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.id === targetPanelId);
  });

  if (options.updateRoute && mainPanelIds.has(targetPanelId)) {
    updateRoute(targetPanelId);
  }

  syncActiveTab(targetPanelId);

  if (options.scroll === false) {
    return;
  }
  if (targetPanelId !== "teamDetail") {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function syncRouteToView(options = {}) {
  const route = applyRouteState();
  renderPrediction();

  if (route.panel === "teams" && route.teamId) {
    openTeamDetail(route.teamId, { updateRoute: false, scroll: options.scroll });
    return;
  }

  showPanel(route.panel, { scroll: options.scroll, updateRoute: false });
}

function syncActiveTab(panelId = getVisibleMainPanelId()) {
  const route = getRouteState();
  const activePanelId = mainPanelIds.has(panelId) ? panelId : route.panel;

  selectors.tabs.forEach((item) => {
    item.classList.toggle("is-active", item.dataset.tab === activePanelId);
  });
}

function getVisibleMainPanelId() {
  const activePanel = [...selectors.panels].find((panel) => panel.classList.contains("is-active"));
  if (activePanel && mainPanelIds.has(activePanel.id)) {
    return activePanel.id;
  }

  return getRouteState().panel;
}

function getRouteState() {
  const rawHash = window.location.hash.replace(/^#/, "");
  const route = parseRoute(rawHash || readStoredRoute());

  return route;
}

function parseRoute(value) {
  const [panelPart, queryPart = ""] = String(value || "").replace(/^#/, "").split("?");
  const params = new URLSearchParams(queryPart);
  const panel = mainPanelIds.has(panelPart) ? panelPart : "home";
  const matchId = Number(params.get("match"));
  const teamId = params.get("team");

  return {
    panel,
    matchId: Number.isFinite(matchId) ? matchId : null,
    teamId: teamId && teamById.has(teamId) ? teamId : null,
  };
}

function updateRoute(panelId) {
  const targetPanelId = mainPanelIds.has(panelId) ? panelId : "home";
  const nextHash = buildRouteHash(targetPanelId);
  storeRoute(nextHash);

  if (window.location.hash !== nextHash) {
    window.history.pushState(null, "", nextHash);
  }

  syncActiveTab(targetPanelId);
}

function applyRouteState() {
  const route = getRouteState();
  if (route.panel === "predictor" && route.matchId && selectors.matchPredictSelect) {
    const hasOption = [...selectors.matchPredictSelect.options].some((option) => Number(option.value) === route.matchId);
    if (hasOption) {
      selectors.matchPredictSelect.value = String(route.matchId);
    }
  }
  storeRoute(window.location.hash || buildRouteHash(route.panel, route));
  return route;
}

function buildRouteHash(panelId, route = {}) {
  const targetPanelId = mainPanelIds.has(panelId) ? panelId : "home";
  const params = new URLSearchParams();

  if (targetPanelId === "predictor" && selectors.matchPredictSelect.value) {
    params.set("match", selectors.matchPredictSelect.value);
  }

  if (targetPanelId === "teams") {
    const currentTeamId = route.teamId || selectors.teamDetail?.dataset.teamId;
    if (currentTeamId && teamById.has(currentTeamId)) {
      params.set("team", currentTeamId);
    }
  }

  const query = params.toString();
  return `#${targetPanelId}${query ? `?${query}` : ""}`;
}

function updateTeamRoute(teamId) {
  if (!teamId || !teamById.has(teamId)) return;

  const nextHash = `#teams?team=${encodeURIComponent(teamId)}`;
  storeRoute(nextHash);

  if (window.location.hash !== nextHash) {
    window.history.pushState(null, "", nextHash);
  }

  syncActiveTab("teams");
}

function ensureRouteInUrl(route) {
  if (window.location.hash || !route || route.panel === "home") return;

  const nextHash = buildRouteHash(route.panel, route);
  window.history.replaceState(null, "", nextHash);
}

function storeRoute(hash) {
  try {
    window.localStorage.setItem(routeStorageKey, hash);
  } catch (error) {}
}

function readStoredRoute() {
  try {
    return window.localStorage.getItem(routeStorageKey) || "";
  } catch (error) {
    return "";
  }
}

function releaseFocusedControl() {
  const active = document.activeElement;
  if (active && ["INPUT", "SELECT", "TEXTAREA"].includes(active.tagName)) {
    active.blur();
  }
}

function hydrateFilters() {
  fillSelect(selectors.stageFilter, [
    ["all", "Tutte le fasi"],
    ...unique(fixtures.map((fixture) => fixture.stage)).map((stage) => [stage, stageLabels[stage] || stage]),
  ]);

  fillSelect(selectors.groupFilter, [
    ["all", "Tutti i gironi"],
    ...groupLetters.map((group) => [group, `Girone ${group}`]),
  ]);

  fillSelect(selectors.teamFilter, [
    ["all", "Tutte le squadre"],
    ...teams
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "it"))
      .map((team) => [team.id, team.name]),
  ]);

  const confeds = unique(teams.map((team) => team.confed)).sort();
  fillSelect(selectors.confedFilter, [["all", "Tutte"], ...confeds.map((confed) => [confed, confed])]);
  renderConfedMenu(confeds);
  updateConfedSelect();
}

function fillSelect(select, options) {
  select.innerHTML = options.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
}

function unique(values) {
  return [...new Set(values)];
}

function renderEmptyState(title = "Dati in aggiornamento", message = "Riprova tra poco.") {
  return `
    <div class="empty-state">
      <strong>${title}</strong>
      <span>${message}</span>
    </div>
  `;
}

function renderConfedMenu(confeds) {
  const options = ["all", ...confeds];
  selectors.confedMenu.innerHTML = options
    .map(
      (confed) => `
        <button type="button" data-confed-option="${confed}">
          ${renderConfedBadge(confed)}
          <span>${confed === "all" ? "Tutte" : confed}</span>
        </button>
      `,
    )
    .join("");
}

function updateConfedSelect() {
  const confed = selectors.confedFilter.value || "all";
  selectors.confedSelectLabel.textContent = confed === "all" ? "Tutte" : confed;
  selectors.confedSelectButton.querySelector(".confed-badge").outerHTML = renderConfedBadge(confed);
  selectors.confedMenu.querySelectorAll("[data-confed-option]").forEach((option) => {
    option.classList.toggle("is-selected", option.dataset.confedOption === confed);
  });
}

function renderConfedBadge(confed) {
  const label = confed === "all" ? "ALL" : confed;
  return `<span class="confed-badge confed-${confed.toLowerCase()}">${label}</span>`;
}

function renderCalendar() {
  if (!fixtures.length) {
    selectors.matchList.innerHTML = renderEmptyState("Dati in aggiornamento", "Il calendario verra mostrato appena i dati saranno disponibili.");
    return;
  }

  const stage = selectors.stageFilter.value;
  const group = selectors.groupFilter.value;
  const team = selectors.teamFilter.value;

  const filtered = fixtures.filter((fixture) => {
    const stageMatch = stage === "all" || fixture.stage === stage;
    const groupMatch = group === "all" || fixture.group === group;
    const teamMatch = team === "all" || fixture.home === team || fixture.away === team;
    return stageMatch && groupMatch && teamMatch;
  });

  selectors.matchList.innerHTML = filtered.length
    ? filtered.map(renderMatchCard).join("")
    : renderEmptyState("Partita non disponibile", "Nessuna partita corrisponde ai filtri selezionati.");
}

function renderMatchCard(fixture) {
  const home = fixture.home ? teamById.get(fixture.home) : null;
  const away = fixture.away ? teamById.get(fixture.away) : null;
  const date = formatFixtureDate(fixture);
  const labelHome = home ? renderTeamTiny(home) : `<strong>${fixture.homeLabel}</strong>`;
  const labelAway = away ? renderTeamTiny(away) : `<strong>${fixture.awayLabel}</strong>`;
  const groupBadge = fixture.group ? `<span class="badge">Girone ${fixture.group}</span>` : "";
  const prediction = home && away ? calculatePrediction(home, away) : null;
  const probability = prediction ? prediction.primary.probability : 0;
  const lean = prediction
    ? `<span class="lean ${confidenceClass(probability)}">Indice IQ ${prediction.pickSign} ${Math.round(probability * 100)}%</span>`
    : "";
  const detailDisabled = home && away ? "" : "disabled";
  const detailLabel = home && away ? `Apri dettaglio ${home.name} contro ${away.name}` : "Partita da definire";

  return `
    <button class="match-card match-link-card" type="button" data-match-link="${fixture.id}" aria-label="${detailLabel}" ${detailDisabled}>
      <div class="match-meta">
        <span class="match-number">#${fixture.id}</span>
        <span>${stageLabels[fixture.stage] || fixture.stage}</span>
        ${groupBadge}
      </div>
      <div class="match-main">
        <div class="match-teams">
          ${labelHome}
          <span class="versus">vs</span>
          ${labelAway}
        </div>
        ${lean}
      </div>
      <div class="match-foot">
        <span>${date}</span>
        <span>${fixture.venue}, ${fixture.city}</span>
      </div>
    </button>
  `;
}

function renderTeamTiny(team) {
  return `
    <span class="team-tiny">
      <img src="${flagUrl(team.flag)}" alt="" loading="lazy" />
      <strong>${team.name}</strong>
    </span>
  `;
}

function flagUrl(flag, size = "64x48") {
  return `https://flagcdn.com/${size}/${flag}.png`;
}

function formatFixtureDate(fixture) {
  const date = getFixtureDate(fixture);
  const timeZone = timeMode === "rome" ? meta.timezoneUser : "America/New_York";
  const datePart = new Intl.DateTimeFormat("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone,
  }).format(date);
  const timePart = new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);

  return `${datePart} · ${timePart} ${timeMode === "rome" ? "IT" : "ET"}`;
}

function getFixtureDate(fixture) {
  return new Date(`${fixture.date}T${fixture.timeET}:00-04:00`);
}

function renderGroups() {
  if (!teams.length) {
    selectors.groupGrid.innerHTML = renderEmptyState("Dati in aggiornamento", "I gironi saranno visibili appena le squadre saranno disponibili.");
    return;
  }

  selectors.groupGrid.innerHTML = groupLetters.map(renderGroupCard).join("");
}

function renderGroupCard(group) {
  const groupTeams = teams
    .filter((team) => team.group === group)
    .map((team) => teamById.get(team.id));
  const projections = projectGroup(groupTeams);

  return `
    <article class="group-card">
      <div class="group-title">
        <h3>Girone ${group}</h3>
        <span>${groupTeams.length} squadre</span>
      </div>
      <div class="standing">
        ${projections
          .map(
            (row, index) => `
              <button class="standing-row team-link-row" type="button" data-team-link="${row.team.id}">
                <span class="position">${index + 1}</span>
                ${renderTeamTiny(row.team)}
                <span class="points">${row.points.toFixed(1)} pt</span>
              </button>
            `,
          )
          .join("")}
      </div>
    </article>
  `;
}

function projectGroup(groupTeams) {
  const table = groupTeams.map((team) => ({ team, points: 0, goalIndex: 0 }));

  for (let i = 0; i < groupTeams.length; i += 1) {
    for (let j = i + 1; j < groupTeams.length; j += 1) {
      const a = groupTeams[i];
      const b = groupTeams[j];
      const prediction = calculatePrediction(a, b);
      const rowA = table.find((row) => row.team.id === a.id);
      const rowB = table.find((row) => row.team.id === b.id);
      rowA.points += prediction.homeWin * 3 + prediction.draw;
      rowB.points += prediction.awayWin * 3 + prediction.draw;
      rowA.goalIndex += prediction.homeWin - prediction.awayWin;
      rowB.goalIndex += prediction.awayWin - prediction.homeWin;
    }
  }

  return table.sort((a, b) => b.points - a.points || b.goalIndex - a.goalIndex || a.team.rank - b.team.rank);
}

function renderTeams() {
  if (!teams.length) {
    selectors.teamGrid.innerHTML = renderEmptyState("Dati in aggiornamento", "Le schede squadra saranno visibili appena i dati saranno disponibili.");
    return;
  }

  const search = selectors.teamSearch.value.trim().toLowerCase();
  const confed = selectors.confedFilter.value;
  const filtered = teams
    .map((team) => teamById.get(team.id))
    .filter((team) => {
      const searchMatch = !search || `${team.name} ${team.fifaName}`.toLowerCase().includes(search);
      const confedMatch = confed === "all" || team.confed === confed;
      return searchMatch && confedMatch;
    })
    .sort((a, b) => a.rank - b.rank);

  selectors.teamGrid.innerHTML = filtered.length
    ? filtered.map(renderTeamCard).join("")
    : renderEmptyState("Dati in aggiornamento", "Nessuna squadra corrisponde ai filtri selezionati.");
}

function renderTeamCard(team) {
  return `
    <button class="team-card team-link-card" type="button" data-team-link="${team.id}">
      <div class="team-card-head">
        <div class="team-identity-badges">
          <img src="${flagUrl(team.flag)}" alt="Bandiera ${team.name}" loading="lazy" />
        </div>
        <div>
          <h3>${team.name}</h3>
          <span>Girone ${team.group} - ${team.confed}</span>
        </div>
      </div>
      <div class="team-metrics">
        <div>
          <span>Ranking</span>
          <strong>${team.rank}</strong>
        </div>
        <div>
          <span>Titoli</span>
          <strong>${team.titles}</strong>
        </div>
        <div>
          <span>Indice</span>
          <strong>${team.rating}</strong>
        </div>
      </div>
      ${renderMeter("Forma", team.form)}
      ${renderMeter("Attacco", team.attack)}
      ${renderMeter("Difesa", team.defense)}
      <p class="style-pill">${team.style}</p>
    </button>
  `;
}

function renderMeter(label, value) {
  return `
    <div class="meter">
      <div class="meter-label">
        <span>${label}</span>
        <strong>${value}</strong>
      </div>
      <div class="meter-track">
        <span style="width: ${value}%"></span>
      </div>
    </div>
  `;
}

function renderPredictorOptions() {
  const groupFixtures = fixtures.filter((fixture) => fixture.home && fixture.away);
  if (!groupFixtures.length) {
    selectors.matchPredictSelect.innerHTML = `<option value="">Partita non disponibile</option>`;
    return;
  }

  selectors.matchPredictSelect.innerHTML = groupFixtures
    .map((fixture) => {
      const home = teamById.get(fixture.home);
      const away = teamById.get(fixture.away);
      return `<option value="${fixture.id}">#${fixture.id} ${home.name} - ${away.name}</option>`;
    })
    .join("");
}

function renderPrediction() {
  if (!fixtures.length || !selectors.matchPredictSelect.value) {
    selectors.predictionCard.innerHTML = renderEmptyState("Dati in aggiornamento", "AnalisiIQ sara disponibile appena il calendario sara caricato.");
    return;
  }

  const fixtureId = Number(selectors.matchPredictSelect.value);
  const fixture = fixtures.find((item) => item.id === fixtureId);
  const model = buildMatchModel(fixture);
  if (!model) {
    selectors.predictionCard.innerHTML = renderEmptyState("Partita non disponibile", "Scegli una partita con due squadre gia definite.");
    return;
  }

  selectors.predictionCard.innerHTML = `
    <div class="prediction-head">
      <span class="match-number">#${fixture.id}</span>
      <span>${formatFixtureDate(fixture)}</span>
    </div>
    <div class="prediction-teams">
      ${renderPredictionTeam(model.home, model.prediction.homeWin, model.expectedGoals.home, "1")}
      <div class="draw-box">
        <span class="outcome-label">Pareggio</span>
        <strong class="${confidenceClass(model.prediction.draw)}">${Math.round(model.prediction.draw * 100)}%</strong>
        <span>Pareggio</span>
        <div class="probability-track draw-track">
          <span class="${confidenceClass(model.prediction.draw)}" style="width: ${Math.round(model.prediction.draw * 100)}%"></span>
        </div>
      </div>
      ${renderPredictionTeam(model.away, model.prediction.awayWin, model.expectedGoals.away, "2")}
    </div>
    <div class="suggestions">
      <article>
        <span>Pronostico consigliato</span>
        <strong class="confidence-pill ${model.confidenceClass}">${model.prediction.pickIq} - ${model.prediction.pick} ${model.probabilityPercent}%</strong>
      </article>
      <article>
        <span>Alternativa prudente</span>
        <strong>${model.prediction.doubleChance}</strong>
      </article>
      <article>
        <span>xG stimato</span>
        <strong>${model.expectedGoals.home.toFixed(2)} - ${model.expectedGoals.away.toFixed(2)}</strong>
      </article>
      <article>
        <span>Expected Goal Line</span>
        <strong>${model.goalSuggestion}</strong>
      </article>
      <article>
        <span>Confidence Level</span>
        <strong>${model.confidence}%</strong>
      </article>
    </div>
    <div class="reasoning">
      <h3>Lettura</h3>
      <p>${model.prediction.reason} ${model.expectedGoals.note}</p>
    </div>
  `;
}

function renderHomeBestPick() {
  const firstRound = fixtures.filter((fixture) => fixture.id <= 24 && fixture.home && fixture.away);
  if (!firstRound.length) {
    selectors.homeBestPick.innerHTML = renderEmptyState("Dati in aggiornamento", "AnalisiIQ della giornata verra mostrata appena ci saranno partite disponibili.");
    return;
  }

  const picks = firstRound.map((fixture) => {
    const home = teamById.get(fixture.home);
    const away = teamById.get(fixture.away);
    const prediction = calculatePrediction(home, away);
    const probability = prediction.primary.probability;
    return { fixture, home, away, prediction, probability };
  });
  const best = picks.sort((a, b) => b.probability - a.probability)[0];
  if (!best) {
    selectors.homeBestPick.innerHTML = renderEmptyState("Partita non disponibile", "Nessuna partita analizzabile al momento.");
    return;
  }

  selectors.homeBestPick.innerHTML = `
    <p class="eyebrow home-pick-eyebrow">${renderAnalisiIQWordmark()} 1 giornata</p>
    <div class="home-pick-match">
      ${renderTeamTiny(best.home)}
      <span class="versus">vs</span>
      ${renderTeamTiny(best.away)}
    </div>
    <div class="home-pick-result">
      <span>INSIGHT IQ</span>
      <strong>Insight ${best.prediction.pickSign} - ${best.prediction.pick}</strong>
    </div>
    <div class="home-pick-data">
      <span>${formatFixtureDate(best.fixture)}</span>
      <span>Probabilita ${Math.round(best.probability * 100)}%</span>
    </div>
  `;
}

function renderDailyNews() {
  if (!selectors.dailyNewsCard) return;
  if (!dailyNews.length) {
    selectors.dailyNewsCard.innerHTML = renderEmptyState("Dati in aggiornamento", "Le news saranno mostrate appena disponibili.");
    return;
  }

  const today = getLocalDateKey(new Date());
  const ordered = dailyNews
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || (b.priority || 0) - (a.priority || 0));
  const mainNews = ordered.find((item) => item.date <= today) || ordered[0];
  const relatedNews = ordered.filter((item) => item.id !== mainNews.id).slice(0, 2);
  const sourceLink = mainNews.url
    ? `<a href="${mainNews.url}" target="_blank" rel="noopener noreferrer">Fonte ${mainNews.source}</a>`
    : `<span>${mainNews.source}</span>`;

  const media = renderDailyNewsMedia(mainNews);

  selectors.dailyNewsCard.innerHTML = `
    ${media}
    <div class="daily-news-head">
      <div>
        <p class="eyebrow">NEWS</p>
        <div class="daily-news-time">
          <span>${formatNewsDate(mainNews.date)}</span>
          ${mainNews.publishedAgo ? `<span>${mainNews.publishedAgo}</span>` : ""}
        </div>
      </div>
      <div class="daily-news-badges">
        ${mainNews.badge ? `<strong class="news-live-badge">${mainNews.badge}</strong>` : ""}
        <strong>${mainNews.tag}</strong>
      </div>
    </div>
    <h2>${mainNews.title}</h2>
    <p>${mainNews.summary}</p>
    <div class="daily-news-actions">
      ${sourceLink}
    </div>
    ${
      relatedNews.length
        ? `<div class="daily-news-list">
            ${relatedNews
              .map(
                (item) => `
                  <a href="${item.url}" target="_blank" rel="noopener noreferrer">
                    ${renderDailyNewsThumb(item)}
                    <span>${item.tag}</span>
                    <strong>${item.title}</strong>
                    ${item.publishedAgo ? `<small>${item.publishedAgo}</small>` : ""}
                  </a>
                `,
              )
              .join("")}
          </div>`
        : ""
    }
  `;
}

function renderDailyNewsMedia(item) {
  if (item.logoText) {
    return `<div class="daily-news-logo-panel"><strong>${item.logoText}</strong><span>${item.logoSub || "World Cup"}</span></div>`;
  }

  if (item.image) {
    return `<div class="daily-news-media"><img src="${item.image}" alt="${item.imageAlt || item.title}" loading="lazy" decoding="async" /></div>`;
  }

  return `<div class="daily-news-logo-panel"><strong>NEWS</strong><span>${item.tag || "World Cup"}</span></div>`;
}

function renderDailyNewsThumb(item) {
  if (item.image) {
    return `<img src="${item.image}" alt="${item.imageAlt || item.title}" loading="lazy" decoding="async" />`;
  }

  return `<span class="daily-news-list-logo">${item.logoText || "NEWS"}</span>`;
}

function renderAnalisiIQWordmark() {
  return `<span class="analisi-wordmark">Analisi<span class="iq-cluster"><span class="iq-ball-i">I</span>Q</span></span>`;
}

function getLocalDateKey(date) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: meta.timezoneUser || "Europe/Rome",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatNewsDate(value) {
  if (!value) return "Aggiornamento";

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function renderPredictionTeam(team, probability, expectedGoal, sign) {
  return `
    <article class="prediction-team">
      <span class="outcome-label">Segno ${sign}</span>
      <img src="${flagUrl(team.flag)}" alt="" />
      <h3>${team.name}</h3>
      <strong class="${confidenceClass(probability)}">${Math.round(probability * 100)}%</strong>
      <div class="probability-track">
        <span class="${confidenceClass(probability)}" style="width: ${Math.round(probability * 100)}%"></span>
      </div>
      <small>xG ${expectedGoal.toFixed(2)} | Indice ${team.rating} | ranking ${team.rank}</small>
    </article>
  `;
}

function calculatePrediction(home, away) {
  const diff = home.rating - away.rating + (home.host ? 2.5 : 0) - (away.host ? 2.5 : 0);
  const draw = clamp(0.25 - Math.abs(diff) * 0.0028, 0.14, 0.29);
  const homeShare = 1 / (1 + Math.exp(-diff / 13));
  const homeWin = (1 - draw) * homeShare;
  const awayWin = 1 - draw - homeWin;
  const outcomes = {
    home: { sign: "1", label: home.name, probability: homeWin },
    draw: { sign: "X", label: "Pareggio", probability: draw },
    away: { sign: "2", label: away.name, probability: awayWin },
  };
  const primary = [outcomes.home, outcomes.draw, outcomes.away].reduce((best, outcome) =>
    outcome.probability > best.probability ? outcome : best,
  );
  const pick = primary.label;
  const pickSign = primary.sign;
  
    const pickIq = pickSign === "1"
  ? "Preview Casa"
  : pickSign === "2"
    ? "Preview Trasferta"
    : "Preview Pareggio";

const doubleChance =
  pickSign === "1"
    ? `${home.name} o pareggio`
    : pickSign === "2"
      ? `${away.name} o pareggio`
      : `${home.name} o ${away.name}`;
  const stronger = homeWin >= awayWin ? home : away;
  const weaker = homeWin >= awayWin ? away : home;
  const reason = `${stronger.name} parte avanti per indice complessivo (${stronger.rating} contro ${weaker.rating}), con peso principale su ranking FIFA, forma e solidita difensiva.`;

  return { homeWin, draw, awayWin, pick, pickSign, pickIq, doubleChance, reason, outcomes, primary };
}

function buildMatchModel(fixture) {
  if (!fixture) return null;

  const home = teamById.get(fixture.home);
  const away = teamById.get(fixture.away);
  if (!home || !away) return null;

  const prediction = calculatePrediction(home, away);
  const expectedGoals = calculateExpectedGoals(home, away, fixture);
  const probability = prediction.primary.probability;
  const confidence = clamp(Math.round((probability - prediction.draw) * 100), 8, 74);
  const totalXg = expectedGoals.home + expectedGoals.away;
  const goalSuggestion = totalXg > 2.4 ? "Over 2.5" : "Under 2.5";

  return {
    fixture,
    home,
    away,
    prediction,
    expectedGoals,
    probability,
    probabilityPercent: Math.round(probability * 100),
    confidence,
    confidenceClass: confidenceClass(probability),
    goalSuggestion,
  };
}

function confidenceClass(probability) {
  if (probability >= 0.67) return "confidence-high";
  if (probability >= 0.56) return "confidence-mid";
  return "confidence-low";
}

function calculateExpectedGoals(home, away, fixture) {
  const homeTrend = getPreviousTournamentStats(home.id, fixture);
  const awayTrend = getPreviousTournamentStats(away.id, fixture);

  const homeBase =
    1.18 +
    (home.attack - away.defense) * 0.018 +
    (home.form - away.form) * 0.006 +
    (home.rating - away.rating) * 0.01 +
    (home.host ? 0.12 : 0);
  const awayBase =
    1.02 +
    (away.attack - home.defense) * 0.018 +
    (away.form - home.form) * 0.006 +
    (away.rating - home.rating) * 0.01 +
    (away.host ? 0.12 : 0);

  const homeXg = clamp(homeBase + getLiveXgModifier(homeTrend, awayTrend), 0.25, 3.4);
  const awayXg = clamp(awayBase + getLiveXgModifier(awayTrend, homeTrend), 0.25, 3.4);
  const hasLiveData = homeTrend.matches > 0 || awayTrend.matches > 0;
  const note = hasLiveData
    ? "L'xG include anche le partite gia giocate prima di questa gara."
    : "L'xG ora usa ranking, forma, attacco e difesa; durante il Mondiale si aggiornera con i risultati inseriti partita dopo partita.";

  return { home: homeXg, away: awayXg, note };
}

function getLiveXgModifier(teamTrend, opponentTrend) {
  const attackTrend = teamTrend.matches ? (teamTrend.goalsFor / teamTrend.matches - 1.25) * 0.22 : 0;
  const opponentDefTrend = opponentTrend.matches ? (opponentTrend.goalsAgainst / opponentTrend.matches - 1.15) * 0.18 : 0;
  return attackTrend + opponentDefTrend;
}

function getPreviousTournamentStats(teamId, fixture) {
  const cutoff = getFixtureDate(fixture);
  const completed = fixtures.filter((item) => {
    const involvesTeam = item.home === teamId || item.away === teamId;
    return involvesTeam && item.score && getFixtureDate(item) < cutoff;
  });

  return completed.reduce(
    (stats, item) => {
      const isHome = item.home === teamId;
      stats.matches += 1;
      stats.goalsFor += isHome ? item.score.home : item.score.away;
      stats.goalsAgainst += isHome ? item.score.away : item.score.home;
      return stats;
    },
    { matches: 0, goalsFor: 0, goalsAgainst: 0 },
  );
}

function openMatchDetail(fixtureId) {
  const fixture = fixtures.find((item) => item.id === fixtureId);
  const model = fixture ? buildMatchModel(fixture) : null;
  if (!model) {
    selectors.matchDetailContent.innerHTML = renderEmptyState("Partita non disponibile", "La partita selezionata non e disponibile in questo momento.");
    showPanel("matchDetail");
    return;
  }

  selectors.matchPredictSelect.value = String(fixture.id);
  selectors.matchDetailContent.innerHTML = renderMatchDetail(model);
  showPanel("matchDetail");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderMatchDetail(model) {
  const { fixture, home, away, prediction, expectedGoals } = model;
  return `
    <div class="match-detail-hero">
      <div class="match-detail-title">
        <p class="eyebrow">#${fixture.id} | ${stageLabels[fixture.stage] || fixture.stage}</p>
        <h2 id="match-detail-title">${home.name} vs ${away.name}</h2>
        <div class="match-detail-meta">
          <span>${formatFixtureDate(fixture)}</span>
          <span>${fixture.venue}, ${fixture.city}</span>
        </div>
      </div>
      <div class="match-pick-score ${model.confidenceClass}">
        <span>Insight ${prediction.pickSign}</span>
        <strong>${prediction.pick}</strong>
        <small>${model.probabilityPercent}%</small>
      </div>
    </div>
    <div class="match-detail-grid">
      <article class="detail-block match-prediction-block">
        <h3>${renderAnalisiIQWordmark()}</h3>
        <div class="match-sign-grid">
          ${renderSignBox("1", home.name, prediction.homeWin)}
          ${renderSignBox("X", "Pareggio", prediction.draw)}
          ${renderSignBox("2", away.name, prediction.awayWin)}
        </div>
        <div class="suggestions compact-suggestions">
          <article>
            <span>Insight</span>
            <strong class="confidence-pill ${model.confidenceClass}">${prediction.pickIq} - ${prediction.pick}</strong>
          </article>
          <article>
            <span>Prudente</span>
            <strong>${prediction.doubleChance}</strong>
          </article>
          <article>
            <span>Confidence Level</span>
            <strong>${model.confidence}%</strong>
          </article>
          <article>
            <span>Expected Goal Line</span>
            <strong>${model.goalSuggestion}</strong>
          </article>
        </div>
        <div class="reasoning">
          <h3>Lettura</h3>
          <p>${prediction.reason} ${expectedGoals.note}</p>
        </div>
      </article>
      <article class="detail-block">
        <h3>xG stimato</h3>
        <div class="match-xg-grid">
          ${renderXgTeam(home, prediction.homeWin, expectedGoals.home)}
          ${renderXgTeam(away, prediction.awayWin, expectedGoals.away)}
        </div>
      </article>
      <article class="detail-block">
        <h3>Statistiche ${home.name}</h3>
        ${renderMatchTeamStats(home)}
      </article>
      <article class="detail-block">
        <h3>Statistiche ${away.name}</h3>
        ${renderMatchTeamStats(away)}
      </article>
    </div>
  `;
}

function renderSignBox(sign, label, probability) {
  return `
    <article class="sign-box ${confidenceClass(probability)}">
      <span>Insight ${sign}</span>
      <strong>${Math.round(probability * 100)}%</strong>
      <small>${label}</small>
    </article>
  `;
}

function renderXgTeam(team, probability, xg) {
  return `
    <div class="xg-team">
      ${renderTeamTiny(team)}
      <strong>${xg.toFixed(2)}</strong>
      <span>xG | vittoria ${Math.round(probability * 100)}%</span>
    </div>
  `;
}

function renderMatchTeamStats(team) {
  return `
    <div class="detail-list">
      <div><span>Ranking FIFA</span><strong>${team.rank}</strong></div>
      <div><span>Indice</span><strong>${team.rating}</strong></div>
      <div><span>Forma</span><strong>${team.form}/100</strong></div>
      <div><span>Attacco</span><strong>${team.attack}/100</strong></div>
      <div><span>Difesa</span><strong>${team.defense}/100</strong></div>
      <div><span>Stile</span><strong>${team.style}</strong></div>
    </div>
  `;
}

function openTeamDetail(teamId, options = {}) {
  const team = teamById.get(teamId);
  if (!team) {
    delete selectors.teamDetail.dataset.teamId;
    selectors.teamDetailFlag.removeAttribute("src");
    selectors.teamDetailFlag.alt = "";
    resetImageFallback(selectors.teamDetailFlag);
    selectors.teamDetailTitle.textContent = "Squadra non disponibile";
    selectors.teamDetailRating.textContent = "--";
    selectors.teamDetailInfo.innerHTML = renderEmptyState("Dati in aggiornamento", "La squadra selezionata non e disponibile in questo momento.");
    showPanel("teamDetail", { scroll: options.scroll });
    return;
  }

  releaseFocusedControl();
  selectors.teamDetail.dataset.teamId = team.id;
  selectors.teamDetail.querySelectorAll(".federation-crest").forEach((crest) => crest.remove());
  resetImageFallback(selectors.teamDetailFlag);
  selectors.teamDetailFlag.src = flagUrl(team.flag);
  selectors.teamDetailFlag.alt = `Bandiera ${team.name}`;
  selectors.teamDetailTitle.textContent = team.name;
  selectors.teamDetailRating.textContent = team.rating;
  selectors.teamDetailInfo.innerHTML = renderTeamDetailInfo(team);
  selectors.teamDetailSchedule.innerHTML = renderTeamSchedule(team);
  selectors.teamDetailResults.innerHTML = renderTeamResults(team);
  selectors.teamDetailScorer.innerHTML = renderTeamScorer(team);
  selectors.teamDetailSquad.innerHTML = renderTeamSquad(team);
  if (options.updateRoute !== false) {
    updateTeamRoute(team.id);
  }
  showPanel("teamDetail", { scroll: options.scroll });
  if (options.scroll !== false) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function renderTeamDetailInfo(team) {
  return `
    <div class="detail-list compact-info-list">
      <div><span>Ranking FIFA</span><strong>${team.rank}</strong></div>
      <div><span>Titoli mondiali</span><strong>${team.titles}</strong></div>
      <div><span>Forma stimata</span><strong>${team.form}/100</strong></div>
      <div><span>Stile</span><strong>${team.style}</strong></div>
      ${team.host ? "<div><span>Nota</span><strong>Paese ospitante</strong></div>" : ""}
    </div>
  `;
}

function renderTeamSchedule(team) {
  const schedule = fixtures
    .filter((fixture) => fixture.home === team.id || fixture.away === team.id)
    .sort((a, b) => getFixtureDate(a) - getFixtureDate(b));

  return `
    <div class="detail-list">
      ${schedule
        .map((fixture) => {
          const opponentId = fixture.home === team.id ? fixture.away : fixture.home;
          const opponent = teamById.get(opponentId);
          return `
            <div class="schedule-row">
              <span>${formatFixtureDate(fixture)}</span>
              <strong>${opponent ? opponent.name : "Da definire"}</strong>
              <small>${fixture.venue}</small>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderTeamResults(team) {
  const completed = fixtures.filter((fixture) => {
    const involvesTeam = fixture.home === team.id || fixture.away === team.id;
    return involvesTeam && fixture.score;
  });

  if (!completed.length) {
    return `
      <div class="empty-state">
        <strong>Nessun risultato registrato</strong>
        <span>I risultati compariranno qui appena verranno inseriti nel dataset.</span>
      </div>
    `;
  }

  return `
    <div class="detail-list">
      ${completed
        .map((fixture) => {
          const home = teamById.get(fixture.home);
          const away = teamById.get(fixture.away);
          return `<div><span>${formatFixtureDate(fixture)}</span><strong>${home.name} ${fixture.score.home}-${fixture.score.away} ${away.name}</strong></div>`;
        })
        .join("")}
    </div>
  `;
}

function renderTeamScorer(team) {
  const player = playerWatchlist[team.id] || "Da aggiornare";
  return `
    <div class="scorer-card">
      <span>Gol nella competizione</span>
      <strong>0</strong>
      <p>${player === "Da aggiornare" ? "Miglior marcatore da aggiornare dopo le prime partite." : `Da monitorare: ${player}. Il capocannoniere reale verra aggiornato con i risultati.`}</p>
    </div>
  `;
}

function openPlayerDetail(playerId) {
  const profile = playerProfiles?.[playerId] || null;
  if (!profile) {
    delete selectors.playerDetail.dataset.playerId;
    delete selectors.playerDetail.dataset.squadPlayer;
    playerDetailBackTarget = "home";
    selectors.playerDetailBack.textContent = "Torna alla home";
    selectors.playerDetailContent.innerHTML = renderMissingPlayerState();
    showPanel("playerDetail");
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  releaseFocusedControl();
  playerDetailBackTarget = "home";
  selectors.playerDetailBack.textContent = "Torna alla home";
  selectors.playerDetail.dataset.playerId = profile.id;
  delete selectors.playerDetail.dataset.squadPlayer;
  delete selectors.playerDetail.dataset.squadTeamId;
  selectors.playerDetailContent.innerHTML = renderPlayerProfile(profile);
  showPanel("playerDetail");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openSquadPlayerDetail(playerName, teamId, roleGroup) {
  const team = teamById.get(teamId);
  const role = normalizeSquadRole(roleGroup);
  const availableProfile = findPlayerProfileByName(playerName, teamId);
  const fallback = buildSquadPlayerFallback(playerName, team, role);
  const simpleProfile = {
    id: createSquadPlayerKey(teamId, playerName),
    fullName: playerName || fallback.name,
    shortName: playerName || fallback.name,
    birthDate: availableProfile?.birthDate || "",
    age: availableProfile?.age || fallback.age,
    height: availableProfile?.height || fallback.height,
    weight: availableProfile?.weight || fallback.weight,
    nationality: team?.name || fallback.nationality,
    club: availableProfile?.club || fallback.club,
    role: availableProfile?.role || role || fallback.role,
    image: availableProfile?.image || "",
    imageAlt: availableProfile?.imageAlt || playerName || "Calciatore",
    stats: getWorldCupPlayerStats(availableProfile),
  };

  releaseFocusedControl();
  playerDetailBackTarget = "teamDetail";
  selectors.playerDetailBack.textContent = "Torna alla squadra";
  selectors.playerDetail.dataset.squadPlayer = playerName;
  selectors.playerDetail.dataset.squadTeamId = teamId || "";
  delete selectors.playerDetail.dataset.playerId;
  selectors.playerDetailContent.innerHTML = renderSquadPlayerProfile(simpleProfile);
  showPanel("playerDetail");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function findPlayerProfileByName(playerName, teamId) {
  const target = normalizePlayerName(playerName);
  return (
    Object.values(playerProfiles || {}).find((profile) => {
      if (!profile) return false;
      if (teamId && profile.teamId !== teamId) return false;
      const names = [profile.id, profile.shortName, profile.fullName, ...(profile.aliases || [])].map(normalizePlayerName);
      return names.includes(target) || names.some((name) => name && (name.includes(target) || target.includes(name)));
    }) || null
  );
}

function normalizePlayerName(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeSquadRole(roleGroup = "") {
  const role = String(roleGroup).toLowerCase();
  if (role.includes("portier")) return "Portiere";
  if (role.includes("difensor")) return "Difensore";
  if (role.includes("centrocamp")) return "Centrocampista";
  if (role.includes("attacc")) return "Attaccante";
  return roleGroup || "Ruolo da aggiornare";
}

function createSquadPlayerKey(teamId, playerName) {
  return `${teamId || "team"}-${normalizePlayerName(playerName).replace(/\s+/g, "-") || "player"}`;
}

function buildSquadPlayerFallback(playerName, team, role) {
  const seed = hashString(`${team?.id || "team"}-${playerName || "player"}-${role || "role"}`);
  const roleKey = normalizePlayerName(role);
  const ranges = roleKey.includes("portiere")
    ? { age: [25, 35], height: [188, 199], weight: [82, 96] }
    : roleKey.includes("difensore")
      ? { age: [23, 33], height: [180, 193], weight: [74, 89] }
      : roleKey.includes("centrocampista")
        ? { age: [22, 32], height: [174, 187], weight: [68, 82] }
        : roleKey.includes("attaccante")
          ? { age: [21, 32], height: [176, 190], weight: [70, 86] }
          : { age: [22, 33], height: [176, 190], weight: [70, 86] };

  const age = seededRange(seed, ranges.age[0], ranges.age[1]);
  const heightCm = seededRange(seed >> 3, ranges.height[0], ranges.height[1]);
  const weightKg = seededRange(seed >> 6, ranges.weight[0], ranges.weight[1]);

  return {
    name: playerName || "Calciatore FootballIQ",
    age,
    height: formatHeight(heightCm),
    weight: `${weightKg} kg`,
    nationality: team?.name || "Nazionale da confermare",
    role: role || "Ruolo da confermare",
    club: "Club da confermare",
  };
}

function hashString(value) {
  return String(value).split("").reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) >>> 0, 2166136261);
}

function seededRange(seed, min, max) {
  return min + (Math.abs(seed) % (max - min + 1));
}

function formatHeight(heightCm) {
  const meters = Math.floor(heightCm / 100);
  const centimeters = String(heightCm % 100).padStart(2, "0");
  return `${meters},${centimeters} m`;
}

function getWorldCupPlayerStats(profile = {}) {
  const safeProfile = profile || {};
  const stats = safeProfile.worldCupStats || {};
  return {
    appearances: stats.appearances ?? 0,
    goals: stats.goals ?? 0,
    assists: stats.assists ?? 0,
    minutes: stats.minutes ?? 0,
    yellowCards: stats.yellowCards ?? 0,
    redCards: stats.redCards ?? 0,
  };
}

function renderPlayerProfile(profile) {
  if (!profile) {
    return renderMissingPlayerState();
  }

  const team = teamById.get(profile.teamId);
  const age = calculateAge(profile.birthDate) || profile.age || "In aggiornamento";
  const nextFixture = team ? getNextTeamFixture(team.id) : null;
  const nextOpponent = nextFixture && team ? getFixtureOpponentName(nextFixture, team.id) : "";
  const nationalityFlag = team ? `<img src="${flagUrl(team.flag)}" alt="" loading="lazy" />` : "";
  const description = profile.description || profile.headline || "";
  const worldCupStats = getWorldCupPlayerStats(profile);
  const image = profile.image
    ? `<img src="${escapeAttribute(profile.image)}" alt="${escapeAttribute(profile.imageAlt || profile.fullName || "Calciatore")}" loading="lazy" decoding="async" />`
    : `<div class="player-profile-initials" aria-hidden="true">${getPlayerInitials(profile.fullName || profile.shortName)}</div>`;

  return `
    <div class="player-profile-card">
      <div class="player-profile-media">
        ${image}
        <div class="player-profile-shirt" aria-label="Numero ${profile.shirtNumber || ""}">
          <span>#</span>
          <strong>${escapeHtml(profile.shirtNumber || "FIQ")}</strong>
        </div>
      </div>
      <div class="player-profile-content">
        <div class="player-profile-topline">
          <span class="outcome-label">Player IQ</span>
          <span class="player-profile-nation">${nationalityFlag}${escapeHtml(profile.nationality || "In aggiornamento")}</span>
        </div>
        <div class="player-profile-name">
          <span>${escapeHtml(profile.shortName || profile.fullName || "In aggiornamento")}</span>
          <strong id="player-detail-title">${escapeHtml(profile.fullName || profile.shortName || "In aggiornamento")}</strong>
          <small>${escapeHtml(formatProfileValue(profile.role))} | ${escapeHtml(formatProfileValue(profile.club))}</small>
        </div>
        <div class="player-profile-bio-grid">
          ${renderPlayerBioItem("Eta", age === "In aggiornamento" ? age : `${age} anni`)}
          ${renderPlayerBioItem("Altezza", profile.height)}
          ${renderPlayerBioItem("Peso", profile.weight)}
          ${renderPlayerBioItem("Nazionalita", profile.nationality)}
          ${renderPlayerBioItem("Club", profile.club)}
          ${renderPlayerBioItem("Ruolo", profile.role)}
        </div>
        ${description ? `<p class="player-profile-headline">${escapeHtml(description)}</p>` : ""}
        <div class="player-profile-traits">
          ${(profile.traits || []).map((trait) => `<span>${escapeHtml(trait)}</span>`).join("")}
        </div>
        <div class="player-profile-stat-grid">
          ${(profile.stats || []).map(renderPlayerStat).join("")}
        </div>
        <div class="world-cup-player-stats" aria-label="Statistiche personali Mondiale">
          ${renderWorldCupPlayerStat("Presenze", worldCupStats.appearances)}
          ${renderWorldCupPlayerStat("Gol", worldCupStats.goals)}
          ${renderWorldCupPlayerStat("Assist", worldCupStats.assists)}
          ${renderWorldCupPlayerStat("Minuti", worldCupStats.minutes)}
          ${renderWorldCupPlayerStat("Gialli", worldCupStats.yellowCards)}
          ${renderWorldCupPlayerStat("Rossi", worldCupStats.redCards)}
        </div>
        ${
          nextFixture
            ? `<div class="player-profile-next">
                <span>Prossima partita</span>
                <strong>${escapeHtml(team.name)} vs ${escapeHtml(nextOpponent)}</strong>
                <small>${formatFixtureDate(nextFixture)}</small>
              </div>`
            : ""
        }
      </div>
    </div>
  `;
}

function renderSquadPlayerProfile(profile) {
  if (!profile) {
    return renderMissingPlayerState();
  }

  const age = calculateAge(profile.birthDate) || profile.age || "In aggiornamento";
  const stats = profile.stats || getWorldCupPlayerStats();
  const image = profile.image
    ? `<img src="${escapeAttribute(profile.image)}" alt="${escapeAttribute(profile.imageAlt || profile.fullName)}" loading="lazy" decoding="async" />`
    : `<div class="player-profile-initials" aria-hidden="true">${getPlayerInitials(profile.fullName)}</div>`;

  return `
    <div class="player-profile-card player-profile-simple-card">
      <div class="player-profile-media player-profile-simple-media">
        ${image}
      </div>
      <div class="player-profile-content">
        <div class="player-profile-name">
          <span>${escapeHtml(profile.role || "Ruolo")}</span>
          <strong id="player-detail-title">${escapeHtml(profile.fullName)}</strong>
          <small>${escapeHtml(formatProfileValue(profile.club))}</small>
        </div>
        <div class="player-profile-bio-grid">
          ${renderPlayerBioItem("Eta", age === "In aggiornamento" ? age : `${age} anni`)}
          ${renderPlayerBioItem("Altezza", profile.height)}
          ${renderPlayerBioItem("Peso", profile.weight)}
          ${renderPlayerBioItem("Nazionalita", profile.nationality)}
          ${renderPlayerBioItem("Club", profile.club)}
          ${renderPlayerBioItem("Ruolo", profile.role)}
        </div>
        <div class="world-cup-player-stats" aria-label="Statistiche personali Mondiale">
          ${renderWorldCupPlayerStat("Presenze", stats.appearances)}
          ${renderWorldCupPlayerStat("Gol", stats.goals)}
          ${renderWorldCupPlayerStat("Assist", stats.assists)}
          ${renderWorldCupPlayerStat("Minuti giocati", stats.minutes)}
          ${renderWorldCupPlayerStat("Gialli", stats.yellowCards)}
          ${renderWorldCupPlayerStat("Rossi", stats.redCards)}
        </div>
      </div>
    </div>
  `;
}

function renderMissingPlayerState() {
  return renderEmptyState(
    "Dati giocatore in aggiornamento",
    "La scheda del giocatore selezionato sara disponibile appena i dati saranno completati.",
  );
}

function renderPlayerBioItem(label, value) {
  return `
    <div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(formatProfileValue(value))}</strong>
    </div>
  `;
}

function renderWorldCupPlayerStat(label, value) {
  return `
    <div class="player-stat-item world-cup-stat-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value ?? 0))}</strong>
    </div>
  `;
}

function renderPlayerStat(stat) {
  if (!stat) return "";
  const meter = Number.isFinite(Number(stat.meter)) ? clamp(Number(stat.meter), 0, 100) : null;
  return `
    <div class="player-stat-item">
      <span>${escapeHtml(stat.label || "Dato")}</span>
      <strong>${escapeHtml(formatProfileValue(stat.value))}</strong>
      ${meter === null ? "" : `<div class="meter-track"><span style="width: ${meter}%"></span></div>`}
    </div>
  `;
}

function formatProfileValue(value) {
  return value === null || value === undefined || value === "" ? "In aggiornamento" : String(value);
}

function getPlayerInitials(name = "") {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value = "") {
  return escapeHtml(value);
}

function calculateAge(birthDateValue) {
  if (!birthDateValue) return null;

  const birthDate = new Date(`${birthDateValue}T12:00:00Z`);
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - birthDate.getUTCMonth();
  const dayDiff = today.getUTCDate() - birthDate.getUTCDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age;
}

function getNextTeamFixture(teamId) {
  const now = new Date();
  const schedule = fixtures
    .filter((fixture) => fixture.home === teamId || fixture.away === teamId)
    .sort((a, b) => getFixtureDate(a) - getFixtureDate(b));

  return schedule.find((fixture) => getFixtureDate(fixture) >= now) || schedule[0] || null;
}

function getFixtureOpponentName(fixture, teamId) {
  const opponentId = fixture.home === teamId ? fixture.away : fixture.home;
  const opponent = teamById.get(opponentId);
  return opponent ? opponent.name : "Da definire";
}

function renderTeamSquad(team) {
  const squad = squads[team.id];
  const hasPlayers = squad && squad.groups && Object.values(squad.groups).some((players) => players.length);

  if (!hasPlayers) {
    return `
      <div class="empty-state">
        <strong>Lista convocati non ancora ufficiale</strong>
        <span>La aggiungiamo solo quando e pubblicata da FIFA o dalla federazione. Le liste definitive FIFA arrivano il 2 giugno.</span>
      </div>
    `;
  }

  return `
    <div class="squad-note">
      <span>${squad.status}</span>
      <strong>${squad.source}</strong>
    </div>
    <div class="squad-groups">
      ${Object.entries(squad.groups)
        .map(
          ([role, players]) => `
            <section class="squad-role">
              <h4>${role}</h4>
              <div class="squad-player-list">
                ${players.map((player) => renderSquadPlayerButton(player, team.id, role)).join("")}
              </div>
            </section>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderSquadPlayerButton(player, teamId, role) {
  return `
    <button
      class="squad-player-pill"
      type="button"
      data-squad-player="${escapeAttribute(player)}"
      data-team-id="${escapeAttribute(teamId)}"
      data-role="${escapeAttribute(role)}"
    >
      ${escapeHtml(player)}
    </button>
  `;
}

try {
  bootstrap();
} catch (error) {
  const status = document.querySelector("#appStatus");
  document.body.classList.remove("is-loading");
  document.body.classList.add("app-error");
  if (status) {
    status.textContent = `Errore caricamento: ${error.message}`;
  }
}
