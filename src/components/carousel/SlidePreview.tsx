import React from 'react';
import type { BrandProfile, CarouselSlide } from '../../App';

interface SlidePreviewProps {
  slide: CarouselSlide;
  brand: BrandProfile;
  slideIndex: number;
  totalSlides: number;
  isActive?: boolean;
  onClick?: () => void;
  showVideoFrames?: boolean;
}

type TemplateProps = { slide: CarouselSlide; brand: BrandProfile; slideIndex: number; totalSlides: number; showVideoFrames?: boolean };

// ─── Shared Components ───────────────────────────────────────────
function NoiseBackground({ brand }: { brand: BrandProfile }) {
  // Simulates the premium dark textured background from 6FB's skill outputs
  return (
    <div className="absolute inset-0 z-0 bg-[#0a0a0a]">
      <div className="absolute inset-0" style={{ background: `radial-gradient(circle at top right, ${brand.accentColor}0a, transparent 65%), linear-gradient(135deg, rgba(20,20,20,0.8) 0%, rgba(10,10,10,1) 100%)` }} />
      <div className="absolute inset-0 opacity-[0.14] pointer-events-none mix-blend-overlay"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />
    </div>
  );
}

function FrameBg({ src, opacity = 0.3 }: { src: string; opacity?: number }) {
  return (
    <div className="absolute inset-0 z-0">
      <img src={`localfile://${src}`} alt="" className="w-full h-full object-cover" />
      <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${1 - opacity})` }} />
    </div>
  );
}

function LogoBadge({ brand, size = 24 }: { brand: BrandProfile; size?: number }) {
  if (brand.logoPath) {
    return <img src={`localfile://${brand.logoPath}`} alt="" style={{ width: size, height: size }} className="object-contain" />;
  }
  return (
    <div style={{ width: size, height: size, background: brand.primaryColor, borderRadius: size * 0.25 }}
      className="flex items-center justify-center">
      <span style={{ fontSize: size * 0.4, color: brand.backgroundColor }} className="font-black leading-none">
        {(brand.brandName || '6FB').slice(0, 3).toUpperCase()}
      </span>
    </div>
  );
}

function SlideFooter({ brand, slideIndex, totalSlides }: { brand: BrandProfile; slideIndex: number; totalSlides: number }) {
  return (
    <div className="flex items-center justify-between mt-auto pt-3">
      <span className="text-[7px] tracking-wider" style={{ color: brand.primaryColor }}>
        @{brand.brandName.toLowerCase().replace(/\s+/g, '')}
      </span>
      {slideIndex < totalSlides - 1 && (
        <span className="text-[7px] tracking-wider" style={{ color: brand.accentColor + '55' }}>
          Swipe →
        </span>
      )}
    </div>
  );
}

function StatCard({ value, label, brand, icon }: { value: string; label: string; brand: BrandProfile; icon?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: brand.accentColor + '08', border: `1px solid ${brand.accentColor}15` }}>
      {icon && <span className="text-[10px] block mb-1" style={{ color: brand.primaryColor }}>{icon}</span>}
      <p className="text-xl font-black leading-none mb-0.5" style={{ color: brand.primaryColor, fontFamily: `'${brand.headlineFont}', sans-serif` }}>
        {value}
      </p>
      <p className="text-[7px] uppercase tracking-widest font-bold" style={{ color: brand.accentColor + '66' }}>{label}</p>
    </div>
  );
}

