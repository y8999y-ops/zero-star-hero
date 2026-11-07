// save.js：存檔。格式跟網頁版的存檔（localStorage 的 zero-hero-save-v1，ver 3）一模一樣的 JSON，
// 所以網頁版的存檔可以直接匯入：網頁版設定裡「匯出存檔」複製一段代碼，Unity 版設定裡「從剪貼簿匯入」。
//   存在 Application.persistentDataPath/zero-hero-save.json（電腦在使用者資料夾、手機在 App 的私人資料夾），寫之前先把上一份留成 .bak。
//   存什麼：等級、經驗、金幣、星塵、背包、身上裝備（含鎖定、新撿到）、自動拆解、通關次數、形態（靈核、技能樹、帶哪幾個）、
//   公會（登記、交付數）、任務（進行中、任務板、主線完成、統計、追蹤）、料理、魔力上限、靈核換的屬性、打過的關卡、
//   教過的按鍵、看過的提示、拿過的一次性資源、地圖走過的地方、保底計數、看過開場沒有、城鎮引導走到第幾步。
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using UnityEngine;

namespace ZeroStar
{
    public static class SaveData
    {
        public const int VER = 3;
        public static string FilePath => Path.Combine(Application.persistentDataPath, "zero-hero-save.json");
        const string CODE = "ZSH1:";

