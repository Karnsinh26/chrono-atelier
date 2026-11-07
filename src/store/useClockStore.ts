import { create } from 'zustand';

export type CaseShape = 'round' | 'square' | 'hexagon';
export type CaseMaterial = 'gold' | 'roseGold' | 'steel' | 'black' | 'walnut' | 'ceramic';
export type DialFinish = 'plain' | 'sunburst' | 'guilloche';
export type HourMarkerStyle = 'dots' | 'sticks' | 'arabic' | 'roman';
export type HandStyle = 'classic' | 'bold' | 'sword';
export type SecondsMode = 'sweep' | 'tick';
export type MountType = 'wall' | 'desk';
export type PresetName = 'classic' | 'minimal' | 'luxury' | 'workshop';

export interface ClockConfig {
  shape: CaseShape;
  bezel: number;
  caseMat: CaseMaterial;
  dialColor: string;
  dialFinish: DialFinish;
  hourMarkers: HourMarkerStyle;
  showMinuteTrack: boolean;
  engraving: string;
  handStyle: HandStyle;
  handColor: string;
  showSeconds: boolean;
  secondsColor: string;
  secondsMode: SecondsMode;
  mount: MountType;
}

export const PRESETS: Record<PresetName, ClockConfig> = {
  classic: {
    shape: 'round',
    bezel: 0.22,
    caseMat: 'gold',
    dialColor: '#f5efe2',
    dialFinish: 'plain',
    hourMarkers: 'roman',
    showMinuteTrack: true,
    engraving: '',
    handStyle: 'classic',
    handColor: '#18181b',
    showSeconds: true,
    secondsColor: '#c83228',
    secondsMode: 'sweep',
    mount: 'wall',
  },
  minimal: {
    shape: 'round',
    bezel: 0.14,
    caseMat: 'black',
    dialColor: '#121316',
    dialFinish: 'plain',
    hourMarkers: 'sticks',
    showMinuteTrack: false,
    engraving: '',
    handStyle: 'bold',
    handColor: '#f4f4f5',
    showSeconds: true,
    secondsColor: '#f97316',
    secondsMode: 'sweep',
    mount: 'wall',
  },
  luxury: {
    shape: 'hexagon',
    bezel: 0.26,
    caseMat: 'roseGold',
    dialColor: '#10203a',
    dialFinish: 'sunburst',
    hourMarkers: 'sticks',
    showMinuteTrack: true,
    engraving: '',
    handStyle: 'sword',
    handColor: '#f3dec0',
    showSeconds: true,
    secondsColor: '#e6b45a',
    secondsMode: 'sweep',
    mount: 'desk',
  },
  workshop: {
    shape: 'square',
    bezel: 0.28,
    caseMat: 'walnut',
    dialColor: '#f3ead8',
    dialFinish: 'guilloche',
    hourMarkers: 'arabic',
    showMinuteTrack: true,
    engraving: '',
    handStyle: 'bold',
    handColor: '#1c1917',
    showSeconds: true,
    secondsColor: '#b91c1c',
    secondsMode: 'tick',
    mount: 'desk',
  },
};

export interface ClockStore extends ClockConfig {
  activePreset: PresetName | null;
  autoRotate: boolean;
  transitionTick: number;
  setConfig: (partial: Partial<ClockConfig>) => void;
  applyPreset: (preset: PresetName) => void;
  resetConfig: () => void;
  setAutoRotate: (autoRotate: boolean) => void;
  getSerializableConfig: () => ClockConfig;
}

export const DEFAULT_CONFIG: ClockConfig = PRESETS.classic;

export const useClockStore = create<ClockStore>((set, get) => ({
  ...DEFAULT_CONFIG,
  activePreset: 'classic',
  autoRotate: false,
  transitionTick: 0,

  setConfig: (partial) =>
    set((state) => ({
      ...state,
      ...partial,
      activePreset: null,
    })),

  applyPreset: (preset) =>
    set((state) => ({
      ...PRESETS[preset],
      activePreset: preset,
      transitionTick: state.transitionTick + 1,
    })),

  resetConfig: () =>
    set((state) => ({
      ...DEFAULT_CONFIG,
      activePreset: 'classic',
      transitionTick: state.transitionTick + 1,
    })),

  setAutoRotate: (autoRotate) => set({ autoRotate }),

  getSerializableConfig: () => {
    const s = get();
    return {
      shape: s.shape,
      bezel: s.bezel,
      caseMat: s.caseMat,
      dialColor: s.dialColor,
      dialFinish: s.dialFinish,
      hourMarkers: s.hourMarkers,
      showMinuteTrack: s.showMinuteTrack,
      engraving: s.engraving,
      handStyle: s.handStyle,
      handColor: s.handColor,
      showSeconds: s.showSeconds,
      secondsColor: s.secondsColor,
      secondsMode: s.secondsMode,
      mount: s.mount,
    };
  },
}));
