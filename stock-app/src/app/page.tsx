import Link from "next/link";

import {
	formatCurrency,
	formatCurrencyDelta,
	formatDate,
	formatDateTime,
	formatPercent,
} from "~/lib/formatters";
import {
	type StockQuote,
	type SupportedTicker,
	AlphaVantageError,
	SUPPORTED_TICKERS,
	getGlobalQuote,
} from "~/server/alphaVantage";

type StockCardData = {
	symbol: SupportedTicker;
	quote: StockQuote | null;
	cachedAt: string | null;
	error: string | null;
};

const extractErrorMessage = (error: unknown) => {
	if (error instanceof AlphaVantageError) {
		return error.message;
	}

	if (error instanceof Error) {
		return error.message;
	}

	return "Quote unavailable right now.";
};

const loadQuotes = async (): Promise<StockCardData[]> => {
	const results = await Promise.allSettled(
		SUPPORTED_TICKERS.map((symbol) => getGlobalQuote(symbol)),
	);

	return results.map((result, index) => {
		const symbol = SUPPORTED_TICKERS[index] as SupportedTicker;

		if (result.status === "fulfilled") {
			const { data, cachedAt } = result.value;

			return {
				symbol,
				quote: data,
				cachedAt,
				error: null,
			};
		}

		return {
			symbol,
			quote: null,
			cachedAt: null,
			error: extractErrorMessage(result.reason),
		};
	});
};

const StockCard = ({ symbol, quote, cachedAt, error }: StockCardData) => {
	const isUp = quote ? quote.change >= 0 : false;
	const accentColor = isUp ? "emerald" : "rose";
	const accentText =
		accentColor === "emerald" ? "text-emerald-300" : "text-rose-300";
	const accentBg =
		accentColor === "emerald"
			? "group-hover:border-emerald-400/40 group-hover:shadow-emerald-500/20"
			: "group-hover:border-rose-400/40 group-hover:shadow-rose-500/20";

	return (
		<Link
			href={`/stocks/${symbol}`}
			className={`group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg shadow-slate-900/40 transition duration-200 hover:-translate-y-1 hover:bg-slate-900 ${accentBg}`}
			title={
				cachedAt
					? `Last updated ${formatDateTime(cachedAt)}`
					: undefined
			}
		>
			<div className="flex items-center justify-between">
				<p className="text-xs uppercase tracking-[0.35em] text-slate-500">
					Ticker
				</p>
				{quote ? (
					<span className="rounded-full bg-slate-800/80 px-3 py-1 text-xs text-slate-300">
						{formatDate(quote.latestTradingDay)}
					</span>
				) : null}
			</div>
			<div className="mt-6">
				<h2 className="text-3xl font-semibold tracking-tight text-white">
					{symbol}
				</h2>
				{quote ? (
					<>
						<p className="mt-4 text-4xl font-bold tracking-tight text-white">
							{formatCurrency(quote.price)}
						</p>
						<p className={`mt-3 flex items-center gap-2 text-sm ${accentText}`}>
							<span className="font-medium">
								{formatCurrencyDelta(quote.change)}
							</span>
							<span>{formatPercent(quote.changePercent)}</span>
						</p>
					</>
				) : (
					<p className="mt-4 text-sm text-slate-400">{error}</p>
				)}
			</div>
			<p className="mt-8 text-sm text-slate-500 transition-colors group-hover:text-slate-300">
				View detailed chart &gt;
			</p>
		</Link>
	);
};

export default async function Home() {
	const cards = await loadQuotes();
	const hasError = cards.some((card) => card.error);

	return (
		<main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100 sm:px-6 lg:px-10">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-12">
				<header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
					<div className="max-w-2xl space-y-4">
						<p className="text-xs uppercase tracking-[0.5em] text-emerald-300/80">
							Watchlist
						</p>
						<h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
							Curated tickers, refreshed daily.
						</h1>
						<p className="text-sm text-slate-400 sm:text-base">
							Explore live pricing for a hand-picked list of equities. Each card
							links to a dedicated page with historical performance and deeper
							market stats. All data comes from Alpha Vantage and is cached
							server-side to stay within the daily request limits.
						</p>
					</div>
					<p className="text-xs text-slate-500">
						Cached for 24 hours · Alpha Vantage free tier
					</p>
				</header>

				{hasError ? (
					<p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
						Some quotes are temporarily unavailable. Cached values will appear
						once Alpha Vantage refreshes.
					</p>
				) : null}

				<section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
					{cards.map((card) => (
						<StockCard
							key={card.symbol}
							symbol={card.symbol}
							quote={card.quote}
							cachedAt={card.cachedAt}
							error={card.error}
						/>
					))}
				</section>
			</div>
		</main>
	);
}
