import { MessageSquare, FileText, FolderOpen, BarChart3, Upload, LogOut, ClipboardList, BookOpen } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

const publicNavItems = [
  { title: "Advisor Chat", label: "Advisor Chat", url: "/chat", icon: MessageSquare },
  { title: "Performance Analítica", label: "Performance Analítica", url: "/dashboard", icon: BarChart3 },
  { title: "Gerar Documentos", label: "Gerar Documentos", url: "/generator", icon: FileText },
  { title: "Gerador de Relatórios", label: "Gerador de Relatórios", url: "/reports", icon: ClipboardList },
];

const adminNavItems = [
  { title: "Base de Documentos", label: "Base de Documentos", url: "/library", icon: FolderOpen },
  { title: "Asset Dictionary", label: "Asset Dictionary", url: "/admin/assets", icon: BookOpen },
  { title: "Upload NAV", label: "Upload NAV", url: "/admin/nav-upload", icon: Upload },
];

export function AppSidebar() {
  const { isAdmin } = useUserRole();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const navItems = isAdmin ? [...publicNavItems, ...adminNavItems] : publicNavItems;

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

      {/* Logout */}
      <div className="p-4 border-t border-border">
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
