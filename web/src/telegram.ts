// Обёртка над Telegram.WebApp. Началось в этапе 0 как минимальный набор полей,
// пополняется по мере необходимости (BackButton — этап 2, тема/haptics — этап 3).

export interface TelegramWebAppUser {
  id: number;
  first_name?: string;
  username?: string;
}

export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  button_color?: string;
  [key: string]: string | undefined;
}

interface TelegramBackButton {
  show: () => void;
  hide: () => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
}

interface TelegramHapticFeedback {
  impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
  notificationOccurred: (type: "error" | "success" | "warning") => void;
  selectionChanged: () => void;
}

type TelegramEventName = "themeChanged";

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: TelegramWebAppUser };
  themeParams: TelegramThemeParams;
  version: string;
  BackButton: TelegramBackButton;
  HapticFeedback: TelegramHapticFeedback;
  ready: () => void;
  expand: () => void;
  isVersionAtLeast: (version: string) => boolean;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  onEvent: (event: TelegramEventName, cb: () => void) => void;
  offEvent: (event: TelegramEventName, cb: () => void) => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

export function getWebApp(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp;
}

/**
 * Показывает BackButton с обработчиком на время жизни компонента (§8 «Навигация»).
 * Вызывать из useEffect с onBack в зависимостях; возвращает функцию очистки.
 */
export function bindBackButton(onBack: () => void): () => void {
  const backButton = getWebApp()?.BackButton;
  backButton?.show();
  backButton?.onClick(onBack);
  return () => {
    backButton?.offClick(onBack);
    backButton?.hide();
  };
}

/**
 * HapticFeedback, setHeaderColor и setBackgroundColor появились в Bot API 6.1 — на старом
 * клиенте вызов бросает исключение (spec/stage-3-polish.md, «Проверенные факты»).
 */
function hasApiSince(version: string): boolean {
  const webApp = getWebApp();
  return webApp !== undefined && webApp.isVersionAtLeast(version);
}

/** Подписка на смену темы; сами CSS-переменные Telegram обновляет сам (решение 4). */
export function onThemeChanged(cb: () => void): () => void {
  const webApp = getWebApp();
  webApp?.onEvent("themeChanged", cb);
  return () => webApp?.offEvent("themeChanged", cb);
}

export function setTelegramColors(): void {
  if (!hasApiSince("6.1")) return;
  try {
    getWebApp()!.setHeaderColor("secondary_bg_color");
    getWebApp()!.setBackgroundColor("bg_color");
  } catch {
    // старый клиент может не поддерживать конкретное значение — no-op
  }
}
