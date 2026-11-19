import type { HTMLAttributes } from 'react';

type ButtonGroupProps = HTMLAttributes<HTMLDivElement>;

/** A compact container for visually grouping related buttons. */
export function ButtonGroup({ className = '', ...props }: ButtonGroupProps) {
  return (
    <div
      role="group"
      data-slot="button-group"
      data-orientation="horizontal"
      className={`inline-flex w-fit min-w-max items-stretch gap-1 rounded-[14px] bg-transparent p-1 [&>*]:relative [&>*]:rounded-lg [&>*+*]:before:pointer-events-none [&>*+*]:before:absolute [&>*+*]:before:left-[-3px] [&>*+*]:before:top-1/4 [&>*+*]:before:h-1/2 [&>*+*]:before:w-px [&>*+*]:before:bg-[#383838] ${className}`}
      {...props}
    />
  );
}
