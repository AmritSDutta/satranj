# Satranj

**Satranj** is a premium, client-side serverless chess web application built in React and Vite. It is styled with modern dark dashboard aesthetics, glassmorphism panels, and glowing neon accents. It features localized player-vs-player matches, customizable chess clocks, Synthesized Web Audio API sound effects, and an offline **Stockfish AI** engine running directly inside the browser using WebAssembly.

## Features

- **Dual Game Modes**: Play local hotseat PVP or play against Stockfish AI.
- **Difficulty Slider**: Adjust Stockfish depth from level 2 to 15.
- **Live Evaluation Bar**: Displays real-time centipawns or mate advantages from the engine.
- **Move Log History**: Tracks full algebraic move notations and supports navigating past moves to review the board.
- **Chess Clock**: Turn-synced clocks supporting Bullet (1+0), Blitz (3+2, 5+0), Rapid (10+0), and Classical (30+0). Timers show tenth-of-a-second precision under 10 seconds.
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
