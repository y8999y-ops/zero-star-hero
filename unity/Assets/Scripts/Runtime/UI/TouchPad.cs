// 手機的觸控按鈕（網頁版 index.html 的 #touch、style.css 的 body.touch #rightPad）。
// 位置、大小照網頁版：A＝攻擊鍵（clamp(58px, 19vh, 86px)）、B＝0.7A；攻擊右下、閃避在左邊、技能斜上、大招在攻擊正上方、吸收在技能正上方。
// 只負責畫；手指按到哪一顆由 GameRoot 問 ButtonAt（原本的觸控判斷、搖桿、快滑都在 GameRoot）。
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;
using static ZeroStar.UI.Ui;

namespace ZeroStar.UI
{
    public class TouchPad
    {
        readonly VisualElement root, pad, atk, dash, skill, ult, absorb, absorbIcon, skillCd, stickBase, stickKnob; readonly Label hintLeft;
        readonly VisualElement absorbRing;
        /// 按著的鍵（attack、dash、skill、ult、absorb）：GameRoot 每一格更新
        public readonly HashSet<string> Down = new HashSet<string>();
        public bool StickOn; public Vector2 StickOff;   // 搖桿頭的位移（CSS px）
        bool hintGone; float clock, hintK = 0.7f;

        public TouchPad(VisualElement parent, Texture2D ultTex)
        {
            root = Box(parent, "touch"); Abs(root, 0, 0, 0, 0); root.style.display = DisplayStyle.None;
            // 左下的搖桿：平常看不見，手指按下左半邊才出現
            stickBase = Box(root, "stickBase"); Size(stickBase, 110, 110); Abs(stickBase, 92 - 55, null, null, 36); Round(stickBase, 55);
            Border(stickBase, 2, C("#ffffff", 0.55f)); stickBase.style.backgroundColor = C("#0a081a", 0.28f); stickBase.style.display = DisplayStyle.None;
            stickKnob = Box(stickBase); Size(stickKnob, 44, 44); Abs(stickKnob, 55 - 2 - 22, 55 - 2 - 22); Round(stickKnob, 22); stickKnob.style.backgroundColor = C("#fff6c8", 0.55f);
            hintLeft = Text(root, "左右拖動＝移動　往上滑＝跳　往下滑＝穿過平台", 12, "#a59fbd"); Abs(hintLeft, 16, null, null, 14);

            pad = Box(root, "rightPad"); Abs(pad, null, null, 14, 12);
            atk = Btn("btnAtk"); dash = Btn("btnDash"); skill = Btn("btnSkill"); ult = Btn("btnUlt");
            skillCd = Box(skill); Abs(skillCd, 0, null, 0, 0); skillCd.style.backgroundColor = C("#080410", 0.45f);
            var uc = Box(ult); Abs(uc, 0, 0, 0, 0); Img(uc, ultTex);
            // 吸收：金色的圈、深色的圓、中間是魔物核的圖示；底下「吸收」兩個字
            absorb = Box(pad, "btnAbsorb"); Abs(absorb);
            absorbRing = Box(absorb); AbsL(absorbRing, -5, -5, -5, -5); Round(absorbRing, 999); absorbRing.style.backgroundColor = C("#3a1a06");
            var gold = Box(absorbRing); AbsL(gold, 2, 2, 2, 2); Round(gold, 999); gold.style.backgroundColor = C("#ffd84a");
            var dark = Box(gold); AbsL(dark, 3, 3, 3, 3); Round(dark, 999); dark.style.backgroundColor = C("#1a1206");
            var mid = Box(dark); AbsL(mid, Length.Percent(22.5f), Length.Percent(22.5f), Length.Percent(22.5f), Length.Percent(22.5f)); Round(mid, 999); mid.style.backgroundColor = C("#3a2a10");
            absorbIcon = Box(absorb); AbsL(absorbIcon, Length.Percent(15), Length.Percent(15), Length.Percent(15), Length.Percent(15));
            var ab = Text(absorb, "吸收", 12, "#ffe27a", true, 1); Abs(ab, 0, null, 0, -18); ab.style.unityTextAlign = TextAnchor.MiddleCenter; ab.style.letterSpacing = 2;
        }
        VisualElement Btn(string name) { var b = Box(pad, name); Abs(b); b.style.overflow = Overflow.Hidden; Round(b, 999); return b; }
        static void AbsL(VisualElement e, Length l, Length t, Length r, Length b) { e.style.position = Position.Absolute; e.style.left = l; e.style.top = t; e.style.right = r; e.style.bottom = b; }
        static void Place(VisualElement e, float size, float right, float bottom) { Size(e, size, size); e.style.right = right; e.style.bottom = bottom; }

