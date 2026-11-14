import asyncio
import io
import os
import sys

import chess
import chess.engine
import chess.pgn
from dotenv import load_dotenv

import facts

DEPTH = 15
MATE_SCORE = 10000
MAIN_LINE_LENGTH = 3
GREAT_MIN_GAP = 200  # "Ótimo": lance único, 2º melhor pelo menos 2 peões pior
BOOK_MAX_PLY = 12  # sem livro de aberturas: lances bons nos primeiros 12 plies viram "livro"
PIECE_VALUES = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9}


def score_to_cp(score: chess.engine.PovScore) -> int:
    """Avaliação em centipawns do ponto de vista das brancas (mate vira ±10000)."""
    return score.white().score(mate_score=MATE_SCORE)


def player_cp(white_cp: int, color: chess.Color) -> int:
    """Converte avaliação das brancas para o ponto de vista de `color`."""
    return white_cp if color == chess.WHITE else -white_cp


def centipawn_loss(eval_before: int, eval_after: int) -> int:
    """Perda do jogador (ambas as avaliações já no ponto de vista dele)."""
    return max(0, eval_before - eval_after)


def classify(loss: int) -> str:
    """Classe pela perda de centipawns (sem contexto da posição)."""
    if loss >= 300:
        return "blunder"
    if loss >= 100:
        return "mistake"
    if loss >= 50:
        return "inaccuracy"
    if loss >= 20:
        return "good"
    return "excellent"


def is_sacrifice(board: chess.Board, move: chess.Move) -> bool:
    """O lance deixa uma peça (não peão) exposta e perde material líquido (>= 2 peões)?

    `board` é a posição ANTES do lance."""
    piece = board.piece_at(move.from_square)
    if piece is None or piece.piece_type not in (chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN):
        return False
    captured = board.piece_at(move.to_square)
    captured_value = PIECE_VALUES.get(captured.piece_type, 0) if captured else 0
    value = PIECE_VALUES[piece.piece_type]
    if value - captured_value < 2:
        return False
    mover = board.turn
    board.push(move)
    try:
        attackers = board.attackers(not mover, move.to_square)
        defended = bool(board.attackers(mover, move.to_square))
        cheapest = min(
            (PIECE_VALUES.get(board.piece_type_at(sq), 100) for sq in attackers), default=None
        )
    finally:
        board.pop()
    if cheapest is None:
        return False
    return cheapest < value or not defended


def classify_move(
    *,
    loss: int,
    is_best: bool,
    gap: int,
    sacrifice: bool,
    eval_before: int,
    eval_after: int,
    ply: int,
    prev_opponent_loss: int,
    recapture: bool = False,
    forced: bool = False,
) -> str:
    """Classe estilo chess.com. `gap` = quanto o 2º melhor lance do motor é pior que o melhor."""
    if forced:
        return "forced"  # único lance legal: não há escolha a avaliar
    if loss >= 50:
        # "Chance perdida": o adversário errou, você estava melhor e não aproveitou.
        if 100 <= loss < 300 and prev_opponent_loss >= 150 and eval_before >= 150:
            return "miss"
        return classify(loss)
    if sacrifice and loss <= 10 and eval_before < 500 and eval_after >= -50:
        return "brilliant"
    if is_best and gap >= GREAT_MIN_GAP and not recapture and eval_before < 500:
        return "great"
    if ply <= BOOK_MAX_PLY and loss < 20:
        return "book"
    if is_best:
        return "best"
    return classify(loss)


def game_phase(board: chess.Board) -> str:
    """Fase simples pela posição: abertura, meio-jogo ou final."""
    if board.fullmove_number <= 10:
        return "opening"
    pieces = sum(
        len(board.pieces(t, c))
        for t in (chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN)
        for c in (chess.WHITE, chess.BLACK)
    )
    return "endgame" if pieces <= 6 else "middlegame"


def _evaluate(
    engine: chess.engine.SimpleEngine, board: chess.Board
) -> tuple[int, list[chess.Move], int | None]:
    """Avaliação (ponto de vista das brancas), linha principal e avaliação do 2º melhor lance."""
    if board.is_checkmate():
        # Quem está a jogar foi mateado.
        return (-MATE_SCORE if board.turn == chess.WHITE else MATE_SCORE), [], None
    if board.is_game_over():
        return 0, [], None
    infos = engine.analyse(board, chess.engine.Limit(depth=DEPTH), multipv=2)
    second = score_to_cp(infos[1]["score"]) if len(infos) > 1 else None
    return score_to_cp(infos[0]["score"]), infos[0].get("pv", []), second


