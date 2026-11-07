import * as THREE from 'three';
import { CaseShape, HandStyle } from '../store/useClockStore';

export const CLOCK_OUTER_APOTHEM = 2.0;
export const CLOCK_OUTER_RADIUS = CLOCK_OUTER_APOTHEM;

export interface ShapeResult {
  shape: THREE.Shape;
  holePath: THREE.Path;
  maxExtent: number;
}

function buildShapeAndHoleFromCCWPoints(points: THREE.Vector2[], maxExtent: number): ShapeResult {
  const shape = new THREE.Shape();
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (i === 0) {
      shape.moveTo(p.x, p.y);
    } else {
      shape.lineTo(p.x, p.y);
    }
  }
  shape.closePath();

  // Reverse points for clockwise inner hole contour
  const holePath = new THREE.Path();
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    if (i === points.length - 1) {
      holePath.moveTo(p.x, p.y);
    } else {
      holePath.lineTo(p.x, p.y);
    }
  }
  holePath.closePath();

  return { shape, holePath, maxExtent };
}

/**
 * Generates a centered, smooth THREE.Shape (plus matching CW hole Path and maxExtent)
 * for round, rounded-square, and flat-top hexagon clock profiles:
 * - round: circle with radius = apothem
 * - square: rounded square with half-size = apothem, default cornerRadius = 28% of apothem
 * - hexagon: flat top & bottom; circumradius = apothem / cos(30°) so total height = 2 * apothem
 */
export function makeShape(
  type: CaseShape,
  apothem: number,
  cornerRadius?: number
): ShapeResult {
  const points: THREE.Vector2[] = [];

  if (type === 'round') {
    const segments = 128;
    for (let i = 0; i < segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector2(Math.cos(theta) * apothem, Math.sin(theta) * apothem));
    }
    return buildShapeAndHoleFromCCWPoints(points, apothem);
  }

  if (type === 'square') {
    const rawCorner = cornerRadius ?? apothem * 0.28;
    const r = THREE.MathUtils.clamp(rawCorner, 0.05, apothem * 0.48);
    const c = apothem - r;
    const corners = [
      { cx: c, cy: c, start: 0 },
      { cx: -c, cy: c, start: Math.PI * 0.5 },
      { cx: -c, cy: -c, start: Math.PI },
      { cx: c, cy: -c, start: Math.PI * 1.5 },
    ];
    const arcSegments = 24;
    for (const corner of corners) {
      for (let j = 0; j < arcSegments; j++) {
        const t = j / (arcSegments - 1);
        const angle = corner.start + t * (Math.PI * 0.5);
        points.push(
          new THREE.Vector2(
            corner.cx + Math.cos(angle) * r,
            corner.cy + Math.sin(angle) * r
          )
        );
      }
    }
    const maxExtent = Math.hypot(c, c) + r;
    return buildShapeAndHoleFromCCWPoints(points, maxExtent);
  }

  // Flat-top / flat-bottom hexagon: height = 2 * apothem, circumradius = apothem / cos(30°)
  const cos30 = Math.cos(Math.PI / 6);
  const rawCorner = cornerRadius ?? apothem * 0.12;
  const r = THREE.MathUtils.clamp(rawCorner, 0.04, apothem * 0.26);
  const filletCenterRadius = (apothem - r) / cos30;
  const arcSegments = 16;

  for (let k = 0; k < 6; k++) {
    const vertexAngle = (k * Math.PI) / 3;
    const cx = Math.cos(vertexAngle) * filletCenterRadius;
    const cy = Math.sin(vertexAngle) * filletCenterRadius;
    const startAngle = vertexAngle - Math.PI / 6;
    const sweep = Math.PI / 3;

    for (let j = 0; j < arcSegments; j++) {
      const t = j / (arcSegments - 1);
      const angle = startAngle + t * sweep;
      points.push(new THREE.Vector2(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r));
    }
  }

  const maxExtent = filletCenterRadius + r;
  return buildShapeAndHoleFromCCWPoints(points, maxExtent);
}

/**
 * Remaps dial/glass UVs isotropically (equal X and Y scale centered at 0.5, 0.5)
 * so the 1024px canvas texture is never stretched on square or hexagon shapes,
 * and hour markers always scale cleanly inside the inner dial opening.
 */
function applyCenteredIsotropicUVs(geometry: THREE.BufferGeometry, uvHalfSpan: number): void {
  const pos = geometry.attributes.position;
  const uvs = new Float32Array(pos.count * 2);
  const span = uvHalfSpan * 2;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    uvs[i * 2] = x / span + 0.5;
    uvs[i * 2 + 1] = y / span + 0.5;
  }

  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
}

