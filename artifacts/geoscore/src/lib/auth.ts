import { setAuthTokenGetter } from "@workspace/api-client-react";

export const TOKEN_KEY = "geoscore_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// Initialize custom fetch with the token getter
export function initAuth() {
  setAuthTokenGetter(getToken);
}
