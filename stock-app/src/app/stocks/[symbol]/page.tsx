import Link from "next/link";
import { notFound } from "next/navigation";
import millify from "millify";

import {
	type DailySeriesPoint,
	type StockQuote,
	type SupportedTicker,
	type CompanyOverview,
	AlphaVantageError,
	SUPPORTED_TICKERS,
	getCompanyOverview,
	getDailySeries,
	getGlobalQuote,
} from "~/server/alphaVantage";
import { DailyCloseChart } from "../_components/daily-close-chart";
import {
	formatCurrency,
	formatCurrencyDelta,
	formatDate,
	formatPercent,
	formatVolume,
	formatRelativeTime,
} from "~/lib/formatters";

type RouteParams = {
	symbol?: string;
};

type PageProps = {
	params: Promise<RouteParams>;
};

type HistoricalRow = {
	date: string;
	close: number;
	volume: number | null;
	changePercent: number | null;
};

const MAX_CHART_POINTS = 90;

const toDisplayText = (value: string | null | undefined): string => {
	if (typeof value !== "string" || value.trim().length === 0) {
		return "N/A";
	}

	return value.trim();
};

const formatMarketCap = (value: number | null | undefined): string => {
	if (value === undefined || value === null) {
		return "N/A";
	}

	return `$${millify(value, { precision: 2, lowercase: false })}`;
};

const buildHistoricalRows = (
	series: DailySeriesPoint[],
): HistoricalRow[] => {
	return series
		.map((point, index) => {
			const previous = index > 0 ? series[index - 1] : null;
			const previousClose = previous?.close ?? null;
			const hasPrevious = previousClose !== null && previousClose !== 0;
			const changePercent = hasPrevious
				? ((point.close - previousClose) / previousClose) * 100
				: null;

			return {
				date: point.date,
				close: point.close,
				volume: point.volume,
				changePercent,
			};
		})
		.reverse();
};

const getUpdatedMessage = (timestamp: string | null): string | null => {
	const relative = formatRelativeTime(timestamp);
	if (!relative) {
		return null;
	}

	return relative === "just now" ? "Updated just now" : `Updated ${relative} ago`;
};

const CacheIndicator = ({ message }: { message: string | null }) => {
	if (!message) {
		return null;
	}

	return (
		<div className="absolute right-4 top-4">
			<div className="group/cached relative">
				<span className="cursor-help rounded-full bg-slate-800/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
					Cached
				</span>
				<div className="pointer-events-none absolute right-0 top-full z-20 mt-2 hidden whitespace-nowrap rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 shadow-xl group-hover/cached:block">
					{message}
				</div>
			</div>
		</div>
	);
};

const fetchStockData = async (symbol: SupportedTicker) => {
	const [quoteResult, seriesResult, overviewResult] =
		await Promise.allSettled([
			getGlobalQuote(symbol),
			getDailySeries(symbol),
			getCompanyOverview(symbol),
		]);

	const quoteData =
		quoteResult.status === "fulfilled" ? quoteResult.value : null;
	const seriesData =
		seriesResult.status === "fulfilled" ? seriesResult.value : null;
	const overviewData =
		overviewResult.status === "fulfilled" ? overviewResult.value : null;

	const criticalError =
		quoteResult.status === "rejected"
			? quoteResult.reason
			: seriesResult.status === "rejected"
				? seriesResult.reason
				: null;

	return {
		quote: quoteData?.data ?? null,
		quoteCachedAt: quoteData?.cachedAt ?? null,
		series: seriesData?.data ?? [],
		seriesCachedAt: seriesData?.cachedAt ?? null,
		overview: overviewData?.data ?? null,
		overviewCachedAt: overviewData?.cachedAt ?? null,
		overviewError:
			overviewResult.status === "rejected"
				? overviewResult.reason
				: null,
		error: criticalError,
	};
};

export const generateStaticParams = () =>
	SUPPORTED_TICKERS.map((symbol) => ({ symbol }));

export const dynamicParams = false;

export const generateMetadata = async ({ params }: PageProps) => {
	const resolvedParams = await params;
	const rawSymbol = resolvedParams.symbol ?? "";
	const symbol = rawSymbol.toUpperCase();

	if (!SUPPORTED_TICKERS.includes(symbol as SupportedTicker)) {
		return {
			title: "Stock Not Found",
		};
	}

	return {
		title: `${symbol} Stock Overview`,
		description: `Chart and pricing details for ${symbol}.`,
	};
};

const getErrorMessage = (error: unknown) => {
	if (error instanceof AlphaVantageError) {
		return error.message;
	}

	if (error instanceof Error) {
		return error.message;
	}

	return "An unexpected error occurred while loading stock data.";
};

