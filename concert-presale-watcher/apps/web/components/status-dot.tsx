import type * as React from "react";
import { cn } from "@/lib/cn";
import type { Tone } from "@/lib/eventDisplay";

const dotClass: Record<Tone, string> = {
  positive: "bg-positive",
  warning: "bg-warning",
  danger: "bg-destructive",
  brand: "bg-brand",
  neutral: "bg-muted-foreground",
  muted: "bg-faint/70",
};

const textClass: Record<Tone, string> = {
  positive: "text-positive",
  warning: "text-warning",
  danger: "text-destructive",
  brand: "text-foreground",
  neutral: "text-muted-foreground",
  muted: "text-faint",
};

export function Dot({ tone, className }: { tone: Tone; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-1.5 shrink-0 rounded-full", dotClass[tone], className)}
    />
  );
}

/** A colored dot plus text. The app's only way of showing state. */
export function StatusDot({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-[13px] leading-5 whitespace-nowrap",
        textClass[tone],
        className,
      )}
    >
      <Dot tone={tone} />
      {children}
    </span>
  );
}
