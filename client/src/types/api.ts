export class ApiError extends Error {
  status: number
  /** Code métier renvoyé par l'API : EMAIL_ALREADY_USED, CONVERSATION_CLOSED... */
  code?: string
  body: unknown

  constructor(status: number, body: unknown) {
    const b = body as { message?: string | string[]; code?: string } | null
    const message = Array.isArray(b?.message) ? b.message.join(', ') : b?.message
    super(message ?? `Erreur HTTP ${status}`)
    this.status = status
    this.code = b?.code
    this.body = body
  }
}