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
import styles from "../dashboard/dashboard.module.css";

export interface ComboboxOption {
  id: string;
  label: string;
  description?: string;
  imageUrl?: string | null;
  meta?: string;
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
    open &&
    (options.length > 0 || loading || Boolean(error) || showEmptyMessage);

  const activeOption =
    activeIndex >= 0 && activeIndex < options.length
      ? options[activeIndex]
      : null;

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
      setActiveIndex((current) =>
        options.length === 0 ? -1 : Math.max(current - 1, 0),
      );
      return;
    }

    if (event.key === "Enter" && showListbox && activeOption) {
      event.preventDefault();
      selectOption(activeOption);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  const statusText =
    error ?? (loading ? "Loading suggestions..." : statusMessage);

  return (
    <div
      className={styles.combobox}
      onBlur={() => {
        blurTimer.current = setTimeout(close, 120);
      }}
      onFocus={() => setOpen(true)}
    >
      <label htmlFor={inputId} className="srOnly">
        {label}
      </label>
      <input
        id={inputId}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={showListbox}
        aria-activedescendant={
          activeOption ? `${listboxId}-${activeOption.id}` : undefined
        }
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

      {statusText ? (
        <p id={statusId} className={styles.comboboxStatus}>
          {statusText}
        </p>
      ) : null}

      {showListbox ? (
        <div id={listboxId} role="listbox" className={styles.comboboxMenu}>
          {options.length > 0 ? (
            options.map((option, index) => {
              const active = index === activeIndex;

              return (
                <div
                  id={`${listboxId}-${option.id}`}
                  key={option.id}
                  role="option"
                  aria-selected={active}
                  className={`${styles.comboboxOption} ${
                    active ? styles.comboboxOptionActive : ""
                  }`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectOption(option);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  {option.imageUrl ? (
                    <Image
                      className={styles.comboboxAvatar}
                      src={option.imageUrl}
                      alt=""
                      width={38}
                      height={38}
                      sizes="38px"
                    />
                  ) : (
                    <span className={styles.comboboxInitials}>
                      {option.meta ?? initialsFor(option.label)}
                    </span>
                  )}
                  <span className={styles.comboboxText}>
                    <strong>{option.label}</strong>
                    {option.description ? (
                      <span>{option.description}</span>
                    ) : null}
                  </span>
                  {renderMeta ? renderMeta(option) : null}
                </div>
              );
            })
          ) : (
            <div className={styles.comboboxEmpty} role="presentation">
              {loading ? "Loading suggestions..." : error ?? emptyMessage}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
