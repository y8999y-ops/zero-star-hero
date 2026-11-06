// 比對測試（Unity 這一邊）：裝備產生與數值計算。跟 game/tools/unity-items-golden.mjs 同一個種子、同一個步驟，
// 寫到 unity/Golden/unity/items.txt；再用 node game/tools/unity-items-golden.mjs --compare 比對。
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
using PixelFX;

namespace ZeroStar.Tests
{
    public static class ItemsTest
    {
        static string F(double v) => v.ToString("G17", CultureInfo.InvariantCulture);
        static string Fmt(Item it)
        {
            var c = Items.CoreOf(it);
            var parts = new List<string> { it.Base ?? "", it.Kind, it.Icon, it.Name, it.Rarity.ToString(), it.Ilvl.ToString(), it.Main != null ? it.Main.Id : "", it.Main != null ? F(it.Main.V) : "",
                string.Join(",", it.Affixes.Select(a => a.Id + ":" + a.Tier)) };
            parts.AddRange(it.Affixes.Select(a => F(a.V)));
            parts.AddRange(new[] { "/", it.Unique ?? "", it.Myth ?? "", it.Set ?? "", it.Junk ?? "", F(Items.MainValue(it)), c?.id ?? "", c != null ? c.Value.tier.ToString() : "", c != null ? F(c.Value.x) : "" });
            return string.Join("|", parts);
        }

        [MenuItem("零星工具/比對測試：裝備")]
        public static void Run()
        {
            Rnd.R = new Rng(777);
            var lines = new List<string>();
            string[] KINDS = { null, "weapon", "head", "body", "hands", "feet", "acc" };
            var items = new List<Item>();
            for (int n = 0; n < 3000; n++)
            {
                double r0 = Rnd.Next(); double ilvl = 1 + Math.Floor(r0 * 100) + Rnd.Next();
                int mode = n % 6;
                int r = mode < 3 ? Items.RollRarity(Math.Floor(Rnd.Next() * 60), n % 4 == 0 ? 1 : 0) : n % 6;
                string kind = KINDS[n % KINDS.Length];
                var it = Items.MakeItem(ilvl, r, kind);
                it.Plus = n % 7 == 0 ? (int)Math.Floor(Rnd.Next() * 51) : 0;
                items.Add(it);
                lines.Add(Fmt(it));
            }
            var bySlot = new Dictionary<string, List<Item>> { ["weapon"] = new List<Item>(), ["head"] = new List<Item>(), ["body"] = new List<Item>(), ["hands"] = new List<Item>(), ["feet"] = new List<Item>(), ["acc"] = new List<Item>() };
            foreach (var it in items) if (bySlot.ContainsKey(it.Kind)) bySlot[it.Kind].Add(it);
            var SLOT_KIND = new[] { ("weapon", "weapon"), ("head", "head"), ("body", "body"), ("hands", "hands"), ("feet", "feet"), ("acc1", "acc"), ("acc2", "acc") };
            for (int n = 0; n < 500; n++)
            {
                var equip = new Dictionary<string, Item>();
                foreach (var (slot, kind) in SLOT_KIND) { int k = (int)Math.Floor(Rnd.Next() * (bySlot[kind].Count + 1)); equip[slot] = k < bySlot[kind].Count ? bySlot[kind][k] : null; }
                int lv = 1 + (int)Math.Floor(Rnd.Next() * 100);
                var s = Items.ComputeStats(equip, lv);
                lines.Add(string.Join("|", new[] { "S", lv.ToString(), F(s.Atk), F(s.MaxHp), F(s.Def), F(s.Crit), F(s.CritDmg), F(s.Skill), F(s.Ult), F(s.Charge), F(s.Cdr), F(s.Leech), F(s.Move), F(s.Mf),
                    string.Join(",", s.Uniques), string.Join(",", s.Sets.Select(kv => kv.Key + ":" + kv.Value)), s.CoreId ?? "", s.CoreId != null ? s.CoreTier.ToString() : "", s.CoreId != null ? F(s.CoreX) : "" }));
            }
            string dir = Path.Combine(Directory.GetParent(Application.dataPath).FullName, "Golden", "unity");
            Directory.CreateDirectory(dir);
            File.WriteAllText(Path.Combine(dir, "items.txt"), string.Join("\n", lines) + "\n");
            Debug.Log($"[Items] {lines.Count} 行 → {dir}");
        }
    }
}
