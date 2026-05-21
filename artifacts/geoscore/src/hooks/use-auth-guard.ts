import { useEffect } from "react";
import { useLocation } from "wouter";
import { getToken, initAuth } from "@/lib/auth";

export function useAuthGuard() {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    initAuth();
    const token = getToken();
    if (!token && location.startsWith("/dashboard")) {
      setLocation("/login");
    }
  }, [location, setLocation]);

  return { isAuthenticated: !!getToken() };
}
