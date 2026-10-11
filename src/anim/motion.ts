// Motion layer — a thin, reduced-motion-aware wrapper over anime.js v4.
//
// Everything funnels through here so animation is consistent and so a single
// guard (prefers-reduced-motion) can disable all of it. Helpers are written
// defensively: if anime.js ever throws or a target is missing, we fall back to
// setting the final state immediately — animation must NEVER hide content or
// break a render.
//
// anime.js v4 API notes (differs from v3): named imports, animate(target, {...}),
// `ease:` not `easing:`, callbacks prefixed `on`. Durations here are in ms
// (the v4 default — we deliberately do not change engine.timeUnit).

import { animate as _animate, stagger, utils } from "animejs";

// anime.js v4 animates arbitrary CSS/SVG props and plain-object keys. Its param
// types are stricter than that reality, so we expose an any-typed wrapper to
// keep call sites clean under strict TypeScript. Behaviour is unchanged.
const animate = _animate as unknown as (targets: any, params: any) => any;

// Loosely typed handles — anime.js v4 ships its own types but we keep the
// wrapper permissive so strict TS never fights the animation calls.
type AnyEl = Element | null | undefined;
type Anim = any;

export function prefersReduced(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export { animate, stagger, utils };

/** Fade/slide an element (or NodeList/selector) in. Returns a cancel fn. */
export function revealIn(
  target: AnyEl | AnyEl[] | string,
  opts: { delay?: number; y?: number; duration?: number; ease?: string } = {}
): () => void {
  const { delay = 0, y = 18, duration = 650, ease = "outExpo" } = opts;
  if (prefersReduced()) {
    applyInstant(target, { opacity: 1, translateY: 0 });
    return () => {};
  }
  try {
    const a = animate(target as any, {
      opacity: [0, 1],
      translateY: [y, 0],
      duration,
      delay,
      ease,
    }) as Anim;
    return () => safePause(a);
  } catch {
    applyInstant(target, { opacity: 1, translateY: 0 });
    return () => {};
  }
}

/** Staggered reveal for a group of elements. */
export function revealStagger(
  targets: string | NodeListOf<Element> | Element[],
  opts: { each?: number; y?: number; duration?: number; start?: number } = {}
): () => void {
  const { each = 80, y = 20, duration = 650, start = 0 } = opts;
  if (prefersReduced()) {
    applyInstant(targets as any, { opacity: 1, translateY: 0 });
    return () => {};
  }
  try {
    const a = animate(targets as any, {
      opacity: [0, 1],
      translateY: [y, 0],
      duration,
      delay: stagger(each, { start }),
      ease: "outExpo",
    }) as Anim;
    return () => safePause(a);
  } catch {
    applyInstant(targets as any, { opacity: 1, translateY: 0 });
    return () => {};
  }
}

/**
 * Count a number from `from` to `to`, calling onUpdate with each interim value.
 * Uses anime.js to animate a proxy object; falls back to rAF if that throws.
 */
export function countTo(
  from: number,
  to: number,
  duration: number,
  onUpdate: (v: number) => void,
  onDone?: () => void
): () => void {
  if (prefersReduced() || duration <= 0) {
    onUpdate(to);
    onDone?.();
    return () => {};
  }
  try {
    const obj = { v: from };
    const a = animate(obj as any, {
      v: to,
      duration,
      ease: "outExpo",
      onUpdate: () => onUpdate(obj.v),
      onComplete: () => onDone?.(),
    }) as Anim;
    return () => safePause(a);
  } catch {
    const startT = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - startT) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      onUpdate(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else onDone?.();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }
}

/** Draw an SVG path by animating stroke-dashoffset from full length to 0. */
export function drawPath(
  path: SVGPathElement | null,
  opts: { duration?: number; delay?: number; ease?: string } = {}
): () => void {
  if (!path) return () => {};
  const { duration = 1400, delay = 0, ease = "inOutQuad" } = opts;
  let len = 0;
  try {
    len = path.getTotalLength();
  } catch {
    return () => {};
  }
  path.style.strokeDasharray = String(len);
  if (prefersReduced()) {
    path.style.strokeDashoffset = "0";
    return () => {};
  }
  path.style.strokeDashoffset = String(len);
  try {
    const a = animate(path as any, {
      strokeDashoffset: [len, 0],
      duration,
      delay,
      ease,
    }) as Anim;
    return () => safePause(a);
  } catch {
    path.style.strokeDashoffset = "0";
    return () => {};
  }
}

/** Grow an element's width to a target percentage (for bars). */
export function growWidth(
  el: AnyEl,
  pct: number,
  opts: { duration?: number; delay?: number } = {}
): () => void {
  if (!el) return () => {};
  const { duration = 900, delay = 0 } = opts;
  const target = `${Math.max(0, Math.min(100, pct))}%`;
  if (prefersReduced()) {
    (el as HTMLElement).style.width = target;
    return () => {};
  }
  try {
    const a = animate(el as any, {
      width: ["0%", target],
      duration,
      delay,
      ease: "outExpo",
    }) as Anim;
    return () => safePause(a);
  } catch {
    (el as HTMLElement).style.width = target;
    return () => {};
  }
}

/** Spring-pop an element in (sheets, modals, hero marks). */
export function popIn(
  el: AnyEl,
  opts: { duration?: number; from?: number; ease?: string } = {}
): () => void {
  if (!el) return () => {};
  const { duration = 520, from = 0.9, ease = "outBack" } = opts;
  if (prefersReduced()) {
    applyInstant(el, { opacity: 1, scale: 1 });
    return () => {};
  }
  try {
    const a = animate(el as any, {
      opacity: [0, 1],
      scale: [from, 1],
      duration,
      ease,
    }) as Anim;
    return () => safePause(a);
  } catch {
    applyInstant(el, { opacity: 1, scale: 1 });
    return () => {};
  }
}

/** Continuous gentle float (hero shapes). Returns a cancel fn. */
export function floatLoop(
  el: AnyEl,
  opts: { x?: number; y?: number; duration?: number; delay?: number } = {}
): () => void {
  if (!el || prefersReduced()) return () => {};
  const { x = 0, y = 16, duration = 4200, delay = 0 } = opts;
  try {
    const a = animate(el as any, {
      translateX: x ? [0, x, 0] : 0,
      translateY: [0, -y, 0],
      duration,
      delay,
      loop: true,
      ease: "inOutSine",
    }) as Anim;
    return () => safePause(a);
  } catch {
    return () => {};
  }
}

function safePause(a: Anim) {
  try {
    a?.pause?.();
  } catch {
    /* ignore */
  }
}

function applyInstant(target: any, props: Record<string, number>) {
  try {
    const els: Element[] =
      typeof target === "string"
        ? Array.from(document.querySelectorAll(target))
        : target instanceof Element
          ? [target]
          : Array.isArray(target)
            ? (target.filter(Boolean) as Element[])
            : target && "length" in target
              ? Array.from(target as NodeListOf<Element>)
              : [];
    for (const el of els) {
      const h = el as HTMLElement;
      if ("opacity" in props) h.style.opacity = String(props.opacity);
      if ("translateY" in props) h.style.transform = `translateY(${props.translateY}px)`;
      if ("scale" in props) h.style.transform = `scale(${props.scale})`;
    }
  } catch {
    /* ignore */
  }
}
