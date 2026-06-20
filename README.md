# 🦎 Chameleon — Local Hide & Seek

A 3D local multiplayer (pass-and-play) hide-and-seek game inspired by the popular chameleon/spy game trend on social media (Instagram/TikTok). 

Built with **Three.js**, **Vanilla JavaScript**, and **Vanilla CSS (Glassmorphism design system)**, this game runs entirely in the browser. 

---

## 🎮 How the Game Works

The game is designed for **two players on a single device** (laptop/PC).

### Phase 1: Hider Phase 🎨
1. **Explore & Position**: The first player (Hider) moves around the beautiful 3D garden environment using `W`/`A`/`S`/`D` to select a perfect hiding spot.
2. **Lock Position**: Pressing `E` locks the player's position and triggers **Paint Mode**.
3. **Blend In**: Use the advanced pixel-painting tools (Brush, Eyedropper, Fill, Eraser, opacity/size adjustments) to paint the hider's body texture to blend perfectly into the local environment.
4. **Pose Selection**: Choose from 6 different poses (Stand, Crouch, Lie Down, Ball, Flat, Tall) to further match the shape of the environment.
5. **Finish**: Click **Done Hiding** when satisfied.

### Phase 2: Handoff 🤝
* The screen goes into a blurred, secure handoff state. The hider passes the device to the second player (Seeker) without revealing their hiding spot.

### Phase 3: Hunter Phase 🔫
1. **Countdown**: The hunter gets a 3-second countdown to prepare.
2. **Hunt**: The hunter is a walking character armed with a **paint gun**. Move with `WASD` (legs animate), aim with the mouse — a third-person camera trails over the shoulder. The thick fog means you must walk the map to uncover hiding spots.
3. **Shoot**: **Left-click** to fire a paint shot at the crosshair. Tag the hidden player with paint to find them — each shot counts as a guess and leaves a colourful splat where it lands.
4. **Constraints**: The hunter must tag the hider before the timer runs out and within the maximum number of shots/guesses configured on the main menu.

---

## ⚡ How to Run the Game Locally

Because the game uses modern Javascript ES Modules and import maps for loading **Three.js**, opening `index.html` directly from your local filesystem (`file://` protocol) in a browser will be blocked by CORS security policies. 

You **must** serve the files using a local web server. Below are the easiest ways to do this:

### Option A: Using Node.js / npm (Recommended)
If you have Node.js installed, you can spin up a server instantly without installing any global packages:

```bash
# Serve the current directory on port 3000
npx -y serve -l 3000 --cors
```
*Once running, open your browser and navigate to `http://localhost:3000`.*

### Option B: Using Python
If you have Python installed, you can use its built-in HTTP server:

**For Python 3:**
```bash
python -m http.server 8000
```

**For Python 2:**
```bash
python -m SimpleHTTPServer 8000
```
*Once running, open your browser and navigate to `http://localhost:8000`.*

### Option C: VS Code Live Server Extension
If you use Visual Studio Code:
1. Open the project folder in VS Code.
2. Install the **Live Server** extension (by Ritwick Dey).
3. Click the **Go Live** button at the bottom-right corner of the window.

---

## ⌨️ Controls

| Control | Action |
| :--- | :--- |
| `W`, `A`, `S`, `D` / Arrows | Walk (legs animate); a third-person camera trails the character |
| Pose Bar | Pick a pose at any time — available from the start, not just after locking |
| `L` | **Lock** position & open Paint Toolbar — press `L` again to **unlock** and reposition |
| `Right-drag` / `Scroll` | Rotate / zoom while painting |
| `Left Click` | Paint (Paint Mode) / **Shoot the paint gun** (Hunter Phase) |
| Mouse | Aim the paint gun (Hunter Phase) |
| `B` / `I` / `G` / `X` | Quick Paint Toolbar hotkeys (Brush / Eyedropper / Fill / Eraser) |
| `Ctrl + Z` / `Ctrl + Y` | Undo / Redo paint strokes |

> **Walls are solid.** Both the hider and the seeker collide with walls and props — you slide along surfaces instead of passing through them.
>
> **No free map overview.** During the seek phase the fog thickens, so the seeker must physically walk the map to uncover hiding spots rather than scanning everything from the spawn.

---

## 📁 Repository Structure

```
chameleon_game/
├── index.html        # Main HTML layout, screen wrappers & importmap config
├── css/
│   └── styles.css    # Premium HSL-based styling, glassmorphism UI & animations
├── js/
│   ├── main.js       # Main game coordinator (handles state machine, setup, loops)
│   ├── renderer.js   # Three.js renderer setup (lighting, camera, scene, resize)
│   ├── maps.js       # Procedural 3D map generators (Tree, Bush, Bench, Fence, Pond, Path)
│   ├── character.js  # 3D Blob mesh, skeletal poses, canvas texture bindings
│   ├── painter.js    # Paint logic (UV-raycasting, undo/redo state, fill, brush)
│   ├── seeker.js     # Raycasting-based click detector to check guesses
│   ├── ui.js         # DOM management, button bindings, menus, screen changes
│   ├── timer.js      # Circular SVG game timer logic
│   └── audio.js      # Interactive game sound effects & music synthesizer
├── .gitignore        # Files ignored by git (IDE files, local logs, etc.)
└── README.md         # Project documentation (this file)
```

---

## 🛠️ Built With

* **Three.js** - 3D rendering library.
* **HTML5 Canvas** - Used dynamically to paint the hider's body texture in 3D.
* **Vanilla JavaScript** - Core logic, physics raycasting, and state management.
* **Web Audio API** - Custom synthesized sound effects (no external audio files required).
* **Google Fonts** - *Outfit* & *Inter* fonts.
