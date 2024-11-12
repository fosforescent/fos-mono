import React, { useEffect } from "react"
import { AppState } from "./index"

import { ToastAction } from "@/components/ui/toast"
import { useToast } from "@/components/ui/use-toast"



export const useThemeEffects = (appState: AppState<any>, setAppState: React.Dispatch<React.SetStateAction<AppState<any>>>) => {
     

  const setTheme = React.useCallback((theme: string) => setAppState({...appState, theme }), [appState.theme, setAppState])

  const theme = appState.theme

  useEffect(() => {
    const root = document.querySelector('.viridian-root')
    if (!root) {
      throw new Error ('Root element does not exist in DOM')
    }

    root.classList.remove("light", "dark")

    if (appState.theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light"

      root.classList.add(systemTheme)
      return
    }

    root.classList.add(appState.theme)
    localStorage.setItem("theme", appState.theme)
  }, [appState.theme])


  return { theme, setTheme }
}




export const useInfoEffects = (appState: AppState<any>, setAppState: React.Dispatch<React.SetStateAction<AppState<any>>>) => {
  useEffect(() => {
    console.log("useInfoEffects", appState)


  }, [appState.info])
}