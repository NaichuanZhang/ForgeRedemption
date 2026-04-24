# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Vite dev server (React frontend)
npm run build      # TypeScript check + Vite production build
npm run typecheck  # TypeScript only (no emit)
```

Edge functions are deployed via InsForge CLI (`insforge functions deploy <name>`), not built locally. They run on Deno and import from `npm:@insforge/sdk`.

## Environment

Frontend requires two env vars in `.env.local`:
- `VITE_INSFORGE_URL` — InsForge project base URL
- `VITE_INSFORGE_ANON_KEY` — anon JWT for client-side SDK

Edge functions receive `INSFORGE_BASE_URL` and `ANON_KEY` from the InsForge runtime automatically.

## Architecture

This is a **multi-agent prison-break demo** — a turn-based game where two LLM-driven agents (an Inmate and an Outside Friend) cooperate to execute an escape. The frontend is a React SPA that visualizes the game; all game logic runs server-side in InsForge edge functions.

### Turn loop

Each "Next Turn" click triggers three sequential edge function calls:
1. **advance-world** — increments tick, cycles time-of-day, rolls random weather
2. **inmate-tick** — LLM (Claude Sonnet) decides one action for the inmate (move, learn, dig, pickup)
3. **friend-tick** — LLM decides one action for the friend (walk, buy hammer, drop in yard)

After each call, the frontend refreshes state from the database. The frontend also subscribes to InsForge realtime channel `game:world` for live updates via DB triggers.

### Agent decision pattern

Both agent tick functions follow the same structure:
1. Read current game_state + agent row from DB
2. Build a system prompt defining available skills and constraints
3. Call `client.ai.chat.completions.create()` with the game context
4. Parse JSON response via `extractJson()` (with fallback default action)
5. `dispatch()` validates preconditions (location, skill ownership, weather) and mutates DB
6. Append to `action_log` for narration

### Key game rules encoded in dispatch logic

- **Inmate** can only `dig` when weather is `rain` (noise cover). Digging from cell gains 10% progress bare-handed, 30% with hammer.
- **Inmate** learns the `dig` skill by visiting the library and querying topics matching `digging-technique-*`.
- **Friend** smuggles a hammer via: shop → buy_hammer → yard → drop_in_yard → inmate picks up from dropbox.
- Library search uses pgvector cosine similarity (`search_library` RPC) with text-embedding-3-small, falling back to keyword ILIKE if embeddings aren't available.
- Game ends at 100% escape_progress (status → 'escaped').

### Frontend layers

- **Scene** — pixel-art backdrop with positioned sprites. Sprite positions map from `Location` → percentage X via `LOCATION_X` in `lib/layout.ts`. Uses canvas-based chroma key (`lib/chromaKey.ts`) to remove white backgrounds from generated sprite PNGs.
- **WeatherOverlay** — CSS animations for rain streaks, fog blur, sun glow based on `state.weather`.
- **AgentHud** (x2) — shows each agent's location, skills, inventory, last thought.
- **WorldHud** — tick/weather display, escape progress bar, Next Turn / Reset buttons.
- **ActionLog** — scrollable narration feed from `action_log` table.
- **useGameState** — central hook: loads initial state, manages realtime subscription, orchestrates turn execution.

### Database (Postgres via InsForge)

Schema in `db/schema.sql`. Single `game_state` row (id=1). Two `agents` rows (inmate, friend). `library` table with pgvector embeddings for RAG. `action_log` is append-only. `assets` maps sprite keys to storage URLs. All tables have realtime broadcast triggers publishing to channel `game:world`.

### Edge functions (`insforge/functions/`)

| Function | Purpose |
|---|---|
| advance-world | Tick clock, roll weather |
| inmate-tick | LLM-driven inmate action |
| friend-tick | LLM-driven friend action |
| reset-world | Reset all state to initial |
| seed-library | Backfill pgvector embeddings for library rows |
| gen-assets | Generate pixel-art sprites/backdrop via AI image gen, upload to storage |

All functions use Deno imports (`npm:@insforge/sdk`), return CORS-enabled JSON responses, and handle OPTIONS preflight.

## Conventions

- Tailwind CSS for all styling (no CSS modules). Pixel-art font "Press Start 2P" available via `font-pixel` class.
- Types are centralized in `src/types.ts`.
- InsForge client singleton in `src/lib/insforge.ts` (also exposed on `window.insforge` for debugging).
- Frontend deployed to Vercel as static SPA with catch-all rewrite (`vercel.json`).
