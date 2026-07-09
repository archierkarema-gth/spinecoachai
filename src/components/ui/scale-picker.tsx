"use client";

import { cn } from "@/lib/utils";

/**
 * Segmented 1..max (or 0..max) picker for check-in signals. Big touch
 * targets for on-the-go tapping (approved mockup: sweaty-hands ergonomics).
 */
export function ScalePicker({
  value,
  onChange,
  min = 1,
  max = 5,
  lowLabel,
  highLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  lowLabel?: string;
  highLabel?: string;
}) {
  const steps = [];
  for (let i = min; i <= max; i++) steps.push(i);

  return (
    <div>
      <div className="flex gap-1.5">
        {steps.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            onClick={() => onChange(n)}
            className={cn(
              "h-11 flex-1 rounded-[var(--radius-md)] border text-sm font-semibold tabular transition-colors",
              value === n
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground"
            )}
          >
            {n}
          </button>
        ))}
      </div>
      {(lowLabel || highLabel) && (
        <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      )}
    </div>
  );
}
