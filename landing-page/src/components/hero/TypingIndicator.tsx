import styles from "./Bubble.module.css";

export function TypingIndicator() {
  return (
    <div className={styles.typing}>
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.dot} />
    </div>
  );
}
