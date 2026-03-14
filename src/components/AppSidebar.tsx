import { MessageSquare, FileText, FolderOpen, Settings, User } from "lucide-react";
import { NavLink } from "@/components/NavLink";

const navItems = [
  { title: "Advisor Chat", label: "Advisor Chat", url: "/chat", icon: MessageSquare },
  { title: "Gerar Documentos", label: "Gerar Documentos", url: "/generator", icon: FileText },
  { title: "Base de Documentos", label: "Base de Documentos", url: "/library", icon: FolderOpen },
  { title: "Configurações", label: "Configurações", url: "/settings", icon: Settings },
];

export function AppSidebar() {
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

      {/* User */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="h-4 w-4 text-primary" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Advisor</p>
            <p className="text-xs text-muted-foreground">admin@galapagos.com</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
