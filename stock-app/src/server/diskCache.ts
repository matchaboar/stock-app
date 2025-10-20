import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const CACHE_ROOT = path.join(process.cwd(), ".next", "alpha-vantage-cache");
const DISK_CACHE_ENABLED = process.env.NODE_ENV !== "production";

type CacheContainer<T> = {
	timestamp: number;
	data: T;
};

export type DiskCacheHit<T> = {
	data: T;
	timestamp: number;
};

const getCacheFilePath = (key: string): string => {
	const hash = createHash("sha256").update(key).digest("hex");
	return path.join(CACHE_ROOT, `${hash}.json`);
};

export const readFromDiskCache = async <T>(
	key: string,
	ttlMs: number,
): Promise<DiskCacheHit<T> | null> => {
	if (!DISK_CACHE_ENABLED) {
		return null;
	}

	try {
		const filePath = getCacheFilePath(key);
		const raw = await fs.readFile(filePath, "utf8");
		const parsed = JSON.parse(raw) as CacheContainer<T>;

		if (Number.isFinite(parsed.timestamp)) {
			const age = Date.now() - parsed.timestamp;
			if (age <= ttlMs) {
				return {
					data: parsed.data,
					timestamp: parsed.timestamp,
				};
			}
		}

		await fs.rm(filePath, { force: true });
		return null;
	} catch (error) {
		if (
			typeof error === "object" &&
			error !== null &&
			"code" in error &&
			error.code === "ENOENT"
		) {
			return null;
		}

		return null;
	}
};

export const writeToDiskCache = async <T>(
	key: string,
	value: T,
): Promise<void> => {
	if (!DISK_CACHE_ENABLED) {
		return;
	}

	const filePath = getCacheFilePath(key);
	const payload: CacheContainer<T> = {
		timestamp: Date.now(),
		data: value,
	};

	await fs.mkdir(path.dirname(filePath), { recursive: true });
	await fs.writeFile(filePath, JSON.stringify(payload), "utf8");
};
