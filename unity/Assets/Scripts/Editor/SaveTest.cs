// 存檔測試：讀一份網頁版的存檔（SAVE_IN）→ 套到遊戲 → 存成 JSON（寫到 SAVE_OUT）→ 再讀回來再存一次，兩次要一模一樣。
// 網頁版的存檔和 Unity 存出來的欄位比對交給 game/tools/unity-save-compare.mjs。
using System;
using System.IO;
using UnityEngine;
using PixelFX;

namespace ZeroStar.Tests
{
    public static class SaveTest
    {
        public static void Run()
        {
            string inPath = Environment.GetEnvironmentVariable("SAVE_IN"), outPath = Environment.GetEnvironmentVariable("SAVE_OUT");
            var web = File.ReadAllText(inPath);
            Rnd.R = new Rng(1);
            var g = new Game("1-1", null);
            SaveData.Apply(g, web);
            string a = SaveData.ToJson(g);
            var g2 = new Game("1-1", null);
            SaveData.Apply(g2, a);
            string b = SaveData.ToJson(g2);
            File.WriteAllText(outPath, a);
            // 代碼來回：ZSH1:＋base64
            string c = SaveData.Decode(SaveData.Encode(a));
            Debug.Log($"[SaveTest] 讀網頁版存檔 {web.Length} 字 → Unity 存出 {a.Length} 字；再讀再存{(a == b ? "一模一樣" : "不一樣！")}；代碼來回{(c == a ? "一樣" : "不一樣！")}");
            if (a != b || c != a) throw new Exception("存檔來回不一致");
        }
    }
}
