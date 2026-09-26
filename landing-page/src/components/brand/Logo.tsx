/** Swallow in flight, drawn from the founder's photo. Same path as public/logo.svg. */
const BIRD =
  "M46.2 24.7C45.4 22.8 43.9 21.6 42 21.6 40.5 21.6 39.3 22.4 38.5 23.5 34.6 17.4 25 8.5 16.6 4.6 18.4 12 21.6 22 25.5 28.5L12.6 33.2 16.3 36.9 15.7 41.6 26.4 36.4C32.2 40.6 41.5 51 51 59.6 49.6 50.6 46.2 38.4 42.2 29.2 43.9 28.7 45.3 27.6 46.2 24.7Z";

/** Meety's mark. Decorative; takes its color from `currentColor`. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" aria-hidden="true" className={className}>
      <path d={BIRD} />
    </svg>
  );
}
