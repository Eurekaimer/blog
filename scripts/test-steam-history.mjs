// 数据连续性 + 垃圾回收的测试。
// 运行：node scripts/test-steam-history.mjs
import { readFileSync } from "node:fs";
import {
	defaultMaxSnapshots,
	defaultMinSnapshots,
	defaultRetentionDays,
	findGaps,
	latestContiguousRun,
	pruneHistory,
	selectWindow,
	toHistoryEntries,
	validateHistory,
} from "../src/utils/steam-history.mjs";

let failed = 0;
const check = (name, condition, detail = "") => {
	if (condition) {
		console.log(`  ok   ${name}`);
	} else {
		failed += 1;
		console.log(`  FAIL ${name}${detail ? ` -- ${detail}` : ""}`);
	}
};

const dayMs = 24 * 60 * 60 * 1000;
const key = (start, days) =>
	new Date(Date.parse(start) + days * dayMs).toISOString().slice(0, 10);
const series = (start, offsets, step = 10) =>
	offsets.map((offset, i) => ({
		date: key(start, offset),
		totalPlayMinutes: i * step,
	}));

console.log("\n== 1. 真实数据文件");
const raw = JSON.parse(readFileSync("src/data/steam-history.json", "utf8"));
const entries = toHistoryEntries(raw);
check("是字典结构", !Array.isArray(raw) && typeof raw === "object");
check(`读入 ${entries.length} 条`, entries.length > 0);
check(
	"按日期升序",
	entries.every((e, i) => i === 0 || e.date > entries[i - 1].date),
);
const real = validateHistory(entries, 30);
check("无重复日期 / 顺序正确 / 最近数据连续", real.ok, real.errors.join("; "));
check(
	`最新连续段 >= 30 条（实际 ${real.contiguousTail.length}）`,
	real.contiguousTail.length >= Math.min(30, entries.length),
);
check(
	`最近 ${defaultMinSnapshots} 条窗口连续`,
	selectWindow(entries, defaultMinSnapshots).length ===
		Math.min(defaultMinSnapshots, real.contiguousTail.length),
);

console.log("\n== 2. 连续性判定");
const regular = series("2026-01-01", [0, 4, 8, 12, 16, 20]);
check("每 4 天一条 -> 无断档", findGaps(regular).length === 0);
const monthlyDrift = series("2026-01-01", [0, 4, 8, 11, 15, 18]);
check("跨月 3 天抖动 -> 不算断档", findGaps(monthlyDrift).length === 0);
const missed = series("2026-01-01", [0, 4, 8, 12, 24, 28]);
check("漏跑一次（12 天间隔）-> 判定为断档", findGaps(missed).length === 1);

console.log("\n== 3. 只取最新连续段");
const broken = series("2026-01-01", [0, 4, 8, 60, 64, 68]);
const run = latestContiguousRun(broken);
check(
	`截断到断档之后（${run.length} 条）`,
	run.length === 3 && run[0].date === key("2026-01-01", 60),
);
check("断裂数据会被 validateHistory 报错", !validateHistory(broken, 3).ok);

console.log("\n== 4. 垃圾回收有界");
const huge = series(
	"2020-01-01",
	Array.from({ length: 1000 }, (_, i) => i),
);
const pruned = pruneHistory(huge, { now: new Date(huge.at(-1).date) });
check(
	`1000 条 -> 裁到 ${pruned.length} 条（<= ${defaultRetentionDays + 1}）`,
	pruned.length <= defaultRetentionDays + 1,
);
check("保留的是最近的", pruned.at(-1).date === huge.at(-1).date);
const tiny = series("2026-01-01", [0, 4, 8]);
check("数据很少时不裁剪", pruneHistory(tiny).length === 3);
const floored = pruneHistory(
	series(
		"2010-01-01",
		Array.from({ length: 40 }, (_, i) => i * 40),
	),
	{ now: new Date("2026-01-01") },
);
check(
	`全部超期时保底 ${defaultMinSnapshots} 条`,
	floored.length === defaultMinSnapshots,
);

// 模拟 10 年、每 4 天一条：条数必须收敛，不能无限增长
let simulated = [];
const simNow = Date.parse("2016-09-13");
for (let i = 0; i < 912; i += 1) {
	const date = new Date(simNow + i * 4 * dayMs).toISOString().slice(0, 10);
	simulated = pruneHistory(
		[...simulated, { date, totalPlayMinutes: i * 100 }],
		{
			now: new Date(date),
		},
	);
}
check(
	`模拟 10 年（912 次采样）后仍有界：${simulated.length} 条`,
	simulated.length <= defaultMaxSnapshots &&
		simulated.length >= defaultMinSnapshots,
);
check(
	"超上限时按 maxSnapshots 截断",
	pruneHistory(
		series(
			"2020-01-01",
			Array.from({ length: 900 }, (_, i) => i),
		),
		{
			now: new Date("2026-01-01"),
			maxSnapshots: 50,
			retentionDays: 100000,
		},
	).length === 50,
);

console.log("\n== 5. 同一天重复采集");
const merged = [
	...regular.filter((e) => e.date !== regular[2].date),
	regular[2],
].sort((a, b) => a.date.localeCompare(b.date));
check(
	"同日期覆盖而不是追加",
	merged.length === regular.length &&
		toHistoryEntries(merged).length === regular.length,
);

console.log("\n== 6. 出表用的窗口必须是连续的");
const sixty = series(
	"2026-01-01",
	Array.from({ length: 60 }, (_, i) => i * 4),
);
const week = selectWindow(sixty, 7);
const month = selectWindow(sixty, 30);
check("连续数据：7 条窗口正好 7 条", week.length === 7);
check("连续数据：30 条窗口正好 30 条", month.length === 30);
check("7 条窗口内部无断档", findGaps(week).length === 0);
check("30 条窗口内部无断档", findGaps(month).length === 0);
check(
	"7 条窗口就是最新的 7 条",
	week.at(-1).date === sixty.at(-1).date && week[0].date === sixty.at(-7).date,
);

const withBreak = series("2026-01-01", [
	...Array.from({ length: 50 }, (_, i) => i * 4),
	...Array.from({ length: 10 }, (_, i) => 50 * 4 + i * 4 + 60),
]);
const weekAfterBreak = selectWindow(withBreak, 7);
check(
	"有断档时：窗口只取断档之后的数据",
	weekAfterBreak.length === 7 &&
		weekAfterBreak.every(
			(e) => Date.parse(e.date) > Date.parse(key("2026-01-01", 50 * 4 + 40)),
		),
);
check("有断档时：窗口内部依然连续", findGaps(weekAfterBreak).length === 0);
check(
	"有断档时：30 条窗口也不会跨越断档",
	findGaps(selectWindow(withBreak, 30)).length === 0,
);

console.log(`\n${failed === 0 ? "全部通过" : `${failed} 项失败`}`);
process.exit(failed === 0 ? 0 : 1);
