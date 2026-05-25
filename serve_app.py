from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen
import json
import os
import sys
import time
from datetime import datetime


ROOT = Path(__file__).resolve().parent
HOST = "0.0.0.0"
PORT = int(os.environ.get("PORT", "4173"))
API_FOOTBALL_BASE_URL = "https://v3.football.api-sports.io"
API_FOOTBALL_ALLOWED_ENDPOINTS = {
    "fixtures",
    "fixtures/events",
    "fixtures/statistics",
    "fixtures/lineups",
    "fixtures/players",
    "injuries",
    "leagues",
    "players",
    "players/topscorers",
    "players/profiles",
    "players/seasons",
    "players/squads",
    "standings",
    "teams",
    "teams/statistics",
}
API_FOOTBALL_CACHE = {}
LIVE_CENTER_DETAIL_LIMIT = 4
WORLD_CUP_SEASON = os.environ.get("FOOTBALLIQ_WORLD_CUP_SEASON", "2026")
DEFAULT_WORLD_CUP_LEAGUE_ID = os.environ.get("FOOTBALLIQ_WORLD_CUP_LEAGUE_ID", "1")
WORLD_CUP_LEAGUE_ID_CACHE = {"value": DEFAULT_WORLD_CUP_LEAGUE_ID}
WORLD_CUP_LIVE_STATUS = "1H-HT-2H-ET-P-BT-LIVE"
WORLD_CUP_GENERAL_TTL = 600
WORLD_CUP_LIVE_TTL = 45
WORLD_CUP_DETAIL_TTL = 45
WORLD_CUP_STATIC_TTL = 1800
WORLD_CUP_FALLBACK_MESSAGES = {
    "live": "Dati live Mondiali non disponibili al momento",
    "standings": "Classifica in aggiornamento",
    "top_scorers": "Capocannonieri disponibili dopo l'inizio del torneo",
    "detail": "Dettaglio partita live non disponibile al momento",
    "statistics": "Statistiche partita in aggiornamento",
    "events": "Eventi partita in aggiornamento",
    "lineups": "Formazioni in aggiornamento",
    "generic": "Dati Mondiali non disponibili al momento",
}


class ApiFootballError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


def read_env_value(name):
    value = os.environ.get(name)
    if value:
        return value.strip().strip('"').strip("'")

    env_path = ROOT / ".env"
    if not env_path.exists():
        return ""

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, raw_value = line.split("=", 1)
        if key.strip() == name:
            return raw_value.strip().strip('"').strip("'")

    return ""


API_FOOTBALL_KEY = read_env_value("API_FOOTBALL_KEY") or read_env_value("VITE_API_FOOTBALL_KEY")


def json_response(handler, payload, status=200):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def normalize_query(query):
    parsed = parse_qs(query, keep_blank_values=False)
    safe = {}
    for key, values in parsed.items():
        if key.lower() in {"key", "api_key", "apikey", "x-apisports-key", "x-rapidapi-key"}:
            continue
        if not key.replace("_", "").replace("-", "").isalnum():
            continue
        safe[key] = [str(value)[:180] for value in values if str(value).strip()]
    return safe


def cache_ttl_for(endpoint, params):
    if endpoint == "fixtures" and ("live" in params or "date" in params):
        return 20
    if endpoint.startswith("fixtures/"):
        return 30
    if endpoint in {"injuries", "standings", "teams/statistics"}:
        return 180
    if endpoint in {"players", "players/profiles", "players/seasons", "players/squads", "teams", "leagues"}:
        return 3600
    return 300


def api_payload_error(payload):
    errors = payload.get("errors") if isinstance(payload, dict) else None
    if not errors:
        return None

    message = str(errors)
    lowered = message.lower()
    if "request limit" in lowered or "too many requests" in lowered:
        return ApiFootballError(429, message)
    if "free plans" in lowered or "plan" in lowered or "access" in lowered:
        return ApiFootballError(403, message)
    return ApiFootballError(502, message)


