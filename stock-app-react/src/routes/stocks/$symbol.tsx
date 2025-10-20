import { Suspense } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { useSuspenseQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  companyOverviewQueryOptions,
  dailySeriesQueryOptions,
  validSymbols,
} from '@/data/alphaVantage'
import type { CompanyOverview, DailyPrice, StockTicker } from '@/data/mockStockData'
import type { RouterContext } from '@/lib/routerContext'

const paramsSchema = z.object({
  symbol: z.enum(validSymbols),
})

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat('en-US')

export const Route = createFileRoute('/stocks/$symbol')({
  params: {
    parse: (params) => paramsSchema.parse(params),
    stringify: ({ symbol }) => ({ symbol }),
  },
  loader: async ({ params, context }) => {
    const { queryClient, queryClientReady } = context as RouterContext
    await queryClientReady
    void queryClient
      .ensureQueryData(companyOverviewQueryOptions(params.symbol))
      .catch(() => undefined)
    void queryClient.ensureQueryData(dailySeriesQueryOptions(params.symbol)).catch(() => undefined)

    return {
      symbol: params.symbol as StockTicker,
    }
  },
  component: StockDetailPage,
})

function StockDetailPage() {
  const { symbol } = Route.useLoaderData() as { symbol: StockTicker }

  return (
    <main className="min-h-screen bg-neutral-50 py-10">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4">
        <Link to="/" className="text-sm text-neutral-500 hover:text-neutral-700">
          Back to watchlist
        </Link>

        <Suspense key={symbol} fallback={<StockDetailFallback />}>
          <StockDetailContent symbol={symbol} />
        </Suspense>
      </div>
    </main>
  )
}

function StockDetailContent({ symbol }: { symbol: StockTicker }) {
  const { data: overview } = useSuspenseQuery(companyOverviewQueryOptions(symbol))
  const { data: prices } = useSuspenseQuery(dailySeriesQueryOptions(symbol))

  const detailRows = buildDetailRows(symbol, overview)
  const priceRows = buildPriceRows(prices)

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-neutral-900">{symbol}</CardTitle>
          <p className="text-sm text-neutral-600">
            {formatText(overview?.name)} | {formatText(overview?.exchange)}
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-neutral-700">
            {formatText(overview?.description)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Company Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {detailRows.map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-1">
                <dt className="text-xs font-semibold uppercase text-neutral-500">{label}</dt>
                <dd className="text-sm text-neutral-900">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Price History</CardTitle>
          <p className="text-sm text-neutral-600">
            Data cached for 24 hours (AlphaVantage with mock fallback)
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col divide-y divide-neutral-200">
            {priceRows.map(({ date, close, volume, percentChange }) => (
              <div key={date} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-900">{formatDate(date)}</p>
                  <p className="text-xs text-neutral-500">Volume: {formatVolume(volume)}</p>
                </div>
                <div className="flex flex-col gap-1 text-sm sm:text-right">
                  <span>{formatCurrency(close)}</span>
                  <span className={percentChangeIndicator(percentChange)}>
                    {formatPercentChange(percentChange)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  )
}

function StockDetailFallback() {
  return (
    <div className="flex flex-col gap-6">
      <Card className="animate-pulse bg-neutral-100">
        <CardHeader>
          <CardTitle className="text-2xl text-neutral-400">Loading stock data...</CardTitle>
          <p className="text-sm text-neutral-400">Fetching AlphaVantage resources</p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-400">This should only take a moment.</p>
        </CardContent>
      </Card>
    </div>
  )
}

function buildDetailRows(symbol: StockTicker, overview: CompanyOverview | undefined) {
  return [
    { label: 'Symbol', value: formatText(overview?.symbol ?? symbol) },
    { label: 'Asset Type', value: formatText(overview?.assetType) },
    { label: 'Name', value: formatText(overview?.name) },
    { label: 'Exchange', value: formatText(overview?.exchange) },
    { label: 'Sector', value: formatText(overview?.sector) },
    { label: 'Industry', value: formatText(overview?.industry) },
    { label: 'Market Capitalization', value: formatMarketCap(overview?.marketCapitalization) },
  ]
}

function buildPriceRows(prices: DailyPrice[]) {
  return prices.map((entry, index) => {
    const previous = prices[index + 1]
    const percentChange =
      previous && previous.close !== 0
        ? ((entry.close - previous.close) / previous.close) * 100
        : null

    return {
      ...entry,
      percentChange,
    }
  })
}

function formatText(value: string | undefined) {
  if (!value || value.trim().length === 0) {
    return 'N/A'
  }
  return value
}

function formatMarketCap(value: string | undefined) {
  if (!value || value.trim().length === 0) {
    return 'N/A'
  }

  const numeric = Number(value)
  if (Number.isFinite(numeric)) {
    return `$${numberFormatter.format(Math.round(numeric))}`
  }

  return value
}

function formatDate(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return dateFormatter.format(parsed)
}

function formatCurrency(value: number) {
  return currencyFormatter.format(value)
}

function formatVolume(value: number) {
  return numberFormatter.format(Math.round(value))
}

function formatPercentChange(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return 'N/A'
  }
  const formatted = value.toFixed(2)
  return `${value >= 0 ? '+' : ''}${formatted}%`
}

function percentChangeIndicator(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return 'text-neutral-500'
  }
  if (value > 0) {
    return 'text-emerald-600'
  }
  if (value < 0) {
    return 'text-red-600'
  }
  return 'text-neutral-600'
}
