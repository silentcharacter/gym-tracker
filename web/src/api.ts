import { getWebApp } from "./telegram";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Единая точка входа в Cloud Function `api` (§6 плана). Кладёт initData в заголовок,
 * если приложение открыто в Telegram; вне Telegram запрос уйдёт без Authorization —
 * сервер ответит { isOwner: false } на whoami и 403 на остальные actions.
 */
export async function postApi<T = unknown>(action: string, payload: unknown = {}): Promise<T> {
  const initData = getWebApp()?.initData;

  const res = await fetch("/api", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(initData ? { Authorization: `tma ${initData}` } : {}),
    },
    body: JSON.stringify({ action, payload }),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? res.statusText);
  }
  return body as T;
}
