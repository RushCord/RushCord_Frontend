import axios from "axios";

export const apiBaseURL = (() => {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  if (typeof fromEnv === "string" && fromEnv.trim() !== "") {
    return fromEnv.trim().replace(/\/+$/, "");
  }
  return import.meta.env.MODE === "development"
    ? "http://localhost:3000/api"
    : "/api";
})();

const baseURL = apiBaseURL;

const TOKEN_KEY = "rushcord_access_token";
const REFRESH_KEY = "rushcord_refresh_token";

export function setAuthTokens(accessToken, refreshToken) {
  if (accessToken != null && accessToken !== "") {
    localStorage.setItem(TOKEN_KEY, accessToken);
  }
  if (refreshToken != null && refreshToken !== "") {
    localStorage.setItem(REFRESH_KEY, refreshToken);
  }
}

export function clearAuthTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

/** Plain client (no interceptors) for refresh to avoid loops */
const plainClient = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

export const axiosInstance = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

axiosInstance.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData && config.headers) {
    if (typeof config.headers.delete === "function") {
      config.headers.delete("Content-Type");
    } else {
      delete config.headers["Content-Type"];
    }
  }
  return config;
});

let refreshPromise = null;

axiosInstance.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    if (
      status === 401 &&
      original &&
      !original._authRetry &&
      getRefreshToken() &&
      !original.url?.includes("/auth/refresh") &&
      !original.url?.includes("/auth/login")
    ) {
      original._authRetry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = plainClient
            .post("/auth/refresh", {
              refreshToken: getRefreshToken(),
            })
            .finally(() => {
              refreshPromise = null;
            });
        }
        const { data } = await refreshPromise;
        setAuthTokens(
          data.accessToken,
          data.refreshToken ?? getRefreshToken()
        );
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return axiosInstance(original);
      } catch {
        clearAuthTokens();
      }
    }
    return Promise.reject(error);
  }
);
