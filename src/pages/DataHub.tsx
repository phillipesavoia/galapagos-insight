import { Layout } from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, TrendingUp, PieChart } from "lucide-react";
import { DocumentsTab } from "@/components/datahub/DocumentsTab";
import { NavsTab } from "@/components/datahub/NavsTab";
import { AllocationTab } from "@/components/datahub/AllocationTab";

export default function DataHub() {
  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Data Hub</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Central unificada de uploads e gestão de dados dos portfólios.
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="documents" className="space-y-6">
          <TabsList className="bg-secondary/50 border border-border p-1 h-auto gap-1">
            <TabsTrigger
              value="documents"
              className="gap-2 px-4 py-2.5 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              <FileText className="h-4 w-4" strokeWidth={1.5} />
              Documentos
            </TabsTrigger>
            <TabsTrigger
              value="navs"
              className="gap-2 px-4 py-2.5 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              <TrendingUp className="h-4 w-4" strokeWidth={1.5} />
              Histórico de Cotas
            </TabsTrigger>
            <TabsTrigger
              value="allocation"
              className="gap-2 px-4 py-2.5 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              <PieChart className="h-4 w-4" strokeWidth={1.5} />
              Matriz de Alocação
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
