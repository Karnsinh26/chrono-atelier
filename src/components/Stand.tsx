import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CASE_MATERIAL_SPECS, getWalnutWoodTexture } from '../lib/materials';
import { CLOCK_OUTER_APOTHEM } from '../lib/shapes';
import { useClockStore } from '../store/useClockStore';

interface StandProps {
  children: React.ReactNode;
}

const DESK_TILT_RAD = THREE.MathUtils.degToRad(6); // ~6° backward tilt
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

function createRoundedRectShape(width: number, depth: number, radius: number): THREE.Shape {
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

  const segs = 12;
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

interface DeskStandBundle {
  baseGeometry: THREE.ExtrudeGeometry;
  footPlateGeometry: THREE.ExtrudeGeometry;
  strutGeometry: THREE.ExtrudeGeometry;
  backCollarGeometry: THREE.ExtrudeGeometry;
}

function buildDeskStandGeometries(): DeskStandBundle {
  // 1. Base block plinth (extruded along local Z then rotated -PI/2 around X so top sits flush at DESK_TOUCH_Y)
  const bevel = 0.024;
  const baseBodyDepth = BASE_HEIGHT - bevel * 2;
  const baseShape = createRoundedRectShape(2.88 - bevel * 2, 1.42 - bevel * 2, 0.18);
  const baseGeometry = new THREE.ExtrudeGeometry(baseShape, {
    depth: baseBodyDepth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
  });

  // 2. Foot plate resting on rear of base block
  const footBevel = 0.008;
  const footShape = createRoundedRectShape(0.84, 0.44, 0.09);
  const footPlateGeometry = new THREE.ExtrudeGeometry(footShape, {
    depth: 0.032,
    bevelEnabled: true,
    bevelThickness: footBevel,
    bevelSize: footBevel,
    bevelSegments: 3,
  });

  // 3. Sculpted rear support leg (profile in Z-Y plane, extruded along X, centered at x = 0)
  const strutProfile = new THREE.Shape();
  const yBottom = DESK_TOUCH_Y + 0.015;
  const yTop = -0.62;
  strutProfile.moveTo(-0.56, yBottom);
  strutProfile.lineTo(-0.3, yBottom);
  strutProfile.lineTo(-0.19, yTop);
  strutProfile.lineTo(-0.35, yTop + 0.06);
  strutProfile.closePath();

  const strutWidth = 0.44;
  const strutGeometry = new THREE.ExtrudeGeometry(strutProfile, {
    depth: strutWidth,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.012,
    bevelSegments: 3,
  });
  strutGeometry.translate(0, 0, -strutWidth / 2);
  strutGeometry.rotateY(-Math.PI / 2);

  // 4. Rear mounting collar plate flush against the clock's back body (z_local = -0.290)
  const collarShape = createRoundedRectShape(0.82, 0.72, 0.14);
  const backCollarGeometry = new THREE.ExtrudeGeometry(collarShape, {
    depth: 0.035,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 3,
  });

  return {
    baseGeometry,
    footPlateGeometry,
    strutGeometry,
    backCollarGeometry,
  };
}

export const Stand: React.FC<StandProps> = ({ children }) => {
  const mount = useClockStore((s) => s.mount);
  const caseMat = useClockStore((s) => s.caseMat);

  const spec = CASE_MATERIAL_SPECS[caseMat];
  const walnutTexture = useMemo(() => getWalnutWoodTexture(), []);
  const wallShadowTex = useMemo(() => getWallShadowTexture(), []);
  const wallShadowMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const standGeos = useMemo(() => buildDeskStandGeometries(), []);

  useEffect(() => {
    return () => {
      standGeos.baseGeometry.dispose();
      standGeos.footPlateGeometry.dispose();
      standGeos.strutGeometry.dispose();
      standGeos.backCollarGeometry.dispose();
    };
  }, [standGeos]);

  // Fade wall shadow plane opacity based on camera viewing angle so it never looks like a floating card
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

  // Desk mount: base block + case-material rear support leg + clock tilted back ~6°
  const baseBottomLocalOriginY = DESK_FLOOR_Y + 0.024;

  return (
    <group>
      {/* Tilted clock + rear collar plate attached flush to caseback */}
      <group
        position={[0, DESK_CLOCK_OFFSET_Y, 0]}
        rotation={[-DESK_TILT_RAD, 0, 0]}
      >
        {children}

        {/* Rear collar plate flush against back body (z_local <= -0.290) */}
        <mesh
          geometry={standGeos.backCollarGeometry}
          position={[0, -0.82, -0.333]}
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

      {/* Base block: Walnut if case is walnut, otherwise dark architectural stone #2a2522 */}
      <mesh
        geometry={standGeos.baseGeometry}
        position={[0, baseBottomLocalOriginY, 0.02]}
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

      {/* Rear support foot plate on top of base block (uses case material) */}
      <mesh
        geometry={standGeos.footPlateGeometry}
        position={[0, DESK_TOUCH_Y + 0.008, -0.42]}
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

      {/* Angled rear support leg bracing the tilted clock (uses case material) */}
      <mesh geometry={standGeos.strutGeometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          key={`strut-${supportMatKey}`}
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
