// 《魔數學院》入口：讀存檔、切換畫面。

import { loadSave } from "./save.js";
import { applySettings } from "./settings.js";
import { settingsScene } from "./scenes/settings.js";
import { titleScene, lookScene, introScene, afterResonance, afterTutorial } from "./scenes/intro.js";
import { resonanceScene } from "./scenes/resonance.js";
import { mapScene } from "./scenes/map.js";
import { worldScene } from "./scenes/world.js";
import { libraryScene } from "./scenes/library.js";
import { resultScene } from "./scenes/result.js";
import { runBattle } from "./battle/battle.js";
import { battleIn, battleOut } from "./transition.js";

const game = {
  save: loadSave(),
  go(scene, arg = {}) {
    const s = this.save;
    // 還沒選外觀或屬性就先補完入學流程
    if (scene === "map" && !s.look) scene = "look";
    if (scene === "map" && !s.attr) scene = "resonance";
    if (scene === "map" && !s.seenIntro) scene = "afterResonance";
    switch (scene) {
      case "title": return titleScene(this);
      case "look": return lookScene(this);
      case "intro": return introScene(this, arg);
      case "settings": return settingsScene(this, arg);
      case "resonance": return resonanceScene(this, arg);
      case "afterResonance": return afterResonance(this);
      case "map": return worldScene(this, arg);          // 大地圖（學院島）
      case "library": return libraryScene(this);         // 千頁圖書館・大廳
      case "menu": return mapScene(this);                // 學院選單（所有區域、錯題本、成長日記）
      case "battle": {
        // 魔法轉場（對應玩家屬性）：全蓋住時建立戰鬥畫面；打完再轉場到結算
        const end = (r) => battleOut(s.attr, () => (r.mode === "tutorial" ? afterTutorial(this, r) : resultScene(this, r)));
        return battleIn(s.attr, () => new Promise((ready) => runBattle(this, arg.grade, arg.mode, arg.stage ?? 0, end, ready)), { boss: arg.mode === "boss" });
      }
    }
  },
};

applySettings(game.save.settings);
window.__game = game;   // 開發用：在主控台看存檔
game.go("title");
