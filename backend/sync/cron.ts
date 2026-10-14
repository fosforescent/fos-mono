/** Opt-in runner for an always-on, single backend instance. State/claims live in the user's graph. */
export function startCronRunner(deps: {
  enabled: boolean
  users(after?: string): Promise<string[]>
  run(username: string): Promise<unknown>
  report?(error: unknown): void
}): (() => void) | null {
  if (!deps.enabled) return null
  let running = false, stopped = false
  const tick = async () => {
    if (running || stopped) return
    running = true
    try {
      let after: string | undefined
      while (!stopped) {
        const users = await deps.users(after)
        if (!users.length) break
        for (const user of users) {
          if (stopped) break
          try { await deps.run(user) } catch (error) { (deps.report ?? console.error)(error) }
        }
        if (users.at(-1) === after) break
        after = users.at(-1)
      }
    } catch (error) { (deps.report ?? console.error)(error) }
    finally { running = false }
  }
  const timer = setInterval(() => void tick(), 30000)
  timer.unref?.()
  void tick()
  return () => { stopped = true; clearInterval(timer) }
}
