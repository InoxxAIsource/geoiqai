import { useEffect } from "react";
import { useLocation } from "wouter";
import { getToken, initAuth, isPaidUser } from "@/lib/auth";

export function useAuthGuard() {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    initAuth();
    if (location.startsWith("/dashboard")) {
      if (!getToken() || !isPaidUser()) {
        setLocation("/pricing?reason=login_required");
      }
    }
  }, [location, setLocation]);

  return {
    isAuthenticated: !!getToken(),
    isPaid: isPaidUser(),
  };
}
