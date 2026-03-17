import { createContext, useContext, useState, type ReactNode } from "react";

interface ClientModeContextType {
  clientMode: boolean;
  setClientMode: (v: boolean) => void;
}

const ClientModeContext = createContext<ClientModeContextType>({ clientMode: false, setClientMode: () => {} });

export function ClientModeProvider({ children }: { children: ReactNode }) {
  const [clientMode, setClientMode] = useState(false);
  return (
    <ClientModeContext.Provider value={{ clientMode, setClientMode }}>
      {children}
    </ClientModeContext.Provider>
  );
}

export function useClientMode() {
  return useContext(ClientModeContext);
}
