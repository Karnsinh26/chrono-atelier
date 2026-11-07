import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Clock } from './components/Clock';
import { Panel } from './components/Panel';
import { DESK_FLOOR_Y } from './components/Stand';
import { decodeConfigFromHash, findMatchingPreset } from './lib/shareUrl';
import {
  CaseMaterial,
  CaseShape,
  ClockConfig,
  DialFinish,
  HandStyle,
  HourMarkerStyle,
  MountType,
  PresetName,
  useClockStore,
} from './store/useClockStore';

function formatDigitalTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

const VALID_PRESETS: PresetName[] = ['classic', 'minimal', 'luxury', 'workshop'];
const VALID_SHAPES: CaseShape[] = ['round', 'square', 'hexagon'];
const VALID_MATS: CaseMaterial[] = ['gold', 'roseGold', 'steel', 'black', 'walnut', 'ceramic'];
const VALID_FINISHES: DialFinish[] = ['plain', 'sunburst', 'guilloche'];
const VALID_MARKERS: HourMarkerStyle[] = ['dots', 'sticks', 'arabic', 'roman'];
const VALID_HANDS: HandStyle[] = ['classic', 'bold', 'sword'];
const VALID_MOUNTS: MountType[] = ['wall', 'desk'];

const WALL_SWING_AMPLITUDE = 0.72; // Within [-0.9, 0.9] rad
const WALL_SWING_PERIOD_SEC = 8.0; // ~8s full left<->right sinusoidal period
const MOBILE_BREAKPOINT_PX = 820;

interface FirstFrameDetectorProps {
  onFirstFrame: () => void;
}

const FirstFrameDetector: React.FC<FirstFrameDetectorProps> = ({ onFirstFrame }) => {
  const firedRef = useRef(false);
  useFrame(() => {
    if (!firedRef.current) {
      firedRef.current = true;
      onFirstFrame();
    }
  });
  return null;
};

interface CanvasCaptureBridgeProps {
  captureRef: React.MutableRefObject<(() => void) | null>;
  onCaptured: () => void;
}

/**
 * Renders a single high-resolution 2x frame and downloads it as `chrono-atelier-design.png`,
 * then immediately restores the viewport's active DPR without disturbing layout size.
 */
const CanvasCaptureBridge: React.FC<CanvasCaptureBridgeProps> = ({
  captureRef,
  onCaptured,
}) => {
  const { gl, scene, camera, size } = useThree();

  useEffect(() => {
    captureRef.current = () => {
      const prevPixelRatio = gl.getPixelRatio();
      const targetPixelRatio = 2;

      gl.setPixelRatio(targetPixelRatio);
      gl.setSize(size.width, size.height, false);
      gl.render(scene, camera);

      const triggerDownload = (href: string, revokeAfter = false) => {
        const link = document.createElement('a');
        link.href = href;
        link.download = 'chrono-atelier-design.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        if (revokeAfter) {
          window.setTimeout(() => URL.revokeObjectURL(href), 1500);
        }
        onCaptured();
      };

      const canvas = gl.domElement;
      if (typeof canvas.toBlob === 'function') {
        canvas.toBlob((blob) => {
          // Restore viewport pixel ratio immediately after reading pixels
          gl.setPixelRatio(prevPixelRatio);
          gl.setSize(size.width, size.height, false);
          gl.render(scene, camera);

          if (blob) {
            const url = URL.createObjectURL(blob);
            triggerDownload(url, true);
          } else {
            triggerDownload(canvas.toDataURL('image/png'));
          }
        }, 'image/png');
      } else {
        const dataUrl = canvas.toDataURL('image/png');
        gl.setPixelRatio(prevPixelRatio);
        gl.setSize(size.width, size.height, false);
        gl.render(scene, camera);
        triggerDownload(dataUrl);
      }
    };

    return () => {
      captureRef.current = null;
    };
  }, [gl, scene, camera, size.width, size.height, captureRef, onCaptured]);

  return null;
};

interface ResponsiveCameraRigProps {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  activeAutoRotate: boolean;
}

/**
 * Dynamically fits camera distance & vertical target on mount, resize, and wall/desk toggle,
 * and drives the gentle ~8s sinusoidal left<->right swing in wall auto-rotate mode.
 */
