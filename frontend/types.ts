import { getGlobal } from "./App"

export type FosReactGlobal = ReturnType<typeof getGlobal>

export type FosReactOptions = Partial<{
  canPromptGPT: boolean,
  promptGPT: (systemPrompt: string, userPrompt: string, options?: { temperature?: number }) => Promise<{
    choices: { message: { content: string, role: string }, finishReason: string }[]
  }>,
  toast: (toastOpts: {
    title: string,
    description: string,
    duration: number
  }) => void,
  canUndo: boolean,
  undo: () => void,
  canRedo: boolean,
  redo: () => void,

  theme: "light" | "dark" | "system",
  locked: boolean
}>