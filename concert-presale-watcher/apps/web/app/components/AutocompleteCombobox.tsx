"use client";

import Image from "next/image";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

export interface ComboboxOption {
  id: string;
  label: string;
  description?: string;
  imageUrl?: string | null;
  meta?: string;
  /** Leading visual: an artist thumbnail (or initials) or a location pin. */
  kind?: "artist" | "location";
}

interface AutocompleteComboboxProps {
  id?: string;
  label: string;
  value: string;
  placeholder: string;
  options: ComboboxOption[];
  required?: boolean;
  disabled?: boolean;
  loading?: boolean;
  error?: string | null;
  emptyMessage: string;
  showEmptyMessage?: boolean;
  statusMessage?: string | null;
  onValueChange: (value: string) => void;
  onSelect: (option: ComboboxOption) => void;
  renderMeta?: (option: ComboboxOption) => ReactNode;
}

const initialsFor = (label: string): string =>
  label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "A";

function OptionLeading({ option }: { option: ComboboxOption }) {
  if (option.imageUrl) {
    return (
      <Image
        className="size-6 shrink-0 rounded-full object-cover"
        src={option.imageUrl}
        alt=""
        width={24}
        height={24}
        sizes="24px"
      />
    );
  }

  if (option.kind === "location") {
    return (
      <span className="grid size-6 shrink-0 place-items-center text-muted-foreground">
        <MapPin aria-hidden="true" className="size-4" />
      </span>
    );
  }

  return (
    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-medium text-muted-foreground">
      {initialsFor(option.label)}
    </span>
  );
}

export default function AutocompleteCombobox({
  id,
  label,
  value,
  placeholder,
  options,
  required = false,
  disabled = false,
  loading = false,
  error = null,
  emptyMessage,
  showEmptyMessage = Boolean(value),
  statusMessage = null,
  onValueChange,
  onSelect,
  renderMeta,
}: AutocompleteComboboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listboxId = `${inputId}-listbox`;
  const statusId = `${inputId}-status`;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showListbox =
    open && (options.length > 0 || loading || Boolean(error) || showEmptyMessage);

  const activeOption =
    activeIndex >= 0 && activeIndex < options.length ? options[activeIndex] : null;

  const describedBy = useMemo(
    () => (statusMessage || error || loading ? statusId : undefined),
    [error, loading, statusId, statusMessage],
  );

  useEffect(() => {
    if (activeIndex >= options.length) {
      setActiveIndex(options.length - 1);
    }
  }, [activeIndex, options.length]);

  useEffect(
    () => () => {
      if (blurTimer.current) {
        clearTimeout(blurTimer.current);
      }
    },
    [],
  );

  const close = () => {
    setOpen(false);
    setActiveIndex(-1);
  };

  const selectOption = (option: ComboboxOption) => {
    onSelect(option);
    close();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) =>
        options.length === 0 ? -1 : Math.min(current + 1, options.length - 1),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (options.length === 0 ? -1 : Math.max(current - 1, 0)));
      return;
    }

    if (event.key === "Enter" && showListbox && activeOption) {
      event.preventDefault();
      selectOption(activeOption);
      return;
    }

    if (event.key === "Escape" && showListbox) {
      // Close the list without letting the surrounding sheet close too.
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  };

  const statusText = error ?? (loading ? "Searching…" : statusMessage);

  return (
    <div
      className="flex flex-col gap-2"
      onBlur={() => {
        blurTimer.current = setTimeout(close, 120);
      }}
      onFocus={() => {
        if (blurTimer.current) clearTimeout(blurTimer.current);
        setOpen(true);
      }}
    >
      <Label htmlFor={inputId}>{label}</Label>

      <div className="relative">
        <Input
          id={inputId}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={showListbox}
          aria-activedescendant={activeOption ? `${listboxId}-${activeOption.id}` : undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          required={required}
          value={value}
          onChange={(event) => {
            onValueChange(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
        />

        {showListbox ? (
          <div
            id={listboxId}
            role="listbox"
            aria-label={label}
            className="absolute inset-x-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
          >
            {options.length > 0 ? (
              options.map((option, index) => {
                const active = index === activeIndex;

                return (
                  <div
                    id={`${listboxId}-${option.id}`}
                    key={option.id}
                    role="option"
                    aria-selected={active}
                    className={cn(
                      "flex h-9 cursor-default items-center gap-2 rounded-md px-2 text-sm transition-colors select-none",
                      active && "bg-accent",
                    )}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      selectOption(option);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    <OptionLeading option={option} />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="text-foreground">{option.label}</span>
                      {option.description ? (
                        <span className="ml-2 text-[13px] text-muted-foreground">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                    {renderMeta ? renderMeta(option) : null}
                  </div>
                );
              })
            ) : (
              <div className="px-2 py-2 text-[13px] text-muted-foreground" role="presentation">
                {loading ? "Searching…" : (error ?? emptyMessage)}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {statusText ? (
        <p
          id={statusId}
          className={cn("text-[13px] leading-5", error ? "text-destructive" : "text-muted-foreground")}
        >
          {statusText}
        </p>
      ) : null}
    </div>
  );
}
