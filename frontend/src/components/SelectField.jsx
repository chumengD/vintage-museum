import { Select } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
export default function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = "请选择",
  required = false,
}) {
  return (
    <div>
      <span className="mb-2 block" id={`label-${label}`}>
        {label}
        {required ? " *" : ""}
      </span>
      <Select.Root value={value} onValueChange={onChange} required={required}>
        <Select.Trigger
          aria-labelledby={`label-${label}`}
          className="input flex items-center justify-between gap-3 text-left"
        >
          <Select.Value placeholder={placeholder} />
          <Select.Icon>
            <ChevronDown size={17} />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={4}
            className="z-[60] max-h-72 w-[var(--radix-select-trigger-width)] overflow-auto border border-ink bg-card shadow-md"
          >
            <Select.Viewport>
              {options.map((option) => {
                const v = typeof option === "string" ? option : option.value;
                const text = typeof option === "string" ? option : option.label;
                return (
                  <Select.Item key={v} value={v} className="menu-item justify-between">
                    <Select.ItemText>{text}</Select.ItemText>
                    <Select.ItemIndicator>
                      <Check size={16} />
                    </Select.ItemIndicator>
                  </Select.Item>
                );
              })}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
