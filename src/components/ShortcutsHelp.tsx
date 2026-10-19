import React, { useEffect, useState } from "react";
import { Sheet } from "./ui";

// Keyboard-shortcuts help overlay. Opens on "?" (Shift+/) or the
// "iij:show-shortcuts" event (fired from the command palette). Reuses the
// accessible Sheet (focus trap, Escape-to-close, focus restore from Round 3),
// so this stays a11y-correct for free. "?" is ignored while typing in a field.

interface Row {
  keys: string[];
  label: string;
}

const ROWS: Row[] = [
  { keys: ["⌘", "K"], label: "Open the command palette (Ctrl K on Windows/Linux)" },
  { keys: ["?"], label: "Show this keyboard-shortcuts help" },
  { keys: ["↑", "↓"], label: "Move through palette results" },
  { keys: ["↵"], label: "Run the highlighted command" },
  { keys: ["Esc"], label: "Close the palette, a dialog, or this help" },
  { keys: ["Tab"], label: "Move focus — trapped inside open dialogs" },
];

function isTypingTarget(el: EventTarget | null): boolean {
  const n = el as HTMLElement | null;
  if (!n) return false;
  const tag = n.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || n.isContentEditable;
}

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "?" && !isTypingTarget(e.target) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
      }
    }
    function onShow() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("iij:show-shortcuts", onShow as EventListener);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("iij:show-shortcuts", onShow as EventListener);
    };
  }, []);

  if (!open) return null;

  return (
    <Sheet title="Keyboard shortcuts" onClose={() => setOpen(false)}>
      <div className="shortcuts-list">
        {ROWS.map((r) => (
          <div className="shortcut-row" key={r.label}>
            <span className="shortcut-keys">
              {r.keys.map((k) => (
                <kbd key={k}>{k}</kbd>
              ))}
            </span>
            <span className="shortcut-label">{r.label}</span>
          </div>
        ))}
      </div>
      <p className="muted" style={{ fontSize: "0.78rem", marginTop: 12 }}>
        Everything runs on your device. Press <kbd>?</kbd> anytime to reopen this list.
      </p>
    </Sheet>
  );
}