// ─── Template: Bold ──────────────────────────────────────────────
function BoldTemplate({ slide, brand, slideIndex, totalSlides, showVideoFrames = true }: TemplateProps) {
  const hasFrame = !!slide.framePath && showVideoFrames;
  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden" style={{ background: hasFrame ? brand.backgroundColor : '#0a0a0a', fontFamily: `'${brand.bodyFont}', sans-serif` }}>
      {hasFrame ? <FrameBg src={slide.framePath!} opacity={0.25} /> : <NoiseBackground brand={brand} />}
      <div className="relative z-10 flex-1 flex flex-col p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-auto">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: brand.primaryColor }} />
            <span className="text-[7px] font-bold uppercase tracking-widest" style={{ color: brand.primaryColor }}>
              {slide.slideType === 'cover' ? brand.brandName : `${String(slideIndex + 1).padStart(2, '0')} / ${String(totalSlides).padStart(2, '0')}`}
            </span>
          </div>
          <LogoBadge brand={brand} size={20} />
        </div>

        {/* Content */}
        <div className="mt-auto">
          {/* Stat in its own card if present */}
          {slide.stat && (
            <div className="mb-3">
              <StatCard value={slide.stat} label={slide.heading.split(' ').slice(0, 3).join(' ')} brand={brand} />
            </div>
          )}

          <h2 className="text-xl font-black leading-tight mb-2" style={{ color: brand.accentColor, fontFamily: `'${brand.headlineFont}', sans-serif` }}>
            {slide.heading}
          </h2>

          {/* Body in a card overlay */}
          <div className="rounded-xl p-3" style={{ background: brand.accentColor + '08', border: `1px solid ${brand.accentColor}12` }}>
            <p className="text-[9px] leading-relaxed" style={{ color: brand.accentColor + '99' }}>{slide.body}</p>
          </div>

          {slide.ctaText && slide.slideType === 'cta' && (
            <div className="mt-2 rounded-xl py-2 px-4 text-center text-[9px] font-bold" style={{ background: brand.primaryColor, color: brand.backgroundColor }}>
              {slide.ctaText}
            </div>
          )}
        </div>

        <SlideFooter brand={brand} slideIndex={slideIndex} totalSlides={totalSlides} />
      </div>
    </div>
  );
}

// ─── Template: Editorial ─────────────────────────────────────────
function EditorialTemplate({ slide, brand, slideIndex, totalSlides, showVideoFrames = true }: TemplateProps) {
  const hasFrame = !!slide.framePath && showVideoFrames;
  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden" style={{ background: hasFrame ? '#faf9f6' : '#0a0a0a', fontFamily: `'${brand.bodyFont}', sans-serif` }}>
      {hasFrame ? <FrameBg src={slide.framePath!} opacity={0.15} /> : <NoiseBackground brand={brand} />}
      <div className="relative z-10 flex-1 flex flex-col p-5">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-[7px] font-bold uppercase tracking-[0.2em]" style={{ color: brand.primaryColor }}>
            {brand.brandName}
          </span>
          <LogoBadge brand={brand} size={18} />
        </div>

        <div className="h-px w-full mb-4" style={{ background: brand.primaryColor + '40' }} />

        {/* Stat */}
        {slide.stat && (
          <p className="text-4xl font-black mb-1 leading-none" style={{ color: brand.primaryColor, fontFamily: `'${brand.headlineFont}', sans-serif` }}>
            {slide.stat}
          </p>
        )}

        <h2 className="text-lg font-bold leading-snug mb-3" style={{ color: (hasFrame || !hasFrame) ? brand.accentColor : '#1a1a1a', fontFamily: `'${brand.headlineFont}', sans-serif` }}>
          {slide.heading}
        </h2>

        <div className="w-10 h-0.5 mb-3" style={{ background: brand.primaryColor }} />

        <p className="text-[9px] leading-relaxed flex-1" style={{ color: (hasFrame || !hasFrame) ? brand.accentColor + 'cc' : '#555' }}>
          {slide.body}
        </p>

        {slide.ctaText && (
          <p className="text-[9px] font-bold mt-3" style={{ color: brand.primaryColor }}>→ {slide.ctaText}</p>
        )}

        <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: `1px solid ${hasFrame ? brand.accentColor + '20' : '#e8e5e0'}` }}>
          <span className="text-[7px] tracking-wider" style={{ color: brand.primaryColor }}>{slideIndex + 1} of {totalSlides}</span>
          {slideIndex < totalSlides - 1 && <span className="text-[7px]" style={{ color: hasFrame ? brand.accentColor + '55' : '#bbb' }}>Swipe →</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Template: Streetwear ────────────────────────────────────────
function StreetwearTemplate({ slide, brand, slideIndex, totalSlides, showVideoFrames = true }: TemplateProps) {
  const hasFrame = !!slide.framePath && showVideoFrames;
  const words = slide.heading.split(' ');
  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col" style={{ background: '#0a0a0a', fontFamily: `'${brand.headlineFont}', sans-serif` }}>
      {hasFrame ? <FrameBg src={slide.framePath!} opacity={0.2} /> : <NoiseBackground brand={brand} />}
      {/* Texture overlay */}
      <div className="absolute inset-0 opacity-[0.03] z-[1]"
        style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)', backgroundSize: '6px 6px' }} />

      <div className="relative z-10 flex-1 flex flex-col p-5">
        <div className="flex items-center justify-between mb-auto">
          <span className="text-[7px] font-mono tracking-widest" style={{ color: brand.primaryColor }}>
            {String(slideIndex + 1).padStart(2, '0')}
          </span>
          <LogoBadge brand={brand} size={18} />
        </div>

        {slide.stat && (
          <div className="mb-2">
            <span className="text-4xl font-black" style={{ color: brand.primaryColor }}>{slide.stat}</span>
          </div>
        )}

        <div className="flex-1 flex flex-col justify-center">
          {words.map((word, i) => (
            <div key={i} className="text-2xl font-black uppercase leading-none" style={{
              color: i % 2 === 0 ? '#ffffff' : brand.primaryColor,
              marginLeft: `${(i % 3) * 10}%`,
              marginBottom: '2px',
            }}>
              {word}
            </div>
          ))}
        </div>

        {/* Body in a dark card */}
        <div className="rounded-lg p-2.5 mt-2" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-[8px] leading-relaxed" style={{ color: '#999', fontFamily: `'${brand.bodyFont}', sans-serif` }}>{slide.body}</p>
        </div>

        {slide.ctaText && (
          <div className="mt-2 text-[8px] font-bold uppercase tracking-widest" style={{ color: brand.primaryColor }}>
            {slide.ctaText} →
          </div>
        )}

        <SlideFooter brand={brand} slideIndex={slideIndex} totalSlides={totalSlides} />
      </div>
    </div>
  );
}

