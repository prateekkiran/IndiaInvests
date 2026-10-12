import React, { useEffect, useState } from "react";
import { useRef, useLayoutEffect } from "react";
import { AppProvider, useApp } from "./store/AppContext";
import { revealIn, revealStagger, prefersReduced } from "./anim/motion";
import { Overview } from "./screens/Overview";
import { Calculators } from "./screens/Calculators";
import { Portfolio } from "./screens/Portfolio";
import { Goals } from "./screens/Goals";
import { Household } from "./screens/Household";
import { Explore } from "./screens/Explore";
import { DataCentre } from "./screens/DataCentre";
import { Settings } from "./screens/Settings";
import { VaultGate } from "./screens/VaultGate";
import { Icon, IconName } from "./components/Icon";
import { DemoBanner } from "./demo/DemoUI";

type Route = "overview" | "portfolio" | "goals" | "household" | "explore" | "calculators" | "data" | "settings";

const NAV: Array<{ id: Route; label: string; ico: IconName }> = [
  { id: "overview", label: "Overview", ico: "overview" },
  { id: "portfolio", label: "Portfolio", ico: "portfolio" },
  { id: "goals", label: "Goals", ico: "goals" },
  { id: "household", label: "Household", ico: "household" },
  { id: "explore", label: "Explore", ico: "explore" },
  { id: "calculators", label: "Calculators", ico: "calculators" },
  { id: "data", label: "Data centre", ico: "data" },
  { id: "settings", label: "Settings", ico: "settings" },
];

function routeFromHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, "") as Route;
  return (NAV.find((n) => n.id === h)?.id as Route) ?? "overview";
}

function Shell() {
  const { vaultStatus } = useApp();
  const [route, setRoute] = useState<Route>(routeFromHash());
  const contentRef = useRef<HTMLDivElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Stagger the sidebar nav items in once.
  useLayoutEffect(() => {
    if (navRef.current) revealStagger(navRef.current.querySelectorAll(".navlink"), { each: 55, y: 10, duration: 500 });
  }, []);

  // Animate the content area on every route change.
  useLayoutEffect(() => {
    if (contentRef.current) revealIn(contentRef.current, { y: 14, duration: 480 });
  }, [route]);

  const go = (r: Route) => {
    window.location.hash = `/${r}`;
    setRoute(r);
  };

  if (vaultStatus === "loading") {
    return <div className="empty" style={{ marginTop: 120 }}>Loading your workspace…</div>;
  }
  if (vaultStatus === "locked") {
    return <VaultGate />;
  }

  const screen = (() => {
    switch (route) {
      case "overview": return <Overview onNavigate={(r) => go(r as Route)} />;
      case "portfolio": return <Portfolio />;
      case "goals": return <Goals />;
      case "household": return <Household />;
      case "explore": return <Explore />;
      case "calculators": return <Calculators />;
      case "data": return <DataCentre />;
      case "settings": return <Settings />;
    }
  })();

  return (
    <div className="app-shell">
      <nav className="sidebar" aria-label="Primary" ref={navRef as any}>
        <div className="brand">
          <div className="brand-mark" aria-hidden />
          <div>
            <div className="brand-name">India Investment</div>
            <div className="brand-sub">Journey · on-device</div>
          </div>
        </div>
        {NAV.map((n) => (
          <button key={n.id} className={`navlink ${route === n.id ? "active" : ""}`} onClick={() => go(n.id)} aria-current={route === n.id ? "page" : undefined}>
            <span className="ico" aria-hidden><Icon name={n.ico} size={19} /></span>
            {n.label}
          </button>
        ))}
        <div className="spacer" />
        <div className="muted" style={{ fontSize: "0.72rem", padding: "8px" }}>
          Private & offline. No market data is fetched automatically.
          <br />
          <a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--indigo-600)" }}>Privacy</a>
        </div>
      </nav>

      <div className="main">
        <DemoBanner />
        <div className="content" ref={contentRef}>{screen}</div>
      </div>

      <nav className="mobile-nav" aria-label="Primary">
        {NAV.filter((n) => n.id !== "settings" && n.id !== "data").map((n) => (
          <button key={n.id} className={`navlink ${route === n.id ? "active" : ""}`} onClick={() => go(n.id)}>
            <span className="ico" aria-hidden><Icon name={n.ico} size={20} /></span>
            {n.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
