import type { MusicPlayerConfig } from "@/types/config";

// 音乐播放器配置
export const musicPlayerConfig: MusicPlayerConfig = {
	// 禁用音乐播放器方法：
	// 模板默认侧边栏和导航栏两个都显示
	// 1. 侧边栏：在sidebarConfig.ts侧边栏配置把音乐组件enable设为false禁用即可
	// 2. 导航栏：在本配置文件把showInNavbar设为false禁用即可

	// 是否在导航栏显示音乐播放器入口
	showInNavbar: true,

	// 使用方式："meting" 使用 Meting API，"local" 使用本地音乐列表
	mode: "local",

	// 默认音量 (0-1)
	volume: 0.7,

	// 播放模式：'list'=列表循环, 'one'=单曲循环, 'random'=随机播放
	playMode: "one",

	// 是否显示歌词入口
	showLyrics: true,

	// 本地音乐配置（当 mode 为 'local' 时使用）
	local: {
		playlist: [
			{
				name: "誰にもなれない私だから",
				artist: "理名",
				url: "/assets/music/BV12Y4h6NEok.mp3",
				cover: "/assets/music/cover/BV12Y4h6NEok.webp",
				lrc: "/assets/music/BV12Y4h6NEok.lrc",
			},
		],
	},
};
