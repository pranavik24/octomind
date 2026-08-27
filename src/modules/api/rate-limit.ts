const buckets = new Map<string, number[]>();

export function checkRateLimit({
	key,
	limit,
	windowMs,
}: {
	key: string;
	limit: number;
	windowMs: number;
}) {
	const now = Date.now();
	const windowStart = now - windowMs;
	const hits = (buckets.get(key) ?? []).filter((time) => time > windowStart);

	if (hits.length >= limit) {
		return false;
	}

	buckets.set(key, [...hits, now]);
	return true;
}
