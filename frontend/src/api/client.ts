import { storage } from "@/src/utils/storage";
import { Platform } from "react-native";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL as string;
export const TOKEN_KEY = "lokita_token";

let cachedToken: string | null = null;
export function setToken(t: string | null) {
  cachedToken = t;
}
export function getToken() {
  return cachedToken;
}

async function request(method: string, path: string, body?: any) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cachedToken) headers.Authorization = `Bearer ${cachedToken}`;
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || "Terjadi kesalahan";
    throw new Error(typeof msg === "string" ? msg : "Terjadi kesalahan");
  }
  return data;
}

export const api = {
  get: (p: string) => request("GET", p),
  post: (p: string, b?: any) => request("POST", p, b ?? {}),
  put: (p: string, b?: any) => request("PUT", p, b ?? {}),
  del: (p: string) => request("DELETE", p),
};

export function fileUrl(fileId?: string | null): string | undefined {
  if (!fileId) return undefined;
  return `${BASE}/api/files/${fileId}?token=${cachedToken ?? ""}`;
}

// Upload a local image uri to object storage via backend. Returns { id, kind }.
export async function uploadImage(uri: string, kind: string, orderId?: string) {
  const name = `upload_${Date.now()}.jpg`;
  const form = new FormData();
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    form.append("file", blob, name);
  } else {
    form.append("file", { uri, name, type: "image/jpeg" } as any);
  }
  form.append("kind", kind);
  if (orderId) form.append("order_id", orderId);
  const headers: Record<string, string> = {};
  if (cachedToken) headers.Authorization = `Bearer ${cachedToken}`;
  const res = await fetch(`${BASE}/api/files`, { method: "POST", headers, body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Gagal mengunggah");
  return data as { id: string; kind: string };
}

export async function loadStoredToken() {
  const t = await storage.secureGet<string>(TOKEN_KEY, "");
  cachedToken = t || null;
  return cachedToken;
}
