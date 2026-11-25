// 《魔數學院》入口：讀存檔、切換畫面。

import { loadSave } from "./save.js";
import { setSound } from "./audio.js";
import { titleScene, lookScene, introScene, afterResonance } from "./scenes/intro.js";
import { resonanceScene } from "./scenes/resonance.js";
import { mapScene } from "./scenes/map.js";
import { resultScene } from "./scenes/result.js";
import { runBattle } from "./battle/battle.js";

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
      case "intro": return introScene(this);
      case "resonance": return resonanceScene(this, arg);
      case "afterResonance": return afterResonance(this);
      case "map": return mapScene(this);
      case "battle": return runBattle(this, arg.grade, arg.mode, arg.stage ?? 0, (r) => resultScene(this, r));
    }
  },
};

setSound(game.save.settings.sound);
window.__game = game;   // 開發用：在主控台看存檔
game.go("title");
