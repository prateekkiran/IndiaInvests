import React, { useEffect, useLayoutEffect, useState } from "react";
import { useApp } from "../store/AppContext";
import { Button } from "../components/ui";

// First-run onboarding tour — a short coachmark sequence that complements the
// demo tips. Auto-starts once (remembered in localStorage) and can be replayed
// from the command palette via the "iij:start-tour" event. Steps may spotlight
// a real element by CSS selector; if the element isn't present the step simply
// centres. Reduced-motion is honoured by the CSS (transition disabled).

interface Step {
  title: string;
  body: React.ReactNode;
  selector?: string; // element to spotlight; omitted = centered
  cta?: { label: string; run: () => void };
}

const DONE_KEY = "iij-tour-done-v1";

export function Tour() {
  const { loadDemo, isDemo } = useApp();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const steps: Step[] = [
    {
      title: "Welcome to India Investment Journey",
      body: "A private, on-device planner for Indian investors — nothing you enter ever leaves your device. Here's a 30-second tour of what's inside.",
    },
    {
      title: "Everything lives in the sidebar",
      body: "Portfolio, Goals, Household, Explore and 11 calculators. Your Overview stitches them into net worth, returns, auto-insights and goal progress.",
      selector: ".sidebar",
    },
    {
      title: "Press ⌘K anytime",
      body: "The command palette jumps to any screen or runs an action — load the demo, open the privacy page, or replay this tour — all from the keyboard.",
      cta: { label: "Try the command palette", run: () => window.dispatchEvent(new CustomEvent("iij:open-palette")) },
    },
    {
      title: "See it with realistic data",
      body: "Load a complete fictional account — Asha's portfolio, goals, household plan, value history, time-weighted return and auto-insights — to explore every feature. Nothing is saved to your device.",
      cta: {
        label: isDemo ? "Demo already loaded ✓" : "Load the demo account",
        run: () => {
          if (!isDemo) loadDemo();
        },
      },
    },
  ];

  useEffect(() => {
    let done = false;
    try {
      done = localStorage.getItem(DONE_KEY) === "1";
    } catch {
      /* ignore */
    }
    if (!done) setActive(true);
    function onStart() {
      setStep(0);
      setActive(true);
    }
    window.addEventListener("iij:start-tour", onStart);
    return () => window.removeEventListener("iij:start-tour", onStart);
  }, []);

  const cur = steps[step];

  useLayoutEffect(() => {
    if (!active) return;
    function measure() {
      if (cur?.selector) {
        const el = document.querySelector(cur.selector) as HTMLElement | null;
        setRect(el ? el.getBoundingClientRect() : null);
      } else {
        setRect(null);
      }
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, step, cur?.selector]);

  if (!active) return null;

  function finish() {
    try {
      localStorage.setItem(DONE_KEY, "1");
    } catch {
      /* ignore */
    }
    setActive(false);
    setStep(0);
  }
  function next() {
    if (step < steps.length - 1) setStep(step + 1);
    else finish();
  }
  function back() {
    if (step > 0) setStep(step - 1);
  }

  const pad = 10;
  const tipStyle: React.CSSProperties = rect
    ? {
        position: "fixed",
        top: Math.min(rect.bottom + pad, window.innerHeight - 230),
        left: Math.min(Math.max(12, rect.left), window.innerWidth - 360),
      }
    : { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return (
    <div className="tour-overlay" role="dialog" aria-modal="true" aria-label="Guided tour">
      {rect && (
        <div
          className="tour-spot"
          style={{ position: "fixed", top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }}
          aria-hidden
        />
      )}
      <div className="tour-tip" style={tipStyle}>
        <div className="tour-step-count">{step + 1} / {steps.length}</div>
        <h3 style={{ margin: "2px 0 6px" }}>{cur.title}</h3>
        <p className="soft" style={{ margin: 0, fontSize: "0.9rem" }}>{cur.body}</p>
        {cur.cta && (
          <div style={{ marginTop: 12 }}>
            <Button size="sm" variant="primary" onClick={cur.cta.run}>{cur.cta.label}</Button>
          </div>
        )}
        <div className="row between" style={{ marginTop: 16 }}>
          <Button size="sm" variant="ghost" onClick={finish}>Skip tour</Button>
          <div className="row" style={{ gap: 8 }}>
            {step > 0 && <Button size="sm" variant="ghost" onClick={back}>Back</Button>}
            <Button size="sm" variant="primary" onClick={next}>{step < steps.length - 1 ? "Next" : "Done"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
