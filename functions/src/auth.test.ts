import { sign } from "@tma.js/init-data-node";
import { describe, expect, it } from "vitest";
import { verifyInitData } from "./auth";

const BOT_TOKEN = "123456:TEST-TOKEN";
const OWNER_ID = 289244058;
const OTHER_ID = 999999999;

function signedHeader(userId: number, authDate = new Date()): string {
  const raw = sign({ user: { id: userId, first_name: "Test" } }, BOT_TOKEN, authDate);
  return `tma ${raw}`;
}

describe("verifyInitData", () => {
  it("валидная подпись + user.id владельца → isOwner: true", () => {
    const result = verifyInitData(signedHeader(OWNER_ID), BOT_TOKEN, OWNER_ID);
    expect(result).toEqual({ userId: OWNER_ID, isOwner: true });
  });

  it("валидная подпись, но чужой user.id → isOwner: false (не null — initData валидна)", () => {
    const result = verifyInitData(signedHeader(OTHER_ID), BOT_TOKEN, OWNER_ID);
    expect(result).toEqual({ userId: OTHER_ID, isOwner: false });
  });

  it("подделанная подпись → null", () => {
    const header = signedHeader(OWNER_ID);
    const tampered = header.replace(/hash=[0-9a-f]+$/, "hash=deadbeef");
    expect(verifyInitData(tampered, BOT_TOKEN, OWNER_ID)).toBeNull();
  });

  it("протухший auth_date (> 24ч) → null", () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    expect(verifyInitData(signedHeader(OWNER_ID, old), BOT_TOKEN, OWNER_ID)).toBeNull();
  });

  it("заголовок отсутствует → null", () => {
    expect(verifyInitData(undefined, BOT_TOKEN, OWNER_ID)).toBeNull();
  });

  it("заголовок без префикса 'tma ' → null", () => {
    const raw = signedHeader(OWNER_ID).slice("tma ".length);
    expect(verifyInitData(raw, BOT_TOKEN, OWNER_ID)).toBeNull();
  });

  it("подписано другим токеном → null", () => {
    const header = `tma ${sign({ user: { id: OWNER_ID, first_name: "Test" } }, "wrong-token", new Date())}`;
    expect(verifyInitData(header, BOT_TOKEN, OWNER_ID)).toBeNull();
  });
});
