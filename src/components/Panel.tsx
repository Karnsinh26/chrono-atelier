import React, { useState } from 'react';
import { CASE_MATERIAL_SPECS } from '../lib/materials';
import { encodeConfigToHash } from '../lib/shareUrl';
import {
  calculatePrice,
  FINISH_PRICES,
  formatINR,
  HAND_PRICES,
  MARKER_PRICES,
  MATERIAL_PRICES,
  SHAPE_PRICES,
} from '../lib/pricing';
import {
  CaseMaterial,
  CaseShape,
  DialFinish,
  HandStyle,
  HourMarkerStyle,
  MountType,
  PresetName,
  useClockStore,
} from '../store/useClockStore';

const PRESET_CARDS: { key: PresetName; name: string; subtitle: string }[] = [
  { key: 'classic', name: 'Classic', subtitle: '18k Gold · Roman' },
  { key: 'minimal', name: 'Minimal', subtitle: 'Matte Black · Sticks' },
  { key: 'luxury', name: 'Luxury', subtitle: 'Rose Gold · Sunburst' },
  { key: 'workshop', name: 'Workshop', subtitle: 'Walnut · Guilloché' },
];

const SHAPE_OPTIONS: { value: CaseShape; label: string; profileLabel: string }[] = [
  { value: 'round', label: 'Round', profileLabel: 'Round · Bevelled' },
  { value: 'square', label: 'Square', profileLabel: 'Cushion Square · Bevelled' },
  { value: 'hexagon', label: 'Hexagon', profileLabel: 'Flat-Top Hexagon · Bevelled' },
];

const MATERIAL_ORDER: CaseMaterial[] = [
  'gold',
  'roseGold',
  'steel',
  'black',
  'walnut',
  'ceramic',
];

const DIAL_SWATCHES: { label: string; hex: string }[] = [
  { label: 'Porcelain Cream', hex: '#f5efe2' },
  { label: 'Obsidian Black', hex: '#121316' },
  { label: 'Midnight Navy', hex: '#10203a' },
  { label: 'Emerald Green', hex: '#132e24' },
  { label: 'Champagne Silver', hex: '#e4dfd3' },
  { label: 'Bordeaux Wine', hex: '#47161e' },
];

const FINISH_OPTIONS: { value: DialFinish; label: string }[] = [
  { value: 'plain', label: 'Plain' },
  { value: 'sunburst', label: 'Sunburst' },
  { value: 'guilloche', label: 'Guilloché' },
];

const MARKER_OPTIONS: { value: HourMarkerStyle; label: string }[] = [
  { value: 'dots', label: 'Dots' },
  { value: 'sticks', label: 'Sticks' },
  { value: 'arabic', label: 'Arabic' },
  { value: 'roman', label: 'Roman' },
];

const HAND_STYLE_OPTIONS: { value: HandStyle; label: string }[] = [
  { value: 'classic', label: 'Classic' },
  { value: 'bold', label: 'Bold' },
  { value: 'sword', label: 'Sword' },
];

const HAND_COLOR_SWATCHES: { label: string; hex: string }[] = [
  { label: 'Black', hex: '#18181b' },
  { label: 'White', hex: '#f4f4f5' },
  { label: 'Gold', hex: '#d4af37' },
  { label: 'Champagne', hex: '#f3dec0' },
  { label: 'Blued steel', hex: '#1f4fd1' },
];

const SECONDS_COLOR_SWATCHES: { label: string; hex: string }[] = [
  { label: 'Red', hex: '#c83228' },
  { label: 'Orange', hex: '#f97316' },
  { label: 'Gold', hex: '#e6b45a' },
  { label: 'Blue', hex: '#2e86de' },
  { label: 'Black', hex: '#18181b' },
];

const MOUNT_OPTIONS: { value: MountType; label: string; sub: string }[] = [
  { value: 'wall', label: 'Wall', sub: 'Included' },
  { value: 'desk', label: 'Desk Stand', sub: '+₹400' },
];

