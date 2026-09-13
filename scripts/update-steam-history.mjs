import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const historyPath = path.join(rootDir, "src/data/steam-history.json");
const siteConfigPath = path.join(rootDir, "src/config/siteConfig.ts");
const apiBaseUrl = "https://api.steampowered.com/IPlayerService";
const requestTimeoutMs = 15000;
const maxAttempts = 3;
// 动态 GC 的三个参数：
// - retentionDays 决定保留多久的历史（快照很小，多留一些没有负担）；
// - minSnapshots 保证「近 30 次」趋势图及其对比窗口始终有数据；
// - maxSnapshots 作为文件体积的硬上限。
const retentionDays = Number(process.env.STEAM_HISTORY_RETENTION_DAYS) || 400;
const minSnapshots = 60;
const maxSnapshots = 2000;
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
	const steamIdMatch = steamConfigMatch?.[0].match(/steamId:\s*["']([^"']+)["']/);
	return steamIdMatch?.[1]?.trim() || "";
}

function getDateKey(date = new Date()) {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(date);
	const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
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

async function readHistory() {
	try {
		const content = await readFile(historyPath, "utf8");
		const parsed = JSON.parse(content);
		return Array.isArray(parsed) ? parsed : [];
	} catch (error) {
		if (error?.code !== "ENOENT") {
			console.warn("[Steam History] 历史文件读取失败，将重新生成。");
		}
		return [];
	}
}

async function writeHistory(history) {
	await writeFile(historyPath, `${JSON.stringify(history, null, 2)}\n`, "utf8");
}

// 动态 GC：按时间窗口裁剪，而不是按固定条数。
// 采样间隔会随 workflow 频率变化（目前 4 天一次），固定条数在间隔变长时
// 会把历史裁得过短，在间隔变短时又会留下过多冗余，因此按天数判断，
// 并用 minSnapshots 兜底，保证趋势图永远够用。
function pruneHistory(history, now = new Date()) {
	if (history.length <= minSnapshots) return history;

	const cutoffDate = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
	const cutoff = getDateKey(cutoffDate);
	const recent = history.filter((item) => item.date >= cutoff);
	const kept =
		recent.length >= minSnapshots ? recent : history.slice(-minSnapshots);

	return kept.slice(-maxSnapshots);
}

async function main() {
	await loadEnvFile(".env.local");
	await loadEnvFile(".env");

	const steamApiKey = process.env.STEAM_API_KEY?.trim();
	const steamId = await getSteamId();

	if (!steamApiKey || !steamId) {
		console.warn("[Steam History] 缺少 STEAM_API_KEY 或 Steam ID，跳过快照更新。");
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

	const history = await readHistory();
	const nextHistory = pruneHistory(
		[...history.filter((item) => item?.date !== snapshot.date), snapshot]
			.filter((item) => item?.date && Number.isFinite(item.totalPlayMinutes))
			.sort((a, b) => a.date.localeCompare(b.date)),
	);

	await writeHistory(nextHistory);
	const dropped = history.length + 1 - nextHistory.length;
	console.log(
		`[Steam History] 已更新 ${snapshot.date} 快照：${Math.round(totalPlayMinutes / 60)} 小时；保留 ${nextHistory.length} 条${dropped > 0 ? `，GC 回收 ${dropped} 条` : ""}。`,
	);
}

main().catch((error) => {
	console.warn("[Steam History] 快照更新失败，继续使用已有历史。", error);
});
