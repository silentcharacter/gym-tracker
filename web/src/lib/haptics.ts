import { getWebApp } from "../telegram";

// Тонкие обёртки над HapticFeedback — молча ничего не делают вне Telegram и на клиенте
// старше 6.1 (spec/stage-3-polish.md, «Проверенные факты»).
function haptic<T extends unknown[]>(fn: (h: NonNullable<ReturnType<typeof getWebApp>>["HapticFeedback"], ...args: T) => void) {
  return (...args: T) => {
    const webApp = getWebApp();
    if (!webApp?.isVersionAtLeast("6.1")) return;
    try {
      fn(webApp.HapticFeedback, ...args);
    } catch {
      // старый/нестандартный клиент — no-op
    }
  };
}

export const notifySuccess = haptic<[]>((h) => h.notificationOccurred("success"));
export const notifyError = haptic<[]>((h) => h.notificationOccurred("error"));
export const selectionChanged = haptic<[]>((h) => h.selectionChanged());
export const impactLight = haptic<[]>((h) => h.impactOccurred("light"));
