type LoginResponse = {
  access_token?: string
  error?: string
  [key: string]: unknown
}

const defaults = {
  baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:4000',
  username: import.meta.env.VITE_API_USERNAME ?? 'user1@fosforescent.com',
  password: import.meta.env.VITE_API_PASSWORD ?? 'user123'
} as const

const getOrSetLocalStorage = (key: string, defaultValue: string): string => {
  try {
    const existing = window.localStorage.getItem(key)
    if (existing && existing.trim().length > 0) {
      return existing
    }
    window.localStorage.setItem(key, defaultValue)
    return defaultValue
  } catch (error) {
    console.warn(`Unable to access localStorage for ${key}:`, error)
    return defaultValue
  }
}

const apiBaseUrl = getOrSetLocalStorage('web-mini.api-url', defaults.baseUrl)
const credentials: { username: string; password: string } = {
  username: getOrSetLocalStorage('web-mini.username', defaults.username),
  password: getOrSetLocalStorage('web-mini.password', defaults.password)
}

const output = document.createElement('pre')
output.style.whiteSpace = 'pre-wrap'
output.style.fontFamily = 'monospace'
output.textContent = 'Logging in…'
document.body.replaceChildren(output)

async function loginAndDisplay(): Promise<void> {
  try {
    const response = await fetch(`${apiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(credentials)
    })

    const data: LoginResponse = await response.json()

    if (!response.ok) {
      throw new Error(data?.error ?? `Login failed with status ${response.status}`)
    }

    output.textContent = JSON.stringify(data, null, 2)
  } catch (error) {
    output.textContent = `Login failed:\n${error instanceof Error ? error.message : String(error)}`
  }
}

loginAndDisplay()
