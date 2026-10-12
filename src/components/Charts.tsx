import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatINRCompact, formatINR, groupIndian } from "../engine/money";
import { Button } from "./ui";
import { drawPath, growWidth, revealStagger, prefersReduced, animate } from "../anim/motion";

export interface GrowthPoint {
  label: string; // x axis label (e.g. "Yr 5" or a date)
  contributed: number; // cumulative contributed capital
  value: number; // total value (contributed + growth)
  projected?: boolean; // part of the projected (future) segment
}

/**
 * Stacked area: contributed capital (teal) + growth (indigo), with a dashed
 * boundary where the actual series ends and projection begins. The value line
 * draws itself in, the contributed line follows, areas fade up, and the
 * projection boundary pulses — reinforcing the actual-vs-projected story.
 * Includes a screen-reader table and a toggle to show the data as a table.
 */
export function GrowthChart({ data, height = 260, title, legend }: { data: GrowthPoint[]; height?: number; title: string; legend?: { value: string; contributed: string } }) {
  const valueLabel = legend?.value ?? "Growth";
  const contribLabel = legend?.contributed ?? "Contributed capital";
  const [showTable, setShowTable] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gradId = useRef(`grad-${Math.random().toString(36).slice(2, 8)}`).current;
  const valueRef = useRef<SVGPathElement | null>(null);
  const contribRef = useRef<SVGPathElement | null>(null);
  const valueAreaRef = useRef<SVGPathElement | null>(null);
  const contribAreaRef = useRef<SVGPathElement | null>(null);
  const boundaryRef = useRef<SVGGElement | null>(null);

  const W = 720;
  const H = height;
  const padL = 56;
  const padR = 16;
  const padB = 28;
  const padT = 12;
  const n = data.length;

  const maxV = Math.max(...data.map((d) => d.value), 1);
  const x = (i: number) => padL + (i / Math.max(1, n - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - v / maxV) * (H - padT - padB);

  const boundaryIdx = data.findIndex((d) => d.projected);

  // Map a pointer event to the nearest data index (for the hover tooltip).
  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || n === 0) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(x(i) - relX);
      if (d < bestD) { bestD = d; best = i; }
    }
    setHoverIdx(best);
  }

  useLayoutEffect(() => {
    if (showTable || n === 0) return;
    const cancels: Array<() => void> = [];
    // Areas fade/scale up from the baseline.
    if (!prefersReduced()) {
      const areas: Array<[SVGPathElement | null, number]> = [
        [valueAreaRef.current, 0.28],
        [contribAreaRef.current, 0.42],
      ];
      areas.forEach(([el, target], i) => {
        if (!el) return;
        try {
          el.style.opacity = "0";
          animate(el as any, { opacity: [0, target], duration: 900, delay: 250 + i * 120, ease: "outQuad" });
        } catch {
          el.style.opacity = String(target);
        }
      });
    }
    cancels.push(drawPath(valueRef.current, { duration: 1500, ease: "inOutQuad" }));
    cancels.push(drawPath(contribRef.current, { duration: 1500, delay: 300, ease: "inOutQuad" }));
    // Pulse the projection boundary in after the lines land.
    if (boundaryRef.current && !prefersReduced() && boundaryIdx > 0) {
      try {
        boundaryRef.current.style.opacity = "0";
        animate(boundaryRef.current as any, { opacity: [0, 1], duration: 600, delay: 1500, ease: "outQuad" });
      } catch {
        boundaryRef.current.style.opacity = "1";
      }
    }
    return () => cancels.forEach((c) => c && c());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, showTable]);

  if (n === 0) return <div className="soft" style={{ padding: 20 }}>No data to plot yet.</div>;

  const areaPath = (sel: (d: GrowthPoint) => number) => {
    let p = `M ${x(0)} ${y(0)}`;
    data.forEach((d, i) => (p += ` L ${x(i)} ${y(sel(d))}`));
    p += ` L ${x(n - 1)} ${y(0)} Z`;
    return p;
  };
  const linePath = (sel: (d: GrowthPoint) => number) => {
    let p = "";
    data.forEach((d, i) => (p += `${i === 0 ? "M" : "L"} ${x(i)} ${y(sel(d))} `));
    return p;
  };

  const ticks = 4;
  const tickVals = Array.from({ length: ticks + 1 }, (_, k) => (maxV * k) / ticks);
  const labelEvery = Math.ceil(n / 7);

  return (
    <figure style={{ margin: 0 }}>
      <div className="row between" style={{ marginBottom: 8 }}>
        <figcaption style={{ fontWeight: 600 }}>{title}</figcaption>
        <Button variant="ghost" size="sm" onClick={() => setShowTable((s) => !s)} aria-pressed={showTable}>
          {showTable ? "Show chart" : "Show as table"}
        </Button>
      </div>

      {!showTable ? (
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label={`${title}. Contributed capital and growth over time.`}
          onPointerMove={onMove}
          onPointerLeave={() => setHoverIdx(null)}
          style={{ touchAction: "none" }}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--indigo-500)" stopOpacity="0.38" />
              <stop offset="100%" stopColor="var(--indigo-500)" stopOpacity="0.04" />
            </linearGradient>
            <linearGradient id={`${gradId}-c`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--teal-500)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="var(--teal-500)" stopOpacity="0.06" />
            </linearGradient>
          </defs>
          {tickVals.map((tv, k) => (
            <g key={k}>
              <line x1={padL} x2={W - padR} y1={y(tv)} y2={y(tv)} stroke="var(--border)" strokeWidth={1} />
              <text x={padL - 8} y={y(tv) + 4} textAnchor="end" fontSize="11" fill="var(--text-faint)">{formatINRCompact(tv)}</text>
            </g>
          ))}
          <path ref={valueAreaRef} d={areaPath((d) => d.value)} fill={`url(#${gradId})`} opacity={0.28} />
          <path ref={contribAreaRef} d={areaPath((d) => d.contributed)} fill={`url(#${gradId}-c)`} opacity={0.42} />
          <path ref={valueRef} d={linePath((d) => d.value)} fill="none" stroke="var(--indigo-600)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          <path ref={contribRef} d={linePath((d) => d.contributed)} fill="none" stroke="var(--teal-600)" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
          {boundaryIdx > 0 && (
            <g ref={boundaryRef}>
              <line x1={x(boundaryIdx)} x2={x(boundaryIdx)} y1={padT} y2={H - padB} stroke="var(--text-faint)" strokeDasharray="4 4" strokeWidth={1.5} />
              <text x={x(boundaryIdx) + 4} y={padT + 12} fontSize="10" fill="var(--text-faint)">projected →</text>
            </g>
          )}
          {data.map((d, i) => (i % labelEvery === 0 || i === n - 1) ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--text-faint)">{d.label}</text>
          ) : null)}
          {hoverIdx !== null && data[hoverIdx] && (
            <g pointerEvents="none">
              <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={padT} y2={H - padB} stroke="var(--text-faint)" strokeWidth={1} opacity={0.5} />
              <circle cx={x(hoverIdx)} cy={y(data[hoverIdx].value)} r={4} fill="var(--indigo-600)" stroke="var(--surface-raised)" strokeWidth={1.5} />
              <circle cx={x(hoverIdx)} cy={y(data[hoverIdx].contributed)} r={4} fill="var(--teal-600)" stroke="var(--surface-raised)" strokeWidth={1.5} />
              {(() => {
                const tw = 150, th = 64;
                const tx = Math.min(Math.max(x(hoverIdx) - tw / 2, padL), W - padR - tw);
                const ty = padT + 2;
                const d = data[hoverIdx];
                return (
                  <g transform={`translate(${tx} ${ty})`}>
                    <rect width={tw} height={th} rx={8} fill="var(--surface-raised)" stroke="var(--border)" strokeWidth={1} />
                    <text x={10} y={17} fontSize="11" fontWeight={600} fill="var(--text)">{d.label}{d.projected ? " · projected" : ""}</text>
                    <circle cx={13} cy={32} r={3.5} fill="var(--indigo-600)" />
                    <text x={22} y={36} fontSize="11" fill="var(--text-soft)">{valueLabel}: ₹{groupIndian(d.value, 0)}</text>
                    <circle cx={13} cy={50} r={3.5} fill="var(--teal-600)" />
                    <text x={22} y={54} fontSize="11" fill="var(--text-soft)">{contribLabel}: ₹{groupIndian(d.contributed, 0)}</text>
                  </g>
                );
              })()}
            </g>
          )}
        </svg>
      ) : (
        <div className="table-scroll">
          <table className="data">
            <thead><tr><th>Period</th><th className="num">Contributed</th><th className="num">Growth</th><th className="num">Value</th><th>Basis</th></tr></thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={i}>
                  <td>{d.label}</td>
                  <td className="num">₹{groupIndian(d.contributed, 0)}</td>
                  <td className="num">₹{groupIndian(d.value - d.contributed, 0)}</td>
                  <td className="num">₹{groupIndian(d.value, 0)}</td>
                  <td>{d.projected ? "Projected" : "Actual"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="chip-row" style={{ marginTop: 10, fontSize: "0.8rem" }}>
        <span><span className="tag-dot" style={{ background: "var(--teal-600)" }} /> {contribLabel}</span>
        <span><span className="tag-dot" style={{ background: "var(--indigo-600)" }} /> {valueLabel}</span>
      </div>
    </figure>
  );
}