def api_football_request(endpoint, params=None, ttl=None):
    if endpoint not in API_FOOTBALL_ALLOWED_ENDPOINTS:
        raise ApiFootballError(404, "Endpoint API-FOOTBALL non consentito.")
    if not API_FOOTBALL_KEY:
        raise ApiFootballError(503, "API-FOOTBALL non configurata.")

    params = params or {}
    ttl = cache_ttl_for(endpoint, params) if ttl is None else ttl
    cache_key = json.dumps([endpoint, sorted((key, tuple(values)) for key, values in params.items())], sort_keys=True)
    cached = API_FOOTBALL_CACHE.get(cache_key)
    now = time.time()
    if cached and cached["expires_at"] > now:
        if cached["payload"].get("rateLimited"):
            raise ApiFootballError(429, str(cached["payload"].get("errors") or "Limite API-FOOTBALL raggiunto."))
        return cached["payload"]

    query = urlencode(params, doseq=True)
    url = f"{API_FOOTBALL_BASE_URL}/{endpoint}{'?' + query if query else ''}"
    request = Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "FootballIQ-local-proxy/1.0",
            "x-apisports-key": API_FOOTBALL_KEY,
        },
    )

    try:
        with urlopen(request, timeout=12) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        try:
            payload = json.loads(exc.read().decode("utf-8"))
            message = payload.get("message") or payload.get("errors") or "Errore API-FOOTBALL."
        except Exception:
            message = "Errore API-FOOTBALL."
        if exc.code == 429:
            API_FOOTBALL_CACHE[cache_key] = {
                "expires_at": now + 45,
                "payload": {"response": [], "errors": message, "rateLimited": True},
            }
        raise ApiFootballError(exc.code, str(message))
    except (URLError, TimeoutError) as exc:
        raise ApiFootballError(502, f"API-FOOTBALL non raggiungibile: {exc.reason if hasattr(exc, 'reason') else exc}")

    payload_error = api_payload_error(payload)
    if payload_error:
        if payload_error.status == 429:
            API_FOOTBALL_CACHE[cache_key] = {
                "expires_at": now + 45,
                "payload": {"response": [], "errors": payload_error.message, "rateLimited": True},
            }
        raise payload_error

    API_FOOTBALL_CACHE[cache_key] = {"expires_at": now + ttl, "payload": payload}
    return payload


def single_param(params, *names):
    for name in names:
        values = params.get(name)
        if values:
            return str(values[0]).strip()
    return ""


def normalize_text(value):
    return "".join(ch.lower() if ch.isalnum() else " " for ch in str(value or "")).strip()


def compact_spaces(value):
    return " ".join(str(value or "").split())


def resolve_world_cup_league_id():
    cached = WORLD_CUP_LEAGUE_ID_CACHE.get("value")
    if cached:
        return cached

    try:
        payload = api_football_request(
            "leagues",
            {"search": ["World Cup"], "season": [WORLD_CUP_SEASON]},
            ttl=86400,
        )
        for row in payload.get("response") or []:
            league = row.get("league") or {}
            seasons = row.get("seasons") or []
            league_name = normalize_text(league.get("name"))
            has_season = any(str(season.get("year")) == WORLD_CUP_SEASON for season in seasons if isinstance(season, dict))
            if "world cup" in league_name and has_season and league.get("id"):
                WORLD_CUP_LEAGUE_ID_CACHE["value"] = str(league.get("id"))
                return WORLD_CUP_LEAGUE_ID_CACHE["value"]
    except ApiFootballError:
        pass

    WORLD_CUP_LEAGUE_ID_CACHE["value"] = DEFAULT_WORLD_CUP_LEAGUE_ID
    return WORLD_CUP_LEAGUE_ID_CACHE["value"]


def world_cup_fixture_params(extra=None):
    params = {
        "league": [resolve_world_cup_league_id()],
        "season": [WORLD_CUP_SEASON],
    }
    params.update(extra or {})
    return params


def utc_now_iso():
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


def clean_api_message(scope="generic"):
    return WORLD_CUP_FALLBACK_MESSAGES.get(scope, WORLD_CUP_FALLBACK_MESSAGES["generic"])


def world_cup_success_payload(scope, data=None, message="", **extra):
    return {
        "ok": True,
        "configured": bool(API_FOOTBALL_KEY),
        "scope": scope,
        "league": int(resolve_world_cup_league_id()) if str(resolve_world_cup_league_id()).isdigit() else resolve_world_cup_league_id(),
        "season": int(WORLD_CUP_SEASON) if str(WORLD_CUP_SEASON).isdigit() else WORLD_CUP_SEASON,
        "generatedAt": utc_now_iso(),
        "message": message,
        **(data or {}),
        **extra,
    }


def world_cup_error_payload(scope, exc=None, data=None, status=None):
    payload = world_cup_success_payload(scope, data or {}, message=clean_api_message(scope))
    payload["ok"] = False
    payload["configured"] = bool(API_FOOTBALL_KEY)
    if exc:
        payload["upstreamStatus"] = getattr(exc, "status", status or 502)
    return payload