const ResponsiveCameraRig: React.FC<ResponsiveCameraRigProps> = ({
  controlsRef,
  activeAutoRotate,
}) => {
  const { camera, size } = useThree();
  const mount = useClockStore((s) => s.mount);
  const shape = useClockStore((s) => s.shape);
  const initializedRef = useRef(false);
  const swingPhaseRef = useRef<number | null>(null);

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    if (size.width <= 0 || size.height <= 0) return;

    camera.fov = 36;
    camera.near = 0.25;
    camera.far = 40;

    const vFovRad = THREE.MathUtils.degToRad(camera.fov);
    const tanHalfFov = Math.tan(vFovRad / 2);
    const aspect = size.width / size.height;

    const topReservedPx = size.width < 640 ? 64 : 88;
    const bottomReservedPx = size.width < 640 ? 18 : 38;
    const safeHeightRatio = Math.max(
      0.5,
      (size.height - topReservedPx - bottomReservedPx) / size.height
    );

    const paddedHalfWidth =
      mount === 'desk' ? (shape === 'hexagon' ? 3.56 : 3.4) : 3.36;
    const paddedHalfHeightInSafeZone = mount === 'desk' ? 3.16 : 2.9;
    const requiredHalfHeight = paddedHalfHeightInSafeZone / safeHeightRatio;

    const distForHeight = requiredHalfHeight / tanHalfFov;
    const distForWidth = paddedHalfWidth / (tanHalfFov * aspect);
    const fitDistance = Math.max(distForHeight, distForWidth);

    const visibleFullHeight = 2 * fitDistance * tanHalfFov;
    const pixelCenterOffset = (topReservedPx - bottomReservedPx) * 0.5;
    const sceneCenterY = mount === 'desk' ? 0.09 : 0;
    const targetOffsetY =
      sceneCenterY + (pixelCenterOffset / size.height) * visibleFullHeight;

    const target = new THREE.Vector3(0, targetOffsetY, 0);
    const controls = controlsRef.current;

    const params = new URLSearchParams(window.location.search);
    const debugAngleDeg = params.has('angle') ? Number(params.get('angle')) : null;

    if (!initializedRef.current) {
      if (debugAngleDeg !== null && !Number.isNaN(debugAngleDeg)) {
        const rad = THREE.MathUtils.degToRad(debugAngleDeg);
        camera.position.set(
          Math.sin(rad) * fitDistance,
          targetOffsetY + 0.28,
          Math.cos(rad) * fitDistance
        );
      } else {
        camera.position.set(0, targetOffsetY + 0.18, fitDistance);
      }
      camera.lookAt(target);
      camera.updateProjectionMatrix();
      if (controls) {
        controls.target.copy(target);
        controls.minDistance = fitDistance * 0.58;
        controls.maxDistance = fitDistance * 1.65;
        controls.update();
      }
      initializedRef.current = true;
    } else if (controls) {
      const dir = camera.position.clone().sub(controls.target);
      if (dir.lengthSq() < 0.0001) {
        dir.set(0, 0.05, 1);
      }
      dir.normalize();

      controls.target.copy(target);
      camera.position.copy(target).addScaledVector(dir, fitDistance);
      controls.minDistance = fitDistance * 0.58;
      controls.maxDistance = fitDistance * 1.65;
      camera.updateProjectionMatrix();
      controls.update();
    } else {
      camera.position.set(0, targetOffsetY + 0.18, fitDistance);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
    }
  }, [camera, size.width, size.height, mount, shape, controlsRef]);

  // Reset swing phase when auto-rotate or mount changes so resume is seamless without jump
  useEffect(() => {
    swingPhaseRef.current = null;
  }, [activeAutoRotate, mount]);

  useFrame((_, delta) => {
    if (mount !== 'wall' || !activeAutoRotate) return;
    const controls = controlsRef.current;
    if (!controls) return;

    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);

    if (swingPhaseRef.current === null) {
      const ratio = THREE.MathUtils.clamp(
        spherical.theta / WALL_SWING_AMPLITUDE,
        -1,
        1
      );
      swingPhaseRef.current = Math.asin(ratio);
    }

    swingPhaseRef.current +=
      ((Math.PI * 2) / WALL_SWING_PERIOD_SEC) * Math.min(delta, 0.05);
    spherical.theta = WALL_SWING_AMPLITUDE * Math.sin(swingPhaseRef.current);
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, 1.1, 2.0);

    offset.setFromSpherical(spherical);
    camera.position.copy(controls.target).add(offset);
    camera.lookAt(controls.target);
    controls.update();
  });

  return null;
};

