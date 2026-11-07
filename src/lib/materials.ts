import * as THREE from 'three';
import { CaseMaterial } from '../store/useClockStore';

export interface CaseMaterialSpec {
  label: string;
  alloyTitle: string;
  swatchCss: string;
  color: string;
  metalness: number;
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  envMapIntensity: number;
  useWoodTexture?: boolean;
  pinionColor: string;
}

export const CASE_MATERIAL_SPECS: Record<CaseMaterial, CaseMaterialSpec> = {
  gold: {
    label: 'Gold',
    alloyTitle: '18k Brushed Gold',
    swatchCss: 'linear-gradient(135deg, #f3d27e 0%, #d9b25a 55%, #9e7829 100%)',
    color: '#d9b25a',
    metalness: 1,
    roughness: 0.22,
    clearcoat: 0.15,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.35,
    pinionColor: '#d9b25a',
  },
  roseGold: {
    label: 'Rose gold',
    alloyTitle: '18k Rose Gold',
    swatchCss: 'linear-gradient(135deg, #f5c6b0 0%, #e3a98d 55%, #a86c52 100%)',
    color: '#e3a98d',
    metalness: 1,
    roughness: 0.24,
    clearcoat: 0.15,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.35,
    pinionColor: '#e3a98d',
  },
  steel: {
    label: 'Steel',
    alloyTitle: '316L Surgical Steel',
    swatchCss: 'linear-gradient(135deg, #f4f6fa 0%, #d6d8dd 55%, #8a909c 100%)',
    color: '#d6d8dd',
    metalness: 1,
    roughness: 0.18,
    clearcoat: 0.15,
    clearcoatRoughness: 0.16,
    envMapIntensity: 1.35,
    pinionColor: '#d6d8dd',
  },
  black: {
    label: 'Matte black',
    alloyTitle: 'PVD Matte Black',
    swatchCss: 'linear-gradient(135deg, #3a3b40 0%, #232326 60%, #121214 100%)',
    color: '#232326',
    metalness: 0.55,
    roughness: 0.42,
    clearcoat: 0.08,
    clearcoatRoughness: 0.4,
    envMapIntensity: 1.1,
    pinionColor: '#2f3035',
  },
  walnut: {
    label: 'Walnut',
    alloyTitle: 'American Black Walnut',
    swatchCss: 'linear-gradient(135deg, #7c4d2b 0%, #4b2c17 55%, #2b170b 100%)',
    color: '#ffffff',
    metalness: 0,
    roughness: 0.55,
    clearcoat: 0.4,
    clearcoatRoughness: 0.28,
    envMapIntensity: 0.95,
    useWoodTexture: true,
    pinionColor: '#c99e52',
  },
  ceramic: {
    label: 'Ceramic',
    alloyTitle: 'High-Gloss Ceramic',
    swatchCss: 'linear-gradient(135deg, #ffffff 0%, #f3f2ee 65%, #cfcdc4 100%)',
    color: '#f3f2ee',
    metalness: 0,
    roughness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.4,
    pinionColor: '#d6d8dd',
  },
};

let cachedWalnutTexture: THREE.CanvasTexture | null = null;

/**
 * Generates a seamless procedural Walnut wood-grain CanvasTexture
 * (rich dark brown heartwood with organic wavy lighter grain stripes and fine wood pores).
 */
export function getWalnutWoodTexture(): THREE.CanvasTexture {
  if (cachedWalnutTexture) {
    return cachedWalnutTexture;
  }

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;

  const twoPi = Math.PI * 2;

  for (let py = 0; py < size; py++) {
    const ny = py / size;
    for (let px = 0; px < size; px++) {
      const nx = px / size;

      // Seamless periodic domain warp for wavy walnut cathedral grain
      const warp =
        0.55 * Math.sin(twoPi * (ny * 1.0 + nx * 1.0)) +
        0.32 * Math.sin(twoPi * (ny * 2.0 - nx * 1.0) + 1.4) +
        0.18 * Math.sin(twoPi * (ny * 4.0 + nx * 2.0) + 2.7);

      // Wavy vertical stripes across X with organic Y undulation
      const bandPhase = twoPi * (nx * 6.0) + warp * 2.6;
      const primaryGrain = 0.5 + 0.5 * Math.sin(bandPhase);
      const secondaryGrain = 0.5 + 0.5 * Math.sin(bandPhase * 2.0 + 0.9);
      const fineFiber =
        0.5 +
        0.5 *
          Math.sin(
            twoPi * (nx * 46.0 + 0.15 * Math.sin(twoPi * ny * 3.0)) +
              twoPi * ny * 2.0
          );

      // Sharpen lighter wavy stripes characteristic of figured walnut
      const stripe = Math.pow(primaryGrain, 1.65) * 0.68 + secondaryGrain * 0.22 + fineFiber * 0.1;

      // Dark brown base (#2b180c) -> warm walnut mid (#5b371e) -> lighter wavy stripe (#8a5632)
      const r = Math.round(43 + stripe * 95);
      const g = Math.round(24 + stripe * 61);
      const b = Math.round(12 + stripe * 37);

      // Subtle dark wood vessel pores
      const poreSignal = Math.sin(twoPi * (nx * 92.0 + ny * 3.0)) * Math.cos(twoPi * (ny * 19.0));
      const poreDarken = poreSignal > 0.92 ? 0.82 : 1.0;

      const idx = (py * size + px) * 4;
      data[idx] = Math.min(255, Math.round(r * poreDarken));
      data[idx + 1] = Math.min(255, Math.round(g * poreDarken));
      data[idx + 2] = Math.min(255, Math.round(b * poreDarken));
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(0.22, 0.22);
  texture.offset.set(0.5, 0.5);
  texture.anisotropy = 8;
  texture.needsUpdate = true;

  cachedWalnutTexture = texture;
  return texture;
}
