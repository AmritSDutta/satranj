# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Agent Guidelines & Rules (Strictly Enforced)

- **Token Efficiency**: Agents must work in a highly token-efficient manner. Keep responses concise, direct, and technical without conversational padding.
- **No Subagents**: Do not invoke or spawn subagents without asking for explicit user approval. Perform work directly within the primary conversation context.
- **Git Restrictions**: No `git commit`, `git push`, `git merge`, or `git stash`. Staging, committing, and pushing code is reserved exclusively for the human engineer. Only `git status` (or read-only `git diff` / `git log` when strictly necessary) is allowed.
- **Security & Confidentiality**: Do not peek in `.env*` files (e.g., `.env`, `.env.local`, `.env.example`) or environment variable contents under any circumstances. Never inspect, dump, or log environment variables.

## Project Overview

Satranj is a client-side chess web application built with React and Vite. It runs entirely in the browser with no backend server. The application features:

- **Local PVP mode** and **Stockfish AI** opponent
- **Chess clock** with multiple time controls (Bullet, Blitz, Rapid, Classical)
- **Move history** with position navigation/review
- **Evaluation bar** showing real-time engine analysis
- **Audio effects** using Web Audio API
- **Board themes** (Emerald Green, Classic Wood, Carbon Fiber, Midnight Neon)

## Common Commands

```bash
# Install dependencies
npm install

# Start development server (runs on http://localhost:5173)
npm run dev

# Build for production
npm run build

# Lint code (uses oxlint)
npm run lint

# Preview production build
npm run preview
```

## Architecture

### Directory Structure

```text
satranj/
├── docs/                     # Documentation site (docs7)
│   ├── architecture.mdx
│   ├── components.mdx
│   ├── configuration.mdx
│   ├── custom.css
│   ├── deployment.mdx
│   ├── docs.json
│   ├── features.mdx
│   ├── index.mdx
│   ├── installation.mdx
│   ├── license.mdx
│   └── services.mdx
├── functions/                # Cloudflare Pages Functions
│   └── api/
│       └── proxy.js          # Edge proxy relay for LLM provider API requests
├── public/                   # Static public assets
│   ├── _headers              # Cloudflare edge security & CORS configuration
│   ├── favicon.svg
│   └── icons.svg
├── src/                      # Source code
│   ├── assets/               # Image & icon assets
│   │   ├── hero.png
│   │   ├── react.svg
│   │   └── vite.svg
│   ├── components/           # React UI components
│   │   ├── AboutModal.jsx        # GPL-3.0 compliance & engine attribution modal
│   │   ├── CapturedPieces.jsx    # Visual material tracker & point differential
│   │   ├── ChessClock.jsx        # Turn-synced countdown timers with increments
│   │   ├── CoachDrawer.jsx       # Interactive slide-out tactical coach & WebMCP chat drawer
│   │   ├── Dashboard.jsx         # Main game container, orchestrator, & board view
│   │   ├── EvaluationBar.jsx     # Real-time position advantage gauge
│   │   ├── GameAnalysisModal.jsx # Stockfish post-game analysis, accuracy & SVG chart
│   │   └── MoveHistory.jsx       # Algebraic notation log with position navigation
│   ├── services/             # Core browser services
│   │   ├── audio.js              # Synthesized Web Audio API sound effects
│   │   ├── stockfish.js          # Web Worker wrapper for Stockfish UCI engine
│   │   ├── storage.js            # In-progress game auto-save & resume (localStorage)
│   │   ├── webMcpService.js      # WebMCP server registering tools on window.modelContext
│   │   └── providers/            # Multi-provider LLM engine (Gemini, OpenAI, Ollama)
│   │       ├── types.js          # Provider interfaces & tool calling types
│   │       ├── openAICompatibleProvider.js # Base class for OpenAI-compatible APIs
│   │       ├── geminiProvider.js # Google Gemini provider with native function calling
│   │       └── providerFactory.js # Factory registry (createLlmProvider)
│   ├── utils/                # Utilities
│   │   └── cryptoStorage.js      # AES-GCM-256 Web Crypto vault (satranj_ prefix, IndexedDB key)
│   ├── App.css               # App-level styles
│   ├── App.jsx               # Root component with Faro error boundary
│   ├── index.css             # Design tokens (dark/light themes), coach drawer & global styles
│   └── main.jsx              # Application entry point with Faro telemetry
├── .oxlintrc.json            # Oxlint configuration
├── CLAUDE.md                 # Claude developer guide
├── index.html                # HTML entry template
├── LICENSE                   # GNU General Public License v3.0
├── package.json              # Project scripts & dependencies
├── PLAN_WEBMCP_COACH.md      # WebMCP & LLM Coach architecture specification
├── README.md                 # Project documentation
└── vite.config.js            # Vite build configuration with WebMCP SSE endpoint middleware
```

### Entry Points

- `src/main.jsx` - Application entry point (React root render, Faro RUM telemetry)
- `src/App.jsx` - Root component, renders `Dashboard` wrapped in `FaroErrorBoundary`
- `index.html` - HTML container with `#root` div

### Core Components (`src/components/`)

- **Dashboard.jsx** - Main game container and orchestrator (1000+ lines)
  - Game state management (Chess.js instance, FEN, history)
  - Stockfish AI integration and move calculation
  - Move validation and execution
  - Game mode selection (setup screen) vs active game UI
  - Pause/resume, undo, flip board, restart functionality
  - Game analysis orchestration

