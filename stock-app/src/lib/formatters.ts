const currencyFormatter = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
});

const percentFormatter = new Intl.NumberFormat("en-US", {
	style: "percent",
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	year: "numeric",
});

const volumeFormatter = new Intl.NumberFormat("en-US", {
	notation: "compact",
	maximumFractionDigits: 1,
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	year: "numeric",
	hour: "numeric",
	minute: "2-digit",
	timeZoneName: "short",
});

export const formatCurrency = (
	value: number | null | undefined,
): string => {
	if (value === undefined || value === null) {
		return "—";
	}

	return currencyFormatter.format(value);
};

export const formatCurrencyDelta = (
	value: number | null | undefined,
): string => {
	if (value === undefined || value === null) {
		return "—";
	}

	if (value === 0) {
		return "$0.00";
	}

	const absolute = currencyFormatter.format(Math.abs(value));
	return value > 0 ? `+${absolute}` : `-${absolute}`;
};

export const formatPercent = (
	value: number | null | undefined,
): string => {
	if (value === undefined || value === null) {
		return "—";
	}

	const formatted = percentFormatter.format(value / 100);
	return value > 0 ? `+${formatted}` : formatted;
};

export const formatVolume = (
	value: number | null | undefined,
): string => {
	if (value === undefined || value === null) {
		return "—";
	}

	return volumeFormatter.format(value);
};

export const formatDate = (
	value: string | number | Date | null | undefined,
): string => {
	if (value === undefined || value === null) {
		return "—";
	}

	const date = value instanceof Date ? value : new Date(value);

	if (Number.isNaN(date.getTime())) {
		return "—";
	}

	return dateFormatter.format(date);
};

export const formatDateTime = (
	value: string | number | Date | null | undefined,
): string => {
	if (value === undefined || value === null) {
		return "-";
	}

	const date = value instanceof Date ? value : new Date(value);

	if (Number.isNaN(date.getTime())) {
		return "-";
	}

	return dateTimeFormatter.format(date);
};

export const formatRelativeTime = (
	value: string | number | Date | null | undefined,
): string | null => {
	if (value === undefined || value === null) {
		return null;
	}

	const date = value instanceof Date ? value : new Date(value);
	const timestamp = date.getTime();

	if (Number.isNaN(timestamp)) {
		return null;
	}

	const diffMs = Date.now() - timestamp;
	if (!Number.isFinite(diffMs)) {
		return null;
	}

	if (diffMs <= 45_000) {
		return "just now";
	}

	const minuteMs = 60_000;
	const hourMs = 60 * minuteMs;
	const dayMs = 24 * hourMs;
	const weekMs = 7 * dayMs;
	const monthMs = 30 * dayMs;
	const yearMs = 365 * dayMs;

	if (diffMs < hourMs) {
		const minutes = Math.round(diffMs / minuteMs);
		return `${minutes} minute${minutes === 1 ? "" : "s"}`;
	}

	if (diffMs < dayMs) {
		const hours = Math.round(diffMs / hourMs);
		return `${hours} hour${hours === 1 ? "" : "s"}`;
	}

	if (diffMs < weekMs) {
		const days = Math.round(diffMs / dayMs);
		return `${days} day${days === 1 ? "" : "s"}`;
	}

	if (diffMs < monthMs * 1.5) {
		const weeks = Math.round(diffMs / weekMs);
		return `${weeks} week${weeks === 1 ? "" : "s"}`;
	}

	if (diffMs < yearMs) {
		const months = Math.round(diffMs / monthMs);
		return `${months} month${months === 1 ? "" : "s"}`;
	}

	const years = Math.round(diffMs / yearMs);
	return `${years} year${years === 1 ? "" : "s"}`;
};