def fixture_id_from_query(query):
    params = normalize_query(query)
    fixture_id = single_param(params, "fixture", "id", "fixtureId")
    return fixture_id if fixture_id.isdigit() else ""


def is_world_cup_league(league):
    league = league or {}
    league_name = normalize_text(league.get("name"))
    league_id = str(league.get("id") or "")
    league_season = str(league.get("season") or league.get("year") or "")
    cup_ids = {str(DEFAULT_WORLD_CUP_LEAGUE_ID or ""), str(resolve_world_cup_league_id() or "")}
    return ("world cup" in league_name or league_id in cup_ids) and league_season == WORLD_CUP_SEASON


def is_world_cup_2026_fixture(item):
    return is_world_cup_league(item.get("league") or {})


def filter_world_cup_fixtures(rows):
    return [item for item in rows or [] if is_world_cup_2026_fixture(item)]


def fixture_belongs_to_world_cup(fixture_id):
    if not fixture_id:
        return False
    payload = api_football_request("fixtures", {"id": [str(fixture_id)]}, ttl=WORLD_CUP_STATIC_TTL)
    return any(is_world_cup_2026_fixture(item) for item in payload.get("response") or [])


def require_world_cup_fixture(fixture_id):
    if not fixture_id:
        raise ApiFootballError(400, "Fixture Mondiali mancante.")
    if not fixture_belongs_to_world_cup(fixture_id):
        raise ApiFootballError(404, "Fixture non appartenente ai Mondiali 2026.")
    return str(fixture_id)


def sanitize_world_cup_proxy_params(endpoint, params):
    params = {key: list(values) for key, values in (params or {}).items()}

    if endpoint == "leagues":
        return {"id": [resolve_world_cup_league_id()], "season": [WORLD_CUP_SEASON]}

    if endpoint in {"fixtures", "teams", "standings", "players", "players/topscorers", "injuries", "teams/statistics"}:
        sanitized = {key: values for key, values in params.items() if key not in {"league", "season"}}
        sanitized.update({"league": [resolve_world_cup_league_id()], "season": [WORLD_CUP_SEASON]})
        return sanitized

    if endpoint in {"fixtures/events", "fixtures/statistics", "fixtures/lineups", "fixtures/players"}:
        fixture_id = single_param(params, "fixture", "id", "fixtureId")
        require_world_cup_fixture(fixture_id)
        return {"fixture": [fixture_id]}

    return params


def sanitize_world_cup_proxy_payload(endpoint, payload):
    if endpoint == "fixtures":
        payload = dict(payload)
        payload["response"] = filter_world_cup_fixtures(payload.get("response") or [])
        payload["results"] = len(payload["response"])
        return payload

    if endpoint in {"standings", "players/topscorers", "teams", "players", "injuries", "teams/statistics"}:
        payload = dict(payload)
        response = []
        for item in payload.get("response") or []:
            league = item.get("league") if isinstance(item, dict) else None
            if not league or is_world_cup_league(league):
                response.append(item)
        payload["response"] = response
        payload["results"] = len(response)
        return payload

    return payload


def season_candidates():
    now = datetime.utcnow()
    current = now.year if now.month >= 7 else now.year - 1
    candidates = [current, current - 1, current - 2, 2024, 2023, 2022]
    return list(dict.fromkeys(candidates))


def requested_or_candidate_seasons(requested_season):
    candidates = season_candidates()
    if str(requested_season).isdigit():
        requested = int(requested_season)
        return list(dict.fromkeys([requested, *candidates]))
    return candidates


def player_search_terms(name):
    clean = compact_spaces(name)
    tokens = [token for token in clean.split(" ") if len(token) >= 3]
    terms = []

    def add(term):
        term = compact_spaces(term)
        if len(normalize_text(term)) < 3:
            return
        if normalize_text(term) not in {normalize_text(item) for item in terms}:
            terms.append(term)

    if tokens:
        add(tokens[-1])
        if len(tokens) > 1:
            add(" ".join(tokens[-2:]))
            add(" ".join(tokens[1:]))
    add(clean)
    return terms[:5]


def player_names(player):
    return [
        compact_spaces(player.get("name")),
        compact_spaces(" ".join(part for part in [player.get("firstname"), player.get("lastname")] if part)),
        compact_spaces(player.get("lastname")),
    ]


