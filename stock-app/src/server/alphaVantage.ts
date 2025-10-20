import "server-only";

import { unstable_cache } from "next/cache";

import { readFromDiskCache, writeToDiskCache } from "./diskCache";

import { env } from "~/env";

export const SUPPORTED_TICKERS = [
	"CRWV",
	"NBIS",
	"WULF",
	"WYFI",
	"CRDO",
	"CXDO",
	"GEV",
	"SSSS",
	"FLEX",
	"CCOI",
	"GD",
	"CORZ",
	"IREN",
	"CIFR",
	"TSLA"
] as const;

export type SupportedTicker = (typeof SUPPORTED_TICKERS)[number];

export class AlphaVantageError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AlphaVantageError";
	}
}

const API_BASE_URL = "https://www.alphavantage.co/query";
const DAY_IN_SECONDS = 60 * 60 * 24;
const DISK_CACHE_TTL_MS = DAY_IN_SECONDS * 1000;

type AlphaVantagePayload = Record<string, unknown>;

const isPremiumEndpointMessage = (message: string): boolean =>
	message.toLowerCase().includes("premium endpoint");

export type CachedResult<T> = {
	data: T;
	cachedAt: string;
};

const fetchAlphaVantage = async (
	params: Record<string, string>,
): Promise<CachedResult<AlphaVantagePayload>> => {
	const sortedParams = Object.entries(params).sort(([a], [b]) =>
		a.localeCompare(b),
	);
	const cacheKey = `alpha-vantage:${JSON.stringify(sortedParams)}`;

	const cached = await readFromDiskCache<AlphaVantagePayload>(
		cacheKey,
		DISK_CACHE_TTL_MS,
	);

	let payload: AlphaVantagePayload;
	let cachedAt: string;

	if (cached) {
		payload = cached.data;
		cachedAt = new Date(cached.timestamp).toISOString();
	} else {
		const url = new URL(API_BASE_URL);
		const searchParams = new URLSearchParams({
			datatype: "json",
			apikey: env.ALPHA_VANTAGE_API_KEY,
			...params,
		});

		url.search = searchParams.toString();

		const response = await fetch(url.toString(), {
			method: "GET",
			headers: { Accept: "application/json" },
			cache: "no-store",
		});

		if (!response.ok) {
			throw new AlphaVantageError(
				`Alpha Vantage responded with ${response.status}: ${response.statusText}`,
			);
		}

		payload = (await response.json()) as AlphaVantagePayload;
		cachedAt = new Date().toISOString();
		await writeToDiskCache(cacheKey, payload);
	}

	if (typeof payload.Note === "string" && payload.Note.length > 0) {
		throw new AlphaVantageError(payload.Note);
	}

	const errorMessage = payload["Error Message"];
	if (typeof errorMessage === "string" && errorMessage.length > 0) {
		throw new AlphaVantageError(errorMessage);
	}

	const informationMessage = payload.Information;
	if (
		typeof informationMessage === "string" &&
		informationMessage.length > 0
	) {
		throw new AlphaVantageError(informationMessage);
	}

	return { data: payload, cachedAt };
};

const parseNumber = (value: string | undefined): number | null => {
	if (typeof value !== "string" || value.trim().length === 0) {
		return null;
	}

	const sanitized = value.replace(/,/g, "");
	const numeric = Number.parseFloat(sanitized);

	return Number.isFinite(numeric) ? numeric : null;
};

const parsePercent = (value: string | undefined): number | null => {
	if (typeof value !== "string") {
		return null;
	}

	return parseNumber(value.replace("%", ""));
};

const parseInteger = (value: string | undefined): number | null => {
	if (typeof value !== "string" || value.trim().length === 0) {
		return null;
	}

	const sanitized = value.replace(/,/g, "");
	const numeric = Number.parseInt(sanitized, 10);

	return Number.isFinite(numeric) ? numeric : null;
};

const parseNullableString = (value: string | undefined): string | null => {
	if (typeof value !== "string") {
		return null;
	}

	const trimmed = value.trim();
	return trimmed.length === 0 ? null : trimmed;
};

const requireNumber = (
	value: string | undefined,
	field: string,
	symbol: string,
): number => {
	const parsed = parseNumber(value);
	if (parsed === null) {
		throw new AlphaVantageError(
			`Missing numeric "${field}" in Alpha Vantage response for ${symbol}.`,
		);
	}

	return parsed;
};

const requireDate = (
	value: string | undefined,
	symbol: string,
): string => {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new AlphaVantageError(
			`Missing date value in Alpha Vantage response for ${symbol}.`,
		);
	}

	return value;
};

export type StockQuote = {
	symbol: SupportedTicker;
	open: number;
	high: number;
	low: number;
	price: number;
	previousClose: number;
	change: number;
	changePercent: number;
	latestTradingDay: string;
	volume: number | null;
};

