import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Clock } from './components/Clock';
import { Panel } from './components/Panel';
import { DESK_FLOOR_Y } from './components/Stand';
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

    const topReservedPx = size.width < 640 ? 68 : 88;
    const bottomReservedPx = size.width < 640 ? 20 : 38;
    const safeHeightRatio = Math.max(
      0.5,
      (size.height - topReservedPx - bottomReservedPx) / size.height
    );

    const paddedHalfWidth = 3.36;
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
  }, [camera, size.width, size.height, mount, controlsRef]);

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

  const [now, setNow] = useState(() => new Date());
  const [dragPaused, setDragPaused] = useState(false);
  const resumeTimerRef = useRef<number | null>(null);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

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
    };
  }, []);

  // Optional URL query params for presets / deep-linking / automated visual verification
  useEffect(() => {
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
  }, [applyPreset, setConfig]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 250);
    return () => clearInterval(timer);
  }, []);

  const shadowY = mount === 'desk' ? DESK_FLOOR_Y - 0.012 : -2.42;
  const activeAutoRotate = autoRotate && !dragPaused;
  const isWallMount = mount === 'wall';

  return (
    <div className="h-[100dvh] w-full bg-atelier-bg text-zinc-100 flex flex-col desktop:flex-row overflow-hidden">
      {/* 3D Viewport Area (58vh on mobile <820px, fills left space on desktop) */}
      <main className="relative w-full h-[58vh] desktop:h-full desktop:flex-1 shrink-0 bg-atelier-bg">
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

        {/* Three.js Canvas — near=0.25, far=40 for high depth-buffer precision */}
        <Canvas
          shadows
          dpr={[1, 2]}
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          camera={{ position: [0, 0.25, 10.8], fov: 36, near: 0.25, far: 40 }}
        >
          <ambientLight intensity={0.36} />
          <directionalLight
            position={[4, 6, 6]}
            intensity={1.35}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
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
            <Environment resolution={256} frames={1}>
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

            <Clock />

            <ContactShadows
              position={[0, shadowY, 0]}
              opacity={mount === 'desk' ? 0.68 : 0.45}
              scale={9.5}
              blur={mount === 'desk' ? 2.0 : 2.6}
              far={4.5}
              color="#000000"
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
      <Panel />
    </div>
  );
};

export default App;
