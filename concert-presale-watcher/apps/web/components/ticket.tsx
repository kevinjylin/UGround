import type * as React from "react";
import { cn } from "@/lib/cn";
import type { DateParts } from "@/lib/eventDisplay";

interface TicketProps {
  date: DateParts | null;
  size?: "md" | "lg";
  className?: string;
  children: React.ReactNode;
}

/**
 * UGround's signature: a show rendered as a ticket. An ember stub holds the
 * date, a perforation with two notches separates it from the show details.
 */
export function Ticket({ date, size = "md", className, children }: TicketProps) {
  const lg = size === "lg";
  return (
    <div
      className={cn(
        "ticket-notch relative flex min-w-0 rounded-xl bg-secondary shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]",
        lg ? "[--notch-x:112px]" : "[--notch-x:80px]",
        className,
      )}
    >
      <div
        className={cn(
          "relative flex shrink-0 flex-col items-center justify-center rounded-l-xl bg-brand text-brand-foreground",
          lg ? "w-28 gap-1 py-6" : "w-20 gap-0.5 py-4",
        )}
      >
        {/* Perforation where the stub tears off */}
        <span
          aria-hidden="true"
          className="absolute inset-y-2 right-0 border-r-2 border-dashed border-brand-foreground/30"
        />
        {date ? (
          <>
            <span className={cn("leading-4 font-medium", lg ? "text-[13px]" : "text-xs")}>
              {date.month}
              {date.showYear ? ` ’${String(date.year).slice(2)}` : ""}
            </span>
            <span
              className={cn(
                "tabular font-display leading-[0.9]",
                lg ? "text-[52px]" : "text-[36px]",
              )}
            >
              {date.day}
            </span>
            <span className={cn("leading-4", lg ? "text-[13px]" : "text-xs")}>{date.weekday}</span>
          </>
        ) : (
          <span className="text-sm font-medium">TBA</span>
        )}
      </div>
      <div className={cn("flex min-w-0 flex-1 flex-col", lg ? "gap-4 p-5 pl-6" : "gap-3 p-4 pl-5")}>
        {children}
      </div>
    </div>
  );
}