def pick_player_candidate(rows, expected_name="", expected_nationality=""):
    expected_names = [normalize_text(expected_name)]
    expected_tokens = set(normalize_text(expected_name).split())
    expected_nation = normalize_text(expected_nationality)

    best = None
    best_score = -1
    for row in rows or []:
        player = row.get("player") if isinstance(row, dict) else None
        if not player:
            continue

        names = [name for name in player_names(player) if name]
        normalized_names = [normalize_text(name) for name in names if name]
        nation = normalize_text(player.get("nationality") or (player.get("birth") or {}).get("country"))
        nation_score = 18 if expected_nation and nation and nation == expected_nation else 0

        score = nation_score
        for normalized_name in normalized_names:
            if normalized_name in expected_names:
                score = max(score, 100 + nation_score)
            elif expected_names[0] and (normalized_name in expected_names[0] or expected_names[0] in normalized_name):
                score = max(score, 75 + nation_score)
            else:
                overlap = len(expected_tokens.intersection(normalized_name.split()))
                score = max(score, overlap * 18 + nation_score)

        if expected_nation and nation and nation != expected_nation:
            score -= 20

        if score > best_score:
            best = row
            best_score = score

    return best if best_score >= 18 else None


def read_api_number(*values):
    for value in values:
        if value is None or value == "":
            continue
        try:
            return float(value)
        except (TypeError, ValueError):
            continue
    return None


def add_stat_total(acc, key, value):
    if value is None:
        return
    acc["totals"][key] += value
    acc["available"][key] = True


def format_stat_value(acc, key):
    if not acc["available"][key]:
        return None
    value = acc["totals"][key]
    return int(value) if float(value).is_integer() else round(value, 2)


def summarize_player_statistics(statistics):
    acc = {
        "totals": {"appearances": 0, "goals": 0, "assists": 0, "minutes": 0, "yellowCards": 0, "redCards": 0},
        "available": {key: False for key in ("appearances", "goals", "assists", "minutes", "yellowCards", "redCards")},
    }

    current_row = None
    for row in statistics or []:
        games = row.get("games") or {}
        goals = row.get("goals") or {}
        cards = row.get("cards") or {}
        appearances = read_api_number(games.get("appearences"), games.get("appearances"))
        add_stat_total(acc, "appearances", appearances)
        add_stat_total(acc, "goals", read_api_number(goals.get("total")))
        add_stat_total(acc, "assists", read_api_number(goals.get("assists")))
        add_stat_total(acc, "minutes", read_api_number(games.get("minutes")))
        add_stat_total(acc, "yellowCards", read_api_number(cards.get("yellow")))
        add_stat_total(acc, "redCards", read_api_number(cards.get("red")))
        if not current_row and row.get("team"):
            current_row = row
        if appearances and row.get("team"):
            current_row = row

    return {
        "current": current_row or {},
        "totals": {key: format_stat_value(acc, key) for key in acc["totals"]},
    }


def latest_squad_team(squad_payload):
    best_team = None
    best_season = -1
    for row in squad_payload.get("response") or []:
        for team_info in row.get("teams") or []:
            seasons = team_info.get("seasons") or []
            latest = max([int(season) for season in seasons if str(season).isdigit()] or [-1])
            if latest > best_season and team_info.get("team"):
                best_season = latest
                best_team = team_info.get("team")
    return best_team


def player_photo_url(player):
    if player.get("photo"):
        return player.get("photo")
    player_id = player.get("id")
    return f"https://media.api-sports.io/football/players/{player_id}.png" if player_id else ""


