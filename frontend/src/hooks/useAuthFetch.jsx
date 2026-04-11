// frontend/src/hooks/useAuthFetch.js
// Use this hook anywhere you need to call your backend.
// It automatically attaches the Clerk JWT as a Bearer token.

import { useAuth } from "@clerk/clerk-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

export function useAuthFetch() {
  const { getToken } = useAuth();

  const authFetch = async (endpoint, options = {}) => {
    // Get fresh Clerk JWT token for every request
    const token = await getToken();

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(error.message || "Request failed");
    }

    return res.json();
  };

  return { authFetch };
}