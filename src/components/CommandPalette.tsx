import React, { useEffect, useRef, useState } from "react";
import { useApp } from "../store/AppContext";
import { Icon, IconName } from "./Icon";

// ⌘K command palette — keyboard-first navigation and actions. Opens on
// Cmd/Ctrl+K or the custom "iij:open-palette" event (fired by the sidebar
// launcher and the onboarding tour). Decoupled from the router: it navigates
// by setting the hash, which the Shell already listens to. Fully accessible —
// dialog role, focusable input, arrow-key list, Escape to close, focus restore.

interface Cmd {
  id: string;
  label: string;
  keywords?: string;
  icon: IconName;
  run: () => void;
  show?: () => boolean;
}

function go(route: string) {
  window.location.hash = `/${route}`;
}

export function CommandPalette() {
  const { isDemo, loadDemo, exitDemo } = useApp();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const prevFocus = useRef<HTMLElement | null>(null);

  const all: Cmd[] = [
    { id: "nav-overview", label: "Go to Overview", keywords: "home dashboard net worth insights", icon: "overview", run: () => go("overview") },
    { id: "nav-portfolio", label: "Go to Portfolio", keywords: "holdings transactions performance twr returns benchmark value history import", icon: "portfolio", run: () => go("portfolio") },
    { id: "nav-goals", label: "Go to Goals", keywords: "targets funding allocation", icon: "goals", run: () => go("goals") },
    { id: "nav-household", label: "Go to Household", keywords: "budget life events shared", icon: "household", run: () => go("household") },
    { id: "nav-explore", label: "Go to Explore", keywords: "scenarios compare stress", icon: "explore", run: () => go("explore") },
    { id: "nav-calculators", label: "Go to Calculators", keywords: "sip lumpsum stepup goal swp retirement fd rd loan emi inflation", icon: "calculators", run: () => go("calculators") },
    { id: "nav-data", label: "Go to Data centre", keywords: "backup restore export pdf prices issues", icon: "data", run: () => go("data") },
    { id: "nav-settings", label: "Go to Settings", keywords: "vault storage preferences theme passphrase", icon: "settings", run: () => go("settings") },
    { id: "demo-load", label: "Load demo account", keywords: "sample asha walkthrough try", icon: "sparkle", run: () => loadDemo(), show: () => !isDemo },
    { id: "demo-exit", label: "Exit demo account", keywords: "leave sample asha", icon: "arrow-right", run: () => exitDemo(), show: () => isDemo },
    { id: "tour", label: "Replay the guided tour", keywords: "onboarding help coachmarks walkthrough", icon: "sparkle", run: () => window.dispatchEvent(new CustomEvent("iij:start-tour")) },
    { id: "privacy", label: "Open the privacy page", keywords: "data policy offline on-device", icon: "lock", run: () => window.open(`${import.meta.env.BASE_URL}privacy.html`, "_blank", "noopener") },
  ];
  const commands = all.filter((c) => (c.show ? c.show() : true));
  const q = query.trim().toLowerCase();
  const results = q
    ? commands.filter((c) => (c.label + " " + (c.keywords ?? "")).toLowerCase().includes(q))
    : commands;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    function onOpenEvt() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("iij:open-palette", onOpenEvt as EventListener);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("iij:open-palette", onOpenEvt as EventListener);
    };
  }, []);

  useEffect(() => {
    if (open) {
      prevFocus.current = document.activeElement as HTMLElement | null;
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      prevFocus.current?.focus?.();
    }
  }, [open]);

  // Keep the active index within the (possibly filtered) result list.
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, results.length - 1)));
  }, [results.length]);

  if (!open) return null;

  function runAt(i: number) {
    const c = results[i];
    if (!c) return;
    setOpen(false);
    setTimeout(() => c.run(), 0); // let close + focus settle before navigating
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runAt(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="cmdk-backdrop" onClick={() => setOpen(false)}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Command palette" onClick={(e) => e.stopPropagation()}>
        <div className="cmdk-input">
          <span className="cmdk-ico" aria-hidden><Icon name="search" size={18} /></span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search screens and actions…"
            aria-label="Search screens and actions"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="cmdk-kbd">esc</kbd>
        </div>
        <ul className="cmdk-list" role="listbox" aria-label="Results">
          {results.length === 0 ? (
            <li className="cmdk-empty">No matches</li>
          ) : (
            results.map((c, i) => (
              <li
                key={c.id}
                role="option"
                aria-selected={i === active}
                className={`cmdk-item ${i === active ? "active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => runAt(i)}
              >
                <span className="cmdk-item-ico" aria-hidden><Icon name={c.icon} size={17} /></span>
                <span className="cmdk-item-label">{c.label}</span>
                <span className="cmdk-arrow" aria-hidden><Icon name="arrow-right" size={15} /></span>
              </li>
            ))
          )}
        </ul>
        <div className="cmdk-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span className="cmdk-brand">India Investment Journey</span>
        </div>
      </div>
    </div>
  );
}
