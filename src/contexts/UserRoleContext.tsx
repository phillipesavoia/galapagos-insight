import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "assessor";

interface UserRoleContextValue {
  role: AppRole | null;
  isAdmin: boolean;
  loading: boolean;
}

const UserRoleContext = createContext<UserRoleContextValue>({
  role: null,
  isAdmin: false,
  loading: true,
});

export function UserRoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async (userId: string) => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      setRole((data?.role as AppRole) ?? "assessor");
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchRole(session.user.id);
      } else {
        setRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <UserRoleContext.Provider value={{ role, isAdmin: role === "admin", loading }}>
      {children}
    </UserRoleContext.Provider>
  );
}

export function useUserRole() {
  return useContext(UserRoleContext);
}
