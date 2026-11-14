import asyncio
import os

import httpx
from dotenv import load_dotenv

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MAX_CONCURRENCY = 4
MAX_TOKENS = 600  # a explicação tem 2 a 4 frases
RETRIES = 2
REQUEST_TIMEOUT = 45  # segundos por requisição
BUDGET_SECONDS = 150  # teto para TODAS as explicações: depois disso a análise segue sem elas
MAX_MODELS = 3  # limite do OpenRouter para a lista "models" de uma requisição
# Reservas: o próprio OpenRouter pula para o próximo da lista se um modelo estiver
# esgotado (cota diária), fora do ar ou inexistente. Modelos gratuitos são lentos e instáveis:
# ficam por último.
FALLBACK_MODELS = ["google/gemini-2.5-flash-lite", "inclusionai/ling-3.2-flash:free"]
QUOTA_ERROR = "cota diária esgotada"
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
    client: httpx.AsyncClient, models: list[str], api_key: str, move: dict, errors: list[str]
) -> str:
    """Uma chamada com fallback no OpenRouter, repetida em 429/5xx/vazio. Devolve "" se esgotar."""
    payload = {
        "models": models,  # em ordem de prioridade; o OpenRouter usa o primeiro disponível
        "max_tokens": MAX_TOKENS,
        "reasoning": {"enabled": False},  # sem "pensar" antes: modelos de raciocínio levavam minutos
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_user_prompt(move)},
        ],
    }
    headers = {"Authorization": f"Bearer {api_key}"}
    for attempt in range(RETRIES):
        try:
            response = await client.post(OPENROUTER_URL, json=payload, headers=headers)
            if response.status_code == 429 and "per-day" in response.text:
                errors.append(QUOTA_ERROR)  # todos os modelos da lista sem cota: repetir não adianta
                return ""
            if response.status_code == 429 or response.status_code >= 500:
                errors.append(f"HTTP {response.status_code}")
            else:
                response.raise_for_status()
                text = (response.json()["choices"][0]["message"].get("content") or "").strip()
                if text:
                    return text
                errors.append("resposta vazia")
        except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
            errors.append(f"{type(exc).__name__} {exc}")
            if isinstance(exc, httpx.HTTPStatusError):
                return ""  # 4xx (chave, lista de modelos inválida): repetir não adianta
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
        if QUOTA_ERROR in errors:
            return ""  # outra chamada já viu todos os modelos sem cota: não gasta mais requisições
        return await _request(client, models, api_key, move, errors)


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

    # Modelo do .env primeiro, depois as reservas (sem repetir, no máximo MAX_MODELS).
    models = ([model] + [m for m in FALLBACK_MODELS if m != model])[:MAX_MODELS]
    errors: list[str] = []
    semaphore = asyncio.Semaphore(MAX_CONCURRENCY)
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        tasks = [
            asyncio.create_task(_explain_one(client, semaphore, models, api_key, m, errors))
            for m in targets
        ]
        done, pending = await asyncio.wait(tasks, timeout=BUDGET_SECONDS)
        for task in pending:
            task.cancel()  # estourou o teto: segue sem essas explicações
    texts = [t.result() if t in done and t.exception() is None else "" for t in tasks]
    for move, text in zip(targets, texts):
        move["explanation"] = text
    if pending:
        errors.append(f"tempo esgotado ({BUDGET_SECONDS}s)")

    failed = sum(1 for text in texts if not text)
    if failed:
        if QUOTA_ERROR in errors:
            return [
                "O limite diário dos modelos gratuitos do OpenRouter acabou, então não gerei as explicações. "
                "Tente de novo amanhã ou adicione créditos na conta do OpenRouter."
            ]
        reason = errors[-1] if errors else "motivo desconhecido"
        print(f"[explain] {failed}/{len(targets)} falharam. Erros: {errors[:5]}", flush=True)
        return [f"{failed} de {len(targets)} explicações falharam ({reason})."]
    return []
