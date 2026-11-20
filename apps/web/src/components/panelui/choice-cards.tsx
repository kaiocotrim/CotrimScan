import { motion, useReducedMotion } from 'framer-motion';
import type { KeyboardEventHandler, MouseEventHandler, ReactNode } from 'react';
import { cn } from 'cn';

export interface ChoiceCardProps {
  selected: boolean;
  checked?: boolean;
  onToggleChecked(): void;
  selectionLabel: string;
  disabled?: boolean;
  onSelect: MouseEventHandler<HTMLButtonElement>;
  header: ReactNode;
  children: ReactNode;
  className?: string;
  onContextMenu?: MouseEventHandler<HTMLDivElement>;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
}

/** A selectable preview card with an animated selected check. */
export function ChoiceCard({ selected, checked = false, onToggleChecked, selectionLabel, disabled, onSelect, header, children, className, onContextMenu, onKeyDown }: ChoiceCardProps) {
  const reducedMotion = useReducedMotion();
  const transition = reducedMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 360, damping: 30 };

  return (
    <motion.div
      layout={!reducedMotion}
      data-slot="choice-card"
      data-selected={selected || undefined}
      data-checked={checked || undefined}
      className={cn(
        'relative shrink-0 rounded-2xl border p-2 transition-colors',
        selected || checked ? 'border-[#3287dc] bg-[#26323d] shadow-[0_0_0_1px_#3287dc55]' : 'border-[#383838] bg-[#242424] hover:border-[#626262]',
        className,
      )}
      transition={transition}
      onContextMenu={onContextMenu}
      onKeyDown={onKeyDown}
    >
      <div className="relative mb-2 flex min-h-6 items-center gap-2 pr-7 text-[10px] text-[#d1d5da]">{header}</div>
      <motion.button
        type="button"
        aria-pressed={selected}
        className="m-0 block h-[175px] w-full cursor-pointer overflow-hidden rounded-xl border-0 bg-[#151719] p-1.5 outline-none transition-colors hover:bg-[#1b1e20] focus-visible:ring-2 focus-visible:ring-[#75baff] max-[900px]:h-[145px] max-[600px]:h-[115px]"
        onClick={onSelect}
        whileHover={reducedMotion ? undefined : { scale: 1.012 }}
        whileTap={reducedMotion ? undefined : { scale: 0.985 }}
        transition={transition}
      >
        {children}
      </motion.button>
      <motion.button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={selectionLabel}
        disabled={disabled}
        onClick={onToggleChecked}
        whileTap={reducedMotion ? undefined : { scale: .9 }}
        className={`page-selection-check !absolute !right-2 !top-2 !z-10 !m-0 !grid !size-6 !min-h-0 !w-6 !place-items-center !rounded-full !border-0 !p-0 ${checked?'!bg-[#287fe5] !text-white':'!bg-[#454b51] !text-[#b9c3cc]'}`}
      >
        {checked ? <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 3.1 3.1L13 4.5" /></svg> : <span aria-hidden="true" className="size-3 rounded-full border border-current"/>}
      </motion.button>
    </motion.div>
  );
}
