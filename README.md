# ChessReview

Analisa uma partida do chess.com com Stockfish e explica os seus erros em português usando um LLM.

> O LLM não analisa xadrez: quem calcula tudo é o Stockfish. O modelo só traduz os dados do motor (melhor lance, linha principal, avaliações) para linguagem natural.

<!-- Adicione aqui prints ou um GIF do app (ex.: docs/img/demo.gif) com: ![Demo](docs/img/demo.gif) -->

## O que faz

1. Você digita o seu nick do chess.com.
2. O app lista as partidas dos últimos meses.
3. Você escolhe uma partida e o backend a analisa por inteiro com o Stockfish local.
4. Cada erro e blunder ganha uma explicação em português.
5. A tela mostra o tabuleiro navegável, a lista de lances com os erros marcados, o gráfico de avaliação e a explicação do lance selecionado.

Classificação pela perda de centipawns do jogador: imprecisão (50–99), erro (100–299) e blunder (300 ou mais). Só os seus lances são classificados, e só erros e blunders recebem explicação.

## Stack

- **Backend:** Python, FastAPI, `python-chess`, `httpx`, SQLite
- **Frontend:** React, Vite, TypeScript, `react-chessboard`, `chess.js`, `recharts`
- **Motor:** Stockfish local
- **LLM:** OpenRouter (modelo configurável)

## Pré-requisitos

- Python 3.11 ou superior
- Node.js
- [Stockfish](https://stockfishchess.org/download/) instalado localmente
- Uma chave do [OpenRouter](https://openrouter.ai/) (opcional: sem ela a análise roda, mas sem explicações)

## Configuração

Copie o `.env.example` para `.env` na raiz do projeto e preencha:

```
STOCKFISH_PATH=/caminho/para/stockfish
OPENROUTER_API_KEY=sua-chave
OPENROUTER_MODEL=modelo-barato-e-bom-em-portugues
```

O `.env` não é versionado.

## Como rodar

```bash
# backend (http://localhost:8000)
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# frontend (http://localhost:5173), em outro terminal
cd frontend
npm install
npm run dev
```

Testes (classificação por centipawns e conversão de mate):

```bash
cd backend
pip install pytest
python -m pytest
```

Para ver os erros de uma partida só no terminal, sem a interface: `python engine.py <nick>` dentro de `backend/`.

## API

- `GET /api/games?username=...`: partidas recentes
- `POST /api/analyze` com `{ "game_url": "...", "username": "..." }`: analisa a partida e devolve lances, avaliações, classificação e explicações
- `GET /api/analysis?game_url=...`: devolve a análise do cache, se existir

As análises completas ficam em `backend/chessreview.db` (SQLite). Uma partida já analisada não roda o Stockfish nem chama o LLM de novo. Análises com aviso (por exemplo, sem chave do OpenRouter ou com explicações que falharam) não são guardadas, então a próxima tentativa refaz tudo.

## Limitações

- Roda só localmente, sem login e sem deploy.
- Só chess.com, uma partida por vez.
- A análise é síncrona: a tela espera o fim da análise e das explicações, o que pode levar alguns minutos.
- A qualidade do texto depende do modelo escolhido.
