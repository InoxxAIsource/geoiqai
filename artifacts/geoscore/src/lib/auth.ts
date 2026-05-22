import { setAuthTokenGetter } from "@workspace/api-client-react";

export const TOKEN_KEY = "geoscore_token";
export const PLAN_KEY = "geoscore_plan";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function setPlan(plan: string): void {
  localStorage.setItem(PLAN_KEY, plan);
}

export function getPlan(): string | null {
  return localStorage.getItem(PLAN_KEY);
}

export function isPaidUser(): boolean {
  const plan = getPlan();
  return plan === "starter" || plan === "agency";
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PLAN_KEY);
}

export function initAuth() {
  setAuthTokenGetter(getToken);
}
