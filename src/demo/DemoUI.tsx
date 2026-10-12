import React, { useState } from "react";
import { useApp } from "../store/AppContext";
import { Button } from "../components/ui";
import { Icon } from "../components/Icon";

/** Sticky bar shown across the app while the demo account is loaded. */
export function DemoBanner() {
  const { isDemo, exitDemo } = useApp();
  if (!isDemo) return null;
  return (
    <div className="demo-banner" role="status">
      <span className="demo-dot" aria-hidden />
      <span className="demo-text">
        <strong>Demo account</strong> — you're exploring Asha's fictional data. Nothing here is saved to your device.
      </span>
      <span className="spacer" />
      <Button size="sm" variant="ghost" onClick={exitDemo}>Exit demo</Button>
    </div>
  );
}

/**
 * A dismissible, demo-only contextual tip. Renders only while the demo is
 * active; dismissal is remembered for the browser session (per tip id).
 */
export function DemoTip({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  const { isDemo } = useApp();
  const key = `iij-demotip-${id}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  });
  if (!isDemo || dismissed) return null;
  return (
    <div className="demo-tip" role="note">
      <span className="demo-tip-ico" aria-hidden><Icon name="sparkle" size={18} /></span>
      <div className="demo-tip-body">
        <strong>{title}</strong>
        <div className="soft" style={{ fontSize: "0.86rem", marginTop: 2 }}>{children}</div>
      </div>
      <button
        className="demo-tip-x"
        aria-label="Dismiss tip"
        onClick={() => {
          try { sessionStorage.setItem(key, "1"); } catch { /* ignore */ }
          setDismissed(true);
        }}
      >
        ✕
      </button>
    </div>
  );
}
