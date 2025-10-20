import { z } from 'zod'

import { ENV, shouldUseMocks } from '@/config/env'
import {
  STOCK_TICKERS,
  companyOverviewBySymbol,
  companyOverviewSchema,
  timeSeriesDailyBySymbol,
  timeSeriesEntrySchema,
  type CompanyOverview,
  type DailyPrice,
  type StockTicker,
} from '@/data/mockStockData'

const alphaOverviewSchema = z
  .object({
    Symbol: z.string(),
    AssetType: z.string().optional(),
    Name: z.string().optional(),
    Description: z.string().optional(),
    Exchange: z.string().optional(),
    Sector: z.string().optional(),
    Industry: z.string().optional(),
    MarketCapitalization: z.string().optional(),
  })
  .passthrough()

const alphaDailySeriesSchema = z.object({
  'Time Series (Daily)': z
    .record(
      z.string(),
      z.object({
        '4. close': z.string(),
        '5. volume': z.string(),
      }),
    )
    .optional(),
})

type FetchFallBack<T> = {
  data: T
  source: 'api' | 'mock'
}

const DAY_IN_MS = ENV.cacheMaxAgeMs

async function fetchWithRateLimitGuard(url: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`AlphaVantage request failed: ${response.status} ${response.statusText}`)
  }
  const json = (await response.json()) as Record<string, unknown>

  if ('Note' in json || 'Information' in json || 'Error Message' in json) {
    throw new Error(
      typeof json.Note === 'string'
        ? json.Note
        : typeof json.Information === 'string'
          ? json.Information
          : typeof json['Error Message'] === 'string'
            ? json['Error Message']
            : 'AlphaVantage rate limit or error',
    )
  }

  return json
}

function parseCompanyOverview(data: unknown): CompanyOverview {
  const parsed = alphaOverviewSchema.parse(data)

  return companyOverviewSchema.parse({
    symbol: parsed.Symbol,
    assetType: parsed.AssetType,
    name: parsed.Name,
    description: parsed.Description,
    exchange: parsed.Exchange,
    sector: parsed.Sector,
    industry: parsed.Industry,
    marketCapitalization: parsed.MarketCapitalization,
  })
}

function parseTimeSeriesDaily(data: unknown): DailyPrice[] {
  const parsed = alphaDailySeriesSchema.parse(data)
  const series = parsed['Time Series (Daily)']
  if (!series) {
    throw new Error('AlphaVantage response missing time series data')
  }

  const entries = Object.entries(series).map(([date, values]) => ({
    date,
    close: Number.parseFloat(values['4. close']),
    volume: Number.parseInt(values['5. volume'], 10),
  }))

  const validEntries = entries.filter(
    (entry) => Number.isFinite(entry.close) && Number.isFinite(entry.volume),
  )

  const sorted = validEntries.sort((a, b) => (a.date > b.date ? -1 : 1))

  return timeSeriesEntrySchema.array().parse(sorted)
}

async function getCompanyOverviewFromApi(symbol: StockTicker): Promise<CompanyOverview> {
  const url = buildAlphaVantageUrl({
    functionName: 'OVERVIEW',
    symbol,
  })

  const data = await fetchWithRateLimitGuard(url)
  return parseCompanyOverview(data)
}

async function getDailySeriesFromApi(symbol: StockTicker): Promise<DailyPrice[]> {
  const url = buildAlphaVantageUrl({
    functionName: 'TIME_SERIES_DAILY',
    symbol,
  })

  const data = await fetchWithRateLimitGuard(url)
  return parseTimeSeriesDaily(data)
}

function buildAlphaVantageUrl({
  functionName,
  symbol,
}: {
  functionName: 'OVERVIEW' | 'TIME_SERIES_DAILY'
  symbol: StockTicker
}) {
  const key = ENV.alphaVantageApiKey
  const query = new URLSearchParams({
    function: functionName,
    symbol,
    apikey: key,
  })

  return `https://www.alphavantage.co/query?${query.toString()}`
}

function getMockOverview(symbol: StockTicker): CompanyOverview {
  return companyOverviewBySymbol[symbol]
}

function getMockDailySeries(symbol: StockTicker): DailyPrice[] {
  return timeSeriesDailyBySymbol[symbol]
}

async function withMockFallback<T>(
  symbol: StockTicker,
  fetcher: () => Promise<T>,
  mockProvider: () => T,
) {
  if (shouldUseMocks()) {
    return { data: mockProvider(), source: 'mock' } satisfies FetchFallBack<T>
  }

  try {
    const data = await fetcher()
    return { data, source: 'api' } satisfies FetchFallBack<T>
  } catch (error) {
    console.warn(
      `[AlphaVantage] Falling back to mock data for ${symbol}. Reason: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    )
    return { data: mockProvider(), source: 'mock' } satisfies FetchFallBack<T>
  }
}

export const companyOverviewQueryOptions = (symbol: StockTicker) => ({
  queryKey: ['companyOverview', symbol] as const,
  queryFn: async () => {
    const result = await withMockFallback(symbol, () => getCompanyOverviewFromApi(symbol), () =>
      getMockOverview(symbol),
    )
    return result.data
  },
  staleTime: DAY_IN_MS,
  gcTime: DAY_IN_MS,
})

export const dailySeriesQueryOptions = (symbol: StockTicker) => ({
  queryKey: ['dailySeries', symbol] as const,
  queryFn: async () => {
    const result = await withMockFallback(symbol, () => getDailySeriesFromApi(symbol), () =>
      getMockDailySeries(symbol),
    )
    return result.data
  },
  staleTime: DAY_IN_MS,
  gcTime: DAY_IN_MS,
})

export const validSymbols = STOCK_TICKERS
