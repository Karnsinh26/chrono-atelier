import React, { useMemo } from 'react';
import * as THREE from 'three';
import { CASE_MATERIAL_SPECS, getWalnutWoodTexture } from '../lib/materials';
import { CaseGeometryBundle } from '../lib/shapes';
import { useClockStore } from '../store/useClockStore';

interface CaseProps {
  geometries: CaseGeometryBundle;
}

/**
 * Strict Z-layering preserved from Phase 1 fix:
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

  const matKey = spec.useWoodTexture ? 'wood-mat' : 'solid-mat';

  return (
    <group>
      {/* Back solid body (frontmost face including bevel ends at z = -0.030; overlaps bezel Z [-0.080, -0.030] with zero gap) */}
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