        // ================= 寫 =================
        public static string ToJson(Game g)
        {
            var forms = new Dictionary<string, object>();
            foreach (var kv in g.FormsOwned)
            {
                var tree = new Dictionary<string, object>();
                foreach (var t in g.Tree) if (t.Key.StartsWith(kv.Key + ":") && t.Value > 0) tree[t.Key.Substring(kv.Key.Length + 1)] = t.Value;
                int spentCore = g.CoreSpent.TryGetValue(kv.Key, out var cs) ? cs : 0;
                forms[kv.Key] = new Dictionary<string, object> { ["pts"] = kv.Value - spentCore, ["tree"] = tree, ["got"] = 1 + kv.Value };
            }
            var p = new Dictionary<string, object>
            {
                ["ver"] = VER, ["lv"] = g.Lv, ["xp"] = g.Xp, ["coins"] = g.Money, ["scrap"] = g.Scrap,
                ["inv"] = g.Inv.Select(it => (object)ItemJson(it, g)).ToList(),
                ["equip"] = g.Equip.Where(kv => kv.Value != null).ToDictionary(kv => kv.Key, kv => (object)ItemJson(kv.Value, g)),
                ["auto"] = g.Auto, ["clears"] = g.Clears,
                ["forms"] = new Dictionary<string, object> { ["owned"] = forms, ["carry"] = g.Carry.Cast<object>().ToList(), ["cur"] = g.Player.Form },
                ["guild"] = new Dictionary<string, object> { ["registered"] = g.GuildRegistered, ["done"] = g.GuildDone, ["quest"] = null },
                ["quests"] = new Dictionary<string, object>
                {
                    ["active"] = g.Quests.Active.Select(q => (object)QuestJson(q)).ToList(), ["board"] = g.Quests.Board.Select(q => (object)QuestJson(q)).ToList(),
                    ["sysDone"] = g.SysDone.ToDictionary(s => s, s => (object)true),
                    ["stats"] = new Dictionary<string, object> { ["enhanceMax"] = g.Quests.EnhanceMax, ["meals"] = g.Quests.Meals, ["rerolls"] = g.Quests.Rerolls },
                    ["tracked"] = g.Quests.Tracked.Cast<object>().ToList(),
                },
                ["meal"] = g.Meal, ["mpBonus"] = g.MpBonus, ["coreBonus"] = g.CoreBonus.ToDictionary(kv => kv.Key, kv => (object)kv.Value),
                ["cleared"] = g.Cleared_.ToDictionary(s => s, s => (object)true), ["taught"] = g.Taught.ToDictionary(s => s, s => (object)1),
                ["react"] = g.Reacted.ToDictionary(s => s, s => (object)1),
                ["found"] = g.Found.ToDictionary(kv => kv.Key, kv => (object)kv.Value.ToDictionary(x => x.Key, x => (object)x.Value)),
                ["mapSeen"] = g.MapSeen.ToDictionary(kv => kv.Key, kv => (object)new string(kv.Value.Select(b => b ? '1' : '0').ToArray())),
                ["pity"] = new Dictionary<string, object> { ["legend"] = g.PityLegend, ["myth"] = g.PityMyth },
                ["lore"] = g.Lore, ["tipUse"] = g.TipUse ? 1 : 0, ["seenSet"] = g.SeenSet ? 1 : 0, ["seenCoreTip"] = g.SeenCoreTip ? 1 : 0,
                ["seenIntro"] = g.SeenIntro, ["tguide"] = g.TGuide,
            };
            var sb = new StringBuilder(); Write(sb, p); return sb.ToString();
        }
        static Dictionary<string, object> ItemJson(Item it, Game g)
        {
            var d = new Dictionary<string, object> { ["uid"] = it.Uid, ["kind"] = it.Kind, ["icon"] = it.Icon, ["rarity"] = it.Rarity, ["ilvl"] = it.Ilvl, ["name"] = it.Name, ["plus"] = it.Plus };
            if (it.Base != null) d["base"] = it.Base; if (it.Unique != null) d["unique"] = it.Unique; if (it.Myth != null) d["myth"] = it.Myth;
            if (it.Set != null) d["set"] = it.Set; if (it.Junk != null) d["junk"] = it.Junk;
            d["main"] = it.Main == null ? null : new Dictionary<string, object> { ["id"] = it.Main.Id, ["v"] = it.Main.V };
            d["affixes"] = it.Affixes.Select(a => (object)new Dictionary<string, object> { ["id"] = a.Id, ["tier"] = a.Tier, ["v"] = a.V }).ToList();
            if (it.Myth != null) d["awaken"] = new Dictionary<string, object> { ["kills"] = it.AwakenKills };
            if (g.Locked.Contains(it)) d["locked"] = true;
            if (it.New) d["new"] = true;
            return d;
        }
        static Dictionary<string, object> QuestJson(Quest q) => new Dictionary<string, object>
        {
            ["id"] = q.Id, ["kind"] = q.Kind, ["enemy"] = q.Enemy, ["stage"] = q.Stage, ["nodeath"] = q.NoDeath, ["need"] = q.Need, ["have"] = q.Have, ["title"] = q.Title, ["desc"] = q.Desc,
            ["reward"] = new Dictionary<string, object> { ["coins"] = q.Coins, ["scrap"] = q.Scrap, ["xp"] = q.Xp },
        };
        static void Write(StringBuilder sb, object v)
        {
            switch (v)
            {
                case null: sb.Append("null"); break;
                case string s:
                    sb.Append('"');
                    foreach (char c in s) { if (c == '"' || c == '\\') sb.Append('\\').Append(c); else if (c == '\n') sb.Append("\\n"); else if (c < 0x20) sb.Append("\\u").Append(((int)c).ToString("x4")); else sb.Append(c); }
                    sb.Append('"'); break;
                case bool b: sb.Append(b ? "true" : "false"); break;
                case int i: sb.Append(i.ToString(CultureInfo.InvariantCulture)); break;
                case double d: sb.Append(d.ToString("R", CultureInfo.InvariantCulture)); break;
                case Dictionary<string, object> m:
                    sb.Append('{'); bool first = true;
                    foreach (var kv in m) { if (!first) sb.Append(','); first = false; Write(sb, kv.Key); sb.Append(':'); Write(sb, kv.Value); }
                    sb.Append('}'); break;
                case List<object> l:
                    sb.Append('['); for (int i = 0; i < l.Count; i++) { if (i > 0) sb.Append(','); Write(sb, l[i]); } sb.Append(']'); break;
                default: sb.Append(Convert.ToString(v, CultureInfo.InvariantCulture)); break;
            }
        }

        // ================= 讀 =================
        static OrderedDict O(object o, string k) => o is OrderedDict d && d.TryGetValue(k, out var v) ? v as OrderedDict : null;
        static List<object> L(object o, string k) => o is OrderedDict d && d.TryGetValue(k, out var v) ? v as List<object> : null;
        static double N(object o, string k, double def = 0) => o is OrderedDict d && d.TryGetValue(k, out var v) && v is double x ? x : o is OrderedDict d2 && d2.TryGetValue(k, out var b) && b is bool bb ? (bb ? 1 : 0) : def;
        static string S(object o, string k) => o is OrderedDict d && d.TryGetValue(k, out var v) ? v as string : null;
        static bool B(object o, string k) => o is OrderedDict d && d.TryGetValue(k, out var v) && (v is bool b ? b : v is double x && x != 0);

