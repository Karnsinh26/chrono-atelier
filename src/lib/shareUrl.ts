import {
  CaseMaterial,
  CaseShape,
  ClockConfig,
  DEFAULT_CONFIG,
  DialFinish,
  HandStyle,
  HourMarkerStyle,
  MountType,
  PresetName,
  PRESETS,
  SecondsMode,
} from '../store/useClockStore';

const VALID_SHAPES: readonly CaseShape[] = ['round', 'square', 'hexagon'];
const VALID_MATS: readonly CaseMaterial[] = [
  'gold',
  'roseGold',
  'steel',
  'black',
  'walnut',
  'ceramic',
];
const VALID_FINISHES: readonly DialFinish[] = ['plain', 'sunburst', 'guilloche'];
const VALID_MARKERS: readonly HourMarkerStyle[] = ['dots', 'sticks', 'arabic', 'roman'];
const VALID_HANDS: readonly HandStyle[] = ['classic', 'bold', 'sword'];
const VALID_SECONDS_MODES: readonly SecondsMode[] = ['sweep', 'tick'];
const VALID_MOUNTS: readonly MountType[] = ['wall', 'desk'];

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function isValidHexColor(val: unknown): val is string {
  return typeof val === 'string' && HEX_COLOR_RE.test(val);
}

function sanitizeEngraving(val: unknown): string {
  if (typeof val !== 'string') return DEFAULT_CONFIG.engraving;
  // Strip control characters and cap at 18 characters
  return val.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 18);
}

function sanitizeBezel(val: unknown): number {
  const num = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(num)) return DEFAULT_CONFIG.bezel;
  const clamped = Math.min(0.45, Math.max(0.1, num));
  return Math.round(clamped * 100) / 100;
}

function sanitizeBool(val: unknown, fallback: boolean): boolean {
  if (typeof val === 'boolean') return val;
  if (val === 1 || val === '1' || val === 'true') return true;
  if (val === 0 || val === '0' || val === 'false') return false;
  return fallback;
}

/**
 * Validates every field of a raw object or compact tuple against allowed values,
 * falling back field-by-field to DEFAULT_CONFIG if any field is missing or invalid.
 */
export function validateClockConfig(raw: unknown): ClockConfig {
  if (Array.isArray(raw)) {
    // Compact array tuple format:
    // [0:shape, 1:bezel, 2:caseMat, 3:dialColor, 4:dialFinish, 5:hourMarkers,
    //  6:showMinuteTrack, 7:engraving, 8:handStyle, 9:handColor,
    //  10:showSeconds, 11:secondsColor, 12:secondsMode, 13:mount]
    const [
      shape,
      bezel,
      caseMat,
      dialColor,
      dialFinish,
      hourMarkers,
      showMinuteTrack,
      engraving,
      handStyle,
      handColor,
      showSeconds,
      secondsColor,
      secondsMode,
      mount,
    ] = raw;

    return {
      shape: VALID_SHAPES.includes(shape) ? shape : DEFAULT_CONFIG.shape,
      bezel: sanitizeBezel(bezel),
      caseMat: VALID_MATS.includes(caseMat) ? caseMat : DEFAULT_CONFIG.caseMat,
      dialColor: isValidHexColor(dialColor)
        ? dialColor.toLowerCase()
        : DEFAULT_CONFIG.dialColor,
      dialFinish: VALID_FINISHES.includes(dialFinish)
        ? dialFinish
        : DEFAULT_CONFIG.dialFinish,
      hourMarkers: VALID_MARKERS.includes(hourMarkers)
        ? hourMarkers
        : DEFAULT_CONFIG.hourMarkers,
      showMinuteTrack: sanitizeBool(showMinuteTrack, DEFAULT_CONFIG.showMinuteTrack),
      engraving: sanitizeEngraving(engraving),
      handStyle: VALID_HANDS.includes(handStyle) ? handStyle : DEFAULT_CONFIG.handStyle,
      handColor: isValidHexColor(handColor)
        ? handColor.toLowerCase()
        : DEFAULT_CONFIG.handColor,
      showSeconds: sanitizeBool(showSeconds, DEFAULT_CONFIG.showSeconds),
      secondsColor: isValidHexColor(secondsColor)
        ? secondsColor.toLowerCase()
        : DEFAULT_CONFIG.secondsColor,
      secondsMode: VALID_SECONDS_MODES.includes(secondsMode)
        ? secondsMode
        : DEFAULT_CONFIG.secondsMode,
      mount: VALID_MOUNTS.includes(mount) ? mount : DEFAULT_CONFIG.mount,
    };
  }

  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    return {
      shape: VALID_SHAPES.includes(obj.shape as CaseShape)
        ? (obj.shape as CaseShape)
        : DEFAULT_CONFIG.shape,
      bezel: sanitizeBezel(obj.bezel),
      caseMat: VALID_MATS.includes(obj.caseMat as CaseMaterial)
        ? (obj.caseMat as CaseMaterial)
        : DEFAULT_CONFIG.caseMat,
      dialColor: isValidHexColor(obj.dialColor)
        ? obj.dialColor.toLowerCase()
        : DEFAULT_CONFIG.dialColor,
      dialFinish: VALID_FINISHES.includes(obj.dialFinish as DialFinish)
        ? (obj.dialFinish as DialFinish)
        : DEFAULT_CONFIG.dialFinish,
      hourMarkers: VALID_MARKERS.includes(obj.hourMarkers as HourMarkerStyle)
        ? (obj.hourMarkers as HourMarkerStyle)
        : DEFAULT_CONFIG.hourMarkers,
      showMinuteTrack: sanitizeBool(
        obj.showMinuteTrack,
        DEFAULT_CONFIG.showMinuteTrack
      ),
      engraving: sanitizeEngraving(obj.engraving),
      handStyle: VALID_HANDS.includes(obj.handStyle as HandStyle)
        ? (obj.handStyle as HandStyle)
        : DEFAULT_CONFIG.handStyle,
      handColor: isValidHexColor(obj.handColor)
        ? obj.handColor.toLowerCase()
        : DEFAULT_CONFIG.handColor,
      showSeconds: sanitizeBool(obj.showSeconds, DEFAULT_CONFIG.showSeconds),
      secondsColor: isValidHexColor(obj.secondsColor)
        ? obj.secondsColor.toLowerCase()
        : DEFAULT_CONFIG.secondsColor,
      secondsMode: VALID_SECONDS_MODES.includes(obj.secondsMode as SecondsMode)
        ? (obj.secondsMode as SecondsMode)
        : DEFAULT_CONFIG.secondsMode,
      mount: VALID_MOUNTS.includes(obj.mount as MountType)
        ? (obj.mount as MountType)
        : DEFAULT_CONFIG.mount,
    };
  }

  return { ...DEFAULT_CONFIG };
}

