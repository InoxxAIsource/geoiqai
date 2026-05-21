import { useState } from "react";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { 
  useGetDashboardSummary, 
  useGetMonitoredBrands, 
  useGetBrandScores,
  useGetMe,
  useRemoveMonitoredBrand,
  getGetMonitoredBrandsQueryKey,
  getGetDashboardSummaryQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/layout/Navbar";
import { AddBrandModal } from "@/components/dashboard/AddBrandModal";
import { ScoreChart } from "@/components/dashboard/ScoreChart";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreBar } from "@/components/ui/score-bar";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, TrendingUp, Target, Activity, Star } from "lucide-react";

export default function Dashboard() {
  const { isAuthenticated } = useAuthGuard();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);

  // Queries
  const { data: user } = useGetMe({ query: { enabled: isAuthenticated } });
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({ query: { enabled: isAuthenticated } });
  const { data: brands, isLoading: loadingBrands } = useGetMonitoredBrands({ query: { enabled: isAuthenticated } });
  
  // Set selected brand when brands load
  if (brands && brands.length > 0 && !selectedBrandId) {
    setSelectedBrandId(brands[0].id);
  }

  const { data: scores } = useGetBrandScores(selectedBrandId!, { 
    query: { enabled: !!selectedBrandId && isAuthenticated } 
  });

  const removeBrandMutation = useRemoveMonitoredBrand();

  const handleRemoveBrand = (id: string, name: string) => {
    if (confirm(`Stop monitoring ${name}?`)) {
      removeBrandMutation.mutate({ id }, {
        onSuccess: () => {
          toast({ title: "Brand removed", description: "Stopped monitoring." });
          queryClient.invalidateQueries({ queryKey: getGetMonitoredBrandsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          if (selectedBrandId === id) setSelectedBrandId(null);
        }
      });
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen flex flex-col bg-bg-secondary font-sans">
      <Navbar />
      
      <main className="flex-1 py-8 px-4 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">Dashboard</h1>
            <p className="text-text-secondary text-sm mt-1">Welcome back. Here is your AI visibility overview.</p>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <Badge variant="outline" className="px-3 py-1 font-medium capitalize border-primary/30 text-primary bg-primary/5">
                {user.plan} Plan
              </Badge>
            )}
            <AddBrandModal />
          </div>
        </div>

        {/* Summary Stats */}
        {(loadingSummary || loadingBrands) ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card className="p-5 border-border shadow-sm">
                <div className="flex items-center gap-3 text-text-secondary mb-2">
                  <Target className="w-4 h-4" />
                  <span className="text-sm font-medium">Monitored Brands</span>
                </div>
                <div className="text-3xl font-bold text-text-primary">{summary?.totalBrands || 0}</div>
              </Card>
              <Card className="p-5 border-border shadow-sm">
                <div className="flex items-center gap-3 text-text-secondary mb-2">
                  <Activity className="w-4 h-4" />
                  <span className="text-sm font-medium">Average Score</span>
                </div>
                <div className="text-3xl font-bold text-text-primary">{Math.round(summary?.avgScore || 0)}</div>
              </Card>
              <Card className="p-5 border-border shadow-sm">
                <div className="flex items-center gap-3 text-text-secondary mb-2">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm font-medium">Improving Brands</span>
                </div>
                <div className="text-3xl font-bold text-text-primary">{summary?.brandsWithImprovement || 0}</div>
              </Card>
              <Card className="p-5 border-border shadow-sm">
                <div className="flex items-center gap-3 text-text-secondary mb-2">
                  <Star className="w-4 h-4 text-warning" />
                  <span className="text-sm font-medium">Top Performer</span>
                </div>
                <div className="text-lg font-bold text-text-primary truncate" title={summary?.topBrand || "None"}>
                  {summary?.topBrand || "N/A"}
                </div>
                <div className="text-xs text-text-tertiary mt-1">Score: {summary?.topBrandScore || 0}</div>
              </Card>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
              {/* Brands List */}
              <div className="lg:col-span-1 space-y-4">
                <h2 className="font-semibold text-lg mb-4">Your Brands</h2>
                {brands?.length === 0 ? (
                  <Card className="p-8 text-center text-text-secondary border-dashed border-2">
                    <p className="mb-4">No brands monitored yet.</p>
                    <AddBrandModal />
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {brands?.map((brand) => (
                      <Card 
                        key={brand.id}
                        className={`p-4 cursor-pointer transition-all duration-200 border ${selectedBrandId === brand.id ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : 'border-border hover:border-primary/50'}`}
                        onClick={() => setSelectedBrandId(brand.id)}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-medium text-text-primary">{brand.brandName || brand.domain}</h3>
                            <p className="text-xs text-text-tertiary">{brand.domain}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-bold text-primary">{brand.latestScore || 0}</span>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-text-tertiary hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveBrand(brand.id, brand.brandName || brand.domain);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex justify-between text-xs text-text-secondary font-medium px-2 py-1.5 bg-bg-tertiary rounded-md">
                          <span>CGPT: {brand.latestScoreChatgpt || 0}</span>
                          <span>GEM: {brand.latestScoreGemini || 0}</span>
                          <span>PRX: {brand.latestScorePerplexity || 0}</span>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Chart & Details */}
              <div className="lg:col-span-2 space-y-6">
                <h2 className="font-semibold text-lg mb-4">Visibility Trends</h2>
                {selectedBrandId ? (
                  <>
                    <ScoreChart data={scores || []} />
                    
                    {/* Selected Brand Quick Breakdown */}
                    {brands?.find(b => b.id === selectedBrandId) && (
                      <div className="grid sm:grid-cols-3 gap-4">
                        <Card className="p-4">
                          <div className="text-sm text-text-secondary mb-2">ChatGPT Score</div>
                          <ScoreBar score={brands.find(b => b.id === selectedBrandId)?.latestScoreChatgpt || 0} />
                        </Card>
                        <Card className="p-4">
                          <div className="text-sm text-text-secondary mb-2">Gemini Score</div>
                          <ScoreBar score={brands.find(b => b.id === selectedBrandId)?.latestScoreGemini || 0} />
                        </Card>
                        <Card className="p-4">
                          <div className="text-sm text-text-secondary mb-2">Perplexity Score</div>
                          <ScoreBar score={brands.find(b => b.id === selectedBrandId)?.latestScorePerplexity || 0} />
                        </Card>
                      </div>
                    )}
                  </>
                ) : (
                  <Card className="h-[350px] flex items-center justify-center text-text-secondary border-dashed border-2">
                    Select a brand to view trends
                  </Card>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
