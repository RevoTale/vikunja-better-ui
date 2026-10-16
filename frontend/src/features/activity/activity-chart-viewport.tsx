import type { ReactNode } from "react";

export function ActivityChartViewport({ label, children }: { label: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users must be able to scroll chart data on narrow screens, including Safari.
    <section className="mt-6 overflow-x-auto" aria-label={label} tabIndex={0}>
      {children}
    </section>
  );
}
