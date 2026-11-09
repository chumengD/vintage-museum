import { Popover, Checkbox } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
export default function MultiSelectField({ label, value, onChange, options }) {
  return (
    <div>
      <p className="mb-2">{label} *</p>
      <Popover.Root>
        <Popover.Trigger
          className="input flex items-center justify-between gap-3 text-left"
          aria-label={label}
        >
          <span className={value.length ? "" : "text-muted"}>
            {value.length ? value.join(" / ") : "选择平台，可多选"}
          </span>
          <ChevronDown size={17} />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={5}
            className="z-[60] w-[var(--radix-popover-trigger-width)] border border-ink bg-card p-3 shadow-lg"
            aria-label={label}
          >
            {options.map((option) => (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-wash"
              >
                <Checkbox.Root
                  className="flex h-5 w-5 items-center justify-center border border-muted"
                  checked={value.includes(option)}
                  onCheckedChange={(checked) =>
                    onChange(checked ? [...value, option] : value.filter((v) => v !== option))
                  }
                >
                  <Checkbox.Indicator>
                    <Check size={15} />
                  </Checkbox.Indicator>
                </Checkbox.Root>
                {option}
              </label>
            ))}
            <Popover.Close className="button mt-2 w-full">完成选择</Popover.Close>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
