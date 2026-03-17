import { MessageSquare, FileText, FolderOpen, BarChart3, Upload, LogOut, ClipboardList, BookOpen, TrendingUp, Database, Eye, EyeOff } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useClientMode } from "@/contexts/ClientModeContext";

const publicNavItems = [
  { title: "Dashboard", label: "Dashboard", url: "/dashboard", icon: TrendingUp },
  { title: "Advisor Chat", label: "Advisor Chat", url: "/chat", icon: MessageSquare },
  { title: "Performance Analítica", label: "Performance Analítica", url: "/analytics", icon: BarChart3 },
  { title: "Gerar Documentos", label: "Gerar Documentos", url: "/generator", icon: FileText },
  { title: "Gerador de Relatórios", label: "Gerador de Relatórios", url: "/reports", icon: ClipboardList },
];

const clientModeItems = [
  { title: "Dashboard", label: "Dashboard", url: "/dashboard", icon: TrendingUp },
  { title: "Advisor Chat", label: "Advisor Chat", url: "/chat", icon: MessageSquare },
  { title: "Gerador de Relatórios", label: "Relatórios", url: "/reports", icon: ClipboardList },
];

const adminNavItems = [
  { title: "Data Hub", label: "Data Hub", url: "/data-hub", icon: Database },
  { title: "Base de Documentos", label: "Base de Documentos", url: "/library", icon: FolderOpen },
  { title: "Asset Dictionary", label: "Asset Dictionary", url: "/admin/assets", icon: BookOpen },
  { title: "Upload NAV", label: "Upload NAV", url: "/admin/nav-upload", icon: Upload },
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
    <aside className="fixed left-0 top-0 bottom-0 w-60 bg-sidebar border-r border-border flex flex-col z-50">
      {/* Logo */}
      <div className="p-6 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-primary tracking-tight">GC</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Galapagos Connect</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors border-l-2 border-transparent"
            activeClassName="border-l-2 !border-primary text-primary bg-primary/10 font-medium"
          >
            <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Client Mode Toggle + Logout */}
      <div className="p-4 border-t border-border space-y-1">
        {isAdmin && (
          <button
            onClick={() => setClientMode(!clientMode)}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${
              clientMode
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/10"
            }`}
          >
            {clientMode ? <EyeOff className="h-4 w-4 shrink-0" strokeWidth={1.5} /> : <Eye className="h-4 w-4 shrink-0" strokeWidth={1.5} />}
            <span>{clientMode ? "Modo Cliente" : "Modo Cliente"}</span>
          </button>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}

