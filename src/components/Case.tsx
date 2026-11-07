import React, { useMemo } from 'react';
import * as THREE from 'three';
import { CASE_MATERIAL_SPECS, getWalnutWoodTexture } from '../lib/materials';
import { CaseGeometryBundle } from '../lib/shapes';
import { useClockStore } from '../store/useClockStore';

interface CaseProps {
  geometries: CaseGeometryBundle;
}

const CASEBACK_CIRCLE_RADIUS = 1.305;
const SCREW_ANGLES = [
  Math.PI * 0.25,
  Math.PI * 0.75,
  Math.PI * 1.25,
  Math.PI * 1.75,
];
const SCREW_SLOT_ROTATIONS = [0.42, -0.68, 1.08, -0.28];

const cachedCaseBackTextures: Record<'light' | 'dark', THREE.CanvasTexture | null> = {
  light: null,
  dark: null,
};

function drawTrackedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  letterSpacing: number
): void {
  const chars = Array.from(text);
  let totalWidth = 0;
  const widths = chars.map((ch) => {
    const w = ctx.measureText(ch).width;
    totalWidth += w;
    return w;
  });
  totalWidth += Math.max(0, chars.length - 1) * letterSpacing;

  let x = cx - totalWidth / 2;
  ctx.textAlign = 'left';
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], x, cy);
    x += widths[i] + letterSpacing;
  }
}

/**
 * Generates a crisp 512px transparent CanvasTexture for the case back:
 * - Subtle engraved double circle at r = 1.305 world units
 * - Tiny "CHRONO ATELIER · No. 001" horological engraving + serial hallmark
 */
function getCaseBackEngravingTexture(isDarkCase: boolean): THREE.CanvasTexture {
  const key = isDarkCase ? 'dark' : 'light';
  if (cachedCaseBackTextures[key]) {
    return cachedCaseBackTextures[key]!;
  }

  const size = 512;
  const half = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  const primaryStroke = isDarkCase
    ? 'rgba(235, 198, 126, 0.78)'
    : 'rgba(26, 20, 15, 0.78)';
  const bevelStroke = isDarkCase
    ? 'rgba(0, 0, 0, 0.55)'
    : 'rgba(255, 255, 255, 0.28)';
  const secondaryStroke = isDarkCase
    ? 'rgba(235, 198, 126, 0.38)'
    : 'rgba(26, 20, 15, 0.36)';

  // Outer engraved circle (maps to radius ~1.305 on a 1.55-radius mesh: 1.305/1.55 * 256 = 215.5px)
  const outerR = 215.5;
  const innerR = 194.0;

  // Bevel highlight ring
  ctx.beginPath();
  ctx.arc(half, half + 0.8, outerR, 0, Math.PI * 2);
  ctx.strokeStyle = bevelStroke;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Main engraved outer circle
  ctx.beginPath();
  ctx.arc(half, half, outerR, 0, Math.PI * 2);
  ctx.strokeStyle = primaryStroke;
  ctx.lineWidth = 2.0;
  ctx.stroke();

  // Subtle inner concentric groove
  ctx.beginPath();
  ctx.arc(half, half, innerR, 0, Math.PI * 2);
  ctx.strokeStyle = secondaryStroke;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Tiny "CHRONO ATELIER · No. 001" engraved text in the upper medallion
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.font = '600 16px "Inter", Georgia, serif';
  const mainY = half - 86;
  ctx.fillStyle = bevelStroke;
  drawTrackedText(ctx, 'CHRONO ATELIER · No. 001', half, mainY + 0.7, 2.0);
  ctx.fillStyle = primaryStroke;
  drawTrackedText(ctx, 'CHRONO ATELIER · No. 001', half, mainY, 2.0);

  // Subtle horological hallmark line below
  ctx.font = '500 11px "Inter", system-ui, sans-serif';
  const subY = half - 58;
  ctx.fillStyle = secondaryStroke;
  drawTrackedText(ctx, 'BESPOKE HOROLOGY · CALIBRE I', half, subY, 2.6);

  // Small central medallion emblem (compass cross + concentric ring)
  ctx.beginPath();
  ctx.arc(half, half, 22, 0, Math.PI * 2);
  ctx.strokeStyle = secondaryStroke;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(half - 32, half);
  ctx.lineTo(half + 32, half);
  ctx.moveTo(half, half - 32);
  ctx.lineTo(half, half + 32);
  ctx.strokeStyle = secondaryStroke;
  ctx.lineWidth = 1.0;
  ctx.stroke();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;

  cachedCaseBackTextures[key] = tex;
  return tex;
}

/**
 * Strict Z-layering preserved from Phase 1 fix:
 * - Caseback engraving & 4 screws: world Z [-0.304, -0.291] facing -Z
 * - Back body: position z = -0.26, local [-0.03, +0.23] -> world Z [-0.290, -0.030]
 * - Dial (in Dial.tsx): world Z +0.015 (0.045 clear gap in front of back body's +bevel face!)
 * - Hands & Center cap (in Hands.tsx): world Z +0.050 .. +0.179
 * - Glass crystal: world Z +0.205 (transparent, depthWrite: false, renderOrder: 10)
 * - Bezel ring: position z = -0.05, local [-0.03, +0.305] -> world Z [-0.080, +0.255]
 *
 * Changing caseMat swaps ONLY material properties and never rebuilds geometry.
 */
