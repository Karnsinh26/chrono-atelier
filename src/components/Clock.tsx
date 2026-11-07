import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { buildCaseGeometries, disposeCaseGeometries } from '../lib/shapes';
import { CaseShape, useClockStore } from '../store/useClockStore';
import { Case } from './Case';
import { Dial } from './Dial';
import { Hands } from './Hands';
import { Stand } from './Stand';

const SHAPE_TRANSITION_DURATION = 0.25; // ~250ms scale-down & scale-up

export const Clock: React.FC = () => {
  const shape = useClockStore((s) => s.shape);
  const bezel = useClockStore((s) => s.bezel);
  const transitionTick = useClockStore((s) => s.transitionTick);

  const [displayedShape, setDisplayedShape] = useState<CaseShape>(shape);
  const scaleGroupRef = useRef<THREE.Group>(null);

  const animRef = useRef<{
    active: boolean;
    elapsed: number;
    swapped: boolean;
    targetShape: CaseShape;
    lastTick: number;
  }>({
    active: false,
    elapsed: 0,
    swapped: true,
    targetShape: shape,
    lastTick: transitionTick,
  });

  // Trigger smooth ~250ms scale-down/scale-up when switching case shape or preset
  useEffect(() => {
    const shapeChanged = shape !== animRef.current.targetShape;
    const tickChanged = transitionTick !== animRef.current.lastTick;

    if (shapeChanged || tickChanged) {
      animRef.current = {
        active: true,
        elapsed: 0,
        swapped: !shapeChanged,
        targetShape: shape,
        lastTick: transitionTick,
      };
    }
  }, [shape, transitionTick]);

  useFrame((_, delta) => {
    const anim = animRef.current;
    if (!anim.active || !scaleGroupRef.current) return;

    anim.elapsed += Math.min(delta, 0.05);
    const t = Math.min(1, anim.elapsed / SHAPE_TRANSITION_DURATION);

    if (t >= 0.45 && !anim.swapped) {
      anim.swapped = true;
      setDisplayedShape(anim.targetShape);
    }

    const scaleDip = 1 - 0.11 * Math.sin(t * Math.PI);
    scaleGroupRef.current.scale.setScalar(scaleDip);

    if (t >= 1) {
      anim.active = false;
      scaleGroupRef.current.scale.setScalar(1);
    }
  });

  // Only rebuilds geometries when shape or bezel changes — never when material changes
  const geometries = useMemo(
    () => buildCaseGeometries(displayedShape, bezel),
    [displayedShape, bezel]
  );

  useEffect(() => {
    return () => {
      disposeCaseGeometries(geometries);
    };
  }, [geometries]);

  return (
    <Stand>
      <group ref={scaleGroupRef}>
        <Case geometries={geometries} />
        <Dial geometry={geometries.dialGeometry} />
        <Hands innerApothem={geometries.innerApothem} />
      </group>
    </Stand>
  );
};
