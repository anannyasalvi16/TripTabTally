'use client';

import { useState, useEffect, useRef } from 'react';
import {
  formatIsoToDisplay,
  parseDateInput,
  parseAndValidateDate,
} from '@/lib/schemas/date-utils';

export interface DateInputProps {
  id: string;
  name: string;
  value?: string; // ISO string YYYY-MM-DD
  min?: string;   // ISO string YYYY-MM-DD
  max?: string;   // ISO string YYYY-MM-DD
  required?: boolean;
  error?: string | null;
  label?: string;
  placeholder?: string;
  onChange?: (isoDate: string) => void;
  onError?: (err: string | null) => void;
  className?: string;
}

export function DateInput({
  id,
  name,
  value = '',
  min,
  max,
  required = false,
  error,
  label,
  placeholder = 'DD/MM/YYYY',
  onChange,
  onError,
  className = '',
}: DateInputProps) {
  const [isoValue, setIsoValue] = useState(value);
  const [displayText, setDisplayText] = useState(() => formatIsoToDisplay(value));
  const [localError, setLocalError] = useState<string | null>(null);

  const calendarPickerRef = useRef<HTMLInputElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  // Sync when prop value changes
  useEffect(() => {
    setIsoValue(value);
    setDisplayText(formatIsoToDisplay(value));
  }, [value]);

  const activeError = error || localError;

  function updateValue(newIso: string, newDisplay: string) {
    setIsoValue(newIso);
    setDisplayText(newDisplay);
    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = newIso;
    }
    onChange?.(newIso);
  }

  function handleTextChange(val: string) {
    setDisplayText(val);
    setLocalError(null);
    onError?.(null);

    const parsed = parseDateInput(val);
    if (parsed) {
      setIsoValue(parsed);
      if (hiddenInputRef.current) {
        hiddenInputRef.current.value = parsed;
      }
      onChange?.(parsed);
    }
  }

  function handleBlur() {
    if (!displayText.trim()) {
      if (required) {
        const err = 'Please enter a valid date.';
        setLocalError(err);
        onError?.(err);
      }
      setIsoValue('');
      if (hiddenInputRef.current) {
        hiddenInputRef.current.value = '';
      }
      onChange?.('');
      return;
    }

    const check = parseAndValidateDate(displayText);
    if (!check.valid || !check.isoDate) {
      const err = check.error || 'Please enter a valid date in DD/MM/YYYY format.';
      setLocalError(err);
      onError?.(err);
      return;
    }

    const iso = check.isoDate;
    updateValue(iso, formatIsoToDisplay(iso));

    // Check min / max bounds
    if (min && iso < min) {
      const err = max
        ? `Date must be between ${min} and ${max}.`
        : `Date must be on or after ${min}.`;
      setLocalError(err);
      onError?.(err);
      return;
    }

    if (max && iso > max) {
      const err = min
        ? `Date must be between ${min} and ${max}.`
        : `Date must be on or before ${max}.`;
      setLocalError(err);
      onError?.(err);
      return;
    }

    setLocalError(null);
    onError?.(null);
  }

  function handleCalendarPickerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newIso = e.target.value;
    if (newIso) {
      updateValue(newIso, formatIsoToDisplay(newIso));
      setLocalError(null);
      onError?.(null);
    }
  }

  return (
    <div className={className}>
      {label && (
        <div className="flex items-center justify-between mb-1">
          <label htmlFor={id} className="block text-xs font-medium text-ink">
            {label} {required && <span className="text-brick">*</span>}
          </label>
          <span className="text-[11px] font-mono text-ink-2">DD/MM/YYYY</span>
        </div>
      )}

      <div
        className={`relative flex items-stretch border bg-[#FCFAF5] dark:bg-[#28241C] transition-colors focus-within:border-brick ${
          activeError ? 'border-brick' : 'border-rule hover:border-ink dark:border-rule/80 dark:hover:border-ink'
        }`}
      >
        {/* Hidden field submitting normalized ISO YYYY-MM-DD */}
        <input
          ref={hiddenInputRef}
          type="hidden"
          name={name}
          value={isoValue}
        />

        {/* Visible text input allowing typing DD/MM/YYYY manually */}
        <input
          id={id}
          name={`${name}Display`}
          type="text"
          required={required}
          inputMode="numeric"
          placeholder={placeholder}
          value={displayText}
          onChange={(e) => handleTextChange(e.target.value)}
          onBlur={handleBlur}
          aria-invalid={!!activeError}
          aria-describedby={activeError ? `${id}-error` : undefined}
          className="w-full bg-transparent px-3 py-2 text-sm text-ink font-mono placeholder:text-ink-2/60 focus:outline-none"
        />

        {/* Clearly visible calendar icon button with high contrast in light & dark mode */}
        <div
          className="relative flex items-center justify-center px-3 border-l border-rule/80 dark:border-rule/80 bg-paper-2 dark:bg-[#332E23] hover:bg-paper dark:hover:bg-[#3E382B] transition-colors cursor-pointer group"
          title="Open calendar picker"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="square"
            strokeLinejoin="miter"
            className="w-4 h-4 text-ink dark:text-ink group-hover:text-brick dark:group-hover:text-brick transition-colors select-none pointer-events-none"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="18" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <rect x="7" y="13" width="2" height="2" fill="currentColor" />
            <rect x="11" y="13" width="2" height="2" fill="currentColor" />
            <rect x="15" y="13" width="2" height="2" fill="currentColor" />
            <rect x="7" y="17" width="2" height="2" fill="currentColor" />
            <rect x="11" y="17" width="2" height="2" fill="currentColor" />
            <rect x="15" y="17" width="2" height="2" fill="currentColor" />
          </svg>

          {/* Native date picker covering the calendar icon button */}
          <input
            ref={calendarPickerRef}
            type="date"
            min={min || undefined}
            max={max || undefined}
            value={isoValue || ''}
            tabIndex={-1}
            title="Choose date from calendar"
            aria-label="Choose date from calendar"
            onChange={handleCalendarPickerChange}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </div>
      </div>

      {activeError && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-brick font-medium">
          {activeError}
        </p>
      )}
    </div>
  );
}
