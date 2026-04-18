import { useState, useEffect, useCallback } from 'react';
import type { BrandProfile } from '../App';
import useGoogleFonts from '../hooks/useGoogleFonts';

// WCAG relative luminance calculation
function getLuminance(r: number, g: number, b: number) {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function hexToRgb(hex: string) {
  const defaultRgb = { r: 0, g: 0, b: 0 };
  if (!hex) return defaultRgb;
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length !== 6) return defaultRgb;
  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);
  return { r, g, b };
}

function getContrastRatio(hex1: string, hex2: string) {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

const FONT_PRESETS: { id: string; label: string; headline: string; body: string; vibe: string }[] = [
  { id: 'clean-pro',   label: 'Clean Pro',   headline: 'Space Grotesk',      body: 'Inter',               vibe: 'Polished & professional' },
  { id: 'luxury',      label: 'Luxury',      headline: 'Cormorant Garamond', body: 'DM Sans',             vibe: 'Elegant & upscale' },
  { id: 'streetwear',  label: 'Streetwear',  headline: 'Bebas Neue',         body: 'Barlow',              vibe: 'Raw & high-energy' },
  { id: 'bold-hype',   label: 'Bold / Hype', headline: 'Anton',              body: 'Inter',               vibe: 'Loud & attention-grabbing' },
  { id: 'editorial',   label: 'Editorial',   headline: 'Fraunces',           body: 'Outfit',              vibe: 'Magazine-quality storytelling' },
  { id: 'minimal',     label: 'Minimal',     headline: 'Syne',               body: 'Manrope',             vibe: 'Quiet sophistication' },
];

const LAYOUT_PRESETS: { id: BrandProfile['layoutStyle']; label: string; desc: string; preview: string }[] = [
  { id: 'bold',         label: 'Bold',         desc: 'Big type, color bars, maximum impact',       preview: '■ HEADLINE\nBody text here' },
  { id: 'minimal',      label: 'Minimal',      desc: 'Lots of space, one idea per slide',          preview: '  Headline\n  Subtle body' },
  { id: 'editorial',    label: 'Editorial',    desc: 'Magazine layout, text + image side by side', preview: 'H E A D L I N E\n─────────────' },
  { id: 'streetwear',   label: 'Streetwear',   desc: 'Overlapping type, raw energy, dark',         preview: 'BIG\n WORD\n  ENERGY' },
  { id: 'luxury',       label: 'Luxury',       desc: 'Sparse, elegant, logo-forward',              preview: '· · ·\n  Title\n· · ·' },
  { id: 'data-forward', label: 'Data-Forward', desc: 'Lead with a number or stat every slide',     preview: '73\nHaircuts/Week' },
];

const TONE_PRESETS: { id: BrandProfile['tone']; label: string; example: string }[] = [
  { id: 'professional', label: 'Professional', example: '"73 haircuts in one week. Here\'s the system."' },
  { id: 'hype',         label: 'Hype',         example: '"STOP sleeping on this. Your chair is a money machine."' },
  { id: 'storyteller',  label: 'Storyteller',  example: '"Last year I was broke. Then I changed one thing."' },
  { id: 'data-driven',  label: 'Data-Driven',  example: '"Barbers who text clients earn 34% more per week."' },
];

const DEFAULT_PROFILE: BrandProfile = {
  brandName: '6FB Mentorship',
  primaryColor: '#00C851',
  accentColor: '#ffffff',
  backgroundColor: '#0f0f0f',
  fontPreset: 'clean-pro',
  headlineFont: 'Space Grotesk',
  bodyFont: 'Inter',
  layoutStyle: 'bold',
  tone: 'professional',
  logoPath: null,
};

interface Props { onSave?: (profile: BrandProfile) => void; }

export default function BrandStudio({ onSave }: Props) {
  const [profile, setProfile] = useState<BrandProfile>(DEFAULT_PROFILE);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Dynamically load the fonts so preview actually matches the Google Fonts
  useGoogleFonts(profile.headlineFont, profile.bodyFont);

  // Check Contrast
  const textContrast = getContrastRatio(profile.accentColor, profile.backgroundColor);
  const primaryContrast = getContrastRatio(profile.primaryColor, profile.backgroundColor);
  const hasContrastWarning = textContrast < 4.0 || primaryContrast < 2.5;

  useEffect(() => {
    window.electronAPI.getBrandProfile().then(p => setProfile(p)).catch(() => {});
  }, []);

  const update = useCallback(<K extends keyof BrandProfile>(key: K, val: BrandProfile[K]) => {
    setProfile(prev => ({ ...prev, [key]: val }));
    setSaved(false);
  }, []);

  const handleFontPreset = (preset: typeof FONT_PRESETS[0]) => {
    setProfile(prev => ({ ...prev, fontPreset: preset.id, headlineFont: preset.headline, bodyFont: preset.body }));
    setSaved(false);
  };

  const handleSelectLogo = async () => {
    const result = await window.electronAPI.selectLogo();
    if (!result.cancelled && result.filePath) update('logoPath', result.filePath);
  };

  const handleSave = async () => {
    setSaving(true);
    await window.electronAPI.saveBrandProfile(profile);
    onSave?.(profile);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const activeFontPreset = FONT_PRESETS.find(f => f.id === profile.fontPreset);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Brand Studio</h1>
          <p className="text-sm text-[#555] mt-1">Define your visual identity. Every carousel you generate will match.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 text-sm font-bold px-5 py-2 rounded-xl transition-all ${
            saved
              ? 'bg-[#00C851]/20 text-[#00C851] border border-[#00C851]/30'
              : 'bg-[#00C851] text-black hover:bg-[#00b548]'
          }`}
        >
          {saved ? 'Saved' : saving ? 'Saving…' : 'Save Brand'}
        </button>
      </div>

      <div className="space-y-8">

        {/* ── Identity ── */}
        <Section title="Identity">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Brand Name</label>
              <input
                value={profile.brandName}
                onChange={e => update('brandName', e.target.value)}
                placeholder="Your brand or business name"
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label">Logo</label>
              <button onClick={handleSelectLogo} className="field-input text-left flex items-center gap-2 text-[#666] hover:text-white transition-colors">
                {profile.logoPath
                  ? <><img src={`localfile://${profile.logoPath}`} alt="logo" className="h-5 w-5 object-contain rounded" /><span className="text-xs text-white truncate">{profile.logoPath.split('/').pop()}</span></>
                  : <><LogoIcon /><span className="text-xs">Click to upload PNG or SVG</span></>
                }
              </button>
            </div>
          </div>
        </Section>

        {/* ── Colors ── */}
        <Section title="Colors">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {([
              { key: 'primaryColor',    label: 'Primary',    hint: 'Main brand color' },
              { key: 'accentColor',     label: 'Accent',     hint: 'Text / highlights' },
              { key: 'backgroundColor', label: 'Background', hint: 'Slide background' },
            ] as const).map(({ key, label, hint }) => (
              <div key={key}>
                <label className="field-label">{label}</label>
                <p className="text-[10px] text-[#444] mb-2">{hint}</p>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="color"
                      value={profile[key]}
                      onChange={e => update(key, e.target.value)}
                      className="w-9 h-9 rounded-lg border border-[#2a2a2a] cursor-pointer bg-transparent p-0.5"
                    />
                  </div>
                  <input
                    type="text"
                    value={profile[key]}
                    onChange={e => {
                      if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) update(key, e.target.value);
                    }}
                    className="flex-1 field-input font-mono text-xs"
                    maxLength={7}
                  />
                </div>
              </div>
            ))}
          </div>

          {hasContrastWarning && (
            <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-start gap-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <div>
                <p className="text-[11px] font-bold text-yellow-500 mb-0.5">Low Contrast Warning</p>
                <p className="text-[10px] text-yellow-500/80 leading-relaxed">
                  Your text or primary color might blend into the background and become unreadable. Consider increasing the contrast between your Accent and Background colors.
                </p>
              </div>
            </div>
          )}

          {/* Live color preview strip */}
          <div
            className="mt-4 rounded-xl p-4 flex items-center gap-4 border border-[#222]"
            style={{ background: profile.backgroundColor }}
          >
            {profile.logoPath ? (
              <img src={`localfile://${profile.logoPath}`} alt="" className="w-8 h-8 object-contain drop-shadow-md" />
            ) : (
              <div className="w-8 h-8 rounded-full" style={{ background: profile.primaryColor }} />
            )}
            <div className="flex-1">
              <p className="text-sm font-bold" style={{ color: profile.accentColor }}>{profile.brandName || 'Your Brand'}</p>
              <p className="text-[10px]" style={{ color: profile.primaryColor }}>Primary · Accent · Background</p>
            </div>
            <div className="px-3 py-1 rounded-full text-xs font-bold" style={{ background: profile.primaryColor, color: profile.backgroundColor }}>
              Follow
            </div>
          </div>
        </Section>

        {/* ── Typography ── */}
        <Section title="Typography">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {FONT_PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => handleFontPreset(preset)}
                className={`text-left p-3 rounded-xl border transition-all ${
                  profile.fontPreset === preset.id
                    ? 'border-[#00C851]/50 bg-[#00C851]/8'
                    : 'border-[#222] hover:border-[#333] bg-[#161616]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-white">{preset.label}</span>
                  {profile.fontPreset === preset.id && (
                    <span className="text-[9px] text-[#00C851] font-bold uppercase tracking-wide">Active</span>
                  )}
                </div>
                <p className="text-[10px] text-[#555] mb-1.5">{preset.vibe}</p>
                <div className="flex gap-2 text-[9px] text-[#444]">
                  <span className="bg-[#1e1e1e] px-1.5 py-0.5 rounded">{preset.headline}</span>
                  <span className="bg-[#1e1e1e] px-1.5 py-0.5 rounded">{preset.body}</span>
                </div>
              </button>
            ))}
          </div>

          {activeFontPreset && (
            <div className="bg-[#161616] rounded-xl border border-[#222] p-4">
              <p className="text-[10px] text-[#444] mb-3 uppercase tracking-widest">Preview</p>
              <p className="text-2xl font-bold text-white mb-1" style={{ fontFamily: `'${activeFontPreset.headline}', sans-serif` }}>
                Make $1,000 This Week
              </p>
              <p className="text-sm text-[#888]" style={{ fontFamily: `'${activeFontPreset.body}', sans-serif` }}>
                Here's the exact framework 73 barbers used to double their weekly revenue without adding a single new client.
              </p>
            </div>
          )}
        </Section>

        {/* ── Layout Style ── */}
        <Section title="Layout Style">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {LAYOUT_PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => update('layoutStyle', preset.id)}
                className={`text-left p-3 rounded-xl border transition-all ${
                  profile.layoutStyle === preset.id
                    ? 'border-[#00C851]/50 bg-[#00C851]/8'
                    : 'border-[#222] hover:border-[#333] bg-[#161616]'
                }`}
              >
                <div
                  className="w-full h-16 rounded-lg mb-2 flex items-center justify-center font-mono text-[9px] leading-relaxed whitespace-pre text-center"
                  style={{ background: '#0a0a0a', color: profile.primaryColor }}
                >
                  {preset.preview}
                </div>
                <p className="text-[11px] font-bold text-white">{preset.label}</p>
                <p className="text-[9px] text-[#444] mt-0.5">{preset.desc}</p>
              </button>
            ))}
          </div>
        </Section>

        {/* ── Tone of Voice ── */}
        <Section title="Tone of Voice">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TONE_PRESETS.map(t => (
              <button
                key={t.id}
                onClick={() => update('tone', t.id)}
                className={`text-left p-3 rounded-xl border transition-all ${
                  profile.tone === t.id
                    ? 'border-[#00C851]/50 bg-[#00C851]/8'
                    : 'border-[#222] hover:border-[#333] bg-[#161616]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-white">{t.label}</span>
                  {profile.tone === t.id && <span className="text-[9px] text-[#00C851] font-bold">Active</span>}
                </div>
                <p className="text-[10px] text-[#555] italic leading-relaxed">{t.example}</p>
              </button>
            ))}
          </div>
        </Section>

      </div>

      {/* Save footer */}
      <div className="mt-10 pt-6 border-t border-[#1e1e1e] flex items-center justify-between">
        <p className="text-xs text-[#444]">Changes apply to all future carousels you generate.</p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#00C851] text-black font-bold text-sm px-6 py-2 rounded-xl hover:bg-[#00b548] transition-colors"
        >
          {saved ? 'Saved' : saving ? 'Saving…' : 'Save Brand Profile'}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-[10px] font-bold text-[#444] uppercase tracking-widest mb-4">{title}</h2>
      {children}
    </div>
  );
}

function LogoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  );
}

// Tailwind-in-JS utility classes (add to index.css if preferred)
const _css = `
.field-label { @apply text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1.5 block; }
.field-input { @apply w-full bg-[#161616] border border-[#222] rounded-lg px-3 py-2 text-white text-sm placeholder-[#444] focus:outline-none focus:border-[#00C851]/50 transition-colors; }
`;
void _css;
