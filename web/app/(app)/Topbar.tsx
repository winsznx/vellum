"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import styles from "./shell.module.css";

export function Topbar({ crumb }: { crumb: React.ReactNode }) {
  return (
    <div className={styles.topbar}>
      <div className={styles.crumb}>{crumb}</div>
      <div className={styles.tbRight}>
        <span className={styles.netchip}>
          <span className={styles.netdot} />Sepolia
        </span>
        <ConnectButton
          accountStatus={{ smallScreen: "avatar", largeScreen: "full" }}
          chainStatus="none"
          showBalance={false}
        />
      </div>
    </div>
  );
}
