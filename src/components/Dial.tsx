import React, { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { createPersistentDialSurface, drawDial } from '../lib/dialCanvas';
import { useClockStore } from '../store/useClockStore';

interface DialProps {
  geometry: THREE.ShapeGeometry;
}

export const Dial: React.FC<DialProps> = ({ geometry }) => {
  const gl = useThree((s) => s.gl);

  const dialColor = useClockStore((s) => s.dialColor);
  const dialFinish = useClockStore((s) => s.dialFinish);
  const hourMarkers = useClockStore((s) => s.hourMarkers);
  const showMinuteTrack = useClockStore((s) => s.showMinuteTrack);
  const engraving = useClockStore((s) => s.engraving);

  const [fontsLoadedTick, setFontsLoadedTick] = useState(0);

  // Single persistent 1024px canvas + CanvasTexture created once and disposed on unmount
  const surface = useMemo(() => createPersistentDialSurface(), []);

  useEffect(() => {
    surface.texture.anisotropy = gl.capabilities.getMaxAnisotropy();
    surface.texture.needsUpdate = true;
  }, [gl, surface]);

  useEffect(() => {
    return () => {
      surface.texture.dispose();
    };
  }, [surface]);

  useEffect(() => {
    let active = true;
    if (document.fonts && typeof document.fonts.load === 'function') {
      Promise.all([
        document.fonts.load('600 41px "Cinzel"'),
        document.fonts.load('600 44px "Inter"'),
      ])
        .then(() => {
          if (active) {
            setFontsLoadedTick((t) => t + 1);
          }
        })
        .catch(() => {
          // Ignore font load errors when offline
        });
    }
    return () => {
      active = false;
    };
  }, []);

  // Redraws in-place onto the single persistent canvas whenever any dial field changes
  useEffect(() => {
    drawDial(surface.ctx, {
      dialColor,
      dialFinish,
      hourMarkers,
      showMinuteTrack,
      engraving,
    });
    surface.texture.needsUpdate = true;
  }, [
    surface,
    dialColor,
    dialFinish,
    hourMarkers,
    showMinuteTrack,
    engraving,
    fontsLoadedTick,
  ]);

  const materialFinishProps =
    dialFinish === 'sunburst'
      ? { roughness: 0.34, metalness: 0.32 }
      : dialFinish === 'guilloche'
        ? { roughness: 0.45, metalness: 0.14 }
        : { roughness: 0.56, metalness: 0.05 };

  // Dial sits at z = +0.015 (0.045 units in front of back body's front bevel at -0.030)
  return (
    <mesh
      geometry={geometry}
      position={[0, 0, 0.015]}
      renderOrder={1}
      receiveShadow
    >
      <meshStandardMaterial
        map={surface.texture}
        roughness={materialFinishProps.roughness}
        metalness={materialFinishProps.metalness}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-1}
      />
    </mesh>
  );
};
