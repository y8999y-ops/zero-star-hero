// main.js 裡給王（boss.js）用的部分：bossApi（封鎖範圍、高台、受傷、台詞、星箱、吸收碎片、血條、大招橫幅）、
// 王房屋頂破洞的垃圾塞子（plug）、王戰中死掉、打倒王之後開傳送門。
using System;
using System.Linq;
using PixelFX;

namespace ZeroStar
{
    public partial class Game
    {
        // ---- bossApi
        public (double l, double r) BossLock() => Director?.Lock ?? (16, Data.W - 16);   // 沒封住時＝整張地圖（WALL＝16）
        public RectD BossTop
        {
            get
            {
                if (StageD.ArenaInfo?.Top != null) return StageD.ArenaInfo.Top.Value;
                var p = Data.Platforms[2]; return new RectD { X = p.X, Y = p.Y, W = p.W };
            }
        }
        public bool BossHurt(double dmg, double fromX) => Player.Hurt(dmg, fromX, this);
        /// 王倒下的地方出現一個星箱（最高級），戰鬥結束後走過去開
        public void BossDropLoot(double x, double y)
        {
            Chest = MakeChest(Math.Max(16 + 30, Math.Min(Data.W - 16 - 30, x)), 3, StageD.ArenaInfo?.Floor ?? Data.Floor);
            { var o = ChestTiers.Opts(3); o.X = Chest.X; o.Y = Chest.Y; chestFx = new FxRun(PixelFX.Fx.TreasureChest.Def, o); }   // main.js 的 makeChest 當下就建好寶箱的特效
            SceneLight.AddFlash(Chest.X, Chest.Y - 12, 90, 3, 0.8, "#d08cff");
            Say.Unshift("系統：……王掉了一個星箱。走過去，按【攻擊】打開它。", 3);
        }
        public void BossAbsorb()
        {
            GainXp(160);
            Say.Unshift("系統：吸收了大胃王吞下去的星星碎片！……你又亮了一點點。", 3);
        }
        // 畫面下方的王血條、大招橫幅（網頁版是 HTML，畫在畫面外；這裡記下來給 GameRoot 畫）
        public bool BossBarOn; public double BossBarK = 1, BossBarHideAt = -1; public int BossBarPhase = 1;
        public string BossUltName; public double BossUltAt = -1e9;
        public void BossBar(double k, int phase)
        {
            BossBarOn = true; BossBarK = k; BossBarPhase = phase;
            if (k <= 0) BossBarHideAt = SimMs + 1200;
        }
        public void BossUlt(string name) { BossUltName = name; BossUltAt = SimMs; }

        // ---- 王房屋頂的破洞：封住時被一團垃圾砸進來塞住；王戰中死掉解除封鎖就打開，打倒王之後維持塞住
        bool plugOn, plugLanded; double plugT;
        void UpdatePlug(double dt)
        {
            if (BossBarHideAt >= 0 && SimMs >= BossBarHideAt) { BossBarOn = false; BossBarHideAt = -1; }
            var hole = StageD.ArenaInfo?.Hole;
            if (hole == null) return;
            if (Director?.Lock != null && !plugOn) { plugOn = true; plugT = 0; plugLanded = false; Map.SetSolid(hole.Value, true); }
            else if (plugOn && Director?.Lock == null && !StageDone && !(Director?.Done ?? false)) { plugOn = false; Map.SetSolid(hole.Value, false); }
            if (plugOn) { plugT += dt; if (!plugLanded && plugT >= 0.3) { plugLanded = true; Dust(hole.Value.X + hole.Value.W / 2, hole.Value.Y, 10); Fx.Shake(0.3, 3); Sfx("clank"); } }
        }
        void DrawPlug(Frame frame)
        {
            if (!plugOn) return;
            var h = StageD.ArenaInfo.Hole.Value;
            FeatureArt.DrawPlug(frame, h.X, h.Y, h.W, h.H, plugT);
        }

        // ---- 王戰中死掉
        /// 回傳要送回去的位置（王倒下融化中時死掉＝在王房裡原地復活）；王戰中死掉：王和房裡的小怪收掉、解除封鎖
        (double x, double y)? BossDeath((double x, double y)? to)
        {
            if (Director?.Lock != null && StageD.ArenaInfo != null && Enemies.Any(e => e is Boss b && b.IsDying)) to = (Player.X, StageD.ArenaInfo.Floor);
            bool bossFight = Director?.Lock != null && StageD.ArenaInfo != null && Enemies.Any(e => e is Boss b && !b.IsDying);
            if (bossFight)
            {
                var (l, r) = Director.Lock.Value;
                for (int i = Enemies.Count - 1; i >= 0; i--) { var e = Enemies[i]; if (e.IsBoss || (e.X >= l && e.X <= r && e.Y > StageD.ArenaInfo.Floor - 220)) Enemies.RemoveAt(i); }
                Director.ResetLock();
                BossBarOn = false;
            }
            return to;
        }

        // ---- 1-4 沒有出口傳送門：打倒王之後，在主角前面打開一個（一定開在王房的地上，不跟星箱疊在一起）
        void OpenBossPortal()
        {
            double px = Pf.Round(Math.Max(60, Math.Min(Data.W - 60, Player.X + Player.Face * 70)));
            double py = Map.FloorAt(px, Player.Y - 8);
            var A = StageD.ArenaInfo;
            if (A != null)
            {
                double l = A.L, r = A.R;
                double ClampA(double v) => Pf.Round(Math.Max(l + 40, Math.Min(r - 40, v)));
                bool Away(double v) => Math.Abs(v - Player.X) >= 40 && (Chest == null || Math.Abs(v - Chest.X) >= 72);
                var cand = new[] { 70.0, -70, 120, -120, 170, -170 }.Select(d => ClampA(Player.X + Player.Face * d)).Concat(new[] { ClampA(l), ClampA(r) }).ToList();
                double cx = Chest?.X ?? 0;
                int fi = cand.FindIndex(v => Away(v));
                px = fi >= 0 ? cand[fi] : cand.Aggregate((b, v) => Math.Abs(v - cx) > Math.Abs(b - cx) ? v : b);
                py = A.Floor;
            }
            PortalX = px; PortalY = py;
            Fx.Spawn(Baked.Anim("portal"), PortalX.Value, PortalY, back: true, keep: true);
            SceneLight.AddFlash(PortalX.Value, PortalY - 16, 110, 3, 0.6, "#a8f0ff");
        }
    }
}