def handle_api_football_player_profile(handler, query):
    params = normalize_query(query)
    name = single_param(params, "name", "search", "playerName")
    expected_nationality = single_param(params, "nationality", "country")
    requested_season = single_param(params, "season")
    if not name:
        json_response(handler, {"ok": False, "found": False, "message": "Nome giocatore mancante."})
        return

    try:
        candidate = None
        last_recoverable_error = None
        for term in player_search_terms(name):
            profile_payload = api_football_request("players/profiles", {"search": [term]}, ttl=86400)
            candidate = pick_player_candidate(profile_payload.get("response") or [], name, expected_nationality)
            if candidate:
                break

        if not candidate:
            for season in requested_or_candidate_seasons(requested_season):
                for term in player_search_terms(name):
                    try:
                        rows = api_football_request("players", {"search": [term], "season": [str(season)]}, ttl=3600)
                    except ApiFootballError as exc:
                        if exc.status == 403:
                            last_recoverable_error = exc
                            continue
                        raise
                    candidate = pick_player_candidate(rows.get("response") or [], name, expected_nationality)
                    if candidate:
                        break
                if candidate:
                    break

        if not candidate:
            json_response(
                handler,
                {
                    "ok": True,
                    "found": False,
                    "message": "API-FOOTBALL non ha restituito un profilo verificabile per questo giocatore.",
                },
            )
            return

        player = candidate.get("player") or {}
        player_id = player.get("id")
        statistics = candidate.get("statistics") or []
        statistics_season = None
        if player_id and not statistics:
            for season in requested_or_candidate_seasons(requested_season):
                try:
                    rows = api_football_request("players", {"id": [str(player_id)], "season": [str(season)]}, ttl=3600)
                except ApiFootballError as exc:
                    if exc.status == 403:
                        last_recoverable_error = exc
                        continue
                    raise
                response = rows.get("response") or []
                if response:
                    statistics = response[0].get("statistics") or []
                    statistics_season = season
                    if statistics:
                        break

        squad_team = None
        if player_id:
            try:
                squad_team = latest_squad_team(api_football_request("players/squads", {"player": [str(player_id)]}, ttl=86400))
            except ApiFootballError:
                squad_team = None

        stats_summary = summarize_player_statistics(statistics)
        current_stats = stats_summary["current"] or {}
        current_team = (current_stats.get("team") or {}) if current_stats else {}
        team = current_team if current_team.get("name") else (squad_team or {})
        role = player.get("position") or ((current_stats.get("games") or {}).get("position") if current_stats else "")
        full_name = compact_spaces(" ".join(part for part in [player.get("firstname"), player.get("lastname")] if part)) or player.get("name")

        injuries = []
        if player_id:
            try:
                injuries = api_football_request("injuries", {"player": [str(player_id)]}, ttl=900).get("response") or []
            except ApiFootballError:
                injuries = []

        json_response(
            handler,
            {
                "ok": True,
                "found": True,
                "generatedAt": datetime.utcnow().isoformat(timespec="seconds") + "Z",
                "source": "API-FOOTBALL",
                "player": {
                    "id": player_id,
                    "name": player.get("name"),
                    "fullName": full_name,
                    "age": player.get("age"),
                    "birthDate": (player.get("birth") or {}).get("date"),
                    "birthCountry": (player.get("birth") or {}).get("country"),
                    "nationality": player.get("nationality") or (player.get("birth") or {}).get("country"),
                    "height": player.get("height"),
                    "weight": player.get("weight"),
                    "role": role,
                    "preferredFoot": None,
                    "photo": player_photo_url(player),
                    "club": team.get("name"),
                    "clubLogo": team.get("logo"),
                    "shirtNumber": player.get("number"),
                },
                "statistics": {
                    "season": statistics_season,
                    "totals": stats_summary["totals"],
                    "rows": statistics,
                },
                "injuries": injuries,
            },
        )
    except ApiFootballError as exc:
        json_response(
            handler,
            {
                "ok": False,
                "found": False,
                "message": exc.message,
                "upstreamStatus": exc.status,
            },
        )


def fixture_news_item(item, priority=1):
    fixture = item.get("fixture") or {}
    teams = item.get("teams") or {}
    goals = item.get("goals") or {}
    league = item.get("league") or {}
    status = fixture.get("status") or {}
    home = teams.get("home") or {}
    away = teams.get("away") or {}
    elapsed = status.get("elapsed")
    score = ""
    if goals.get("home") is not None and goals.get("away") is not None:
        score = f" {goals.get('home')}-{goals.get('away')}"
    live_label = f"{elapsed}'" if elapsed else (status.get("short") or status.get("long") or "Live")
    title = f"{home.get('name', 'Squadra')} - {away.get('name', 'Squadra')}{score}"
    return {
        "id": f"fixture-{fixture.get('id')}",
        "date": (fixture.get("date") or datetime.utcnow().isoformat())[:10],
        "priority": priority,
        "badge": live_label,
        "publishedAgo": "aggiornato ora",
        "tag": "Mondiali 2026",
        "title": title,
        "summary": f"Evento FIFA World Cup 2026. Stato partita: {status.get('long') or status.get('short') or 'dato non disponibile'}.",
        "image": home.get("logo") or away.get("logo") or "",
        "imageAlt": home.get("name") or away.get("name") or "Logo squadra",
        "source": "API-FOOTBALL",
        "url": "",
    }


