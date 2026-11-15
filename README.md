# PROJECT SELENE — Lunar South Pole Landing-Site Navigator
### NASA Space Apps Hackathon // Cinematic 3D Mission Gateway

[![React](https://img.shields.io/badge/React-18.3-61dafb?logo=react&logoColor=black)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-0.160+-black?logo=three.js)](https://threejs.org/)
[![React Three Fiber](https://img.shields.io/badge/R3F-8.15+-black)](https://docs.pmnd.rs/react-three-fiber/)
[![GSAP](https://img.shields.io/badge/GSAP-3.12-green?logo=greensock)](https://greensock.com/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8?logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

An ultra-realistic, cinematic 3D introductory portal and landing-site evaluation gateway for **Project Selene — NASA Lunar South Pole Mission Control**.

---

## 📑 Table of Contents

- [1. Mission Overview & Concept](#1-mission-overview--concept)
- [2. End-to-End System Pipeline Flow](#2-end-to-end-system-pipeline-flow)
- [3. Cinematic Animation Design & Timeline](#3-cinematic-animation-design--timeline)
- [4. The Five Core Scientific Constraints](#4-the-five-core-scientific-constraints)
- [5. UI/UX Architecture & Design Philosophy](#5-uiux-architecture--design-philosophy)
- [6. Audio Engine & Narration System](#6-audio-engine--narration-system)
- [7. Technical Stack & 3D Shaders](#7-technical-stack--3d-shaders)
- [8. Step-by-Step Setup & Run Pipeline](#8-step-by-step-setup--run-pipeline)
- [9. Configuration & Mission Control Handoff](#9-configuration--mission-control-handoff)
- [10. GitHub Deployment Guide](#10-github-deployment-guide)

---

## 1. Mission Overview & Concept

Landing humans and robotic landers at the lunar South Pole is one of the most demanding engineering challenges in aerospace history. Unlike Apollo equatorial missions that touched down on flat basaltic plains under gentle overhead sunlight, the lunar South Pole presents:
- **Extreme topographic relief**: ~9 km elevation delta between towering massifs and crater floors.
- **Low grazing sunlight**: Solar elevation angles skimming the horizon at <1.5°.
- **Cryogenic cold-traps**: Permanently Shadowed Regions (PSRs) at temperatures below 40 Kelvin holding billions of tons of water-ice volatiles.
- **Near-horizon Earth visibility**: Libration oscillations risking direct line-of-sight communication blackouts.

**Project Selene** was engineered to navigate and evaluate these parameters. This web application serves as the **cinematic gateway** that introduces visitors to the scientific mission before transitioning into the live Mission Control evaluation application.

---

## 2. End-to-End System Pipeline Flow

The diagram below details the execution lifecycle from page load to mission control handoff:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        1. APPLICATION BOOTSTRAP                        │
│  - WebGL capability detection (FallbackView if unsupported)            │
│  - Pre-parse LOLA topography & genuine NASA LRO texture maps           │
│  - LoadingScreen displays calibration progress & diagnostic logs       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ User clicks "START LUNAR APPROACH"
                                    ▼ (User gesture unlocks Web Audio API & Speech)
┌────────────────────────────────────────────────────────────────────────┐
│                  2. AUDIO & SPEECH SYNTHESIS LAUNCH                    │
│  - AudioContext instantiated and resumed                               │
│  - Interstellar ambient drone synthesized (43.65Hz + 65.41Hz LFO pad)  │
│  - Voice narration scheduled via Web Speech API                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  3. GSAP CINEMATIC TRAJECTORY TIMELINE                 │
│  - 0–1s: Deep space celestial void & distant Milky Way spiral          │
│  - 1–2s: Earth transit & orchestral swell + voice narration line 1     │
│  - 2–5s: Spacecraft burns thrusters; accelerates towards the Moon      │
│  - 5–7s: Close orbital descent; LOLA crater relief & terminator shadows│
│  - 7–9s: Geodetic beacon acquisition, coordinates & telemetry          │
│  - 9–10s: Asymmetrical hero framing transition                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                4. INTERACTIVE HERO & FREE 3D EXPLORATION               │
│  - OrbitControls enabled (visitor can freely rotate & zoom the Moon)   │
│  - 6 Candidate Landing Sites clickable (Shackleton, Malapert, Nobile…) │
│  - Interactive 5 Scientific Constraints Storytelling Dossier           │
│  - Real-time Topographic Elevation Contours toggle (wireframe mode)    │
│  - HUD Controls (🔊 Audio toggle, 📻 Voice toggle, 🔄 Replay Voice)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Visitor clicks "ENTER MISSION CONTROL"
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               5. MISSION CONTROL DASHBOARD HANDOFF                     │
│  - Launches deployed Mission Control application in a new tab:         │
│    https://ais-pre-wuocrxlmlpkpc6ew4wveaa-207098358091.asia-northeast1.run.app/#home │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Cinematic Animation Design & Timeline

The cinematic director runs on a calibrated **9.5-second GSAP timeline** designed to emphasize astronomical scale:

| Time | Phase ID | Visual Scene | Audio & Narration Event |
|---|---|---|---|
| **0.0 – 1.0s** | `deep_space` | Distant stars (`5,000` particle field) + distant Milky Way spiral at `opacity=0.55` | Subtle deep-space sub-bass drone (73.4Hz/110Hz/146.8Hz) |
| **1.0 – 2.0s** | `earth_reveal` | Camera glides past Earth in the mid-ground. Galaxy fades to `0.22` | Warm triangle string swell + Narration: *"The Moon's south pole holds extraordinary possibilities."* |
| **2.0 – 5.0s** | `lunar_approach` | Spacecraft thrusters burn; rapid approach towards the Moon. Galaxy fades to `0.05` -> `0.0` | Sub-bass crescendo rumble + Narration: *"But choosing where to land is no simple task."* |
| **5.0 – 7.0s** | `lunar_surface` | Low orbital descent over South Pole; crater relief, terminator contrast, and elevation contours | Radar scanning pulses + Narration: *"Before we land, we need to understand the terrain."* |
| **7.0 – 9.0s** | `site_targeting` | 3D geodetic survey pins, coordinates, and beacons appear on candidate sites | Ascending major triad confirmation tones (C5, E5, G5) |
| **9.0 – 10.0s**| `hero_active` | Asymmetrical framing: Moon anchors the right 60% of viewport; hero copy anchors the left | Sub-bass impact thud transitioning into calm ambient loop |

> **Astronomical Realism Guarantee**: The Milky Way galaxy is rendered deep in background coordinate space (`[-20, 15, -160]`). The Moon is never positioned inside the galaxy. As the camera approaches the Moon, the galaxy fades out completely, leaving the lunar surface set against the pure, natural black astronomical void.

---

## 4. The Five Core Scientific Constraints

Project Selene's evaluation engine centers around five fundamental parameters. Clicking any constraint in the hero strip opens a dedicated interactive dossier with technical schematic diagrams:

### 1. Terrain & Elevation
- **Why It Matters**: The Moon's South Pole has extreme elevation differences (up to 9 km between high peaks and deep depressions), causing hazardous slopes and sharp shadowing.
- **Dataset**: Lunar Orbiter Laser Altimeter (LOLA) 50m precision elevation grids.
- **Diagram**: Custom SVG topographic cross-section illustrating peak massifs (+5.0 km), deep crater depressions (-4.2 km), and safe landing plateaus (<8° slope).

### 2. Sunlight Conditions
- **Why It Matters**: Due to the Moon's 1.54° axial tilt, sunlight strikes at grazing angles (<1.5°). Elevated peaks receive 86%–92% sunlight for power, while nearby crater floors sit in permanent cryogenic darkness.
- **Physics**: Solar elevation vectors, thermal cold-traps (<40 Kelvin), and shadow cone modeling.
- **Diagram**: Grazing solar vector rays illuminating rim crests while casting deep shadow cones into crater cold-traps.

### 3. Earth Visibility
- **Why It Matters**: Telemetry requires direct line-of-sight (LOS) to Earth. Because the South Pole is near the lunar limb, Earth hovers close to the horizon and can be occulted by local mountains or lunar libration (±6.7°).
- **Physics**: Earth geometric elevation angle, lunar libration in latitude/longitude, and mountain horizon masking.
- **Diagram**: Direct line-of-sight vector from elevated promontories (Malapert Massif) to the Earth disc hovering near the horizon.

### 4. Communication Windows
- **Why It Matters**: Eliminating signal blackouts during powered descent is critical for lander survival and remote human intervention.
- **Systems**: NASA Deep Space Network (DSN) Goldstone, Madrid, and Canberra stations via S-band, X-band, and Ka-band links.
- **Diagram**: High-frequency microwave link beam connecting Earth DSN antennas directly to the lander receiver.

### 5. Landing Safety
- **Why It Matters**: Typical lunar landers require surface slopes under 8° to avoid tipping upon leg touchdown, as well as clearance from meter-scale boulder fields.
- **Safety Envelope**: <8° slope limit, 100m–300m designated landing ellipse, and autonomous Terrain Relative Navigation (TRN).
- **Diagram**: Touchdown stability comparison between stable plateau slopes and hazardous crater wall scarps (>25°).

---

## 5. UI/UX Architecture & Design Philosophy

- **Aerospace Minimalist Aesthetic**: Designed to evoke real mission control interfaces. Zero generic gradients, zero excessive glassmorphism, and zero neon clutter.
- **Typography**:
  - Display / Headlines: `Inter` (Font-weight: 800) for punchy editorial hierarchy.
  - Telemetry & Coordinates: `JetBrains Mono` for precise geodetic readouts.
- **Asymmetrical Composition**: On desktop viewports, the camera centers the Moon in the right 60% of the screen, allowing headlines, CTAs, and telemetry to breathe naturally on the left.
- **Accessibility & Motion Preference**:
  - Respects `prefers-reduced-motion`: Visitors with motion sensitivity jump immediately to the interactive hero state.
  - Full WebGL fallback (`FallbackView.tsx`) for low-end hardware without GPU acceleration.

---

## 6. Audio Engine & Narration System

The audio architecture (`src/utils/soundEngine.ts`) is 100% self-contained using modern web APIs:

1. **Zero External Audio Dependencies**:
   All ambient cosmic pads, thruster noise bursts, telemetry confirmation chirps, and impact thuds are synthesized in real-time via the **Web Audio API** (`OscillatorNode`, `BiquadFilterNode`, `GainNode`).
2. **Automatic Documentary Narration**:
   Uses the browser's built-in **Web Speech API** (`window.speechSynthesis`).
   - *Natural Speech Delivery*: Auto-selects English natural voices, tuned for documentary cadence (`rate: 0.84`, `pitch: 0.88`).
   - *No Microphone Input*: Purely audio output; zero microphone permissions requested.
   - *Autoplay Policy Compliance*: Audio Context resumes automatically upon the visitor clicking the "START LUNAR APPROACH" loading screen button.
3. **Controls**:
   - 🔊 **`AUDIO`**: Toggle synthesized cosmic background and thruster sounds.
   - 📻 **`VOICE`**: Toggle voice-over narration.
   - 🔄 **`REPLAY VOICE`**: Dedicated button in the HUD to replay the documentary voice narration anytime.
   - ⏩ **`SKIP`**: Stops all audio synthesis immediately and cleanly cancels ongoing speech synthesis.

---

## 7. Technical Stack & 3D Shaders

| Technology | Purpose |
|---|---|
| **React 18 + TypeScript** | Application state, component lifecycle, strict type checking |
| **Three.js + R3F + Drei** | WebGL scene graph, camera director, and orbit interaction |
| **GSAP (GreenSock)** | High-precision cinematic timeline with sub-millisecond event synchronization |
| **Tailwind CSS** | Aerospace design system, responsive layouts, HUD telemetry styling |
| **Lucide Icons** | Minimalist technical icons |
| **Custom GLSL Shaders** | 48,000 particle Milky Way spiral shader with logarithmic spiral arms and distance attenuation |
| **Real NASA Textures** | High-resolution Lunar Reconnaissance Orbiter (LRO) surface maps and LOLA bump maps |

---

## 8. Step-by-Step Setup & Run Pipeline

### Prerequisites
- [Node.js](https://nodejs.org/) v18.0.0 or higher
- `npm` (bundled with Node.js)

### 1. Extract & Open Project
Extract the ZIP archive and open a terminal inside the project directory:
```bash
cd project-selene-landing-page
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Launch Development Server
```bash
npm run dev
```
Open **`http://localhost:5173`** in your browser.

### 4. Build for Production
To verify and create an optimized production bundle:
```bash
npm run build
```
The compiled, minified bundle will be generated in `dist/`.

### 5. Preview Production Build Locally
```bash
npm run preview
```

---

## 9. Configuration & Mission Control Handoff

The application integrates with the team's separate Mission Control evaluation dashboard. The destination URL is managed in:

`src/config/missionConfig.ts`

```typescript
// Mission Control Application Gateway URL
export const MISSION_CONTROL_URL: string = "https://ais-pre-wuocrxlmlpkpc6ew4wveaa-207098358091.asia-northeast1.run.app/#home";
```

Clicking **`ENTER MISSION CONTROL`** on the landing page opens this URL directly in a new tab without modifying or interfering with the dashboard application.

---

## 10. GitHub Deployment Guide

To push this project to a new GitHub repository:

```bash
# 1. Initialize local Git repository
git init

# 2. Stage all project files (.gitignore will exclude node_modules & dist)
git add .

# 3. Create initial commit
git commit -m "feat: Project Selene cinematic 3D landing page"

# 4. Set main branch
git branch -M main

# 5. Link to your remote GitHub repository
git remote add origin https://github.com/<your-username>/<your-repo-name>.git

# 6. Push code to GitHub
git push -u origin main
```

---

### 👥 Team & Mission Attribution
* **Project**: Project Selene — Lunar South Pole Landing-Site Navigator
* **Challenge**: NASA Space Apps Challenge — Lunar Landing Site Evaluation
* **NASA Data Sources**: NASA Lunar Reconnaissance Orbiter (LRO) & Lunar Orbiter Laser Altimeter (LOLA)
