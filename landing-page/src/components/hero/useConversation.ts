"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { INITIAL_SHOWN, SCRIPT } from "./script";

export interface ConversationState {
  /** How many SCRIPT messages are visible. */
  shown: number;
  /** Meety's typing indicator is on. */
  typing: boolean;
  /** Text the user is typing into the composer. */
  draft: string;
}

export interface Conversation extends ConversationState {
  done: boolean;
  reduced: boolean;
  skip: () => void;
  replay: () => void;
}

const FINISHED: ConversationState = { shown: SCRIPT.length, typing: false, draft: "" };
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReduced(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** Hydration-safe: false on the server, real value after hydration. */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

/** Per-character delay so the user's typing has a human rhythm. */
function keystrokeMs(char: string): number {
  if (char === " ") return 70;
  if (/[.,?]/.test(char)) return 180;
  return 38;
}

/**
 * Plays SCRIPT once when `active` turns true. The first INITIAL_SHOWN messages
 * are server-rendered so the phone is never blank; replays start from zero.
 * Reduced motion skips playback and returns the finished thread.
 */
export function useConversation(active: boolean): Conversation {
  const reduced = usePrefersReducedMotion();
  const [state, setState] = useState<ConversationState>({
    shown: INITIAL_SHOWN,
    typing: false,
    draft: "",
  });
  const [done, setDone] = useState(false);
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (!active || reduced || done) return;

    const timers = new Set<number>();
    // Cleared timers never resolve, so a cancelled run just stops.
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = window.setTimeout(() => {
          timers.delete(id);
          resolve();
        }, ms);
        timers.add(id);
      });

    async function play(from: number) {
      for (let i = from; i < SCRIPT.length; i++) {
        const step = SCRIPT[i];
        await wait(step.pause);

        if (step.from === "meety" && step.typing) {
          setState((s) => ({ ...s, typing: true }));
          await wait(step.typing);
        }

        if (step.from === "user" && step.kind === "text") {
          for (let c = 1; c <= step.text.length; c++) {
            setState((s) => ({ ...s, draft: step.text.slice(0, c) }));
            await wait(keystrokeMs(step.text[c - 1]));
          }
          await wait(350);
        }

        setState({ shown: i + 1, typing: false, draft: "" });
      }
      setDone(true);
    }

    play(run === 0 ? INITIAL_SHOWN : 0);
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [active, reduced, done, run]);

  const skip = useCallback(() => {
    setState(FINISHED);
    setDone(true);
  }, []);

  const replay = useCallback(() => {
    setState({ shown: 0, typing: false, draft: "" });
    setDone(false);
    setRun((r) => r + 1);
  }, []);

  const current = reduced ? FINISHED : state;
  return { ...current, done: reduced || done, reduced, skip, replay };
}
