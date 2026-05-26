safeAddEventListener(window, "error", (event) => {
  if (event.target && event.target !== window && event.target.tagName === "IMG") {
    return;
  }
  const status = document.querySelector("#appStatus");
  document.body.classList.remove("is-loading");
  document.body.classList.add("app-error");
  if (status) {
    status.textContent = `Errore caricamento: ${event.message || "script non disponibile"}`;
    status.style.display = "block";
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
const mainPanelIds = new Set(["home", "calendar", "live", "statistics", "groups", "teams", "predictor"]);
const detailPanelIds = new Set(["teamDetail", "matchDetail", "playerDetail"]);
const routeStorageKey = "footballiq.route.v1";
const unavailableText = "Dato non disponibile";
const worldCupSeason = Number(meta.worldCupSeason || 2026);
const worldCupLeagueIds = new Set(["1", ...(meta.worldCupLeagueIds || []).map(String)]);
const liveRefreshIntervalMs = 60000;
const tournamentRefreshIntervalMs = 600000;
const worldCupStatisticsTabs = [
  { id: "scorers", label: "Capocannonieri" },
  { id: "yellowCards", label: "Ammonizioni" },
  { id: "redCards", label: "Espulsioni" },
];
let playerSearchIndex = [];
let timeMode = "rome";
let playerDetailBackTarget = "home";
let activeWorldCupStatisticsTab = "scorers";
let liveRefreshTimer = null;
let tournamentRefreshTimer = null;

const apiFootballState = {
  checked: false,
  configured: false,
  liveLoading: false,
  liveMatches: [],
  liveError: "",
  liveUpdatedAt: "",
  tournamentLoading: false,
  standings: [],
  standingsError: "",
  topScorers: [],
  topScorersError: "",
  topYellowCards: [],
  topYellowCardsError: "",
  topRedCards: [],
  topRedCardsError: "",
  tournamentUpdatedAt: "",
  newsLoading: false,
  newsItems: [],
  newsError: "",
  newsUpdatedAt: "",
  playerProfiles: new Map(),
  playerRequests: new Map(),
};

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
  liveCenter: document.querySelector("#liveCenter"),
  worldCupStatistics: document.querySelector("#worldCupStatistics"),
  liveStatus: document.querySelector("#liveStatus"),
  liveRefreshButton: document.querySelector("#liveRefreshButton"),
  groupGrid: document.querySelector("#groupGrid"),
  playerSearchShell: document.querySelector("#playerSearchShell"),
  playerSearch: document.querySelector("#playerSearch"),
  playerSearchResults: document.querySelector("#playerSearchResults"),
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

function safeAddEventListener(target, type, handler, options) {
  if (!target || typeof target.addEventListener !== "function") return false;

  target.addEventListener(type, handler, options);
  return true;
}

function hasElements(...elements) {
  return elements.every(Boolean);
}

function ensurePlayerDetailPanel() {
  if (!selectors.playerDetail) {
    const panel = document.createElement("section");
    panel.className = "panel player-detail-panel";
    panel.id = "playerDetail";
    panel.setAttribute("aria-labelledby", "player-detail-title");
    panel.innerHTML = `
      <button class="back-button" id="playerDetailBack" type="button">Torna a Home</button>
      <div id="playerDetailContent"></div>
    `;

    const predictorPanel = document.querySelector("#predictor");
    if (predictorPanel?.parentNode) {
      predictorPanel.insertAdjacentElement("beforebegin", panel);
    } else {
      document.querySelector("main")?.appendChild(panel);
    }
  }

  selectors.panels = document.querySelectorAll(".panel");
  selectors.playerDetail = document.querySelector("#playerDetail");
  selectors.playerDetailBack = document.querySelector("#playerDetailBack");
  selectors.playerDetailContent = document.querySelector("#playerDetailContent");

  return hasElements(selectors.playerDetail, selectors.playerDetailBack, selectors.playerDetailContent);
}

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
  playerSearchIndex = buildPlayerSearchIndex();
  ensurePlayerDetailPanel();
  bindEvents();
  renderCalendar();
  renderGroups();
  renderTeams();
  renderPredictorOptions();
  applyRouteState();
  renderPrediction();
  renderHomeBestPick();
  renderLiveCenter();
  try {
    renderDailyNews();
  } catch (error) {
    console.warn("Daily news render skipped", error);
  }

  enhancePlayerCarousel();
  finishAppLoad();
  const route = getRouteState();
  ensureRouteInUrl(route);
  syncRouteToView({ scroll: false });
  initializeApiFootball();
}

function setupAppMode() {
  const standaloneQuery =
    typeof window.matchMedia === "function" ? window.matchMedia("(display-mode: standalone)") : null;
  const updateStandaloneMode = () => {
    const isStandalone = Boolean(standaloneQuery?.matches || window.navigator.standalone === true);
    document.body.classList.toggle("is-standalone", isStandalone);
  };

  updateStandaloneMode();
  if (standaloneQuery) {
    if (!safeAddEventListener(standaloneQuery, "change", updateStandaloneMode) && standaloneQuery.addListener) {
      standaloneQuery.addListener(updateStandaloneMode);
    }
  }

  const canUseServiceWorker =
    "serviceWorker" in navigator &&
    (window.isSecureContext || ["localhost", "127.0.0.1"].includes(window.location.hostname));

  if (canUseServiceWorker) {
    safeAddEventListener(window, "load", () => {
      navigator.serviceWorker.register("./service-worker.js?v=61").catch(() => {});
    });
  }
}

function setupGlobalFallbacks() {
  const watchImage = (image) => {
    if (!image || image.dataset.fallbackWatched === "true") return;
    if (!image.getAttribute("src") && !image.currentSrc) return;

    image.dataset.fallbackWatched = "true";
    safeAddEventListener(image, "error", () => applyImageFallback(image));
    if (image.complete && image.naturalWidth === 0) {
      applyImageFallback(image);
    }
  };

  safeAddEventListener(
    document,
    "error",
    (event) => {
      if (event.target && event.target.tagName === "IMG") {
        applyImageFallback(event.target);
      }
    },
    true,
  );

  safeAddEventListener(window, "unhandledrejection", () => {
    showAppNotice("Dati in aggiornamento");
  });

  document.querySelectorAll("img").forEach(watchImage);

  if (typeof MutationObserver === "function") {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          if (node.matches?.("img")) {
            watchImage(node);
          }
          node.querySelectorAll?.("img").forEach(watchImage);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
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
  placeholder.textContent = isTeamFlag ? "FIQ" : "Foto non disponibile";
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

function finishAppLoad() {
  const status = document.querySelector("#appStatus");
  document.body.classList.remove("is-loading", "app-error");

  if (status) {
    status.textContent = "";
    status.style.display = "";
  }
}

function initializeApiFootball() {
  renderWorldCupStatistics();
  checkApiFootballStatus()
    .then(() => {
      loadLiveCenter();
      loadFootballNews();
      loadApiFootballTournamentData();
    })
    .catch(() => {
      apiFootballState.newsError = "Dati live Mondiali non disponibili al momento";
      apiFootballState.standingsError = "Classifica in aggiornamento";
      apiFootballState.topScorersError = "Capocannonieri disponibili dopo l'inizio del torneo";
      apiFootballState.topYellowCardsError = "Classifica ammonizioni disponibile dopo l'inizio del torneo";
      apiFootballState.topRedCardsError = "Classifica espulsioni disponibile dopo l'inizio del torneo";
      renderDailyNews();
      renderLiveCenter("Dati live Mondiali non disponibili al momento");
      renderWorldCupStatistics();
    });

  startLiveAutoRefresh();
  startTournamentAutoRefresh();
}

function startLiveAutoRefresh() {
  if (liveRefreshTimer) return;

  liveRefreshTimer = window.setInterval(() => {
    if (getVisibleMainPanelId() === "live") {
      loadLiveCenter({ force: true });
    }
  }, liveRefreshIntervalMs);
}

function startTournamentAutoRefresh() {
  if (tournamentRefreshTimer) return;

  tournamentRefreshTimer = window.setInterval(() => {
    loadApiFootballTournamentData({ background: true });
  }, tournamentRefreshIntervalMs);
}

async function loadFootballNews() {
  if (!selectors.dailyNewsCard || apiFootballState.newsLoading) return;

  apiFootballState.newsLoading = true;
  apiFootballState.newsError = "";
  renderDailyNews();

  try {
    await checkApiFootballStatus();
    const response = await fetch("./api-football/news", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.message || "News API-FOOTBALL non disponibili");
    }
    apiFootballState.newsItems = (Array.isArray(payload.items) ? payload.items : []).filter(isWorldCupNewsItem);
    apiFootballState.newsUpdatedAt = payload.generatedAt || new Date().toISOString();
    apiFootballState.newsError = payload.message || "";
  } catch (error) {
    apiFootballState.newsItems = [];
    apiFootballState.newsError = error?.message || "News API-FOOTBALL non disponibili.";
  } finally {
    apiFootballState.newsLoading = false;
    renderDailyNews();
  }
}

async function loadApiFootballTournamentData(options = {}) {
  if (apiFootballState.tournamentLoading) return;

  apiFootballState.tournamentLoading = true;
  if (!options.background) {
    renderWorldCupStatistics();
  }

  try {
    await checkApiFootballStatus();
    const response = await fetch("./api-football/world-cup/bootstrap", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.message || "Dati Mondiali non disponibili al momento");
    }

    const apiTeams = Array.isArray(payload.teams) ? payload.teams : [];
    const apiFixtures = Array.isArray(payload.fixtures) ? payload.fixtures : [];
    const apiStandings = Array.isArray(payload.standings) ? payload.standings : [];
    const topScorers = Array.isArray(payload.topScorers) ? payload.topScorers : [];
    const topYellowCards = Array.isArray(payload.topYellowCards) ? payload.topYellowCards : [];
    const topRedCards = Array.isArray(payload.topRedCards) ? payload.topRedCards : [];

    mergeApiFootballTeams(apiTeams);
    mergeApiFootballFixtures(apiFixtures);
    apiFootballState.standings = apiStandings;
    apiFootballState.topScorers = topScorers;
    apiFootballState.topYellowCards = topYellowCards;
    apiFootballState.topRedCards = topRedCards;
    apiFootballState.standingsError = payload.messages?.standings || (!apiStandings.length ? "Classifica in aggiornamento" : "");
    apiFootballState.topScorersError =
      payload.messages?.topScorers || (!topScorers.length ? "Capocannonieri disponibili dopo l'inizio del torneo" : "");
    apiFootballState.topYellowCardsError =
      payload.messages?.topYellowCards ||
      (!topYellowCards.length ? "Classifica ammonizioni disponibile dopo l'inizio del torneo" : "");
    apiFootballState.topRedCardsError =
      payload.messages?.topRedCards || (!topRedCards.length ? "Classifica espulsioni disponibile dopo l'inizio del torneo" : "");
    apiFootballState.tournamentUpdatedAt = payload.generatedAt || new Date().toISOString();
    renderCalendar();
    renderGroups();
    renderTeams();
    renderPredictorOptions();
    renderPrediction();
    renderHomeBestPick();
    renderWorldCupStatistics();
  } catch (error) {
    apiFootballState.standingsError = "Classifica in aggiornamento";
    apiFootballState.topScorersError = "Capocannonieri disponibili dopo l'inizio del torneo";
    apiFootballState.topYellowCardsError = "Classifica ammonizioni disponibile dopo l'inizio del torneo";
    apiFootballState.topRedCardsError = "Classifica espulsioni disponibile dopo l'inizio del torneo";
  } finally {
    apiFootballState.tournamentLoading = false;
    renderWorldCupStatistics();
  }
}

function mergeApiFootballTeams(apiTeams = []) {
  const localByName = new Map();
  teams.forEach((team) => {
    localByName.set(normalizePlayerName(team.name), team);
    localByName.set(normalizePlayerName(team.fifaName), team);
  });

  apiTeams.forEach((item) => {
    const apiTeam = item?.team;
    const local = localByName.get(normalizePlayerName(apiTeam?.name));
    if (!local || !apiTeam?.id) return;

    local.apiFootballId = apiTeam.id;
    local.apiFootballName = apiTeam.name || local.apiFootballName;
    local.apiFootballLogo = apiTeam.logo || local.apiFootballLogo;
  });
}

function mergeApiFootballFixtures(apiFixtures = []) {
  apiFixtures.forEach((item) => {
    const apiFixture = item?.fixture;
    const apiTeams = item?.teams || {};
    const localHome = findTeamByApiName(apiTeams.home?.name);
    const localAway = findTeamByApiName(apiTeams.away?.name);
    if (!apiFixture?.id || !localHome || !localAway) return;

    const localFixture = fixtures.find((fixture) => fixture.home === localHome.id && fixture.away === localAway.id);
    if (!localFixture) return;

    localFixture.apiFootballId = apiFixture.id;
    localFixture.apiFootballStatus = apiFixture.status || null;
    if (item.goals && item.goals.home !== null && item.goals.away !== null) {
      localFixture.score = { home: item.goals.home, away: item.goals.away };
    }
  });
}

function findTeamByApiName(name) {
  const normalized = normalizePlayerName(name);
  return teams.find((team) => normalizePlayerName(team.name) === normalized || normalizePlayerName(team.fifaName) === normalized) || null;
}

async function checkApiFootballStatus() {
  if (apiFootballState.checked) return apiFootballState.configured;

  const response = await fetch("./api-football/status", { cache: "no-store" });
  const payload = await response.json();
  apiFootballState.checked = true;
  apiFootballState.configured = Boolean(payload?.configured);
  if (!apiFootballState.configured) {
    throw new Error("API-FOOTBALL non configurata");
  }
  return true;
}

function isWorldCup2026LiveItem(item = {}) {
  const league = item?.fixture?.league || item?.league || {};
  const leagueName = normalizePlayerName(league.name);
  const leagueId = String(league.id || "");
  const season = Number(league.season || league.year || 0);
  const isWorldCupLeague = leagueName.includes("world cup") || worldCupLeagueIds.has(leagueId);
  return isWorldCupLeague && season === worldCupSeason;
}

function isWorldCupNewsItem(item = {}) {
  const text = normalizePlayerName(
    [item.competition, item.tournament, item.tag, item.logoSub, item.title, item.summary].filter(Boolean).join(" "),
  );
  return text.includes("mondiali") || text.includes("world cup") || text.includes("fifa");
}

async function loadLiveCenter(options = {}) {
  if (!selectors.liveCenter || apiFootballState.liveLoading) return;

  if (!apiFootballState.checked) {
    try {
      await checkApiFootballStatus();
    } catch (error) {
      renderLiveCenter("Dati live Mondiali non disponibili al momento");
      return;
    }
  }

  if (!apiFootballState.configured) {
    renderLiveCenter("Dati live Mondiali non disponibili al momento");
    return;
  }

  apiFootballState.liveLoading = true;
  apiFootballState.liveError = "";
  if (options.force || !apiFootballState.liveMatches.length) {
    renderLiveCenter("Aggiornamento dati live...");
  }

  try {
    const response = await fetch("./api-football/world-cup/live", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.message || "Dati live non disponibili");
    }
    const liveFixtures = Array.isArray(payload.fixtures) ? payload.fixtures : [];
    apiFootballState.liveMatches = liveFixtures.filter(isWorldCup2026LiveItem);
    apiFootballState.liveError = "";
    apiFootballState.liveUpdatedAt = payload.generatedAt || new Date().toISOString();
    if (liveFixtures.length && !apiFootballState.liveMatches.length) {
      apiFootballState.liveError = "Dati live Mondiali non disponibili al momento";
    }
    renderLiveCenter();
  } catch (error) {
    apiFootballState.liveError = "Dati live Mondiali non disponibili al momento";
    apiFootballState.liveMatches = [];
    apiFootballState.liveLoading = false;
    renderLiveCenter(apiFootballState.liveError);
  } finally {
    apiFootballState.liveLoading = false;
  }
}

function primeVisiblePlayerProfiles() {
  ["messi", "neymar", "ronaldo", "mbappe", "kane", "yamal"].forEach((playerId, index) => {
    window.setTimeout(() => {
      const profile = playerProfiles?.[playerId];
      if (profile) {
        hydratePlayerProfileFromApi(profile).catch(() => {});
      }
    }, 1200 + index * 900);
  });
}

async function hydratePlayerProfileFromApi(profile) {
  if (!profile?.id) return null;

  if (apiFootballState.playerProfiles.has(profile.id)) {
    const cachedProfile = apiFootballState.playerProfiles.get(profile.id) || null;
    if (cachedProfile) {
      applyApiFootballPlayerProfile(profile, cachedProfile);
      if (selectors.playerDetail?.dataset.playerId === profile.id && selectors.playerDetailContent) {
        selectors.playerDetailContent.innerHTML = renderPlayerProfile(profile);
      }
    }
    return cachedProfile;
  }

  if (apiFootballState.playerRequests.has(profile.id)) {
    return apiFootballState.playerRequests.get(profile.id);
  }

  const request = resolveApiFootballPlayer(profile)
    .then((apiProfile) => {
      if (apiProfile) {
        applyApiFootballPlayerProfile(profile, apiProfile);
        apiFootballState.playerProfiles.set(profile.id, apiProfile);
        if (selectors.playerDetail?.dataset.playerId === profile.id && selectors.playerDetailContent) {
          selectors.playerDetailContent.innerHTML = renderPlayerProfile(profile);
        }
      }
      return apiProfile;
    })
    .finally(() => {
      apiFootballState.playerRequests.delete(profile.id);
    });

  apiFootballState.playerRequests.set(profile.id, request);
  return request;
}

async function resolveApiFootballPlayer(profile) {
  await checkApiFootballStatus();
  const search = new URLSearchParams();
  search.set("name", profile.fullName || profile.shortName || profile.name || "");
  search.set("nationality", profile.nationality || "");
  search.set("season", String(getApiFootballSeason()));

  const response = await fetch(`./api-football/player-profile?${search.toString()}`, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false || !payload?.found) {
    return null;
  }

  return payload;
}

function getApiFootballPlayerSearchTerms(profile) {
  const terms = [];
  const addTerm = (term) => {
    const clean = String(term || "").replace(/\s+/g, " ").trim();
    if (normalizePlayerName(clean).length < 3) return;
    if (!terms.some((item) => normalizePlayerName(item) === normalizePlayerName(clean))) {
      terms.push(clean);
    }
  };

  [profile.shortName, ...(profile.aliases || []), profile.fullName].filter(Boolean).forEach((name) => {
    const clean = String(name).replace(/\s+/g, " ").trim();
    const tokens = clean.split(" ").filter(Boolean);
    if (tokens.length <= 1) {
      addTerm(clean);
      return;
    }

    addTerm(tokens[tokens.length - 1]);
    addTerm(tokens.slice(-2).join(" "));
    addTerm(tokens.slice(1).join(" "));
    addTerm(clean);
  });

  return terms.slice(0, 4);
}

function findBestApiPlayerCandidate(results, profile) {
  const profileNames = [profile.fullName, profile.shortName, ...(profile.aliases || [])].map(normalizePlayerName).filter(Boolean);
  const expectedNation = normalizePlayerName(profile.nationality);

  return (
    (results || []).find((item) => {
      const player = item?.player || item;
      const apiNames = [player?.name, [player?.firstname, player?.lastname].filter(Boolean).join(" ")]
        .map(normalizePlayerName)
        .filter(Boolean);
      const nameMatch = apiNames.some((apiName) =>
        profileNames.some((profileName) => apiName === profileName || apiName.includes(profileName) || profileName.includes(apiName)),
      );
      const nation = normalizePlayerName(player?.nationality || player?.birth?.country);
      const nationMatch = !expectedNation || !nation || nation === expectedNation;
      return nameMatch && nationMatch;
    }) || null
  );
}

function applyApiFootballPlayerProfile(profile, apiProfile) {
  if (apiProfile?.source === "API-FOOTBALL") {
    applyServerApiFootballPlayerProfile(profile, apiProfile);
    return;
  }

  const player = apiProfile.player || {};
  const statistics = Array.isArray(apiProfile.statistics) ? apiProfile.statistics : [];
  const currentStats = findCurrentApiPlayerStatistics(statistics);
  const fullName = [player.firstname, player.lastname].filter(Boolean).join(" ") || player.name;

  profile.fullName = coalesceApiValue(fullName, profile.fullName);
  profile.birthDate = coalesceApiValue(player.birth?.date, profile.birthDate);
  profile.height = coalesceApiValue(player.height, profile.height);
  profile.weight = coalesceApiValue(player.weight, profile.weight);
  profile.nationality = coalesceApiValue(player.nationality || player.birth?.country, profile.nationality);
  profile.club = coalesceApiValue(currentStats?.team?.name, profile.club);
  profile.role = coalesceApiValue(currentStats?.games?.position, profile.role);
  profile.image = coalescePlayerImage(player.photo, profile.image);
  profile.stats = mapApiFootballPlayerStats(statistics);
  profile.apiFootballId = player.id || profile.apiFootballId;
}

function applyServerApiFootballPlayerProfile(profile, apiProfile) {
  const player = apiProfile.player || {};
  const totals = apiProfile.statistics?.totals || {};

  profile.fullName = coalesceApiValue(player.fullName || player.name, profile.fullName);
  profile.shortName = coalesceApiValue(player.name || player.fullName, profile.shortName || profile.fullName);
  profile.birthDate = player.birthDate || profile.birthDate || "";
  profile.age = coalesceApiValue(player.age, profile.age);
  profile.height = coalesceApiValue(player.height, profile.height);
  profile.weight = coalesceApiValue(player.weight, profile.weight);
  profile.nationality = coalesceApiValue(player.nationality || player.birthCountry, profile.nationality);
  profile.club = coalesceApiValue(player.club, profile.club);
  profile.role = coalesceApiValue(translateApiPosition(player.role), profile.role);
  profile.preferredFoot = coalesceApiValue(player.preferredFoot, profile.preferredFoot);
  profile.image = coalescePlayerImage(player.photo, profile.image);
  profile.imageAlt = player.fullName || player.name || profile.fullName || "Calciatore";
  profile.shirtNumber = formatProfileValue(player.shirtNumber);
  profile.apiFootballId = player.id || profile.apiFootballId;
  profile.apiFootballUpdatedAt = apiProfile.generatedAt || "";
  profile.apiFootballSource = apiProfile.source || "API-FOOTBALL";
  profile.apiTotals = normalizeApiFootballTotals(totals);
  profile.stats = mapApiFootballPlayerTotals(totals, apiProfile.statistics?.season);
}

function translateApiPosition(position) {
  const normalized = normalizePlayerName(position);
  if (!normalized) return "";
  if (normalized.includes("goalkeeper")) return "Portiere";
  if (normalized.includes("defender")) return "Difensore";
  if (normalized.includes("midfielder")) return "Centrocampista";
  if (normalized.includes("attacker")) return "Attaccante";
  return position;
}

function mapApiFootballPlayerTotals(totals = {}, season) {
  const rows = [
    ["Presenze", totals.appearances],
    ["Gol", totals.goals],
    ["Assist", totals.assists],
    ["Minuti", totals.minutes],
    ["Gialli", totals.yellowCards],
    ["Rossi", totals.redCards],
  ];
  const suffix = season ? ` ${season}` : "";

  return rows.map(([label, value]) => ({
    label: `${label}${suffix}`,
    value: value === null || value === undefined ? unavailableText : String(value),
  }));
}

function normalizeApiFootballTotals(totals = {}) {
  return {
    appearances: totals.appearances ?? unavailableText,
    goals: totals.goals ?? unavailableText,
    assists: totals.assists ?? unavailableText,
    minutes: totals.minutes ?? unavailableText,
    yellowCards: totals.yellowCards ?? unavailableText,
    redCards: totals.redCards ?? unavailableText,
  };
}

function findCurrentApiPlayerStatistics(statistics = []) {
  return (
    statistics.find((item) => Number(item?.games?.appearences || item?.games?.appearances || 0) > 0 && item?.team?.name) ||
    statistics.find((item) => item?.team?.name) ||
    null
  );
}

function mapApiFootballPlayerStats(statistics = []) {
  if (!statistics.length) return [];

  const readApiNumber = (...values) => {
    for (const value of values) {
      if (value === undefined || value === null || value === "") continue;
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
    return null;
  };

  const addApiNumber = (acc, key, value) => {
    if (value === null) return;
    acc.totals[key] += value;
    acc.available[key] = true;
  };

  const totals = statistics.reduce(
    (acc, item) => {
      addApiNumber(acc, "appearances", readApiNumber(item?.games?.appearences, item?.games?.appearances));
      addApiNumber(acc, "goals", readApiNumber(item?.goals?.total));
      addApiNumber(acc, "assists", readApiNumber(item?.goals?.assists));
      addApiNumber(acc, "minutes", readApiNumber(item?.games?.minutes));
      addApiNumber(acc, "yellow", readApiNumber(item?.cards?.yellow));
      addApiNumber(acc, "red", readApiNumber(item?.cards?.red));
      return acc;
    },
    {
      totals: { appearances: 0, goals: 0, assists: 0, minutes: 0, yellow: 0, red: 0 },
      available: { appearances: false, goals: false, assists: false, minutes: false, yellow: false, red: false },
    },
  );

  const formatApiTotal = (key) => (totals.available[key] ? String(totals.totals[key]) : unavailableText);

  return [
    { label: "Presenze club", value: formatApiTotal("appearances") },
    { label: "Gol club", value: formatApiTotal("goals") },
    { label: "Assist club", value: formatApiTotal("assists") },
    { label: "Minuti club", value: formatApiTotal("minutes") },
    { label: "Gialli club", value: formatApiTotal("yellow") },
    { label: "Rossi club", value: formatApiTotal("red") },
  ];
}

function coalesceApiValue(apiValue, fallbackValue) {
  const value = formatProfileValue(apiValue);
  if (value !== unavailableText) return value;
  return formatProfileValue(fallbackValue);
}

function coalescePlayerImage(apiValue, fallbackValue) {
  const value = String(apiValue || "").trim();
  return value || String(fallbackValue || "").trim();
}

function getApiFootballSeason() {
  const now = new Date();
  const year = now.getFullYear();
  return now.getMonth() >= 6 ? year : year - 1;
}

function bindEvents() {
  selectors.tabs.forEach((tab) => {
    safeAddEventListener(tab, "click", () => {
      if (tab.dataset.tab === "teams" && selectors.teamDetail) {
        delete selectors.teamDetail.dataset.teamId;
      }
      showPanel(tab.dataset.tab, { updateRoute: true });
    });
  });

  safeAddEventListener(window, "hashchange", () => {
    syncRouteToView({ scroll: false });
  });
  safeAddEventListener(window, "popstate", () => {
    syncRouteToView({ scroll: false });
  });

  [selectors.stageFilter, selectors.groupFilter, selectors.teamFilter].forEach((filter) => {
    safeAddEventListener(filter, "change", renderCalendar);
  });

  safeAddEventListener(selectors.teamSearch, "input", renderTeams);
  safeAddEventListener(selectors.confedFilter, "change", () => {
    updateConfedSelect();
    renderTeams();
  });
  safeAddEventListener(selectors.confedSelectButton, "click", () => {
    if (!selectors.confedSelect) return;

    const isOpen = selectors.confedSelect.classList.toggle("is-open");
    selectors.confedSelectButton.setAttribute("aria-expanded", String(isOpen));
  });
  safeAddEventListener(selectors.confedMenu, "click", (event) => {
    const option = event.target.closest?.("[data-confed-option]");
    if (!option || !selectors.confedFilter || !selectors.confedSelect || !selectors.confedSelectButton) return;

    selectors.confedFilter.value = option.dataset.confedOption;
    selectors.confedFilter.dispatchEvent(new Event("change"));
    selectors.confedSelect.classList.remove("is-open");
    selectors.confedSelectButton.setAttribute("aria-expanded", "false");
  });
  safeAddEventListener(document, "click", (event) => {
    if (selectors.confedSelect && !selectors.confedSelect.contains(event.target)) {
      selectors.confedSelect.classList.remove("is-open");
      selectors.confedSelectButton?.setAttribute("aria-expanded", "false");
    }

    if (selectors.playerSearchShell && !selectors.playerSearchShell.contains(event.target)) {
      closePlayerSearchResults();
    }
  });
  safeAddEventListener(selectors.playerSearch, "input", updatePlayerSearchResults);
  safeAddEventListener(selectors.playerSearch, "focus", updatePlayerSearchResults);
  safeAddEventListener(selectors.playerSearch, "keydown", (event) => {
    if (event.key === "Escape") {
      closePlayerSearchResults();
      selectors.playerSearch.blur();
      return;
    }

    if (event.key !== "Enter") return;
    const firstResult = selectors.playerSearchResults?.querySelector("[data-player-search-index]");
    if (!firstResult) return;

    event.preventDefault();
    openPlayerSearchResult(Number(firstResult.dataset.playerSearchIndex));
  });
  safeAddEventListener(selectors.playerSearchResults, "click", (event) => {
    const button = event.target.closest?.("[data-player-search-index]");
    if (!button) return;

    openPlayerSearchResult(Number(button.dataset.playerSearchIndex));
  });
  safeAddEventListener(selectors.matchPredictSelect, "change", () => {
    renderPrediction();
    if (getRouteState().panel === "predictor") {
      updateRoute("predictor");
    }
  });
  safeAddEventListener(selectors.liveRefreshButton, "click", () => {
    loadLiveCenter({ force: true });
  });
  safeAddEventListener(selectors.worldCupStatistics, "click", (event) => {
    const button = event.target.closest?.("[data-world-cup-stat-tab]");
    if (!button) return;

    activeWorldCupStatisticsTab = button.dataset.worldCupStatTab || "scorers";
    renderWorldCupStatistics();
  });
  safeAddEventListener(selectors.matchList, "click", (event) => {
    const button = event.target.closest?.("[data-match-link]");
    if (button && !button.disabled) {
      openMatchDetail(Number(button.dataset.matchLink));
    }
  });
  safeAddEventListener(selectors.groupGrid, "click", (event) => {
    const button = event.target.closest?.("[data-team-link]");
    if (button) {
      openTeamDetail(button.dataset.teamLink);
    }
  });
  safeAddEventListener(selectors.teamGrid, "click", (event) => {
    const button = event.target.closest?.("[data-team-link]");
    if (button) {
      openTeamDetail(button.dataset.teamLink);
    }
  });
  safeAddEventListener(selectors.teamDetailBack, "click", () => {
    if (selectors.teamDetail) {
      delete selectors.teamDetail.dataset.teamId;
    }
    showPanel("teams", { updateRoute: true });
  });
  safeAddEventListener(selectors.matchDetailBack, "click", () => showPanel("calendar", { updateRoute: true }));
  safeAddEventListener(selectors.playerDetailBack, "click", () => {
    if (playerDetailBackTarget === "teamDetail") {
      const teamId = selectors.playerDetail?.dataset.backTeamId || selectors.playerDetail?.dataset.squadTeamId || "";
      if (teamId && teamById.has(teamId)) {
        openTeamDetail(teamId, { updateRoute: true });
        return;
      }

      showPanel("teams", { updateRoute: true });
      return;
    }

    showPanel("home", { updateRoute: true });
  });
  safeAddEventListener(selectors.teamDetailSquad, "click", (event) => {
    const button = event.target.closest?.("[data-squad-player]");
    if (!button) return;
    openSquadPlayerDetail(button.dataset.squadPlayer, button.dataset.teamId, button.dataset.role);
  });
  safeAddEventListener(selectors.timeModeButton, "click", () => {
    timeMode = timeMode === "rome" ? "et" : "rome";
    if (selectors.timeModeLabel) {
      selectors.timeModeLabel.textContent = timeMode === "rome" ? "Italia" : "ET";
    }
    renderCalendar();
    renderPrediction();
    renderHomeBestPick();
    const activePlayerId = selectors.playerDetail?.dataset.playerId;
    if (activePlayerId && playerProfiles?.[activePlayerId] && selectors.playerDetailContent) {
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
    safeAddEventListener(slide, "click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openSlidePlayer(slide);
    });
    safeAddEventListener(slide, "keydown", (event) => {
      if (!["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      openSlidePlayer(slide);
    });
  });

  safeAddEventListener(carousel, "click", (event) => {
    openSlidePlayer(event.target.closest?.("[data-player]"));
  });

  safeAddEventListener(carousel, "keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    const slide = event.target.closest?.("[data-player]");
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

  safeAddEventListener(carousel, "scroll", requestUpdate, { passive: true });
  safeAddEventListener(window, "resize", requestUpdate);
  updateActiveSlide();
}

function showPanel(panelId, options = {}) {
  const targetPanelId = mainPanelIds.has(panelId) || detailPanelIds.has(panelId) ? panelId : "home";
  document.body.classList.toggle("home-active", targetPanelId === "home");
  if (targetPanelId !== "home") {
    closePlayerSearchResults();
    if (selectors.playerSearch) {
      selectors.playerSearch.value = "";
    }
  }
  selectors.panels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.id === targetPanelId);
  });

  if (options.updateRoute && mainPanelIds.has(targetPanelId)) {
    updateRoute(targetPanelId);
  }

  syncActiveTab(targetPanelId);
  if (targetPanelId === "live") {
    startLiveAutoRefresh();
    loadLiveCenter({ force: true });
  }

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

  if (route.panel === "playerDetail") {
    if (route.playerId) {
      openPlayerDetail(route.playerId, {
        backTarget: route.backTarget || "home",
        updateRoute: false,
        scroll: options.scroll,
      });
      return;
    }

    if (route.squadPlayer && route.teamId) {
      openSquadPlayerDetail(route.squadPlayer, route.teamId, route.roleGroup || "", {
        backTarget: route.backTarget || "teamDetail",
        updateRoute: false,
        scroll: options.scroll,
      });
      return;
    }
  }

  showPanel(route.panel, { scroll: options.scroll, updateRoute: false });
}

function syncActiveTab(panelId = getVisibleMainPanelId()) {
  const route = getRouteState();
  const detailBackTarget = route.backTarget === "teamDetail" ? "teams" : route.backTarget;
  const activePanelId = mainPanelIds.has(panelId)
    ? panelId
    : mainPanelIds.has(detailBackTarget)
      ? detailBackTarget
      : mainPanelIds.has(route.panel)
        ? route.panel
        : "home";

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
  const route = rawHash ? parseRoute(rawHash) : readRouteFromSearchParams() || parseRoute(readStoredRoute());

  return route;
}

function readRouteFromSearchParams() {
  const params = new URLSearchParams(window.location.search || "");
  const playerId = params.get("player");
  if (playerId && playerProfiles?.[playerId]) {
    return {
      panel: "playerDetail",
      playerId,
      matchId: null,
      teamId: playerProfiles[playerId]?.teamId || null,
      backTarget: normalizePlayerBackTarget(params.get("from")),
    };
  }

  return null;
}

function parseRoute(value) {
  const [panelPart, queryPart = ""] = String(value || "").replace(/^#/, "").split("?");
  const params = new URLSearchParams(queryPart);
  const decodedPanel = decodeRouteValue(panelPart);
  const playerIdFromSlug = decodedPanel.startsWith("player-") ? decodedPanel.slice("player-".length) : "";
  const playerId = playerIdFromSlug || params.get("player") || "";
  const backTarget = normalizePlayerBackTarget(params.get("from"));

  if ((decodedPanel === "player" || playerIdFromSlug) && playerId && playerProfiles?.[playerId]) {
    return {
      panel: "playerDetail",
      playerId,
      matchId: null,
      teamId: playerProfiles[playerId]?.teamId || null,
      backTarget,
    };
  }

  if (decodedPanel === "squad-player") {
    const squadPlayer = params.get("name") || "";
    const teamId = params.get("team");
    return {
      panel: squadPlayer && teamId && teamById.has(teamId) ? "playerDetail" : "home",
      playerId: null,
      squadPlayer,
      roleGroup: params.get("role") || "",
      matchId: null,
      teamId: teamId && teamById.has(teamId) ? teamId : null,
      backTarget: backTarget === "home" ? "home" : "teamDetail",
    };
  }

  const panel = mainPanelIds.has(panelPart) ? panelPart : "home";
  const matchId = Number(params.get("match"));
  const teamId = params.get("team");

  return {
    panel,
    matchId: Number.isFinite(matchId) ? matchId : null,
    teamId: teamId && teamById.has(teamId) ? teamId : null,
    backTarget: "home",
  };
}

function decodeRouteValue(value = "") {
  try {
    return decodeURIComponent(String(value || ""));
  } catch (error) {
    return String(value || "");
  }
}

function normalizePlayerBackTarget(value) {
  return value === "teamDetail" ? "teamDetail" : "home";
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
  if (panelId === "playerDetail" && route.playerId && playerProfiles?.[route.playerId]) {
    const from = normalizePlayerBackTarget(route.backTarget);
    return `#player-${encodeURIComponent(route.playerId)}${from === "teamDetail" ? "?from=teamDetail" : ""}`;
  }

  if (panelId === "playerDetail" && route.squadPlayer && route.teamId && teamById.has(route.teamId)) {
    const params = new URLSearchParams();
    params.set("team", route.teamId);
    params.set("name", route.squadPlayer);
    if (route.roleGroup) params.set("role", route.roleGroup);
    if (normalizePlayerBackTarget(route.backTarget) === "home") params.set("from", "home");
    return `#squad-player?${params.toString()}`;
  }

  const targetPanelId = mainPanelIds.has(panelId) ? panelId : "home";
  const params = new URLSearchParams();

  if (targetPanelId === "predictor" && selectors.matchPredictSelect?.value) {
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

function updatePlayerRoute(playerId, backTarget = "home") {
  if (!playerId || !playerProfiles?.[playerId]) return;

  const nextHash = buildRouteHash("playerDetail", { playerId, backTarget });
  storeRoute(nextHash);

  if (window.location.hash !== nextHash) {
    window.history.pushState(null, "", nextHash);
  }

  syncActiveTab("playerDetail");
}

function updateSquadPlayerRoute(playerName, teamId, roleGroup = "", backTarget = "teamDetail") {
  if (!playerName || !teamId || !teamById.has(teamId)) return;

  const nextHash = buildRouteHash("playerDetail", {
    squadPlayer: playerName,
    teamId,
    roleGroup,
    backTarget,
  });
  storeRoute(nextHash);

  if (window.location.hash !== nextHash) {
    window.history.pushState(null, "", nextHash);
  }

  syncActiveTab("playerDetail");
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
  if (!select) return;

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
  if (!selectors.confedMenu) return;

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
  const confed = selectors.confedFilter?.value || "all";
  if (selectors.confedSelectLabel) {
    selectors.confedSelectLabel.textContent = confed === "all" ? "Tutte" : confed;
  }

  const currentBadge = selectors.confedSelectButton?.querySelector(".confed-badge");
  if (currentBadge) {
    currentBadge.outerHTML = renderConfedBadge(confed);
  }

  selectors.confedMenu?.querySelectorAll("[data-confed-option]").forEach((option) => {
    option.classList.toggle("is-selected", option.dataset.confedOption === confed);
  });
}

function renderConfedBadge(confed) {
  const label = confed === "all" ? "ALL" : confed;
  return `<span class="confed-badge confed-${confed.toLowerCase()}">${label}</span>`;
}

function buildPlayerSearchIndex() {
  const entries = new Map();

  const addSearchText = (entry, ...parts) => {
    entry.searchText = normalizePlayerName([entry.searchText, ...parts].filter(Boolean).join(" "));
  };

  Object.values(playerProfiles || {}).forEach((profile) => {
    if (!profile?.id) return;

    const team = teamById.get(profile.teamId);
    const name = profile.fullName || profile.shortName || profile.id;
    const entry = {
      type: "profile",
      profileId: profile.id,
      name,
      shortName: profile.shortName || name,
      teamId: profile.teamId || "",
      teamName: team?.name || profile.nationality || unavailableText,
      teamFlag: team?.flag || "",
      club: profile.club || unavailableText,
      role: profile.role || unavailableText,
      image: profile.image || "",
      imageAlt: profile.imageAlt || name,
      searchText: "",
    };

    addSearchText(entry, profile.shortName, profile.fullName, ...(profile.aliases || []), team?.name, team?.fifaName, profile.nationality);
    entries.set(`profile:${profile.id}`, entry);
  });

  Object.entries(squads || {}).forEach(([teamId, squad]) => {
    const team = teamById.get(teamId);
    Object.entries(squad?.groups || {}).forEach(([roleGroup, players]) => {
      players.forEach((playerName) => {
        const availableProfile = findPlayerProfileByName(playerName, teamId);
        if (availableProfile?.id && entries.has(`profile:${availableProfile.id}`)) {
          addSearchText(entries.get(`profile:${availableProfile.id}`), playerName, team?.name, team?.fifaName);
          return;
        }

        const key = `squad:${teamId}:${normalizePlayerName(playerName)}`;
        if (entries.has(key)) return;

        const fallback = buildSquadPlayerFallback(playerName, team, normalizeSquadRole(roleGroup));
        const entry = {
          type: "squad",
          playerName,
          teamId,
          roleGroup,
          name: playerName || fallback.name,
          shortName: playerName || fallback.name,
          teamName: team?.name || fallback.nationality,
          teamFlag: team?.flag || "",
          club: fallback.club,
          role: normalizeSquadRole(roleGroup),
          image: "",
          imageAlt: playerName || "Calciatore",
          searchText: "",
        };

        addSearchText(entry, playerName, team?.name, team?.fifaName, fallback.nationality);
        entries.set(key, entry);
      });
    });
  });

  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name, "it"));
}

function updatePlayerSearchResults() {
  if (!selectors.playerSearch || !selectors.playerSearchResults) return;

  const query = normalizePlayerName(selectors.playerSearch.value);
  if (query.length < 2) {
    closePlayerSearchResults();
    return;
  }

  const queryWords = query.split(" ").filter(Boolean);
  const results = playerSearchIndex
    .map((entry, index) => ({ entry, index, score: getPlayerSearchScore(entry, query, queryWords) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name, "it"))
    .slice(0, 8);

  selectors.playerSearchResults.hidden = false;
  selectors.playerSearch.setAttribute("aria-expanded", String(results.length > 0));
  selectors.playerSearchResults.innerHTML = results.length
    ? results.map((result) => renderPlayerSearchResult(result.entry, result.index)).join("")
    : `<div class="player-search-empty">Nessun giocatore trovato</div>`;
}

function getPlayerSearchScore(entry, query, queryWords) {
  if (!entry?.searchText) return 0;
  if (entry.searchText === query) return 100;
  if (normalizePlayerName(entry.name).startsWith(query)) return 88;
  if (entry.searchText.includes(query)) return 64;
  if (queryWords.every((word) => entry.searchText.includes(word))) return 42;
  return 0;
}

function renderPlayerSearchResult(entry, index) {
  const image = entry.image
    ? `<img src="${escapeAttribute(entry.image)}" alt="${escapeAttribute(entry.imageAlt || entry.name)}" loading="lazy" decoding="async" />`
    : renderPlayerSearchFallback(entry);

  return `
    <button class="player-search-result" type="button" data-player-search-index="${index}">
      ${image}
      <span>
        <strong>${escapeHtml(entry.shortName || entry.name)}</strong>
        <small>${escapeHtml([entry.teamName, entry.club !== unavailableText ? entry.club : "", entry.role].filter(Boolean).join(" - "))}</small>
      </span>
    </button>
  `;
}

function renderPlayerSearchFallback(entry = {}) {
  if (entry.teamFlag) {
    return `<span class="player-search-fallback" aria-hidden="true"><img src="${flagUrl(entry.teamFlag)}" alt="" loading="lazy" /></span>`;
  }

  return `<span class="player-search-fallback" aria-hidden="true">FIQ</span>`;
}

function closePlayerSearchResults() {
  if (selectors.playerSearchResults) {
    selectors.playerSearchResults.hidden = true;
    selectors.playerSearchResults.innerHTML = "";
  }

  selectors.playerSearch?.setAttribute("aria-expanded", "false");
}

function openPlayerSearchResult(index) {
  const entry = playerSearchIndex[index];
  if (!entry) return;

  closePlayerSearchResults();
  if (selectors.playerSearch) {
    selectors.playerSearch.value = entry.shortName || entry.name;
  }

  if (entry.type === "profile" && entry.profileId) {
    openPlayerDetail(entry.profileId, { backTarget: "home" });
    return;
  }

  openSquadPlayerDetail(entry.playerName || entry.name, entry.teamId, entry.roleGroup || entry.role, { backTarget: "home" });
}

function renderLiveCenter(statusMessage = "") {
  if (!selectors.liveCenter) return;

  if (selectors.liveStatus) {
    const updatedAt = apiFootballState.liveUpdatedAt ? ` - aggiornato ${formatLiveUpdateTime(apiFootballState.liveUpdatedAt)}` : "";
    selectors.liveStatus.textContent = statusMessage || apiFootballState.liveError || `Dati ufficiali Mondiali 2026${updatedAt}`;
  }

  if (!apiFootballState.configured && apiFootballState.checked) {
    if (selectors.liveStatus) selectors.liveStatus.textContent = "";
    selectors.liveCenter.innerHTML = renderLiveNoMatchesFallback();
    return;
  }

  if (apiFootballState.liveLoading && !apiFootballState.liveMatches.length) {
    selectors.liveCenter.innerHTML = renderEmptyState(
      "Aggiornamento live",
      "Sto recuperando solo partite, eventi e statistiche dei Mondiali 2026.",
    );
    return;
  }

  if (apiFootballState.liveError && !apiFootballState.liveMatches.length) {
    if (selectors.liveStatus) selectors.liveStatus.textContent = "";
    selectors.liveCenter.innerHTML = renderLiveNoMatchesFallback();
    return;
  }

  if (!apiFootballState.liveMatches.length) {
    if (selectors.liveStatus) selectors.liveStatus.textContent = "";
    selectors.liveCenter.innerHTML = renderLiveNoMatchesFallback();
    return;
  }

  selectors.liveCenter.innerHTML = apiFootballState.liveMatches.map(renderLiveMatchCard).join("");
}

function renderLiveNoMatchesFallback() {
  return `
    <div class="empty-state">
      <strong>Nessuna partita live dei Mondiali al momento</strong>
    </div>
  `;
}

function renderWorldCupStatistics() {
  if (!selectors.worldCupStatistics) return;

  const updatedAt = apiFootballState.tournamentUpdatedAt
    ? `<span>aggiornato ${escapeHtml(formatLiveUpdateTime(apiFootballState.tournamentUpdatedAt))}</span>`
    : "";
  const activeTab = worldCupStatisticsTabs.some((tab) => tab.id === activeWorldCupStatisticsTab)
    ? activeWorldCupStatisticsTab
    : "scorers";
  const activeLabel = worldCupStatisticsTabs.find((tab) => tab.id === activeTab)?.label || "Capocannonieri";

  selectors.worldCupStatistics.innerHTML = `
    <article class="world-cup-stat-card">
      <div class="live-data-head">
        <div>
          <span>Statistiche Mondiale</span>
          <strong>${escapeHtml(activeLabel)}</strong>
        </div>
        ${updatedAt}
      </div>
      <div class="world-cup-stat-tabs" role="tablist" aria-label="Classifiche statistiche Mondiale">
        ${worldCupStatisticsTabs
          .map(
            (tab) => `
              <button
                class="world-cup-stat-tab ${tab.id === activeTab ? "is-active" : ""}"
                type="button"
                role="tab"
                aria-selected="${tab.id === activeTab ? "true" : "false"}"
                data-world-cup-stat-tab="${escapeHtml(tab.id)}"
              >
                ${escapeHtml(tab.label)}
              </button>
            `,
          )
          .join("")}
      </div>
      <div class="world-cup-stat-scroll" role="tabpanel" aria-label="${escapeHtml(activeLabel)}">
        ${renderWorldCupStatisticPanel(activeTab)}
      </div>
    </article>
  `;
}

function renderWorldCupStatisticPanel(tabId) {
  if (tabId === "yellowCards") return renderWorldCupYellowCardsTable();
  if (tabId === "redCards") return renderWorldCupRedCardsTable();
  return renderWorldCupTopScorersTable();
}

function renderWorldCupTopScorersTable() {
  const scorers = apiFootballState.topScorers || [];
  if (apiFootballState.tournamentLoading && !scorers.length) {
    return renderLiveDataFallback("Capocannonieri in aggiornamento", "Sto verificando i marcatori ufficiali del torneo.");
  }

  if (!scorers.length) {
    return renderLiveDataFallback(
      apiFootballState.topScorersError || "Capocannonieri disponibili dopo l'inizio del torneo",
      "",
    );
  }

  const rows = scorers.slice(0, 50).map((item, index) => {
    const player = item.player || {};
    const stats = item.statistics?.[0] || {};
    const goals = readTournamentStatNumber(stats.goals?.total) ?? 0;
    const penalties = readTournamentStatNumber(stats.penalty?.scored);
    const team = stats.team?.name || player.nationality || unavailableText;
    return {
      position: index + 1,
      player: player.name || unavailableText,
      team,
      goals,
      penalties,
    };
  });
  const showPenalties = rows.some((row) => row.penalties !== null);
  const columns = showPenalties ? "pos player team value optional" : "pos player team value";

  return `
    <div class="world-cup-stat-table ${showPenalties ? "has-optional-col" : ""}" role="table" aria-label="Classifica capocannonieri">
      <div class="world-cup-stat-row world-cup-stat-header" role="row" data-columns="${columns}">
        <span role="columnheader">#</span>
        <span role="columnheader">Giocatore</span>
        <span role="columnheader">Nazionale</span>
        <span role="columnheader">Gol</span>
        ${showPenalties ? `<span role="columnheader">Rig.</span>` : ""}
      </div>
      ${rows
        .map(
          (row) => `
            <div class="world-cup-stat-row" role="row" data-columns="${columns}">
              <span role="cell">${escapeHtml(String(row.position))}</span>
              <strong role="cell">${escapeHtml(row.player)}</strong>
              <span role="cell">${escapeHtml(row.team)}</span>
              <b role="cell">${escapeHtml(String(row.goals))}</b>
              ${showPenalties ? `<span role="cell">${escapeHtml(formatOptionalTournamentStat(row.penalties))}</span>` : ""}
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderWorldCupYellowCardsTable() {
  const cards = apiFootballState.topYellowCards || [];
  if (apiFootballState.tournamentLoading && !cards.length) {
    return renderLiveDataFallback("Ammonizioni in aggiornamento", "Sto verificando la classifica disciplinare ufficiale.");
  }

  if (!cards.length) {
    return renderLiveDataFallback(
      apiFootballState.topYellowCardsError || "Classifica ammonizioni disponibile dopo l'inizio del torneo",
      "",
    );
  }

  const rows = cards.slice(0, 50).map((item, index) => {
    const player = item.player || {};
    const stats = item.statistics?.[0] || {};
    const yellow = readTournamentStatNumber(stats.cards?.yellow) ?? 0;
    const team = stats.team?.name || player.nationality || unavailableText;
    return {
      position: index + 1,
      player: player.name || unavailableText,
      team,
      yellow,
    };
  });

  return `
    <div class="world-cup-stat-table" role="table" aria-label="Classifica ammonizioni">
      <div class="world-cup-stat-row world-cup-stat-header" role="row" data-columns="pos player team value">
        <span role="columnheader">#</span>
        <span role="columnheader">Giocatore</span>
        <span role="columnheader">Nazionale</span>
        <span role="columnheader">Gialli</span>
      </div>
      ${rows
        .map(
          (row) => `
            <div class="world-cup-stat-row" role="row" data-columns="pos player team value">
              <span role="cell">${escapeHtml(String(row.position))}</span>
              <strong role="cell">${escapeHtml(row.player)}</strong>
              <span role="cell">${escapeHtml(row.team)}</span>
              <b role="cell">${escapeHtml(String(row.yellow))}</b>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderWorldCupRedCardsTable() {
  const cards = apiFootballState.topRedCards || [];
  if (apiFootballState.tournamentLoading && !cards.length) {
    return renderLiveDataFallback("Espulsioni in aggiornamento", "Sto verificando la classifica disciplinare ufficiale.");
  }

  if (!cards.length) {
    return renderLiveDataFallback(
      apiFootballState.topRedCardsError || "Classifica espulsioni disponibile dopo l'inizio del torneo",
      "",
    );
  }

  const rows = cards.slice(0, 50).map((item, index) => {
    const player = item.player || {};
    const stats = item.statistics?.[0] || {};
    const red = readTournamentStatNumber(stats.cards?.red) ?? 0;
    const team = stats.team?.name || player.nationality || unavailableText;
    return {
      position: index + 1,
      player: player.name || unavailableText,
      team,
      red,
    };
  });

  return `
    <div class="world-cup-stat-table" role="table" aria-label="Classifica espulsioni">
      <div class="world-cup-stat-row world-cup-stat-header" role="row" data-columns="pos player team value">
        <span role="columnheader">#</span>
        <span role="columnheader">Giocatore</span>
        <span role="columnheader">Nazionale</span>
        <span role="columnheader">Rossi</span>
      </div>
      ${rows
        .map(
          (row) => `
            <div class="world-cup-stat-row" role="row" data-columns="pos player team value">
              <span role="cell">${escapeHtml(String(row.position))}</span>
              <strong role="cell">${escapeHtml(row.player)}</strong>
              <span role="cell">${escapeHtml(row.team)}</span>
              <b role="cell">${escapeHtml(String(row.red))}</b>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function readTournamentStatNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatOptionalTournamentStat(value) {
  return value === null ? "-" : String(value);
}

function renderLiveDataFallback(title, copy) {
  return `
    <div class="live-data-fallback">
      <strong>${escapeHtml(title)}</strong>
      ${copy ? `<p>${escapeHtml(copy)}</p>` : ""}
    </div>
  `;
}

function renderLiveMatchCard(item) {
  const fixture = item.fixture?.fixture || {};
  const league = item.fixture?.league || {};
  const teamsInfo = item.fixture?.teams || {};
  const goals = item.fixture?.goals || {};
  const home = teamsInfo.home || {};
  const away = teamsInfo.away || {};
  const elapsed = fixture.status?.elapsed ?? fixture.status?.extra ?? unavailableText;
  const status = fixture.status?.short || fixture.status?.long || unavailableText;

  return `
    <article class="live-match-card">
      <div class="live-match-head">
        <span>${escapeHtml(league.name || unavailableText)}</span>
        <span class="live-minute">${escapeHtml(elapsed === unavailableText ? status : `${elapsed}'`)}</span>
      </div>
      <div class="live-scoreline">
        <strong>${escapeHtml(home.name || unavailableText)}</strong>
        <span class="live-score">${escapeHtml(formatLiveGoal(goals.home))} - ${escapeHtml(formatLiveGoal(goals.away))}</span>
        <strong>${escapeHtml(away.name || unavailableText)}</strong>
      </div>
      <div class="live-detail-grid">
        <section class="live-block">
          <h3>Marcatori ed eventi</h3>
          ${renderLiveEvents(item.events)}
        </section>
        <section class="live-block">
          <h3>Statistiche live</h3>
          ${renderLiveStatistics(item.statistics)}
        </section>
        <section class="live-block">
          <h3>Formazioni ufficiali</h3>
          ${renderLiveLineups(item.lineups)}
        </section>
        <section class="live-block">
          <h3>Infortuni</h3>
          ${renderLiveInjuries(item.injuries)}
        </section>
        <section class="live-block">
          <h3>Giocatori</h3>
          ${renderLivePlayerStats(item.players)}
        </section>
      </div>
    </article>
  `;
}

function renderLiveEvents(events = []) {
  const relevant = (events || []).filter((event) => {
    const type = normalizePlayerName(event?.type);
    const detail = normalizePlayerName(event?.detail);
    return type.includes("goal") || type.includes("card") || type.includes("penalty") || detail.includes("penalty");
  });
  if (!relevant.length) return `<div class="live-event-row"><span>Eventi</span><strong>${unavailableText}</strong></div>`;

  return relevant
    .map((event) => {
      const label = event.type === "Goal" ? (normalizePlayerName(event.detail).includes("penalty") ? "Rigore" : "Gol") : event.detail || event.type || "Evento";
      const minute = event.time?.elapsed ? `${event.time.elapsed}'` : unavailableText;
      const player = event.player?.name || unavailableText;
      const team = event.team?.name || "";
      return `<div class="live-event-row"><span>${escapeHtml(minute)} · ${escapeHtml(label)}</span><strong>${escapeHtml([player, team].filter(Boolean).join(" · "))}</strong></div>`;
    })
    .join("");
}

function renderLiveInjuries(injuries = []) {
  const rows = (injuries || [])
    .map((injury) => {
      const player = injury.player?.name || unavailableText;
      const team = injury.team?.name || "";
      const type = injury.type || injury.reason || unavailableText;
      return `<div class="live-event-row"><span>${escapeHtml([player, team].filter(Boolean).join(" - "))}</span><strong>${escapeHtml(type)}</strong></div>`;
    })
    .slice(0, 6);

  return rows.length ? rows.join("") : `<div class="live-event-row"><span>Infortuni</span><strong>${unavailableText}</strong></div>`;
}

function renderLiveStatistics(statistics = []) {
  if (!statistics?.length) {
    return `
      <div class="live-stat-row"><span>Possesso palla</span><strong>${unavailableText}</strong></div>
      <div class="live-stat-row"><span>Tiri</span><strong>${unavailableText}</strong></div>
      <div class="live-stat-row"><span>Tiri in porta</span><strong>${unavailableText}</strong></div>
      <div class="live-stat-row"><span>Expected goals</span><strong>${unavailableText}</strong></div>
    `;
  }

  const home = statistics[0];
  const away = statistics[1];
  const rows = [
    ["Possesso palla", "Ball Possession"],
    ["Tiri", "Total Shots"],
    ["Tiri in porta", "Shots on Goal"],
    ["Expected goals", "expected_goals", "Expected Goals"],
  ];

  return rows
    .map(([label, ...types]) => {
      const homeValue = findApiStatistic(home, types);
      const awayValue = findApiStatistic(away, types);
      return `<div class="live-stat-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(homeValue)} · ${escapeHtml(awayValue)}</strong></div>`;
    })
    .join("");
}

function renderLiveLineups(lineups = []) {
  if (!lineups?.length) {
    return `<div class="live-lineup-head"><span>Formazioni</span><strong>${unavailableText}</strong></div>`;
  }

  return lineups
    .map((lineup) => {
      const starters = (lineup.startXI || [])
        .map((item) => item?.player?.name)
        .filter(Boolean)
        .slice(0, 11);
      return `
        <div class="live-lineup-head">
          <span>${escapeHtml(lineup.team?.name || unavailableText)}</span>
          <strong>${escapeHtml(lineup.formation || unavailableText)}</strong>
        </div>
        <ul class="live-lineup-list">
          ${starters.length ? starters.map((name) => `<li>${escapeHtml(name)}</li>`).join("") : `<li>${unavailableText}</li>`}
        </ul>
      `;
    })
    .join("");
}

function renderLivePlayerStats(players = []) {
  const rows = (players || [])
    .flatMap((team) => team.players || [])
    .map((item) => {
      const stats = item.statistics?.[0] || {};
      const goals = stats.goals?.total;
      const cards = [stats.cards?.yellow ? `${stats.cards.yellow} gialli` : "", stats.cards?.red ? `${stats.cards.red} rossi` : ""]
        .filter(Boolean)
        .join(", ");
      if (!goals && !cards) return "";
      return `<div class="live-event-row"><span>${escapeHtml(item.player?.name || unavailableText)}</span><strong>${escapeHtml([goals ? `${goals} gol` : "", cards].filter(Boolean).join(" · "))}</strong></div>`;
    })
    .filter(Boolean)
    .slice(0, 8);

  return rows.length ? rows.join("") : `<div class="live-event-row"><span>Statistiche giocatori</span><strong>${unavailableText}</strong></div>`;
}

function findApiStatistic(teamStats = {}, types = []) {
  const normalizedTypes = types.map((type) => normalizePlayerName(type));
  const item = (teamStats.statistics || []).find((stat) => normalizedTypes.includes(normalizePlayerName(stat.type)));
  return formatProfileValue(item?.value);
}

function formatLiveGoal(value) {
  return value === null || value === undefined ? unavailableText : String(value);
}

function formatLiveUpdateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: meta.timezoneUser || "Europe/Rome",
  }).format(date);
}

function renderCalendar() {
  if (!selectors.matchList) return;

  if (!fixtures.length) {
    selectors.matchList.innerHTML = renderEmptyState("Dati in aggiornamento", "Il calendario verra mostrato appena i dati saranno disponibili.");
    return;
  }

  const stage = selectors.stageFilter?.value || "all";
  const group = selectors.groupFilter?.value || "all";
  const team = selectors.teamFilter?.value || "all";

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
  if (!selectors.groupGrid) return;

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
              <button class="standing-row team-link-row ${index < 2 ? "is-qualified" : "is-eliminated"}" type="button" data-team-link="${row.team.id}">
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
  if (!selectors.teamGrid) return;

  if (!teams.length) {
    selectors.teamGrid.innerHTML = renderEmptyState("Dati in aggiornamento", "Le schede squadra saranno visibili appena i dati saranno disponibili.");
    return;
  }

  const search = (selectors.teamSearch?.value || "").trim().toLowerCase();
  const confed = selectors.confedFilter?.value || "all";
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
  if (!selectors.matchPredictSelect) return;

  const groupFixtures = getCurrentGroupMatchdayFixtures();
  if (!groupFixtures.length) {
    selectors.matchPredictSelect.innerHTML = `<option value="">Partita non disponibile</option>`;
    return;
  }

  const selectedValue = selectors.matchPredictSelect.value;
  selectors.matchPredictSelect.innerHTML = groupFixtures
    .map((fixture) => {
      const home = teamById.get(fixture.home);
      const away = teamById.get(fixture.away);
      return `<option value="${fixture.id}">#${fixture.id} ${home.name} - ${away.name}</option>`;
    })
    .join("");

  if ([...selectors.matchPredictSelect.options].some((option) => option.value === selectedValue)) {
    selectors.matchPredictSelect.value = selectedValue;
  }
}

function getCurrentGroupMatchdayFixtures() {
  const groupFixtures = fixtures.filter((fixture) => fixture.stage === "Group Stage" && fixture.home && fixture.away);
  const matchday = getCurrentGroupMatchday(groupFixtures);

  return groupFixtures.filter((fixture) => getGroupMatchdayNumber(fixture) === matchday);
}

function getCurrentGroupMatchday(groupFixtures) {
  const matchdays = [1, 2, 3];
  const activeMatchday = matchdays.find((matchday) => {
    const matchdayFixtures = groupFixtures.filter((fixture) => getGroupMatchdayNumber(fixture) === matchday);
    return matchdayFixtures.length && !matchdayFixtures.every(isFixtureCompleted);
  });

  return activeMatchday || 3;
}

function getGroupMatchdayNumber(fixture) {
  if (fixture.stage !== "Group Stage") return null;
  if (fixture.id >= 1 && fixture.id <= 24) return 1;
  if (fixture.id >= 25 && fixture.id <= 48) return 2;
  if (fixture.id >= 49 && fixture.id <= 72) return 3;
  return null;
}

function isFixtureCompleted(fixture) {
  return Number.isFinite(Number(fixture.score?.home)) && Number.isFinite(Number(fixture.score?.away));
}

function renderPrediction() {
  if (!selectors.predictionCard) return;

  if (!fixtures.length || !selectors.matchPredictSelect?.value) {
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
    ${renderAnalysisCard(model)}
  `;
}

function renderHomeBestPick() {
  if (!selectors.homeBestPick) return;

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

  const worldCupNews = getWorldCupNewsItems();

  if ((apiFootballState.newsLoading || (!apiFootballState.checked && !apiFootballState.newsError)) && !worldCupNews.length) {
    selectors.dailyNewsCard.innerHTML = renderEmptyState("Aggiornamento Mondiali", "Sto leggendo solo eventi FIFA World Cup 2026.");
    return;
  }

  if (!worldCupNews.length) {
    selectors.dailyNewsCard.innerHTML = renderEmptyState(
      "Nessun evento Mondiali",
      apiFootballState.newsError || "Nessun aggiornamento FIFA World Cup 2026 disponibile al momento.",
    );
    return;
  }

  const today = getLocalDateKey(new Date());
  const ordered = worldCupNews
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || (b.priority || 0) - (a.priority || 0));
  const mainNews = ordered.find((item) => item.date <= today) || ordered[0];
  const relatedNews = ordered.filter((item) => item.id !== mainNews.id).slice(0, 2);
  const sourceLink = mainNews.url
    ? `<a href="${escapeAttribute(mainNews.url)}" target="_blank" rel="noopener noreferrer">Fonte ${escapeHtml(mainNews.source)}</a>`
    : `<span>${escapeHtml(mainNews.source || "FIFA")}</span>`;

  const media = renderDailyNewsMedia(mainNews);

  selectors.dailyNewsCard.innerHTML = `
    ${media}
    <div class="daily-news-head">
      <div>
        <p class="eyebrow">${escapeHtml(getDailyNewsLabel(mainNews))}</p>
        <div class="daily-news-time">
          <span>${escapeHtml(getDailyNewsKicker(mainNews))}</span>
        </div>
      </div>
      <div class="daily-news-badges">
        ${mainNews.badge && isApiFootballNewsItem(mainNews) ? `<strong class="news-live-badge">${escapeHtml(mainNews.badge)}</strong>` : ""}
        <strong>${escapeHtml(mainNews.tag || "Mondiali 2026")}</strong>
      </div>
    </div>
    <h2>${escapeHtml(mainNews.title)}</h2>
    <p>${escapeHtml(mainNews.summary)}</p>
    <div class="daily-news-actions">
      ${sourceLink}
    </div>
    ${
      relatedNews.length
        ? `<div class="daily-news-list">
            ${relatedNews
              .map(
                (item) => `
                  <a href="${escapeAttribute(item.url || "#")}" target="_blank" rel="noopener noreferrer">
                    ${renderDailyNewsThumb(item)}
                    <span>${escapeHtml(item.tag || "Mondiali 2026")}</span>
                    <strong>${escapeHtml(item.title)}</strong>
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
    return `<div class="daily-news-logo-panel"><strong>${escapeHtml(item.logoText)}</strong><span>${escapeHtml(item.logoSub || "World Cup")}</span></div>`;
  }

  if (item.image) {
    return `<div class="daily-news-media"><img src="${escapeAttribute(item.image)}" alt="${escapeAttribute(item.imageAlt || item.title)}" loading="lazy" decoding="async" /></div>`;
  }

  return `<div class="daily-news-logo-panel"><strong>NEWS</strong><span>${escapeHtml(item.tag || "World Cup")}</span></div>`;
}

function getDailyNewsLabel(item = {}) {
  return isApiFootballNewsItem(item) ? "Evento Mondiali 2026" : "Aggiornamento Mondiali 2026";
}

function getDailyNewsKicker(item = {}) {
  return isApiFootballNewsItem(item) ? "Dati live verificati" : "FIFA World Cup 2026";
}

function isApiFootballNewsItem(item = {}) {
  return item.source === "API-FOOTBALL";
}

function getWorldCupNewsItems() {
  const apiItems = (apiFootballState.newsItems || []).filter(isWorldCupNewsItem);
  if (apiItems.length) return apiItems;
  return (dailyNews || []).filter(isWorldCupNewsItem);
}

function renderDailyNewsThumb(item) {
  if (item.image) {
    return `<img src="${escapeAttribute(item.image)}" alt="${escapeAttribute(item.imageAlt || item.title)}" loading="lazy" decoding="async" />`;
  }

  return `<span class="daily-news-list-logo">${escapeHtml(item.logoText || "NEWS")}</span>`;
}

function renderAnalisiIQWordmark() {
  return `<span class="analisi-wordmark">Analisi<span class="iq-cluster"><span class="iq-ball-i">I</span>Q</span></span>`;
}

function renderAnalysisCard(model) {
  const insight = buildAnalysisInsight(model);
  const fixture = model.fixture;

  return `
    <div class="analysis-card-head">
      <div>
        <span class="match-number">#${fixture.id}</span>
        <span>${stageLabels[fixture.stage] || fixture.stage}</span>
      </div>
      <strong>${formatFixtureDate(fixture)}</strong>
    </div>
    <div class="analysis-match-row">
      ${renderTeamTiny(model.home)}
      <span class="versus">vs</span>
      ${renderTeamTiny(model.away)}
    </div>
    <div class="analysis-summary-grid">
      <article class="analysis-primary-metric">
        <span>Scenario favorito</span>
        <strong class="${insight.className}">${escapeHtml(insight.scenario)}</strong>
      </article>
      <article class="analysis-confidence-metric">
        <span>Indice fiducia</span>
        <strong class="${insight.className}">${escapeHtml(insight.level)}</strong>
        <small>${model.confidence}% | lettura dati</small>
      </article>
      <article>
        <span>xG stimato</span>
        <strong>${model.expectedGoals.home.toFixed(2)} - ${model.expectedGoals.away.toFixed(2)}</strong>
      </article>
    </div>
    <div class="analysis-reasoning">
      <span>Motivazione</span>
      <p>${escapeHtml(insight.motivation)}</p>
    </div>
    <div class="analysis-factor-grid">
      <article>
        <span>Fattori chiave</span>
        <ul>
          ${insight.factors.map((factor) => `<li>${escapeHtml(factor)}</li>`).join("")}
        </ul>
      </article>
      <article class="analysis-goal-trend">
        <span>Scenario gol</span>
        <strong>${escapeHtml(insight.goalTrend.label)}</strong>
        <p>${escapeHtml(insight.goalTrend.copy)}</p>
      </article>
    </div>
  `;
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

function getTeamRecentProfile(team, fixture) {
  const realMatches = getRecentTeamMatches(team.id, fixture, 5);
  const estimated = buildEstimatedRecentProfile(team);
  if (!realMatches.length) return estimated;

  const realProfile = summarizeRecentMatches(team, realMatches);
  if (realMatches.length >= 5) return realProfile;

  const realWeight = realMatches.length / 5;
  const estimatedWeight = 1 - realWeight;
  const mixed = {
    ...realProfile,
    source: "mixed",
    sourceLabel: "dati torneo + fallback pre-torneo",
    matches: realMatches.length,
    formScore: clamp(realProfile.formScore * realWeight + estimated.formScore * estimatedWeight, 35, 96),
    attackScore: clamp(realProfile.attackScore * realWeight + estimated.attackScore * estimatedWeight, 35, 96),
    defenseScore: clamp(realProfile.defenseScore * realWeight + estimated.defenseScore * estimatedWeight, 35, 96),
    avgGoalsFor: realProfile.avgGoalsFor * realWeight + estimated.avgGoalsFor * estimatedWeight,
    avgGoalsAgainst: realProfile.avgGoalsAgainst * realWeight + estimated.avgGoalsAgainst * estimatedWeight,
    goalTempo: realProfile.goalTempo * realWeight + estimated.goalTempo * estimatedWeight,
    cleanSheetRate: realProfile.cleanSheetRate * realWeight + estimated.cleanSheetRate * estimatedWeight,
  };

  return mixed;
}

function getRecentTeamMatches(teamId, fixture, limit = 5) {
  const cutoff = getFixtureDate(fixture);
  return fixtures
    .filter((item) => {
      const involvesTeam = item.home === teamId || item.away === teamId;
      return involvesTeam && isFixtureCompleted(item) && getFixtureDate(item) < cutoff;
    })
    .sort((a, b) => getFixtureDate(b) - getFixtureDate(a) || b.id - a.id)
    .slice(0, limit);
}

function summarizeRecentMatches(team, matches) {
  const stats = matches.reduce(
    (acc, item) => {
      const isHome = item.home === team.id;
      const goalsFor = Number(isHome ? item.score.home : item.score.away);
      const goalsAgainst = Number(isHome ? item.score.away : item.score.home);
      acc.goalsFor += goalsFor;
      acc.goalsAgainst += goalsAgainst;
      acc.cleanSheets += goalsAgainst === 0 ? 1 : 0;
      if (goalsFor > goalsAgainst) {
        acc.wins += 1;
        acc.points += 3;
      } else if (goalsFor === goalsAgainst) {
        acc.draws += 1;
        acc.points += 1;
      } else {
        acc.losses += 1;
      }
      return acc;
    },
    { wins: 0, draws: 0, losses: 0, points: 0, goalsFor: 0, goalsAgainst: 0, cleanSheets: 0 },
  );
  const matchCount = matches.length || 1;
  const avgGoalsFor = stats.goalsFor / matchCount;
  const avgGoalsAgainst = stats.goalsAgainst / matchCount;
  const goalDifferencePerMatch = (stats.goalsFor - stats.goalsAgainst) / matchCount;
  const pointsRate = stats.points / (matchCount * 3);
  const cleanSheetRate = stats.cleanSheets / matchCount;
  const formScore = clamp(pointsRate * 58 + goalDifferencePerMatch * 12 + avgGoalsFor * 8 - avgGoalsAgainst * 7 + cleanSheetRate * 14 + 32, 20, 98);
  const attackScore = clamp(avgGoalsFor * 30 + Math.max(goalDifferencePerMatch, 0) * 8 + 42, 25, 98);
  const defenseScore = clamp(92 - avgGoalsAgainst * 28 + cleanSheetRate * 18 + Math.max(-goalDifferencePerMatch, 0) * -4, 25, 98);

  return {
    source: "tournament",
    sourceLabel: "ultime partite reali del torneo",
    matches: matches.length,
    wins: stats.wins,
    draws: stats.draws,
    losses: stats.losses,
    points: stats.points,
    goalsFor: stats.goalsFor,
    goalsAgainst: stats.goalsAgainst,
    cleanSheets: stats.cleanSheets,
    cleanSheetRate,
    avgGoalsFor,
    avgGoalsAgainst,
    goalTempo: avgGoalsFor + avgGoalsAgainst,
    formScore,
    attackScore,
    defenseScore,
  };
}

function buildEstimatedRecentProfile(team) {
  const tempo = getTeamTempoModifier(team);
  const avgGoalsFor = clamp(0.72 + (team.attack - 58) * 0.025 + (team.form - 70) * 0.008 + tempo * 0.08, 0.45, 2.55);
  const avgGoalsAgainst = clamp(1.72 - (team.defense - 58) * 0.024 - (team.form - 70) * 0.006 + Math.max(tempo, 0) * 0.04, 0.42, 2.45);
  const cleanSheetRate = clamp((team.defense - 54) / 58 + (team.form - 65) / 95, 0.05, 0.62);
  const formScore = clamp(team.form * 0.78 + team.rating * 0.12 + team.defense * 0.05 + team.attack * 0.05, 32, 94);
  const attackScore = clamp(team.attack * 0.72 + team.form * 0.18 + avgGoalsFor * 5, 30, 96);
  const defenseScore = clamp(team.defense * 0.74 + team.form * 0.16 + cleanSheetRate * 12 - avgGoalsAgainst * 3, 30, 96);

  return {
    source: "estimated",
    sourceLabel: "fallback pre-torneo",
    matches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0,
    goalsFor: avgGoalsFor * 5,
    goalsAgainst: avgGoalsAgainst * 5,
    cleanSheets: Math.round(cleanSheetRate * 5),
    cleanSheetRate,
    avgGoalsFor,
    avgGoalsAgainst,
    goalTempo: avgGoalsFor + avgGoalsAgainst,
    formScore,
    attackScore,
    defenseScore,
  };
}

function buildAnalysisInsight(model) {
  const { home, away, prediction, expectedGoals, recent } = model;
  const confidence = getAnalysisConfidence(model);
  const isDrawScenario = prediction.pickSign === "X";

  if (isDrawScenario) {
    const factors = getEquilibriumFactors(home, away, expectedGoals, prediction, recent);
    return {
      scenario: "Equilibrio",
      level: confidence.label,
      className: confidence.className,
      motivation: getEquilibriumMotivation(home, away, expectedGoals, factors, recent),
      factors,
      goalTrend: getGoalTrend(model),
    };
  }

  const favorite = prediction.pickSign === "1" ? home : away;
  const underdog = prediction.pickSign === "1" ? away : home;
  const favoriteProfile = prediction.pickSign === "1" ? recent.home : recent.away;
  const underdogProfile = prediction.pickSign === "1" ? recent.away : recent.home;
  const favoriteXg = prediction.pickSign === "1" ? expectedGoals.home : expectedGoals.away;
  const underdogXg = prediction.pickSign === "1" ? expectedGoals.away : expectedGoals.home;
  const factors = getAnalysisFactors(favorite, underdog, favoriteProfile, underdogProfile, favoriteXg, underdogXg);

  return {
    scenario: favorite.name,
    level: confidence.label,
    className: confidence.className,
    motivation: getFavoriteMotivation(favorite, underdog, favoriteProfile, underdogProfile, factors, favoriteXg, underdogXg),
    factors,
    goalTrend: getGoalTrend(model),
  };
}

function getAnalysisConfidence(model) {
  if (model.prediction.pickSign === "X" || model.confidence < 44) {
    return { label: "Equilibrio / incertezza", className: "confidence-mid" };
  }

  if (model.confidence >= 70) {
    return { label: "Alta", className: "confidence-high" };
  }

  return { label: "Media", className: "confidence-low" };
}

function getAnalysisFactors(favorite, underdog, favoriteProfile, underdogProfile, favoriteXg, underdogXg) {
  const candidates = [
    { label: "Forma recente superiore nelle ultime 5 uscite", score: (favoriteProfile.formScore - underdogProfile.formScore) * 1.7 },
    { label: "Migliore rendimento offensivo recente", score: (favoriteProfile.avgGoalsFor - underdogProfile.avgGoalsFor) * 34 },
    { label: "Difesa piu solida con piu clean sheet", score: (favoriteProfile.cleanSheetRate - underdogProfile.cleanSheetRate) * 46 },
    { label: "Meno gol subiti nel periodo recente", score: (underdogProfile.avgGoalsAgainst - favoriteProfile.avgGoalsAgainst) * 30 },
    { label: "Squadra in crescita nel torneo", score: favoriteProfile.matches >= 2 && favoriteProfile.formScore > favorite.form + 5 ? 18 : 0 },
    { label: "xG stimato piu favorevole", score: (favoriteXg - underdogXg) * 22 },
    { label: "Supporto ranking/qualita rosa", score: (favorite.rating - underdog.rating) * 0.32 + (underdog.rank - favorite.rank) * 0.07 },
    { label: "Contesto favorevole da paese ospitante", score: favorite.host ? 6 : 0 },
  ];
  const factors = candidates
    .filter((factor) => factor.score >= 4.5)
    .sort((a, b) => b.score - a.score)
    .map((factor) => factor.label);

  return unique(factors).slice(0, 3).length
    ? unique(factors).slice(0, 3)
    : ["Differenza recente leggera", "Statistiche ultime 5 appena favorevoli", "Lettura dati senza margine ampio"];
}

function getEquilibriumFactors(home, away, expectedGoals, prediction, recent) {
  const factors = [];
  const homeProfile = recent.home;
  const awayProfile = recent.away;

  if (Math.abs(homeProfile.formScore - awayProfile.formScore) <= 7) factors.push("Forma recente simile nelle ultime 5");
  if (Math.abs(homeProfile.avgGoalsFor - awayProfile.avgGoalsFor) <= 0.28) factors.push("Rendimento offensivo recente vicino");
  if (Math.abs(homeProfile.avgGoalsAgainst - awayProfile.avgGoalsAgainst) <= 0.28) factors.push("Solidita difensiva recente simile");
  if (Math.abs(expectedGoals.home - expectedGoals.away) <= 0.24) factors.push("xG attesi ravvicinati");
  if (prediction.draw >= 0.27) factors.push("Margine statistico ridotto tra le squadre");

  return unique(factors).slice(0, 3).length
    ? unique(factors).slice(0, 3)
    : ["Ultime 5 senza separazione netta", "xG attesi ravvicinati", "Lettura dati senza margine netto"];
}

function getFavoriteMotivation(favorite, underdog, favoriteProfile, underdogProfile, factors, favoriteXg, underdogXg) {
  const lead = factors[0] || "lettura dati favorevole";
  const dataScope = favoriteProfile.source === "tournament" || underdogProfile.source === "tournament" ? "nelle ultime uscite del torneo" : "nel fallback pre-torneo";

  if (lead.includes("Forma")) {
    return `${favorite.name} prende vantaggio per forma recente superiore ${dataScope}: indice ultime 5 ${Math.round(favoriteProfile.formScore)} contro ${Math.round(underdogProfile.formScore)}. Il modello parte da risultati, gol e clean sheet, non dal nome della squadra.`;
  }

  if (lead.includes("offensivo")) {
    return `${favorite.name} ha un rendimento offensivo recente piu alto: ${favoriteProfile.avgGoalsFor.toFixed(2)} gol fatti a partita contro ${underdogProfile.avgGoalsFor.toFixed(2)}. Questo spinge anche la stima xG (${favoriteXg.toFixed(2)} contro ${underdogXg.toFixed(2)}).`;
  }

  if (lead.includes("clean sheet") || lead.includes("subiti")) {
    return `${favorite.name} risulta piu solida dietro: ${favoriteProfile.avgGoalsAgainst.toFixed(2)} gol subiti a partita e ${favoriteProfile.cleanSheets} clean sheet nel campione recente. Questo abbassa lo spazio statistico per ${underdog.name}.`;
  }

  if (lead.includes("crescita")) {
    return `${favorite.name} mostra segnali di crescita nel torneo: i risultati gia registrati pesano piu del ranking e aggiornano automaticamente la lettura delle gare successive.`;
  }

  if (lead.includes("xG")) {
    return `${favorite.name} emerge per una proiezione xG piu alta (${favoriteXg.toFixed(2)} contro ${underdogXg.toFixed(2)}), costruita da gol fatti, gol subiti e clean sheet recenti.`;
  }

  if (lead.includes("ranking") || lead.includes("qualita")) {
    return `${favorite.name} mantiene un supporto da ranking e qualita rosa, ma il margine resta subordinato alla forma recente: ${Math.round(favoriteProfile.formScore)} contro ${Math.round(underdogProfile.formScore)} nelle ultime 5 stimate/reali.`;
  }

  if (lead.includes("Contesto")) {
    return `${favorite.name} ha una lieve spinta da paese ospitante, letta solo come supporto dopo forma recente, gol fatti/subiti e solidita difensiva.`;
  }

  return `${favorite.name} emerge come scenario favorito per ${formatReasonList(factors.slice(0, 2))}. La scelta nasce dalla fotografia delle ultime 5, non da un pronostico casuale.`;
}

function getEquilibriumMotivation(home, away, expectedGoals, factors, recent) {
  if (factors.some((factor) => factor.includes("xG"))) {
    return `La lettura dati indica margini ridotti tra ${home.name} e ${away.name}: gli xG restano vicini (${expectedGoals.home.toFixed(2)} - ${expectedGoals.away.toFixed(2)}) e le ultime 5 non aprono un vantaggio netto.`;
  }

  if (factors.some((factor) => factor.includes("Forma") || factor.includes("offensivo") || factor.includes("difensiva"))) {
    return `${home.name} e ${away.name} hanno segnali recenti vicini: forma ${Math.round(recent.home.formScore)}-${Math.round(recent.away.formScore)}, gol fatti ${recent.home.avgGoalsFor.toFixed(2)}-${recent.away.avgGoalsFor.toFixed(2)} e gol subiti ${recent.home.avgGoalsAgainst.toFixed(2)}-${recent.away.avgGoalsAgainst.toFixed(2)}.`;
  }

  return `La lettura dati indica equilibrio tra ${home.name} e ${away.name}: risultati recenti, produzione offensiva e solidita difensiva non separano chiaramente le due squadre.`;
}

function getGoalTrend(model) {
  const { expectedGoals, recent } = model;
  const totalXg = expectedGoals.home + expectedGoals.away;
  const recentGoalTempo = (recent.home.goalTempo + recent.away.goalTempo) / 2;
  const offensiveTrend = (recent.home.avgGoalsFor + recent.away.avgGoalsFor) / 2;
  const defensiveLeaks = (recent.home.avgGoalsAgainst + recent.away.avgGoalsAgainst) / 2;
  const cleanSheetDrag = (recent.home.cleanSheetRate + recent.away.cleanSheetRate) / 2;
  const opennessScore =
    totalXg * 0.55 +
    recentGoalTempo * 0.34 +
    offensiveTrend * 0.28 +
    defensiveLeaks * 0.18 -
    cleanSheetDrag * 0.42;

  if (opennessScore >= 2.42 || (totalXg >= 2.16 && recentGoalTempo >= 2.54 && cleanSheetDrag < 0.36)) {
    return {
      label: "Over 2.5",
      copy: `Ultime 5 con media gol elevata: ritmo combinato ${recentGoalTempo.toFixed(2)} e xG totale ${totalXg.toFixed(2)} orientano verso almeno 3 gol.`,
    };
  }

  return {
    label: "Under 2.5",
    copy: `Ultime 5 piu controllate: clean sheet e gol subiti recenti abbassano il totale atteso (${totalXg.toFixed(2)} xG).`,
  };
}

function formatReasonList(items) {
  if (!items.length) return "un profilo statistico piu continuo";
  if (items.length === 1) return items[0].toLowerCase();

  return `${items[0].toLowerCase()} e ${items[1].toLowerCase()}`;
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

function calculateAnalysisPrediction(home, away, fixture, recent) {
  const edge = getAnalysisMatchEdge(home, away, fixture, recent);
  const balance = Math.abs(edge);
  const defensiveControl = ((recent.home.defenseScore + recent.away.defenseScore) - (recent.home.attackScore + recent.away.attackScore)) * 0.0015;
  const draw = clamp(0.31 - balance * 0.0037 + defensiveControl, 0.15, 0.35);
  const homeShare = 1 / (1 + Math.exp(-edge / 12));
  const homeWin = (1 - draw) * homeShare;
  const awayWin = 1 - draw - homeWin;
  const outcomes = {
    home: { sign: "1", label: home.name, probability: homeWin },
    draw: { sign: "X", label: "Equilibrio", probability: draw },
    away: { sign: "2", label: away.name, probability: awayWin },
  };
  const strongestWin = homeWin >= awayWin ? outcomes.home : outcomes.away;
  const closeScenario =
    balance < 3.4 &&
    Math.abs(recent.home.formScore - recent.away.formScore) <= 7 &&
    Math.abs(recent.home.avgGoalsFor - recent.away.avgGoalsFor) <= 0.32 &&
    Math.abs(recent.home.avgGoalsAgainst - recent.away.avgGoalsAgainst) <= 0.32 &&
    draw >= strongestWin.probability - 0.045;
  const primary = closeScenario
    ? outcomes.draw
    : [outcomes.home, outcomes.draw, outcomes.away].reduce((best, outcome) =>
        outcome.probability > best.probability ? outcome : best,
      );
  const pick = primary.label;
  const pickSign = primary.sign;
  const pickIq =
    pickSign === "1" ? "Preview Casa" : pickSign === "2" ? "Preview Trasferta" : "Preview Pareggio";
  const doubleChance =
    pickSign === "1"
      ? `${home.name} o pareggio`
      : pickSign === "2"
        ? `${away.name} o pareggio`
        : `${home.name} o ${away.name}`;
  const stronger = homeWin >= awayWin ? home : away;
  const weaker = homeWin >= awayWin ? away : home;
  const strongerProfile = homeWin >= awayWin ? recent.home : recent.away;
  const weakerProfile = homeWin >= awayWin ? recent.away : recent.home;
  const reason =
    pickSign === "X"
      ? `Il modello legge equilibrio: forma recente, gol fatti/subiti e clean sheet restano vicini tra ${home.name} e ${away.name}.`
      : `${stronger.name} parte avanti per ultime 5 migliori: forma ${Math.round(strongerProfile.formScore)} contro ${Math.round(weakerProfile.formScore)}, gol fatti ${strongerProfile.avgGoalsFor.toFixed(2)} contro ${weakerProfile.avgGoalsFor.toFixed(2)}.`;

  return { homeWin, draw, awayWin, pick, pickSign, pickIq, doubleChance, reason, outcomes, primary, edge };
}

function getAnalysisMatchEdge(home, away, fixture, recent) {
  const formEdge = (recent.home.formScore - recent.away.formScore) * 0.34;
  const attackEdge = (recent.home.avgGoalsFor - recent.away.avgGoalsFor) * 5.8;
  const defensiveEdge = (recent.away.avgGoalsAgainst - recent.home.avgGoalsAgainst) * 4.9;
  const cleanSheetEdge = (recent.home.cleanSheetRate - recent.away.cleanSheetRate) * 5.4;
  const tournamentStateEdge =
    (recent.home.matches >= 2 && recent.home.formScore > home.form + 5 ? 2.2 : 0) -
    (recent.away.matches >= 2 && recent.away.formScore > away.form + 5 ? 2.2 : 0);
  const supportEdge =
    (home.rating - away.rating) * 0.1 +
    (away.rank - home.rank) * 0.035 +
    (Math.min(home.titles, 5) - Math.min(away.titles, 5)) * 0.25;
  const contextEdge = (home.host ? 0.9 : 0) - (away.host ? 0.9 : 0);
  const homeFieldEdge = fixture?.stage === "Group Stage" ? 0.35 : 0;

  return formEdge + attackEdge + defensiveEdge + cleanSheetEdge + tournamentStateEdge + supportEdge + contextEdge + homeFieldEdge;
}

function buildMatchModel(fixture) {
  if (!fixture) return null;

  const home = teamById.get(fixture.home);
  const away = teamById.get(fixture.away);
  if (!home || !away) return null;

  const recent = {
    home: getTeamRecentProfile(home, fixture),
    away: getTeamRecentProfile(away, fixture),
  };
  const prediction = calculateAnalysisPrediction(home, away, fixture, recent);
  const expectedGoals = calculateExpectedGoals(home, away, fixture, recent);
  const probability = prediction.primary.probability;
  const confidence = getAnalysisConfidencePercent(prediction, expectedGoals, recent);
  const modelConfidenceClass =
    confidence >= 70 ? "confidence-high" : confidence >= 44 ? "confidence-low" : "confidence-mid";
  const goalSuggestion = getGoalTrend({ expectedGoals, recent }).label;

  return {
    fixture,
    home,
    away,
    recent,
    prediction,
    expectedGoals,
    probability,
    probabilityPercent: Math.round(probability * 100),
    confidence,
    confidenceClass: modelConfidenceClass,
    goalSuggestion,
  };
}

function getAnalysisConfidencePercent(prediction, expectedGoals, recent) {
  const outcomes = Object.values(prediction.outcomes).sort((a, b) => b.probability - a.probability);
  const secondProbability = outcomes.find((outcome) => outcome.sign !== prediction.primary.sign)?.probability || 0;
  const probabilityGap = Math.max(0, prediction.primary.probability - secondProbability);
  const edgeWeight = Math.abs(prediction.edge || 0);
  const xgGap = Math.abs(expectedGoals.home - expectedGoals.away);
  const formGap = Math.abs(recent.home.formScore - recent.away.formScore);
  const attackGap = Math.abs(recent.home.avgGoalsFor - recent.away.avgGoalsFor);
  const defenseGap = Math.abs(recent.home.avgGoalsAgainst - recent.away.avgGoalsAgainst);

  if (prediction.primary.sign === "X") {
    return clamp(Math.round(24 + prediction.draw * 22 + Math.max(0, 8 - formGap) * 1.2 + Math.max(0, 0.35 - xgGap) * 16), 24, 40);
  }

  const probabilitySignal = probabilityGap * 22;
  const edgeSignal = Math.log1p(edgeWeight) * 2;
  const xgSignal = Math.min(xgGap, 2.4) * 4;
  const recentSignal = formGap * 0.55 + attackGap * 7 + defenseGap * 6;

  return clamp(Math.round(30 + probabilitySignal + edgeSignal + xgSignal + recentSignal), 32, 82);
}

function confidenceClass(probability) {
  if (probability >= 0.67) return "confidence-high";
  if (probability >= 0.56) return "confidence-mid";
  return "confidence-low";
}

function calculateExpectedGoals(home, away, fixture, recent) {
  const paceModifier = getMatchPaceModifier(recent.home, recent.away);
  const homeBase = getTeamExpectedGoalBase(home, away, recent.home, recent.away);
  const awayBase = getTeamExpectedGoalBase(away, home, recent.away, recent.home) * 0.96;

  const homeXg = clamp(homeBase * paceModifier, 0.25, 3.35);
  const awayXg = clamp(awayBase * paceModifier, 0.25, 3.25);
  const hasLiveData = recent.home.source !== "estimated" || recent.away.source !== "estimated";
  const note = hasLiveData
    ? "L'xG include le ultime partite gia giocate prima di questa gara: risultati, gol fatti/subiti e clean sheet aggiornano le successive."
    : "L'xG usa un fallback pre-torneo finche non ci sono ultime 5 reali; appena arrivano risultati API, la lettura viene sostituita dai dati del torneo.";

  return { home: homeXg, away: awayXg, note };
}

function getTeamExpectedGoalBase(team, opponent, teamProfile, opponentProfile) {
  const recentAttack = (teamProfile.avgGoalsFor - 1.15) * 0.42;
  const opponentVulnerability = (opponentProfile.avgGoalsAgainst - 1.1) * 0.36;
  const cleanSheetDrag = opponentProfile.cleanSheetRate * 0.28;
  const formEdge = (teamProfile.formScore - opponentProfile.formScore) * 0.006;
  const supportQuality = (team.attack - opponent.defense) * 0.004 + (team.rating - opponent.rating) * 0.003;
  const contextEdge = team.host ? 0.04 : 0;

  return (
    1.12 +
    recentAttack +
    opponentVulnerability -
    cleanSheetDrag +
    formEdge +
    supportQuality +
    contextEdge
  );
}

function getMatchPaceModifier(homeProfile, awayProfile) {
  const goalTempo = (homeProfile.goalTempo + awayProfile.goalTempo) / 2;
  const offensivePulse = (homeProfile.avgGoalsFor + awayProfile.avgGoalsFor) / 2;
  const defensiveControl = (homeProfile.cleanSheetRate + awayProfile.cleanSheetRate) / 2;

  return clamp(0.94 + (goalTempo - 2.25) * 0.08 + (offensivePulse - 1.2) * 0.08 - defensiveControl * 0.08, 0.84, 1.18);
}

function getTeamTempoModifier(team = {}) {
  const style = String(team.style || "").toLowerCase();
  let modifier = 0;

  if (/pressing|transizioni|ripartenze|velocita|ritmo|attacco|talento|finalizzazione|potenza/.test(style)) {
    modifier += 1;
  }

  if (/blocco|compatto|compattezza|difesa|ordinata|possesso basso|controllo/.test(style)) {
    modifier -= 1;
  }

  if (team.attack >= 82) modifier += 0.5;
  if (team.defense >= 84) modifier -= 0.45;
  if (team.form >= 82) modifier += 0.2;

  return clamp(modifier, -1.4, 1.4);
}

function openMatchDetail(fixtureId) {
  if (!selectors.matchDetailContent) return;

  const fixture = fixtures.find((item) => item.id === fixtureId);
  const model = fixture ? buildMatchModel(fixture) : null;
  if (!model) {
    selectors.matchDetailContent.innerHTML = renderEmptyState("Partita non disponibile", "La partita selezionata non e disponibile in questo momento.");
    showPanel("matchDetail");
    return;
  }

  if (selectors.matchPredictSelect) {
    selectors.matchPredictSelect.value = String(fixture.id);
  }
  selectors.matchDetailContent.innerHTML = renderMatchDetail(model);
  showPanel("matchDetail");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderMatchDetail(model) {
  const { fixture, home, away, prediction, expectedGoals, recent } = model;
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
            <span>Scenario alternativo</span>
            <strong>${prediction.doubleChance}</strong>
          </article>
          <article>
            <span>Confidence Level</span>
            <strong>${model.confidence}%</strong>
          </article>
          <article>
            <span>Tendenza reti</span>
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
        ${renderMatchTeamStats(home, recent.home)}
      </article>
      <article class="detail-block">
        <h3>Statistiche ${away.name}</h3>
        ${renderMatchTeamStats(away, recent.away)}
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

function renderMatchTeamStats(team, profile) {
  return `
    <div class="detail-list">
      <div><span>Fonte forma</span><strong>${escapeHtml(profile.sourceLabel)}</strong></div>
      <div><span>Partite reali lette</span><strong>${profile.matches}/5</strong></div>
      <div><span>Forma ultime 5</span><strong>${Math.round(profile.formScore)}/100</strong></div>
      <div><span>Gol fatti media</span><strong>${profile.avgGoalsFor.toFixed(2)}</strong></div>
      <div><span>Gol subiti media</span><strong>${profile.avgGoalsAgainst.toFixed(2)}</strong></div>
      <div><span>Clean sheet</span><strong>${profile.cleanSheets}</strong></div>
      <div><span>Ranking supporto</span><strong>${team.rank}</strong></div>
    </div>
  `;
}

function openTeamDetail(teamId, options = {}) {
  if (
    !hasElements(
      selectors.teamDetail,
      selectors.teamDetailFlag,
      selectors.teamDetailTitle,
      selectors.teamDetailRating,
      selectors.teamDetailInfo,
      selectors.teamDetailSchedule,
      selectors.teamDetailResults,
      selectors.teamDetailScorer,
      selectors.teamDetailSquad,
    )
  ) {
    return;
  }

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
      <strong>${unavailableText}</strong>
      <p>${player === "Da aggiornare" ? "Miglior marcatore disponibile solo quando API-FOOTBALL restituisce dati ufficiali." : `Profilo da verificare via API-FOOTBALL: ${player}. Non vengono inseriti gol fittizi.`}</p>
    </div>
  `;
}

function openPlayerDetail(playerId, options = {}) {
  if (!ensurePlayerDetailPanel()) return;

  const backTarget = options.backTarget || "home";
  const backLabel = backTarget === "teamDetail" ? "Torna alla squadra" : "Torna a Home";
  const profile = playerProfiles?.[playerId] || null;
  if (!profile) {
    delete selectors.playerDetail.dataset.playerId;
    delete selectors.playerDetail.dataset.squadPlayer;
    delete selectors.playerDetail.dataset.backTeamId;
    playerDetailBackTarget = backTarget;
    selectors.playerDetailBack.textContent = backLabel;
    selectors.playerDetailContent.innerHTML = renderMissingPlayerState();
    showPanel("playerDetail");
    if (options.scroll !== false) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    return;
  }

  releaseFocusedControl();
  playerDetailBackTarget = backTarget;
  selectors.playerDetailBack.textContent = backLabel;
  selectors.playerDetail.dataset.playerId = profile.id;
  selectors.playerDetail.dataset.backTeamId = profile.teamId || "";
  delete selectors.playerDetail.dataset.squadPlayer;
  delete selectors.playerDetail.dataset.squadTeamId;
  selectors.playerDetailContent.innerHTML = renderPlayerProfile(buildApiOnlyPlayerProfile(profile, "Caricamento dati API-FOOTBALL..."));
  if (options.updateRoute !== false) {
    updatePlayerRoute(profile.id, backTarget);
  }
  showPanel("playerDetail");
  hydratePlayerProfileFromApi(profile)
    .then((apiProfile) => {
      if (!apiProfile && selectors.playerDetail?.dataset.playerId === profile.id && selectors.playerDetailContent) {
        selectors.playerDetailContent.innerHTML = renderPlayerProfile(
          buildApiOnlyPlayerProfile(profile, "API-FOOTBALL non ha restituito dati verificabili per questa scheda."),
        );
      }
    })
    .catch(() => {
      if (selectors.playerDetail?.dataset.playerId === profile.id && selectors.playerDetailContent) {
        selectors.playerDetailContent.innerHTML = renderPlayerProfile(
          buildApiOnlyPlayerProfile(profile, "Dati API-FOOTBALL non disponibili al momento."),
        );
      }
    });
  if (options.scroll !== false) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function openSquadPlayerDetail(playerName, teamId, roleGroup, options = {}) {
  if (!ensurePlayerDetailPanel()) return;

  const team = teamById.get(teamId);
  const role = normalizeSquadRole(roleGroup);
  const availableProfile = findPlayerProfileByName(playerName, teamId);
  const fallback = buildSquadPlayerFallback(playerName, team, role);
  const simpleProfile = {
    id: createSquadPlayerKey(teamId, playerName),
    teamId: teamId || availableProfile?.teamId || "",
    fullName: playerName || fallback.name,
    shortName: playerName || fallback.name,
    birthDate: availableProfile?.birthDate || "",
    age: preferProfileValue(availableProfile?.age, fallback.age),
    height: preferProfileValue(availableProfile?.height, fallback.height),
    weight: preferProfileValue(availableProfile?.weight, fallback.weight),
    nationality: team?.name || fallback.nationality,
    club: preferProfileValue(availableProfile?.club, fallback.club),
    role: preferProfileValue(availableProfile?.role, role || fallback.role),
    image: availableProfile?.image || "",
    imageAlt: availableProfile?.imageAlt || playerName || "Calciatore",
    preferredFoot: preferProfileValue(availableProfile?.preferredFoot, fallback.preferredFoot),
    stats: availableProfile ? getWorldCupPlayerStats(availableProfile) : getUnavailablePlayerStats(),
  };

  releaseFocusedControl();
  playerDetailBackTarget = options.backTarget || "teamDetail";
  selectors.playerDetailBack.textContent = playerDetailBackTarget === "home" ? "Torna a Home" : "Torna alla squadra";
  selectors.playerDetail.dataset.squadPlayer = playerName;
  selectors.playerDetail.dataset.squadTeamId = teamId || "";
  selectors.playerDetail.dataset.backTeamId = teamId || "";
  delete selectors.playerDetail.dataset.playerId;
  selectors.playerDetailContent.innerHTML = renderSquadPlayerProfile(buildApiOnlyPlayerProfile(simpleProfile, "Caricamento dati API-FOOTBALL..."));
  if (options.updateRoute !== false) {
    updateSquadPlayerRoute(playerName, teamId, roleGroup, playerDetailBackTarget);
  }
  showPanel("playerDetail");
  hydrateSquadPlayerProfileFromApi(simpleProfile, playerName, teamId)
    .then((loaded) => {
      if (!loaded && selectors.playerDetail?.dataset.squadPlayer === playerName && selectors.playerDetailContent) {
        selectors.playerDetailContent.innerHTML = renderSquadPlayerProfile(
          buildApiOnlyPlayerProfile(simpleProfile, "API-FOOTBALL non ha restituito dati verificabili per questa scheda."),
        );
      }
    })
    .catch(() => {
      if (selectors.playerDetail?.dataset.squadPlayer === playerName && selectors.playerDetailContent) {
        selectors.playerDetailContent.innerHTML = renderSquadPlayerProfile(
          buildApiOnlyPlayerProfile(simpleProfile, "Dati API-FOOTBALL non disponibili al momento."),
        );
      }
    });
  if (options.scroll !== false) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

async function hydrateSquadPlayerProfileFromApi(profile, playerName, teamId) {
  if (!profile?.fullName) return false;
  try {
    await checkApiFootballStatus();
  } catch (error) {
    return false;
  }

  const apiProfile = await resolveApiFootballPlayer(profile);
  if (!apiProfile) return false;

  applyApiFootballPlayerProfile(profile, apiProfile);
  if (selectors.playerDetail?.dataset.squadPlayer === playerName && selectors.playerDetail?.dataset.squadTeamId === (teamId || "")) {
    selectors.playerDetailContent.innerHTML = renderSquadPlayerProfile(profile);
  }
  return true;
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
  return roleGroup || unavailableText;
}

function createSquadPlayerKey(teamId, playerName) {
  return `${teamId || "team"}-${normalizePlayerName(playerName).replace(/\s+/g, "-") || "player"}`;
}

function buildSquadPlayerFallback(playerName, team, role) {
  return {
    name: playerName || unavailableText,
    age: unavailableText,
    height: unavailableText,
    weight: unavailableText,
    nationality: team?.name || unavailableText,
    role: role || unavailableText,
    club: unavailableText,
    preferredFoot: unavailableText,
  };
}

function preferProfileValue(value, fallbackValue) {
  if (value === undefined || value === null || value === "" || value === unavailableText) {
    return fallbackValue ?? unavailableText;
  }

  return value;
}

function buildApiOnlyPlayerProfile(profile = {}, message = "") {
  return {
    id: profile.id,
    teamId: profile.teamId || "",
    fullName: profile.fullName || profile.shortName || profile.name || unavailableText,
    shortName: profile.shortName || profile.fullName || profile.name || unavailableText,
    birthDate: profile.birthDate || "",
    age: profile.age || unavailableText,
    height: profile.height || unavailableText,
    weight: profile.weight || unavailableText,
    nationality: profile.nationality || unavailableText,
    club: profile.club || unavailableText,
    role: profile.role || unavailableText,
    preferredFoot: profile.preferredFoot || unavailableText,
    image: profile.image || "",
    imageAlt: profile.fullName || profile.shortName || profile.name || "Calciatore",
    shirtNumber: profile.shirtNumber || unavailableText,
    apiTotals: getUnavailablePlayerStats(),
    stats: profile.stats || mapApiFootballPlayerTotals({}),
    worldCupStats: profile.worldCupStats || getUnavailablePlayerStats(),
    headline: message,
  };
}

function getWorldCupPlayerStats(profile = {}) {
  const safeProfile = profile || {};
  const stats = safeProfile.worldCupStats || null;
  if (!stats) return getUnavailablePlayerStats();

  return {
    appearances: stats.appearances ?? unavailableText,
    goals: stats.goals ?? unavailableText,
    assists: stats.assists ?? unavailableText,
    minutes: stats.minutes ?? unavailableText,
    yellowCards: stats.yellowCards ?? unavailableText,
    redCards: stats.redCards ?? unavailableText,
  };
}

function getUnavailablePlayerStats() {
  return {
    appearances: unavailableText,
    goals: unavailableText,
    assists: unavailableText,
    minutes: unavailableText,
    yellowCards: unavailableText,
    redCards: unavailableText,
  };
}

function renderPlayerProfile(profile) {
  if (!profile) {
    return renderMissingPlayerState();
  }

  const team = teamById.get(profile.teamId);
  const age = calculateAge(profile.birthDate) || profile.age || unavailableText;
  const nextFixture = team ? getNextTeamFixture(team.id) : null;
  const nextOpponent = nextFixture && team ? getFixtureOpponentName(nextFixture, team.id) : "";
  const nationality = isProfileValueAvailable(profile.nationality) ? profile.nationality : team?.name;
  const nationalityFlag = team ? `<img src="${flagUrl(team.flag)}" alt="" loading="lazy" />` : "";
  const nationalityMarkup = isProfileValueAvailable(nationality)
    ? `<span class="player-profile-nation">${nationalityFlag}${escapeHtml(nationality)}</span>`
    : "";
  const description = profile.description || profile.headline || "";
  const worldCupStats = getWorldCupPlayerStats(profile);
  const shirtNumber = formatProfileValue(profile.shirtNumber);
  const roleClub = [profile.role, profile.club].filter(isProfileValueAvailable).join(" | ");
  const bioItems = renderPlayerBioItems([
    ["Eta", age === unavailableText ? "" : `${age} anni`],
    ["Altezza", profile.height],
    ["Peso", profile.weight],
    ["Nazionalita", nationality],
    ["Club", profile.club],
    ["Ruolo", profile.role],
    ["Piede", profile.preferredFoot],
  ]);
  const statItems = renderPlayerStatList(profile.stats || []);
  const worldCupStatsMarkup = renderWorldCupStatsBlock(worldCupStats);
  const image = profile.image
    ? `<img class="${getPlayerPhotoClass(profile)}" src="${escapeAttribute(profile.image)}" alt="${escapeAttribute(profile.imageAlt || profile.fullName || "Calciatore")}" loading="lazy" decoding="async" />`
    : renderPlayerProfileFallback(profile);

  return `
    <div class="player-profile-card">
      <div class="player-profile-media">
        ${image}
        ${
          shirtNumber === unavailableText
            ? ""
            : `<div class="player-profile-shirt" aria-label="Numero ${escapeAttribute(shirtNumber)}">
                <span>#</span>
                <strong>${escapeHtml(shirtNumber)}</strong>
              </div>`
        }
      </div>
      <div class="player-profile-content">
        <div class="player-profile-topline">
          <span class="outcome-label">Scheda giocatore</span>
          ${nationalityMarkup}
        </div>
        <div class="player-profile-name">
          ${isProfileValueAvailable(profile.shortName) ? `<span>${escapeHtml(profile.shortName)}</span>` : ""}
          <strong id="player-detail-title">${escapeHtml(profile.fullName || profile.shortName || "Calciatore")}</strong>
          ${roleClub ? `<small>${escapeHtml(roleClub)}</small>` : ""}
        </div>
        ${bioItems ? `<div class="player-profile-bio-grid">${bioItems}</div>` : ""}
        ${description ? `<p class="player-profile-headline">${escapeHtml(description)}</p>` : ""}
        ${profile.traits?.length ? `<div class="player-profile-traits">${profile.traits.map((trait) => `<span>${escapeHtml(trait)}</span>`).join("")}</div>` : ""}
        ${statItems ? `<div class="player-profile-stat-grid">${statItems}</div>` : ""}
        ${worldCupStatsMarkup}
        ${renderPlayerUnavailableNote(profile, Boolean(statItems || worldCupStatsMarkup))}
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

  const age = calculateAge(profile.birthDate) || profile.age || unavailableText;
  const stats = profile.apiTotals || profile.stats || getUnavailablePlayerStats();
  const roleClub = [profile.role, profile.club].filter(isProfileValueAvailable).join(" | ");
  const bioItems = renderPlayerBioItems([
    ["Eta", age === unavailableText ? "" : `${age} anni`],
    ["Altezza", profile.height],
    ["Peso", profile.weight],
    ["Nazionalita", profile.nationality],
    ["Club", profile.club],
    ["Ruolo", profile.role],
    ["Piede", profile.preferredFoot],
  ]);
  const worldCupStatsMarkup = renderWorldCupStatsBlock(stats, "Minuti giocati");
  const image = profile.image
    ? `<img class="${getPlayerPhotoClass(profile)}" src="${escapeAttribute(profile.image)}" alt="${escapeAttribute(profile.imageAlt || profile.fullName)}" loading="lazy" decoding="async" />`
    : renderPlayerProfileFallback(profile);

  return `
    <div class="player-profile-card player-profile-simple-card">
      <div class="player-profile-media player-profile-simple-media">
        ${image}
      </div>
      <div class="player-profile-content">
        <div class="player-profile-name">
          ${isProfileValueAvailable(profile.role) ? `<span>${escapeHtml(profile.role)}</span>` : ""}
          <strong id="player-detail-title">${escapeHtml(profile.fullName)}</strong>
          ${roleClub ? `<small>${escapeHtml(roleClub)}</small>` : ""}
        </div>
        ${bioItems ? `<div class="player-profile-bio-grid">${bioItems}</div>` : ""}
        ${worldCupStatsMarkup}
        ${renderPlayerUnavailableNote(profile, Boolean(worldCupStatsMarkup))}
      </div>
    </div>
  `;
}

function renderPlayerProfileFallback(profile = {}) {
  const team = teamById.get(profile.teamId);
  const flag = team?.flag
    ? `<img class="player-profile-fallback-flag" src="${flagUrl(team.flag)}" alt="" loading="lazy" />`
    : `<span class="player-profile-fallback-mark">FIQ</span>`;

  return `
    <div class="player-profile-fallback" aria-label="Foto giocatore non disponibile">
      ${flag}
      <span>Foto non disponibile</span>
    </div>
  `;
}

function getPlayerPhotoClass(profile = {}) {
  const idClass = normalizePlayerName(profile.id || profile.shortName || profile.fullName).replace(/\s+/g, "-");
  return `player-profile-photo${idClass ? ` player-profile-photo-${escapeAttribute(idClass)}` : ""}`;
}

function renderMissingPlayerState() {
  return renderEmptyState(
    "Dati giocatore in aggiornamento",
    "La scheda del giocatore selezionato sara disponibile appena i dati saranno completati.",
  );
}

function renderPlayerBioItems(items = []) {
  return items.map(([label, value]) => renderPlayerBioItem(label, value)).filter(Boolean).join("");
}

function renderPlayerBioItem(label, value) {
  if (!isProfileValueAvailable(value)) return "";

  const formattedValue = formatProfileValue(value);
  return `
    <div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(formattedValue)}</strong>
    </div>
  `;
}

function renderWorldCupStatsBlock(stats = {}, minutesLabel = "Minuti") {
  const rows = [
    ["Presenze", stats.appearances],
    ["Gol", stats.goals],
    ["Assist", stats.assists],
    [minutesLabel, stats.minutes],
    ["Gialli", stats.yellowCards],
    ["Rossi", stats.redCards],
  ]
    .map(([label, value]) => renderWorldCupPlayerStat(label, value))
    .filter(Boolean)
    .join("");

  return rows ? `<div class="world-cup-player-stats" aria-label="Statistiche personali Mondiale">${rows}</div>` : "";
}

function renderWorldCupPlayerStat(label, value) {
  if (!isProfileValueAvailable(value)) return "";

  const formattedValue = formatProfileValue(value);
  return `
    <div class="player-stat-item world-cup-stat-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(formattedValue)}</strong>
    </div>
  `;
}

function renderPlayerStatList(stats = []) {
  return stats.map(renderPlayerStat).filter(Boolean).join("");
}

function renderPlayerStat(stat) {
  if (!stat) return "";
  if (!isProfileValueAvailable(stat.value)) return "";

  const meter = Number.isFinite(Number(stat.meter)) ? clamp(Number(stat.meter), 0, 100) : null;
  const formattedValue = formatProfileValue(stat.value);
  return `
    <div class="player-stat-item">
      <span>${escapeHtml(stat.label || "Dato")}</span>
      <strong>${escapeHtml(formattedValue)}</strong>
      ${meter === null ? "" : `<div class="meter-track"><span style="width: ${meter}%"></span></div>`}
    </div>
  `;
}

function renderPlayerUnavailableNote(profile = {}, hasData = false) {
  const coreValues = [
    profile.birthDate || profile.age,
    profile.height,
    profile.weight,
    profile.nationality,
    profile.club,
    profile.role,
    profile.preferredFoot,
  ];
  const hasMissingCore = coreValues.some((value) => !isProfileValueAvailable(value));
  if (!hasMissingCore && hasData) return "";

  return `<p class="player-profile-note">Informazione non disponibile per i campi non mostrati.</p>`;
}

function isProfileValueAvailable(value) {
  if (value === null || value === undefined) return false;
  const text = String(value).trim();
  return Boolean(text) && text !== unavailableText && text !== "Informazione non disponibile";
}

function formatProfileValue(value) {
  return value === null || value === undefined || value === "" ? unavailableText : String(value);
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
    status.style.display = "block";
  }
}
