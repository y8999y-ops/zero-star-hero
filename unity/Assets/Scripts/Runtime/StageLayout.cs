using System;
using System.Collections.Generic;
using PixelFX;
using UnityEngine;

namespace ZeroStar
{
    // Prefab 是擺設資料，實際像素、光源和粒子都由既有的遊戲畫布合成。
    sealed class StageLayout
    {
        sealed class Piece
        {
            public StagePiece spec;
            public int x, y, w, h, emitterX, emitterY;
            public uint[] pixels;
            public LightSrc light;
            public bool Solid(int wx, int wy)
            {
                int u = wx - x, v = wy - y;
                return (uint)u < w && (uint)v < h && pixels[v * w + u] >> 24 >= 128;
            }
        }
        readonly List<Piece> pieces = new List<Piece>();
        readonly List<(double x, double y, double vx, double vy, double life)> sparks = new List<(double,double,double,double,double)>();
        readonly System.Random random = new System.Random(12);
        double elapsed, nextSpark;
        internal static StageLayout Load(string stage)
        {
            var prefab = Resources.Load<GameObject>("StageLayouts/" + stage);
            return prefab == null ? null : new StageLayout(prefab);
        }
        internal StageLayout(GameObject prefab)
        {
            foreach (var spec in prefab.GetComponentsInChildren<StagePiece>())
            {
                var sprite = spec.GetComponent<SpriteRenderer>().sprite;
                if (sprite == null) continue;
                var pos = prefab.transform.InverseTransformPoint(spec.transform.position);
                var rect = sprite.rect;
                var p = new Piece { spec = spec, w = (int)rect.width, h = (int)rect.height,
                    x = Mathf.RoundToInt(pos.x - sprite.pivot.x), y = Mathf.RoundToInt(-pos.y - rect.height + sprite.pivot.y),
                    emitterX = Mathf.RoundToInt(pos.x + spec.effectAnchor.x), emitterY = Mathf.RoundToInt(-pos.y - spec.effectAnchor.y) };
                var colors = sprite.texture.GetPixels((int)rect.x, (int)rect.y, p.w, p.h);
                p.pixels = new uint[p.w * p.h];
                for (int y = 0; y < p.h; y++) for (int x = 0; x < p.w; x++)
                {
                    Color32 c = colors[(p.h - 1 - y) * p.w + x];
                    p.pixels[y * p.w + x] = (uint)(c.a << 24 | c.b << 16 | c.g << 8 | c.r);
                }
                pieces.Add(p);
            }
            foreach (var p in pieces)
            {
                if (p.spec.layer != SceneryLayer.Playfield || p.spec.lightRadius <= 0) continue;
                int r = p.spec.lightRadius;
                p.light = new LightSrc(p.emitterX, p.emitterY, r, 3, "#" + ColorUtility.ToHtmlStringRGB(p.spec.lightColor));
                p.light.Shadow = new bool[2*r+1,2*r+1];
                // 固定場景光源載入時做一次可見度計算。受光表面本身仍可照亮。
                for (int dy=-r; dy<=r; dy++) for (int dx=-r; dx<=r; dx++)
                {
                    int steps = Math.Max(Math.Abs(dx), Math.Abs(dy));
                    for (int i=1; i<steps; i++)
                    {
                        int x=p.emitterX+(int)Math.Round(dx*i/(double)steps), y=p.emitterY+(int)Math.Round(dy*i/(double)steps);
                        bool blocked=false;
                        foreach (var other in pieces)
                            if (other != p && other.spec.layer == SceneryLayer.Playfield && other.spec.blocksLight && other.Solid(x,y)) { blocked=true; break; }
                        if (blocked) { p.light.Shadow[dx+r,dy+r]=true; break; }
                    }
                }
            }
        }
        public void BindLighting(WorldComposition geometry)
        {
            if(geometry==null)return;
            foreach(var p in pieces)
                if(p.spec.layer==SceneryLayer.Playfield)
                    geometry.AddBlocker(p.x,p.y,p.pixels,p.w,p.h,p.spec.blocksLight,p.spec.blocksSparks);
            var attached=new List<LightSrc>(); Lights(attached); geometry.ShadeFixedLights(attached);
        }
        public void Lights(List<LightSrc> lights) { foreach (var p in pieces) if (p.light != null) lights.Add(p.light); }
        public void Tick(double dt, WorldComposition geometry)
        {
            elapsed += dt;
            if (dt <= 0) return;
            if ((nextSpark -= dt) <= 0)
            {
                nextSpark += 0.12;
                foreach (var p in pieces) if (p.spec.sparks && p.spec.layer == SceneryLayer.Playfield)
                    sparks.Add((p.emitterX,p.emitterY,10+random.NextDouble()*23,-12-random.NextDouble()*16,1));
            }
            for (int i=sparks.Count-1;i>=0;i--)
            {
                var s=sparks[i]; s.life-=dt; s.vy+=40*dt; s.x+=s.vx*dt; s.y+=s.vy*dt;
                if(geometry?.HitsSpark((int)Math.Round(s.x),(int)Math.Round(s.y))==true)s.life=0;
                foreach (var p in pieces) if (p.spec.layer == SceneryLayer.Playfield && p.spec.blocksSparks && p.Solid((int)Math.Round(s.x),(int)Math.Round(s.y))) { s.life=0; break; }
                if (s.life<=0) sparks.RemoveAt(i); else sparks[i]=s;
            }
        }
        public void Draw(Frame f, SceneryLayer layer, uint[] buffer)
        {
            foreach (var p in pieces)
            {
                if (p.spec.layer != layer) continue;
                bool sky = layer == SceneryLayer.Sky;
                double left = p.x - (sky ? Parallax.Offset(f.Ox,f.CameraFractionX,p.spec.parallax) : f.Ox);
                int top = p.y - (sky ? 0 : f.Oy);
                if (sky) left += elapsed*p.spec.drift;
                int period = sky ? p.spec.repeatWidth : 0;
                if (period>0) left = ((left % period)+period)%period - period;
                for (; left < f.W; left += period)
                {
                    int start=(int)Math.Floor(left);
                    double frac=left-start;
                    for (int v=Math.Max(0,-top); v<Math.Min(p.h,f.H-top); v++)
                    for (int u=Math.Max(0,-start); u<Math.Min(p.w+1,f.W-start); u++)
                    {
                        int row=v*p.w;
                        uint c=Parallax.Mix(u<p.w?p.pixels[row+u]:0,u>0?p.pixels[row+u-1]:0,frac);
                        if ((c>>24)==0) continue;
                        int idx=(top+v)*f.W+start+u;
                        if (!sky && p.spec.receivesLight)
                        {
                            double k=0.55+Math.Min(1,SceneLight.Buf[idx])*0.45;
                            c=(c&0xff000000u) | (uint)Math.Min(255,(c&255)*k+SceneLight.Tr[idx]) |
                              ((uint)Math.Min(255,((c>>8)&255)*k+SceneLight.Tg[idx])<<8) |
                              ((uint)Math.Min(255,((c>>16)&255)*k+SceneLight.Tb[idx])<<16);
                        }
                        if (!sky) f.ExcludeWeather(idx);
                        buffer[idx]=Parallax.Over(buffer[idx],c);
                    }
                    if (period<=0) break;
                }
            }
            if (layer == SceneryLayer.Playfield) foreach (var s in sparks)
            {
                int x=(int)Math.Round(s.x)-f.Ox,y=(int)Math.Round(s.y)-f.Oy;
                if ((uint)x<f.W && (uint)y<f.H) { int i=y*f.W+x; f.ExcludeWeather(i); buffer[i]=0xffffdb89; }
            }
        }
    }
}
