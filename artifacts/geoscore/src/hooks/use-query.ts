import { useMemo } from "react";
import { useLocation } from "wouter";

// Helper hook to parse query string
export function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}
