// Steam 快照数据的读写与校验逻辑。
// 数据文件是 { 日期: 记录 } 的字典，按日期排序后就是一条时间线。
// 这里只放纯函数，脚本（Node）和页面（Astro）共用同一套实现。

/**
 * 正常采样间隔是 4 天（cron 每 4 天一次）；cron 跨月时会有 2~3 天的抖动，
 * 因此把 6 天以内视为「正常间隔」，超过就认为漏跑了一次，属于断档。
 */
export const maxGapDays = 6;

/** 默认保留最近 400 天，但至少留 30 条、最多留 400 条（够「近 30 次」趋势图用）。 */
export const defaultRetentionDays = 400;
export const defaultMinSnapshots = 30;
export const defaultMaxSnapshots = 400;

const dayMs = 24 * 60 * 60 * 1000;

/** 把 { 日期: 记录 } 字典（或旧版数组）整理成按日期升序的数组。 */
export function toHistoryEntries(raw) {
	const list = Array.isArray(raw)
		? raw
		: raw && typeof raw === "object"
			? Object.entries(raw).map(([date, row]) => ({ ...row, date }))
			: [];

	return list
		.filter(
			(entry) =>
				entry &&
				typeof entry.date === "string" &&
				/^\d{4}-\d{2}-\d{2}$/.test(entry.date) &&
				Number.isFinite(Number(entry.totalPlayMinutes)),
		)
		.map((entry) => ({
			...entry,
			totalPlayMinutes: Number(entry.totalPlayMinutes),
		}))
		.sort((a, b) => a.date.localeCompare(b.date));
}

/** 找出所有间隔过大的地方，返回 [{ from, to, days }]。 */
export function findGaps(entries, limit = maxGapDays) {
	const gaps = [];
	for (let i = 1; i < entries.length; i += 1) {
		const previous = Date.parse(`${entries[i - 1].date}T00:00:00Z`);
		const current = Date.parse(`${entries[i].date}T00:00:00Z`);
		const days = Math.round((current - previous) / dayMs);
		if (days > limit) {
			gaps.push({ from: entries[i - 1].date, to: entries[i].date, days });
		}
	}
	return gaps;
}

/**
 * 取「最新的一段连续数据」：从最后一条往前找，遇到断档就停。
 * 这样画表时用的窗口一定是连续的，不会把断档前后的数据连成一条假曲线。
 */
export function latestContiguousRun(entries, limit = maxGapDays) {
	if (entries.length === 0) return [];

	let start = entries.length - 1;
	while (start > 0) {
		const previous = Date.parse(`${entries[start - 1].date}T00:00:00Z`);
		const current = Date.parse(`${entries[start].date}T00:00:00Z`);
		if (Math.round((current - previous) / dayMs) > limit) break;
		start -= 1;
	}
	return entries.slice(start);
}

/** 取连续数据里最近 N 条，作为趋势图的窗口。 */
export function selectWindow(entries, windowSize, limit = maxGapDays) {
	const run = latestContiguousRun(entries, limit);
	return run.length > 0 ? run.slice(-windowSize) : [];
}

/**
 * 垃圾回收：只保留最近 retentionDays 天。
 * 下限 minSnapshots 保证趋势图够用，上限 maxSnapshots 给文件体积兜底，
 * 因此数据量始终有界，不会随时间无限增长。
 */
export function pruneHistory(
	entries,
	{
		retentionDays = defaultRetentionDays,
		minSnapshots = defaultMinSnapshots,
		maxSnapshots = defaultMaxSnapshots,
		now = new Date(),
	} = {},
) {
	const capped = entries.slice(-maxSnapshots);
	if (capped.length <= minSnapshots) return capped;

	const cutoff = new Date(now.getTime() - retentionDays * dayMs)
		.toISOString()
		.slice(0, 10);
	const recent = capped.filter((entry) => entry.date >= cutoff);
	return recent.length >= minSnapshots ? recent : capped.slice(-minSnapshots);
}

/**
 * 校验数据文件是否可用：必须按日期升序、无重复、并且最近一段是连续的。
 * 返回 { ok, errors }，供脚本和测试直接断言。
 */
export function validateHistory(entries, windowSize = 30) {
	const errors = [];

	for (let i = 1; i < entries.length; i += 1) {
		if (entries[i - 1].date === entries[i].date) {
			errors.push(`重复日期：${entries[i].date}`);
		} else if (entries[i - 1].date > entries[i].date) {
			errors.push(
				`顺序错误：${entries[i - 1].date} 在 ${entries[i].date} 之后`,
			);
		}
	}

	for (const gap of findGaps(entries)) {
		errors.push(`断档：${gap.from} -> ${gap.to}（${gap.days} 天）`);
	}

	const run = latestContiguousRun(entries);
	if (entries.length >= windowSize && run.length < windowSize) {
		errors.push(
			`最新连续数据只有 ${run.length} 条，不足一个 ${windowSize} 条的窗口`,
		);
	}

	return { ok: errors.length === 0, errors, contiguousTail: run };
}