- **ChessClock.jsx** - Turn-synced countdown timers
  - 100ms interval accuracy
  - Increment handling (e.g., 3+2 Blitz)
  - Low-time warning under 20 seconds
  - Shows tenths of second when under 10 seconds

- **EvaluationBar.jsx** - Real-time position advantage display
  - Converts centipawns to percentage (mapped to 5-95% range)
  - Mate score display (M#)
  - Handles board flip orientation

- **MoveHistory.jsx** - Algebraic notation log with navigation
  - Click on move to jump to that board position
  - Syncs with board's FEN history
  - Displays classification badges for analyzed games

- **CapturedPieces.jsx** - Visual tracker of captured material
  - Calculates point difference
  - Separate tracking per player

- **GameAnalysisModal.jsx** - Stockfish post-game match analysis modal
  - Multi-position engine evaluations with progress indicator
  - White and Black accuracy scoring (%)
  - Interactive SVG evaluation chart with clickable move points
  - Move quality breakdown (Best, Excellent, Good, Inaccuracy, Mistake, Blunder)
  - Key moments review log

- **AboutModal.jsx** - GPL-3.0 compliance modal
  - Stockfish attribution and links
  - License information

### Services (`src/services/`)

- **stockfish.js** - Stockfish Web Worker wrapper
  - Loads Stockfish from CDN via Blob URL (CORS workaround)
  - UCI protocol communication (`uci`, `position fen ...`, `go depth ...`)
  - Evaluation parsing from `info` lines (score cp/mate)
  - Callbacks for best move and evaluation updates
  - Proper turn-relative score conversion (Stockfish reports relative to active side)

- **audio.js** - Web Audio API sound synthesizer
  - No external audio files - all sounds synthesized
  - Triangle/sine/sawtooth waveforms with envelope shaping
  - Methods: `playMove()`, `playCapture()`, `playCheck()`, `playGameOver()`

- **webMcpService.js** - WebMCP engine and browser tools
  - Registers 5 tools on `window.modelContext`, `document.modelContext`, and `navigator.modelContext`:
    - `post_chat_message`: Delivers tactical coaching advice, candidate moves, and square highlights/arrows to the drawer and board
    - `get_game_state`: Active board position, FEN, turn, move history, and clock times
    - `get_legal_moves`: Computes legal moves for active turn (with optional square filter)
    - `get_position_analysis`: Queries Stockfish engine for evaluation score, best move, and principal variation (PV)
    - `highlight_board`: Paints threat squares and directional arrows on the board
  - Manages in-memory message inbox and subscriber stream

- **storage.js** - Game persistence
  - Auto-saves running game snapshots on every move, pause, or `beforeunload`
  - Rehydrates game state on setup screen via "Resume Saved Game" card in a paused state
  - Automatically disposes of saved games on checkmate, draw, stalemate, or clock timeout

- **cryptoStorage.js** - Encrypted credential vault
  - AES-GCM-256 encryption via native Web Crypto API (`window.crypto.subtle`)
  - Non-extractable master key stored in IndexedDB (`SatranjSecureVault`)
  - All stored settings and API keys are namespaced with the `satranj_` prefix

- **providers/** - Multi-provider LLM engine
  - Unified `ILlmProvider` contract for Google Gemini, OpenAI, Ollama, Mistral, and Requesty
  - Client-side function calling mapping to WebMCP tools
  - Proxy relay routing via `/api/proxy` for CORS bypass

### Cloudflare Pages & Edge Proxy

- `functions/api/proxy.js` runs on Cloudflare Pages Functions to securely relay external LLM API calls in production
- `vite.config.js` provides development server parity for `/api/proxy`, `/api/mcp/sse`, `/api/mcp/message`, and `/api/mcp/state`
- `public/_headers` configures Cloudflare edge security headers and restricts CORS to `/api/*`

### Key Dependencies

- `chess.js` - Chess logic, move validation, FEN generation, game-over detection
- `react-chessboard` - Interactive board component (v5 API uses `onPieceDrop`)
- `lucide-react` - Icon set

### Game State Flow

1. **Setup Screen** (`gameStarted = false`): User selects mode, color, time control, difficulty
2. **Active Game** (`gameStarted = true`): 
   - Chess.js instance holds current position
   - `historyFens[]` stores FEN for each move (for navigation)
   - `activeMoveIndex` tracks current viewing position
   - Stockfish evaluates after each move (or calculates best move for AI)

3. **Move Execution**:
   - `onPieceDrop` callback → validates move conditions
   - `executeMove()` → creates new Chess instance, attempts move
   - On success: plays sound, updates state, appends to FEN history
   - AI mode: triggers Stockfish `calculateBestMove()`

4. **AI Move**:
   - Stockfish returns UCI move (e.g., `e2e4`, `a7a8q`)
   - `makeAIMove()` parses UCI → calls `executeMove()`

### Important Patterns

- **Immutable Game Updates**: Always create new `Chess()` instance from FEN rather than mutating existing
- **Stockfish Turn Handling**: Engine evaluations are relative to active side; convert to absolute (positive=White) by checking turn
- **Review Mode Blocking**: Drag moves disabled when `activeMoveIndex !== historyFens.length - 1`
- **CORS Workaround**: Stockfish loaded via `Blob` + `importScripts()` due to CDN restrictions

## Styling

- CSS files: `src/index.css`, `src/App.css`
- Dark dashboard aesthetic with glassmorphism panels
- CSS variables for theming (defined in `src/index.css`)
- Responsive grid layout with `dashboard-grid` class