def handle_api_football_news(handler, query):
    params = normalize_query(query)
    today = single_param(params, "date") or datetime.utcnow().strftime("%Y-%m-%d")
    items = []
    try:
        live = api_football_request(
            "fixtures",
            world_cup_fixture_params({"status": [WORLD_CUP_LIVE_STATUS]}),
            ttl=WORLD_CUP_LIVE_TTL,
        ).get("response") or []
        live = [item for item in live if is_world_cup_2026_fixture(item)]
        items.extend(fixture_news_item(item, priority=5) for item in live[:3])

        if len(items) < 3:
            today_fixtures = api_football_request("fixtures", world_cup_fixture_params({"date": [today]}), ttl=300).get("response") or []
            today_fixtures = [item for item in today_fixtures if is_world_cup_2026_fixture(item)]
            items.extend(fixture_news_item(item, priority=3) for item in today_fixtures[: 3 - len(items)])

        if len(items) < 3:
            next_fixtures = api_football_request(
                "fixtures",
                world_cup_fixture_params({"next": [str(3 - len(items))]}),
                ttl=600,
            ).get("response") or []
            next_fixtures = [item for item in next_fixtures if is_world_cup_2026_fixture(item)]
            items.extend(fixture_news_item(item, priority=1) for item in next_fixtures)

        json_response(
            handler,
            {
                "ok": True,
                "generatedAt": datetime.utcnow().isoformat(timespec="seconds") + "Z",
                "items": items[:5],
                "message": "" if items else "Dati live Mondiali non disponibili al momento",
            },
        )
    except ApiFootballError as exc:
        json_response(
            handler,
            {
                "ok": False,
                "generatedAt": datetime.utcnow().isoformat(timespec="seconds") + "Z",
                "items": [],
                "message": "Dati live Mondiali non disponibili al momento",
                "upstreamStatus": exc.status,
            },
        )


def enrich_world_cup_fixture(item, include_detail=True):
    fixture_id = item.get("fixture", {}).get("id")
    detail = {"fixture": item, "events": [], "statistics": [], "lineups": [], "players": [], "injuries": []}
    if not include_detail or not fixture_id:
        return detail

    for endpoint, key in (
        ("fixtures/events", "events"),
        ("fixtures/statistics", "statistics"),
        ("fixtures/lineups", "lineups"),
        ("fixtures/players", "players"),
        ("injuries", "injuries"),
    ):
        params = {"fixture": [str(fixture_id)]}
        if endpoint == "injuries":
            params = world_cup_fixture_params({"fixture": [str(fixture_id)]})
        try:
            payload = api_football_request(endpoint, params, ttl=WORLD_CUP_DETAIL_TTL)
            detail[key] = payload.get("response") or []
        except ApiFootballError:
            detail[key] = []
    return detail


def handle_api_football_world_cup_live(handler, query):
    try:
        fixture_params = world_cup_fixture_params({"status": [WORLD_CUP_LIVE_STATUS]})
        fixtures_payload = api_football_request("fixtures", fixture_params, ttl=WORLD_CUP_LIVE_TTL)
        fixtures = filter_world_cup_fixtures(fixtures_payload.get("response") or [])
        enriched = [
            enrich_world_cup_fixture(item, include_detail=index < LIVE_CENTER_DETAIL_LIMIT)
            for index, item in enumerate(fixtures[:12])
        ]
        json_response(
            handler,
            world_cup_success_payload(
                "live",
                {"fixtures": enriched, "detailLimit": LIVE_CENTER_DETAIL_LIMIT},
                message="" if enriched else clean_api_message("live"),
            ),
        )
    except ApiFootballError as exc:
        json_response(handler, world_cup_error_payload("live", exc, {"fixtures": []}))


def handle_api_football_world_cup_fixture_detail(handler, query):
    fixture_id = fixture_id_from_query(query)
    try:
        require_world_cup_fixture(fixture_id)
        fixture_payload = api_football_request("fixtures", {"id": [fixture_id]}, ttl=WORLD_CUP_DETAIL_TTL)
        fixtures = filter_world_cup_fixtures(fixture_payload.get("response") or [])
        detail = enrich_world_cup_fixture(fixtures[0], include_detail=True) if fixtures else None
        json_response(
            handler,
            world_cup_success_payload(
                "detail",
                {"fixture": detail},
                message="" if detail else clean_api_message("detail"),
            ),
        )
    except ApiFootballError as exc:
        json_response(handler, world_cup_error_payload("detail", exc, {"fixture": None}))


