import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "@/pages/Home";
import Audit from "@/pages/Audit";
import Dashboard from "@/pages/Dashboard";
import Pricing from "@/pages/Pricing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import WhatIsGeo from "@/pages/WhatIsGeo";
import HowToRankInChatGPT from "@/pages/HowToRankInChatGPT";
import GeoTools from "@/pages/GeoTools";
import BlogChatGPT from "@/pages/BlogChatGPT";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/audit" component={Audit} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/what-is-geo" component={WhatIsGeo} />
      <Route path="/how-to-rank-in-chatgpt" component={HowToRankInChatGPT} />
      <Route path="/geo-tools" component={GeoTools} />
      <Route path="/blog/why-startup-not-showing-chatgpt" component={BlogChatGPT} />
      <Route component={NotFound} />
    </Switch>
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
