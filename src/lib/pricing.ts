import {
  CaseMaterial,
  CaseShape,
  ClockConfig,
  DialFinish,
  HandStyle,
  HourMarkerStyle,
} from '../store/useClockStore';

const BASE_PRICE = 1499;

export const SHAPE_PRICES: Record<CaseShape, number> = {
  round: 0,
  square: 300,
  hexagon: 450,
};

export const MATERIAL_PRICES: Record<CaseMaterial, number> = {
  steel: 0,
  black: 400,
  walnut: 600,
  ceramic: 800,
  gold: 900,
  roseGold: 1100,
};

export const FINISH_PRICES: Record<DialFinish, number> = {
  plain: 0,
  sunburst: 350,
  guilloche: 500,
};

export const MARKER_PRICES: Record<HourMarkerStyle, number> = {
  dots: 0,
  sticks: 100,
  arabic: 150,
  roman: 250,
};

export const HAND_PRICES: Record<HandStyle, number> = {
  classic: 0,
  bold: 100,
  sword: 200,
};

export function calculatePrice(config: ClockConfig): number {
  const bezelCost = Math.max(0, Math.round((config.bezel - 0.1) * 1000));
  const standCost = config.mount === 'desk' ? 400 : 0;
  const engravingCost = config.engraving.trim().length > 0 ? 150 : 0;

  return (
    BASE_PRICE +
    SHAPE_PRICES[config.shape] +
    MATERIAL_PRICES[config.caseMat] +
    FINISH_PRICES[config.dialFinish] +
    MARKER_PRICES[config.hourMarkers] +
    HAND_PRICES[config.handStyle] +
    standCost +
    engravingCost +
    bezelCost
  );
}

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function formatINR(amount: number): string {
  return inrFormatter.format(amount);
}
