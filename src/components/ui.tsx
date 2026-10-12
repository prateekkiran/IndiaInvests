import React, { useState } from "react";
import { classNames } from "../util";
import { useEffect, useRef } from "react";
import { popIn, revealIn, prefersReduced, animate } from "../anim/motion";

export function Card({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={classNames("card", className)} style={style}>{children}</div>;
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub != null && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function Button({
  children,
  variant = "default",
  size,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "primary" | "teal" | "ghost" | "danger"; size?: "sm" }) {
  return (
    <button className={classNames("btn", variant !== "default" && variant, size)} {...rest}>
      {children}
    </button>
  );
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "indigo" | "teal" | "amber" | "red" | "green" }) {
  return <span className={classNames("badge", tone)}>{children}</span>;
}

export function Callout({ tone = "info", icon, children }: { tone?: "info" | "warn" | "error" | "success"; icon?: string; children: React.ReactNode }) {
  const defIcon = { info: "ⓘ", warn: "⚠", error: "⨯", success: "✓" }[tone];
  return (
    <div className={classNames("callout", tone)} role={tone === "error" ? "alert" : undefined}>
      <span className="ico" aria-hidden>{icon ?? defIcon}</span>
      <div>{children}</div>
    </div>
  );
}

export function NumberField({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  prefix,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  prefix?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">
        <span>{label}</span>
        {hint && <span className="field-hint">{hint}</span>}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {prefix && <span className="soft">{prefix}</span>}
        <input
          type="number"
          value={Number.isFinite(value) ? value : ""}
          min={min}
          max={max}
          step={step ?? "any"}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        />
        {suffix && <span className="soft" style={{ whiteSpace: "nowrap" }}>{suffix}</span>}
      </div>
    </label>
  );
}

export function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
}) {
  return (
    <label className="field">
      <span className="field-label">
        <span>{label}</span>
        <span className="num">{format ? format(value) : value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={format ? format(value) : String(value)}
      />
    </label>
  );
}

export function TextField({ label, hint, value, onChange, type = "text", placeholder }: { label: string; hint?: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="field">
      <span className="field-label"><span>{label}</span>{hint && <span className="field-hint">{hint}</span>}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function SelectField<T extends string>({ label, value, onChange, options, hint }: { label: string; value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }>; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label"><span>{label}</span>{hint && <span className="field-hint">{hint}</span>}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }> }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={classNames(value === o.value && "active")} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs({ tabs, active, onChange }: { tabs: Array<{ id: string; label: string }>; active: string; onChange: (id: string) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={active === t.id} className={classNames("tab", active === t.id && "active")} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: "auto" }} />
      <span className="soft" style={{ fontSize: "0.88rem", fontWeight: 600 }}>{label}</span>
    </label>
  );
}

export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (backdropRef.current && !prefersReduced()) {
      try {
        backdropRef.current.style.opacity = "0";
        animate(backdropRef.current as any, { opacity: [0, 1], duration: 260, ease: "outQuad" });
      } catch {
        backdropRef.current.style.opacity = "1";
      }
    }
    const cancel = popIn(sheetRef.current, { from: 0.92, duration: 480 });
    return cancel;
  }, []);

  // Accessibility: trap Tab focus within the dialog, close on Escape, and
  // restore focus to whatever was focused before the sheet opened.
  useEffect(() => {
    const prevFocused = document.activeElement as HTMLElement | null;
    const sheet = sheetRef.current;
    const focusables = () =>
      Array.from(
        sheet?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
    // Move focus into the sheet.
    const first = focusables()[0];
    first?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prevFocused?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="sheet-backdrop" ref={backdropRef} onClick={onClose}>
      <div className="sheet" ref={sheetRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">✕</Button>
        </div>
        {children}
        {footer && <div className="row" style={{ marginTop: 18, justifyContent: "flex-end" }}>{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="big" aria-hidden>{icon}</div>}
      <h3 style={{ marginBottom: 6 }}>{title}</h3>
      <div className="soft">{children}</div>
    </div>
  );
}

export function PageHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="pagehead">
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </div>
  );
}

/** A simple collapsible disclosure, used for formula explanations. */
export function Disclosure({ summary, children }: { summary: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 8 }}>
      <button className="btn ghost sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? "▾" : "▸"} {summary}
      </button>
      {open && <div className="soft" style={{ fontSize: "0.84rem", marginTop: 8, padding: "0 4px" }}>{children}</div>}
    </div>
  );
}
