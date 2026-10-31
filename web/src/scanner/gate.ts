/**
 * Turns a stream of decoded frames into deliberate actions. A code acts once
 * when it appears; to act again it must leave the view for `absentMs` and the
 * last action must be `cooldownMs` old. Two codes in view at once act on
 * neither, so a stack of cards can't lend the wrong one.
 */
export class PresentationGate {
  private seen = new Map<string, number>()
  private acted = new Map<string, number>()
  private readonly absentMs: number
  private readonly cooldownMs: number

  constructor(absentMs = 1500, cooldownMs = 3000) {
    this.absentMs = absentMs
    this.cooldownMs = cooldownMs
  }

  /** Feed the codes visible in one frame; returns the code to act on, if any. */
  observe(codes: string[], now: number): string | null {
    const visible = [...new Set(codes.filter(Boolean))]
    for (const [code, at] of this.seen) {
      if (now - at >= this.absentMs) this.seen.delete(code)
    }
    for (const [code, at] of this.acted) {
      if (now - at >= this.cooldownMs) this.acted.delete(code)
    }
    const fresh = visible.filter((c) => !this.seen.has(c) && !this.acted.has(c))
    for (const c of visible) this.seen.set(c, now)
    if (visible.length !== 1 || fresh.length !== 1) return null
    this.acted.set(fresh[0], now)
    return fresh[0]
  }
}
