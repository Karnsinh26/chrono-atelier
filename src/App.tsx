import React, { Suspense, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Clock } from './components/Clock';
import { Panel } from './components/Panel';
import {
  CaseMaterial,
  CaseShape,
  ClockConfig,
  DialFinish,
  HourMarkerStyle,
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

const VALID_SHAPES: CaseShape[] = ['round', 'square', 'hexagon'];
const VALID_MATS: CaseMaterial[] = ['gold', 'roseGold', 'steel', 'black', 'walnut', 'ceramic'];
const VALID_FINISHES: DialFinish[] = ['plain', 'sunburst', 'guilloche'];
const VALID_MARKERS: HourMarkerStyle[] = ['dots', 'sticks', 'arabic', 'roman'];

interface ResponsiveCameraRigProps {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}

/**
 * Dynamically fits the camera distance & vertical target on mount and whenever
 * the canvas resizes (narrow windows, split view, mobile <820px) so the entire
 * clock (including flat-top hexagon width) maintains ~15%+ padding and never overlaps overlays.
 */
const ResponsiveCameraRig: React.FC<ResponsiveCameraRigProps> = ({ controlsRef }) => {
  const { camera, size } = useThree();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    if (size.width <= 0 || size.height <= 0) return;

    camera.fov = 36;
    camera.near = 0.25;
    camera.far = 40;

    const vFovRad = THREE.MathUtils.degToRad(camera.fov);
    const tanHalfFov = Math.tan(vFovRad / 2);
    const aspect = size.width / size.height;

    const topReservedPx = size.width < 640 ? 72 : 88;
    const bottomReservedPx = size.width < 640 ? 24 : 38;
    const safeHeightRatio = Math.max(
      0.5,
      (size.height - topReservedPx - bottomReservedPx) / size.height
    );

    // Accommodates round, square, and hexagon (circumradius ~2.31) with ~15%+ padding on every side
    const paddedHalfWidth = 3.36;
    const paddedHalfHeightInSafeZone = 2.9;
    const requiredHalfHeight = paddedHalfHeightInSafeZone / safeHeightRatio;

    const distForHeight = requiredHalfHeight / tanHalfFov;
    const distForWidth = paddedHalfWidth / (tanHalfFov * aspect);
    const fitDistance = Math.max(distForHeight, distForWidth);

    const visibleFullHeight = 2 * fitDistance * tanHalfFov;
    const pixelCenterOffset = (topReservedPx - bottomReservedPx) * 0.5;
    const targetOffsetY = (pixelCenterOffset / size.height) * visibleFullHeight;

    const target = new THREE.Vector3(0, targetOffsetY, 0);
    const controls = controlsRef.current;

    const params = new URLSearchParams(window.location.search);
    const debugAngleDeg = params.has('angle') ? Number(params.get('angle')) : null;

    if (!initializedRef.current) {
      if (debugAngleDeg !== null && !Number.isNaN(debugAngleDeg)) {
        const rad = THREE.MathUtils.degToRad(debugAngleDeg);
        camera.position.set(
          Math.sin(rad) * fitDistance,
          targetOffsetY + 0.3,
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
  }, [camera, size.width, size.height, controlsRef]);

  return null;
};

export const App: React.FC = () => {
  const autoRotate = useClockStore((s) => s.autoRotate);
  const setConfig = useClockStore((s) => s.setConfig);
  const [now, setNow] = useState(() => new Date());
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  // Support optional URL params (?shape=hexagon&mat=walnut&bezel=0.45) for deep-linking & testing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const patch: Partial<ClockConfig> = {};
    const qShape = params.get('shape') as CaseShape | null;
    const qMat = params.get('mat') as CaseMaterial | null;
    const qBezel = params.get('bezel');
    const qDialColor = params.get('dialColor');
    const qFinish = params.get('finish') as DialFinish | null;
    const qMarkers = params.get('markers') as HourMarkerStyle | null;
    const qTrack = params.get('track');
    const qEngraving = params.get('engraving');

    if (qShape && VALID_SHAPES.includes(qShape)) {
      patch.shape = qShape;
    }
    if (qMat && VALID_MATS.includes(qMat)) {
      patch.caseMat = qMat;
    }
    if (qBezel !== null) {
      const parsed = parseFloat(qBezel);
      if (!Number.isNaN(parsed)) {
        patch.bezel = Math.min(0.45, Math.max(0.1, parsed));
      }
    }
    if (qDialColor && /^#[0-9a-fA-F]{6}$/.test(qDialColor)) {
      patch.dialColor = qDialColor;
    }
    if (qFinish && VALID_FINISHES.includes(qFinish)) {
      patch.dialFinish = qFinish;
    }
    if (qMarkers && VALID_MARKERS.includes(qMarkers)) {
      patch.hourMarkers = qMarkers;
    }
    if (qTrack === '0' || qTrack === 'false') {
      patch.showMinuteTrack = false;
    } else if (qTrack === '1' || qTrack === 'true') {
      patch.showMinuteTrack = true;
    }
    if (qEngraving !== null) {
      patch.engraving = qEngraving.slice(0, 18);
    }
    if (Object.keys(patch).length > 0) {
      setConfig(patch);
    }
  }, [setConfig]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 250);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen desktop:h-screen w-full bg-atelier-bg text-zinc-100 flex flex-col desktop:flex-row overflow-x-hidden desktop:overflow-hidden">
      {/* 3D Viewport Area */}
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
            shadow-camera-left={-3.5}
            shadow-camera-right={3.5}
            shadow-camera-top={3.5}
            shadow-camera-bottom={-3.5}
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
              {/* Rear studio softbox so back body & side walls gleam when rotated 180° */}
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
              position={[0, -2.42, 0]}
              opacity={0.58}
              scale={9.5}
              blur={2.4}
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
            maxDistance={16.5}
            minPolarAngle={Math.PI * 0.2}
            maxPolarAngle={Math.PI * 0.8}
            autoRotate={autoRotate}
            autoRotateSpeed={1.1}
          />
          <ResponsiveCameraRig controlsRef={controlsRef} />
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
