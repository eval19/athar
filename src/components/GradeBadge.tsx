import {
  AlertCircle,
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  Info,
} from 'lucide-react';
import type { GradeBucket } from '../domain/hadith';
import type { AppStrings } from '../i18n/strings';

interface GradeBadgeProps {
  bucket: GradeBucket;
  strings: AppStrings;
  expanded?: boolean;
  hintPulse?: boolean;
  onToggleInfo?: () => void;
  size?: 'sm' | 'md';
  count?: number;
}

const BADGE_STYLE: Record<GradeBucket, { bg: string; color: string }> = {
  sahih: { bg: 'var(--sahih-bg)', color: 'var(--sahih-ink)' },
  sahih_isnad: { bg: 'var(--sahih-bg)', color: 'var(--sahih-ink)' },
  hasan: { bg: 'var(--hasan-bg)', color: 'var(--hasan-ink)' },
  hasan_isnad: { bg: 'var(--hasan-bg)', color: 'var(--hasan-ink)' },
  daif_isnad: { bg: 'var(--daif-bg)', color: 'var(--daif-ink)' },
  daif: { bg: 'var(--daif-bg)', color: 'var(--daif-ink)' },
  very_weak: { bg: 'var(--severe-bg)', color: 'var(--severe-ink)' },
  munkar: { bg: 'var(--severe-bg)', color: 'var(--severe-ink)' },
  mawdu: { bg: 'var(--mawdu-bg)', color: 'var(--mawdu-ink)' },
  batil: { bg: 'var(--mawdu-bg)', color: 'var(--mawdu-ink)' },
  unknown: { bg: 'var(--unknown-bg)', color: 'var(--unknown-ink)' },
};

export function GradeBadge({
  bucket,
  strings,
  expanded,
  hintPulse = false,
  onToggleInfo,
  size = 'md',
  count,
}: GradeBadgeProps) {
  const style = BADGE_STYLE[bucket];
  const label = strings.grades[bucket];
  const displayLabel = count && count > 1 ? `${label} ×${count}` : label;
  const iconClass = size === 'sm' ? 'h-3 w-3 shrink-0' : 'h-3.5 w-3.5 shrink-0';
  const sizeClass =
    size === 'sm'
      ? 'px-2 py-0.5 text-[0.7rem] gap-1'
      : 'px-2.5 py-1 text-xs gap-1.5';

  const content = (
    <>
      {(bucket === 'sahih' || bucket === 'sahih_isnad') && (
        <CheckCircle2 className={iconClass} aria-hidden="true" />
      )}
      {(bucket === 'hasan' || bucket === 'hasan_isnad') && (
        <Check className={iconClass} aria-hidden="true" />
      )}
      {(bucket === 'daif' || bucket === 'daif_isnad') && (
        <AlertTriangle className={iconClass} aria-hidden="true" />
      )}
      {(bucket === 'very_weak' || bucket === 'munkar') && (
        <AlertCircle className={iconClass} aria-hidden="true" />
      )}
      {(bucket === 'mawdu' || bucket === 'batil') && (
        <Ban className={iconClass} aria-hidden="true" />
      )}
      {bucket === 'unknown' && <Info className={iconClass} aria-hidden="true" />}
      <span className="tabular-nums">{displayLabel}</span>
    </>
  );

  if (onToggleInfo) {
    return (
      <button
        type="button"
        onClick={onToggleInfo}
        aria-expanded={Boolean(expanded)}
        aria-label={strings.gradeHelpAria(label)}
        style={{ backgroundColor: style.bg, color: style.color }}
        className={`inline-flex items-center rounded-full font-semibold leading-none transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${sizeClass}${
          hintPulse && !expanded ? ' grade-badge-hint' : ''
        }`}
      >
        {content}
        <ChevronDown
          className={`h-3 w-3 shrink-0 opacity-65 transition-transform duration-150${
            expanded ? ' rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>
    );
  }

  return (
    <span
      style={{ backgroundColor: style.bg, color: style.color }}
      className={`inline-flex items-center rounded-full font-semibold leading-none ${sizeClass}`}
    >
      {content}
    </span>
  );
}