        /// 把存檔套到一個剛建好的遊戲上（等級、裝備、形態……全部換成存檔的）。存檔是 ver 2 以前的：裝備清掉換起始裝備（跟網頁版一樣）
        public static void Apply(Game g, string json)
        {
            var p = MiniJson.Parse(json) as OrderedDict; if (p == null) throw new Exception("不是存檔");
            if (O(p, "equip") == null || L(p, "inv") == null) throw new Exception("不是存檔");
            int ver = (int)N(p, "ver", 1);
            g.Lv = Math.Max(1, (int)N(p, "lv", 1)); g.Xp = (int)N(p, "xp"); g.Money = (int)N(p, "coins"); g.Scrap = (int)N(p, "scrap");
            g.Auto = (int)N(p, "auto"); g.Clears = (int)N(p, "clears");
            g.Inv.Clear(); g.Locked.Clear();
            foreach (var k in g.Equip.Keys.ToList()) g.Equip[k] = null;
            if (ver >= 3)
            {
                foreach (var o in L(p, "inv")) { var it = ReadItem(o as OrderedDict, g); if (it != null) g.Inv.Add(it); }
                var eq = O(p, "equip"); foreach (var k in eq.Order) if (g.Equip.ContainsKey(k)) g.Equip[k] = ReadItem(eq[k] as OrderedDict, g);
            }
            if (g.Equip["weapon"] == null && g.Equip["body"] == null) { var f = Items.StarterGear(); g.Equip["weapon"] = f.core; g.Equip["body"] = f.shell; }
            // 形態
            g.FormsOwned.Clear(); g.Tree.Clear(); g.CoreSpent.Clear();
            var fo = O(p, "forms"); var owned = O(fo, "owned");
            if (owned != null) foreach (var id in owned.Order)
            {
                var f = owned[id] as OrderedDict;
                int pts = (int)N(f, "pts") + (int)N(f, "cores");   // 舊存檔沒換掉的核（cores）一顆換一顆靈核
                if (f != null && f.ContainsKey("lv") && !f.ContainsKey("pts")) { int lv = (int)N(f, "lv", 1); pts = (lv - 1) * lv / 2 + (int)N(f, "xp"); }
                g.FormsOwned[id] = pts;
                var tree = O(f, "tree"); if (tree != null && !(f.ContainsKey("lv") && !f.ContainsKey("pts"))) foreach (var n in tree.Order) g.Tree[id + ":" + n] = (int)(double)tree[n];
            }
            if (!g.FormsOwned.ContainsKey("star")) g.FormsOwned["star"] = 0;
            var carry = L(fo, "carry")?.Cast<string>().Where(g.FormsOwned.ContainsKey).ToArray();
            g.Carry = carry != null && carry.Length > 0 ? carry : new[] { "star" };
            string cur = S(fo, "cur"); if (cur == null || !g.FormsOwned.ContainsKey(cur)) cur = g.Carry[0];
            if (g.Player.Form != cur) g.Player.SetForm(cur);
            // 公會、任務
            var gu = O(p, "guild"); g.GuildRegistered = B(gu, "registered"); g.GuildDone = (int)N(gu, "done");
            var Q = O(p, "quests"); g.Quests.Active.Clear(); g.Quests.Board.Clear(); g.Quests.Tracked.Clear(); g.SysDone.Clear();
            foreach (var o in L(Q, "active") ?? new List<object>()) g.Quests.Active.Add(ReadQuest(o as OrderedDict));
            foreach (var o in L(Q, "board") ?? new List<object>()) g.Quests.Board.Add(ReadQuest(o as OrderedDict));
            var sd = O(Q, "sysDone"); if (sd != null) foreach (var k in sd.Order) if (B(sd, k)) g.SysDone.Add(k);
            var st = O(Q, "stats"); g.Quests.EnhanceMax = (int)N(st, "enhanceMax"); g.Quests.Meals = (int)N(st, "meals"); g.Quests.Rerolls = (int)N(st, "rerolls");
            foreach (var o in L(Q, "tracked") ?? new List<object>()) if (o is string s) g.Quests.Tracked.Add(s);
            // 其他
            g.Meal = S(p, "meal"); g.MpBonus = (int)N(p, "mpBonus"); g.CoreBonus.Clear();
            var cb = O(p, "coreBonus"); if (cb != null) foreach (var k in cb.Order) g.CoreBonus[k] = N(cb, k);
            g.Cleared_.Clear(); var cl = O(p, "cleared"); if (cl != null) foreach (var k in cl.Order) if (B(cl, k)) g.Cleared_.Add(k);
            g.Taught.Clear(); var ta = O(p, "taught");
            if (ta != null) { foreach (var k in ta.Order) if (B(ta, k)) g.Taught.Add(k); }
            else if (g.Cleared_.Contains("1-1")) g.Taught.UnionWith(new[] { "dash", "skill", "ult" });   // 打過 1-1 的舊存檔：按鍵全部照舊顯示
            g.Reacted.Clear(); var re = O(p, "react"); if (re != null) foreach (var k in re.Order) if (B(re, k)) g.Reacted.Add(k);
            g.Found.Clear(); var fd = O(p, "found"); if (fd != null) foreach (var k in fd.Order) { var m = new Dictionary<string, int>(); var s2 = fd[k] as OrderedDict; if (s2 != null) foreach (var i in s2.Order) m[i] = (int)N(s2, i); g.Found[k] = m; }
            g.MapSeen.Clear(); var ms = O(p, "mapSeen"); if (ms != null) foreach (var k in ms.Order) if (ms[k] is string bits) g.MapSeen[k] = bits.Select(c => c == '1').ToArray();
            var pi = O(p, "pity"); g.PityLegend = (int)N(pi, "legend"); g.PityMyth = (int)N(pi, "myth");
            g.Lore = (int)N(p, "lore"); g.TipUse = B(p, "tipUse"); g.SeenSet = B(p, "seenSet"); g.SeenCoreTip = B(p, "seenCoreTip"); g.SeenIntro = B(p, "seenIntro");
            g.TGuide = p.ContainsKey("tguide") && p["tguide"] is double tg ? (int)tg : -1;
            g.ApplyStats(); g.Player.Hp = g.Player.MaxHp;
        }
        static Item ReadItem(OrderedDict o, Game g)
        {
            if (o == null) return null;
            var it = new Item { Uid = S(o, "uid") ?? Guid.NewGuid().ToString("N").Substring(0, 10), Kind = S(o, "kind"), Icon = S(o, "icon"), Name = S(o, "name"), Rarity = (int)N(o, "rarity"), Ilvl = (int)N(o, "ilvl", 1), Plus = (int)N(o, "plus"),
                Base = S(o, "base"), Unique = S(o, "unique"), Myth = S(o, "myth"), Set = S(o, "set"), Junk = S(o, "junk"), AwakenKills = (int)N(O(o, "awaken"), "kills"), New = B(o, "new") };
            if (it.Kind == "weapon" && it.Set != null) it.Set = null;   // 8a：星核不參與套裝了
            var m = O(o, "main"); if (m != null) it.Main = new Affix { Id = S(m, "id"), V = N(m, "v") };
            foreach (var a in L(o, "affixes") ?? new List<object>()) { var ad = a as OrderedDict; it.Affixes.Add(new Affix { Id = S(ad, "id"), Tier = (int)N(ad, "tier"), V = N(ad, "v") }); }
            if (B(o, "locked")) g.Locked.Add(it);
            return it;
        }
        static Quest ReadQuest(OrderedDict o)
        {
            var r = O(o, "reward");
            return new Quest { Id = S(o, "id"), Kind = S(o, "kind"), Enemy = S(o, "enemy"), Stage = S(o, "stage"), NoDeath = B(o, "nodeath"), Need = (int)N(o, "need", 1), Have = (int)N(o, "have"),
                Title = S(o, "title"), Desc = S(o, "desc"), Coins = (int)N(r, "coins"), Scrap = (int)N(r, "scrap"), Xp = (int)N(r, "xp") };
        }

