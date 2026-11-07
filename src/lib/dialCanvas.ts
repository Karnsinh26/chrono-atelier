import * as THREE from 'three';
import { DialFinish, HourMarkerStyle } from '../store/useClockStore';

const CANVAS_SIZE = 1024;
const CENTER = CANVAS_SIZE / 2;
/**
 * Half-size of the 1024px canvas (512px).
 * Note: shapes.ts maps this 512px edge isotropically to `innerApothem * 1.18`
 * via applyCenteredIsotropicUVs, so the inner bezel edge lies around ~0.83 * HALF.
 * All dial elements are positioned as fractions of HALF (e.g. track at 0.72, markers at 0.58).
 */
const HALF = CANVAS_SIZE / 2;

const ROMAN_NUMERALS = [
  'XII',
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
];

const ARABIC_NUMERALS = [
  '12',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
];

export interface DialDrawConfig {
  dialColor: string;
  dialFinish: DialFinish;
  hourMarkers: HourMarkerStyle;
  showMinuteTrack: boolean;
  engraving: string;
}

export interface PersistentDialSurface {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
}

export interface DialInkPalette {
  isDarkDial: boolean;
  ink: string;
  mutedInk: string;
  subtleLine: string;
  engraveBevel: string;
}

function parseHexToSRGB(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) / 255;
    const g = parseInt(clean[1] + clean[1], 16) / 255;
    const b = parseInt(clean[2] + clean[2], 16) / 255;
    return [
      Number.isNaN(r) ? 0.9 : r,
      Number.isNaN(g) ? 0.9 : g,
      Number.isNaN(b) ? 0.9 : b,
    ];
  }
  if (clean.length >= 6) {
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    return [
      Number.isNaN(r) ? 0.9 : r,
      Number.isNaN(g) ? 0.9 : g,
      Number.isNaN(b) ? 0.9 : b,
    ];
  }
  return [0.95, 0.93, 0.88];
}

function srgbChannelToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Computes WCAG relative luminance of the dial colour and returns high-contrast
 * dark or light ink colours automatically.
 */
export function getDialInkPalette(dialColor: string): DialInkPalette {
  const [r, g, b] = parseHexToSRGB(dialColor);
  const luminance =
    0.2126 * srgbChannelToLinear(r) +
    0.7152 * srgbChannelToLinear(g) +
    0.0722 * srgbChannelToLinear(b);

  const isDarkDial = luminance < 0.34;

  if (isDarkDial) {
    return {
      isDarkDial: true,
      ink: '#f4f1ea',
      mutedInk: 'rgba(244, 241, 234, 0.56)',
      subtleLine: 'rgba(255, 255, 255, 0.19)',
      engraveBevel: 'rgba(0, 0, 0, 0.65)',
    };
  }

  return {
    isDarkDial: false,
    ink: '#1a1816',
    mutedInk: 'rgba(26, 24, 22, 0.52)',
    subtleLine: 'rgba(20, 18, 15, 0.18)',
    engraveBevel: 'rgba(255, 255, 255, 0.72)',
  };
}

export function drawSpacedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
  spacingPx: number
): void {
  const chars = Array.from(text);
  if (chars.length === 0) return;

  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const totalWidth =
    widths.reduce((acc, w) => acc + w, 0) + spacingPx * (chars.length - 1);

  let cursorX = centerX - totalWidth / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';

  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], cursorX, centerY);
    cursorX += widths[i] + spacingPx;
  }

  ctx.textAlign = prevAlign;
}

/**
 * Creates a single persistent 1024x1024 HTMLCanvasElement + THREE.CanvasTexture
 * to be reused across all dial updates without reallocating GPU textures.
 */
export function createPersistentDialSurface(): PersistentDialSurface {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext('2d')!;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;

  return { canvas, ctx, texture };
}

function drawSunburstFinish(
  ctx: CanvasRenderingContext2D,
  isDarkDial: boolean
): void {
  // Butterfly metallic specular lobes via conic gradient
  if (typeof ctx.createConicGradient === 'function') {
    const conic = ctx.createConicGradient(-Math.PI * 0.32, CENTER, CENTER);
    const hi = isDarkDial ? 'rgba(255, 255, 255, 0.19)' : 'rgba(255, 255, 255, 0.34)';
    const mid = 'rgba(128, 128, 128, 0.0)';
    const lo = isDarkDial ? 'rgba(0, 0, 0, 0.34)' : 'rgba(0, 0, 0, 0.12)';

    conic.addColorStop(0.0, hi);
    conic.addColorStop(0.14, mid);
    conic.addColorStop(0.25, lo);
    conic.addColorStop(0.38, mid);
    conic.addColorStop(0.5, hi);
    conic.addColorStop(0.64, mid);
    conic.addColorStop(0.75, lo);
    conic.addColorStop(0.88, mid);
    conic.addColorStop(1.0, hi);

    ctx.fillStyle = conic;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }

  // Fine radial brushed rays
  ctx.save();
  ctx.translate(CENTER, CENTER);
  const rayCount = 360;
  const maxR = HALF * 1.38;
  ctx.lineWidth = 1.1;

  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2;
    const shimmer = Math.sin(i * 12.9898) * 43758.5453;
    const frac = shimmer - Math.floor(shimmer);

    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 10, Math.sin(angle) * 10);
    ctx.lineTo(Math.cos(angle) * maxR, Math.sin(angle) * maxR);
    ctx.strokeStyle =
      frac > 0.5
        ? isDarkDial
          ? 'rgba(255, 255, 255, 0.038)'
          : 'rgba(255, 255, 255, 0.09)'
        : isDarkDial
          ? 'rgba(0, 0, 0, 0.08)'
          : 'rgba(0, 0, 0, 0.032)';
    ctx.stroke();
  }
  ctx.restore();
}

