import type { ComponentProps } from 'react';
import { cn } from 'cn';

export type SpinnerVariant = 'ring' | 'spokes' | 'dots' | 'orbit' | 'pulse' | 'dither';
export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps extends Omit<ComponentProps<'svg'>, 'children' | 'aria-label'> {
  variant?: SpinnerVariant;
  size?: SpinnerSize;
  label?: string;
}

const sizeClass: Record<SpinnerSize, string> = { sm: 'size-3.5', md: 'size-4', lg: 'size-6' };
const spokes = Array.from({ length: 12 }, (_, index) => index);

/** A small, accessible PanelUI loading indicator for work with an unknown duration. */
export function Spinner({ variant = 'ring', size = 'md', label = 'Loading', className, ...props }: SpinnerProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label={label}
      data-slot="spinner"
      data-variant={variant}
      className={cn('panelui-spinner shrink-0', `panelui-spinner-${variant}`, sizeClass[size], className)}
      {...props}
    >
      {variant === 'ring' && <>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity=".2" />
        <path d="M21 12a9 9 0 0 1-9 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </>}
      {variant === 'spokes' && spokes.map(index => <line key={index} x1="12" y1="3" x2="12" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity={1 - index * 0.065} transform={`rotate(${index * 30} 12 12)`} />)}
      {variant === 'dots' && <>{[0, 1, 2].map(index => <circle key={index} className="panelui-spinner-dot" cx={5 + index * 7} cy="12" r="2" style={{ animationDelay: `${index * 120}ms` }} />)}</>}
      {variant === 'orbit' && <g className="panelui-spinner-orbit"><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" opacity=".25" /><circle cx="12" cy="4" r="2" fill="currentColor" /><circle cx="12" cy="20" r="1.4" fill="currentColor" opacity=".65" /></g>}
      {variant === 'pulse' && <><circle cx="12" cy="12" r="4" fill="currentColor" /><circle className="panelui-spinner-pulse" cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" /></>}
      {variant === 'dither' && Array.from({ length: 9 }, (_, index) => <rect key={index} className="panelui-spinner-dot" x={5 + (index % 3) * 5} y={5 + Math.floor(index / 3) * 5} width="3" height="3" rx=".5" fill="currentColor" style={{ animationDelay: `${index * 55}ms` }} />)}
    </svg>
  );
}
