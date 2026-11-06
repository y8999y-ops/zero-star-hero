// 很小的 JSON 讀取器：物件 → Dictionary<string, object>（照檔案裡的順序）、陣列 → List<object>、數字 → double、字串、true/false/null。
// Unity 內建的 JsonUtility 不能讀任意形狀的資料（比對測試的穿搭、之後的存檔），所以自己寫一個。
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace ZeroStar
{
    public static class MiniJson
    {
        public static object Parse(string s) { int i = 0; var v = Val(s, ref i); return v; }
        static void Ws(string s, ref int i) { while (i < s.Length && char.IsWhiteSpace(s[i])) i++; }
        static object Val(string s, ref int i)
        {
            Ws(s, ref i);
            char c = s[i];
            if (c == '{')
            {
                var d = new OrderedDict(); i++;
                Ws(s, ref i); if (s[i] == '}') { i++; return d; }
                for (;;)
                {
                    Ws(s, ref i); string k = Str(s, ref i); Ws(s, ref i); i++;   // :
                    d.Add(k, Val(s, ref i)); Ws(s, ref i);
                    if (s[i] == ',') { i++; continue; }
                    i++; return d;
                }
            }
            if (c == '[')
            {
                var l = new List<object>(); i++;
                Ws(s, ref i); if (s[i] == ']') { i++; return l; }
                for (;;)
                {
                    l.Add(Val(s, ref i)); Ws(s, ref i);
                    if (s[i] == ',') { i++; continue; }
                    i++; return l;
                }
            }
            if (c == '"') return Str(s, ref i);
            if (s.Substring(i).StartsWith("true")) { i += 4; return true; }
            if (s.Substring(i).StartsWith("false")) { i += 5; return false; }
            if (s.Substring(i).StartsWith("null")) { i += 4; return null; }
            int st = i;
            while (i < s.Length && "+-0123456789.eE".IndexOf(s[i]) >= 0) i++;
            return double.Parse(s.Substring(st, i - st), CultureInfo.InvariantCulture);
        }
        static string Str(string s, ref int i)
        {
            var sb = new StringBuilder(); i++;
            while (s[i] != '"')
            {
                if (s[i] == '\\')
                {
                    i++; char e = s[i];
                    if (e == 'n') sb.Append('\n'); else if (e == 't') sb.Append('\t'); else if (e == 'u') { sb.Append((char)Convert.ToInt32(s.Substring(i + 1, 4), 16)); i += 4; } else sb.Append(e);
                    i++;
                }
                else sb.Append(s[i++]);
            }
            i++;
            return sb.ToString();
        }
    }
    /// 照加入順序的字典（跟 JS 物件一樣）
    public class OrderedDict : Dictionary<string, object>
    {
        public readonly List<string> Order = new List<string>();
        public new void Add(string k, object v) { if (!ContainsKey(k)) Order.Add(k); this[k] = v; }
    }
}