export interface AllocationSlice {
  label: string;
  value: number;
}

export function AllocationBars({ data, title }: { data: AllocationSlice[]; title: string }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const segRefs = useRef<Array<HTMLDivElement | null>>([]);
  const rowsRef = useRef<HTMLTableSectionElement | null>(null);
  const palette = ["var(--indigo-600)", "var(--teal-600)", "var(--indigo-500)", "var(--teal-500)", "var(--amber-600)", "var(--text-faint)"];

  useEffect(() => {
    if (total <= 0) return;
    const cancels: Array<() => void> = [];
    segRefs.current.forEach((el, i) => {
      if (!el) return;
      const pct = (data[i].value / total) * 100;
      cancels.push(growWidth(el, pct, { delay: i * 90, duration: 850 }));
    });
    if (rowsRef.current) {
      cancels.push(revealStagger(rowsRef.current.querySelectorAll("tr"), { each: 70, y: 8, duration: 500 }));
    }
    return () => cancels.forEach((c) => c && c());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (total <= 0) return <div className="soft">No valued assets to allocate.</div>;

  return (
    <figure style={{ margin: 0 }}>
      <figcaption style={{ fontWeight: 600, marginBottom: 10 }}>{title}</figcaption>
      <div style={{ display: "flex", height: 16, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }} role="img" aria-label={`${title}: ${data.map((d) => `${d.label} ${((d.value / total) * 100).toFixed(0)}%`).join(", ")}`}>
        {data.map((d, i) => (
          <div key={i} ref={(el) => (segRefs.current[i] = el)} style={{ width: "0%", background: palette[i % palette.length] }} title={`${d.label}: ${formatINR(d.value)}`} />
        ))}
      </div>
      <table className="data" style={{ marginTop: 12 }}>
        <thead><tr><th>Asset class</th><th className="num">Value</th><th className="num">Share</th></tr></thead>
        <tbody ref={rowsRef}>
          {data.map((d, i) => (
            <tr key={i}>
              <td><span className="tag-dot" style={{ background: palette[i % palette.length], marginRight: 8 }} />{d.label}</td>
              <td className="num">{formatINR(d.value)}</td>
              <td className="num">{((d.value / total) * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
