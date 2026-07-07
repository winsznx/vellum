import type { ReactNode } from "react";

// One-sentence route intro so every deep link explains itself immediately. Pure/server-safe.

export function PageIntro({ badge, title, sentence, actions }: { badge?: ReactNode; title: string; sentence: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <div className="min-w-0 max-w-[62ch]">
        {badge}
        <h1 className="mt-3 text-[27px] font-semibold leading-tight text-text-primary max-sm:text-[23px]">{title}</h1>
        <p className="mt-2 text-[14px] leading-6 text-text-secondary">{sentence}</p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
