const USER_API_KEYS_STORAGE_KEY = "cap.userApiKeys.v1";
export const USER_API_KEYS_CHANGED_EVENT = "cap-user-api-keys-changed";

export type UserApiKeysScope = "session" | "local";

export type UserApiKeys = {
  groqApiKey: string;
  tavilyApiKey: string;
  remember: boolean;
  scope: UserApiKeysScope;
};

type UserApiKeysStored = {
  groqApiKey?: string;
  tavilyApiKey?: string;
  scope?: UserApiKeysScope;
};

const DEFAULT_USER_API_KEYS: UserApiKeys = {
  groqApiKey: "",
  tavilyApiKey: "",
  remember: false,
  scope: "session",
};

function parseStored(raw: string): UserApiKeysStored | null {
  try {
    const parsed = JSON.parse(raw) as UserApiKeysStored;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function dispatchChanged(): void {
  window.dispatchEvent(new Event(USER_API_KEYS_CHANGED_EVENT));
}

export function loadUserApiKeys(): UserApiKeys {
  const localRaw = window.localStorage.getItem(USER_API_KEYS_STORAGE_KEY);
  const sessionRaw = window.sessionStorage.getItem(USER_API_KEYS_STORAGE_KEY);
  const raw = localRaw ?? sessionRaw;
  if (!raw) return { ...DEFAULT_USER_API_KEYS };
  const parsed = parseStored(raw);
  if (!parsed) return { ...DEFAULT_USER_API_KEYS };
  return {
    groqApiKey: typeof parsed.groqApiKey === "string" ? parsed.groqApiKey : "",
    tavilyApiKey: typeof parsed.tavilyApiKey === "string" ? parsed.tavilyApiKey : "",
    remember: true,
    scope: localRaw ? "local" : parsed.scope === "local" ? "local" : "session",
  };
}

export function saveUserApiKeys(next: UserApiKeys): void {
  const payload: UserApiKeysStored = {
    groqApiKey: next.groqApiKey.trim(),
    tavilyApiKey: next.tavilyApiKey.trim(),
    scope: next.scope,
  };
  const json = JSON.stringify(payload);
  // Always keep keys active in the current browser session so API calls can use them immediately.
  // "Remember" controls whether they are also persisted beyond the current session.
  if (!next.remember) {
    window.sessionStorage.setItem(USER_API_KEYS_STORAGE_KEY, json);
    window.localStorage.removeItem(USER_API_KEYS_STORAGE_KEY);
    return;
  }
  if (next.scope === "local") {
    window.localStorage.setItem(USER_API_KEYS_STORAGE_KEY, json);
    window.sessionStorage.removeItem(USER_API_KEYS_STORAGE_KEY);
  } else {
    window.sessionStorage.setItem(USER_API_KEYS_STORAGE_KEY, json);
    window.localStorage.removeItem(USER_API_KEYS_STORAGE_KEY);
  }
}

export function clearUserApiKeys(): void {
  window.localStorage.removeItem(USER_API_KEYS_STORAGE_KEY);
  window.sessionStorage.removeItem(USER_API_KEYS_STORAGE_KEY);
  dispatchChanged();
}

export function getUserApiKeyHeaders(): Record<string, string> {
  const { groqApiKey, tavilyApiKey } = loadUserApiKeys();
  const headers: Record<string, string> = {};
  if (groqApiKey.trim()) headers["X-User-Groq-Api-Key"] = groqApiKey.trim();
  if (tavilyApiKey.trim()) headers["X-User-Tavily-Api-Key"] = tavilyApiKey.trim();
  return headers;
}
