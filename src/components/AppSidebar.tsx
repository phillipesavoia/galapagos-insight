import { MessageSquare, FileText, FolderOpen, BarChart3, Upload, LogOut, ClipboardList, BookOpen, TrendingUp, Database, Eye, EyeOff } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useClientMode } from "@/contexts/ClientModeContext";

const publicNavItems = [
  { title: "Dashboard", label: "Dashboard", url: "/dashboard", icon: TrendingUp },
  { title: "Advisor Chat", label: "Chat", url: "/chat", icon: MessageSquare },
  { title: "Analytics", label: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Gerar Documentos", label: "Docs", url: "/generator", icon: FileText },
  { title: "Relatórios", label: "Reports", url: "/reports", icon: ClipboardList },
];

const clientModeItems = [
  { title: "Dashboard", label: "Dashboard", url: "/dashboard", icon: TrendingUp },
  { title: "Advisor Chat", label: "Chat", url: "/chat", icon: MessageSquare },
  { title: "Relatórios", label: "Reports", url: "/reports", icon: ClipboardList },
];

const adminNavItems = [
  { title: "Data Hub", label: "Data Hub", url: "/data-hub", icon: Database },
  { title: "Library", label: "Library", url: "/library", icon: FolderOpen },
  { title: "Assets", label: "Assets", url: "/admin/assets", icon: BookOpen },
  { title: "NAV Upload", label: "NAV", url: "/admin/nav-upload", icon: Upload },
];

export function AppSidebar() {
  const { isAdmin } = useUserRole();
  const { clientMode, setClientMode } = useClientMode();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const navItems = clientMode
    ? clientModeItems
    : isAdmin
      ? [...publicNavItems, ...adminNavItems]
      : publicNavItems;

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[52px] hover:w-48 bg-sidebar border-r border-white/5 flex flex-col z-50 transition-all duration-300 group/sidebar overflow-hidden">
      {/* Logo */}
      <div className="p-3 pb-6 pt-5 flex items-center gap-2.5 min-w-0">
        <span className="text-lg font-bold text-neon-orange tracking-tight shrink-0">G</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 whitespace-nowrap">Galapagos</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-1.5 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-white/[0.03] transition-all duration-200 border-r-2 border-transparent min-w-0"
            activeClassName="border-r-2 !border-neon-green text-neon-green bg-neon-green/5 font-medium"
          >
            <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            <span className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 whitespace-nowrap truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-2 border-t border-white/5 space-y-0.5">
        {isAdmin && (
          <button
            onClick={() => setClientMode(!clientMode)}
            className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl text-xs transition-all duration-200 ${
              clientMode
                ? "bg-neon-green/10 text-neon-green font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]"
            }`}
          >
            {clientMode ? <EyeOff className="h-4 w-4 shrink-0" strokeWidth={1.5} /> : <Eye className="h-4 w-4 shrink-0" strokeWidth={1.5} />}
            <span className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 whitespace-nowrap">{clientMode ? "Client" : "Client"}</span>
          </button>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-white/[0.03] transition-all duration-200"
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          <span className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 whitespace-nowrap">Sair</span>
        </button>
      </div>
    </aside>
  );
}
