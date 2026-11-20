using System;
using System.Collections.Generic;
using System.Linq;
using PixelFX;

namespace ZeroStar
{
    public sealed class TownProject
    {
        public readonly string Id, Name, Opens, Stage, Requires;
        public readonly int Coins, Scrap, Junk, X, Y;

        TownProject(string id, string name, string opens, int coins, int scrap, int junk, int x, int y,
            string stage = null, string requires = null)
        {
            Id = id; Name = name; Opens = opens;
            Coins = coins; Scrap = scrap; Junk = junk;
            X = x; Y = y; Stage = stage; Requires = requires;
        }

        public static IReadOnlyList<TownProject> All { get; } = Array.AsReadOnly(new[]
        {
            new TownProject("plaza", "中央廣場", "噴水池、廣場人孔", 150, 10, 0, 758, 440),
            new TownProject("tower", "鐘樓修繕", "鐘樓繩梯、陽台、通往中層的吊橋", 300, 20, 5, 656, 440, "1-1"),
            new TownProject("terrace", "石台地", "中層石台地、鎮長家、中層路標", 400, 30, 0, 969, 270, requires: "tower"),
            new TownProject("wall", "城牆步道", "城牆梯子、中層西側步道", 250, 15, 0, 178, 440, requires: "terrace"),
            new TownProject("sewer", "下水道清理", "人孔通道、地下走道、地下路標", 300, 0, 10, 882, 440, "1-2", "plaza"),
            new TownProject("tree", "大樹樹屋", "樹屋繩梯與枝幹、上層東側、練習場", 350, 25, 0, 2167, 440, "1-2"),
            new TownProject("star", "觀星台", "觀星台步道與上層路標", 600, 40, 10, 1198, 140, "1-3"),
            new TownProject("house-a", "住宅 A", "石屋、屋頂踏面、新居民", 200, 10, 0, 503, 440, "1-1"),
            new TownProject("house-b", "住宅 B", "木屋、屋頂踏面、新居民", 200, 10, 0, 1166, 440, "1-2"),
            new TownProject("house-c", "住宅 C", "蘑菇屋、屋頂踏面、新居民", 200, 10, 0, 1499, 440, "1-3"),
        });

        public static TownProject Find(string id) => All.FirstOrDefault(p => p.Id == id);
    }

    public partial class Game
    {
        readonly HashSet<string> townBuilt = new HashSet<string>();
        public IEnumerable<string> TownBuiltIds => TownProject.All.Where(p => IsTownBuilt(p.Id)).Select(p => p.Id);
        public bool TrackTownConstruction { get; set; }
        public string TownWishDate, TownStarDate;
        public double? TownRaceSeconds;
        public Action OnTownBuilt;
        public bool IsTownBuilt(string id) => townBuilt.Contains(id);
        bool TownStampOpen(WorldStamp stamp) =>
            (string.IsNullOrEmpty(stamp.townProject) || IsTownBuilt(stamp.townProject))
            && (string.IsNullOrEmpty(stamp.townHiddenAfter) || !IsTownBuilt(stamp.townHiddenAfter))
            && (stamp.kind != StampKind.TownBarrier || !IsTownBuilt(stamp.role));

        internal void RestoreTownConstruction(IEnumerable<string> ids, bool track)
        {
            var built = new HashSet<string>(ids.Where(id => TownProject.Find(id) != null));
            TrackTownConstruction = track;
            if (townBuilt.SetEquals(built)) return;
            townBuilt.Clear(); townBuilt.UnionWith(built);
            if (Town) RefreshTownConstruction();
        }

#if UNITY_EDITOR
        public void SetTestTownConstruction(IEnumerable<string> ids) => RestoreTownConstruction(ids, false);
#endif

        public string TownBuildRequirement(TownProject project)
        {
            var missing = new List<string>();
            if (project.Id == "plaza" && !GuildRegistered) missing.Add("完成公會登記");
            if (project.Stage != null && !Cleared_.Contains(project.Stage)) missing.Add($"通關 {project.Stage}");
            if (project.Requires != null && !IsTownBuilt(project.Requires))
                missing.Add($"完成{TownProject.Find(project.Requires).Name}");
            return missing.Count == 0 ? null : string.Join("、", missing);
        }

        public TownProject TrackedTownProject => TrackTownConstruction
            ? TownProject.All.FirstOrDefault(p => !IsTownBuilt(p.Id) && TownBuildRequirement(p) == null)
                ?? TownProject.All.FirstOrDefault(p => !IsTownBuilt(p.Id))
            : null;

        bool SpendableTownJunk(Item item) => item.Kind == "junk" && !Locked.Contains(item);
        public int TownBuildJunk => Inv.Count(SpendableTownJunk);
        public string TownBuildShortage(TownProject project, int junk)
        {
            var missing = new List<string>();
            if (Money < project.Coins) missing.Add($"金幣 {project.Coins - Money}");
            if (Scrap < project.Scrap) missing.Add($"星塵 {project.Scrap - Scrap}");
            if (junk < project.Junk) missing.Add($"垃圾 {project.Junk - junk}");
            return missing.Count == 0 ? null : string.Join("、", missing);
        }

