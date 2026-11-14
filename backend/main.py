import asyncio

import chess
import chess.engine
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import chesscom
import db
import engine
import explain

load_dotenv()
db.init_db()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _list_games(username: str) -> list[dict]:
    try:
        return await chesscom.list_recent_games(username)
    except chesscom.UserNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except chesscom.ChessComError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.get("/api/games")
async def get_games(username: str) -> list[dict]:
    return await _list_games(username)


class AnalyzeRequest(BaseModel):
    game_url: str
    username: str


@app.post("/api/analyze")
async def analyze(req: AnalyzeRequest) -> dict:
    cached = db.get_analysis(req.game_url)
    if cached:
        return cached

    games = await _list_games(req.username)
    game = next((g for g in games if g["url"] == req.game_url), None)
    if game is None:
        raise HTTPException(status_code=404, detail="Partida não encontrada")

    color = chess.WHITE if game["user_color"] == "white" else chess.BLACK
    try:
        moves = await asyncio.to_thread(engine.analyze_game, game["pgn"], color)
    except (RuntimeError, ValueError, OSError, chess.engine.EngineError) as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    warnings = await explain.explain_mistakes(moves)
    result = {"game": game, "moves": moves, "warnings": warnings}
    # Só guarda análise completa: com aviso, a próxima tentativa refaz tudo.
    if not warnings:
        db.save_analysis(req.game_url, req.username, result)
    return result


@app.get("/api/analysis")
async def get_analysis(game_url: str) -> dict:
    cached = db.get_analysis(game_url)
    if cached is None:
        raise HTTPException(status_code=404, detail="Análise não encontrada")
    return cached
