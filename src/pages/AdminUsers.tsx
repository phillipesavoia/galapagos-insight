import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Shield, User } from "lucide-react";

interface AppUser {
  user_id: string;
  role: "admin" | "assessor";
  email: string;
  created_at?: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_roles")
      .select("user_id, role");

    if (error) {
      toast({ title: "Erro ao carregar usuários", variant: "destructive" });
      setLoading(false);
      return;
    }

    const { data: emails } = await supabase.rpc("get_user_emails");

    const emailMap: Record<string, string> = {};
    if (emails) {
      for (const e of emails as any[]) emailMap[e.user_id] = e.email;
    }

    setUsers(
      (data || []).map((u: any) => ({
        ...u,
        email: emailMap[u.user_id] || u.user_id,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleRole = async (user: AppUser) => {
    const newRole = user.role === "admin" ? "assessor" : "admin";
    setUpdatingId(user.user_id);
    const { error } = await supabase
      .from("user_roles")
      .update({ role: newRole })
      .eq("user_id", user.user_id);

    if (error) {
      toast({ title: "Erro ao atualizar role", variant: "destructive" });
    } else {
      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === user.user_id ? { ...u, role: newRole as "admin" | "assessor" } : u
        )
      );
      toast({ title: "Role atualizada", description: `${user.email} → ${newRole}` });
    }
    setUpdatingId(null);
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Gestão de Usuários
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie roles e permissões dos usuários
          </p>
        </div>

        <div className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Carregando...
            </p>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum usuário encontrado.
            </p>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.user_id}
                  className="flex items-center justify-between p-4 rounded-xl border border-border bg-card"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0">
                      {user.role === "admin" ? (
                        <Shield className="h-5 w-5 text-primary" strokeWidth={1.5} />
                      ) : (
                        <User className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {user.email}
                      </p>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          user.role === "admin"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {user.role}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleRole(user)}
                    disabled={updatingId === user.user_id}
                    className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-accent/10 transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    {updatingId === user.user_id
                      ? "Atualizando..."
                      : user.role === "admin"
                        ? "Tornar assessor"
                        : "Tornar admin"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
