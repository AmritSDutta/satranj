# Satranj

**Satranj** is a premium, client-side serverless chess web application built in React and Vite. It is styled with modern dark dashboard aesthetics, glassmorphism panels, and glowing neon accents. It features localized player-vs-player matches, customizable chess clocks, Synthesized Web Audio API sound effects, and an offline **Stockfish AI** engine running directly inside the browser using WebAssembly.

## Features

- **AI Grandmaster Tactical Coach (WebMCP)**: Slide-out coaching drawer capable of answering tactical questions, analyzing positions with Stockfish, and recommending candidate moves with interactive board tints and directional arrows.
- **WebMCP & SSE Bridge**: Standardized browser tools registered on `window.modelContext` and `/api/mcp/sse` endpoint for external AI agent integration.
- **Multi-Provider LLM Engine**: Bring your own API key for Google Gemini, OpenRouter (reasoning-enabled), Nebius Token Factory, OpenAI, or a local Ollama instance, with a CORS-free proxy relay at the Cloudflare edge.
- **Encrypted Credential Vault**: Browser-side AES-GCM-256 encryption via native Web Crypto API with non-extractable keys in IndexedDB (`satranj_` namespace).
- **Game State Auto-Save & Resume**: Active matches are automatically saved to local storage on every move and on page unload, and can be resumed with clocks preserved in a paused state. Cleared on checkmate, draw, or fresh game.
- **Post-Game Match Analysis**: Complete engine evaluation with White and Black accuracy scores, an interactive SVG advantage chart, and move classifications (Best, Excellent, Inaccuracy, Mistake, Blunder).
- **Dual Game Modes**: Play local hotseat PVP or play against Stockfish AI.
- **Difficulty Slider**: Adjust Stockfish depth from level 2 to 15.
- **Live Evaluation Bar**: Displays real-time centipawns or mate advantages from the engine.
- **Move Log History**: Tracks full algebraic move notations and supports navigating past moves to review the board.
- **Chess Clock**: Turn-synced clocks with Rapid (10+0) and Classical (30+0) presets plus a no-clock casual option. Timers show tenth-of-a-second precision under 10 seconds.
- **Captured Material Tracking**: Visualizes captured pieces and lists the point difference.
- **Synthesized Audio Effects**: Uses the Web Audio API to play responsive sounds for moves, captures, checks, and game-over outcomes with zero latency.
- **Visual Board Customization**: Offers beautiful board themes (Emerald Green, Classic Wood, Carbon Fiber, and Midnight Neon).
- **Flip Board**: Instantly swap board perspective between White and Black.

## Installation & Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173` in your browser.

## Rendering the Docs Locally (docs7)

To preview the documentation site locally using the docs7 renderer:

1. Install docs7 globally (if not already installed):
   ```bash
   npm install -g @upstash/docs7
   ```
2. Run the docs7 development server, pointing at your docs directory:
   ```bash
   docs7 dev ./docs --port 4000
   ```
3. Open `http://localhost:4000` in your browser to view the rendered documentation.

> **Note**: The `--port` flag specifies the port for the dev server. Use `docs7 dev --help` for additional options.

## Legal and GPL Compliance (Stockfish Licensing)

Satranj is released under the **GNU General Public License v3 (GPL-3.0)**. A copy of the license is included in the project's root folder under the file `LICENSE`.

### Stockfish Attribution
This application integrates the **Stockfish Chess Engine** as an artificial intelligence player. 
- **Stockfish** is licensed under the GPL-3.0 license. The official source code repository is available at [github.com/official-stockfish/Stockfish](https://github.com/official-stockfish/Stockfish).
- **Stockfish.js** (the WebAssembly / JavaScript compiler port) is compiled by Niklas Rugg and is licensed under the GPL-3.0 license. The source code repository is available at [github.com/nmrugg/stockfish.js](https://github.com/nmrugg/stockfish.js).

In compliance with the GPL-3.0 license:
1. The full source code for this client-side application is available to all users.
2. The user interface includes an **"About & Licenses" Info Modal** that outlines user rights, attributes Stockfish, and links directly to the engine source code repositories.
3. This software is provided "as is", without any warranties of any kind (per GPL-3.0 Sections 15 & 16).
