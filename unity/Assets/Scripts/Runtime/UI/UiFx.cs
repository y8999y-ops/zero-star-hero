// ui-fx.js：介面上的像素特效。蓋在整個畫面上的一張透明圖，每 2 個介面單位＝1 個特效像素。
// 用法：At(介面座標, 特效名字, 選項)；特效播完自己消失，沒有特效時不算也不畫。
// 工坊強化（打鐵火花、開副屬性、失敗）、公會交付（QUEST COMPLETE 緞帶、金幣）用。
using System;
using System.Collections.Generic;
using PixelFX;
using UnityEngine;
using UnityEngine.UIElements;
using static ZeroStar.UI.Ui;

namespace ZeroStar.UI
{
    public class UiFx
    {
        const int K = 2;
        readonly VisualElement layer; Frame frame; Texture2D tex; byte[] rgba;
        readonly List<(FxRun fx, float wait)> list = new List<(FxRun, float)>();

        public UiFx(VisualElement parent)
        {
            layer = Box(parent, "uiFx"); Abs(layer, 0, 0, 0, 0);
            layer.style.scale = new Scale(new Vector2(1, -1));   // 合成出來是上到下，貼圖是下到上：翻過來
        }
        /// 在介面座標 (p) 播一個特效；delay 秒後才開始。特效的原點多半在「地面」（下緣），照大小、原點往下移讓畫面中心對準
        public void At(Vector2 p, string name, FxOptions o, float delay = 0)
        {
            FxDef def;
            try { def = Runtime_Def(name); } catch { return; }
            if (def == null) return;
            double dy = def.H > 0 ? def.OY - def.H / 2.0 : 0;
            o.X = Math.Round(p.x / K); o.Y = Math.Round(p.y / K + dy);
            list.Add((new FxRun(def, o), delay));
        }
        static FxDef Runtime_Def(string name) => ZeroStar.FxSystem.Def(name);

        public void Update(float dt)
        {
            if (list.Count == 0) { if (layer.style.display != DisplayStyle.None) layer.style.display = DisplayStyle.None; return; }
            float pw = layer.parent.layout.width, ph = layer.parent.layout.height;
            if (pw <= 0) return;
            int w = Mathf.CeilToInt(pw / K), h = Mathf.CeilToInt(ph / K);
            if (frame == null || frame.W != w || frame.H != h)
            {
                frame = new Frame(w, h); rgba = new byte[w * h * 4];
                tex = new Texture2D(w, h, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp };
                layer.style.backgroundImage = tex; layer.style.backgroundSize = new BackgroundSize(Length.Percent(100), Length.Percent(100));
            }
            layer.style.display = DisplayStyle.Flex;
            frame.Clear();
            dt = Mathf.Min(0.05f, dt);
            for (int i = list.Count - 1; i >= 0; i--)
            {
                var (fx, wait) = list[i];
                if (wait > 0) { list[i] = (fx, wait - dt); continue; }
                fx.Update(dt); fx.Draw(frame);
                if (fx.Done()) list.RemoveAt(i);
            }
            frame.Composite(rgba, null);
            tex.LoadRawTextureData(rgba); tex.Apply(false);
            layer.MarkDirtyRepaint();
        }
    }
}
