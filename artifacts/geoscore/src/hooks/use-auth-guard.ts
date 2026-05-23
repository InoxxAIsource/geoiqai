import { useEffect } from "react";
import { useLocation } from "wouter";
import { getToken, initAuth } from "@/lib/auth";

export function useAuthGuard() {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    initAuth();
    if (location.startsWith("/dashboard")) {
      if (!getToken()) {
        setLocation("/login?reason=login_required");
      }
    }
  }, [location, setLocation]);

  return {
    isAuthenticated: !!getToken(),
  };
}
