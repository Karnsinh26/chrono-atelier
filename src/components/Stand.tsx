import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CASE_MATERIAL_SPECS, getWalnutWoodTexture } from '../lib/materials';
import { CLOCK_OUTER_APOTHEM } from '../lib/shapes';
import { CaseShape, useClockStore } from '../store/useClockStore';

interface StandProps {
  children: React.ReactNode;
  lowPoly?: boolean;
}

const DESK_TILT_RAD = THREE.MathUtils.degToRad(6); // ~6° backward clock tilt
const A_FRAME_ANGLE_RAD = THREE.MathUtils.degToRad(25); // ~25° backward A-frame brace angle
const DESK_CLOCK_OFFSET_Y = 0.22;

// Exact lowest Y of the bevelled clock case (outerApothem 2.00 + bevelSize 0.025 = 2.025, rear z = -0.05)
const BEZEL_OUTER_BOTTOM_LOCAL_Y = -(CLOCK_OUTER_APOTHEM + 0.025);
const BEZEL_REAR_LOCAL_Z = -0.05;
export const DESK_TOUCH_Y =
  DESK_CLOCK_OFFSET_Y +
  BEZEL_OUTER_BOTTOM_LOCAL_Y * Math.cos(DESK_TILT_RAD) +
  BEZEL_REAR_LOCAL_Z * Math.sin(DESK_TILT_RAD); // ~ -1.7991

const BASE_HEIGHT = 0.24;
export const DESK_FLOOR_Y = DESK_TOUCH_Y - BASE_HEIGHT; // ~ -2.039

let cachedWallShadowTexture: THREE.CanvasTexture | null = null;

function getWallShadowTexture(): THREE.CanvasTexture {
  if (cachedWallShadowTexture) return cachedWallShadowTexture;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const c = size / 2;
  const grad = ctx.createRadialGradient(c, c, size * 0.12, c, c, size * 0.46);
  grad.addColorStop(0.0, 'rgba(0, 0, 0, 0.62)');
  grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.34)');
  grad.addColorStop(0.78, 'rgba(0, 0, 0, 0.08)');
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  cachedWallShadowTexture = tex;
  return tex;
}

function createRoundedRectShape(
  width: number,
  depth: number,
  radius: number,
  segs = 12
): THREE.Shape {
  const hw = width / 2;
  const hd = depth / 2;
  const r = Math.min(radius, hw * 0.45, hd * 0.45);
  const cx = hw - r;
  const cy = hd - r;

  const s = new THREE.Shape();
  const corners = [
    { x: cx, y: cy, a0: 0 },
    { x: -cx, y: cy, a0: Math.PI * 0.5 },
    { x: -cx, y: -cy, a0: Math.PI },
    { x: cx, y: -cy, a0: Math.PI * 1.5 },
  ];

  let first = true;
  for (const c of corners) {
    for (let i = 0; i < segs; i++) {
      const a = c.a0 + (i / (segs - 1)) * (Math.PI * 0.5);
      const px = c.x + Math.cos(a) * r;
      const py = c.y + Math.sin(a) * r;
      if (first) {
        s.moveTo(px, py);
        first = false;
      } else {
        s.lineTo(px, py);
      }
    }
  }
  s.closePath();
  return s;
}

/**
 * Builds the 2D A-frame silhouette (splayed outer legs + crossbar + two open trapezoidal cutouts)
 * which is extruded and angled backward ~25° from the clock's rear collar down to the wide base foot.
 */
function createAFrameShape(): THREE.Shape {
  const s = new THREE.Shape();
  const bottomHalfW = 0.82; // 1.64 total width at the base foot
  const topHalfW = 0.36; // 0.72 width at the upper rear collar
  const height = 1.32;

  // CCW outer A-frame perimeter
  s.moveTo(-bottomHalfW, 0);
  s.lineTo(bottomHalfW, 0);
  s.lineTo(topHalfW, height);
  s.lineTo(-topHalfW, height);
  s.closePath();

  // Lower trapezoidal window (below the A-frame horizontal crossbar, CW hole)
  const holeBottom = new THREE.Path();
  holeBottom.moveTo(-0.56, 0.05);
  holeBottom.lineTo(-0.4, 0.52);
  holeBottom.lineTo(0.4, 0.52);
  holeBottom.lineTo(0.56, 0.05);
  holeBottom.closePath();
  s.holes.push(holeBottom);

  // Upper trapezoidal window (above the A-frame horizontal crossbar, CW hole)
  const holeTop = new THREE.Path();
  holeTop.moveTo(-0.34, 0.68);
  holeTop.lineTo(-0.2, 1.12);
  holeTop.lineTo(0.2, 1.12);
  holeTop.lineTo(0.34, 0.68);
  holeTop.closePath();
  s.holes.push(holeTop);

  return s;
}

