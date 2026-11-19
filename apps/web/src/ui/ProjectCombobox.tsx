import {
  Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput,
  ComboboxItem, ComboboxList,
} from '@/components/ui/combobox';

export interface ProjectComboboxOption { value: string; label: string }

interface Props {
  label: string;
  value: string | undefined;
  options: ProjectComboboxOption[];
  onValueChange(value: string): void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
}

export function ProjectCombobox({ label, value, options, onValueChange, disabled, required, placeholder = 'Selecione ou pesquise' }: Props) {
  const selected = options.find(option => option.value === value) ?? null;
  return (
    <Combobox items={options} value={selected} itemToStringValue={option => option.label} onValueChange={option => { if (option) onValueChange(option.value); }} openOnInputClick disabled={disabled} required={required}>
      <ComboboxInput aria-label={label} placeholder={placeholder} disabled={disabled} className="!h-[38px] !w-full !cursor-pointer !rounded-lg !border-[#484848] !bg-[#191919] !shadow-none focus-within:!border-[#7baee6] focus-within:!ring-2 focus-within:!ring-[#3287dc44] [&_input]:!m-0 [&_input]:!h-full [&_input]:!cursor-pointer [&_input]:focus:!cursor-text [&_input]:!border-0 [&_input]:!bg-transparent [&_input]:!px-3 [&_input]:!text-xs [&_input]:!text-[#eee] [&_input]:!shadow-none [&_input]:placeholder:!text-[#888] [&_button]:!m-0 [&_button]:!size-6 [&_button]:!cursor-pointer [&_button]:!bg-transparent [&_button]:!p-0 [&_button]:!text-[#aaa] [&_button]:hover:!bg-[#ffffff12]" />
      <ComboboxContent className="!rounded-xl !bg-[#252525] !text-[#eee] !ring-[#555] !shadow-[0_16px_40px_#0009]">
        <ComboboxEmpty>Nenhuma opção encontrada.</ComboboxEmpty>
        <ComboboxList>
          {option => <ComboboxItem key={option.value} value={option} className="!cursor-pointer !rounded-lg !px-3 !py-2 !text-xs data-highlighted:!bg-[#3287dc] data-highlighted:!text-white">{option.label}</ComboboxItem>}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
