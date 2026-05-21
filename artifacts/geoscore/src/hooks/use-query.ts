import { useMemo } from "react";
import { useSearch } from "wouter";

export function useQuery() {
  const search = useSearch();
  return useMemo(() => new URLSearchParams(search ?? ""), [search]);
}
