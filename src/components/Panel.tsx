import React, { useState } from 'react';
import { CASE_MATERIAL_SPECS } from '../lib/materials';
import {
  calculatePrice,
  FINISH_PRICES,
  formatINR,
  MARKER_PRICES,
  MATERIAL_PRICES,
  SHAPE_PRICES,
} from '../lib/pricing';
import {
  CaseMaterial,
  CaseShape,
  DialFinish,
  HourMarkerStyle,
  useClockStore,
} from '../store/useClockStore';

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

export const Panel: React.FC = () => {
  const store = useClockStore();
  const [copied, setCopied] = useState(false);

  const livePrice = calculatePrice(store);
  const currentShapeInfo =
    SHAPE_OPTIONS.find((o) => o.value === store.shape) ?? SHAPE_OPTIONS[0];
  const currentMatSpec = CASE_MATERIAL_SPECS[store.caseMat];
  const currentFinishLabel =
    FINISH_OPTIONS.find((f) => f.value === store.dialFinish)?.label ?? 'Plain';
  const currentMarkerLabel =
    MARKER_OPTIONS.find((m) => m.value === store.hourMarkers)?.label ?? 'Roman';
  const bezelPriceDelta = Math.max(0, Math.round((store.bezel - 0.1) * 1000));
  const isCustomDialColor = !DIAL_SWATCHES.some(
    (s) => s.hex.toLowerCase() === store.dialColor.toLowerCase()
  );

  const handleCopyDesign = async () => {
    try {
      const json = JSON.stringify(store.getSerializableConfig(), null, 2);
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  return (
    <aside className="w-full desktop:w-[360px] desktop:h-full bg-atelier-panel border-t desktop:border-t-0 desktop:border-l border-atelier-border flex flex-col shrink-0 select-none">
      {/* Panel Header */}
      <div className="px-5 pt-5 pb-4 border-b border-atelier-border">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-[0.22em] text-atelier-gold font-medium">
            Atelier Configurator
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-atelier-gold/10 text-atelier-gold border border-atelier-gold/25">
            Phase 3 · Dial Studio
          </span>
        </div>
        <h2 className="font-brand text-lg text-zinc-100 mt-1">
          Case &amp; Dial Craftsmanship
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Configure case alloy, engine-turned dial finishes, indices, and engraving.
        </p>
      </div>

      {/* Scrollable Controls Area */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        {/* 1. Case Shape Segmented Buttons */}
        <section className="space-y-2.5">
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
        </section>

        {/* 2. Case Material Buttons */}
        <section className="space-y-2.5">
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
                  className={`py-2.5 px-3 rounded-lg text-xs font-medium border flex items-center gap-2.5 transition ${
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
        </section>

        {/* 3. Bezel Thickness Slider */}
        <section className="space-y-2.5">
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
        </section>

        <div className="border-t border-atelier-border/80" />

        {/* 4. Dial Colour (6 Swatches + Custom Picker) */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs uppercase tracking-[0.14em] text-zinc-400 font-medium">
              Dial colour
            </label>
            <span className="font-mono text-[11px] text-zinc-400 uppercase">
              {store.dialColor}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
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
                  className={`w-9 h-9 rounded-full transition flex items-center justify-center ${
                    active
                      ? 'ring-2 ring-atelier-gold ring-offset-2 ring-offset-atelier-panel scale-105'
                      : 'border border-white/20 hover:scale-105'
                  }`}
                  style={{ backgroundColor: swatch.hex }}
                />
              );
            })}

            {/* Custom colour picker */}
            <label
              title="Custom dial colour"
              className={`relative w-9 h-9 rounded-full cursor-pointer flex items-center justify-center overflow-hidden transition ${
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
        </section>

        {/* 5. Dial Finish */}
        <section className="space-y-2.5">
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
        </section>

        {/* 6. Hour Markers + Minute Track Toggle */}
        <section className="space-y-2.5">
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

          <button
            type="button"
            onClick={() =>
              store.setConfig({ showMinuteTrack: !store.showMinuteTrack })
            }
            className={`w-full mt-1.5 py-2 px-3 rounded-lg text-xs font-medium border flex items-center justify-between transition ${
              store.showMinuteTrack
                ? 'bg-atelier-gold/10 border-atelier-gold/40 text-zinc-200'
                : 'bg-atelier-surface border-atelier-border text-zinc-400 hover:border-zinc-600'
            }`}
          >
            <span>Outer Minute Track</span>
            <span className="text-[11px] uppercase tracking-wider text-atelier-gold">
              {store.showMinuteTrack ? 'Shown' : 'Hidden'}
            </span>
          </button>
        </section>

        {/* 7. Dial Engraving */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="engraving-input"
              className="text-xs uppercase tracking-[0.14em] text-zinc-400 font-medium"
            >
              Dial engraving
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
        </section>

        <div className="border-t border-atelier-border/80" />

        {/* 8. Seconds Movement & Studio Showcase */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs uppercase tracking-[0.14em] text-zinc-400 font-medium">
              Seconds Movement
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
              {store.showSeconds ? 'Visible' : 'Hidden'}
            </button>
          </div>
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
                  {mode === 'sweep' ? 'Smooth Sweep' : 'Quartz Tick'}
                </button>
              );
            })}
          </div>

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
        </section>

        {/* 9. Live Current Architecture Card */}
        <section className="rounded-xl bg-atelier-surface/70 border border-atelier-border p-4 space-y-2.5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-400 font-medium">
            Current Architecture
          </div>
          <dl className="grid grid-cols-2 gap-y-2 text-xs">
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
            <dd className="text-zinc-200 text-right capitalize">{store.handStyle} Tapered</dd>
          </dl>
        </section>
      </div>

      {/* Sticky Footer: Price + Actions */}
      <div className="p-5 border-t border-atelier-border bg-[#121419] space-y-3.5">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">
              Estimated Price
            </div>
            <div className="text-[11px] text-zinc-500">Incl. bespoke assembly</div>
          </div>
          <div className="font-brand text-2xl font-semibold text-atelier-gold tracking-tight tabular-nums">
            {formatINR(livePrice)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={store.resetConfig}
            className="py-2.5 px-3 rounded-lg text-xs font-medium bg-atelier-surface border border-atelier-border text-zinc-300 hover:text-white hover:border-zinc-600 transition"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleCopyDesign}
            className="py-2.5 px-3 rounded-lg text-xs font-semibold bg-atelier-gold text-zinc-950 hover:bg-atelier-goldHover transition"
          >
            {copied ? 'Copied JSON ✓' : 'Copy Design'}
          </button>
        </div>
      </div>
    </aside>
  );
};
