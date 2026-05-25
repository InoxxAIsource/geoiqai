import { renderToString } from "react-dom/server";
import { Router, Switch, Route } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";

import Home from "@/pages/Home";
import WhatIsGeo from "@/pages/WhatIsGeo";
import HowToRankInChatGPT from "@/pages/HowToRankInChatGPT";
import GeoTools from "@/pages/GeoTools";
import LlmsTxtGuide from "@/pages/LlmsTxtGuide";
import AiVisibilityScore from "@/pages/AiVisibilityScore";
import AiVisibilityIndia from "@/pages/AiVisibilityIndia";
import Blog from "@/pages/Blog";
import BlogChatGPT from "@/pages/BlogChatGPT";
import BlogIndianStartupScores from "@/pages/BlogIndianStartupScores";
import BlogRobotsTxt from "@/pages/BlogRobotsTxt";
import BlogWhatIsGeoScore from "@/pages/BlogWhatIsGeoScore";
import BlogGeoVsSeo from "@/pages/BlogGeoVsSeo";
import Pricing from "@/pages/Pricing";
import Roadmap from "@/pages/Roadmap";
import Contact from "@/pages/Contact";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import NotFound from "@/pages/not-found";

type StaticHook = () => [string, (to: string) => void];

function makeStaticHook(url: string): StaticHook {
  return () => [url, () => {}];
}

export function render(url: string): string {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, enabled: false, staleTime: Infinity },
    },
  });

  return renderToString(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router hook={makeStaticHook(url) as Parameters<typeof Router>[0]["hook"]}>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/what-is-geo" component={WhatIsGeo} />
            <Route path="/how-to-rank-in-chatgpt" component={HowToRankInChatGPT} />
            <Route path="/geo-tools" component={GeoTools} />
            <Route path="/llms-txt-guide" component={LlmsTxtGuide} />
            <Route path="/ai-visibility-score" component={AiVisibilityScore} />
            <Route path="/ai-visibility-for-indian-startups" component={AiVisibilityIndia} />
            <Route path="/blog" component={Blog} />
            <Route path="/blog/why-startup-not-showing-chatgpt" component={BlogChatGPT} />
            <Route path="/blog/indian-startups-chatgpt-scores" component={BlogIndianStartupScores} />
            <Route path="/blog/robots-txt-blocking-ai" component={BlogRobotsTxt} />
            <Route path="/blog/what-is-geo-score" component={BlogWhatIsGeoScore} />
            <Route path="/blog/geo-vs-seo-2026" component={BlogGeoVsSeo} />
            <Route path="/pricing" component={Pricing} />
            <Route path="/roadmap" component={Roadmap} />
            <Route path="/contact" component={Contact} />
            <Route path="/privacy" component={Privacy} />
            <Route path="/terms" component={Terms} />
            <Route component={NotFound} />
          </Switch>
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