function utf8ToBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToUtf8(b64: string): string {
  const normalized = b64.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLen);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Encodes a ClockConfig into a compact `#d=<base64>` hash string.
 */
export function encodeConfigToHash(config: ClockConfig): string {
  const compactTuple = [
    config.shape,
    Math.round(config.bezel * 100) / 100,
    config.caseMat,
    config.dialColor.toLowerCase(),
    config.dialFinish,
    config.hourMarkers,
    config.showMinuteTrack ? 1 : 0,
    config.engraving,
    config.handStyle,
    config.handColor.toLowerCase(),
    config.showSeconds ? 1 : 0,
    config.secondsColor.toLowerCase(),
    config.secondsMode,
    config.mount,
  ];
  const json = JSON.stringify(compactTuple);
  return `#d=${utf8ToBase64Url(json)}`;
}

/**
 * Reads `#d=...` from a location hash string.
 * Returns null if no `#d=` parameter is present in the hash.
 * If `#d=` is present, decodes and validates every field; falls back to DEFAULT_CONFIG if corrupted.
 */
export function decodeConfigFromHash(hash: string): ClockConfig | null {
  if (!hash || !hash.startsWith('#')) return null;
  const rawHash = hash.slice(1);
  const match = rawHash.match(/(?:^|&)d=([^&]*)/);
  if (!match) return null;

  const encoded = match[1].trim();
  if (!encoded) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const jsonStr = base64UrlToUtf8(encoded);
    const parsed = JSON.parse(jsonStr);
    return validateClockConfig(parsed);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Checks whether a ClockConfig matches one of the 4 named presets.
 */
export function findMatchingPreset(config: ClockConfig): PresetName | null {
  const keys = Object.keys(PRESETS) as PresetName[];
  for (const key of keys) {
    const p = PRESETS[key];
    if (
      p.shape === config.shape &&
      Math.abs(p.bezel - config.bezel) < 0.005 &&
      p.caseMat === config.caseMat &&
      p.dialColor.toLowerCase() === config.dialColor.toLowerCase() &&
      p.dialFinish === config.dialFinish &&
      p.hourMarkers === config.hourMarkers &&
      p.showMinuteTrack === config.showMinuteTrack &&
      p.engraving === config.engraving &&
      p.handStyle === config.handStyle &&
      p.handColor.toLowerCase() === config.handColor.toLowerCase() &&
      p.showSeconds === config.showSeconds &&
      p.secondsColor.toLowerCase() === config.secondsColor.toLowerCase() &&
      p.secondsMode === config.secondsMode &&
      p.mount === config.mount
    ) {
      return key;
    }
  }
  return null;
}
