import { useEffect } from "react";
import { useLocation } from "wouter";
import { getToken, getPlan, initAuth } from "@/lib/auth";

export function useAuthGuard() {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    initAuth();
    if (location.startsWith("/dashboard")) {
      if (!getToken()) {
        setLocation("/login?reason=login_required");
      } else if (getPlan() === "free") {
        setLocation("/pricing?reason=upgrade_required");
      }
    }
  }, [location, setLocation]);

  const token = getToken();
  const plan = getPlan();

  return {
    isAuthenticated: !!token,
    isPaid: plan === "starter" || plan === "agency",
    plan: plan ?? "free",
  };
}
