import { forwardRef } from 'react';
import type { ThumbnailConcept } from '../../types/thumbnail-package';
import { toLocalFileUrl } from '../../utils/localFileUrl';

interface ThumbnailCoverPreviewProps {
  concept: ThumbnailConcept;
  imagePath?: string | null;
  imageDataUrl?: string | null;
  alt: string;
  exportSize?: boolean;
}

const accentColor = {
  emerald: '#00c851',
  red: '#ef4444',
  none: '#ffffff',
} as const;

function headlineLines(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 2) return words.join('\n');
  if (words.length === 3) return `${words[0]}\n${words.slice(1).join(' ')}`;
  return `${words.slice(0, 2).join(' ')}\n${words.slice(2).join(' ')}`;
}

const ThumbnailCoverPreview = forwardRef<HTMLDivElement, ThumbnailCoverPreviewProps>(function ThumbnailCoverPreview({ concept, imagePath, imageDataUrl, alt, exportSize = false }, ref) {
  const accent = accentColor[concept.accent];
  const isWarningLine = concept.treatment === 'warning-line';
  const isMarker = concept.treatment === 'marker';
  const hasProofTreatment = (isWarningLine || isMarker) && concept.accent !== 'none';

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden bg-[#070908] [container-type:inline-size] ${exportSize ? '' : 'aspect-video'}`}
      style={exportSize ? { width: 1536, height: 864 } : undefined}
      aria-label={alt}
    >
      {imagePath || imageDataUrl ? (
        <img
          src={imageDataUrl || toLocalFileUrl(imagePath || '')}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover [filter:brightness(.8)_contrast(1.12)_saturate(.82)]"
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_42%,#31443c,transparent_31%),linear-gradient(115deg,#090b0a,#242b27)]" />
      )}

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_69%_44%,transparent_16%,rgba(3,4,4,.1)_47%,rgba(0,0,0,.4)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,.86)_0%,rgba(2,3,3,.65)_27%,rgba(3,4,4,.26)_52%,rgba(3,4,4,.04)_76%,rgba(0,0,0,.18)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[40%] bg-[linear-gradient(0deg,rgba(0,0,0,.62),transparent)]" />
      <div className="absolute inset-0 opacity-[.07] [background-image:radial-gradient(rgba(255,255,255,.9)_0.5px,transparent_.5px)] [background-size:4px_4px] [mix-blend-mode:soft-light]" />

      {hasProofTreatment && isWarningLine && (
        <div className="absolute right-[13%] top-[18%] h-[5px] w-[20%] rotate-[-24deg] rounded-full opacity-85" style={{ backgroundColor: accent, boxShadow: `0 3px 14px ${accent}8a` }} />
      )}
      {hasProofTreatment && isMarker && (
        <div className="absolute right-[13%] top-[18%] h-[19%] w-[19%] rotate-[-9deg] rounded-[48%_52%_45%_55%/52%_44%_56%_48%] border-[5px] opacity-85" style={{ borderColor: accent, boxShadow: `0 3px 16px ${accent}8a` }} />
      )}

      <div className="absolute inset-y-0 left-0 flex w-[52%] items-center px-[5.3%] py-[8%]">
        <p
          className="max-w-full whitespace-pre-line break-words text-[clamp(1.15rem,8.3cqw,9.7rem)] uppercase leading-[.84] tracking-[-0.065em] text-[#f7f5ee]"
          style={{
            fontFamily: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
            textShadow: '0 3px 0 rgba(0,0,0,.52), 0 12px 28px rgba(0,0,0,.72)',
          }}
        >
          {headlineLines(concept.text)}
        </p>
      </div>
    </div>
  );
});

export default ThumbnailCoverPreview;
