"use client";

import { AnimatePresence, motion } from "motion/react";
import styles from "./Bubble.module.css";

export function Composer({ draft }: { draft: string }) {
  return (
    <div className="flex items-end gap-2 px-3 pt-2 pb-4">
      <span className="grid size-[34px] shrink-0 place-items-center rounded-full bg-bubble-in text-[22px] leading-none text-muted">
        +
      </span>
      <div className="relative flex min-h-[34px] flex-1 items-center rounded-[18px] border border-border py-[6px] pr-10 pl-3 text-[15px] leading-5">
        {draft ? (
          <span>
            {draft}
            <span className={styles.caret} />
          </span>
        ) : (
          <span className="text-muted">iMessage</span>
        )}
        <AnimatePresence>
          {draft && (
            <motion.span
              className="absolute right-[4px] bottom-[4px] grid size-[26px] place-items-center rounded-full bg-accent text-[15px] font-bold text-accent-fg"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.12 } }}
              transition={{ type: "spring", duration: 0.3, bounce: 0 }}
            >
              ↑
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
