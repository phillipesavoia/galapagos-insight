import { AppSidebar } from "@/components/AppSidebar";
import { PortfolioMonitorBar } from "@/components/PortfolioMonitorBar";

export function Layout({ children, hideMonitor }: { children: React.ReactNode; hideMonitor?: boolean }) {
  return (
    <div className="min-h-screen flex">
      <AppSidebar />
      <main className="flex-1 ml-[52px] min-h-screen flex flex-col">
        {!hideMonitor && <PortfolioMonitorBar />}
        <div className="flex-1 flex flex-col min-h-0">
          {children}
        </div>
      </main>
    </div>
  );
}