const StatsGrid = ({ quote }: { quote: StockQuote }) => {
	const stats = [
		{ label: "Open", value: formatCurrency(quote.open) },
		{ label: "High", value: formatCurrency(quote.high) },
		{ label: "Low", value: formatCurrency(quote.low) },
		{ label: "Previous Close", value: formatCurrency(quote.previousClose) },
		{ label: "Change", value: formatCurrencyDelta(quote.change) },
		{ label: "Change %", value: formatPercent(quote.changePercent) },
		{ label: "Latest Trading Day", value: formatDate(quote.latestTradingDay) },
		{ label: "Volume", value: formatVolume(quote.volume) },
	];

	return (
		<div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
			{stats.map((item) => (
				<div
					key={item.label}
					className="rounded-lg border border-slate-800 bg-slate-900/80 p-4"
				>
					<p className="text-slate-400">{item.label}</p>
					<p className="mt-1 text-lg font-semibold text-slate-100">
						{item.value}
					</p>
				</div>
			))}
		</div>
	);
};

const CompanyOverviewSection = ({
	overview,
	cacheMessage,
	error,
}: {
	overview: CompanyOverview | null;
	cacheMessage: string | null;
	error: unknown;
}) => {
	if (!overview) {
		const message = error
			? getErrorMessage(error)
			: "Company overview data is currently unavailable.";
		return (
			<div className="relative">
				<section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl shadow-slate-900/40">
					<h2 className="text-xl font-semibold tracking-tight text-slate-100">
						Company Overview
					</h2>
					<p className="mt-3 text-sm text-slate-400">{message}</p>
				</section>
				<CacheIndicator message={cacheMessage} />
			</div>
		);
	}

	const description = toDisplayText(overview.description);
	const items = [
		{ label: "Symbol", value: overview.symbol },
		{ label: "Asset Type", value: toDisplayText(overview.assetType) },
		{ label: "Name", value: toDisplayText(overview.name) },
		{ label: "Exchange", value: toDisplayText(overview.exchange) },
		{ label: "Sector", value: toDisplayText(overview.sector) },
		{ label: "Industry", value: toDisplayText(overview.industry) },
		{
			label: "Market Capitalization",
			value: formatMarketCap(overview.marketCapitalization),
		},
	] as const;

	return (
		<div className="relative">
			<section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl shadow-slate-900/40">
				<h2 className="text-xl font-semibold tracking-tight text-slate-100">
					Company Overview
				</h2>
				<dl className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
					<div className="sm:col-span-2 lg:col-span-3">
						<dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
							Description
						</dt>
						<dd className="mt-2 leading-6 text-slate-100">{description}</dd>
					</div>
					{items.map((item) => (
						<div
							key={item.label}
							className="rounded-2xl border border-slate-800/70 bg-slate-950/60 p-4"
						>
							<dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
								{item.label}
							</dt>
							<dd className="mt-1 text-slate-100">{item.value}</dd>
						</div>
					))}
				</dl>
			</section>
			<CacheIndicator message={cacheMessage} />
		</div>
	);
};

