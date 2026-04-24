# Forge Redemption

A multi-agent prison-break simulation where two LLM-powered agents — an **Inmate** and an **Outside Friend** — cooperate to plan and execute an escape. Every strategic decision is made by Claude Sonnet in real time. The human only clicks "Next Turn" and watches the story unfold.

Built on [InsForge](https://insforge.com) as a full-stack demo: Postgres database, realtime pub/sub, AI gateway, edge functions, object storage, and a React frontend — all from a single SDK.

## How It Works

The game is a turn-based loop. Each turn advances the world clock, then asks each agent to choose one action. Agents can only use skills they possess, and the world enforces physics (location, weather, inventory) server-side.

### Turn Sequence

```
Human clicks "Next Turn"
        │
        ▼
┌─ advance-world ─────────────────────────────────────┐
│  Increment tick, cycle time-of-day, roll weather     │
│  InsForge: Database (update game_state row)           │
└──────────────────────────────────────────────────────┘
        │
        ▼
┌─ inmate-tick ────────────────────────────────────────┐
│  1. Read game_state + inmate agent row               │
│     InsForge: Database (select)                       │
│  2. Build prompt with world state + agent memory     │
│  3. LLM decides action (move/learn/dig/pickup)       │
│     InsForge: AI Gateway (Claude Sonnet)              │
│  4. Validate & execute action, mutate DB             │
│     InsForge: Database (update agents, game_state)    │
│  5. Optionally: vector search the library            │
│     InsForge: AI Gateway (embeddings) + Database RPC  │
│  6. Write narration to action_log                    │
│     InsForge: Database (insert)                       │
└──────────────────────────────────────────────────────┘
        │
        ▼
┌─ friend-tick ────────────────────────────────────────┐
│  Same pattern as inmate-tick, different skills       │
│  InsForge: AI Gateway + Database                      │
└──────────────────────────────────────────────────────┘
        │
        ▼
   Frontend refreshes from DB + realtime events
```

### What the LLM Decides vs. What It Doesn't

| Decided by LLM (Claude Sonnet) | Enforced by code (edge functions) |
|---|---|
| Which action to take each turn | Whether the agent has the required skill |
| Where to move | Which locations an agent can access |
| What to search in the library | Whether the agent is at the library |
| When to attempt digging | Whether weather is rain (noise cover) |
| When to pick up from the dropbox | Whether the dropbox has an item |
| Strategic reasoning and memory | Escape progress math (10% bare hands, 30% with hammer) |
| The friend's supply-chain plan | Shop stock, dropbox state, inventory transfers |

The LLM receives a system prompt listing its available skills and constraints, plus the current world/agent state as a JSON user message. It returns a single JSON object: `{"action", "args", "reasoning"}`. The edge function validates every precondition before executing — the LLM proposes, the world disposes.

If LLM output fails to parse as JSON, the agent falls back to a safe default action (inmate: move to library, friend: walk to shop).

## Game Rules

**Goal:** The inmate escapes by reaching 100% tunnel progress.

**The Inmate** starts in a cell with three skills:
- `move` — walk to cell, library, or yard
- `learn_from_library` — query the knowledge base (must be at library). If the query matches a `digging-technique-*` topic, the inmate learns the `dig` skill.
- `pickup_from_dropbox` — collect an item from the yard dropbox (must be at yard)
- `dig` — (learned) tunnel out from the cell. Only works during **rain** (acoustic cover). +10% bare hands, +30% with hammer.

**The Friend** starts at the shop with three skills:
- `walk_to` — move to shop or yard
- `buy_hammer` — purchase a hammer (must be at shop, shop must have stock)
- `drop_in_yard` — leave the hammer in the dropbox (must be at yard, must have hammer)

**World clock:** morning → noon → evening → night (cycles). Weather is random each tick: 40% rain, 35% sun, 25% fog.

## InsForge Capabilities Used

### Database (Postgres)

- **`game_state` table** — single authoritative row (id=1) tracking tick, time-of-day, weather, world blob (dropbox, shop stock, escape progress), and game status.
- **`agents` table** — one row per agent with location, skills array, inventory JSONB, and memory JSONB (thoughts + recent_actions).
- **`action_log` table** — append-only narration feed. Every agent action and world event is recorded.
- **`library` table** — knowledge base with pgvector embeddings (1536-dim) for semantic search.
- **`assets` table** — maps sprite keys to storage URLs for generated images.
- **`search_library` RPC** — Postgres function performing cosine-distance vector search over library embeddings.

### Realtime

- **Channel `game:world`** — all table mutations broadcast events via Postgres triggers (`AFTER INSERT/UPDATE`).
- Three event types: `state_changed`, `agent_changed`, `action` — the frontend subscribes once and merges updates into React state.
- Realtime is best-effort; the frontend also refreshes from DB after each edge function call as the source of truth.

### AI Gateway

- **Chat completions** — `client.ai.chat.completions.create()` with `anthropic/claude-sonnet-4.5` for agent decision-making. Each agent tick makes one LLM call.
- **Embeddings** — `client.ai.embeddings.create()` with `openai/text-embedding-3-small` for library vector search (inmate's `learn_from_library` action). Also used by `seed-library` to backfill embeddings.
- **Image generation** — `client.ai.images.generate()` with `google/gemini-3-pro-image-preview` for pixel-art sprites and backdrop (run once via `gen-assets`).

### Edge Functions (Deno runtime)

Six functions, all using `npm:@insforge/sdk`:

| Function | Trigger | Purpose |
|---|---|---|
| `advance-world` | Each turn | Increment tick, cycle time, roll weather |
| `inmate-tick` | Each turn | LLM-driven inmate decision + dispatch |
| `friend-tick` | Each turn | LLM-driven friend decision + dispatch |
| `reset-world` | Manual button | Reset all state to initial conditions |
| `seed-library` | One-time setup | Generate vector embeddings for library rows |
| `gen-assets` | One-time setup | Generate pixel-art images, upload to storage |

### Object Storage

- **`game-assets` bucket** — stores generated PNG sprites and backdrop. `gen-assets` uploads here, writes the public URL to the `assets` DB table. The frontend reads URLs from the DB and renders them as `<img>` tags.

## Agent Memory

Each agent maintains a rolling memory in their DB row:
- **`thoughts`** — capped at 10 entries. Added after every action with context about what happened.
- **`recent_actions`** — capped at 10 entries. A shorthand log of actions taken.

Memory is included in the LLM prompt each turn (last 5 thoughts), giving agents continuity across turns. Memory is reset when the world resets.

## Frontend

React 18 + Vite + Tailwind CSS. Deployed to Vercel as a static SPA.

- **Scene** — pixel-art backdrop with sprite characters positioned by location. Uses canvas-based chroma-key processing (`chromaKey.ts`) to remove white backgrounds from AI-generated PNGs. Sprites animate between positions with CSS transitions.
- **WeatherOverlay** — full-screen CSS effects: rain streaks with thunder flashes, fog drift with blur, sun radial glow.
- **AgentHud** — per-agent card showing location, skills, inventory, and last thought.
- **WorldHud** — tick counter, weather, escape progress bar, Next Turn / Reset controls.
- **ActionLog** — scrollable feed of narrated events from `action_log`.

## Project Structure

```
├── src/
│   ├── components/      # React components (Scene, AgentHud, WorldHud, ActionLog, WeatherOverlay)
│   ├── hooks/           # useGameState (turn orchestration + realtime), useChromaSprite
│   ├── lib/             # insforge client, layout constants, chroma-key processing
│   └── types.ts         # Shared TypeScript types
├── insforge/
│   └── functions/       # Six Deno edge functions (advance-world, inmate-tick, etc.)
├── db/
│   ├── schema.sql       # Full DB schema with triggers and seed data
│   └── search-fn.sql    # Vector search RPC function
└── .env.local           # VITE_INSFORGE_URL, VITE_INSFORGE_ANON_KEY
```

## Setup

1. Create an InsForge project and enable the AI gateway with Claude Sonnet, an embedding model, and an image generation model.
2. Run `db/schema.sql` and `db/search-fn.sql` against the project database.
3. Create a `game-assets` storage bucket.
4. Deploy edge functions: `insforge functions deploy <function-name>` for each function in `insforge/functions/`.
5. Invoke `seed-library` once to generate embeddings. Invoke `gen-assets` once to generate sprites.
6. Copy `.env.local` values from the InsForge dashboard.
7. `npm install && npm run dev`
