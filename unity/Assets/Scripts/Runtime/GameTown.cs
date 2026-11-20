// main.js 裡碎星鎮的部分（TOWN）：townTick（走路、路人、可以對話的人）、townArrive（任務板、主線、台詞）、
// 居民頭上的自言自語泡泡（updateBubble）、可以對話時頭上的「！」（drawPrompt）、引導目標頭上的「!」（drawGuideMark）。
// 對話、公會／工坊／旅館的視窗在階段 4b、4c；現在按互動只會通知 OnTalk。
using System;
using System.Collections.Generic;
using System.Linq;
using PixelFX;

namespace ZeroStar
{
    public partial class Game
    {
        public readonly bool Town;
        /// 無限討伐（main.js 的 ENDLESS）：舊的一個畫面高的 1-1 地形，沒有祭壇、寶箱、傳送門、機關、關卡流程，怪一直冒出來
        public readonly bool Endless;
        public Folk Folk;
        // ---- 存檔裡跟城鎮有關的（公會、引導、任務）
        public bool GuildRegistered; public int GuildDone; public int TGuide = -1;
        public readonly QuestBook Quests = new QuestBook();

        /// 可以對話的對象：店家（NPCS）、路標、路人
        public class Near { public string Id, Name, Place; public double X; public double? Hgt, FootY; public Folk.O FolkO; }
        public Near NearNow;
        bool prevTownAtk;
        bool prevTownDown;
        public Action<Near> OnTalk;   // 按互動：對話、視窗（階段 4b、4c 接上）
        public bool TownBusy;         // 對話或視窗開著：主角不動

        static double GuideX(int k) => k < 2 ? TownArt.NPCS[0].x : k < 4 ? TownArt.NPCS[k-1].x : TownArt.SIGNPOST_X;
        static readonly double[] GUIDE_HEAD = { 40, 40, 62, 58, 44 };
        static readonly string[] GUIDE_LINE = { null, null, "系統：下一站，岩叔的工坊。", "系統：再來是菇媽的旅館。", "系統：準備好了就去城門旁的路標。" };
        static readonly Dictionary<string, string[]> AMBIENT = new Dictionary<string, string[]>
        {
            ["clerk"] = new[] { "（推眼鏡）今天的委託也很多呢。", "請排隊……啊，只有你一個。", "公會的茶，是我泡的。……喝嗎？" },
            ["golem"] = new[] { "……（鏘）", "……星塵。越多越好。", "……爐子，今天很旺。" },
            ["mushroom"] = new[] { "今天的湯是蘑菇湯～不是親戚喔。", "累了就來休息吧～", "頭上的孩子們又長高了呢～" },
        };

        /// 引導的下一步：還沒講到的上一步提示就不講了
        public void GuideNext(string line)
        {
            TGuide++;
            Say.Queue.RemoveAll(q => q.Item3 == "guide");
            if (line != null) Say.Push(line, 3.4, "guide");
        }
        public List<string> UnlockedStages() => Unlocked();
        List<string> Unlocked() { var o = new[] { "1-1", "1-2", "1-3", "1-4" }; return o.Where((id, i) => i == 0 || Cleared_.Contains(o[i - 1])).ToList(); }

        /// main.js 的 townArrive：任務板補滿、檢查主線、「碎星鎮」、引導台詞
        void TownArrive()
        {
            if (TGuide < 0) TGuide = GuildRegistered && GuildDone > 0 ? 5 : GuildRegistered ? 1 : 0;
            Quests.RefreshBoard(Unlocked());
            QuestProgress("tick");
            Say.Show("碎星鎮", 2);
            if (!GuildRegistered) Say.Push("系統：這裡是碎星鎮。先去公會找波波。", 3.2);
            else if (TGuide >= 0 && TGuide < GUIDE_LINE.Length && GUIDE_LINE[TGuide] != null) Say.Push(GUIDE_LINE[TGuide], 3.2);
        }