interface DeskStandBundle {
  baseGeometry: THREE.ExtrudeGeometry;
  footPlateGeometry: THREE.ExtrudeGeometry;
  aFrameGeometry: THREE.ExtrudeGeometry;
  backCollarGeometry: THREE.ExtrudeGeometry;
}

/**
 * Computes outer clock width for the active shape and makes the desk base ~10% wider
 * so the clock never looks top-heavy (4.46 units for round/square, 5.14 units for hexagon).
 */
function getClockOuterWidth(shape: CaseShape): number {
  if (shape === 'hexagon') {
    const hexCircumradius = CLOCK_OUTER_APOTHEM / Math.cos(Math.PI / 6);
    return 2 * (hexCircumradius + 0.025);
  }
  return 2 * (CLOCK_OUTER_APOTHEM + 0.025);
}

function buildDeskStandGeometries(shape: CaseShape, lowPoly = false): DeskStandBundle {
  const bevelSegs = lowPoly ? 2 : 4;
  const cornerSegs = lowPoly ? 8 : 12;

  // 1. Base block plinth (~10% wider than the clock's outer width, deep enough for the 25° A-frame foot)
  const bevel = 0.024;
  const baseBodyDepth = BASE_HEIGHT - bevel * 2;
  const baseWidth = getClockOuterWidth(shape) * 1.1; // +10% wider than clock outer width
  const baseDepth = 1.88;
  const baseShape = createRoundedRectShape(
    baseWidth - bevel * 2,
    baseDepth - bevel * 2,
    0.2,
    cornerSegs
  );
  const baseGeometry = new THREE.ExtrudeGeometry(baseShape, {
    depth: baseBodyDepth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: bevelSegs,
  });

  // 2. Wide rear foot plate resting on the rear of the base block to anchor the A-frame legs
  const footBevel = 0.008;
  const footShape = createRoundedRectShape(1.92, 0.42, 0.1, cornerSegs);
  const footPlateGeometry = new THREE.ExtrudeGeometry(footShape, {
    depth: 0.036,
    bevelEnabled: true,
    bevelThickness: footBevel,
    bevelSize: footBevel,
    bevelSegments: Math.max(2, bevelSegs - 1),
  });

  // 3. Proper A-frame brace (two splayed legs + horizontal crossbar, angled backward ~25°)
  const aFrameShape = createAFrameShape();
  const aFrameDepth = 0.12;
  const aFrameGeometry = new THREE.ExtrudeGeometry(aFrameShape, {
    depth: aFrameDepth,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.014,
    bevelSegments: Math.max(2, bevelSegs - 1),
  });
  // Center extrusion depth around local Z = 0
  aFrameGeometry.translate(0, 0, -aFrameDepth / 2);

  // 4. Rear mounting collar bridge flush against the lower clock caseback (z_local = -0.290)
  const collarShape = createRoundedRectShape(0.88, 0.34, 0.09, cornerSegs);
  const backCollarGeometry = new THREE.ExtrudeGeometry(collarShape, {
    depth: 0.04,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: Math.max(2, bevelSegs - 1),
  });

  return {
    baseGeometry,
    footPlateGeometry,
    aFrameGeometry,
    backCollarGeometry,
  };
}

