// 混合畫面的 shader（scene-fx skill §6）：CPU 畫好的畫面 → 城鎮的房子變濕、地面積水（倒影、亮邊、反光點、漣漪）。
// 一格畫面＝貼圖的一格（最近點），所有計算都以「整格」為單位，像素不會糊。
// 貼圖第 0 列＝畫布第 -1 列（上面補的那一格），所以畫布座標 cy＝貼圖列 − 1，往下是 +。
// 數值跟 CPU 版（TownPuddles.cs、TownRainHits.cs）一樣；雜訊是 shader 自己的，花紋不必跟 CPU 版一模一樣。
Shader "Hidden/ZeroStar/PostFx"
{
    Properties { _MainTex ("Screen", 2D) = "black" {} }
    SubShader
    {
        Cull Off ZWrite Off ZTest Always
        Pass
        {
            CGPROGRAM
            #pragma vertex vert_img
            #pragma fragment frag
            #pragma target 3.0
            #include "UnityCG.cginc"

            sampler2D _MainTex; float4 _MainTex_TexelSize;   // 1/寬、1/高、寬、高（含四周各補一格）
            sampler2D _MaskTex;                              // 255＝場景本身（變濕、積水只改這些格）
            sampler2D _WorldTex;                             // 城鎮世界座標：R 變濕分數、G 不會濕、B 沿著水路走了多遠、A 哪一條水路
            sampler2D _ColTex;                               // 每一欄：R 積水深度、G 接雨面、A 濕亮邊那一列
            float4 _WorldSize;                               // 城鎮寬、高
            float4 _Cam;                                     // 鏡頭 x、y、時間、城鎮（1＝要做效果）
            float4 _Env;                                     // 濕度、白天程度、地面 y
            float4 _Rip[32];                                 // 漣漪：x、經過時間、大的、那裡的水深
            float _RipN;

            float4 Screen(float cx, float cy) { return tex2Dlod(_MainTex, float4((cx + 1.5) * _MainTex_TexelSize.x, (cy + 1.5) * _MainTex_TexelSize.y, 0, 0)); }
            float4 Column(float wx) { return tex2Dlod(_ColTex, float4((wx + 0.5) / _WorldSize.x, 0.5, 0, 0)); }
            float4 World(float wx, float wy) { return tex2Dlod(_WorldTex, float4((wx + 0.5) / _WorldSize.x, (wy + 0.5) / _WorldSize.y, 0, 0)); }
            float Hash(float n) { return frac(sin(n * 0.1031 + 1.7) * 43758.5453); }
            float Noise(float x, float s)
            {
                float i = floor(x), f = x - i; f = f * f * (3 - 2 * f);
                return lerp(Hash(i + s * 911.0), Hash(i + 1 + s * 911.0), f);
            }

            fixed4 frag(v2f_img i) : SV_Target
            {
                float4 c = tex2D(_MainTex, i.uv);
                if (_Cam.w < 0.5) return c;
                float2 p = floor(i.uv * _MainTex_TexelSize.zw);
                float cx = p.x - 1, cy = p.y - 1;
                float wx = cx + _Cam.x, wy = cy + _Cam.y;
                if (wx < 0 || wx >= _WorldSize.x || wy < 0 || wy >= _WorldSize.y) return c;
                float scen = tex2D(_MaskTex, i.uv).r;
                float wet = _Env.x, day = _Env.y, FLOOR = _Env.z, t = _Cam.z;
                float4 col = Column(wx);

                // ---- 房子變濕（TownRainHits.WetPass）：分數過門檻的格子變深、飽和一點；頂面濕亮邊；往下流的水痕
                if (wy < FLOOR - 4)
                {
                    if (wet <= 0.02 || scen < 0.5) return c;
                    float4 w = World(wx, wy);
                    // ---- 平台積水（陽台欄杆、窗台、木桶蓋、長椅、招牌頂）：世界資料 G＝120 當記號，R＝要多濕才出現，B＝第幾列
                    if (abs(w.g * 255.0 - 120.0) < 2.0 && wet > w.r)
                    {
                        float prow = round(w.b * 255.0);
                        float pry = round(wy - prow - 1 - (prow + 0.5) * 2.0) - _Cam.y;   // 映出上方（壓扁）
                        float prx = clamp(cx + round(sin(wy * 1.7 + t * 2.3 + wx * 0.31) * 0.5), 0, _MainTex_TexelSize.z - 3);
                        float4 prc = Screen(prx, max(0, pry));
                        float3 pw = float3(40 + 60 * day, 52 + 70 * day, 84 + 80 * day) / 255.0;
                        float3 prgb = prc.rgb * 0.6 + pw * 0.4;
                        if (prow < 0.5)
                        {
                            float plip = Noise((wx + t * 2.5) / 4.0, 9);
                            if (plip > 0.45) prgb = lerp(prgb, float3(220, 232, 246) / 255.0, 0.45 + 0.3 * day);
                            // 小漣漪：每 7 格一個，各自的節奏擴開
                            float cell = floor(wx / 7.0), ph = frac(t * 0.9 + Hash(cell + 31.0));
                            float off = abs(wx - (cell * 7.0 + 3.0)), wr = round(1 + 3 * ph);
                            if (ph < 0.8 && abs(off - wr) < 0.5) prgb = float3(232, 242, 255) / 255.0;
                        }
                        else prgb *= float3(0.75, 0.78, 0.86);
                        c.rgb = prgb;
                        return c;
                    }
                    float T = ((1.0 - 1.1 * wet) * 200 + 40) / 255.0;
                    if (w.r <= T || w.g > 0.5) return c;
                    float3 rgb = c.rgb;
                    float g = dot(rgb, float3(0.3, 0.59, 0.11));
                    rgb = (g + (rgb - g) * 1.12) * float3(0.87, 0.88, 0.92);
                    float hi = col.a * 255;
                    if (abs(wy - hi) < 0.5)
                    {
                        float k = (0.3 + 0.2 * day) * min(1, wet * 1.5);
                        rgb = lerp(rgb, float3(215, 228, 245) / 255.0, k);
                    }
                    else if (w.a > 0.5 / 255.0)
                    {
                        // 往下流的亮點：沿著水路（世界資料 B＝走了多遠、A＝哪一條）
                        float sd = w.a * 255.0, sp = 10 + sd / 255.0 * 12;
                        float head = fmod(t * sp + sd * 1.7, 160.0);
                        float dd = head - w.b * 255.0;
                        if (dd >= 0 && dd < 3) rgb = lerp(rgb, float3(225, 236, 250) / 255.0, (dd < 1 ? 0.5 : 0.25) * (0.6 + 0.4 * day));
                    }
                    c.rgb = rgb;
                    return c;
                }

                // ---- 地面積水（TownPuddles）
                const float HALF = 3.2, SQ = 2.6;
                float MID = FLOOR + 3.5, TOP = FLOOR + 1;
                if (wy < TOP || wy > FLOOR + 9) return c;
                float d = col.r;
                float h = 0.5 + d * HALF;
                float y0 = max(ceil(MID - h - 0.01), TOP), y1 = floor(MID + h);
                if (d <= 0 || wy < y0 || wy > y1)
                {
                    if (d > 0.25 && wy == y1 + 1 && scen > 0.5) c.rgb *= float3(0.72, 0.74, 0.8);   // 水窪底下一列草皮壓暗
                    return c;
                }
                if (scen < 0.5) return c;   // 雨滴、水珠、前景草葉在水面上面

                // 漣漪讓倒影左右晃
                float wob = 0;
                [loop] for (int k = 0; k < 32; k++)
                {
                    if (k >= _RipN) break;
                    float4 r = _Rip[k];
                    float u = r.y / 0.9, e = abs(wx - r.x) - (1 + 9 * sqrt(u));
                    if (abs(e) < 2) wob += sin(e * 2.5 + r.y * 20) * (1 - u) * (r.z > 0.5 ? 1.6 : 1.0);
                }
                float row = wy - TOP;
                float ry = round(FLOOR - 1 - (row + 0.5) * SQ) - _Cam.y;
                float rx = clamp(cx + round(wob + sin(wy * 1.7 + t * 2.1 + wx * 0.05) * 0.45), 0, _MainTex_TexelSize.z - 3);
                float4 rc = Screen(rx, max(0, ry));
                // 遠的列反射多（像鏡子），近的列看得到水底、比較暗
                float refl = 0.74 - 0.07 * row;
                float3 water = float3(24 + 44 * day, 34 + 52 * day, 62 + 64 * day) / 255.0;
                // 水底：被漣漪和雜訊左右扭的草皮（地面的折射），偏藍偏暗
                float gx2 = clamp(cx + round(wob * 0.6 + sin(wy * 2.3 + t * 3.1 + wx * 0.4) * 0.8), 0, _MainTex_TexelSize.z - 3);
                float3 under = Screen(gx2, cy).rgb * float3(0.55, 0.62, 0.78) + water * 0.35;
                float3 rgb = rc.rgb * refl + under * (1 - refl);
                rgb = lerp(c.rgb, rgb, min(1, 0.55 + d * 0.9));   // 水很淺的兩頭跟草皮淡淡混
                float edgeT = wy - (MID - h), edgeB = (MID + h) - wy;
                if (edgeB < 1) rgb *= float3(0.5, 0.54, 0.64);   // 近邊：暗線
                else if (edgeT < 1)
                {
                    // 遠邊：亮邊，兩層不同速度的雜訊讓它斷斷續續
                    float lip = Noise((wx + t * 3) / 6.0, 5) * 0.7 + Noise((wx - t * 1.8) / 2.3, 6) * 0.3;
                    if (lip > 0.36) rgb = lerp(rgb, float3(220, 232, 246) / 255.0, 0.5 + 0.3 * day);
                }
                if (edgeT < 2 && d > 0.35 && Noise((wx - t * 5) / 7.0, 7) > 0.9) rgb = lerp(rgb, float3(1, 1, 1), 0.85);   // 滑動的反光點

                // 漣漪的環：側面看＝兩小段往左右滑開，兩圈
                float3 hot = float3(232, 242, 255) / 255.0, cool = float3(150 + 60 * day, 178 + 50 * day, 215 + 30 * day) / 255.0;
                [loop] for (int q = 0; q < 32; q++)
                {
                    if (q >= _RipN) break;
                    float4 r = _Rip[q];
                    float rr = round(MID - (0.5 + r.w * HALF) * 0.15);
                    if (wy != rr || d <= 0.15) continue;
                    if (r.y < 0.05 && wx == r.x) { rgb = hot; continue; }
                    for (int m = 0; m < 2; m++)
                    {
                        float u = (r.y - m * 0.16) / (r.z > 0.5 ? 0.7 : 0.55);
                        if (u <= 0 || u >= 1) continue;
                        float wd = round(1 + (r.z > 0.5 ? 9 : 6) * sqrt(u));
                        float off = abs(wx - r.x);
                        if (off == wd || (u < 0.6 && off == wd - 1)) rgb = (u < 0.4 && m == 0) ? hot : cool;
                    }
                }
                c.rgb = rgb;
                return c;
            }
            ENDCG
        }
    }
}