export const Case: React.FC<CaseProps> = ({ geometries }) => {
  const caseMat = useClockStore((s) => s.caseMat);
  const spec = CASE_MATERIAL_SPECS[caseMat];

  const woodTexture = useMemo(
    () => (spec.useWoodTexture ? getWalnutWoodTexture() : null),
    [spec.useWoodTexture]
  );

  const isDarkCase = caseMat === 'black' || caseMat === 'walnut';
  const caseBackTexture = useMemo(
    () => getCaseBackEngravingTexture(isDarkCase),
    [isDarkCase]
  );

  const matKey = spec.useWoodTexture ? 'wood-mat' : 'solid-mat';
  const screwMetalColor =
    caseMat === 'black'
      ? '#7c808a'
      : caseMat === 'walnut'
      ? '#d9b25a'
      : caseMat === 'ceramic'
      ? '#c8ccd4'
      : spec.pinionColor;

  return (
    <group>
      {/* Back solid body (frontmost face including bevel ends at z = -0.030; rear face is at z = -0.290) */}
      <mesh geometry={geometries.backGeometry} position={[0, 0, -0.26]}>
        <meshPhysicalMaterial
          key={`back-${matKey}`}
          color={spec.color}
          map={woodTexture}
          metalness={spec.metalness}
          roughness={Math.min(1, spec.roughness + 0.04)}
          clearcoat={spec.clearcoat}
          clearcoatRoughness={spec.clearcoatRoughness}
          envMapIntensity={spec.envMapIntensity}
        />
      </mesh>

      {/* Case Back Detail (rear face z = -0.290 facing -Z): engraved circle + "CHRONO ATELIER · No. 001" + 4 screw heads */}
      <group position={[0, 0, -0.291]} rotation={[0, Math.PI, 0]}>
        {/* Engraved circle & serial text decal plane */}
        <mesh position={[0, 0, 0.001]} renderOrder={1}>
          <circleGeometry args={[1.55, 64]} />
          <meshBasicMaterial
            map={caseBackTexture}
            transparent
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>

        {/* 4 small watchmaker screw heads on the engraved circle perimeter */}
        {SCREW_ANGLES.map((angle, idx) => {
          const sx = Math.cos(angle) * CASEBACK_CIRCLE_RADIUS;
          const sy = Math.sin(angle) * CASEBACK_CIRCLE_RADIUS;
          return (
            <group key={idx} position={[sx, sy, 0]}>
              {/* Recessed screw collar ring */}
              <mesh position={[0, 0, 0.0015]}>
                <ringGeometry args={[0.052, 0.068, 24]} />
                <meshBasicMaterial
                  color={isDarkCase ? '#09090b' : '#272522'}
                  transparent
                  opacity={0.55}
                  depthWrite={false}
                />
              </mesh>
              {/* Cylindrical metallic screw head */}
              <mesh position={[0, 0, 0.006]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.052, 0.052, 0.012, 24]} />
                <meshPhysicalMaterial
                  color={screwMetalColor}
                  metalness={0.95}
                  roughness={0.2}
                  clearcoat={0.3}
                  envMapIntensity={1.4}
                />
              </mesh>
              {/* Screw driver slot groove */}
              <mesh
                position={[0, 0, 0.0125]}
                rotation={[0, 0, SCREW_SLOT_ROTATIONS[idx]]}
              >
                <boxGeometry args={[0.086, 0.013, 0.004]} />
                <meshBasicMaterial color="#141312" />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* Bezel ring (outer shape with matching inner hole; bezel front reaches z = +0.255) */}
      <mesh
        geometry={geometries.bezelGeometry}
        position={[0, 0, -0.05]}
        castShadow
        receiveShadow
      >
        <meshPhysicalMaterial
          key={`bezel-${matKey}`}
          color={spec.color}
          map={woodTexture}
          metalness={spec.metalness}
          roughness={spec.roughness}
          clearcoat={spec.clearcoat}
          clearcoatRoughness={spec.clearcoatRoughness}
          envMapIntensity={spec.envMapIntensity}
        />
      </mesh>

      {/* Thin protective watch/clock crystal glass (z = +0.205, behind bezel front +0.255) */}
      <mesh
        geometry={geometries.glassGeometry}
        position={[0, 0, 0.205]}
        renderOrder={10}
      >
        <meshPhysicalMaterial
          color="#ffffff"
          transparent
          opacity={0.14}
          roughness={0.04}
          metalness={0.08}
          reflectivity={1}
          clearcoat={1}
          clearcoatRoughness={0.03}
          envMapIntensity={2.1}
          depthWrite={false}
          side={THREE.FrontSide}
        />
      </mesh>
    </group>
  );
};
