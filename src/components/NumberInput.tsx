"use client";

import { useLayoutEffect, useRef, useState } from "react";

const fmt = (n: number) => n.toLocaleString("en-US");
const digitsOf = (s: string) => s.replace(/[^0-9]/g, "");

/**
 * Whole-number input that shows thousands separators (480,000) while you type and keeps the cursor
 * in place. Clicking into it selects the number, so typing replaces it instead of adding to a 0.
 * `value: null` shows an empty box with the placeholder.
 */
export default function NumberInput({
  value,
  onChange,
  max,
  ...rest
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  max?: number;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "max">) {
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  // While focused we show exactly what the user is editing; otherwise the formatted value.
  const [draft, setDraft] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (caret.current !== null && ref.current) {
      ref.current.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  });

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={draft ?? (value === null ? "" : fmt(value))}
      onFocus={(e) => {
        setDraft(value === null ? "" : fmt(value));
        const input = e.currentTarget;
        requestAnimationFrame(() => input.select());
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        setDraft(null);
        rest.onBlur?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        // How many digits sit left of the cursor, so it can be put back after reformatting.
        const before = digitsOf(raw.slice(0, e.target.selectionStart ?? raw.length)).length;
        let digits = digitsOf(raw).replace(/^0+(?=[0-9])/, "");
        if (max !== undefined && digits && Number(digits) > max) digits = String(max);
        const text = digits ? fmt(Number(digits)) : "";
        let pos = 0;
        for (let seen = 0; pos < text.length && seen < before; pos++) if (/[0-9]/.test(text[pos])) seen++;
        caret.current = pos;
        setDraft(text);
        onChange(digits ? Number(digits) : null);
      }}
    />
  );
}
