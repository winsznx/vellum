import { MobileNav, Sidebar } from "./Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-screen w-screen max-w-full grid-cols-[264px_1fr] overflow-hidden bg-surface-base text-text-primary max-lg:grid-cols-1 max-lg:overflow-x-hidden max-lg:overflow-y-auto" data-theme="dark">
      <Sidebar />
      <div className="flex min-w-0 max-w-full flex-col overflow-y-auto max-lg:min-h-screen max-lg:w-screen max-lg:overflow-x-hidden max-lg:pb-20">{children}</div>
      <MobileNav />
    </div>
  );
}
