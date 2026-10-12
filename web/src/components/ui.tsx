import { Scan } from "@phosphor-icons/react/ssr";
import type { HTMLAttributes, ReactNode } from "react";

// The one container: white on the ground, one elevation, 16px radius.
export const panelClass = "rounded-2xl bg-surface shadow-panel";

export function Panel({ className = "", ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`${panelClass} ${className}`} {...props} />;
}

export function PanelHeading({ icon, children, aside }: {
  icon?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
      {icon && (
        <span aria-hidden className="grid size-8 place-items-center rounded-[10px] bg-surface-2 text-muted">
          {icon}
        </span>
      )}
      <h2 className="text-[17px] font-medium tracking-[-0.01em]">{children}</h2>
      {aside && <div className="ml-auto">{aside}</div>}
    </div>
  );
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="mb-8 max-w-2xl">
      <h1 className="text-[2.25rem] leading-[1.1] font-medium tracking-[-0.03em] sm:text-[2.75rem]">
        {title}
      </h1>
      {children && <p className="mt-3 text-[17px] leading-relaxed text-muted">{children}</p>}
    </header>
  );
}

// No logo exists yet (PRODUCT.md); a plain blue tile with a scan glyph
// stands in until one is supplied.
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="grid place-items-center rounded-xl bg-accent text-accent-text shadow-panel"
      style={{ width: size, height: size }}
    >
      <Scan size={size * 0.55} weight="bold" />
    </span>
  );
}