        public void Update(Game g, float dt, bool on, bool talking, System.Func<string, bool> Locked)
        {
            root.style.display = on ? DisplayStyle.Flex : DisplayStyle.None;
            if (!on) return;
            clock += dt;
            root.style.opacity = talking ? 0 : 1;
            float vh = root.layout.height > 0 ? root.layout.height / 100 : 7.2f;
            float A = Mathf.Clamp(19 * vh, 58, 86), B = A * 0.7f;
            Size(pad, A * 1.95f, A * 1.95f);
            Place(atk, A, 0, 0); Place(dash, B, A + 8, 2); Place(skill, B, A * 0.78f, A * 0.78f); Place(ult, B, 2, A + 8);
            Place(absorb, B, A * 0.78f, A * 1.48f + 20);
            // 攻擊鍵：城鎮＝對話（旁邊沒人變淡）；旁邊有寶箱、門、祭壇＝換圖示、發亮
            string kind = g.Town ? "talk" : g.UseT?.Kind switch { "chest" => "chest", "door" => "door", "hand" => "hand", _ => "atk" };
            bool aDown = Down.Contains("attack");
            Img(atk, "tb-" + kind + (aDown ? "-on" : ""));
            float glow = kind != "atk" && !(g.Town && g.NearNow == null) ? 0.5f - 0.5f * Mathf.Cos(clock / (g.Town ? 1.2f : 1f) * Mathf.PI * 2) : 0;
            atk.style.opacity = g.Town && g.NearNow == null ? 0.45f : 1;
            atk.style.unityBackgroundImageTintColor = Color.Lerp(Color.white, C("#fff2b0"), glow * 0.6f);
            atk.style.scale = new Scale(Vector2.one * (aDown ? 0.94f : 1));
            Img(dash, Down.Contains("dash") ? "tb-dash-on" : "tb-dash"); dash.style.scale = new Scale(Vector2.one * (Down.Contains("dash") ? 0.94f : 1));
            Img(skill, Down.Contains("skill") ? "tb-skill-on" : "tb-skill"); skill.style.scale = new Scale(Vector2.one * (Down.Contains("skill") ? 0.94f : 1));
            var P = g.Player;
            skillCd.style.height = Length.Percent((float)System.Math.Max(0, P.SkillCd / P.SkillMax) * 100);
            skill.style.unityBackgroundImageTintColor = P.Mp < Player.MP_COST ? new Color(0.55f, 0.55f, 0.6f) : Color.white;
            ult.style.scale = new Scale(Vector2.one * (Down.Contains("ult") ? 0.94f : 1));
            // 城鎮不能用技能、大招；1-1 還沒教到的鍵先藏起來
            dash.style.visibility = Locked("dash") ? Visibility.Hidden : Visibility.Visible;
            skill.style.display = g.Town ? DisplayStyle.None : DisplayStyle.Flex; skill.style.visibility = Locked("skill") ? Visibility.Hidden : Visibility.Visible;
            ult.style.display = g.Town ? DisplayStyle.None : DisplayStyle.Flex; ult.style.visibility = Locked("ult") ? Visibility.Hidden : Visibility.Visible;
            // 吸收：旁邊有魔物核才出現，一直輕輕脹縮發光
            bool showAb = g.AbsorbNear != null && !g.Town;
            absorb.style.display = showAb ? DisplayStyle.Flex : DisplayStyle.None;
            if (showAb)
            {
                var t = Tex("icons/" + g.AbsorbNear.Item.Icon); if (t != null) Img(absorbIcon, t);
                float pulse = 0.5f - 0.5f * Mathf.Cos(clock / 0.9f * Mathf.PI * 2);
                absorb.style.scale = new Scale(Vector2.one * (Down.Contains("absorb") ? 0.94f : 1 + 0.06f * pulse));
            }
            // 搖桿
            stickBase.style.display = StickOn ? DisplayStyle.Flex : DisplayStyle.None;
            stickKnob.style.translate = new Translate(StickOff.x, StickOff.y);
            if (StickOn) hintGone = true;
            hintK = Mathf.MoveTowards(hintK, hintGone ? 0 : 0.7f, dt);
            hintLeft.style.opacity = hintK;
        }

        /// 手指按在哪一顆（面板座標）；吸收鍵最上面、優先
        public string ButtonAt(Vector2 p)
        {
            if (root.resolvedStyle.display == DisplayStyle.None) return null;
            foreach (var (e, k) in new[] { (absorb, "absorb"), (atk, "attack"), (dash, "dash"), (skill, "skill"), (ult, "ult") })
            {
                if (e.resolvedStyle.display == DisplayStyle.None || e.resolvedStyle.visibility == Visibility.Hidden) continue;
                var r = e.worldBound;
                if (Vector2.Distance(p, r.center) < r.width / 2) return k;
            }
            return null;
        }
    }
}
