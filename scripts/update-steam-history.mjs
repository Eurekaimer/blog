import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
	defaultMinSnapshots,
	defaultRetentionDays,
	findGaps,
	pruneHistory,
	toHistoryEntries,
} from "../src/utils/steam-history.mjs";

const rootDir = process.cwd();
const historyPath = path.join(rootDir, "src/data/steam-history.json");
const siteConfigPath = path.join(rootDir, "src/config/siteConfig.ts");
const apiBaseUrl = "https://api.steampowered.com/IPlayerService";
const requestTimeoutMs = 15000;
const maxAttempts = 3;
const retentionDays =
	Number(process.env.STEAM_HISTORY_RETENTION_DAYS) || defaultRetentionDays;
const timeZone = process.env.STEAM_HISTORY_TIMEZONE || "Asia/Shanghai";

function parseEnvValue(value) {
	const trimmed = value.trim();
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
}

async function loadEnvFile(filename) {
	try {
		const content = await readFile(path.join(rootDir, filename), "utf8");
		for (const line of content.split(/\r?\n/)) {
			const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
			if (!match || line.trim().startsWith("#")) continue;

			const [, key, rawValue] = match;
			if (!process.env[key]) {
				process.env[key] = parseEnvValue(rawValue);
			}
		}
	} catch (error) {
		if (error?.code !== "ENOENT") {
			console.warn(`[Steam History] 读取 ${filename} 失败，已跳过。`);
		}
	}
}

async function getSteamId() {
	if (process.env.STEAM_ID?.trim()) {
		return process.env.STEAM_ID.trim();
	}

	const siteConfig = await readFile(siteConfigPath, "utf8");
	const steamConfigMatch = siteConfig.match(/steam:\s*{[\s\S]*?}/);
	const steamIdMatch = steamConfigMatch?.[0].match(
		/steamId:\s*["']([^"']+)["']/,
	);
	return steamIdMatch?.[1]?.trim() || "";
}

function getDateKey(date = new Date()) {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(date);
	const values = Object.fromEntries(
		parts.map((part) => [part.type, part.value]),
	);
	return `${values.year}-${values.month}-${values.day}`;
}

async function fetchJsonWithRetry(url, label) {
	let lastError;

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		try {
			const response = await fetch(url, {
				signal: AbortSignal.timeout(requestTimeoutMs),
			});
			if (!response.ok) {
				throw new Error(`${label} failed with ${response.status}`);
			}

			return await response.json();
		} catch (error) {
			lastError = error;
			if (attempt < maxAttempts) {
				await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
			}
		}
	}

	throw lastError;
}

async function fetchSteamJson(method, params) {
	const url = new URL(`${apiBaseUrl}/${method}/v0001/`);
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value);
	}
	url.searchParams.set("format", "json");

	return fetchJsonWithRetry(url, method);
}

// 数据文件是 { 日期: 记录 } 的字典，读出来按日期排序即为时间线。
async function readHistory() {
	try {
		const content = await readFile(historyPath, "utf8");
		return toHistoryEntries(JSON.parse(content));
	} catch (error) {
		if (error?.code !== "ENOENT") {
			console.warn("[Steam History] 历史文件读取失败，将重新生成。");
		}
		return [];
	}
}

// 写回时用日期做 key，保持字典结构，字段顺序即时间顺序。
async function writeHistory(entries) {
	const dict = {};
	for (const entry of entries) dict[entry.date] = entry;
	await writeFile(historyPath, `${JSON.stringify(dict, null, 2)}\n`, "utf8");
}

// 把采样断档明确暴露到日志里：漏跑不补数据（补出来也不是真实采样），
// 但趋势图只会用最新的连续段，断档必须能看见。
function reportGaps(entries) {
	const gaps = findGaps(entries);
	if (gaps.length === 0) {
		console.log("[Steam History] 采样间隔正常，无断档。");
		return;
	}

	console.warn(
		`[Steam History] 检测到 ${gaps.length} 处采样断档（定时任务可能漏跑）：${gaps
			.map((gap) => `${gap.from} -> ${gap.to}（${gap.days} 天）`)
			.join("、")}`,
	);
}

async function main() {
	await loadEnvFile(".env.local");
	await loadEnvFile(".env");

	const steamApiKey = process.env.STEAM_API_KEY?.trim();
	const steamId = await getSteamId();

	if (!steamApiKey || !steamId) {
		console.warn(
			"[Steam History] 缺少 STEAM_API_KEY 或 Steam ID，跳过快照更新。",
		);
		return;
	}

	const [ownedData, recentData] = await Promise.all([
		fetchSteamJson("GetOwnedGames", {
			key: steamApiKey,
			steamid: steamId,
			include_appinfo: "true",
			include_played_free_games: "true",
		}),
		fetchSteamJson("GetRecentlyPlayedGames", {
			key: steamApiKey,
			steamid: steamId,
			count: "100",
		}),
	]);

	const games = ownedData.response?.games || [];
	const totalPlayMinutes = games.reduce(
		(total, game) => total + (game.playtime_forever || 0),
		0,
	);
	const recentPlayMinutes = (recentData.response?.games || []).reduce(
		(total, game) => total + (game.playtime_2weeks || 0),
		0,
	);
	const playedGames = games.filter((game) => (game.playtime_forever || 0) > 0);
	const topGame = [...playedGames].sort(
		(a, b) => (b.playtime_forever || 0) - (a.playtime_forever || 0),
	)[0];

	const snapshot = {
		date: getDateKey(),
		recordedAt: new Date().toISOString(),
		totalPlayMinutes,
		recentPlayMinutes,
		gameCount: games.length,
		playedGameCount: playedGames.length,
		topGame: topGame
			? {
					appid: topGame.appid,
					name: topGame.name,
					playtime_forever: topGame.playtime_forever || 0,
				}
			: undefined,
	};

	// 读到的是按日期排好序的数组；同一天重复运行就覆盖当天的记录。
	const history = await readHistory();
	const merged = [
		...history.filter((entry) => entry.date !== snapshot.date),
		snapshot,
	].sort((a, b) => a.date.localeCompare(b.date));
	const nextHistory = pruneHistory(merged, {
		retentionDays,
		minSnapshots: defaultMinSnapshots,
	});

	await writeHistory(nextHistory);
	const dropped = merged.length - nextHistory.length;
	console.log(
		`[Steam History] 已更新 ${snapshot.date} 快照：${Math.round(totalPlayMinutes / 60)} 小时；共 ${nextHistory.length} 条${dropped > 0 ? `，清理 ${dropped} 条` : ""}。`,
	);
	reportGaps(nextHistory);
}

main().catch((error) => {
	console.warn("[Steam History] 快照更新失败，继续使用已有历史。", error);
});