const getGlobalQuoteInternal = async (
	symbol: SupportedTicker,
): Promise<CachedResult<StockQuote>> => {
	const { data: payload, cachedAt } = await fetchAlphaVantage({
		function: "GLOBAL_QUOTE",
		symbol,
	});

	const raw = payload["Global Quote"];

	if (!raw || typeof raw !== "object") {
		throw new AlphaVantageError(
			`Unexpected GLOBAL_QUOTE response shape for ${symbol}.`,
		);
	}

	const data = raw as Record<string, string | undefined>;

	const quote: StockQuote = {
		symbol,
		open: requireNumber(data["02. open"], "open", symbol),
		high: requireNumber(data["03. high"], "high", symbol),
		low: requireNumber(data["04. low"], "low", symbol),
		price: requireNumber(data["05. price"], "price", symbol),
		previousClose: requireNumber(
			data["08. previous close"],
			"previous close",
			symbol,
		),
		change: requireNumber(data["09. change"], "change", symbol),
		changePercent: (() => {
			const parsed = parsePercent(data["10. change percent"]);
			if (parsed === null) {
				throw new AlphaVantageError(
					`Missing change percent in Alpha Vantage response for ${symbol}.`,
				);
			}

			return parsed;
		})(),
		latestTradingDay: requireDate(data["07. latest trading day"], symbol),
		volume: parseInteger(data["06. volume"]),
	};

	return { data: quote, cachedAt };
};

export const getGlobalQuote = unstable_cache(
	getGlobalQuoteInternal,
	["alpha-vantage", "global-quote"],
	{ revalidate: DAY_IN_SECONDS },
);

export type CompanyOverview = {
	symbol: SupportedTicker;
	assetType: string | null;
	name: string | null;
	description: string | null;
	exchange: string | null;
	sector: string | null;
	industry: string | null;
	marketCapitalization: number | null;
};

const getCompanyOverviewInternal = async (
	symbol: SupportedTicker,
): Promise<CachedResult<CompanyOverview>> => {
	const { data: payload, cachedAt } = await fetchAlphaVantage({
		function: "OVERVIEW",
		symbol,
	});

	if (!payload || typeof payload !== "object") {
		throw new AlphaVantageError(
			`Unexpected OVERVIEW response shape for ${symbol}.`,
		);
	}

	const data = payload as Record<string, string | undefined>;

	const overview: CompanyOverview = {
		symbol,
		assetType: parseNullableString(data.AssetType),
		name: parseNullableString(data.Name),
		description: parseNullableString(data.Description),
		exchange: parseNullableString(data.Exchange),
		sector: parseNullableString(data.Sector),
		industry: parseNullableString(data.Industry),
		marketCapitalization: parseInteger(data.MarketCapitalization),
	};

	return { data: overview, cachedAt };
};

export const getCompanyOverview = unstable_cache(
	getCompanyOverviewInternal,
	["alpha-vantage", "company-overview"],
	{ revalidate: DAY_IN_SECONDS },
);

export type DailySeriesPoint = {
	date: string;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number | null;
};

const fetchDailySeriesPayload = async (
	symbol: SupportedTicker,
): Promise<CachedResult<AlphaVantagePayload>> => {
	try {
		// Prefer the standard daily series; fall back if it is unavailable.
		return await fetchAlphaVantage({
			function: "TIME_SERIES_DAILY",
			symbol,
			outputsize: "compact",
		});
	} catch (error) {
		if (
			error instanceof AlphaVantageError &&
			isPremiumEndpointMessage(error.message)
		) {
			return fetchAlphaVantage({
				function: "TIME_SERIES_DAILY_ADJUSTED",
				symbol,
				outputsize: "compact",
			});
		}

		throw error;
	}
};

const getDailySeriesInternal = async (
	symbol: SupportedTicker,
): Promise<CachedResult<DailySeriesPoint[]>> => {
	const { data: payload, cachedAt } = await fetchDailySeriesPayload(symbol);

	const rawSeries = payload["Time Series (Daily)"];

	if (!rawSeries || typeof rawSeries !== "object") {
		throw new AlphaVantageError(
			`Unexpected TIME_SERIES_DAILY response shape for ${symbol}.`,
		);
	}

	const entries = Object.entries(
		rawSeries as Record<string, Record<string, string | undefined>>,
	);

	if (entries.length === 0) {
		throw new AlphaVantageError(
			`TIME_SERIES_DAILY returned no data for ${symbol}.`,
		);
	}

	const points = entries
		.map(([date, values]) => {
			const close = parseNumber(values["4. close"]);
			if (close === null) {
				return null;
			}

			return {
				date,
				open: requireNumber(values["1. open"], "open", symbol),
				high: requireNumber(values["2. high"], "high", symbol),
				low: requireNumber(values["3. low"], "low", symbol),
				close,
				volume: parseInteger(values["6. volume"] ?? values["5. volume"]),
			};
		})
		.filter((item): item is DailySeriesPoint => item !== null)
		.sort((a, b) => (a.date > b.date ? 1 : -1));

	return { data: points, cachedAt };
};

export const getDailySeries = unstable_cache(
	getDailySeriesInternal,
	["alpha-vantage", "daily-series"],
	{ revalidate: DAY_IN_SECONDS },
);

export const isSupportedTicker = (symbol: string): symbol is SupportedTicker =>
	SUPPORTED_TICKERS.includes(symbol.toUpperCase() as SupportedTicker);
