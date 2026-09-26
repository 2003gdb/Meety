import type { ChatMessage } from "@/types";
import styles from "./Bubble.module.css";

interface BubbleProps {
  message: ChatMessage;
  /** Only the last bubble in a run from the same sender gets a tail. */
  tail: boolean;
}

export function Bubble({ message, tail }: BubbleProps) {
  const side = message.from === "user" ? styles.out : styles.in;
  const className = [styles.bubble, side, tail ? styles.tail : ""].join(" ");

  if (message.kind === "person") {
    const { name, match, why } = message.person;
    return (
      <div className={`${className} w-[78%]`}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-semibold">{name}</span>
          <span className="shrink-0 text-[13px] text-muted tabular-nums">
            {match}% match
          </span>
        </div>
        <p className="mt-0.5 text-[14px] leading-[19px]">{why}</p>
      </div>
    );
  }

  return <div className={className}>{message.text}</div>;
}
