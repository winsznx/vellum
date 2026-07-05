"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { shortAddr } from "@/lib/vellum";
import styles from "./shell.module.css";

const NAV = [
  { href: "/registry", label: "Registry", icon: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></> },
  { href: "/products", label: "Products", icon: <path d="M4 7h16M4 12h16M4 17h10" /> },
  { href: "/distributions", label: "Distributions", icon: <path d="M5 12h14M13 6l6 6-6 6" /> },
  { href: "/portfolio", label: "Portfolio", icon: <><path d="M3 6h18v12H3z" /><path d="M3 10h18" /></> },
];
const NAV_FOOT = [
  { href: "/activity", label: "Activity", icon: <path d="M4 18l5-6 4 4 7-9" /> },
  { href: "/docs", label: "Docs", icon: <><path d="M5 4h11l3 3v13H5z" /><path d="M9 9h7M9 13h7" /></> },
];

export function Sidebar() {
  const path = usePathname();
  const { address, isConnected } = useAccount();
  const isActive = (href: string) => path === href || path.startsWith(href + "/");
  return (
    <aside className={styles.sidebar}>
      <Link className={styles.brand} href="/"><span className={styles.brandMark} /><b>Vellum</b></Link>
      <nav className={styles.nav}>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={isActive(n.href) ? styles.active : ""}>
            <svg viewBox="0 0 24 24">{n.icon}</svg>{n.label}
          </Link>
        ))}
        <div className={styles.sep} />
        {NAV_FOOT.map((n) => (
          <Link key={n.href} href={n.href} className={isActive(n.href) ? styles.active : ""}>
            <svg viewBox="0 0 24 24">{n.icon}</svg>{n.label}
          </Link>
        ))}
      </nav>
      <div className={styles.sideFoot}>
        <span className={styles.dot} style={isConnected ? undefined : { background: "var(--slate-600)", boxShadow: "none" }} />
        <span className={styles.id}>{isConnected && address ? shortAddr(address) : "not connected"}</span>
      </div>
    </aside>
  );
}