export const App: React.FC = () => {
  const autoRotate = useClockStore((s) => s.autoRotate);
  const mount = useClockStore((s) => s.mount);
  const setConfig = useClockStore((s) => s.setConfig);
  const applyPreset = useClockStore((s) => s.applyPreset);
  const applyHydratedConfig = useClockStore((s) => s.applyHydratedConfig);

  const [now, setNow] = useState(() => new Date());
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT_PX
  );
  const [fontsReady, setFontsReady] = useState(false);
  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const [loadingHidden, setLoadingHidden] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [dragPaused, setDragPaused] = useState(false);

  const resumeTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const captureRef = useRef<(() => void) | null>(null);

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToastMessage(message);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 2600);
  }, []);

  const handleDownloadPng = useCallback(() => {
    if (captureRef.current) {
      captureRef.current();
    }
  }, []);

  const handleCapturedPng = useCallback(() => {
    showToast('Downloaded chrono-atelier-design.png (2× PNG)');
  }, [showToast]);

  const handleFirstFrame = useCallback(() => {
    setFirstFrameReady(true);
  }, []);

  // Track mobile viewport (<820px) for DPR cap, 1024 shadow map, and lower bevel segments
  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT_PX);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Wait for brand/dial fonts (with a short fallback timeout so offline environments never block)
  useEffect(() => {
    let active = true;
    const safetyTimer = window.setTimeout(() => {
      if (active) setFontsReady(true);
    }, 350);

    if (document.fonts && typeof document.fonts.load === 'function') {
      Promise.all([
        document.fonts.load('600 28px "Fraunces"'),
        document.fonts.load('600 41px "Cinzel"'),
        document.fonts.load('600 44px "Inter"'),
      ])
        .then(() => {
          if (active) setFontsReady(true);
        })
        .catch(() => {
          if (active) setFontsReady(true);
        });
    } else {
      setFontsReady(true);
    }

    return () => {
      active = false;
      window.clearTimeout(safetyTimer);
    };
  }, []);

  const appReady = fontsReady && firstFrameReady;

  useEffect(() => {
    if (!appReady) return;
    const timer = window.setTimeout(() => {
      setLoadingHidden(true);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [appReady]);

  // Pause turntable while dragging; resume 2s after user releases
  const handleOrbitStart = useCallback(() => {
    if (resumeTimerRef.current !== null) {
      window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
    setDragPaused(true);
  }, []);

  const handleOrbitEnd = useCallback(() => {
    if (resumeTimerRef.current !== null) {
      window.clearTimeout(resumeTimerRef.current);
    }
    resumeTimerRef.current = window.setTimeout(() => {
      setDragPaused(false);
      resumeTimerRef.current = null;
    }, 2000);
  }, []);

  useEffect(() => {
    if (!autoRotate) {
      if (resumeTimerRef.current !== null) {
        window.clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }
      setDragPaused(false);
    }
  }, [autoRotate]);

  useEffect(() => {
    return () => {
      if (resumeTimerRef.current !== null) {
        window.clearTimeout(resumeTimerRef.current);
      }
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Hydrate design from URL hash (#d=...) on load & hashchange, plus optional query overrides
  useEffect(() => {
    const applyFromLocation = () => {
      const hashConfig = decodeConfigFromHash(window.location.hash);
      if (hashConfig) {
        const matchedPreset = findMatchingPreset(hashConfig);
        applyHydratedConfig(hashConfig, matchedPreset);
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const qPreset = params.get('preset') as PresetName | null;
      if (qPreset && VALID_PRESETS.includes(qPreset)) {
        applyPreset(qPreset);
      }

      const patch: Partial<ClockConfig> = {};
      const qShape = params.get('shape') as CaseShape | null;
      const qMat = params.get('mat') as CaseMaterial | null;
      const qBezel = params.get('bezel');
      const qDialColor = params.get('dialColor');
      const qFinish = params.get('finish') as DialFinish | null;
      const qMarkers = params.get('markers') as HourMarkerStyle | null;
      const qTrack = params.get('track');
      const qEngraving = params.get('engraving');
      const qHandStyle = params.get('hands') as HandStyle | null;
      const qMount = params.get('mount') as MountType | null;

      if (qShape && VALID_SHAPES.includes(qShape)) patch.shape = qShape;
      if (qMat && VALID_MATS.includes(qMat)) patch.caseMat = qMat;
      if (qBezel !== null) {
        const parsed = parseFloat(qBezel);
        if (!Number.isNaN(parsed)) patch.bezel = Math.min(0.45, Math.max(0.1, parsed));
      }
      if (qDialColor && /^#[0-9a-fA-F]{6}$/.test(qDialColor)) patch.dialColor = qDialColor;
      if (qFinish && VALID_FINISHES.includes(qFinish)) patch.dialFinish = qFinish;
      if (qMarkers && VALID_MARKERS.includes(qMarkers)) patch.hourMarkers = qMarkers;
      if (qTrack === '0' || qTrack === 'false') patch.showMinuteTrack = false;
      else if (qTrack === '1' || qTrack === 'true') patch.showMinuteTrack = true;
      if (qEngraving !== null) patch.engraving = qEngraving.slice(0, 18);
      if (qHandStyle && VALID_HANDS.includes(qHandStyle)) patch.handStyle = qHandStyle;
      if (qMount && VALID_MOUNTS.includes(qMount)) patch.mount = qMount;

      if (Object.keys(patch).length > 0) {
        setConfig(patch);
      }
    };

    applyFromLocation();

    const onHashChange = () => {
      const hashConfig = decodeConfigFromHash(window.location.hash);
      if (hashConfig) {
        const matchedPreset = findMatchingPreset(hashConfig);
        applyHydratedConfig(hashConfig, matchedPreset);
      }
    };

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [applyHydratedConfig, applyPreset, setConfig]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 250);
    return () => clearInterval(timer);
  }, []);

  const shadowY = mount === 'desk' ? DESK_FLOOR_Y - 0.012 : -2.42;
  const shadowMapSize = isMobile ? 1024 : 2048;
  const activeAutoRotate = autoRotate && !dragPaused;
  const isWallMount = mount === 'wall';

  return (
    <div className="relative h-[100dvh] w-full bg-atelier-bg text-zinc-100 flex flex-col desktop:flex-row overflow-hidden">
      {/* Branded Loading Screen until Fonts + First WebGL Frame are Ready */}
      {!loadingHidden && (
        <div
          aria-hidden={appReady}
          className={`fixed inset-0 z-50 bg-atelier-bg flex flex-col items-center justify-center transition-opacity duration-150 ${
            appReady ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <div className="text-center space-y-2.5 px-6">
            <div className="font-brand text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-100">
              Chrono <span className="text-atelier-gold">Atelier</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.26em] text-zinc-400">
              Calibrating 3D Horology Studio
            </div>
            <div className="w-36 h-[2px] mx-auto bg-atelier-border rounded-full overflow-hidden">
              <div className="h-full w-1/2 bg-atelier-gold animate-pulse rounded-full" />
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 desktop:bottom-6 left-1/2 desktop:left-[calc((100vw-360px)/2)] -translate-x-1/2 z-40 px-4 py-2 rounded-full bg-atelier-panel/95 border border-atelier-gold/50 text-xs font-medium text-zinc-100 shadow-2xl backdrop-blur-md flex items-center gap-2 pointer-events-none"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-atelier-gold shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 3D Viewport Area (55vh on mobile <820px, fills left space on desktop) */}
      <main className="relative w-full h-[55vh] desktop:h-full desktop:flex-1 shrink-0 bg-atelier-bg touch-none">
        {/* Subtle radial studio backdrop glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 52%, rgba(230, 180, 90, 0.07) 0%, rgba(21, 23, 28, 0.45) 48%, rgba(14, 15, 18, 1) 100%)',
          }}
        />

        {/* Top-Left Brand Overlay */}
        <div className="pointer-events-none absolute top-3.5 left-4 sm:top-6 sm:left-7 z-10 max-w-[56%]">
          <h1 className="font-brand text-lg sm:text-2xl md:text-[26px] font-semibold tracking-tight text-zinc-100 leading-none">
            Chrono <span className="text-atelier-gold">Atelier</span>
          </h1>
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.15em] sm:tracking-[0.22em] text-zinc-400 mt-1 sm:mt-1.5 truncate">
            Bespoke 3D Horology Studio
          </p>
        </div>

        {/* Top-Right Live Local Digital Time Overlay */}
        <div className="pointer-events-none absolute top-3.5 right-4 sm:top-6 sm:right-7 z-10 text-right">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-atelier-panel/80 backdrop-blur-md border border-atelier-border/80 shadow-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-atelier-gold animate-pulse" />
            <span className="font-mono text-[11px] sm:text-sm text-zinc-200 tracking-wider tabular-nums">
              {formatDigitalTime(now)}
            </span>
          </div>
          <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.16em] sm:tracking-[0.18em] text-zinc-500 mt-1 pr-1">
            Local Studio Time
          </div>
        </div>

        {/* Three.js Canvas — mobile DPR capped at 1.5, near=0.25, far=40 for depth precision */}
        <Canvas
          shadows
          dpr={isMobile ? [1, 1.5] : [1, 2]}
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          camera={{ position: [0, 0.25, 10.8], fov: 36, near: 0.25, far: 40 }}
        >
          <ambientLight intensity={0.36} />
          <directionalLight
            position={[4, 6, 6]}
            intensity={1.35}
            castShadow
            shadow-mapSize-width={shadowMapSize}
            shadow-mapSize-height={shadowMapSize}
            shadow-camera-near={1}
            shadow-camera-far={20}
            shadow-camera-left={-4}
            shadow-camera-right={4}
            shadow-camera-top={4}
            shadow-camera-bottom={-4}
            shadow-bias={-0.0003}
            shadow-normalBias={0.015}
          />
          <directionalLight position={[-4, -2, 4]} intensity={0.45} color="#ffdca8" />
          <directionalLight position={[0, 3, -6]} intensity={0.55} color="#fff2dc" />

          <Suspense fallback={null}>
            {/* Studio HDRI Environment for realistic metal, ceramic, wood & crystal reflections */}
            <Environment resolution={isMobile ? 128 : 256} frames={1}>
              <Lightformer
                form="rect"
                intensity={3.4}
                position={[0, 5, 4]}
                scale={[9, 3, 1]}
                rotation-x={Math.PI / 3}
                color="#fffaf0"
              />
              <Lightformer
                form="rect"
                intensity={2.5}
                position={[-6, 1.5, 3]}
                scale={[3.5, 8, 1]}
                rotation-y={Math.PI / 3}
                color="#ffffff"
              />
              <Lightformer
                form="rect"
                intensity={2.1}
                position={[6, -1, 3]}
                scale={[3.5, 8, 1]}
                rotation-y={-Math.PI / 3}
                color="#ffe7bd"
              />
              <Lightformer
                form="ring"
                intensity={1.15}
                position={[0, 0, 7]}
                scale={4.5}
                color="#ffffff"
              />
              <Lightformer
                form="rect"
                intensity={2.2}
                position={[0, 2, -7]}
                scale={[9, 5, 1]}
                rotation-y={Math.PI}
                color="#fff5e4"
              />
              <Lightformer
                form="rect"
                intensity={0.85}
                position={[0, -5, 0]}
                scale={[10, 4, 1]}
                rotation-x={-Math.PI / 2}
                color="#c7d8f4"
              />
            </Environment>

            <Clock lowPoly={isMobile} />

            <ContactShadows
              position={[0, shadowY, 0]}
              opacity={mount === 'desk' ? 0.68 : 0.45}
              scale={9.5}
              blur={mount === 'desk' ? 2.0 : 2.6}
              far={4.5}
              resolution={isMobile ? 256 : 512}
              color="#000000"
            />

            <FirstFrameDetector onFirstFrame={handleFirstFrame} />
            <CanvasCaptureBridge
              captureRef={captureRef}
              onCaptured={handleCapturedPng}
            />
          </Suspense>

          <OrbitControls
            ref={controlsRef}
            enablePan={false}
            enableDamping
            dampingFactor={0.055}
            minDistance={5.5}
            maxDistance={17}
            minAzimuthAngle={isWallMount ? -0.9 : -Infinity}
            maxAzimuthAngle={isWallMount ? 0.9 : Infinity}
            minPolarAngle={isWallMount ? 1.1 : Math.PI * 0.2}
            maxPolarAngle={isWallMount ? 2.0 : Math.PI * 0.8}
            autoRotate={!isWallMount && activeAutoRotate}
            autoRotateSpeed={1.0}
            onStart={handleOrbitStart}
            onEnd={handleOrbitEnd}
          />
          <ResponsiveCameraRig
            controlsRef={controlsRef}
            activeAutoRotate={activeAutoRotate}
          />
        </Canvas>

        {/* Bottom-left subtle camera hint */}
        <div className="pointer-events-none hidden sm:flex items-center gap-2 absolute bottom-4 left-7 z-10 text-[11px] text-zinc-500">
          <span>Drag to orbit · Scroll to zoom</span>
        </div>
      </main>

      {/* Right / Bottom Control Panel */}
      <Panel onDownloadPng={handleDownloadPng} onShowToast={showToast} />
    </div>
  );
};

export default App;
