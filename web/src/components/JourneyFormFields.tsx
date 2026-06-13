// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { CalendarDays } from "lucide-react";
import { format, isSameDay } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

type DurationFieldProps = {
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  label: string;
  placeholder: string;
  errorText: string;
};

export function DurationField({ value, onChange, invalid, label, placeholder, errorText }: DurationFieldProps) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      <input
        aria-label={label}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary ${invalid ? "border-destructive" : "border-border"}`}
      />
      {invalid && <p className="mt-1 text-xs text-destructive">{errorText}</p>}
    </div>
  );
}

type JourneyLogFieldProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  optionalLabel?: string;
  placeholder: string;
  className?: string;
};

export function JourneyLogField({ value, onChange, label, optionalLabel, placeholder, className }: JourneyLogFieldProps) {
  return (
    <div>
      {label && (
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          {label}{optionalLabel && (
            <>
              {" "}
              <span className="font-normal text-muted-foreground/60">{optionalLabel}</span>
            </>
          )}
        </label>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className={className ?? "w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"}
      />
    </div>
  );
}

type PlayedAtFieldProps = {
  label: string;
  pickedDate: Date;
  onPickedDateChange: (date: Date) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  todayLabel: string;
  pickLabel: string;
  dateFormat: string;
};

// PlayedAtField is a single "when was this played" control used by add, edit,
// and confirm alike: a "Today" quick-pick and a date picker. Whichever one
// matches the current value is highlighted; the picker shows the actual date
// once a non-today date is selected.
export function PlayedAtField({ label, pickedDate, onPickedDateChange, open, onOpenChange, todayLabel, pickLabel, dateFormat }: PlayedAtFieldProps) {
  const isToday = isSameDay(pickedDate, new Date());

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex gap-1.5">
        <Button
          type="button"
          variant={isToday ? "default" : "outline"}
          className="flex-1"
          onClick={() => onPickedDateChange(new Date())}
        >
          {todayLabel}
        </Button>
        <Popover open={open} onOpenChange={onOpenChange}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant={isToday ? "outline" : "default"}
              className="flex flex-1 items-center gap-1.5"
            >
              <CalendarDays size={14} />
              {isToday ? pickLabel : format(pickedDate, dateFormat)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto">
            <Calendar
              mode="single"
              selected={pickedDate}
              onSelect={(date) => {
                if (date) onPickedDateChange(date);
                onOpenChange(false);
              }}
              disabled={{ after: new Date() }}
              defaultMonth={pickedDate}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