// ─── Template: Luxury ────────────────────────────────────────────
function LuxuryTemplate({ slide, brand, slideIndex, totalSlides, showVideoFrames = true }: TemplateProps) {
  const hasFrame = !!slide.framePath && showVideoFrames;
  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden" style={{ background: hasFrame ? brand.backgroundColor : '#0a0a0a', fontFamily: `'${brand.bodyFont}', sans-serif` }}>
      {hasFrame ? <FrameBg src={slide.framePath!} opacity={0.2} /> : <NoiseBackground brand={brand} />}
      {/* Inset border */}
      <div className="absolute inset-3 border pointer-events-none z-[1]" style={{ borderColor: brand.primaryColor + '25' }} />

      <div className="relative z-10 flex-1 flex flex-col justify-between p-8">
        {/* Top brand */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="h-px w-6" style={{ background: brand.primaryColor + '50' }} />
            <LogoBadge brand={brand} size={16} />
            <div className="h-px w-6" style={{ background: brand.primaryColor + '50' }} />
          </div>
          <span className="text-[7px] tracking-[0.3em] uppercase" style={{ color: brand.primaryColor + 'aa' }}>
            {brand.brandName}
          </span>
        </div>

        {/* Center */}
        <div className="text-center">
          {slide.stat && (
            <p className="text-4xl font-light mb-3 tracking-tight" style={{ color: brand.primaryColor, fontFamily: `'${brand.headlineFont}', sans-serif` }}>
              {slide.stat}
            </p>
          )}
          <h2 className="text-base font-light leading-snug mb-4" style={{ color: brand.accentColor, letterSpacing: '0.02em', fontFamily: `'${brand.headlineFont}', sans-serif` }}>
            {slide.heading}
          </h2>
          <div className="w-6 h-px mx-auto mb-4" style={{ background: brand.primaryColor }} />
          <p className="text-[8px] leading-loose tracking-wide" style={{ color: brand.accentColor + '66' }}>{slide.body}</p>
          {slide.ctaText && (
            <p className="text-[8px] tracking-[0.2em] uppercase mt-5" style={{ color: brand.primaryColor }}>{slide.ctaText}</p>
          )}
        </div>

        <p className="text-center text-[6px] tracking-[0.4em] uppercase" style={{ color: brand.accentColor + '25' }}>
          {slideIndex + 1} · {totalSlides}
        </p>
      </div>
    </div>
  );
}