export interface CaseGeometryBundle {
  backGeometry: THREE.ExtrudeGeometry;
  bezelGeometry: THREE.ExtrudeGeometry;
  dialGeometry: THREE.ShapeGeometry;
  glassGeometry: THREE.ShapeGeometry;
  innerApothem: number;
  maxExtent: number;
}

function computeCornerRadii(
  shape: CaseShape,
  outerApothem: number,
  bezel: number
): { outerCorner: number; innerCorner: number; backCorner: number } {
  if (shape === 'square') {
    const outerCorner = outerApothem * 0.28; // 0.56 at apothem 2.0
    const innerCorner = Math.max(0.1, outerCorner - bezel);
    const backCorner = Math.max(0.12, outerCorner - 0.035);
    return { outerCorner, innerCorner, backCorner };
  }
  if (shape === 'hexagon') {
    const outerCorner = outerApothem * 0.12; // 0.24 at apothem 2.0
    const innerCorner = Math.max(0.06, outerCorner - bezel * 0.38);
    const backCorner = Math.max(0.08, outerCorner - 0.02);
    return { outerCorner, innerCorner, backCorner };
  }
  return { outerCorner: outerApothem, innerCorner: outerApothem - bezel, backCorner: outerApothem - 0.035 };
}

/**
 * Builds all 4 fitted layers (back body, bezel ring with inner hole, dial, glass)
 * using makeShape() with strict Z-separation to prevent any Z-fighting or gaps:
 * - backGeometry: world Z [-0.290, -0.030] (stepped caseback, overlaps bezel Z [-0.080, -0.030] -> zero gap!)
 * - dialGeometry: world Z +0.015 (0.045 clear gap in front of back body)
 * - hands & cap: world Z +0.050 .. +0.179
 * - glassGeometry: world Z +0.205
 * - bezelGeometry: world Z [-0.080, +0.255]
 */
export function buildCaseGeometries(shape: CaseShape, bezelThickness: number): CaseGeometryBundle {
  const clampedBezel = THREE.MathUtils.clamp(bezelThickness, 0.1, 0.45);
  const outerApothem = CLOCK_OUTER_APOTHEM;
  const innerApothem = outerApothem - clampedBezel;

  const { outerCorner, innerCorner, backCorner } = computeCornerRadii(
    shape,
    outerApothem,
    clampedBezel
  );

  // 1. Stepped back body (overlaps bezel along Z with radial step -> zero gap & zero side Z-fighting)
  const backProfile = makeShape(shape, outerApothem - 0.035, backCorner);
  const backGeometry = new THREE.ExtrudeGeometry(backProfile.shape, {
    depth: 0.2,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 5,
  });

  // 2. Bezel ring: outer shape with matching inner shape as hole
  const outerProfile = makeShape(shape, outerApothem, outerCorner);
  const innerProfile = makeShape(shape, innerApothem, innerCorner);
  outerProfile.shape.holes.push(innerProfile.holePath);

  const bezelGeometry = new THREE.ExtrudeGeometry(outerProfile.shape, {
    depth: 0.275,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.025,
    bevelSegments: 5,
  });

  // 3. Flat dial tucked slightly behind the inner bezel lip so there is never an edge gap
  const dialProfile = makeShape(shape, innerApothem + 0.035, innerCorner + 0.02);
  const dialGeometry = new THREE.ShapeGeometry(dialProfile.shape);
  // Isotropic UV half-span ensures centered, unstretched texture AND keeps chapter ring inside innerApothem
  const uvHalfSpan = innerApothem * 1.18;
  applyCenteredIsotropicUVs(dialGeometry, uvHalfSpan);

  // 4. Thin protective glass crystal matching the inner bezel opening
  const glassProfile = makeShape(shape, innerApothem + 0.008, innerCorner + 0.005);
  const glassGeometry = new THREE.ShapeGeometry(glassProfile.shape);
  applyCenteredIsotropicUVs(glassGeometry, uvHalfSpan);

  return {
    backGeometry,
    bezelGeometry,
    dialGeometry,
    glassGeometry,
    innerApothem,
    maxExtent: outerProfile.maxExtent,
  };
}

export function disposeCaseGeometries(bundle: CaseGeometryBundle): void {
  bundle.backGeometry.dispose();
  bundle.bezelGeometry.dispose();
  bundle.dialGeometry.dispose();
  bundle.glassGeometry.dispose();
}

export interface HandGeometryBundle {
  hourGeometry: THREE.ExtrudeGeometry;
  minuteGeometry: THREE.ExtrudeGeometry;
  secondGeometry: THREE.ExtrudeGeometry;
}

