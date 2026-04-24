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

Edge functions receive `INSFORGE_BASE_URL` and `ANON_KEY` from the InsForge runtime automatically. The `friend-tick` function also requires `TINYFISH_API_KEY` for web search.

## Architecture

This is a **multi-agent prison-break demo** — a turn-based game where four LLM-driven agents (Inmate, Inmate #2, Outside Friend, Guard) interact. The frontend is a React SPA that visualizes the game; all game logic runs server-side in InsForge edge functions.

### Turn loop

Each "Next Turn" click triggers five sequential edge function calls:
1. **advance-world** — increments tick, cycles time-of-day, rolls random weather, enforces night curfew
2. **inmate-tick** — LLM (Claude Sonnet) decides one action for inmate (walk, learn, dig, pickup)
3. **inmate2-tick** — LLM decides one action for inmate #2 (same skill set)
4. **friend-tick** — LLM decides one action for the friend (walk, buy hammer, drop at gate, search web, create distraction)
5. **guard-tick** — LLM decides one action for the guard (patrol, slack off)

After each call, the frontend refreshes state from the database. The frontend also subscribes to InsForge realtime channel `game:world` for live updates via DB triggers. Auto-play mode fires turns every 1.5s.

### Agent decision pattern

All agent tick functions follow the same structure:
1. Read current game_state + agent row from DB
2. Build a system prompt defining available skills and constraints
3. Call `client.ai.chat.completions.create()` with the game context
4. Parse JSON response via `extractJson()` (with fallback default action)
5. `dispatch()` validates preconditions (location, skill ownership, weather, guard position) and mutates DB
6. Append to `action_log` for narration

### Key game rules encoded in dispatch logic

- **Inmates** can only `dig` when: they have the `dig` skill + hammer + rain + night + in cell + guard not at cell. With `distraction_active`, evening also works.
- **Inmates** learn the `dig` skill by visiting the library and querying topics matching `digging-technique-*`.
- **Friend** smuggles hammers via: shop → buy_hammer → gate → drop_at_gate → inmates pick up from dropbox at yard.
- **Friend** can visit the portal to `search_web` using TinyFish Search API. If results match distraction keywords, the Friend learns `create_distraction`.
- **Friend's `create_distraction`** at the gate sets `world.distraction_active = true`, allowing inmates to dig during evening (not just night). Consumed after one successful dig.
- **Guard** patrols during the day, blocks digging when at cell. Auto-slacks at night.
- Library search uses pgvector cosine similarity (`search_library` RPC) with text-embedding-3-small.
- Game ends at 100% escape_progress (status → 'escaped').

### Frontend layers

- **Scene** — top-down pixel-art map with sprites positioned via `LOCATION_POS` in `lib/layout.ts`. Uses `offsetPos()` for collision avoidance. Canvas-based chroma key (`lib/chromaKey.ts`) removes white backgrounds. Thought bubbles above each sprite.
- **WeatherOverlay** — CSS animations for rain streaks, fog blur, sun glow.
- **AgentHud** (x4) — shows each agent's location, skills, inventory, last thought.
- **WorldHud** — tick/weather display, escape progress bar, Next Turn / Auto / Reset controls.
- **ActionLog** — scrollable narration feed from `action_log` table.
- **useGameState** — central hook: loads initial state, manages realtime subscription, orchestrates turn execution and auto-play.

### Database (Postgres via InsForge)

Schema in `db/schema.sql`. Single `game_state` row (id=1) with world blob containing `distraction_active`. Four `agents` rows (inmate, inmate2, friend, guard). `library` table with pgvector embeddings for RAG. `action_log` is append-only. `assets` maps sprite keys to storage URLs. All tables have realtime broadcast triggers publishing to channel `game:world`.

### Edge functions (`insforge/functions/`)

| Function | Purpose |
|---|---|
| advance-world | Tick clock, roll weather, enforce curfew |
| inmate-tick | LLM-driven inmate action |
| inmate2-tick | LLM-driven inmate #2 action |
| friend-tick | LLM-driven friend action (includes TinyFish Search API) |
| guard-tick | LLM-driven guard patrol |
| reset-world | Reset all state to initial |
| seed-library | Backfill pgvector embeddings for library rows |
| gen-assets | Generate pixel-art sprites/backdrop via AI image gen, upload to storage |

All functions use Deno imports (`npm:@insforge/sdk`), return CORS-enabled JSON responses, and handle OPTIONS preflight.

## Conventions

- Tailwind CSS for all styling (no CSS modules). Pixel-art font "Press Start 2P" available via `font-pixel` class.
- Types are centralized in `src/types.ts`.
- InsForge client singleton in `src/lib/insforge.ts` (also exposed on `window.insforge` for debugging).
- Frontend deployed to Vercel as static SPA with catch-all rewrite (`vercel.json`).
- Locations use 2D `Point` coordinates (`{x, y}` percentages) for the top-down map layout.
