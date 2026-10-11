import React, { useState } from "react";
import { formatINRCompact, formatINR, groupIndian } from "../engine/money";
import { Button } from "./ui";

export interface GrowthPoint {
  label: string; // x axis label (e.g. "Yr 5" or a date)
  contributed: number; // cumulative contributed capital
  value: number; // total value (contributed + growth)
  projected?: boolean; // part of the projected (future) segment
}

/**
 * Stacked area: contributed capital (teal) + growth (indigo), with a dashed
 * boundary where the actual series ends and projection begins. Includes a
 * screen-reader table and a toggle to show the data as a table (WCAG).
 */
export function GrowthChart({ data, height = 260, title }: { data: GrowthPoint[]; height?: number; title: string }) {
  const [showTable, setShowTable] = useState(false);
  const W = 720;
  const H = height;
  const padL = 56;
  const padR = 16;
  const padB = 28;
  const padT = 12;
  const n = data.length;

  if (n === 0) return <div className="soft" style={{ padding: 20 }}>No data to plot yet.</div>;

  const maxV = Math.max(...data.map((d) => d.value), 1);
  const x = (i: number) => padL + (i / Math.max(1, n - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - v / maxV) * (H - padT - padB);

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

  const boundaryIdx = data.findIndex((d) => d.projected);
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
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${title}. Contributed capital and growth over time.`}>
          {tickVals.map((tv, k) => (
            <g key={k}>
              <line x1={padL} x2={W - padR} y1={y(tv)} y2={y(tv)} stroke="var(--border)" strokeWidth={1} />
              <text x={padL - 8} y={y(tv) + 4} textAnchor="end" fontSize="11" fill="var(--text-faint)">{formatINRCompact(tv)}</text>
            </g>
          ))}
          {/* total value area (growth sits above contributed) */}
          <path d={areaPath((d) => d.value)} fill="var(--indigo-500)" opacity={0.28} />
          <path d={areaPath((d) => d.contributed)} fill="var(--teal-500)" opacity={0.42} />
          <path d={linePath((d) => d.value)} fill="none" stroke="var(--indigo-600)" strokeWidth={2.2} />
          <path d={linePath((d) => d.contributed)} fill="none" stroke="var(--teal-600)" strokeWidth={2} />
          {boundaryIdx > 0 && (
            <g>
              <line x1={x(boundaryIdx)} x2={x(boundaryIdx)} y1={padT} y2={H - padB} stroke="var(--text-faint)" strokeDasharray="4 4" strokeWidth={1.5} />
              <text x={x(boundaryIdx) + 4} y={padT + 12} fontSize="10" fill="var(--text-faint)">projected →</text>
            </g>
          )}
          {data.map((d, i) => (i % labelEvery === 0 || i === n - 1) ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--text-faint)">{d.label}</text>
          ) : null)}
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
        <span><span className="tag-dot" style={{ background: "var(--teal-600)" }} /> Contributed capital</span>
        <span><span className="tag-dot" style={{ background: "var(--indigo-600)" }} /> Growth</span>
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
  if (total <= 0) return <div className="soft">No valued assets to allocate.</div>;
  const palette = ["var(--indigo-600)", "var(--teal-600)", "var(--indigo-500)", "var(--teal-500)", "var(--amber-600)", "var(--text-faint)"];
  return (
    <figure style={{ margin: 0 }}>
      <figcaption style={{ fontWeight: 600, marginBottom: 10 }}>{title}</figcaption>
      <div style={{ display: "flex", height: 16, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }} role="img" aria-label={`${title}: ${data.map((d) => `${d.label} ${((d.value / total) * 100).toFixed(0)}%`).join(", ")}`}>
        {data.map((d, i) => (
          <div key={i} style={{ width: `${(d.value / total) * 100}%`, background: palette[i % palette.length] }} title={`${d.label}: ${formatINR(d.value)}`} />
        ))}
      </div>
      <table className="data" style={{ marginTop: 12 }}>
        <thead><tr><th>Asset class</th><th className="num">Value</th><th className="num">Share</th></tr></thead>
        <tbody>
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
