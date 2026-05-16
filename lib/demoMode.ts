export function isMockMode(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCK === 'true'
}