        Near TownNearby(double x,double y)
        {
            var mayor = TownMayorPosition;
            if (Math.Abs(x - mayor.x) < 24 && Math.Abs(y - mayor.y) < 17)
                return new Near { Id = "town-mayor", Name = "鎮長", Place = "town-mayor", X = mayor.x, FootY = mayor.y, Hgt = TownArt.NpcSize("mayor").h };
            foreach (var n in TownArt.NPCS) if (Math.Abs(n.x - x) < 26 && Math.Abs(TownArt.FootY(n.id)-y)<32) return new Near { Id = n.id, Name = n.name, Place = n.place, X = n.x };
            var destination = FindTownStop(x, y);
            if (destination != null) return destination;
            var activity = NearbyTownActivity(x, y);
            if (activity != null) return activity;
            if (townStops.Count == 0 && Math.Abs(TownArt.SIGNPOST_X - x) < 22 && Math.Abs(TownArt.FootY("sign")-y)<32) return new Near { Id = "sign", Name = "路標", X = TownArt.SIGNPOST_X, Place = "sign" };
            foreach (var gate in townBarriers)
                if (Math.Abs(x - gate.x - gate.w / 2.0) < 22 && Math.Abs(y - gate.y - gate.h) < 10)
                    return new Near { Id = gate.project, Name = $"{TownProject.Find(gate.project)?.Name ?? "步道"}・施工中",
                        Place = "town-worksite", X = gate.x + gate.w / 2.0, FootY = gate.y + gate.h, Hgt = gate.h };
            foreach (var site in TownProject.All)
                if (site.Y == TownArt.FLOOR && !IsTownBuilt(site.Id) && Math.Abs(x - site.X) < 18 && Math.Abs(y - site.Y) < 17)
                    return new Near { Id = site.Id, Name = $"{site.Name}・施工中", Place = "town-worksite", X = site.X, FootY = site.Y, Hgt = 24 };
            return null;
        }

        /// main.js 的 townTick（城鎮不能戰鬥：對話＝手機的攻擊鍵、電腦的 F；技能、大招不能用）
        void TownTick(double dt)
        {
            SceneLight.Update(dt);
            if (!TownBusy)
            {
                bool training = TownTrainingZone;
                bool atk = Input.Absorb || IsTouch && !training && Input.Attack;
                if (!training) Input.Attack = false;
                Input.Consume("skill"); Input.Consume("ult");
                if (TownRaceClock < 0)
                {
                    Player.Vx = Player.Vy = 0;
                    Input.Consume("jump"); Input.Consume("dash"); Input.Consume("drop");
                }
                else if (!UpdateTownLadder(dt))
                {
                    if (Input.Down && !prevTownDown && Player.Grounded && Map.OnPlatform(Player.X, Player.Y))
                        Input.Drop = true;
                    Player.Update(dt, this);
                }
                prevTownDown = Input.Down;
                Player.X = Math.Max(20, Math.Min(TownArt.TOWN_W - 20, Player.X));
                UpdateStageObjectsPlayer(dt);
                Folk.Update(dt, Player.X);
                NearNow = TownNearby(Player.X,Player.Y);
                if (NearNow == null && Math.Abs(TownArt.FLOOR - Player.Y) < 32) { var f = Folk.Nearby(Player.X); if (f != null) NearNow = new Near { Id = f.Id, Name = f.Info.Name, X = f.X, FolkO = f, Hgt = TownArt.NpcSize(f.Id).h }; }
                if (atk && !prevTownAtk && NearNow != null && Player.Grounded) OnTalk?.Invoke(NearNow);
                prevTownAtk = atk;
            }
            else { Player.Vx = 0; prevTownAtk = true; }
            TickTownActivities(dt);
            Drops.Update(dt, Player, 16, Map, PickUp);
            Fx.Update(dt);
            CamX = DeadFollow(CamX + W / 2.0, Player.X + LookAhead(dt, 30), 14, 5, dt) - W / 2.0;
            CamX = ClampTownCameraX(CamX);
            FollowTownHeight(dt);
            if (TownUnderground) TownArt.TickSewerWater(dt);
            Say.Update();
            UpdateBubble(dt);
        }

        // ---- 路人泡泡：畫面裡的居民偶爾自言自語（不能是正在旁邊可以對話的那個）
        public string BubbleText; public double BubbleX, BubbleHead; object bubbleWho; double bubbleT, bubbleWait = 3;
        void UpdateBubble(double dt)
        {
            if (TownBusy || TownUnderground) { BubbleText = null; bubbleWho = null; return; }
            bool IsNear(object n) => NearNow != null && (n is Folk.O fo ? fo == NearNow.FolkO : n is string id && NearNow.FolkO == null && id == NearNow.Id);
            if (bubbleWho != null)
            {
                if ((bubbleT -= dt) <= 0 || IsNear(bubbleWho)) { BubbleText = null; bubbleWho = null; bubbleWait = 5 + Rnd.Next() * 4; }
            }
            else if ((bubbleWait -= dt) <= 0)
            {
                var v = ViewRect();
                var cand = TownArt.NPCS.Select(n => ((object)n.id, n.x)).Concat(Folk.List.Where(o => o.Follow == null).Select(o => ((object)o, o.X)));
                var seen = cand.Where(c => !IsNear(c.Item1) && !(TGuide < 5 && c.Item2 == GuideX(TGuide)) && !(c.Item2 == GuideX(0) && Quests.Active.Any(q => q.Ready)) && c.Item2 > CamX + v.x0 + 20 && c.Item2 < CamX + v.x0 + v.w - 20).ToList();
                if (seen.Count > 0)
                {
                    bubbleWho = seen[(int)Math.Floor(Rnd.Next() * seen.Count)].Item1;
                    var L = bubbleWho is string id ? AMBIENT[id] : ((Folk.O)bubbleWho).Info.Ambient;
                    BubbleText = L[(int)Math.Floor(Rnd.Next() * L.Length)];
                    bubbleT = 3.2;
                }
                else bubbleWait = 2;
            }
            if (bubbleWho != null)
            {
                string bid = bubbleWho is string s ? s : ((Folk.O)bubbleWho).Id;
                BubbleX = bubbleWho is string ? TownArt.NPCS.First(n => n.id == bid).x : ((Folk.O)bubbleWho).X;
                BubbleHead = TownArt.FootY(bid) - TownArt.NpcSize(bid).h - 4;
            }
        }

