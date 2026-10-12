import React, { useEffect, useState } from "react";
import { Button } from "./ui";
import { Icon } from "./Icon";

// Tasteful PWA install affordance. Captures the browser's beforeinstallprompt
// event (Chromium) and shows a small dismissible card. On browsers that don't
// fire it (e.g. iOS Safari), nothing is shown — we never fake it. Dismissal is
// remembered so it doesn't nag.

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "iij-install-dismissed";

export function InstallPrompt() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      /* ignore */
    }
    if (dismissed) return;

    function onBIP(e: Event) {
      e.preventDefault(); // stop the mini-infobar; we show our own affordance
      setEvt(e as BIPEvent);
      setVisible(true);
    }
    function onInstalled() {
      setVisible(false);
      setEvt(null);
    }
    window.addEventListener("beforeinstallprompt", onBIP as EventListener);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP as EventListener);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible || !evt) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  async function install() {
    try {
      await evt!.prompt();
      await evt!.userChoice;
    } catch {
      /* user dismissed the native dialog */
    }
    dismiss();
  }

  return (
    <div className="install-card" role="dialog" aria-label="Install app">
      <span className="install-ico" aria-hidden><Icon name="download" size={20} /></span>
      <div style={{ flex: 1 }}>
        <strong style={{ fontSize: "0.9rem" }}>Install this app</strong>
        <div className="soft" style={{ fontSize: "0.8rem" }}>Add it to your device for offline, full-screen access. Your data stays on-device.</div>
      </div>
      <div className="row" style={{ gap: 6 }}>
        <Button size="sm" variant="ghost" onClick={dismiss} aria-label="Not now">Not now</Button>
        <Button size="sm" variant="primary" onClick={install}>Install</Button>
      </div>
    </div>
  );
}
