// 碎星鎮浮空檢查（2026-11-20，使用者：「碎星鎮擴建有一些問題如建築浮空等」）。
// 用全部蓋好的碎星鎮，拿合成好的主圖層（TownArt.MAIN）看：每個有圖的擺放物，底邊每一欄正下方那格是不是空的。
// 空的欄位比例高、離下面最近的東西又有一段距離＝浮空。輸出：
//   Golden/town-float/report.json（每個浮空物件：名稱、位置、懸空欄比例、離地距離）
//   Golden/town-float/main.png（整個碎星鎮主圖層，浮空的物件框紅色、懸空的底邊畫紅線）
// 執行：Unity -batchmode -executeMethod ZeroStar.Tests.TownFloatCheck.Run -quit
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using UnityEngine;

namespace ZeroStar.Tests
{
    public static class TownFloatCheck
    {
        public static void Run()
        {
            Rnd.R = new PixelFX.Rng(12345);
            Game.W = 384; TownArt.DayOverride = 0.25; TownArt.WeatherOverride = "clear";
            var g = new Game("town");
            g.SetTestTownConstruction(TownProject.All.Select(p => p.Id));
            g.StartStage();
            var main = (uint[])typeof(TownArt).GetField("MAIN", BindingFlags.NonPublic | BindingFlags.Static).GetValue(null);
            int W = TownArt.TOWN_W, H = TownArt.H;
            var prefab = Resources.Load<GameObject>("StageLayouts/town");
            var root = prefab.transform;
            string dir = Path.GetFullPath(Path.Combine(Application.dataPath, "../Golden/town-float"));
            Directory.CreateDirectory(dir);
            var marks = new List<(int x0, int y0, int x1, int y1, List<(int x, int y)> gaps)>();
            var sb = new StringBuilder("[\n");
            int found = 0;
            foreach (var s in prefab.GetComponentsInChildren<WorldStamp>(true))
            {
                if (s.kind != StampKind.Decor && s.kind != StampKind.PaintedDetail && s.kind != StampKind.TownPathArt) continue;
                var sr = s.GetComponent<SpriteRenderer>(); if (!sr || !sr.sprite) continue;
                var sp = sr.sprite; var tex = sp.texture; if (!tex.isReadable) continue;
                var r = sp.rect; int w = (int)r.width, h = (int)r.height;
                if (s.kind == StampKind.PaintedDetail) { w = s.size.x; h = s.size.y; }
                var pos = s.Position(root);
                var px = tex.GetPixels32();
                int cols = 0, hang = 0, gapMax = 0; var gaps = new List<(int, int)>();
                for (int x = 0; x < w; x++)
                {
                    int sx = (int)r.x + x % (int)r.width, bottom = -1;
                    for (int y = h - 1; y >= 0; y--)
                    {
                        int sy = (int)r.y + (int)r.height - 1 - (y % (int)r.height);
                        if (px[sy * tex.width + sx].a > 0) { bottom = y; break; }
                    }
                    if (bottom < 0) continue;
                    int wx = pos.x + x, wy = pos.y + bottom + 1;
                    if (wx < 0 || wx >= W || wy < 0 || wy >= H) continue;
                    cols++;
                    if (main[wy * W + wx] != 0) continue;
                    hang++;
                    int d = 0; while (wy + d < H && main[(wy + d) * W + wx] == 0 && d < 200) d++;
                    gapMax = Math.Max(gapMax, d); gaps.Add((wx, wy));
                }
                if (cols == 0) continue;
                double ratio = hang / (double)cols;
                if (ratio < 0.25 || gapMax < 2) continue;
                found++;
                marks.Add((pos.x, pos.y, pos.x + w, pos.y + h, gaps));
                sb.Append($"  {{\"name\":\"{s.name}\",\"role\":\"{s.role}\",\"kind\":\"{s.kind}\",\"project\":\"{s.townProject}\",\"x\":{pos.x},\"y\":{pos.y},\"w\":{w},\"h\":{h},\"hangRatio\":{ratio:0.00},\"gapMax\":{gapMax}}},\n");
            }
            sb.Append("  null\n]\n");
            File.WriteAllText(Path.Combine(dir, "report.json"), sb.ToString());
            // 整個碎星鎮主圖層＋紅框
            var img = new Texture2D(W, H, TextureFormat.RGBA32, false); var outPx = new Color32[W * H];
            for (int y = 0; y < H; y++) for (int x = 0; x < W; x++)
            {
                uint c = main[y * W + x];
                outPx[(H - 1 - y) * W + x] = c == 0 ? new Color32(58, 52, 84, 255) : new Color32((byte)c, (byte)(c >> 8), (byte)(c >> 16), 255);
            }
            void Put(int x, int y, Color32 c) { if (x >= 0 && y >= 0 && x < W && y < H) outPx[(H - 1 - y) * W + x] = c; }
            var red = new Color32(255, 40, 40, 255);
            foreach (var m in marks)
            {
                for (int x = m.x0; x < m.x1; x++) { Put(x, m.y0, red); Put(x, m.y1 - 1, red); }
                for (int y = m.y0; y < m.y1; y++) { Put(m.x0, y, red); Put(m.x1 - 1, y, red); }
                foreach (var (x, y) in m.gaps) { Put(x, y, red); Put(x, y + 1, red); }
            }
            img.SetPixels32(outPx); img.Apply();
            File.WriteAllBytes(Path.Combine(dir, "main.png"), img.EncodeToPNG());
            Debug.Log($"[TownFloat] {found} floating objects → {dir}");
        }
    }
}