        // ================= 檔案、匯入 =================
        public static void Save(Game g)
        {
            try
            {
                string json = ToJson(g), path = FilePath;
                if (File.Exists(path)) File.Copy(path, path + ".bak", true);
                File.WriteAllText(path + ".tmp", json, Encoding.UTF8);
                if (File.Exists(path)) File.Delete(path);
                File.Move(path + ".tmp", path);
            }
            catch (Exception e) { Debug.LogWarning("[Save] 存檔失敗：" + e.Message); }
        }
        public static string Load()
        {
            try { return File.Exists(FilePath) ? File.ReadAllText(FilePath, Encoding.UTF8) : null; } catch { return null; }
        }
        public static void Wipe() { try { if (File.Exists(FilePath)) File.Delete(FilePath); } catch { } }
        /// 網頁版「匯出存檔」的代碼（ZSH1:＋base64）或直接一段存檔 JSON → 存檔 JSON；看不懂回傳 null
        public static string Decode(string code)
        {
            if (string.IsNullOrWhiteSpace(code)) return null;
            code = code.Trim();
            try
            {
                if (code.StartsWith(CODE)) code = Encoding.UTF8.GetString(Convert.FromBase64String(code.Substring(CODE.Length).Trim()));
                return code.StartsWith("{") && MiniJson.Parse(code) is OrderedDict d && d.ContainsKey("equip") ? code : null;
            }
            catch { return null; }
        }
        public static string Encode(string json) => CODE + Convert.ToBase64String(Encoding.UTF8.GetBytes(json));
    }
}
