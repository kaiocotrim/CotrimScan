import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';

interface Props { children: ReactNode; onClose?: () => void; className?: string }
const focusable = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
export function ModalBackdrop({ children, onClose, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.querySelector<HTMLElement>(focusable)?.focus();
    return () => previous?.focus();
  }, []);
  function keydown(event: KeyboardEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); onClose?.(); return; }
    if (event.key !== 'Tab') return;
    const items = [...(ref.current?.querySelectorAll<HTMLElement>(focusable) || [])];
    if (!items.length) { event.preventDefault(); return; }
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  return <div ref={ref} className={`modal-backdrop ${className}`} onKeyDown={keydown}>{children}</div>;
}