// ─── Template: Data-Forward ──────────────────────────────────────
function DataForwardTemplate({ slide, brand, slideIndex, totalSlides, showVideoFrames = true }: TemplateProps) {
  const hasFrame = !!slide.framePath && showVideoFrames;

  // Only highlight the stat heavily if it's short and punchy (like a true data point)
  const rawStat = slide.stat?.trim() || '';
  const isShortStat = rawStat && rawStat.length <= 15;
  
  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden" 
      style={{ background: hasFrame ? brand.backgroundColor : '#0a0a0a', fontFamily: `'${brand.bodyFont}', sans-serif` }}>
      {hasFrame ? <FrameBg src={slide.framePath!} opacity={0.2} /> : <NoiseBackground brand={brand} />}
      <div className="relative z-10 flex-1 flex flex-col p-4">
        
        {/* Header - Mimicking "Community Stats" top bar */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: brand.primaryColor }} />
            <span className="text-[7px] font-bold uppercase tracking-widest" style={{ color: brand.accentColor + '99' }}>
              {slide.slideType === 'cover' ? brand.brandName : 'Key Insight'}
            </span>
          </div>
          <LogoBadge brand={brand} size={20} />
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-1 mb-5">
          {Array.from({ length: totalSlides }).map((_, i) => (
            <div key={i} className="h-0.5 flex-1 rounded" style={{ background: i === slideIndex ? brand.primaryColor : brand.primaryColor + '20' }} />
          ))}
        </div>

        {/* Heading - Clean, large, structured */}
        <h2 className={`font-black leading-tight tracking-tight mb-3 ${slide.slideType === 'cover' ? 'text-xl' : 'text-base'}`} 
          style={{ color: brand.accentColor, fontFamily: `'${brand.headlineFont}', sans-serif` }}>
          {slide.heading}
        </h2>

        {/* Only show the dedicated Stat Card if it's actually formatable as a stat */}
        {isShortStat && (
          <div className="mb-3 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-2xl font-black leading-none mb-1 tracking-tighter" style={{ color: brand.primaryColor, fontFamily: `'${brand.headlineFont}', sans-serif` }}>
              {rawStat}
            </p>
            <p className="text-[6px] uppercase tracking-[0.15em] font-bold" style={{ color: brand.accentColor + '66' }}>
              {slide.heading.split(' ').slice(0, 4).join(' ')} Highlight
            </p>
          </div>
        )}

        {/* Body content - clean spacing */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {(!isShortStat && rawStat) && (
            <p className="text-[8px] font-bold mb-1.5 uppercase tracking-wider" style={{ color: brand.primaryColor }}>
              {rawStat}
            </p>
          )}
          <p className="text-[8px] leading-[1.55] opacity-90" style={{ color: brand.accentColor + 'bb' }}>{slide.body}</p>
        </div>

        {/* CTA Footer */}
        {slide.ctaText && (
          <div className="mt-2 rounded-lg py-1.5 px-3 text-center text-[8px] font-bold shadow-lg"
            style={{ background: brand.primaryColor, color: brand.backgroundColor, boxShadow: `0 4px 12px ${brand.primaryColor}20` }}>
            {slide.ctaText}
          </div>
        )}

        <SlideFooter brand={brand} slideIndex={slideIndex} totalSlides={totalSlides} />
      </div>
    </div>
  );
}

// ─── Template Router ─────────────────────────────────────────────
const TEMPLATES: Record<BrandProfile['layoutStyle'], (props: TemplateProps) => React.ReactElement> = {
  'bold':         (p) => <BoldTemplate {...p} />,
  'minimal':      (p) => <LuxuryTemplate {...p} />,
  'editorial':    (p) => <EditorialTemplate {...p} />,
  'streetwear':   (p) => <StreetwearTemplate {...p} />,
  'luxury':       (p) => <LuxuryTemplate {...p} />,
  'data-forward': (p) => <DataForwardTemplate {...p} />,
};

// ─── Public Component ────────────────────────────────────────────
export default function SlidePreview({ slide, brand, slideIndex, totalSlides, isActive, onClick, showVideoFrames = true }: SlidePreviewProps) {
  const TemplateComp = TEMPLATES[brand.layoutStyle] || TEMPLATES.bold;
  return (
    <div onClick={onClick}
      className={`relative overflow-hidden rounded-xl border transition-all cursor-pointer select-none
        ${isActive ? 'border-[#00C851] shadow-lg shadow-[#00C851]/10 scale-[1.02]' : 'border-[#222] hover:border-[#333]'}`}
      style={{ aspectRatio: '4/5' }}>
      <TemplateComp slide={slide} brand={brand} slideIndex={slideIndex} totalSlides={totalSlides} showVideoFrames={showVideoFrames} />
    </div>
  );
}