def handle_api_football_world_cup_fixture_collection(handler, query, endpoint, scope, key):
    fixture_id = fixture_id_from_query(query)
    try:
        require_world_cup_fixture(fixture_id)
        payload = api_football_request(endpoint, {"fixture": [fixture_id]}, ttl=WORLD_CUP_DETAIL_TTL)
        rows = payload.get("response") or []
        json_response(
            handler,
            world_cup_success_payload(scope, {key: rows}, message="" if rows else clean_api_message(scope)),
        )
    except ApiFootballError as exc:
        json_response(handler, world_cup_error_payload(scope, exc, {key: []}))


def handle_api_football_world_cup_standings(handler, query):
    try:
        payload = api_football_request("standings", world_cup_fixture_params(), ttl=WORLD_CUP_GENERAL_TTL)
        rows = [item for item in payload.get("response") or [] if is_world_cup_league(item.get("league") or {})]
        json_response(
            handler,
            world_cup_success_payload("standings", {"standings": rows}, message="" if rows else clean_api_message("standings")),
        )
    except ApiFootballError as exc:
        json_response(handler, world_cup_error_payload("standings", exc, {"standings": []}))


def handle_api_football_world_cup_top_scorers(handler, query):
    try:
        payload = api_football_request("players/topscorers", world_cup_fixture_params(), ttl=WORLD_CUP_GENERAL_TTL)
        rows = payload.get("response") or []
        json_response(
            handler,
            world_cup_success_payload(
                "top_scorers",
                {"scorers": rows},
                message="" if rows else clean_api_message("top_scorers"),
            ),
        )
    except ApiFootballError as exc:
        json_response(handler, world_cup_error_payload("top_scorers", exc, {"scorers": []}))


def handle_api_football_world_cup_bootstrap(handler, query):
    data = {"teams": [], "fixtures": [], "standings": [], "topScorers": []}
    messages = {}

    calls = (
        ("teams", "teams", world_cup_fixture_params(), WORLD_CUP_STATIC_TTL, "generic"),
        ("fixtures", "fixtures", world_cup_fixture_params(), WORLD_CUP_STATIC_TTL, "generic"),
        ("standings", "standings", world_cup_fixture_params(), WORLD_CUP_GENERAL_TTL, "standings"),
        ("players/topscorers", "topScorers", world_cup_fixture_params(), WORLD_CUP_GENERAL_TTL, "top_scorers"),
    )

    for endpoint, key, params, ttl, scope in calls:
        try:
            payload = api_football_request(endpoint, params, ttl=ttl)
            rows = payload.get("response") or []
            if endpoint == "fixtures":
                rows = filter_world_cup_fixtures(rows)
            if endpoint == "standings":
                rows = [item for item in rows if is_world_cup_league(item.get("league") or {})]
            data[key] = rows
            if not rows:
                messages[key] = clean_api_message(scope)
        except ApiFootballError:
            data[key] = []
            messages[key] = clean_api_message(scope)

    json_response(
        handler,
        world_cup_success_payload(
            "bootstrap",
            data,
            messages=messages,
            message="" if any(data.values()) else clean_api_message("generic"),
        ),
    )


def handle_api_football_live_center(handler, query):
    params = normalize_query(query)
    fixture_params = world_cup_fixture_params({"status": [WORLD_CUP_LIVE_STATUS]})
    if "date" in params:
        fixture_params = world_cup_fixture_params({"date": params["date"][:1]})

    try:
        fixtures_payload = api_football_request("fixtures", fixture_params, ttl=WORLD_CUP_LIVE_TTL)
        fixtures = [item for item in fixtures_payload.get("response") or [] if is_world_cup_2026_fixture(item)]
        enriched = []
        errors = []
        for index, item in enumerate(fixtures[:12]):
            fixture_id = item.get("fixture", {}).get("id")
            detail = {"fixture": item, "events": [], "statistics": [], "lineups": [], "players": [], "injuries": []}
            if fixture_id and index < LIVE_CENTER_DETAIL_LIMIT:
                for endpoint, key in (
                    ("fixtures/events", "events"),
                    ("fixtures/statistics", "statistics"),
                    ("fixtures/lineups", "lineups"),
                    ("fixtures/players", "players"),
                    ("injuries", "injuries"),
                ):
                    try:
                        detail_params = {"fixture": [str(fixture_id)]}
                        if endpoint == "injuries":
                            detail_params = world_cup_fixture_params({"fixture": [str(fixture_id)]})
                        payload = api_football_request(endpoint, detail_params, ttl=WORLD_CUP_DETAIL_TTL)
                        detail[key] = payload.get("response") or []
                    except ApiFootballError as exc:
                        errors.append({"fixture": fixture_id, "endpoint": endpoint, "status": exc.status, "message": exc.message})
            enriched.append(detail)

        json_response(
            handler,
            {
                "ok": True,
                "configured": True,
                "generatedAt": datetime.utcnow().isoformat(timespec="seconds") + "Z",
                "fixtures": enriched,
                "errors": errors,
                "detailLimit": LIVE_CENTER_DETAIL_LIMIT,
                "message": clean_api_message("live") if not enriched else "",
            },
        )
    except ApiFootballError as exc:
        json_response(
            handler,
            {"ok": False, "configured": bool(API_FOOTBALL_KEY), "message": clean_api_message("live"), "fixtures": []},
        )


class QuietHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api-football/status":
            json_response(
                self,
                {
                    "ok": bool(API_FOOTBALL_KEY),
                    "configured": bool(API_FOOTBALL_KEY),
                    "baseUrl": API_FOOTBALL_BASE_URL,
                },
            )
            return

        if parsed.path == "/api-football/live-center":
            handle_api_football_live_center(self, parsed.query)
            return

        if parsed.path == "/api-football/world-cup/live":
            handle_api_football_world_cup_live(self, parsed.query)
            return

        if parsed.path == "/api-football/world-cup/bootstrap":
            handle_api_football_world_cup_bootstrap(self, parsed.query)
            return

        if parsed.path == "/api-football/world-cup/fixture":
            handle_api_football_world_cup_fixture_detail(self, parsed.query)
            return

        if parsed.path == "/api-football/world-cup/events":
            handle_api_football_world_cup_fixture_collection(
                self,
                parsed.query,
                "fixtures/events",
                "events",
                "events",
            )
            return

        if parsed.path == "/api-football/world-cup/statistics":
            handle_api_football_world_cup_fixture_collection(
                self,
                parsed.query,
                "fixtures/statistics",
                "statistics",
                "statistics",
            )
            return

        if parsed.path == "/api-football/world-cup/lineups":
            handle_api_football_world_cup_fixture_collection(
                self,
                parsed.query,
                "fixtures/lineups",
                "lineups",
                "lineups",
            )
            return

        if parsed.path == "/api-football/world-cup/standings":
            handle_api_football_world_cup_standings(self, parsed.query)
            return

        if parsed.path == "/api-football/world-cup/top-scorers":
            handle_api_football_world_cup_top_scorers(self, parsed.query)
            return

        if parsed.path == "/api-football/player-profile":
            handle_api_football_player_profile(self, parsed.query)
            return

        if parsed.path == "/api-football/news":
            handle_api_football_news(self, parsed.query)
            return

        if parsed.path.startswith("/api-football/v3/"):
            endpoint = parsed.path.removeprefix("/api-football/v3/").strip("/")
            params = normalize_query(parsed.query)
            try:
                params = sanitize_world_cup_proxy_params(endpoint, params)
                payload = api_football_request(endpoint, params)
                payload = sanitize_world_cup_proxy_payload(endpoint, payload)
                json_response(self, {"ok": True, "endpoint": endpoint, "payload": payload})
            except ApiFootballError as exc:
                json_response(
                    self,
                    {
                        "ok": False,
                        "message": clean_api_message("generic"),
                        "endpoint": endpoint,
                        "upstreamStatus": exc.status,
                    },
                )
            return

        super().do_GET()

    def log_message(self, format, *args):
        line = f"{datetime.now().isoformat(timespec='seconds')} {self.client_address[0]} {self.path} {format % args}\n"
        with (ROOT / "server-access.log").open("a", encoding="utf-8") as log:
            log.write(line)


def main():
    os.chdir(ROOT)
    log_path = ROOT / "server-status.txt"
    with ThreadingHTTPServer((HOST, PORT), QuietHandler) as server:
        log_path.write_text(
            f"Server attivo su http://127.0.0.1:{PORT}/ e rete locale porta {PORT}\n",
            encoding="utf-8",
        )
        server.serve_forever()


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        (ROOT / "server-status.txt").write_text(f"Errore server: {exc}\n", encoding="utf-8")
        sys.exit(1)
