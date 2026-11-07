// 比對測試（Unity 這一邊）：選關世界地圖。照 game/tools/unity-worldmap-cases.json 跑幾種進度、選幾個地點，
// 每 every 格存一張合成好的畫面到 unity/Golden/unity/worldmap-<名稱>.bin，再用 node game/tools/unity-worldmap-golden.mjs compare 比。
// 執行：Unity.exe -batchmode -nographics -projectPath unity -executeMethod ZeroStar.Tests.WorldMapTest.Run -quit
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace ZeroStar.Tests
{
    public static class WorldMapTest
    {
        [MenuItem("零星工具/比對測試：世界地圖")]
        public static void Run()
        {
            string root = Directory.GetParent(Application.dataPath).FullName;
            var cfg = (OrderedDict)MiniJson.Parse(File.ReadAllText(Path.Combine(root, "..", "game", "tools", "unity-worldmap-cases.json")));
            int every = (int)(double)cfg["every"];
            string outDir = Path.Combine(root, "Golden", "unity"); Directory.CreateDirectory(outDir);
            foreach (OrderedDict c in (List<object>)cfg["cases"])
            {
                var cleared = ((List<object>)c["cleared"]).Cast<string>().ToList();
                var sel = ((List<object>)c["select"]).Select(o => { var l = (List<object>)o; return ((int)(double)l[0], (string)l[1]); }).ToList();
                var map = new WorldMap(cleared);
                var rgba = new byte[map.Frame.W * map.Frame.H * 4]; var ms = new MemoryStream();
                int ticks = (int)(double)c["ticks"];
                for (int n = 0; n < ticks; n++)
                {
                    foreach (var (at, id) in sel) if (at == n) map.Select(id);
                    map.Step(1 / 60.0);
                    if (n % every == 0) { map.Frame.Composite(rgba, null, 1); ms.Write(rgba, 0, rgba.Length); }
                }
                File.WriteAllBytes(Path.Combine(outDir, $"worldmap-{(string)c["name"]}.bin"), ms.ToArray());
                Debug.Log($"[WorldMap] {(string)c["name"]}：{ms.Length / rgba.Length} 張");
            }
        }
    }
}
