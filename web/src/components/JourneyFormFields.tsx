// SPDX-FileCopyrightText: 2026 Juan Medina
// SPDX-License-Identifier: MIT
import { CalendarDays } from "lucide-react";
import { format } from "date-fns";
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

type PlayedAtFieldCommon = {
  label: string;
  pickedDate: Date | undefined;
  onPickedDateChange: (date: Date | undefined) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pickLabel: string;
  dateFormat: string;
};

type PlayedAtFieldProps = PlayedAtFieldCommon & (
  | { mode: "now-or-pick"; whenMode: "now" | "pick"; onWhenModeChange: (mode: "now" | "pick") => void; nowLabel: string }
  | { mode: "pick-required" }
);

export function PlayedAtField(props: PlayedAtFieldProps) {
  const { label, pickedDate, onPickedDateChange, open, onOpenChange, pickLabel, dateFormat } = props;

  const calendar = (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={props.mode === "now-or-pick" ? (props.whenMode === "pick" ? "default" : "outline") : "outline"}
          className={props.mode === "now-or-pick" ? "flex flex-1 items-center gap-1.5" : "w-full justify-start gap-1.5"}
          onClick={() => { if (props.mode === "now-or-pick") props.onWhenModeChange("pick"); }}
        >
          <CalendarDays size={14} />
          {pickedDate && (props.mode === "pick-required" || props.whenMode === "pick") ? format(pickedDate, dateFormat) : pickLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto">
        <Calendar
          mode="single"
          selected={pickedDate}
          onSelect={(date) => {
            onPickedDateChange(date);
            if (props.mode === "now-or-pick") props.onWhenModeChange("pick");
            onOpenChange(false);
          }}
          disabled={{ after: new Date() }}
          defaultMonth={pickedDate ?? new Date()}
        />
      </PopoverContent>
    </Popover>
  );

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      {props.mode === "now-or-pick" ? (
        <div className="flex gap-1.5">
          <Button
            type="button"
            variant={props.whenMode === "now" ? "default" : "outline"}
            className="flex-1"
            onClick={() => { props.onWhenModeChange("now"); onPickedDateChange(undefined); }}
          >
            {props.nowLabel}
          </Button>
          {calendar}
        </div>
      ) : (
        calendar
      )}
    </div>
  );
}