        public bool TryBuildTown(string id)
        {
            var project = TownProject.Find(id);
            if (!Town || project == null || IsTownBuilt(id) || TownBuildRequirement(project) != null) return false;
            var junk = Inv.Where(SpendableTownJunk).Take(project.Junk).ToArray();
            if (TownBuildShortage(project, junk.Length) != null) return false;

            Money -= project.Coins;
            Scrap -= project.Scrap;
            foreach (var item in junk) Inv.Remove(item);
            townBuilt.Add(id);
            RefreshTownConstruction();
            for (int i = -1; i <= 1; i++) Dust(project.X + i * 12, project.Y, 8);
            Sfx("clank");
            OnTownBuilt?.Invoke();
            return true;
        }

        void RefreshTownConstruction()
        {
            composition?.SelectTownStamps(TownStampOpen);
            var rebuilt = TownArt.Level(composition);
            Data.Solids.Clear(); Data.Solids.AddRange(rebuilt.Solids);
            Data.Platforms.Clear(); Data.Platforms.AddRange(rebuilt.Platforms);
            Data.TownSteps.Clear(); Data.TownSteps.AddRange(rebuilt.TownSteps);
            Map.LoadSolids(Data.Solids);
            SyncTownActivityCollision();
            TownArt.RebuildStructures(composition);
            layout?.BindLighting(composition);
            ReadTownTraversal();
            UpdateTownResidents();
            NearNow = null;
        }

        internal (int x, int y) TownMayorPosition => IsTownBuilt("terrace") ? (1094, 270) : (794, TownArt.FLOOR);

        void UpdateTownResidents()
        {
            Folk.SetResident("house-a", "pebble", "石屋居民・石栗", 505, IsTownBuilt("house-a"), "住在城門旁，早上就聽得見公會開門。");
            Folk.SetResident("house-b", "kid", "木屋居民・木豆", 1167, IsTownBuilt("house-b"), "木頭曬暖了，整間屋子都有香味。");
            Folk.SetResident("house-c", "shroom", "蘑菇屋居民・小蕈", 1509, IsTownBuilt("house-c"), "我在屋頂種了蕈菇，等下一場雨。");
        }

        void DrawTownWorksites(Frame frame)
        {
            var p = new Painter(frame);
            double elevated = TownArt.ElevatedVisibility(frame.Oy + frame.CameraFractionY);
            foreach (var gate in townBarriers)
            {
                if (elevated <= 0 || gate.x + gate.w + 9 < frame.Ox || gate.x - 9 > frame.Ox + frame.W) continue;
                p.Fade = elevated;
                int x = gate.x + gate.w / 2, y = gate.y + gate.h;
                p.Rect(gate.x, gate.y, gate.w, gate.h, 0xff333041);
                p.Rect(gate.x + 2, gate.y + 3, gate.w - 4, gate.h - 3, 0xff69607c);
                p.Rect(x - 9, y - 19, 18, 13, 0xff493d54);
                p.Rect(x - 8, y - 18, 16, 11, 0xff92d5f1);
                p.Rect(x - 1, y - 16, 2, 4, 0xff493d54);
                p.Rect(x - 1, y - 11, 2, 2, 0xff493d54);
            }
            foreach (var site in TownProject.All)
            {
                int x = site.X, y = site.Y;
                if (IsTownBuilt(site.Id) || x < frame.Ox - 24 || x > frame.Ox + frame.W + 24
                    || y < frame.Oy || y - 24 >= frame.Oy + frame.H || y < TownArt.FLOOR) continue;
                // 通行的街道留在圍欄前方。梯子、踏面和入口由同一個工程狀態鎖住。
                p.Fade = 1;
                if (site.Id == "sewer" && IsTownBuilt("plaza"))
                {
                    // 人孔本身要露出來，封閉告示移到鐵蓋旁邊。
                    p.Rect(x + 26, y - 11, 2, 11, 0xff333041);
                    p.Rect(x + 22, y - 16, 10, 9, 0xff493d54);
                    p.Rect(x + 23, y - 15, 8, 7, 0xff92d5f1);
                    p.Rect(x + 26, y - 14, 2, 4, 0xff493d54);
                    continue;
                }
                p.Rect(x - 20, y - 14, 3, 14, 0xff333041);
                p.Rect(x + 17, y - 14, 3, 14, 0xff333041);
                p.Rect(x - 22, y - 12, 44, 7, 0xff493d54);
                for (int i = -19; i < 19; i += 7) p.Line(x + i, y - 7, x + i + 4, y - 11, 0xff70b3d6);
                p.Rect(x - 7, y - 23, 14, 12, 0xff493d54);
                p.Rect(x - 6, y - 22, 12, 10, 0xff92d5f1);
                p.Rect(x, y - 20, 2, 4, 0xff493d54);
                p.Rect(x, y - 15, 2, 1, 0xff493d54);
            }
        }
    }
}
