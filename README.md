# Chrono Atelier — 3D Clock Designer

An interactive, zero-asset 3D horology studio where users craft a bespoke wall or desk clock running on real local time, customize materials and engine-turned dials in real time, and get live INR (`₹`) pricing.

**Live Demo:** [https://chrono-atelier.vercel.app](https://chrono-atelier.vercel.app) *(placeholder — replace after deploying to Vercel)*

---

## Screenshots

| Front Studio View | Side & A-Frame Stand Profile | Mobile Configurator (`390px`) |
| :---: | :---: | :---: |
| ![Front View Placeholder](./docs/screenshots/front-view.png) | ![Side View Placeholder](./docs/screenshots/side-view.png) | ![Mobile View Placeholder](./docs/screenshots/mobile-view.png) |
| *18k Rose Gold hexagon · Midnight Navy sunburst* | *25° A-frame desk brace & engraved caseback* | *55vh touch viewport & sticky pricing bar* |

---

## Features

- **100% Procedural 3D Horology (Zero External Models):** Every case profile, bevelled bezel ring, crystal lens, hand silhouette, caseback screw, and A-frame desk stand is generated mathematically in code.
- **Parametric Case Profiles & Bezel Gauge:** Switch smoothly between **Round**, **Cushion Square**, and **Flat-Top Hexagon** silhouettes with a continuous bezel thickness slider (`0.10–0.45`) that rebuilds and disposes GPU geometries leak-free.
- **Six Physically Based Case Materials:** **18k Gold**, **18k Rose Gold**, **316L Steel**, **PVD Matte Black**, **American Black Walnut** (seamless procedural wood-grain canvas texture), and **High-Gloss Ceramic** illuminated by a custom multi-panel studio HDRI `<Environment>`.
- **Dynamic `1024×1024` Dial Studio:**
  - **Finishes:** Matte **Plain**, radial brushed **Sunburst**, and engine-turned **Guilloché** wave rosettes.
  - **Typography & Indices:** **Dots**, **Sticks**, **Arabic** (`Inter`), and **Roman** (`Cinzel`) numerals, optional outer minute track, WCAG luminance-based auto-ink contrast, and custom letterpress dial engraving (`+₹150`).
- **Mechanical & Quartz Hand Calibres:**
  - **Silhouettes:** **Classic** tapered baton, **Bold** rounded bar, and **Sword** leaf hands scaled automatically to the inner bezel aperture.
  - **Motion Modes:** Continuous **Smooth Sweep** (`60fps`) or **Quartz Tick** (`~80ms` underdamped spring snap synchronized to `Date` with zero drift).
- **Wall & Desk Mounting Systems:**
  - **Wall Mode:** Constrained front viewing arc (`±0.9 rad` azimuth), gentle `~8s` sinusoidal auto-swing, and camera-angle-attenuated circular wall shadow.
  - **Desk Stand (`+₹400`):** `6°` backward clock tilt resting flush on a `+10%` wider architectural plinth (walnut or honed dark stone) braced by a `25°` backward-angled A-frame rear support, revealing the engraved `"CHRONO ATELIER · No. 001"` caseback and 4 watchmaker screws over full `360°` orbit.
- **Instant Sharing & Studio Export:**
  - **Share Link (`#d=...`):** Encodes the entire 14-field configuration as compact URL-safe Base64 in the URL hash with strict field-by-field validation on load.
  - **Download PNG (`2×`):** Renders a crisp `2×` supersampled frame to `chrono-atelier-design.png`.
  - **Copy Design JSON & Curated Presets:** One-click **Classic**, **Minimal**, **Luxury**, and **Workshop** signature configurations.
- **Mobile-Tuned Performance (`<820px`):** `55vh` touch-orbit/pinch canvas, sticky price footer with compact `⋯` action menu, capped `1.5` DPR, `1024px` shadow maps, and reduced bevel tessellation for steady `50–60+ fps`.

---

## Tech Stack

- **UI & State:** [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Zustand](https://zustand-demo.pmnd.rs/)
- **3D Rendering:** [Three.js](https://threejs.org/) + [React Three Fiber](https://r3f.docs.pmnd.rs/) + [@react-three/drei](https://drei.docs.pmnd.rs/) (`OrbitControls`, `Environment`, `Lightformer`, `ContactShadows`)
- **Styling & Typography:** [Tailwind CSS](https://tailwindcss.com/) + Google Fonts (`Fraunces`, `Cinzel`, `Inter`)
- **Build & Deployment:** [Vite](https://vite.dev/) (static bundle, ready for zero-config Vercel deployment)

---

## Technical Highlights

### 1. Canvas-Generated Dial Textures
Instead of loading static bitmap assets or reallocating GPU textures on every keystroke, `Dial.tsx` maintains a **single persistent `1024×1024` HTML5 Canvas and `THREE.CanvasTexture`** (`dialCanvas.ts`). Whenever any dial parameter (`dialColor`, `dialFinish`, `hourMarkers`, `showMinuteTrack`, `engraving`) updates, `drawDial()` repaints the 2D context in place—layering conic metallic sheen gradients and 360 radial strokes for **Sunburst**, dual-pass phase-shifted sinusoidal wave rings for **Guilloché**, WCAG relative-luminance auto-ink selection, and tracked `Cinzel` / `Inter` numerals—before flagging `texture.needsUpdate = true` at maximum hardware anisotropy.

### 2. Procedural Geometry from 2D Shapes
All four structural clock layers—stepped caseback, hollow bezel ring, dial plate, and protective crystal—are derived from a single parametric contour generator `makeShape(type, apothem, cornerRadius, lowPoly)` in `shapes.ts`. It emits clean counter-clockwise outer `THREE.Shape` vertices alongside reversed clockwise `THREE.Path` holes (avoiding duplicate `absarc` seam normals during `ExtrudeGeometry` beveling) and remaps dial UVs isotropically (`uvHalfSpan = innerApothem * 1.18`) so circular chapter rings never stretch or clip inside square or flat-top hexagonal bezels. Previous `BufferGeometry` instances are explicitly `.dispose()`d on every bezel or shape change.

### 3. Z-Layer Depth Stack to Prevent Z-Fighting
Coplanar watch/clock layers are notorious for WebGL depth-buffer shimmering at grazing angles. Chrono Atelier enforces a monotonic local-Z hierarchy combined with a tight camera frustum (`near = 0.25, far = 40`):

| Layer | Local `Z` Span | Anti-Flicker Strategy |
| :--- | :--- | :--- |
| Caseback Engraving & Screws | `[-0.304, -0.291]` | Rear-facing `-Z` group + `polygonOffset` |
| Stepped Back Body | `[-0.290, -0.030]` | Radial step (`-0.035`) avoids side-wall overlap with bezel |
| Dial Plate | `+0.015` | `+0.045` clear gap ahead of back bevel + `polygonOffset (-1, -1)` |
| Hour / Minute / Seconds Hands | `[+0.050, +0.144]` | Dedicated non-overlapping extrusion bands (`renderOrder 2..4`) |
| Center Pinion & Cap | `[+0.025, +0.179]` | Covers hand hubs cleanly |
| Crystal Glass | `+0.205` | `transparent`, `depthWrite: false`, `renderOrder: 10` |
| Bezel Ring Front | `[-0.080, +0.255]` | Frames the recessed crystal and hands |

### 4. Quartz Tick Easing
To prevent cumulative timer drift against the digital studio clock, `Hands.tsx` computes hand angles directly from wall-clock `new Date()` (`seconds + milliseconds / 1000`) inside `useFrame`. In **Quartz Tick** mode, each integer second triggers an **`80ms` underdamped spring step response**:

```ts
const progress = 1 - Math.exp(-5.2 * u) * Math.cos(Math.PI * 1.35 * u);
```

This produces the crisp mechanical snap and subtle ~6% overshoot rebound characteristic of a physical stepping motor before settling motionless for the remaining `920ms` of each second.

---

## How to Run Locally

```bash
# 1. Install dependencies
npm install

# 2. Start the local development server
npm run dev

# 3. Typecheck and build production static bundle
npm run build

# 4. Preview the production build locally
npm run preview
```

### Deploying to Vercel
Import the repository into Vercel with the **Vite** framework preset (`Build Command: npm run build`, `Output Directory: dist`). No environment variables or backend services are required.
