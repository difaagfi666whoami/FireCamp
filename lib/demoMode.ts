export function isMockMode(): boolean {
  if (process.env.NEXT_PUBLIC_USE_MOCK === 'true') return true
  if (typeof window !== 'undefined') {
    return localStorage.getItem('campfire_demo_mode') === 'true'
  }
  return false
}

export function setDemoMode(enabled: boolean): void {
  if (enabled) {
    localStorage.setItem('campfire_demo_mode', 'true')
  } else {
    localStorage.removeItem('campfire_demo_mode')
  }
}
