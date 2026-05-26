import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "@/pages/Home";
import Audit from "@/pages/Audit";
import Dashboard from "@/pages/Dashboard";
import Roadmap from "@/pages/Roadmap";
import Pricing from "@/pages/Pricing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import VerifyEmail from "@/pages/VerifyEmail";
import MagicAuth from "@/pages/MagicAuth";
import WhatIsGeo from "@/pages/WhatIsGeo";
import HowToRankInChatGPT from "@/pages/HowToRankInChatGPT";
import GeoTools from "@/pages/GeoTools";
import BlogChatGPT from "@/pages/BlogChatGPT";
import Blog from "@/pages/Blog";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import Contact from "@/pages/Contact";
import Admin from "@/pages/Admin";
import LlmsTxtGuide from "@/pages/LlmsTxtGuide";
import AiVisibilityScore from "@/pages/AiVisibilityScore";
import AiVisibilityIndia from "@/pages/AiVisibilityIndia";
import BlogIndianStartupScores from "@/pages/BlogIndianStartupScores";
import BlogRobotsTxt from "@/pages/BlogRobotsTxt";
import BlogWhatIsGeoScore from "@/pages/BlogWhatIsGeoScore";
import BlogGeoVsSeo from "@/pages/BlogGeoVsSeo";
import DevLogin from "@/pages/DevLogin";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location]);
  return null;
}

function Router() {
  return (
    <>
      <ScrollToTop />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/audit" component={Audit} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/roadmap" component={Roadmap} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/login" component={Login} />
        <Route path="/dev-login" component={DevLogin} />
        <Route path="/signup" component={Signup} />
        <Route path="/register" component={Register} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/auth/reset-password" component={ResetPassword} />
        <Route path="/auth/verify-email" component={VerifyEmail} />
        <Route path="/auth/magic" component={MagicAuth} />
        <Route path="/what-is-geo" component={WhatIsGeo} />
        <Route path="/how-to-rank-in-chatgpt" component={HowToRankInChatGPT} />
        <Route path="/geo-tools" component={GeoTools} />
        <Route path="/blog/why-startup-not-showing-chatgpt" component={BlogChatGPT} />
        <Route path="/blog" component={Blog} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/terms" component={Terms} />
        <Route path="/contact" component={Contact} />
        <Route path="/admin" component={Admin} />
        <Route path="/llms-txt-guide" component={LlmsTxtGuide} />
        <Route path="/ai-visibility-score" component={AiVisibilityScore} />
        <Route path="/ai-visibility-for-indian-startups" component={AiVisibilityIndia} />
        <Route path="/blog/indian-startups-chatgpt-scores" component={BlogIndianStartupScores} />
        <Route path="/blog/robots-txt-blocking-ai" component={BlogRobotsTxt} />
        <Route path="/blog/what-is-geo-score" component={BlogWhatIsGeoScore} />
        <Route path="/blog/geo-vs-seo-2026" component={BlogGeoVsSeo} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
