import { Link, createFileRoute } from '@tanstack/react-router'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { STOCK_TICKERS, companyOverviewBySymbol } from '@/data/mockStockData'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <main className="min-h-screen bg-neutral-50 py-12">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4">
        <section className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-neutral-900">Stock Watchlist</h1>
          <p className="text-sm text-neutral-600">
            A simple shadcn view showing the tickers you asked for.
          </p>
        </section>
        <section className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {STOCK_TICKERS.map((ticker) => (
            <Link
              key={ticker}
              to="/stocks/$symbol"
              params={{ symbol: ticker }}
              className="block"
            >
              <Card className="transition-colors hover:border-neutral-300">
                <CardHeader>
                  <CardTitle>{ticker}</CardTitle>
                  <p className="text-sm text-neutral-600">
                    {companyOverviewBySymbol[ticker]?.name ?? 'N/A'}
                  </p>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </section>
      </div>
    </main>
  )
}
