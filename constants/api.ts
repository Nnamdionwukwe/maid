import * as SecureStore from "expo-secure-store";
import { API_URL } from "./index";

// Add these helper functions
export async function getToken() {
  return await SecureStore.getItemAsync("auth_token");
}

export async function setToken(token: string) {
  await SecureStore.setItemAsync("auth_token", token);
}

export async function removeToken() {
  await SecureStore.deleteItemAsync("auth_token");
}

async function request(
  method: string,
  path: string,
  body?: any,
  requiresAuth = true,
) {
  const headers: any = { "Content-Type": "application/json" };
  if (requiresAuth) {
    const token = await getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

const api = {
  get: (path: string, auth = true) => request("GET", path, null, auth),
  post: (path: string, body: any, auth = true) =>
    request("POST", path, body, auth),
  patch: (path: string, body: any, auth = true) =>
    request("PATCH", path, body, auth),
  delete: (path: string, auth = true) => request("DELETE", path, null, auth),
};

export const notificationsAPI = {
  list: (params = {}) =>
    api.get(`/api/notifications?${new URLSearchParams(params)}`),
  unreadCount: () => api.get("/api/notifications/unread-count"),
  markAsRead: (id: string) => api.patch(`/api/notifications/${id}/read`, {}),
  markAllRead: () => api.patch("/api/notifications/read-all", {}),
  registerPushToken: (token: string, platform: string) =>
    api.post("/api/notifications/push-token", { token, platform }),
};

export const bookingsAPI = {
  list: (params = {}) =>
    api.get(`/api/bookings?${new URLSearchParams(params)}`),
  get: (id: string) => api.get(`/api/bookings/${id}`),
  create: (data: any) => api.post("/api/bookings", data),
  updateStatus: (id: string, status: string, reason?: string) =>
    api.patch(`/api/bookings/${id}/status`, { status, reason }),
  checkIn: (id: string, lat: number, lng: number) =>
    api.post(`/api/bookings/${id}/checkin`, { lat, lng }),
  checkOut: (id: string, lat: number, lng: number) =>
    api.post(`/api/bookings/${id}/checkout`, { lat, lng }),
  updateLocation: (id: string, lat: number, lng: number) =>
    api.post(`/api/bookings/${id}/location`, { lat, lng }),
  triggerSOS: (id: string, data: any) =>
    api.post(`/api/bookings/${id}/sos`, data),
  submitReview: (id: string, rating: number, comment: string) =>
    api.post(`/api/bookings/${id}/review`, { rating, comment }),
};

export const maidsAPI = {
  search: (params = {}) =>
    api.get(`/api/maids/search?${new URLSearchParams(params)}`),
  get: (id: string) => api.get(`/api/maids/${id}`),
};

export const paymentsAPI = {
  initializeFlutterwave: (booking_id: string) =>
    api.post("/api/payments/initialize", { booking_id }),
  initializeBankTransfer: (booking_id: string) =>
    api.post("/api/payments/initialize/bank", { booking_id }),
  confirmBankTransfer: (data: any) =>
    api.post("/api/payments/confirm/bank", data),
  initializeCrypto: (booking_id: string, currency?: string) =>
    api.post("/api/payments/initialize/crypto", { booking_id, currency }),
  confirmCrypto: (data: any) => api.post("/api/payments/confirm/crypto", data),
  myPayments: (params = {}) =>
    api.get(`/api/payments/my?${new URLSearchParams(params)}`),
};

export const subscriptionsAPI = {
  // ── Public / auth routes ──
  plans: (role: string, currency: string) =>
    api.get(
      `/api/subscriptions/plans?role=${role}&currency=${currency}`,
      false,
    ),
  my: () => api.get("/api/subscriptions/my"),

  // ── User actions ──
  subscribe: (data: {
    plan_id: string;
    currency?: string;
    promo_code?: string;
  }) => api.post("/api/subscriptions/subscribe", data),

  verify: (params: {
    gateway: string;
    reference?: string;
    transaction_id?: string;
  }) => api.get(`/api/subscriptions/verify?${new URLSearchParams(params)}`),

  cancel: (data?: { reason?: string; immediate?: boolean }) =>
    api.post("/api/subscriptions/cancel", data || {}),

  pause: () => api.post("/api/subscriptions/pause", {}),

  resume: () => api.post("/api/subscriptions/resume", {}),

  changePlan: (data: { new_plan_id: string; promo_code?: string }) =>
    api.post("/api/subscriptions/change-plan", data),

  // ── Promo validation ──
  validatePromo: (data: {
    code: string;
    plan_name?: string;
    currency?: string;
  }) => api.post("/api/subscriptions/validate-promo", data),
};

export default api;
