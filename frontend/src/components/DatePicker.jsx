import { useState } from "react";
import { Popover } from "radix-ui";
import { DayPicker } from "react-day-picker";
import { zhCN } from "react-day-picker/locale";
import { CalendarDays } from "lucide-react";
const format = (date) =>
  date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    : "";
export default function DatePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(`${value}T12:00:00`) : undefined;
  return (
    <div>
      <label htmlFor="release-date" className="mb-2 block">
        发布日期 *
      </label>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Anchor asChild>
          <div className="relative">
            <input
              id="release-date"
              className="input pr-12"
              type="text"
              placeholder="YYYY-MM-DD"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              required
              pattern="\d{4}-\d{2}-\d{2}"
            />
            <Popover.Trigger
              aria-label="打开日期选择框"
              className="absolute right-3 top-3 p-1 text-muted"
            >
              <CalendarDays size={19} />
            </Popover.Trigger>
          </div>
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            collisionPadding={16}
            className="z-[60] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto w-[330px] max-w-[calc(100vw-32px)] border border-line bg-card p-5 shadow-xl"
            aria-label="选择发布日期"
          >
            <p className="mb-3 text-muted">选择发布日期</p>
            <div className="mb-3 flex items-center justify-between border border-ink px-4 py-3 font-mono text-lg">
              <span>{value || "YYYY-MM-DD"}</span>
              <CalendarDays size={20} className="text-muted" />
            </div>
            <DayPicker
              mode="single"
              locale={zhCN}
              selected={selected && !isNaN(selected) ? selected : undefined}
              defaultMonth={selected && !isNaN(selected) ? selected : undefined}
              onSelect={(date) => onChange(format(date))}
              showOutsideDays
              weekStartsOn={1}
              classNames={{
                root: "relative",
                month_caption: "flex h-12 items-center justify-center font-serif text-xl",
                nav: "absolute inset-x-0 top-1 flex justify-between pointer-events-none",
                button_previous: "pointer-events-auto p-2 hover:bg-wash",
                button_next: "pointer-events-auto p-2 hover:bg-wash",
                chevron: "h-4 w-4 fill-ink",
                month_grid: "w-full border-collapse",
                weekday: "py-3 text-xs font-normal text-muted",
                day: "text-center p-0",
                day_button: "h-10 w-10 font-mono hover:bg-wash",
                selected: "bg-ink text-card",
                outside: "text-muted/50",
                today: "text-vermilion",
              }}
            />
            <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
              <button
                type="button"
                className="text-link"
                onClick={() => onChange(format(new Date()))}
              >
                今天
              </button>
              <div className="flex items-center gap-4">
                <button type="button" className="text-muted" onClick={() => onChange("")}>
                  清空
                </button>
                <Popover.Close className="button button-dark">确定</Popover.Close>
              </div>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
