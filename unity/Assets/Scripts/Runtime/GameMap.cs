// game/src/map.js 翻成 C#：地形碰撞＝實心方塊（切成 8×8 格子）＋單向平台（從下面可以跳上來、往下滑穿過去）。
using System;
using System.Collections.Generic;

namespace ZeroStar
{
    public class GameMap
    {
        public const int TILE = 8;
        public double W, H;
        public readonly List<Platform> Platforms;
        readonly int gw, gh;
        readonly byte[] grid;

        public GameMap(double w, double h, List<RectD> solids, List<Platform> platforms)
        {
            W = w; H = h; Platforms = platforms;
            gw = (int)Math.Ceiling(w / TILE); gh = (int)Math.Ceiling(h / TILE);
            grid = new byte[gw * gh];
            foreach (var r in solids) SetSolid(r, true);
        }

        public void SetSolid(RectD r, bool on)
        {
            int x0 = Math.Max(0, (int)Math.Floor(r.X / TILE)), x1 = Math.Min(gw, (int)Math.Ceiling((r.X + r.W) / TILE));
            int y0 = Math.Max(0, (int)Math.Floor(r.Y / TILE)), y1 = Math.Min(gh, (int)Math.Ceiling((r.Y + r.H) / TILE));
            for (int y = y0; y < y1; y++) for (int x = x0; x < x1; x++) grid[y * gw + x] = (byte)(on ? 1 : 0);
        }

        /// 這一點是不是實心（地圖左右外面、底下外面＝實心；上面外面＝跟第 0 列一樣）
        public bool SolidAt(double x, double y)
        {
            double fx = Math.Floor(x / TILE), fy = Math.Floor(y / TILE);
            if (fx < 0 || fx >= gw || fy >= gh) return true;
            int tx = (int)fx;
            if (fy < 0) return grid[tx] == 1;
            return grid[(int)fy * gw + tx] == 1;
        }

        /// 往下掉（prevY → y）有沒有踩到地。回傳落腳的 y，沒有回傳 null
        public double? GroundAt(double x, double prevY, double y, bool dropping = false)
        {
            double? best = null;
            if (!dropping) foreach (var p in Platforms) if (x >= p.X - 2 && x <= p.X + p.W + 2 && prevY <= p.Y + 0.5 && y >= p.Y && (best == null || p.Y < best)) best = p.Y;
            for (double ty = Math.Floor(prevY / TILE); ty <= Math.Floor(y / TILE); ty++)
            {
                double top = ty * TILE;
                if (top < prevY - 0.5 || top > y) continue;
                if (SolidAt(x, top + 0.5) && !SolidAt(x, top - 0.5)) { if (best == null || top < best) best = top; break; }
            }
            return best;
        }

        /// 站在平台上（不是實心地面）：往下滑可以穿過去
        public bool OnPlatform(double x, double y)
        {
            bool any = false;
            foreach (var p in Platforms) if (Math.Abs(y - p.Y) < 0.5 && x >= p.X - 2 && x <= p.X + p.W + 2) { any = true; break; }
            return any && !SolidAt(x, y + 0.5);
        }

        /// 從 y 往下找第一個地面；找不到回傳地圖底
        public double FloorAt(double x, double y)
        {
            double best = H;
            foreach (var p in Platforms) if (x >= p.X && x <= p.X + p.W && p.Y >= y - 0.5 && p.Y < best) best = p.Y;
            for (double ty = Math.Max(0, Math.Floor(y / TILE)); ty < gh; ty++)
            {
                double top = ty * TILE;
                if (top >= best) break;
                if (SolidAt(x, top + 0.5) && !SolidAt(x, top - 0.5) && top >= y - TILE) return top;
            }
            return best;
        }

        /// 往上撞到天花板：回傳天花板底下的 y（腳的位置），沒有回傳 null。h＝身高
        public double? CeilingAt(double x, double prevY, double y, double h)
        {
            double head = y - h;
            if (head < 0) return null;
            if (SolidAt(x - 4, head) || SolidAt(x + 4, head)) return (Math.Floor(head / TILE) + 1) * TILE + h;
            return null;
        }

        /// 左右移動：身體（腳 y、身高 h、半寬 r）從 x 移到 nx，撞牆就停在牆邊
        public double MoveX(double x, double nx, double y, double h, double r)
        {
            if (nx == x) return x;
            double dir = Math.Sign(nx - x), edge = nx + dir * r;
            foreach (double yy in new[] { y - 2, y - h / 2, y - h + 2 })
            {
                if (SolidAt(edge, yy))
                {
                    double tx = Math.Floor(edge / TILE);
                    return dir > 0 ? tx * TILE - r - 0.01 : (tx + 1) * TILE + r + 0.01;
                }
            }
            return nx;
        }
    }
}
