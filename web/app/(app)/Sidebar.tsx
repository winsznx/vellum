"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BookOpenText, Boxes, ChartNoAxesCombined, Route, WalletCards } from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { SystemStatus } from "@/components/vellum/status";

const NAV = [
  { href: "/registry", label: "Registry", icon: Boxes },
  { href: "/products", label: "Products", icon: ChartNoAxesCombined },
  { href: "/distributions", label: "Distributions", icon: Route },
  { href: "/portfolio", label: "Portfolio", icon: WalletCards },
];
const NAV_FOOT = [
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/docs", label: "Docs", icon: BookOpenText },
];
const ALL_NAV = [...NAV, ...NAV_FOOT];

export function Sidebar() {
  const path = usePathname();
  const isActive = (href: string) => path === href || path.startsWith(href + "/");
  return (
    <aside className="flex h-screen flex-col border-r border-border-hairline bg-ink-900 px-4 py-5 max-lg:hidden">
      <Link className="mb-5 flex items-center gap-3 rounded-md px-2 py-1.5" href="/">
        <span className="relative size-[22px] rounded-sm bg-[linear-gradient(135deg,var(--cipher-400),var(--flow-500))] after:absolute after:inset-[6px] after:rounded-[2px] after:bg-ink-950" />
        <b className="text-[15px] font-semibold text-text-primary">Vellum</b>
      </Link>
      <nav className="flex flex-col gap-1">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-2.5 py-2 text-[13.5px] font-medium text-text-secondary transition-colors hover:bg-white/[0.04] hover:text-text-primary",
              isActive(n.href) && "bg-flow-500/10 text-text-primary",
            )}
          >
            <n.icon className={cn("size-[18px] stroke-[1.6]", isActive(n.href) && "text-flow-400")} />
            {n.label}
          </Link>
        ))}
        <Separator className="my-2" />
        {NAV_FOOT.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-2.5 py-2 text-[13.5px] font-medium text-text-secondary transition-colors hover:bg-white/[0.04] hover:text-text-primary",
              isActive(n.href) && "bg-flow-500/10 text-text-primary",
            )}
          >
            <n.icon className={cn("size-[18px] stroke-[1.6]", isActive(n.href) && "text-flow-400")} />
            {n.label}
          </Link>
        ))}
      </nav>
      <SystemStatus className="mt-auto" />
    </aside>
  );
}

export function MobileNav() {
  const path = usePathname();
  const isActive = (href: string) => path === href || path.startsWith(href + "/");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 hidden border-t border-border-hairline bg-ink-900/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur max-lg:block">
      <div className="grid grid-cols-6 gap-1">
        {ALL_NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "flex min-w-0 flex-col items-center gap-1 rounded-md px-1 py-2 text-[10px] font-medium text-text-tertiary transition-colors",
              isActive(n.href) && "bg-flow-500/10 text-text-primary",
            )}
            aria-current={isActive(n.href) ? "page" : undefined}
          >
            <n.icon className={cn("size-[18px] stroke-[1.6]", isActive(n.href) && "text-flow-400")} />
            <span className="w-full truncate text-center">{n.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