const HistoricalPricesTable = ({ rows }: { rows: HistoricalRow[] }) => {
	if (rows.length === 0) {
		return (
			<p className="text-sm text-slate-400">
				Historical price data is unavailable.
			</p>
		);
	}

	return (
		<div className="overflow-x-auto">
			<table className="min-w-full divide-y divide-slate-800 text-left text-xs text-slate-100">
				<thead className="bg-slate-900/60 text-[0.65rem] uppercase tracking-wide text-slate-400">
					<tr>
						<th className="px-3 py-2 font-medium">Date</th>
						<th className="px-3 py-2 font-medium">Close</th>
						<th className="px-3 py-2 font-medium">Volume</th>
						<th className="px-3 py-2 font-medium">Daily Change</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => {
						const changeValue =
							row.changePercent !== null
								? formatPercent(row.changePercent)
								: "N/A";
						const isPositive =
							row.changePercent !== null && row.changePercent > 0;
						const isNegative =
							row.changePercent !== null && row.changePercent < 0;
						const changeColor = isPositive
							? "text-emerald-300"
							: isNegative
								? "text-rose-300"
								: "text-slate-300";
						const changeIcon = isPositive ? "^" : isNegative ? "v" : "-";

						return (
							<tr
								key={row.date}
								className="border-t border-slate-800/60 even:bg-slate-900/40"
							>
								<td className="px-3 py-2 text-slate-300">
									{formatDate(row.date)}
								</td>
								<td className="px-3 py-2 font-medium text-slate-100">
									{formatCurrency(row.close)}
								</td>
								<td className="px-3 py-2 text-slate-300">
									{row.volume !== null
										? formatVolume(row.volume)
										: "N/A"}
								</td>
								<td className="px-3 py-2">
									<span
										className={`inline-flex items-center gap-1 font-medium ${changeColor}`}
									>
										<span aria-hidden>{changeIcon}</span>
										<span>{changeValue}</span>
										{isPositive ? (
											<span className="sr-only">
												Increase from previous day
											</span>
										) : null}
										{isNegative ? (
											<span className="sr-only">
												Decrease from previous day
											</span>
										) : null}
									</span>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
};

export default async function StockDetailPage({ params }: PageProps) {
	const resolvedParams = await params;
	const symbolParam = resolvedParams.symbol?.toUpperCase() ?? "";

	if (!SUPPORTED_TICKERS.includes(symbolParam as SupportedTicker)) {
		notFound();
	}

	const symbol = symbolParam as SupportedTicker;
	const {
		quote,
		quoteCachedAt,
		series,
		seriesCachedAt,
		overview,
		overviewCachedAt,
		overviewError,
		error,
	} = await fetchStockData(symbol);

	const chartSeries = series.slice(-MAX_CHART_POINTS);
	const historicalRows = buildHistoricalRows(series);
	const firstPoint = chartSeries[0];
	const lastPoint = chartSeries[chartSeries.length - 1];

	const formattedError = error ? getErrorMessage(error) : null;
	const quoteUpdatedMessage = getUpdatedMessage(quoteCachedAt);
	const seriesUpdatedMessage = getUpdatedMessage(seriesCachedAt);
	const overviewUpdatedMessage = getUpdatedMessage(overviewCachedAt);

	return (
		<main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
				<nav className="flex items-center justify-between">
					<Link
						href="/"
						className="text-sm text-slate-400 transition hover:text-slate-200"
					>
						{"< Back to overview"}
					</Link>
					<p className="text-xs text-slate-500">
						Data from Alpha Vantage (cached for 24h)
					</p>
				</nav>

				<div className="relative">
					<section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl shadow-slate-900/40">
						<header className="flex flex-wrap items-baseline justify-between gap-4">
							<div>
								<h1 className="text-4xl font-semibold tracking-tight">
									{symbol}
								</h1>
								{quote ? (
									<p className="text-sm text-slate-400">
										As of {formatDate(quote.latestTradingDay)}
									</p>
								) : null}
							</div>
							{quote ? (
								<div className="flex flex-wrap items-end gap-3">
									<p className="text-5xl font-bold tracking-tight">
										{formatCurrency(quote.price)}
									</p>
									<div
										className={`rounded-full px-3 py-1 text-sm font-medium ${
											quote.change >= 0
												? "bg-emerald-500/10 text-emerald-300"
												: "bg-rose-500/10 text-rose-300"
										}`}
									>
										{formatCurrencyDelta(quote.change)} (
										{formatPercent(quote.changePercent)})
									</div>
								</div>
							) : null}
						</header>

						{formattedError ? (
							<p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
								{formattedError}
							</p>
						) : null}

						{quote ? <StatsGrid quote={quote} /> : null}
					</section>
					<CacheIndicator message={quoteUpdatedMessage} />
				</div>

				<div className="relative">
					<section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl shadow-slate-900/40">
						<div className="flex items-baseline justify-between gap-3">
							<h2 className="text-xl font-semibold tracking-tight text-slate-100">
								Daily Close (Last {chartSeries.length} Days)
							</h2>
							{firstPoint && lastPoint ? (
								<p className="text-xs text-slate-400">
									{formatDate(firstPoint.date)} - {formatDate(lastPoint.date)}
								</p>
							) : null}
						</div>

						<div className="mt-6">
							<DailyCloseChart
								symbol={symbol}
								series={chartSeries}
								lastUpdatedMessage={seriesUpdatedMessage}
							/>
						</div>
					</section>
				</div>

				<CompanyOverviewSection
					overview={overview}
					cacheMessage={overviewUpdatedMessage}
					error={overviewError}
				/>

				<div className="relative">
					<section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl shadow-slate-900/40">
						<div className="flex items-baseline justify-between gap-3">
							<h2 className="text-xl font-semibold tracking-tight text-slate-100">
								Historical Prices
							</h2>
							{historicalRows.length > 0 ? (
								<p className="text-xs text-slate-400">
									Derived from Alpha Vantage TIME_SERIES_DAILY data
								</p>
							) : null}
						</div>
						<div className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60 p-2">
							<HistoricalPricesTable rows={historicalRows} />
						</div>
					</section>
					<CacheIndicator message={seriesUpdatedMessage} />
				</div>
			</div>
		</main>
	);
}



