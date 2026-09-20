/** Ошибка actions с явным HTTP-статусом — index.ts ловит её и формирует ответ. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}
