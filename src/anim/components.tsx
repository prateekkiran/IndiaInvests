import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { countTo, revealIn, growWidth, prefersReduced } from "./motion";

/**
 * Animated number roll-up. Preserves whatever formatting you pass via `format`
 * (e.g. Indian-grouped INR). Re-animates from the previous value when `value`
 * changes, so live calculator edits feel responsive.
 */
export function CountUp({
  value,
  format,
  duration = 1100,
  className,
}: {
  value: number;
  format?: (v: number) => string;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  const mounted = useRef(false);

  useEffect(() => {
    const from = mounted.current ? prev.current : 0;
    mounted.current = true;
    const cancel = countTo(from, value, duration, (v) => setDisplay(v), () => (prev.current = value));
    prev.current = value;
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span className={className}>{format ? format(display) : Math.round(display).toLocaleString("en-IN")}</span>;
}

/**
 * Reveal wrapper — fades/slides its children in on mount. Sets the hidden state
 * in a layout effect (before paint) so there is no flash, and only when motion
 * is allowed; with reduced motion the content is simply visible.
 */
export function Reveal({
  children,
  delay = 0,
  y = 18,
  as: Tag = "div",
  className,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  as?: any;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || prefersReduced()) return;
    el.style.opacity = "0";
    el.style.transform = `translateY(${y}px)`;
  }, [y]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cancel = revealIn(el, { delay, y });
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Tag ref={ref as any} className={className} style={style}>
      {children}
    </Tag>
  );
}

/**
 * A horizontal progress/allocation bar whose fill grows to `pct` on mount and
 * whenever `pct` changes.
 */
export function AnimatedBar({
  pct,
  color,
  track = "var(--surface-sunken)",
  height = 8,
  delay = 0,
  rounded = 6,
}: {
  pct: number;
  color: string;
  track?: string;
  height?: number;
  delay?: number;
  rounded?: number;
}) {
  const fill = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const cancel = growWidth(fill.current, pct, { delay });
    return cancel;
  }, [pct, delay]);

  return (
    <div style={{ height, background: track, borderRadius: rounded, overflow: "hidden" }}>
      <div ref={fill} style={{ width: "0%", height: "100%", background: color, borderRadius: rounded }} />
    </div>
  );
}