def analyze_game(pgn: str, player_color: chess.Color) -> list[dict]:
    game = chess.pgn.read_game(io.StringIO(pgn))
    if game is None:
        raise ValueError("PGN inválido")

    stockfish_path = os.getenv("STOCKFISH_PATH")
    if not stockfish_path:
        raise RuntimeError("STOCKFISH_PATH não configurado (veja o .env.example)")
    if not os.path.isfile(stockfish_path):
        raise RuntimeError(f"STOCKFISH_PATH inválido, arquivo não encontrado: {stockfish_path}")

    board = game.board()
    moves: list[dict] = []
    with chess.engine.SimpleEngine.popen_uci(stockfish_path) as engine:
        white_before, pv, second_white = _evaluate(engine, board)
        prev_loss = 0
        prev_capture_square: int | None = None
        for played in game.mainline_moves():
            mover = board.turn
            best = pv[0] if pv else None
            fen_before = board.fen()
            phase = game_phase(board)
            move_number = board.fullmove_number
            best_san = board.san(best) if best else None
            main_line = (
                board.variation_san(pv[:MAIN_LINE_LENGTH]).split() if pv else []
            )
            san = board.san(played)
            sacrifice = is_sacrifice(board, played)
            is_capture = board.is_capture(played)
            forced = board.legal_moves.count() == 1
            recapture = is_capture and played.to_square == prev_capture_square

            board_before = board.copy(stack=False)
            board.push(played)
            white_after, next_pv, next_second = _evaluate(engine, board)

            eval_before = player_cp(white_before, mover)
            eval_after = player_cp(white_after, mover)
            loss = centipawn_loss(eval_before, eval_after)
            gap = (
                eval_before - player_cp(second_white, mover) if second_white is not None else 0
            )
            classification = classify_move(
                loss=loss,
                is_best=best is not None and played == best,
                gap=gap,
                sacrifice=sacrifice,
                eval_before=eval_before,
                eval_after=eval_after,
                ply=len(moves) + 1,
                prev_opponent_loss=prev_loss,
                recapture=recapture,
                forced=forced,
            )
            # Fatos concretos só para os erros do jogador (é o que o LLM vai explicar).
            explainable = mover == player_color and loss >= 100
            reply_line = board.variation_san(next_pv[:MAIN_LINE_LENGTH]).split() if next_pv else []
            moves.append(
                {
                    "move_number": move_number,
                    "color": "white" if mover == chess.WHITE else "black",
                    "phase": phase,
                    "fen_before": fen_before,
                    "san": san,
                    "eval_before": eval_before,
                    "eval_after": eval_after,
                    "best_move": best_san,
                    "main_line": main_line,
                    "loss": loss,
                    "classification": classification,
                    "reply_line": reply_line if explainable else [],
                    "played_facts": (
                        facts.played_facts(board_before, played, next_pv, eval_after) if explainable else []
                    ),
                    "best_facts": facts.best_facts(board_before, pv, eval_before) if explainable else [],
                    "is_player": mover == player_color,
                }
            )
            prev_loss = loss
            prev_capture_square = played.to_square if is_capture else None
            white_before, pv, second_white = white_after, next_pv, next_second
    return moves


async def _main(username: str) -> None:
    import chesscom

    games = await chesscom.list_recent_games(username)
    if not games:
        print("Nenhuma partida encontrada.")
        return
    game = games[0]
    color = chess.WHITE if game["user_color"] == "white" else chess.BLACK
    print(f"{game['white']} x {game['black']} ({game['url']})")
    print("Analisando...", flush=True)
    moves = await asyncio.to_thread(analyze_game, game["pgn"], color)
    for m in moves:
        if m["is_player"] and m["classification"] in ("inaccuracy", "mistake", "miss", "blunder"):
            print(
                f"{m['move_number']}. {m['san']} [{m['classification']}] "
                f"melhor: {m['best_move']} | "
                f"{m['eval_before']} -> {m['eval_after']} (perda {m['loss']})"
            )


if __name__ == "__main__":
    load_dotenv()
    if len(sys.argv) != 2:
        sys.exit("Uso: python engine.py <nick>")
    asyncio.run(_main(sys.argv[1]))
