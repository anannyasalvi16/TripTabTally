'use client';

import { useState, type ChangeEvent } from 'react';

interface MoneyInputProps {
  id: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  onValueChange?: (val: string) => void;
  className?: string;
}

export function MoneyInput({
  id,
  name,
  defaultValue = '',
  placeholder = '0.00',
  required = false,
  onValueChange,
  className = '',
}: MoneyInputProps) {
  const [value, setValue] = useState(defaultValue);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    // Allow digits and at most one decimal point
    const sanitized = raw.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    let cleaned = parts[0] || '';
    if (parts.length > 1) {
      cleaned += '.' + parts.slice(1).join('').slice(0, 2);
    }

    setValue(cleaned);
    onValueChange?.(cleaned);
  }

  function handleBlur() {
    if (!value) return;
    const parts = value.split('.');
    const whole = parts[0] ? parseInt(parts[0], 10).toLocaleString('en-IN') : '0';
    let formatted = whole;
    if (parts.length > 1) {
      formatted += '.' + parts[1]!.padEnd(2, '0');
    }
    setValue(formatted);
    onValueChange?.(formatted);
  }

  function handleFocus() {
    // Strip commas when editing for ease of typing
    setValue((prev) => prev.replace(/,/g, ''));
  }

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-2 text-sm select-none">
        ₹
      </span>
      <input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        required={required}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        className={`w-full border border-rule bg-paper-2 pl-7 pr-3 py-2 text-sm text-ink placeholder:text-ink-2 focus:border-brick font-mono tabular-numbers ${className}`}
      />
    </div>
  );
}
