import httpx

BASE_URL = "https://api.chess.com/pub/player"
USER_AGENT = "chessreview/0.1 (personal chess analysis tool)"
MONTHS_TO_FETCH = 2


class UserNotFoundError(Exception):
    pass


class ChessComError(Exception):
    pass


async def _get_json(client: httpx.AsyncClient, url: str) -> dict:
    try:
        response = await client.get(url)
    except httpx.HTTPError as exc:
        raise ChessComError(f"Falha ao acessar o chess.com: {exc}") from exc
    if response.status_code == 404:
        raise UserNotFoundError("Usuário não encontrado no chess.com")
    if response.status_code != 200:
        raise ChessComError(f"chess.com respondeu {response.status_code}")
    return response.json()


def _user_color(game: dict, username: str) -> str | None:
    if game["white"]["username"].lower() == username.lower():
        return "white"
    if game["black"]["username"].lower() == username.lower():
        return "black"
    return None


def _normalize_game(game: dict, username: str) -> dict:
    white, black = game["white"], game["black"]
    user_color = _user_color(game, username)
    return {
        "url": game["url"],
        "pgn": game.get("pgn", ""),
        "white": white["username"],
        "black": black["username"],
        "white_rating": white.get("rating"),
        "black_rating": black.get("rating"),
        "result": white["result"] if user_color == "white" else black["result"],
        "time_control": game.get("time_control"),
        "end_time": game.get("end_time", 0),
        "user_color": user_color,
    }


async def list_recent_games(username: str) -> list[dict]:
    """Partidas dos últimos meses, da mais recente para a mais antiga."""
    async with httpx.AsyncClient(
        headers={"User-Agent": USER_AGENT}, timeout=20
    ) as client:
        archives = await _get_json(client, f"{BASE_URL}/{username}/games/archives")
        games: list[dict] = []
        for url in archives["archives"][-MONTHS_TO_FETCH:]:
            month = await _get_json(client, url)
            games.extend(month["games"])

    normalized = [
        _normalize_game(g, username)
        for g in games
        if "pgn" in g and _user_color(g, username)
    ]
    return sorted(normalized, key=lambda g: g["end_time"], reverse=True)
