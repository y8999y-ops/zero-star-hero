// 《魔數學院》入口：讀存檔、切換畫面。

import { loadSave } from "./save.js";
import { autoFullscreen } from "./fullscreen.js";
import { installUiArt } from "./ui-art.js";
import { applySettings } from "./settings.js";
import { settingsScene } from "./scenes/settings.js";
import { titleScene, lookScene, introScene } from "./scenes/intro.js";
import { resonanceScene } from "./scenes/resonance.js";
import { mapScene } from "./scenes/map.js";
import { hubScene } from "./scenes/hub.js";
import { areaScene } from "./scenes/area.js";
import { libraryScene } from "./scenes/library.js";
import { openingStory, ceremonyStory, afterResonanceStory, afterTutorialStory, endingStory } from "./scenes/story.js";
import { academyScene } from "./scenes/academy.js";
import { lessonScene, lessonList } from "./scenes/lesson.js";
import { dexScene } from "./scenes/dex.js";
import { shopScene, applyOutfit } from "./scenes/shop.js";
import { dormScene } from "./scenes/dorm.js";
import { resultScene } from "./scenes/result.js";
import { runBattle } from "./battle/battle.js";
import { battleIn, battleOut } from "./transition.js";
import { playMusic } from "./music.js";

const game = {
  save: loadSave(),
  go(scene, arg = {}) {
    const s = this.save;
    // 還沒選外觀或屬性就先補完入學流程
    // 入學流程：開場動畫（選外觀）→ 學院全景，點共鳴之井（還沒有屬性也能點）→ 共鳴儀式 → 第一場戰鬥
    if (scene === "map" && !s.look) scene = "opening";
    if (scene === "map" && s.attr && !s.seenIntro) scene = "afterResonance";
    // 背景音樂：照畫面換（同一首不重來）
    const MUSIC = { title: "title", look: "title", intro: "title", opening: "title", settings: null, resonance: "library", afterResonance: "area", ceremony: "hub",
      map: "hub", academy: "hub", shop: "hub", dorm: "hub", library: "library", lesson: "library", lessons: "library", dex: "library", menu: "hub",
      area: "area", ending: "ending", battle: arg.mode === "boss" ? "boss" : "battle" };
    if (scene in MUSIC && MUSIC[scene] !== null) playMusic(MUSIC[scene]);
    switch (scene) {
      case "title": return titleScene(this);
      case "look": return lookScene(this);
      case "intro": return introScene(this, arg);
      case "settings": return settingsScene(this, arg);
      case "resonance": return resonanceScene(this, arg);
      case "afterResonance": return afterResonanceStory(this);   // 劇情動畫：無解之書爆開、頁頁登場
      case "map": {                                       // 學院全景（2026-11-25 起沒有大地圖，改成點選）；從區域進去打的戰鬥打完回到區域
        const back = s.returnTo; s.returnTo = null;
        if (back?.scene === "area" && !arg.from) return areaScene(this, { grade: back.grade });
        if (back?.scene === "academy" && !arg.from) return academyScene(this, { academy: back.academy });
        return hubScene(this, arg);
      }
      case "area": return areaScene(this, arg);           // 受污染的區域（三群墨水怪＋王）
      case "opening": return openingStory(this, arg);     // 開場動畫＋選外觀（劇情動畫）
      case "ceremony": return ceremonyStory(this);         // 入學典禮（劇情動畫）
      case "academy": return academyScene(this, arg);     // 學院裡面：兩種數學魔法的練習
      case "lesson": return lessonScene(this, arg);       // 圖書館・魔法教室（一種魔法）
      case "lessons": return lessonList(this);            // 圖書館・魔法教室（清單）
      case "ending": return endingStory(this);            // 結局（最終戰打完）
      case "dex": return dexScene(this);                  // 墨水圖鑑
      case "shop": return shopScene(this, arg);           // 學院商店
      case "dorm": return dormScene(this);                // 宿舍・你的房間
      case "library": return libraryScene(this);         // 千頁圖書館・大廳
      case "menu": return mapScene(this);                // 學院選單（所有區域、錯題本、成長日記）
      case "battle": {
        // 魔法轉場（對應玩家屬性）：全蓋住時建立戰鬥畫面；打完再轉場到結算
        const end = (r) => battleOut(s.attr, () => (r.mode === "tutorial" ? afterTutorialStory(this, r) : resultScene(this, r)));
        return battleIn(s.attr, () => new Promise((ready) => runBattle(this, arg.grade ?? "g1", arg.mode, arg.stage ?? 0, end, ready, arg.practice ?? null)), { boss: arg.mode === "boss" });
      }
    }
  },
};

installUiArt();                   // 像素外框、按鈕（變成 CSS 變數）
applySettings(game.save.settings);
applyOutfit(game.save);           // 商店買的帽子、斗篷
autoFullscreen();
window.__game = game;   // 開發用：在主控台看存檔
game.go("title");
