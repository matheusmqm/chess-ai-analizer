import chess
import chess.engine
import pytest

import facts
from engine import centipawn_loss, classify, classify_move, is_sacrifice, player_cp, score_to_cp


@pytest.mark.parametrize(
    "loss, expected",
    [
        (0, "excellent"),
        (19, "excellent"),
        (20, "good"),
        (49, "good"),
        (50, "inaccuracy"),
        (99, "inaccuracy"),
        (100, "mistake"),
        (299, "mistake"),
        (300, "blunder"),
        (10000, "blunder"),
    ],
)
def test_classify_boundaries(loss, expected):
    assert classify(loss) == expected


def test_mate_for_white():
    score = chess.engine.PovScore(chess.engine.Mate(3), chess.WHITE)
    assert score_to_cp(score) == 9997


def test_mate_for_black_is_negative_for_white():
    score = chess.engine.PovScore(chess.engine.Mate(2), chess.BLACK)
    assert score_to_cp(score) == -9998


def test_mate_against_white_pov():
    score = chess.engine.PovScore(chess.engine.Mate(-2), chess.WHITE)
    assert score_to_cp(score) == -9998


def test_cp_score_black_pov_converted_to_white():
    score = chess.engine.PovScore(chess.engine.Cp(120), chess.BLACK)
    assert score_to_cp(score) == -120


def test_player_cp_pov():
    assert player_cp(150, chess.WHITE) == 150
    assert player_cp(150, chess.BLACK) == -150


def test_loss_for_white_and_black():
    # Brancas: de +100 para -200 => perde 300.
    assert centipawn_loss(player_cp(100, chess.WHITE), player_cp(-200, chess.WHITE)) == 300
    # Pretas: avaliação das brancas de -100 para +200 => pretas perdem 300.
    assert centipawn_loss(player_cp(-100, chess.BLACK), player_cp(200, chess.BLACK)) == 300


def test_loss_never_negative():
    assert centipawn_loss(0, 80) == 0


def _cm(**over):
    args = dict(loss=0, is_best=False, gap=0, sacrifice=False, eval_before=0,
                eval_after=0, ply=30, prev_opponent_loss=0)
    args.update(over)
    return classify_move(**args)


def test_classify_move_best_and_tiers():
    assert _cm(is_best=True) == "best"
    assert _cm(loss=10) == "excellent"
    assert _cm(loss=30) == "good"
    assert _cm(loss=60) == "inaccuracy"
    assert _cm(loss=150) == "mistake"
    assert _cm(loss=400) == "blunder"


def test_classify_move_book_only_in_opening():
    assert _cm(ply=6, is_best=True) == "book"
    assert _cm(ply=6, loss=40) == "good"  # lance ruim não é livro
    assert _cm(ply=13, is_best=True) == "best"


def test_classify_move_great_needs_only_move_and_not_winning():
    assert _cm(is_best=True, gap=200) == "great"
    assert _cm(is_best=True, gap=200, eval_before=700) == "best"
    assert _cm(is_best=True, gap=199) == "best"
    assert _cm(is_best=True, gap=300, recapture=True) == "best"  # recaptura não é "Ótimo"


def test_classify_move_brilliant():
    assert _cm(sacrifice=True, loss=5, is_best=True) == "brilliant"
    assert _cm(sacrifice=True, loss=5, eval_after=-300) != "brilliant"


def test_classify_move_miss():
    assert _cm(loss=150, prev_opponent_loss=200, eval_before=300) == "miss"
    assert _cm(loss=150, prev_opponent_loss=0, eval_before=300) == "mistake"
    assert _cm(loss=400, prev_opponent_loss=200, eval_before=300) == "blunder"


def test_is_sacrifice_queen_into_pawn_attack():
    board = chess.Board("4k3/8/3p4/8/8/8/8/3QK3 w - - 0 1")
    assert is_sacrifice(board, chess.Move.from_uci("d1e2")) is False  # casa livre
    board = chess.Board("4k3/8/3p4/8/8/8/4Q3/4K3 w - - 0 1")
    assert is_sacrifice(board, chess.Move.from_uci("e2e5"))  # dama atacada pelo peão d6


def test_capture_of_equal_piece_is_not_sacrifice():
    board = chess.Board("8/8/4k3/3n4/8/2N5/8/4K3 w - - 0 1")
    assert is_sacrifice(board, chess.Move.from_uci("c3d5")) is False  # cavalo x cavalo


def test_played_facts_queen_hangs_to_pawn():
    board = chess.Board("4k3/8/3p4/8/8/8/4Q3/4K3 w - - 0 1")
    played = chess.Move.from_uci("e2e5")
    reply = [chess.Move.from_uci("d6e5")]
    out = facts.played_facts(board, played, reply, eval_after=-800)
    assert any("sua dama em e5 sob ameaça de captura por peão em d6" in f for f in out)
    assert any("melhor resposta do adversário captura sua dama em e5" in f for f in out)
    assert any("você perde: sua dama em e5" in f for f in out)


def test_best_facts_capture_and_check():
    board = chess.Board("4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1")
    out = facts.best_facts(board, [chess.Move.from_uci("d1d5")], eval_before=900)
    assert any("captura a dama do adversário em d5" in f for f in out)
    assert any("você ganha" in f for f in out)


def test_best_facts_saves_attacked_piece():
    # Dama branca em d4 atacada pelo peão e5 -> o melhor lance a tira do ataque.
    board = chess.Board("4k3/8/8/4p3/3Q4/8/8/4K3 w - - 0 1")
    out = facts.best_facts(board, [chess.Move.from_uci("d4d1")], eval_before=0)
    assert any("tira sua dama em d4 da ameaça de captura" in f for f in out)


def test_best_facts_without_material_change_says_so():
    board = chess.Board()
    out = facts.best_facts(board, [chess.Move.from_uci("e2e4")], eval_before=20)
    assert any("não perde material" in f for f in out)
