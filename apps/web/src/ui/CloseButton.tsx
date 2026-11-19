import { Button } from '@/components/ui/button';
import type { ButtonHTMLAttributes } from 'react';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'children'> & { label?: string };

export function CloseButton({ label = 'Fechar', className = '', ...props }: Props) {
  return <Button {...props} variant="ghost" size="icon" type="button" className={`app-close-button ${className}`} aria-label={label}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M5 5 19 19M19 5 5 19" />
    </svg>
  </Button>;
}
