import { cn } from '../lib/utils';

type BreathingLoaderProps = {
  size?: 'sm' | 'md' | 'lg';
  dots?: 1 | 3;
  label?: string;
  className?: string;
  // Dot colour: 'light' (lime, for dark surfaces) or 'dark' (for lime/full-
  // brightness buttons where lime dots would be invisible against the bg).
  tone?: 'light' | 'dark';
};

const dotSizes: Record<NonNullable<BreathingLoaderProps['size']>, string> = {
  sm: 'h-1.5 w-1.5',
  md: 'h-2 w-2',
  lg: 'h-3 w-3',
};

export function BreathingLoader({ size = 'md', dots = 3, label, className, tone = 'light' }: BreathingLoaderProps) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5', className)}
      role="status"
      aria-live="polite"
      aria-label={label || 'Loading'}
    >
      {Array.from({ length: dots }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'animate-breath rounded-full',
            tone === 'dark' ? 'bg-[#0d1308]' : 'bg-[#84cc16]',
            dotSizes[size]
          )}
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
      {label ? <span className="ml-1 text-sm text-gray-400">{label}</span> : null}
    </span>
  );
}