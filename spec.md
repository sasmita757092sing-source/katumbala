# Katumbala Game

## Current State
New project. No existing code.

## Requested Changes (Diff)

### Add
- A fully playable Katumbala (Snake-style) 2D browser game
- Canvas-based game board rendered with HTML5 Canvas API
- Snake that moves in 4 directions (arrow keys / WASD)
- Food items that the snake eats to grow
- Score tracking (current score + high score saved in backend)
- Game states: Start screen, Playing, Game Over
- Speed increases as score increases (difficulty progression)
- Touch/mobile controls (swipe or on-screen buttons)
- Pause functionality

### Modify
- N/A (new project)

### Remove
- N/A (new project)

## Implementation Plan
1. Backend: Store high scores per session using Motoko
2. Frontend: Canvas-based game using requestAnimationFrame
   - Game loop with time-based movement
   - Snake entity: position array, direction, growth logic
   - Food spawning at random positions
   - Collision detection (walls + self)
   - Score display and high score persistence
   - Start screen with instructions (Hindi + English)
   - Game over screen with restart button
   - On-screen D-pad for mobile
   - Keyboard controls (arrow keys + WASD)
