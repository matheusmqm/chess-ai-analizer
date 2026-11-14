"""Fatos concretos (calculados com python-chess) sobre um lance, para o LLM só traduzir em texto.

Todas as funções recebem a posição ANTES do lance e não a modificam."""

import chess

VALUES = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 100}
NAMES = {
    chess.PAWN: ("peão", "m"),
    chess.KNIGHT: ("cavalo", "m"),
    chess.BISHOP: ("bispo", "m"),
    chess.ROOK: ("torre", "f"),
    chess.QUEEN: ("dama", "f"),
    chess.KING: ("rei", "m"),
}
TARGETS = (chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN)
LINE_LENGTH = 3
MATE_CP = 9000


def _label(piece_type: int, square: int, own: bool) -> str:
    name, gender = NAMES[piece_type]
    where = chess.square_name(square)
    if own:
        return f"{'sua' if gender == 'f' else 'seu'} {name} em {where}"
    return f"{'a' if gender == 'f' else 'o'} {name} do adversário em {where}"


def _exposed(board: chess.Board, color: chess.Color) -> dict[int, str]:
    """Peças de `color` (sem peões/rei) que o adversário captura com ganho.

    Devolve casa -> "por <peça> em <casa>" do atacante mais barato."""
    result: dict[int, str] = {}
    for square, piece in board.piece_map().items():
        if piece.color != color or piece.piece_type not in TARGETS:
            continue
        attackers = board.attackers(not color, square)
        if not attackers:
            continue
        cheapest = min(attackers, key=lambda a: VALUES[board.piece_type_at(a)])
        cheapest_value = VALUES[board.piece_type_at(cheapest)]
        undefended = not board.attackers(color, square)
        if cheapest_value < VALUES[piece.piece_type] or undefended:
            name = NAMES[board.piece_type_at(cheapest)][0]
            result[square] = f"por {name} em {chess.square_name(cheapest)}"
    return result


def _captured(board: chess.Board, move: chess.Move) -> tuple[int, int] | None:
    """(tipo, casa) da peça capturada pelo lance, ou None."""
    if board.is_en_passant(move):
        return chess.PAWN, move.to_square + (-8 if board.turn == chess.WHITE else 8)
    piece = board.piece_at(move.to_square)
    return (piece.piece_type, move.to_square) if piece else None


def _walk_line(board: chess.Board, line: list[chess.Move], color: chess.Color) -> tuple[list[str], list[str], str | None]:
    """Simula a linha. Devolve (peças que `color` perde, peças que `color` ganha, desfecho)."""
    board = board.copy(stack=False)
    lost: list[str] = []
    won: list[str] = []
    ending: str | None = None
    for move in line[:LINE_LENGTH]:
        mover = board.turn
        cap = _captured(board, move)
        if cap:
            if mover == color:
                won.append(_label(cap[0], cap[1], own=False))
            else:
                lost.append(_label(cap[0], cap[1], own=True))
        board.push(move)
        if board.is_checkmate():
            ending = "mate a favor de você" if mover == color else "xeque-mate contra você"
            break
    return lost, won, ending


def _line_facts(board: chess.Board, line: list[chess.Move], color: chess.Color, subject: str) -> list[str]:
    lost, won, ending = _walk_line(board, line, color)
    facts = []
    if lost:
        facts.append(f"Na linha do motor {subject}, você perde: {'; '.join(lost)}")
    if won:
        facts.append(f"Na linha do motor {subject}, você ganha: {'; '.join(won)}")
    if ending:
        facts.append(f"Na linha do motor {subject}, termina em {ending}")
    return facts


def played_facts(board: chess.Board, played: chess.Move, reply: list[chess.Move], eval_after: int) -> list[str]:
    """O que há de ruim no lance jogado. `reply` = linha do motor depois dele."""
    color = board.turn
    facts: list[str] = []
    piece = board.piece_at(played.from_square)
    exposed_before = _exposed(board, color)

    cap = _captured(board, played)
    if cap:
        facts.append(f"O lance captura {_label(cap[0], cap[1], own=False)}")

    after = board.copy(stack=False)
    after.push(played)
    if after.is_check():
        facts.append("O lance dá xeque")

    for square, by in _exposed(after, color).items():
        moved_here = square == played.to_square
        if moved_here:
            facts.append(f"O lance deixa {_label(piece.piece_type, square, own=True)} sob ameaça de captura {by}")
        elif square in exposed_before:
            kind = after.piece_type_at(square)
            facts.append(f"O lance não resolve a ameaça: {_label(kind, square, own=True)} continua sob ameaça de captura {by}")
        else:
            kind = after.piece_type_at(square)
            facts.append(f"O lance deixa {_label(kind, square, own=True)} sob ameaça de captura {by}")

    if reply:
        first = reply[0]
        cap_reply = _captured(after, first)
        if cap_reply:
            facts.append(
                f"A melhor resposta do adversário captura {_label(cap_reply[0], cap_reply[1], own=True)}"
            )
        exposed_now = set(_exposed(after, color))
        nxt = after.copy(stack=False)
        nxt.push(first)
        if nxt.is_checkmate():
            facts.append("A melhor resposta do adversário dá xeque-mate")
        elif nxt.is_check():
            facts.append("A melhor resposta do adversário dá xeque")
        for square, by in _exposed(nxt, color).items():
            if square not in exposed_now and not (cap_reply and square == cap_reply[1]):
                kind = nxt.piece_type_at(square)
                facts.append(f"Essa resposta ameaça {_label(kind, square, own=True)} {by}")
        facts += _line_facts(after, reply, color, "depois do lance jogado")

    if eval_after <= -MATE_CP:
        facts.append("Depois do lance jogado, o adversário tem xeque-mate forçado")
    return facts


def best_facts(board: chess.Board, line: list[chess.Move], eval_before: int) -> list[str]:
    """O que o melhor lance faz. `line` = linha do motor a partir da posição (começa no melhor lance)."""
    if not line:
        return []
    color = board.turn
    best = line[0]
    facts: list[str] = []
    exposed_before = _exposed(board, color)

    cap = _captured(board, best)
    if cap:
        facts.append(f"O melhor lance captura {_label(cap[0], cap[1], own=False)}")

    after = board.copy(stack=False)
    after.push(best)
    if after.is_checkmate():
        facts.append("O melhor lance dá xeque-mate")
    elif after.is_check():
        facts.append("O melhor lance dá xeque")

    exposed_after = _exposed(after, color)
    for square in exposed_before:
        kind = board.piece_type_at(square)
        if square == best.from_square:
            facts.append(f"O melhor lance tira {_label(kind, square, own=True)} da ameaça de captura")
        elif square not in exposed_after:
            facts.append(f"O melhor lance resolve a ameaça sobre {_label(kind, square, own=True)}")

    # Peças do adversário que passam a ficar ameaçadas.
    opponent_before = set(_exposed(board, not color))
    for square, by in _exposed(after, not color).items():
        if square not in opponent_before:
            kind = after.piece_type_at(square)
            facts.append(f"O melhor lance ameaça {_label(kind, square, own=False)} {by}")

    line_facts = _line_facts(board, line, color, "com o melhor lance")
    facts += line_facts
    if not line_facts:
        facts.append("Na linha do motor com o melhor lance, você não perde material")
    if eval_before >= MATE_CP:
        facts.append("Nessa posição você tinha xeque-mate forçado")
    return facts