interface CollapsibleSectionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  open,
  onToggle,
  children,
}) => {
  return (
    <div className="border-t border-atelier-border/80 pt-4">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left group mb-3"
      >
        <span className="text-[11px] uppercase tracking-[0.2em] text-atelier-gold font-semibold group-hover:text-atelier-goldHover transition">
          {title}
        </span>
        <svg
          className={`w-4 h-4 text-zinc-400 group-hover:text-zinc-200 transition-transform duration-200 ${
            open ? 'rotate-180' : 'rotate-0'
          }`}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M5.5 7.5L10 12l4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="space-y-4 pb-1">{children}</div>}
    </div>
  );
};

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to legacy execCommand copy
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

interface PanelProps {
  onDownloadPng: () => void;
  onShowToast: (message: string) => void;
}

export const Panel: React.FC<PanelProps> = ({ onDownloadPng, onShowToast }) => {
  const store = useClockStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Collapsible sections — all open by default
  const [sectionsOpen, setSectionsOpen] = useState({
    case: true,
    dial: true,
    hands: true,
    display: true,
  });

  const toggleSection = (key: keyof typeof sectionsOpen) =>
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const livePrice = calculatePrice(store);
  const currentShapeInfo =
    SHAPE_OPTIONS.find((o) => o.value === store.shape) ?? SHAPE_OPTIONS[0];
  const currentMatSpec = CASE_MATERIAL_SPECS[store.caseMat];
  const currentFinishLabel =
    FINISH_OPTIONS.find((f) => f.value === store.dialFinish)?.label ?? 'Plain';
  const currentMarkerLabel =
    MARKER_OPTIONS.find((m) => m.value === store.hourMarkers)?.label ?? 'Roman';
  const currentHandStyleLabel =
    HAND_STYLE_OPTIONS.find((h) => h.value === store.handStyle)?.label ?? 'Classic';
  const currentHandColorName =
    HAND_COLOR_SWATCHES.find(
      (c) => c.hex.toLowerCase() === store.handColor.toLowerCase()
    )?.label ?? store.handColor.toUpperCase();
  const bezelPriceDelta = Math.max(0, Math.round((store.bezel - 0.1) * 1000));

  const isCustomDialColor = !DIAL_SWATCHES.some(
    (s) => s.hex.toLowerCase() === store.dialColor.toLowerCase()
  );
  const isCustomHandColor = !HAND_COLOR_SWATCHES.some(
    (s) => s.hex.toLowerCase() === store.handColor.toLowerCase()
  );

  const handleReset = () => {
    store.resetConfig();
    if (window.location.hash) {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}`
      );
    }
    setMobileMenuOpen(false);
    onShowToast('Reset to Classic preset');
  };

  const handleShareLink = async () => {
    const hash = encodeConfigToHash(store.getSerializableConfig());
    const nextUrl = `${window.location.origin}${window.location.pathname}${window.location.search}${hash}`;
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}${hash}`
    );
    await copyTextToClipboard(nextUrl);
    setMobileMenuOpen(false);
    onShowToast('Share link copied to clipboard');
  };

  const handleDownload = () => {
    setMobileMenuOpen(false);
    onDownloadPng();
  };

  const handleCopyDesign = async () => {
    const json = JSON.stringify(store.getSerializableConfig(), null, 2);
    await copyTextToClipboard(json);
    setMobileMenuOpen(false);
    onShowToast('Copied design JSON to clipboard');
  };

  return (
    <aside className="w-full flex-1 min-h-0 desktop:flex-none desktop:w-[360px] desktop:h-full bg-atelier-panel border-t desktop:border-t-0 desktop:border-l border-atelier-border flex flex-col shrink-0 select-none">
      {/* Compact Panel Header */}
      <div className="px-4 py-2.5 desktop:px-5 desktop:pt-5 desktop:pb-4 border-b border-atelier-border shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-[0.22em] text-atelier-gold font-medium">
            Atelier Configurator
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-atelier-gold/10 text-atelier-gold border border-atelier-gold/25">
            Bespoke Edition
          </span>
        </div>
        <h2 className="hidden desktop:block font-brand text-lg text-zinc-100 mt-1">
          Horological Customizer
        </h2>
      </div>

      {/* Scrollable Controls Area */}
      <div className="flex-1 min-h-0 overflow-y-auto touch-pan-y px-4 desktop:px-5 py-3.5 desktop:py-4 space-y-4">
        {/* PRESETS (2x2 Grid) */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 font-semibold">
              Signature Presets
            </span>
            {store.activePreset && (
              <span className="text-[10px] uppercase tracking-wider text-atelier-gold">
                {store.activePreset}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PRESET_CARDS.map((card) => {
              const active = store.activePreset === card.key;
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => store.applyPreset(card.key)}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    active
                      ? 'bg-atelier-gold/15 border-atelier-gold shadow-sm'
                      : 'bg-atelier-surface border-atelier-border hover:border-zinc-600'
                  }`}
                >
                  <div
                    className={`font-brand text-sm font-semibold leading-tight ${
                      active ? 'text-atelier-gold' : 'text-zinc-100'
                    }`}
                  >
                    {card.name}
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-0.5 truncate">
                    {card.subtitle}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* SECTION 1: CASE */}
        <CollapsibleSection
          title="Case"
          open={sectionsOpen.case}
          onToggle={() => toggleSection('case')}
        >
          {/* Case shape */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-[0.14em] text-zinc-400 font-medium">
                Case shape
              </label>
              <span className="text-[11px] text-zinc-500">
                {SHAPE_PRICES[store.shape] === 0
                  ? 'Included'
                  : `+₹${SHAPE_PRICES[store.shape]}`}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-atelier-bg/70 border border-atelier-border">
              {SHAPE_OPTIONS.map((opt) => {
                const active = store.shape === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => store.setConfig({ shape: opt.value })}
                    className={`py-2 px-2 rounded-lg text-xs font-medium transition ${
                      active
                        ? 'bg-atelier-gold text-zinc-950 font-semibold shadow-sm'
                        : 'text-zinc-300 hover:text-white hover:bg-atelier-surface/70'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Case material */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-[0.14em] text-zinc-400 font-medium">
                Case material
              </label>
              <span className="text-[11px] text-zinc-500">
                {MATERIAL_PRICES[store.caseMat] === 0
                  ? 'Included'
                  : `+₹${MATERIAL_PRICES[store.caseMat].toLocaleString('en-IN')}`}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {MATERIAL_ORDER.map((matKey) => {
                const spec = CASE_MATERIAL_SPECS[matKey];
                const active = store.caseMat === matKey;
                return (
                  <button
                    key={matKey}
                    type="button"
                    onClick={() => store.setConfig({ caseMat: matKey })}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border flex items-center gap-2.5 transition ${
                      active
                        ? 'bg-atelier-gold/15 border-atelier-gold text-atelier-gold shadow-sm'
                        : 'bg-atelier-surface border-atelier-border text-zinc-300 hover:border-zinc-600 hover:text-zinc-100'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full shrink-0 border border-white/20 shadow-inner"
                      style={{ background: spec.swatchCss }}
                    />
                    <span className="truncate">{spec.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bezel thickness */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="bezel-slider"
                className="text-xs uppercase tracking-[0.14em] text-zinc-400 font-medium"
              >
                Bezel thickness
              </label>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono text-atelier-gold">
                  {store.bezel.toFixed(2)}
                </span>
                <span className="text-[11px] text-zinc-500">
                  {bezelPriceDelta === 0 ? 'Base' : `+₹${bezelPriceDelta}`}
                </span>
              </div>
            </div>
            <input
              id="bezel-slider"
              type="range"
              min={0.1}
              max={0.45}
              step={0.01}
              value={store.bezel}
              onChange={(e) => store.setConfig({ bezel: parseFloat(e.target.value) })}
              className="w-full atelier-slider"
            />
            <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
              <span>0.10 Slim</span>
              <span>0.28 Classic</span>
              <span>0.45 Bold</span>
            </div>
          </div>
        </CollapsibleSection>

        {/* SECTION 2: DIAL */}
        <CollapsibleSection
          title="Dial"
          open={sectionsOpen.dial}
          onToggle={() => toggleSection('dial')}
        >
          {/* Dial colour */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-[0.14em] text-zinc-400 font-medium">
                Dial colour
              </label>
              <span className="font-mono text-[11px] text-zinc-400 uppercase">
                {store.dialColor}
              </span>
            </div>
            <div className="flex items-center justify-between gap-1.5">
              {DIAL_SWATCHES.map((swatch) => {
                const active =
                  store.dialColor.toLowerCase() === swatch.hex.toLowerCase();
                return (
                  <button
                    key={swatch.hex}
                    type="button"
                    title={swatch.label}
                    aria-label={swatch.label}
                    onClick={() => store.setConfig({ dialColor: swatch.hex })}
                    className={`w-8 h-8 rounded-full transition flex items-center justify-center ${
                      active
                        ? 'ring-2 ring-atelier-gold ring-offset-2 ring-offset-atelier-panel scale-105'
                        : 'border border-white/20 hover:scale-105'
                    }`}
                    style={{ backgroundColor: swatch.hex }}
                  />
                );
              })}

              <label
                title="Custom dial colour"
                className={`relative w-8 h-8 rounded-full cursor-pointer flex items-center justify-center overflow-hidden transition ${
                  isCustomDialColor
                    ? 'ring-2 ring-atelier-gold ring-offset-2 ring-offset-atelier-panel scale-105'
                    : 'border border-dashed border-zinc-500 hover:border-atelier-gold'
                }`}
                style={{
                  background: isCustomDialColor
                    ? store.dialColor
                    : 'conic-gradient(from 0deg, #f87171, #fbbf24, #34d399, #60a5fa, #a78bfa, #f87171)',
                }}
              >
                <input
                  type="color"
                  value={store.dialColor}
                  onChange={(e) => store.setConfig({ dialColor: e.target.value })}
                  className="sr-only"
                />
                <span className="w-3.5 h-3.5 rounded-full bg-atelier-panel/80 border border-white/30 text-[9px] flex items-center justify-center text-white font-bold">
                  +
                </span>
              </label>
            </div>
          </div>

          {/* Dial finish */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-[0.14em] text-zinc-400 font-medium">
                Dial finish
              </label>
              <span className="text-[11px] text-zinc-500">
                {FINISH_PRICES[store.dialFinish] === 0
                  ? 'Included'
                  : `+₹${FINISH_PRICES[store.dialFinish]}`}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-atelier-bg/70 border border-atelier-border">
              {FINISH_OPTIONS.map((opt) => {
                const active = store.dialFinish === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => store.setConfig({ dialFinish: opt.value })}
                    className={`py-2 px-2 rounded-lg text-xs font-medium transition ${
                      active
                        ? 'bg-atelier-gold text-zinc-950 font-semibold shadow-sm'
                        : 'text-zinc-300 hover:text-white hover:bg-atelier-surface/70'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hour markers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-[0.14em] text-zinc-400 font-medium">
                Hour markers
              </label>
              <span className="text-[11px] text-zinc-500">
                {MARKER_PRICES[store.hourMarkers] === 0
                  ? 'Included'
                  : `+₹${MARKER_PRICES[store.hourMarkers]}`}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {MARKER_OPTIONS.map((opt) => {
                const active = store.hourMarkers === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => store.setConfig({ hourMarkers: opt.value })}
                    className={`py-2 px-1.5 rounded-lg text-xs font-medium border transition ${
                      active
                        ? 'bg-atelier-gold/15 border-atelier-gold text-atelier-gold'
                        : 'bg-atelier-surface border-atelier-border text-zinc-300 hover:border-zinc-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Minute track */}
          <button
            type="button"
            onClick={() =>
              store.setConfig({ showMinuteTrack: !store.showMinuteTrack })
            }
            className={`w-full py-2 px-3 rounded-lg text-xs font-medium border flex items-center justify-between transition ${
              store.showMinuteTrack
                ? 'bg-atelier-gold/10 border-atelier-gold/40 text-zinc-200'
                : 'bg-atelier-surface border-atelier-border text-zinc-400 hover:border-zinc-600'
            }`}
          >
            <span>Minute track</span>
            <span className="text-[11px] uppercase tracking-wider text-atelier-gold">
              {store.showMinuteTrack ? 'Shown' : 'Hidden'}
            </span>
          </button>

          {/* Engraving */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="engraving-input"
                className="text-xs uppercase tracking-[0.14em] text-zinc-400 font-medium"
              >
                Engraving
              </label>
              <span className="text-[11px] text-zinc-500">
                {store.engraving.trim().length > 0 ? '+₹150' : 'Optional (+₹150)'}
              </span>
            </div>
            <div className="relative">
              <input
                id="engraving-input"
                type="text"
                maxLength={18}
                value={store.engraving}
                onChange={(e) => store.setConfig({ engraving: e.target.value })}
                placeholder="Custom brand or monogram..."
                className="w-full py-2 px-3 pr-12 rounded-lg text-xs bg-atelier-surface border border-atelier-border text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-atelier-gold transition uppercase tracking-wider select-text"
              />
              {store.engraving.length > 0 && (
                <button
                  type="button"
                  onClick={() => store.setConfig({ engraving: '' })}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 hover:text-zinc-200 px-1.5 py-0.5 rounded bg-atelier-bg/60"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </CollapsibleSection>

        {/* SECTION 3: HANDS */}
        <CollapsibleSection
          title="Hands"
          open={sectionsOpen.hands}
          onToggle={() => toggleSection('hands')}
        >
          {/* Hand style */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-[0.14em] text-zinc-400 font-medium">
                Hand style
              </label>
              <span className="text-[11px] text-zinc-500">
                {HAND_PRICES[store.handStyle] === 0
                  ? 'Included'
                  : `+₹${HAND_PRICES[store.handStyle]}`}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-atelier-bg/70 border border-atelier-border">
              {HAND_STYLE_OPTIONS.map((opt) => {
                const active = store.handStyle === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => store.setConfig({ handStyle: opt.value })}
                    className={`py-2 px-2 rounded-lg text-xs font-medium transition ${
                      active
                        ? 'bg-atelier-gold text-zinc-950 font-semibold shadow-sm'
                        : 'text-zinc-300 hover:text-white hover:bg-atelier-surface/70'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hand colour */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-[0.14em] text-zinc-400 font-medium">
                Hand colour
              </label>
              <span className="text-[11px] text-zinc-400">{currentHandColorName}</span>
            </div>
            <div className="flex items-center gap-2.5">
              {HAND_COLOR_SWATCHES.map((swatch) => {
                const active =
                  store.handColor.toLowerCase() === swatch.hex.toLowerCase();
                return (
                  <button
                    key={swatch.hex}
                    type="button"
                    title={swatch.label}
                    aria-label={swatch.label}
                    onClick={() => store.setConfig({ handColor: swatch.hex })}
                    className={`w-8 h-8 rounded-full transition ${
                      active
                        ? 'ring-2 ring-atelier-gold ring-offset-2 ring-offset-atelier-panel scale-105'
                        : 'border border-white/25 hover:scale-105'
                    }`}
                    style={{ backgroundColor: swatch.hex }}
                  />
                );
              })}

              <label
                title="Custom hand colour"
                className={`relative w-8 h-8 rounded-full cursor-pointer flex items-center justify-center overflow-hidden transition ${
                  isCustomHandColor
                    ? 'ring-2 ring-atelier-gold ring-offset-2 ring-offset-atelier-panel scale-105'
                    : 'border border-dashed border-zinc-500 hover:border-atelier-gold'
                }`}
                style={{
                  background: isCustomHandColor
                    ? store.handColor
                    : 'conic-gradient(from 0deg, #f87171, #fbbf24, #34d399, #60a5fa, #a78bfa, #f87171)',
                }}
              >
                <input
                  type="color"
                  value={store.handColor}
                  onChange={(e) => store.setConfig({ handColor: e.target.value })}
                  className="sr-only"
                />
                <span className="w-3.5 h-3.5 rounded-full bg-atelier-panel/80 border border-white/30 text-[9px] flex items-center justify-center text-white font-bold">
                  +
                </span>
              </label>
            </div>
          </div>

          {/* Seconds hand: toggle, mode, colour */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-[0.14em] text-zinc-400 font-medium">
                Seconds hand
              </label>
              <button
                type="button"
                onClick={() => store.setConfig({ showSeconds: !store.showSeconds })}
                className={`text-xs px-2.5 py-0.5 rounded border transition ${
                  store.showSeconds
                    ? 'border-atelier-gold/40 bg-atelier-gold/10 text-atelier-gold'
                    : 'border-atelier-border bg-atelier-surface text-zinc-400'
                }`}
              >
                {store.showSeconds ? 'Shown' : 'Hidden'}
              </button>
            </div>

            {store.showSeconds && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {(['sweep', 'tick'] as const).map((mode) => {
                    const active = store.secondsMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => store.setConfig({ secondsMode: mode })}
                        className={`py-2 px-3 rounded-lg text-xs font-medium border transition ${
                          active
                            ? 'bg-atelier-gold/15 border-atelier-gold text-atelier-gold shadow-sm'
                            : 'bg-atelier-surface border-atelier-border text-zinc-300 hover:border-zinc-600'
                        }`}
                      >
                        {mode === 'sweep' ? 'Smooth sweep' : 'Quartz tick'}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2.5 pt-0.5">
                  {SECONDS_COLOR_SWATCHES.map((swatch) => {
                    const active =
                      store.secondsColor.toLowerCase() === swatch.hex.toLowerCase();
                    return (
                      <button
                        key={swatch.hex}
                        type="button"
                        title={swatch.label}
                        aria-label={`Seconds ${swatch.label}`}
                        onClick={() => store.setConfig({ secondsColor: swatch.hex })}
                        className={`w-7 h-7 rounded-full transition ${
                          active
                            ? 'ring-2 ring-atelier-gold ring-offset-2 ring-offset-atelier-panel scale-105'
                            : 'border border-white/25 hover:scale-105'
                        }`}
                        style={{ backgroundColor: swatch.hex }}
                      />
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </CollapsibleSection>

        {/* SECTION 4: DISPLAY */}
        <CollapsibleSection
          title="Display"
          open={sectionsOpen.display}
          onToggle={() => toggleSection('display')}
        >
          {/* Mount */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-[0.14em] text-zinc-400 font-medium">
                Mount
              </label>
              <span className="text-[11px] text-zinc-500">
                {store.mount === 'desk' ? '+₹400' : 'Included'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {MOUNT_OPTIONS.map((opt) => {
                const active = store.mount === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => store.setConfig({ mount: opt.value })}
                    className={`py-2 px-3 rounded-lg text-xs font-medium border flex items-center justify-between transition ${
                      active
                        ? 'bg-atelier-gold/15 border-atelier-gold text-atelier-gold shadow-sm'
                        : 'bg-atelier-surface border-atelier-border text-zinc-300 hover:border-zinc-600'
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span className="text-[10px] opacity-80">{opt.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* View (auto-rotate toggle) */}
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.14em] text-zinc-400 font-medium block">
              View
            </label>
            <button
              type="button"
              onClick={() => store.setAutoRotate(!store.autoRotate)}
              className={`w-full py-2 px-3.5 rounded-lg text-xs font-medium border flex items-center justify-between transition ${
                store.autoRotate
                  ? 'bg-atelier-gold/15 border-atelier-gold text-atelier-gold'
                  : 'bg-atelier-surface border-atelier-border text-zinc-300 hover:border-zinc-600'
              }`}
            >
              <span>Turntable Auto-Rotate</span>
              <span className="text-[11px] uppercase tracking-wider">
                {store.autoRotate ? 'Active' : 'Off'}
              </span>
            </button>
          </div>
        </CollapsibleSection>

        {/* Live Current Architecture Summary Card */}
        <section className="rounded-xl bg-atelier-surface/70 border border-atelier-border p-4 space-y-2">
          <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-400 font-medium">
            Current Architecture
          </div>
          <dl className="grid grid-cols-2 gap-y-1.5 text-xs">
            <dt className="text-zinc-500">Case Profile</dt>
            <dd className="text-zinc-200 text-right">{currentShapeInfo.profileLabel}</dd>
            <dt className="text-zinc-500">Alloy</dt>
            <dd className="text-zinc-200 text-right">{currentMatSpec.alloyTitle}</dd>
            <dt className="text-zinc-500">Bezel Gauge</dt>
            <dd className="text-zinc-200 text-right font-mono">{store.bezel.toFixed(2)}</dd>
            <dt className="text-zinc-500">Dial</dt>
            <dd className="text-zinc-200 text-right">
              {currentFinishLabel} · {currentMarkerLabel}
            </dd>
            <dt className="text-zinc-500">Hands</dt>
            <dd className="text-zinc-200 text-right">
              {currentHandStyleLabel} · {currentHandColorName}
            </dd>
            <dt className="text-zinc-500">Mount</dt>
            <dd className="text-zinc-200 text-right">
              {store.mount === 'desk' ? 'Desk Stand (6° Tilt)' : 'Wall Floating'}
            </dd>
          </dl>
        </section>
      </div>

      {/* Sticky Footer: Live Price + Reset · Share link · Download PNG · Copy design (⋯ menu on mobile) */}
      <div className="relative p-3.5 desktop:p-4 border-t border-atelier-border bg-[#121419] space-y-2.5 shrink-0">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">
              Estimated Price
            </div>
            <div className="text-[10px] desktop:text-[11px] text-zinc-500">
              Incl. bespoke assembly
            </div>
          </div>
          <div className="font-brand text-xl desktop:text-2xl font-semibold text-atelier-gold tracking-tight tabular-nums">
            {formatINR(livePrice)}
          </div>
        </div>

        {/* Desktop Footer Actions: Reset · Share link · Download PNG · Copy design */}
        <div className="hidden desktop:grid desktop:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="py-2 px-2.5 rounded-lg text-xs font-medium bg-atelier-surface border border-atelier-border text-zinc-300 hover:text-white hover:border-zinc-600 transition"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleShareLink}
            className="py-2 px-2.5 rounded-lg text-xs font-semibold bg-atelier-gold text-zinc-950 hover:bg-atelier-goldHover transition"
          >
            Share link
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="py-2 px-2.5 rounded-lg text-xs font-medium bg-atelier-surface border border-atelier-border text-zinc-200 hover:text-white hover:border-atelier-gold/50 transition"
          >
            Download PNG
          </button>
          <button
            type="button"
            onClick={handleCopyDesign}
            className="py-2 px-2.5 rounded-lg text-xs font-medium bg-atelier-surface border border-atelier-border text-zinc-200 hover:text-white hover:border-atelier-gold/50 transition"
          >
            Copy design
          </button>
        </div>

        {/* Mobile Footer Actions: Primary Share link + Download PNG + ⋯ menu */}
        <div className="flex desktop:hidden items-center gap-2">
          <button
            type="button"
            onClick={handleShareLink}
            className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold bg-atelier-gold text-zinc-950 hover:bg-atelier-goldHover transition"
          >
            Share link
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="py-2 px-3 rounded-lg text-xs font-medium bg-atelier-surface border border-atelier-border text-zinc-200 hover:text-white transition"
          >
            Download PNG
          </button>
          <button
            type="button"
            aria-label="More actions"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className={`w-9 h-9 rounded-lg border flex items-center justify-center text-base font-bold tracking-widest transition ${
              mobileMenuOpen
                ? 'bg-atelier-gold/20 border-atelier-gold text-atelier-gold'
                : 'bg-atelier-surface border-atelier-border text-zinc-200 hover:text-white'
            }`}
          >
            ⋯
          </button>
        </div>

        {/* Mobile ⋯ Popover Menu */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-30 desktop:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="absolute right-3.5 bottom-full mb-2 w-48 rounded-xl bg-atelier-panel border border-atelier-border shadow-2xl py-1.5 z-40 desktop:hidden">
              <button
                type="button"
                onClick={handleReset}
                className="w-full px-3.5 py-2 text-left text-xs text-zinc-200 hover:bg-atelier-surface flex items-center justify-between"
              >
                <span>Reset</span>
                <span className="text-[10px] text-zinc-500">Default</span>
              </button>
              <button
                type="button"
                onClick={handleShareLink}
                className="w-full px-3.5 py-2 text-left text-xs text-atelier-gold hover:bg-atelier-surface flex items-center justify-between font-medium"
              >
                <span>Share link</span>
                <span className="text-[10px] text-atelier-gold/70">#d=…</span>
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="w-full px-3.5 py-2 text-left text-xs text-zinc-200 hover:bg-atelier-surface flex items-center justify-between"
              >
                <span>Download PNG</span>
                <span className="text-[10px] text-zinc-500">2× HD</span>
              </button>
              <button
                type="button"
                onClick={handleCopyDesign}
                className="w-full px-3.5 py-2 text-left text-xs text-zinc-200 hover:bg-atelier-surface flex items-center justify-between"
              >
                <span>Copy design</span>
                <span className="text-[10px] text-zinc-500">JSON</span>
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
