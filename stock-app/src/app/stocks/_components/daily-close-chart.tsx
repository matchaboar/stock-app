'use client';

import {
	useCallback,
	useId,
	useMemo,
	useState,
	type PointerEvent,
} from "react";

import type { DailySeriesPoint } from "~/server/alphaVantage";
import { formatCurrency, formatDate } from "~/lib/formatters";

const CHART_WIDTH = 960;
const CHART_HEIGHT = 320;

type ChartPoint = DailySeriesPoint & {
	x: number;
	y: number;
};

type ChartGeometry = {
	path: string;
	areaPath: string;
	points: ChartPoint[];
};

const buildChartGeometry = (series: DailySeriesPoint[]): ChartGeometry => {
	if (series.length === 0) {
		return { path: "", areaPath: "", points: [] };
	}

	if (series.length === 1) {
		const onlyPoint = series[0]!;
		const y = CHART_HEIGHT / 2;
		const chartPoint: ChartPoint = {
			...onlyPoint,
			x: CHART_WIDTH / 2,
			y,
		};

		return {
			path: `M0 ${y} L${CHART_WIDTH} ${y}`,
			areaPath: `M0 ${y} L${CHART_WIDTH} ${y} L${CHART_WIDTH} ${CHART_HEIGHT} L0 ${CHART_HEIGHT} Z`,
			points: [chartPoint],
		};
	}

	const closes = series.map((point) => point.close);
	const minClose = Math.min(...closes);
	const maxClose = Math.max(...closes);
	const range = maxClose - minClose || 1;

	const points = series.map((point, index) => {
		const progress =
			series.length === 1 ? 0 : index / (series.length - 1);
		const x = progress * CHART_WIDTH;
		const normalized = (point.close - minClose) / range;
		const y = CHART_HEIGHT - normalized * CHART_HEIGHT;

		return {
			...point,
			x,
			y,
		};
	});

	const path = points
		.map((point, index) => {
			const command = index === 0 ? "M" : "L";
			return `${command}${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
		})
		.join(" ");

	return {
		path,
		areaPath: `${path} L${CHART_WIDTH} ${CHART_HEIGHT} L0 ${CHART_HEIGHT} Z`,
		points,
	};
};

type DailyCloseChartProps = {
	series: DailySeriesPoint[];
	symbol: string;
	lastUpdatedMessage?: string | null;
};

export const DailyCloseChart = ({
	series,
	symbol,
	lastUpdatedMessage,
}: DailyCloseChartProps) => {
	const gradientId = useId();
	const { path, areaPath, points } = useMemo(
		() => buildChartGeometry(series),
		[series],
	);
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

	const activeIndex =
		hoveredIndex ?? (points.length > 0 ? points.length - 1 : null);
	const activePoint =
		activeIndex !== null ? points[activeIndex] ?? null : null;

	const moveToPoint = useCallback(
		(event: PointerEvent<SVGSVGElement>) => {
			if (points.length === 0) {
				return;
			}

			const rect = event.currentTarget.getBoundingClientRect();
			if (rect.width === 0) {
				return;
			}

			const relativeX =
				((event.clientX - rect.left) / rect.width) * CHART_WIDTH;

			let bestIndex = 0;
			let bestDistance = Number.POSITIVE_INFINITY;

			for (let index = 0; index < points.length; index += 1) {
				const candidate = points[index]!;
				const distance = Math.abs(candidate.x - relativeX);

				if (distance < bestDistance) {
					bestDistance = distance;
					bestIndex = index;
				}
			}

			setHoveredIndex(bestIndex);
		},
		[points],
	);

	const clearHover = useCallback(() => {
		setHoveredIndex(null);
	}, []);

	const handlePointerDown = useCallback(
		(event: PointerEvent<SVGSVGElement>) => {
			event.currentTarget.setPointerCapture(event.pointerId);
			moveToPoint(event);
		},
		[moveToPoint],
	);

	const handlePointerUp = useCallback(
		(event: PointerEvent<SVGSVGElement>) => {
			if (event.currentTarget.hasPointerCapture(event.pointerId)) {
				event.currentTarget.releasePointerCapture(event.pointerId);
			}

			clearHover();
		},
		[clearHover],
	);

	return (
		<div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80">
			{lastUpdatedMessage ? (
				<div className="absolute right-4 top-4">
					<div className="group/cached relative">
						<span className="cursor-help rounded-full bg-slate-800/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
							Cached
						</span>
						<div className="pointer-events-none absolute right-0 top-full z-20 mt-2 hidden whitespace-nowrap rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 shadow-xl group-hover/cached:block">
							{lastUpdatedMessage}
						</div>
					</div>
				</div>
			) : null}
			<svg
				viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
				role="img"
				aria-label={`Daily closing price trend for ${symbol}`}
				className="h-72 w-full touch-none"
				onPointerMove={moveToPoint}
				onPointerLeave={clearHover}
				onPointerCancel={clearHover}
				onPointerDown={handlePointerDown}
				onPointerUp={handlePointerUp}
				preserveAspectRatio="none"
			>
				<defs>
					<linearGradient
						id={gradientId}
						x1="0%"
						x2="0%"
						y1="0%"
						y2="100%"
					>
						<stop
							offset="0%"
							stopColor="rgba(94,234,212,0.35)"
						/>
						<stop
							offset="100%"
							stopColor="rgba(15,118,110,0)"
						/>
					</linearGradient>
				</defs>

				{path ? (
					<>
						<path
							d={areaPath}
							fill={`url(#${gradientId})`}
							fillOpacity={0.6}
						/>
						<path
							d={path}
							fill="none"
							stroke="rgb(94,234,212)"
							strokeWidth={4}
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
						{hoveredIndex !== null && activePoint ? (
							<>
								<line
									x1={activePoint.x}
									x2={activePoint.x}
									y1={0}
									y2={CHART_HEIGHT}
									stroke="rgba(94,234,212,0.35)"
									strokeWidth={1.5}
									strokeDasharray="6 6"
								/>
								<line
									x1={0}
									x2={CHART_WIDTH}
									y1={activePoint.y}
									y2={activePoint.y}
									stroke="rgba(94,234,212,0.35)"
									strokeWidth={1.5}
									strokeDasharray="6 6"
								/>
								<circle
									cx={activePoint.x}
									cy={activePoint.y}
									r={6}
									fill="rgb(16,185,129)"
									stroke="rgb(15,23,42)"
									strokeWidth={3}
								/>
							</>
						) : null}
					</>
				) : (
					<text
						x="50%"
						y="50%"
						textAnchor="middle"
						fill="rgba(148,163,184,0.8)"
					>
						No chart data is available.
					</text>
				)}
			</svg>

			{activePoint ? (
				<div className="pointer-events-none absolute left-4 top-4 rounded-xl border border-slate-800/80 bg-slate-950/90 px-4 py-3 text-sm text-slate-100 shadow-xl shadow-slate-950/40 backdrop-blur">
					<p className="text-xs uppercase tracking-wide text-slate-400">
						{formatDate(activePoint.date)}
					</p>
					<p className="mt-1 text-lg font-semibold text-emerald-300">
						{formatCurrency(activePoint.close)} Close
					</p>
					<div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-300">
						<span className="text-slate-500">Open</span>
						<span>{formatCurrency(activePoint.open)}</span>
						<span className="text-slate-500">High</span>
						<span>{formatCurrency(activePoint.high)}</span>
						<span className="text-slate-500">Low</span>
						<span>{formatCurrency(activePoint.low)}</span>
					</div>
				</div>
			) : null}
		</div>
	);
};
