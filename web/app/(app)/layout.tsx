import { Sidebar } from "./Sidebar";
import styles from "./shell.module.css";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.app} data-theme="dark">
      <Sidebar />
      <div className={styles.main}>{children}</div>
    </div>
  );
}
