const DAY_IN_MS = 1000 * 60 * 60 * 24

const rawApiKey = import.meta.env.VITE_ALPHAVANTAGE_API_KEY
const rawUseMocks = import.meta.env.VITE_USE_MOCKS

export const ENV = {
  alphaVantageApiKey: typeof rawApiKey === 'string' ? rawApiKey.trim() : '',
  useMocks: rawUseMocks === 'true',
  cacheMaxAgeMs: DAY_IN_MS,
} as const

export const shouldUseMocks = () => ENV.useMocks || ENV.alphaVantageApiKey.length === 0
