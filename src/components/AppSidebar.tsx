import { MessageSquare, FileText, FolderOpen, BarChart3, Upload, LogOut, ClipboardList, BookOpen, TrendingUp, ClipboardCheck, Users } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/contexts/UserRoleContext";

const publicNavItems = [
  { title: "Dashboard", label: "Dashboard", url: "/dashboard", icon: TrendingUp },
  { title: "Advisor Chat", label: "Advisor Chat", url: "/chat", icon: MessageSquare },
  { title: "Performance Analítica", label: "Performance Analítica", url: "/analytics", icon: BarChart3 },
  { title: "Cartas & Documentos", label: "Cartas & Documentos", url: "/generator", icon: FileText },
  { title: "Relatório de Portfólio", label: "Relatório de Portfólio", url: "/reports", icon: ClipboardList },
];

const adminNavItems = [
  { title: "Base de Documentos", label: "Base de Documentos", url: "/library", icon: FolderOpen },
  { title: "Asset Dictionary", label: "Asset Dictionary", url: "/admin/assets", icon: BookOpen },
  { title: "Upload NAV", label: "Upload NAV", url: "/admin/nav-upload", icon: Upload },
  { title: "Auditoria de Docs", label: "Auditoria de Docs", url: "/admin/audit", icon: ClipboardCheck },
  { title: "Usuários", label: "Usuários", url: "/admin/users", icon: Users },
];

export function AppSidebar() {
  const { isAdmin } = useUserRole();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const navItems = isAdmin ? [...publicNavItems, ...adminNavItems] : publicNavItems;

  return (
    <aside className="group/sidebar fixed left-0 top-0 bottom-0 z-50 flex w-14 flex-col border-r border-border bg-sidebar transition-all duration-200 ease-in-out hover:w-60">
      {/* Logo */}
      <div className="p-3 group-hover/sidebar:p-6 group-hover/sidebar:pb-4 transition-all duration-200">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-primary tracking-tight shrink-0">GC</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 whitespace-nowrap overflow-hidden">
          Galapagos Connect
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 group-hover/sidebar:px-3 space-y-1 transition-all duration-200">
        {navItems.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors border-l-2 border-transparent overflow-hidden whitespace-nowrap"
            activeClassName="border-l-2 !border-primary text-primary bg-primary/10 font-medium"
          >
            <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            <span className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-2 group-hover/sidebar:p-4 border-t border-border transition-all duration-200">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors overflow-hidden whitespace-nowrap"
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          <span className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200">Sair</span>
        </button>
      </div>
    </aside>
  );
}