function createTaperedHandShape(
  tailLength: number,
  tipLength: number,
  baseHalfWidth: number,
  tipHalfWidth: number
): THREE.Shape {
  const s = new THREE.Shape();
  const tailHalfWidth = baseHalfWidth * 0.72;
  s.moveTo(-tailHalfWidth, -tailLength);
  s.lineTo(tailHalfWidth, -tailLength);
  s.lineTo(baseHalfWidth, 0);
  s.lineTo(tipHalfWidth, tipLength - 0.05);
  s.lineTo(0, tipLength);
  s.lineTo(-tipHalfWidth, tipLength - 0.05);
  s.lineTo(-baseHalfWidth, 0);
  s.closePath();
  return s;
}

function createBoldHandShape(tailLength: number, tipLength: number, halfWidth: number): THREE.Shape {
  const s = new THREE.Shape();
  const r = halfWidth;
  s.moveTo(-r, -tailLength + r);
  s.absarc(0, -tailLength + r, r, Math.PI, Math.PI * 2, false);
  s.lineTo(r, tipLength - r);
  s.absarc(0, tipLength - r, r, 0, Math.PI, false);
  s.closePath();
  return s;
}

function createSwordHandShape(tailLength: number, tipLength: number, maxHalfWidth: number): THREE.Shape {
  const s = new THREE.Shape();
  const neck = maxHalfWidth * 0.42;
  const swellY = tipLength * 0.56;
  s.moveTo(0, -tailLength);
  s.lineTo(neck * 0.9, -tailLength * 0.55);
  s.lineTo(neck, 0);
  s.quadraticCurveTo(maxHalfWidth * 1.12, swellY * 0.75, maxHalfWidth * 0.88, swellY);
  s.quadraticCurveTo(maxHalfWidth * 0.48, tipLength * 0.84, 0, tipLength);
  s.quadraticCurveTo(-maxHalfWidth * 0.48, tipLength * 0.84, -maxHalfWidth * 0.88, swellY);
  s.quadraticCurveTo(-maxHalfWidth * 1.12, swellY * 0.75, -neck, 0);
  s.lineTo(-neck * 0.9, -tailLength * 0.55);
  s.closePath();
  return s;
}

function createSecondHandShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-0.026, -0.36);
  s.lineTo(0.026, -0.36);
  s.lineTo(0.036, -0.2);
  s.lineTo(0.014, -0.13);
  s.lineTo(0.013, 0);
  s.lineTo(0.006, 1.32);
  s.lineTo(-0.006, 1.32);
  s.lineTo(-0.013, 0);
  s.lineTo(-0.014, -0.13);
  s.lineTo(-0.036, -0.2);
  s.closePath();
  return s;
}

/**
 * Base hand geometries normalized for default innerApothem = 1.78 (bezel = 0.22).
 * Hands.tsx scales XY proportionally by (innerApothem / 1.78) so hands never cross the bezel.
 */
export function buildHandGeometries(style: HandStyle): HandGeometryBundle {
  let hourShape: THREE.Shape;
  let minuteShape: THREE.Shape;

  if (style === 'bold') {
    hourShape = createBoldHandShape(0.2, 0.88, 0.052);
    minuteShape = createBoldHandShape(0.24, 1.24, 0.04);
  } else if (style === 'sword') {
    hourShape = createSwordHandShape(0.22, 0.9, 0.078);
    minuteShape = createSwordHandShape(0.26, 1.26, 0.062);
  } else {
    hourShape = createTaperedHandShape(0.2, 0.88, 0.055, 0.012);
    minuteShape = createTaperedHandShape(0.25, 1.25, 0.044, 0.009);
  }

  const secondShape = createSecondHandShape();

  // Hour local Z: [-0.004, +0.020]
  const hourGeometry = new THREE.ExtrudeGeometry(hourShape, {
    depth: 0.016,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
    curveSegments: 24,
  });

  // Minute local Z: [-0.004, +0.018]
  const minuteGeometry = new THREE.ExtrudeGeometry(minuteShape, {
    depth: 0.014,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
    curveSegments: 24,
  });

  // Second local Z: [-0.002, +0.012]
  const secondGeometry = new THREE.ExtrudeGeometry(secondShape, {
    depth: 0.01,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 1,
    curveSegments: 16,
  });

  return { hourGeometry, minuteGeometry, secondGeometry };
}

export function disposeHandGeometries(bundle: HandGeometryBundle): void {
  bundle.hourGeometry.dispose();
  bundle.minuteGeometry.dispose();
  bundle.secondGeometry.dispose();
}
