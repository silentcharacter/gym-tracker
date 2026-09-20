import type { AuthResult } from "../auth";

/** Единственный action, доступный анонимно — режим «только чтение» на клиенте определяется им. */
export function whoami(auth: AuthResult | null): { isOwner: boolean } {
  return { isOwner: auth?.isOwner ?? false };
}
