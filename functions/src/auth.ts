import { parse, validate } from "@tma.js/init-data-node";

export interface AuthResult {
  userId: number;
  isOwner: boolean;
}

/**
 * Проверяет Telegram initData из заголовка `Authorization: tma <initData>` (§5 плана).
 *
 * Возвращает null, если заголовка нет, формат неверный, подпись не прошла проверку
 * или initData протухла (стандартные 24ч из `validate`, см. spec/stage-1-workouts.md).
 * Не бросает исключения — вызывающий код (index.ts) сам решает, что делать: `whoami`
 * можно вызывать анонимно, остальные actions при null обязаны вернуть 403.
 */
export function verifyInitData(
  authHeader: string | undefined,
  botToken: string,
  ownerId: number
): AuthResult | null {
  if (!authHeader || !authHeader.startsWith("tma ")) {
    return null;
  }
  const raw = authHeader.slice("tma ".length);

  try {
    validate(raw, botToken);
  } catch {
    return null;
  }

  const initData = parse(raw);
  if (!initData.user) {
    return null;
  }

  return {
    userId: initData.user.id,
    isOwner: initData.user.id === ownerId,
  };
}
