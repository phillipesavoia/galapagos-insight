import { Layout } from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, TrendingUp, PieChart } from "lucide-react";
import { DocumentsTab } from "@/components/datahub/DocumentsTab";
import { NavsTab } from "@/components/datahub/NavsTab";
import { AllocationTab } from "@/components/datahub/AllocationTab";

export default function DataHub() {
  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto overflow-x-hidden animate-fade-up">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Data Hub</h1>
          <p className="text-[10px] text-muted-foreground mt-1 font-mono uppercase tracking-widest">
            Unified data management for model portfolios
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="documents" className="space-y-6">
          <TabsList className="glass-card border-white/5 p-0.5 h-auto gap-0.5 rounded-xl">
            <TabsTrigger
              value="documents"
              className="gap-2 px-4 py-2 text-[10px] font-mono uppercase tracking-wider rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <FileText className="h-3.5 w-3.5" strokeWidth={1.5} />
              Documents
            </TabsTrigger>
            <TabsTrigger
              value="navs"
              className="gap-2 px-4 py-2 text-[10px] font-mono uppercase tracking-wider rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.5} />
              NAV History
            </TabsTrigger>
            <TabsTrigger
              value="allocation"
              className="gap-2 px-4 py-2 text-[10px] font-mono uppercase tracking-wider rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <PieChart className="h-3.5 w-3.5" strokeWidth={1.5} />
              Allocation Matrix
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documents">
            <DocumentsTab />
          </TabsContent>

          <TabsContent value="navs">
            <NavsTab />
          </TabsContent>

          <TabsContent value="allocation">
            <AllocationTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
