"use client";

import { useRef } from "react";
import { AnimatePresence, motion, useInView, type Transition } from "motion/react";
import { LogoMark } from "@/components/brand/Logo";
import type { ChatSender } from "@/types";
import { Bubble } from "./Bubble";
import { Composer } from "./Composer";
import { SCRIPT, THREAD_STARTED_AT } from "./script";
import { TypingIndicator } from "./TypingIndicator";
import { useConversation } from "./useConversation";

const SPRING: Transition = { type: "spring", duration: 0.4, bounce: 0 };
const EXIT = { opacity: 0, transition: { duration: 0.2 } };

/** Space above a row: tight inside a run from one sender, looser between senders. */
const gapAbove = (sameSender: boolean) => (sameSender ? 2 : 10);

export function IMessageDemo() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const { shown, typing, draft, done, reduced, skip, replay } = useConversation(inView);

  const visible = SCRIPT.slice(0, shown);
  const lastUser = visible.findLastIndex((m) => m.from === "user");
  const read = typing || lastUser < visible.length - 1;
  const receipt = lastUser === -1 ? null : read ? `Read ${visible[lastUser].readAt}` : "Delivered";

  const enter = (from: ChatSender) =>
    reduced ? false : { opacity: 0, y: 14, scale: from === "user" ? 0.9 : 0.94 };

  return (
    <figure ref={ref} className="mx-auto w-full max-w-[360px] lg:mx-0 lg:justify-self-end">
      <figcaption className="sr-only">
        Example iMessage thread. The day before Agents Night SF, Meety asks what you want from the
        event, suggests three attendees with match scores, and tells you how to open with Priya.
      </figcaption>

      {/* Device bezel: the same near-black in both themes, like the hardware. */}
      <div className="rounded-[54px] bg-[#1c1c1f] p-[9px] shadow-[0_28px_56px_-28px_rgb(20_20_22/0.45)] dark:ring-1 dark:ring-white/10">
        <div
          aria-hidden="true"
          className="flex h-[540px] flex-col overflow-hidden rounded-[45px] bg-surface font-imessage lg:h-[min(660px,calc(100dvh-11rem))]"
        >
          <header className="flex flex-col items-center gap-1 border-b border-border pt-5 pb-2.5">
            <span className="grid size-11 place-items-center rounded-full bg-accent text-accent-fg">
              <LogoMark className="size-7" />
            </span>
            <span className="text-[11px]">
              Meety <span className="text-muted">›</span>
            </span>
          </header>

          {/* column-reverse pins the newest message to the bottom once the thread overflows */}
          <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto [scrollbar-width:none] [mask-image:linear-gradient(to_bottom,transparent,black_24px)]">
            <ol className="relative mb-auto flex flex-col px-4 pt-6 pb-2">
              <li className="mb-2 text-center text-[11px] text-muted">
                <span className="font-semibold">Today</span> {THREAD_STARTED_AT}
              </li>
              <AnimatePresence initial={false} mode="popLayout">
                {visible.map((m, i) => {
                  const next = visible[i + 1];
                  const tail = next ? next.from !== m.from : !(typing && m.from === "meety");
                  return (
                    <motion.li
                      key={m.id}
                      layout="position"
                      initial={enter(m.from)}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={EXIT}
                      transition={SPRING}
                      className={`flex flex-col ${m.from === "user" ? "items-end" : "items-start"}`}
                      style={{
                        marginTop: i === 0 ? 0 : gapAbove(visible[i - 1].from === m.from),
                        transformOrigin: m.from === "user" ? "100% 100%" : "0% 100%",
                      }}
                    >
                      <Bubble message={m} tail={tail} />
                      {i === lastUser && receipt && (
                        <motion.span
                          key={receipt}
                          initial={reduced ? false : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="mt-1 mr-1 text-[11px] text-muted"
                        >
                          {receipt}
                        </motion.span>
                      )}
                    </motion.li>
                  );
                })}
                {typing && (
                  <motion.li
                    key="typing"
                    layout="position"
                    initial={{ opacity: 0, y: 10, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
                    transition={SPRING}
                    className="flex pl-2"
                    style={{
                      marginTop: shown === 0 ? 0 : gapAbove(visible[shown - 1].from === "meety"),
                      transformOrigin: "0% 100%",
                    }}
                  >
                    <TypingIndicator />
                  </motion.li>
                )}
              </AnimatePresence>
            </ol>
          </div>

          <Composer draft={draft} />
        </div>
      </div>

      {!reduced && (
        <button
          type="button"
          onClick={done ? replay : skip}
          aria-label={done ? "Replay the example conversation" : "Skip the conversation animation"}
          className="mx-auto mt-2 flex h-11 w-fit items-center rounded-full px-4 text-sm text-muted transition-colors duration-150 ease-out hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
        >
          {done ? "Replay" : "Skip to end"}
        </button>
      )}
    </figure>
  );
}
