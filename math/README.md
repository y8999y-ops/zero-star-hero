# 魔數學院

網頁像素小遊戲，數學學習主題。跟 `game/`、`unity/` 的《轉生成星星碎片的我》是不同的遊戲，素材也不共用。

- 世界觀：[docs/世界觀.md](docs/世界觀.md)（設定以這份為準）
- 企劃書：[docs/企劃書.md](docs/企劃書.md)

## 怎麼開

在專案根目錄執行 `node server.mjs`，然後開 http://localhost:5173/math/ 。目前還沒有遊戲程式，做到 M1 才會有。

## 題庫工具

遊戲本身不用裝任何東西；只有整理題庫的工具要先在 `math/` 底下跑一次 `npm install`。

| 指令（在 math/ 底下） | 做什麼 |
|---|---|
| `npm run extract` | 讀出原始題庫 → `data/questions/work/` |
| `npm run check` | 檢查改寫表：答案不變、數字不漏、沒有簡體字和中國用語、用詞符合世界觀 |

## 資料夾

```
math/
  README.md          這份說明
  docs/              世界觀、企劃書、美術提示詞（中文檔名）
  data/
    questions/
      raw/<來源>/    下載的原始題庫，原樣不改，旁邊放 SOURCE.md（網址、授權、下載日期）
      work/          npm run extract 讀出的原題（統一格式、初步分學年），不進 git，隨時可重產
      rewrite/       題目情境改寫表（一批一個 json，欄位說明見裡面的 README）
      built/         合併後給遊戲讀的 json（由 tools/ 產生，不手改）
    quiz/            共鳴儀式（心理測驗）的題目與計分表
  tools/             題庫轉換、測驗模擬等 node 腳本
  src/               遊戲程式（M1 開始）
  fx/                pixelfx 格式的角色、怪物、魔法
  art/               場景與介面成品
  audio/             音效與音樂
```

## 放檔案的規則

1. **程式會讀到的路徑一律用英文**，文件可以用中文。
2. `data/questions/raw/` 只放下載的原檔，不改內容。要修題目就寫在轉換腳本或修正表裡，這樣重新下載也不會弄丟修改。
3. `data/questions/built/` 一律由 `tools/` 產生，不手改；改完腳本就重跑一次。
4. 每個外部來源（題庫、字型、音效）都要有 SOURCE.md，寫清楚網址、授權和下載日期。MIT 授權要保留原作者的版權聲明。
5. 美術流程照專案根目錄的規則：參考 → 草稿 → 使用者通過，才放進 `math/art/`。
