# 魔數學院

網頁像素小遊戲，數學學習主題。跟 `game/`、`unity/` 的《轉生成星星碎片的我》是不同的遊戲，素材也不共用。

- 世界觀：[docs/世界觀.md](docs/世界觀.md)（設定以這份為準）
- 企劃書：[docs/企劃書.md](docs/企劃書.md)

## 怎麼開

在專案根目錄執行 `node server.mjs`，然後開 http://localhost:5173/math/ 。

- 網址加 `?mute` 不出聲（測試用）。
- 開發用：http://localhost:5173/math/dev/spells.html 同時播放五個屬性 × 四級魔法；加 `?t=0.6` 停在施法後第 0.6 秒，方便截圖比較。
- 開發用：http://localhost:5173/math/dev/mathmagic.html 加減乘除的「數學變魔法」十二種情況（湊十進位、借位、乘法方陣、面積模型、平分…）；一樣可以加 `?t=1.0`。
- 開發用：http://localhost:5173/math/dev/transition.html 按鈕播放五個屬性的戰鬥轉場（一般／王戰）；`?attr=ice&t=0.7`（加 `&boss`）停在第 0.7 秒。
- 主控台的 `__game` 可以看存檔、直接跳畫面，例如 `__game.go("battle", { grade: "jh", mode: "boss" })`。

目前是 M1 原型＋M2 第一批：見習魔數師（fx/hero.js）已換成正式像素圖；怪物還是墨水色的 pixelfx 史萊姆、背景是暫用的色塊，之後一批一批換。美術預覽圖放在 docs/圖/。

## 題庫工具

遊戲本身不用裝任何東西；只有整理題庫的工具要先在 `math/` 底下跑一次 `npm install`。

| 指令（在 math/ 底下） | 做什麼 |
|---|---|
| `npm run extract` | 讀出原始題庫 → `data/questions/work/` |
| `npm run check` | 檢查改寫表：答案不變、數字不漏、沒有簡體字和中國用語、用詞符合世界觀 |
| `npm run build` | 先跑 check，再把改寫表合併成 `data/questions/built/<學年>.json`（遊戲讀這個） |
| `node tools/preview-hero.mjs out.png` | 見習魔數師預覽：女生／男生 × 各姿勢 × 五個屬性色，並檢查色數（上限 16） |
| `node tools/test-generators.mjs` | 檢查計算題產生器：每個題型產生 2000 題，選項不重複、答案正確 |

## 資料夾

```
math/
  README.md          這份說明
  docs/              世界觀、企劃書、美術提示詞（中文檔名）；圖/ 是給使用者看的預覽圖
  data/
    questions/
      raw/<來源>/    下載的原始題庫，原樣不改，旁邊放 SOURCE.md（網址、授權、下載日期）
      work/          npm run extract 讀出的原題（統一格式、初步分學年），不進 git，隨時可重產
      rewrite/       題目情境改寫表（一批一個 json，欄位說明見裡面的 README）
      built/         合併後給遊戲讀的 json（由 tools/ 產生，不手改）
    quiz/            共鳴儀式（心理測驗）的題目與計分表
  tools/             題庫轉換、測驗模擬等 node 腳本
  src/
    main.js          入口、切換畫面
    data.js          屬性、學年、魔法分支、成長數值（數字都在這裡調）
    save.js          存檔（localStorage）
    settings.js      設定的預設值與套用（聲音、文字大小、左手模式…）
    growth.js        經驗、等級、熟練度、數晶、錯題本、成長日記
    audio.js         暫用音效（瀏覽器合成）
    ui.js            建立元素、對話框、飄字
    transition.js    戰鬥轉場（墨水→魔法陣→屬性魔法蓋滿→打開）
    questions/       gen.js 計算題產生器、pool.js 出題與四個選項
    battle/          battle.js 一關的流程、stage.js 戰鬥畫面、spells.js 五屬性四級魔法、mathmagic.js 數學變魔法與答案數字
    scenes/          標題與劇情、共鳴儀式、學院地圖、結算、設定
  dev/               開發用頁面（魔法一覽）
  fx/                角色與怪物的像素圖（程式畫）：hero.js 見習魔數師
  art/
    1-參考原圖/      AI 參考圖（提示詞在 docs/美術提示詞.md），依 map、battle/<區域>、chars 分
    2-草稿/          pixel-redraw 重畫中的稿
    3-已通過/        使用者確認過的成品，遊戲讀這裡
  audio/             音效與音樂
```

## 放檔案的規則

1. **程式會讀到的路徑一律用英文**，文件可以用中文。
2. `data/questions/raw/` 只放下載的原檔，不改內容。要修題目就寫在轉換腳本或修正表裡，這樣重新下載也不會弄丟修改。
3. `data/questions/built/` 一律由 `tools/` 產生，不手改；改完腳本就重跑一次。
4. 每個外部來源（題庫、字型、音效）都要有 SOURCE.md，寫清楚網址、授權和下載日期。MIT 授權要保留原作者的版權聲明。
5. 美術流程照專案根目錄的規則：參考 → 草稿 → 使用者通過，才放進 `math/art/`。
