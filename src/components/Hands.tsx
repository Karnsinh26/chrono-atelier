import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CASE_MATERIAL_SPECS } from '../lib/materials';
import { buildHandGeometries, disposeHandGeometries } from '../lib/shapes';
import { useClockStore } from '../store/useClockStore';

interface HandsProps {
  innerApothem: number;
}

const REFERENCE_INNER_APOTHEM = 1.78;

/**
 * Hand & Pinion Z-stack (all cleanly separated between dial at +0.015 and glass at +0.205):
 * - Hour hand: group z = +0.054 -> world Z [+0.050, +0.074]
 * - Minute hand: group z = +0.096 -> world Z [+0.092, +0.114]
 * - Seconds hand: group z = +0.132 -> world Z [+0.130, +0.144]
 * - Center pinion stem: world Z [+0.025, +0.155]
 * - Center cap: world Z [+0.155, +0.179]
 *
 * Hand XY lengths scale proportionally with innerApothem so they never cross the bezel.
 */
export const Hands: React.FC<HandsProps> = ({ innerApothem }) => {
  const handStyle = useClockStore((s) => s.handStyle);
  const handColor = useClockStore((s) => s.handColor);
  const showSeconds = useClockStore((s) => s.showSeconds);
  const secondsColor = useClockStore((s) => s.secondsColor);
  const secondsMode = useClockStore((s) => s.secondsMode);
  const caseMat = useClockStore((s) => s.caseMat);

  const hourGroupRef = useRef<THREE.Group>(null);
  const minuteGroupRef = useRef<THREE.Group>(null);
  const secondGroupRef = useRef<THREE.Group>(null);

  const handGeometries = useMemo(() => buildHandGeometries(handStyle), [handStyle]);

  useEffect(() => {
    return () => {
      disposeHandGeometries(handGeometries);
    };
  }, [handGeometries]);

  const handScale = innerApothem / REFERENCE_INNER_APOTHEM;
  const pinionColor = CASE_MATERIAL_SPECS[caseMat].pinionColor;

  useFrame(() => {
    const now = new Date();
    const ms = now.getMilliseconds();
    const rawSec = now.getSeconds();
    const continuousSec = rawSec + ms / 1000;
    const displaySec = secondsMode === 'sweep' ? continuousSec : rawSec;

    const minutes = now.getMinutes() + continuousSec / 60;
    const hours = (now.getHours() % 12) + minutes / 60;

    const hourAngle = (hours / 12) * Math.PI * 2;
    const minuteAngle = (minutes / 60) * Math.PI * 2;
    const secondAngle = (displaySec / 60) * Math.PI * 2;

    if (hourGroupRef.current) {
      hourGroupRef.current.rotation.z = -hourAngle;
    }
    if (minuteGroupRef.current) {
      minuteGroupRef.current.rotation.z = -minuteAngle;
    }
    if (secondGroupRef.current) {
      secondGroupRef.current.rotation.z = -secondAngle;
    }
  });

  return (
    <group>
      {/* Hour hand: world Z [+0.050, +0.074] */}
      <group
        ref={hourGroupRef}
        position={[0, 0, 0.054]}
        scale={[handScale, handScale, 1]}
      >
        <mesh geometry={handGeometries.hourGeometry} renderOrder={2} castShadow>
          <meshPhysicalMaterial
            color={handColor}
            metalness={0.55}
            roughness={0.28}
            clearcoat={0.3}
          />
        </mesh>
      </group>

      {/* Minute hand: world Z [+0.092, +0.114] */}
      <group
        ref={minuteGroupRef}
        position={[0, 0, 0.096]}
        scale={[handScale, handScale, 1]}
      >
        <mesh geometry={handGeometries.minuteGeometry} renderOrder={3} castShadow>
          <meshPhysicalMaterial
            color={handColor}
            metalness={0.55}
            roughness={0.28}
            clearcoat={0.3}
          />
        </mesh>
      </group>

      {/* Seconds hand: world Z [+0.130, +0.144] */}
      {showSeconds && (
        <group
          ref={secondGroupRef}
          position={[0, 0, 0.132]}
          scale={[handScale, handScale, 1]}
        >
          <mesh geometry={handGeometries.secondGeometry} renderOrder={4} castShadow>
            <meshPhysicalMaterial
              color={secondsColor}
              metalness={0.45}
              roughness={0.25}
              clearcoat={0.4}
            />
          </mesh>
        </group>
      )}

      {/* Center pinion sleeve: world Z [+0.025, +0.155] */}
      <mesh
        position={[0, 0, 0.09]}
        rotation={[Math.PI / 2, 0, 0]}
        renderOrder={5}
        castShadow
      >
        <cylinderGeometry args={[0.072, 0.082, 0.13, 32]} />
        <meshPhysicalMaterial
          color={pinionColor}
          metalness={0.92}
          roughness={0.2}
          envMapIntensity={1.35}
        />
      </mesh>

      {/* Top center cap: world Z [+0.155, +0.179] */}
      <mesh
        position={[0, 0, 0.167]}
        rotation={[Math.PI / 2, 0, 0]}
        renderOrder={6}
      >
        <cylinderGeometry args={[0.054, 0.064, 0.024, 32]} />
        <meshPhysicalMaterial
          color={showSeconds ? secondsColor : handColor}
          metalness={0.7}
          roughness={0.2}
          clearcoat={0.5}
        />
      </mesh>
    </group>
  );
};