        /// 城鎮的畫（main.js render 的 TOWN 分支）：居民、路人、引導的「!」、可以對話的「！」
        bool townPeopleDrawn;
        void DrawTownPeople(Frame frame)
        {
            if (TownUnderground)
            {
                DrawTownActivities(frame, true);
                TownArt.Shadow(frame, Player.X, 9, footY: SewerFloor);
                TownArt.SnapPeople(frame);
                townPeopleDrawn = true;
                if (NearNow != null && NearNow.Place != "town-activity" && !TownBusy)
                    DrawBang(frame, NearNow.X, (NearNow.FootY ?? SewerFloor) - (NearNow.Hgt ?? 27) - 12);
                return;
            }
            // 腳下的影子 → 記下畫面（之後幫角色描外框、加邊緣光）→ 居民、路人
            DrawTownWorksites(frame);
            DrawTownActivities(frame, false);
            var mayor = TownMayorPosition;
            double mayorVisible = mayor.y == TownArt.FLOOR ? 1 : TownArt.ElevatedVisibility(frame.Oy + frame.CameraFractionY);
            if (mayorVisible > 0) TownArt.Shadow(frame, mayor.x, 7, 0.3 * mayorVisible, mayor.y);
            foreach (var n in TownArt.NPCS) TownArt.Shadow(frame, n.x, (int)(TownArt.NpcSize(n.id).w * 0.36),footY:TownArt.FootY(n.id));
            foreach (var o in Folk.List) TownArt.Shadow(frame, o.X, (int)(TownArt.NpcSize(o.Id).w * 0.36));
            {
                int foot = (int)Map.FloorAt(Player.X, Player.Y);
                double air = Math.Max(0, Math.Min(1, (foot - Player.Y) / 40.0));
                TownArt.Shadow(frame, Player.X, (int)Pf.Round(9 - 4 * air), 0.3 - 0.15 * air, foot);
            }
            TownArt.SnapPeople(frame);
            TownArt.DrawNpcs(frame, sceneClock);
            Folk.Draw(frame);
            // 鎮長：藍紫色貓頭鷹（game/fx/town/owl.js，2026-11-20 使用者通過）。跟他說話（建設委託視窗開著）時播說話＋揮翅膀
            if (mayorVisible > 0)
            {
                bool talking = TownBusy && NearNow?.Place == "town-mayor";
                Blit.Draw(frame, Baked.Anim(talking ? "npc:mayor:talk" : "npc:mayor"), sceneClock, mayor.x, mayor.y + 1, false, mayorVisible);
            }
            townPeopleDrawn = true;
            // 引導：要去的地方頭上跳一個「!」
            if (!TownBusy)
            {
                int k = TGuide;
                bool skip = false;
                if (Quests.Active.Any(q => q.Ready) && k != 0) { if (k == 1) skip = true; }   // 有任務可以交的大驚嘆號在階段 4c
                if (!skip && k < 5 && k >= 0)
                {
                    double bob = Pf.Round(Math.Abs(Pf.Sin(sceneClock * 3.2)) * -3);
                    CombatFx.DrawAlert(frame, GuideX(k), TownArt.FootY(k<2?"clerk":k==2?"golem":k==3?"mushroom":"sign") - GUIDE_HEAD[k] + bob, 0.35);
                }
            }
            if (NearNow != null && NearNow.Place != "town-activity" && !TownBusy) DrawBang(frame, NearNow.X, NearNow.Place == "sign" ? TownArt.FootY("sign")-44
                : (NearNow.FootY ?? TownArt.FootY(NearNow.Id)) - (NearNow.Hgt ?? TownArt.NpcSize(NearNow.Id).h) - 12);
        }
    }
}
