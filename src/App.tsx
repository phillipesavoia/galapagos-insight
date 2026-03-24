import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { UserRoleProvider } from "@/contexts/UserRoleContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthGuard } from "@/components/AuthGuard";
import { AdminRoute } from "@/components/AdminRoute";
import Chat from "./pages/Chat";
import LiveDashboard from "./pages/LiveDashboard";
import Dashboard from "./pages/Dashboard";
import Generator from "./pages/Generator";
import Reports from "./pages/Reports";
import Library from "./pages/Library";
import NavUpload from "./pages/NavUpload";
import AssetKnowledge from "./pages/AssetKnowledge";
import DocumentAudit from "./pages/DocumentAudit";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <UserRoleProvider>
      <BrowserRouter>
      <BrowserRouter>
        <AuthGuard>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<LiveDashboard />} />
            <Route path="/analytics" element={<Dashboard />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/generator" element={<Generator />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/library" element={<AdminRoute><Library /></AdminRoute>} />
            <Route path="/admin/nav-upload" element={<AdminRoute><NavUpload /></AdminRoute>} />
            <Route path="/admin/assets" element={<AdminRoute><AssetKnowledge /></AdminRoute>} />
            <Route path="/admin/audit" element={<AdminRoute><DocumentAudit /></AdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthGuard>
      </BrowserRouter>
      </UserRoleProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