function drawGuillocheFinish(
  ctx: CanvasRenderingContext2D,
  palette: DialInkPalette
): void {
  ctx.save();
  ctx.translate(CENTER, CENTER);

  const crestStroke = palette.subtleLine;
  const highlightStroke = palette.isDarkDial
    ? 'rgba(255, 255, 255, 0.045)'
    : 'rgba(255, 255, 255, 0.36)';

  // Central engine-turned rosette medallion (0.08 * HALF .. 0.48 * HALF)
  const innerStart = 0.08 * HALF;
  const innerEnd = 0.475 * HALF;
  const ringStep = 6.2;
  const wavePetals = 36;
  const segments = 180;

  let ringIndex = 0;
  for (let baseR = innerStart; baseR <= innerEnd; baseR += ringStep) {
    const phase = (ringIndex % 2) * Math.PI;
    const amp = 3.5 * (0.55 + 0.45 * (baseR / innerEnd));

    // Crisp engraved groove + subtle light catch
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      const offsetR = pass === 0 ? 0 : 1.2;
      for (let s = 0; s <= segments; s++) {
        const theta = (s / segments) * Math.PI * 2;
        const r =
          baseR +
          offsetR +
          amp * Math.sin(wavePetals * theta + phase) +
          1.1 * Math.cos(wavePetals * 0.5 * theta);
        const x = Math.cos(theta) * r;
        const y = Math.sin(theta) * r;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = pass === 0 ? crestStroke : highlightStroke;
      ctx.lineWidth = pass === 0 ? 1.55 : 0.95;
      ctx.stroke();
    }
    ringIndex++;
  }

  // Framing border rings around central guilloché medallion and chapter ring
  const borderRadii = [0.485 * HALF, 0.495 * HALF];
  for (const br of borderRadii) {
    ctx.beginPath();
    ctx.arc(0, 0, br, 0, Math.PI * 2);
    ctx.strokeStyle = palette.subtleLine;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  // Outer perimeter barleycorn wave rings outside the minute track (0.74 * HALF .. 0.86 * HALF)
  let outerIdx = 0;
  for (let baseR = 0.74 * HALF; baseR <= 0.86 * HALF; baseR += 6.8) {
    const phase = (outerIdx % 2) * Math.PI;
    ctx.beginPath();
    for (let s = 0; s <= segments; s++) {
      const theta = (s / segments) * Math.PI * 2;
      const r = baseR + 2.1 * Math.sin(48 * theta + phase);
      const x = Math.cos(theta) * r;
      const y = Math.sin(theta) * r;
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = crestStroke;
    ctx.lineWidth = 1.25;
    ctx.stroke();
    outerIdx++;
  }

  ctx.restore();
}

function drawMinuteTrack(
  ctx: CanvasRenderingContext2D,
  palette: DialInkPalette
): void {
  const outerTrackR = 0.72 * HALF;

  ctx.save();
  ctx.translate(CENTER, CENTER);
  for (let i = 0; i < 60; i++) {
    const angle = (i / 60) * Math.PI * 2 - Math.PI / 2;
    const isHour = i % 5 === 0;
    const innerR = outerTrackR - (isHour ? 0.032 * HALF : 0.018 * HALF);

    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
    ctx.lineTo(Math.cos(angle) * outerTrackR, Math.sin(angle) * outerTrackR);
    ctx.strokeStyle = isHour ? palette.ink : palette.mutedInk;
    ctx.lineWidth = isHour ? 3.2 : 1.6;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  ctx.restore();
}

function drawHourMarkers(
  ctx: CanvasRenderingContext2D,
  style: HourMarkerStyle,
  showMinuteTrack: boolean,
  palette: DialInkPalette
): void {
  ctx.save();
  ctx.fillStyle = palette.ink;
  ctx.strokeStyle = palette.ink;

  if (style === 'dots') {
    const dotRadiusOrbit = (showMinuteTrack ? 0.605 : 0.655) * HALF;
    ctx.translate(CENTER, CENTER);
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const isQuarter = i % 3 === 0;
      const cx = Math.cos(angle) * dotRadiusOrbit;
      const cy = Math.sin(angle) * dotRadiusOrbit;

      if (i === 0) {
        // Double horological orientation dots at 12 o'clock
        const sep = 10.5;
        for (const dir of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(cx + dir * sep, cy, 6.8, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.beginPath();
        ctx.arc(cx, cy, isQuarter ? 9.2 : 6.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    return;
  }

  if (style === 'sticks') {
    const outerR = (showMinuteTrack ? 0.665 : 0.715) * HALF;
    const innerR = (showMinuteTrack ? 0.54 : 0.575) * HALF;
    const batonLen = outerR - innerR;

    ctx.translate(CENTER, CENTER);
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const isQuarter = i % 3 === 0;

      ctx.save();
      ctx.rotate(angle);

      if (i === 0) {
        // Double applied baton at 12 o'clock
        const barW = 6.5;
        const gap = 4.5;
        ctx.beginPath();
        ctx.roundRect(-barW - gap * 0.5, -outerR, barW, batonLen, 2.5);
        ctx.roundRect(gap * 0.5, -outerR, barW, batonLen, 2.5);
        ctx.fill();
      } else {
        const barW = isQuarter ? 8.2 : 5.4;
        ctx.beginPath();
        ctx.roundRect(-barW / 2, -outerR, barW, batonLen, 2.5);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
    return;
  }

  // Arabic or Roman numerals
  const numeralRadius = (showMinuteTrack ? 0.58 : 0.625) * HALF;
  const labels = style === 'arabic' ? ARABIC_NUMERALS : ROMAN_NUMERALS;
  ctx.font =
    style === 'arabic'
      ? '600 44px "Inter", system-ui, sans-serif'
      : '600 41px "Cinzel", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const x = CENTER + Math.cos(angle) * numeralRadius;
    const y = CENTER + Math.sin(angle) * numeralRadius;
    ctx.fillText(labels[i], x, y + 1.5);
  }

  ctx.restore();
}

/**
 * Redraws the persistent 1024x1024 dial canvas in-place from the current dial config.
 */
export function drawDial(
  ctx: CanvasRenderingContext2D,
  config: DialDrawConfig
): void {
  const palette = getDialInkPalette(config.dialColor);

  // 1. Base dial fill
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.fillStyle = config.dialColor;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // 2. Surface finish (plain / sunburst / guilloché)
  if (config.dialFinish === 'sunburst') {
    drawSunburstFinish(ctx, palette.isDarkDial);
  } else if (config.dialFinish === 'guilloche') {
    drawGuillocheFinish(ctx, palette);
  }

  // Subtle studio radial vignette across all finishes
  const vignette = ctx.createRadialGradient(
    CENTER,
    CENTER,
    HALF * 0.08,
    CENTER,
    CENTER,
    HALF * 1.15
  );
  vignette.addColorStop(
    0,
    palette.isDarkDial ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.16)'
  );
  vignette.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(
    1,
    palette.isDarkDial ? 'rgba(0, 0, 0, 0.28)' : 'rgba(0, 0, 0, 0.10)'
  );
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // 3. Optional minute track at 0.72 * HALF
  if (config.showMinuteTrack) {
    drawMinuteTrack(ctx, palette);
  }

  // 4. Hour markers (dots / sticks / arabic / roman)
  drawHourMarkers(ctx, config.hourMarkers, config.showMinuteTrack, palette);

  // 5. Custom engraved text above center + small "HANDCRAFTED" below center (only when engraving is non-empty)
  const trimmedEngraving = config.engraving.trim().toUpperCase();
  if (trimmedEngraving.length > 0) {
    ctx.save();
    ctx.textBaseline = 'middle';
    const fontSize = trimmedEngraving.length > 14 ? 17 : 20;
    const spacing = trimmedEngraving.length > 14 ? 3.0 : 4.2;
    ctx.font = `600 ${fontSize}px "Cinzel", Georgia, serif`;

    const engraveY = CENTER - 0.26 * HALF;
    // Subtle engraved letterpress bevel offset
    ctx.fillStyle = palette.engraveBevel;
    drawSpacedText(ctx, trimmedEngraving, CENTER, engraveY + 1.2, spacing);

    ctx.fillStyle = palette.ink;
    drawSpacedText(ctx, trimmedEngraving, CENTER, engraveY, spacing);

    ctx.fillStyle = palette.mutedInk;
    ctx.font = '500 13px "Inter", system-ui, sans-serif';
    drawSpacedText(ctx, 'HANDCRAFTED', CENTER, CENTER + 0.275 * HALF, 4.0);
    ctx.restore();
  }
}