export const Stand: React.FC<StandProps> = ({ children, lowPoly = false }) => {
  const mount = useClockStore((s) => s.mount);
  const caseMat = useClockStore((s) => s.caseMat);
  const shape = useClockStore((s) => s.shape);

  const spec = CASE_MATERIAL_SPECS[caseMat];
  const walnutTexture = useMemo(() => getWalnutWoodTexture(), []);
  const wallShadowTex = useMemo(() => getWallShadowTexture(), []);
  const wallShadowMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const standGeos = useMemo(
    () => buildDeskStandGeometries(shape, lowPoly),
    [shape, lowPoly]
  );

  useEffect(() => {
    return () => {
      standGeos.baseGeometry.dispose();
      standGeos.footPlateGeometry.dispose();
      standGeos.aFrameGeometry.dispose();
      standGeos.backCollarGeometry.dispose();
    };
  }, [standGeos]);

  // Fade wall shadow plane opacity based on camera viewing angle so it never looks like a floating square
  useFrame(({ camera }) => {
    if (mount !== 'wall' || !wallShadowMatRef.current) return;
    const dist = Math.max(0.001, camera.position.length());
    const cosAngle = camera.position.z / dist;
    const angleFade = THREE.MathUtils.smoothstep(cosAngle, 0.62, 0.96);
    wallShadowMatRef.current.opacity = 0.54 * angleFade;
  });

  const isWalnutCase = caseMat === 'walnut';
  const supportMatMap = spec.useWoodTexture ? walnutTexture : null;
  const supportMatKey = spec.useWoodTexture ? 'support-wood' : 'support-solid';

  if (mount === 'wall') {
    return (
      <group>
        {/* Soft circular wall shadow behind the floating clock; fades smoothly at oblique camera angles */}
        <mesh position={[-0.08, -0.14, -0.36]} renderOrder={0}>
          <circleGeometry args={[2.6, 64]} />
          <meshBasicMaterial
            ref={wallShadowMatRef}
            map={wallShadowTex}
            transparent
            opacity={0.54}
            depthWrite={false}
          />
        </mesh>
        {children}
      </group>
    );
  }

  // Desk mount: ~10% wider base block + ~25° backward-angled A-frame brace + clock tilted back ~6°
  const baseBottomLocalOriginY = DESK_FLOOR_Y + 0.024;

  return (
    <group>
      {/* Tilted clock + rear collar bridge attached flush to lower caseback */}
      <group
        position={[0, DESK_CLOCK_OFFSET_Y, 0]}
        rotation={[-DESK_TILT_RAD, 0, 0]}
      >
        {children}

        {/* Rear collar bridge flush against lower back body (clear of upper caseback engraving & 4 screws) */}
        <mesh
          geometry={standGeos.backCollarGeometry}
          position={[0, -0.82, -0.336]}
          castShadow
        >
          <meshPhysicalMaterial
            key={`collar-${supportMatKey}`}
            color={spec.color}
            map={supportMatMap}
            metalness={spec.metalness}
            roughness={spec.roughness}
            clearcoat={spec.clearcoat}
            clearcoatRoughness={spec.clearcoatRoughness}
            envMapIntensity={spec.envMapIntensity}
          />
        </mesh>
      </group>

      {/* Base block (~10% wider than clock outer width): Walnut if case is walnut, otherwise dark stone #2a2522 */}
      <mesh
        geometry={standGeos.baseGeometry}
        position={[0, baseBottomLocalOriginY, -0.22]}
        rotation={[-Math.PI / 2, 0, 0]}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial
          key={isWalnutCase ? 'base-walnut' : 'base-stone'}
          color={isWalnutCase ? '#ffffff' : '#2a2522'}
          map={isWalnutCase ? walnutTexture : null}
          metalness={isWalnutCase ? 0 : 0.06}
          roughness={isWalnutCase ? 0.55 : 0.68}
          clearcoat={isWalnutCase ? 0.4 : 0.12}
          clearcoatRoughness={0.32}
          envMapIntensity={0.95}
        />
      </mesh>

      {/* Wide rear foot plate on top of base block anchoring the A-frame legs (uses case material) */}
      <mesh
        geometry={standGeos.footPlateGeometry}
        position={[0, DESK_TOUCH_Y + 0.008, -0.78]}
        rotation={[-Math.PI / 2, 0, 0]}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial
          key={`foot-${supportMatKey}`}
          color={spec.color}
          map={supportMatMap}
          metalness={spec.metalness}
          roughness={spec.roughness}
          clearcoat={spec.clearcoat}
          clearcoatRoughness={spec.clearcoatRoughness}
          envMapIntensity={spec.envMapIntensity}
        />
      </mesh>

      {/* Proper A-frame brace angling backward ~25° from the clock back down to the wide rear foot */}
      <mesh
        geometry={standGeos.aFrameGeometry}
        position={[0, DESK_TOUCH_Y + 0.012, -0.78]}
        rotation={[A_FRAME_ANGLE_RAD, 0, 0]}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial
          key={`aframe-${supportMatKey}`}
          color={spec.color}
          map={supportMatMap}
          metalness={spec.metalness}
          roughness={spec.roughness}
          clearcoat={spec.clearcoat}
          clearcoatRoughness={spec.clearcoatRoughness}
          envMapIntensity={spec.envMapIntensity}
        />
      </mesh>
    </group>
  );
};
