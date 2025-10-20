import { z } from 'zod'

export const STOCK_TICKERS = [
  'CRWV',
  'NBIS',
  'WULF',
  'WYFI',
  'CRDO',
  'CXDO',
  'GEV',
  'SSSS',
  'FLEX',
  'CCOI',
  'GD',
  'CORZ',
  'IREN',
  'CIFR',
  'TSLA',
] as const

export type StockTicker = (typeof STOCK_TICKERS)[number]

export const companyOverviewSchema = z.object({
  symbol: z.string(),
  assetType: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  exchange: z.string().optional(),
  sector: z.string().optional(),
  industry: z.string().optional(),
  marketCapitalization: z.string().optional(),
})

export const timeSeriesEntrySchema = z.object({
  date: z.string(),
  close: z.number(),
  volume: z.number(),
})

type CompanyOverviewInput = z.infer<typeof companyOverviewSchema>
type DailyPriceInput = z.infer<typeof timeSeriesEntrySchema>

const sectors = ['Technology', 'Energy', 'Finance', 'Healthcare']
const industries = ['Software', 'Blockchain', 'Semiconductors', 'Biotech']

function createCompanyOverview(symbol: StockTicker, index: number): CompanyOverviewInput {
  const sector = sectors[index % sectors.length]
  const industry = index % 4 === 0 ? undefined : industries[index % industries.length]
  const exchange = index % 2 === 0 ? 'NASDAQ' : 'NYSE'

  return {
    symbol,
    assetType: 'Common Stock',
    name: `${symbol} Holdings`,
    description: `${symbol} is a mock company focused on ${sector.toLowerCase()} solutions.`,
    exchange,
    sector,
    industry,
    marketCapitalization: String(1_000_000_000 + index * 250_000_000),
  }
}

function createTimeSeries(symbol: StockTicker, index: number): DailyPriceInput[] {
  const basePrice = 30 + (symbol.charCodeAt(0) % 25) + index
  const baseVolume = 250_000 + index * 5_000

  const entries = Array.from({ length: 10 }).map((_, dayIndex) => {
    const date = new Date(Date.UTC(2024, 0, dayIndex + 1))
    const close = Number((basePrice + dayIndex * 1.25).toFixed(2))
    const volume = baseVolume + dayIndex * 12_500

    return {
      date: date.toISOString().slice(0, 10),
      close,
      volume,
    }
  })

  return entries.reverse()
}

const rawCompanyOverview: Record<StockTicker, CompanyOverviewInput> = Object.fromEntries(
  STOCK_TICKERS.map((symbol, index) => [symbol, createCompanyOverview(symbol, index)]),
) as Record<StockTicker, CompanyOverviewInput>

const rawTimeSeriesDaily: Record<StockTicker, DailyPriceInput[]> = Object.fromEntries(
  STOCK_TICKERS.map((symbol, index) => [symbol, createTimeSeries(symbol, index)]),
) as Record<StockTicker, DailyPriceInput[]>

export const companyOverviewBySymbol = z
  .record(z.string(), companyOverviewSchema)
  .parse(rawCompanyOverview) as Record<StockTicker, CompanyOverview>

export const timeSeriesDailyBySymbol = z
  .record(z.string(), z.array(timeSeriesEntrySchema))
  .parse(rawTimeSeriesDaily) as Record<StockTicker, DailyPrice[]>

export type CompanyOverview = z.infer<typeof companyOverviewSchema>
export type DailyPrice = z.infer<typeof timeSeriesEntrySchema>
