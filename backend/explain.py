import asyncio
import os

import httpx
from dotenv import load_dotenv

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MAX_CONCURRENCY = 2  # modelos gratuitos têm limite baixo; 5 em paralelo estoura o 429
MAX_TOKENS = 1500  # folga para modelos que "pensam" antes de responder
RETRIES = 3
FALLBACK_MODELS = ["baidu/ernie-5.5-flash-preview:free"]
EXPLAINED_CLASSES = ("mistake", "miss", "blunder")

SYSTEM_PROMPT = """Você é um treinador de xadrez que explica erros em português do Brasil, falando direto com o jogador ("você").
Você NÃO analisa xadrez: um programa já calculou os fatos da posição e você só os transforma em uma explicação clara.

Como responder (2 a 4 frases, texto corrido):
- Diga objetivamente POR QUE o lance foi ruim, em termos de peças e ameaças: o que ficou sem defesa, o que o adversário passa a capturar ou ameaçar, xeque ou mate.
- Depois diga o que o melhor lance faz de melhor: o que protege, o que captura, o que ameaça, o que evita.
- Use apenas os fatos fornecidos. Não invente variantes, táticas, peças ou casas que não estejam nos fatos nem nas linhas.
- NÃO cite avaliações, centipawns, "pontos" nem números de vantagem. Fale em peças, ameaças e consequências.
- Se o melhor lance não tiver fatos específicos, diga só que ele evita a perda; NÃO invente o propósito dele (desenvolver, controlar o centro etc.).
- Se os fatos não explicarem bem o motivo, diga só o que está confirmado (ex.: "o motor prefere X") sem inventar justificativa.
- Não use markdown nem listas."""

CLASS_NAMES = {"mistake": "erro", "miss": "chance perdida", "blunder": "blunder"}
PHASE_NAMES = {"opening": "abertura", "middlegame": "meio-jogo", "endgame": "final"}


def _bullets(items: list[str]) -> str:
    return "\n".join(f"- {item}" for item in items) if items else "- (nenhum fato específico encontrado)"


def build_user_prompt(move: dict) -> str:
    best_line = " ".join(move["main_line"]) or "(indisponível)"
    reply_line = " ".join(move.get("reply_line", [])) or "(indisponível)"
    return (
        f"Lance {move['move_number']} ({PHASE_NAMES.get(move['phase'], move['phase'])}), "
        f"classificado como {CLASS_NAMES[move['classification']]}.\n"
        f"Posição (FEN) antes do lance: {move['fen_before']}\n"
        f"Lance jogado: {move['san']}\n"
        f"Melhor lance: {move['best_move']}\n"
        f"Linha do motor depois do lance jogado: {reply_line}\n"
        f"Linha do motor com o melhor lance: {best_line}\n"
        f"Fatos sobre o lance jogado:\n{_bullets(move.get('played_facts', []))}\n"
        f"Fatos sobre o melhor lance:\n{_bullets(move.get('best_facts', []))}"
    )



async def _request(
    client: httpx.AsyncClient, model: str, api_key: str, move: dict, errors: list[str]
) -> str:
    """Uma chamada ao modelo, com novas tentativas em 429/5xx/vazio. Devolve "" se esgotar."""
    payload = {
        "model": model,
        "max_tokens": MAX_TOKENS,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_user_prompt(move)},
        ],
    }
    headers = {"Authorization": f"Bearer {api_key}"}
    for attempt in range(RETRIES):
        try:
            response = await client.post(OPENROUTER_URL, json=payload, headers=headers)
            if response.status_code == 429 or response.status_code >= 500:
                errors.append(f"{model}: HTTP {response.status_code}")
            else:
                response.raise_for_status()
                text = (response.json()["choices"][0]["message"].get("content") or "").strip()
                if text:
                    return text
                errors.append(f"{model}: resposta vazia")
        except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
            errors.append(f"{model}: {type(exc).__name__} {exc}")
            if isinstance(exc, httpx.HTTPStatusError):
                return ""  # 4xx (chave, modelo inexistente): repetir não adianta
        await asyncio.sleep(2 * (attempt + 1))
    return ""


async def _explain_one(
    client: httpx.AsyncClient,
    semaphore: asyncio.Semaphore,
    models: list[str],
    api_key: str,
    move: dict,
    errors: list[str],
) -> str:
    async with semaphore:
        for model in models:
            text = await _request(client, model, api_key, move, errors)
            if text:
                return text
    return ""


async def explain_mistakes(moves: list[dict]) -> list[str]:
    """Preenche move['explanation'] nos erros/blunders. Falhas viram texto vazio.

    Devolve avisos em português (lista vazia se tudo deu certo)."""
    # override=True: pega mudanças no .env sem precisar reiniciar o backend.
    load_dotenv(override=True)
    targets = [m for m in moves if m["is_player"] and m["classification"] in EXPLAINED_CLASSES]
    api_key = os.getenv("OPENROUTER_API_KEY", "")
    model = os.getenv("OPENROUTER_MODEL", "")
    if not (api_key and model):
        for m in targets:
            m["explanation"] = ""
        return ["OPENROUTER_API_KEY ou OPENROUTER_MODEL não configurados: análise sem explicações."]

    # Modelo do .env primeiro; se ele falhar, tenta o de reserva.
    models = [model] + [m for m in FALLBACK_MODELS if m != model]
    errors: list[str] = []
    semaphore = asyncio.Semaphore(MAX_CONCURRENCY)
    async with httpx.AsyncClient(timeout=60) as client:
        texts = await asyncio.gather(
            *(_explain_one(client, semaphore, models, api_key, m, errors) for m in targets)
        )
    for move, text in zip(targets, texts):
        move["explanation"] = text

    failed = sum(1 for text in texts if not text)
    if failed:
        reason = errors[-1] if errors else "motivo desconhecido"
        print(f"[explain] {failed}/{len(targets)} falharam. Erros: {errors[:5]}", flush=True)
        return [f"{failed} de {len(targets)} explicações falharam ({reason})."]
    return []
