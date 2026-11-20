using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace ZeroStar
{
    // 把 Prefab 的圖與位置一次合成進既有場景圖層，逐幀光照、視差、碰撞仍共用同一張地圖。
    public sealed class WorldComposition
    {
        readonly Transform root;
        public bool HasCloudObjects => root.GetComponent<WorldClouds>() != null;
        readonly WorldStamp[] allStamps;
        WorldStamp[] stamps;
        HashSet<WorldStamp> townPreviews;
        readonly Dictionary<(StampKind,int),WorldStamp> anchors = new Dictionary<(StampKind,int),WorldStamp>();
        public WorldComposition(GameObject prefab)
        {
            root=prefab.transform;
            // 原圖先鋪地面、再放道具、最後疊平台。Hierarchy 分組並非繪製順序。
            allStamps=prefab.GetComponentsInChildren<WorldStamp>()
                .OrderBy(s => s.kind==StampKind.Platform ? 2 : s.kind==StampKind.Decor ? 1 : 0)
                .ThenBy(s => s.TryGetComponent<SpriteRenderer>(out var renderer) ? renderer.sortingOrder : 0).ToArray();
            SelectTownStamps(null);
        }
        internal void SelectTownStamps(Func<WorldStamp, bool> open)
        {
            stamps = open == null ? allStamps : allStamps.Where(open).ToArray();
            townPreviews = open == null ? null : new HashSet<WorldStamp>(allStamps.Where(s => s.townPreview && !open(s)));
            anchors.Clear();
            foreach (var s in stamps) anchors[(s.kind,s.index)] = s;
        }
        public static WorldComposition Load(string id)
        {
            var prefab=Resources.Load<GameObject>("StageLayouts/"+id);
            return prefab && prefab.GetComponentInChildren<WorldStamp>() ? new WorldComposition(prefab) : null;
        }
        public Vector2Int Delta(StampKind kind,int index=0) =>
            anchors.TryGetValue((kind,index),out var s) ? s.Position(root)-s.original : Vector2Int.zero;
        public Vector2Int Role(string role)
        {
            foreach(var s in stamps) if(s.role==role) return s.Position(root)-s.original;
            return Vector2Int.zero;
        }
        static Img ImageOf(Sprite sprite)
        {
            Rect r=sprite.rect;
            var img=new Img{W=(int)r.width,H=(int)r.height};
            var source=sprite.texture.GetPixels32();
            img.Px=new uint[img.W*img.H];
            for(int y=0;y<img.H;y++)
            {
                int row=((int)r.y+img.H-1-y)*sprite.texture.width+(int)r.x;
                for(int x=0;x<img.W;x++)
                {
                    var c=source[row+x];
                    img.Px[y*img.W+x]=c.a==0 ? 0u : (uint)(c.r | c.g<<8 | c.b<<16 | c.a<<24);
                }
            }
            return img;
        }
        byte[] blockers;
        int worldWidth,worldHeight;
        readonly Dictionary<(int x,int y,int radius),bool[,]> shadowCache=new Dictionary<(int,int,int),bool[,]>();
        internal void AddBlocker(int x,int y,uint[] pixels,int w,int h,bool light,bool sparks)
        {
            byte flags=(byte)((light?1:0)|(sparks?2:0));
            if(flags==0 || blockers==null)return;
            for(int v=Math.Max(0,-y);v<Math.Min(h,worldHeight-y);v++)
            for(int u=Math.Max(0,-x);u<Math.Min(w,worldWidth-x);u++)
                if((pixels[v*w+u]>>24)>=128)blockers[(y+v)*worldWidth+x+u]|=flags;
        }
        public bool HitsSpark(int x,int y) => blockers!=null && (uint)x<worldWidth && (uint)y<worldHeight && (blockers[y*worldWidth+x]&2)!=0;
        bool Blocks(int x,int y) => (uint)x<worldWidth && (uint)y<worldHeight && (blockers[y*worldWidth+x]&1)!=0;
        public void ShadeFixedLights(List<LightSrc> lights)
        {
            if(blockers==null)return;
            foreach(var l in lights)
            {
                if(l.Par!=1 || l.R<=0 || l.R>128)continue;
                int sx=(int)Math.Round(l.X),sy=(int)Math.Round(l.Y),r=(int)Math.Ceiling(l.R);
                var key=(sx,sy,r);
                if(!shadowCache.TryGetValue(key,out var shadow))
                {
                    // 光源位於發光圖片內部時讓它照出來。
                    bool nearby=false;
                    for(int y=Math.Max(0,sy-r);y<Math.Min(worldHeight,sy+r+1)&&!nearby;y++)
                    for(int x=Math.Max(0,sx-r);x<Math.Min(worldWidth,sx+r+1);x++)
                        if(Blocks(x,y)){nearby=true;break;}
                    if(nearby && !Blocks(sx,sy))
                    {
                        shadow=new bool[2*r+1,2*r+1];
                        // 從光源向正方形邊界的每個像素投射射線；每條射線只走一次。
                        void Cast(int dx,int dy)
                        {
                            bool hit=false;
                            for(int k=1;k<=r;k++)
                            {
                                int x=(int)Math.Round(dx*k/(double)r),y=(int)Math.Round(dy*k/(double)r);
                                if(hit)shadow[x+r,y+r]=true;
                                else hit=Blocks(sx+x,sy+y);
                            }
                        }
                        for(int i=-r;i<=r;i++){Cast(i,-r);Cast(i,r);Cast(-r,i);Cast(r,i);}
                    }
                    shadowCache[key]=shadow;
                }
                l.Shadow=shadow;
            }
        }
        public List<RectD> OriginalSolids {get;private set;}
        public List<Platform> OriginalPlatforms {get;private set;}
        public List<(double x,double y)> OriginalTorches {get;private set;}
        internal IEnumerable<(string role, Vector2Int position, Vector2Int size)> TownStamps(StampKind kind)
        {
            foreach (var s in stamps)
                if (s.kind == kind) yield return (s.role, s.Position(root), s.size);
        }
        internal IEnumerable<Vector2Int> MatchingTownArt(string role, int w, int h, uint[] reference, int[] probe)
        {
            foreach (var s in stamps)
            {
                if (s.role != role || !s.TryGetComponent<SpriteRenderer>(out var sr) || !sr.enabled || !sr.sprite
                    || sr.sprite.rect.width != w || sr.sprite.rect.height != h) continue;
                var img = ImageOf(sr.sprite);
                if (probe.All(i => (img.Px[i] | 0xff000000u) == reference[i])) yield return s.Position(root);
            }
        }
        internal bool ApplyTownCollision(LevelData data)
        {
            bool hasStreet = false;
            foreach (var s in stamps)
            {
                var pos = s.Position(root);
                if (s.size.x <= 0) continue;
                if (s.kind == StampKind.Solid || s.kind == StampKind.PaintedGround)
                {
                    if (s.size.y <= 0) continue;
                    hasStreet |= s.role == "town-street";
                    data.Solids.Add(new RectD { X = pos.x, Y = pos.y, W = s.size.x, H = s.size.y });
                }
                else if (s.kind == StampKind.Platform || s.kind == StampKind.PaintedPlatform || s.kind == StampKind.TownStep)
                {
                    var p = new Platform { X = pos.x, Y = pos.y, W = s.size.x };
                    data.Platforms.Add(p);
                    if (s.kind == StampKind.TownStep) data.TownSteps.Add(p);
                }
            }
            return hasStreet;
        }
        public void AppendRewards(List<Features.Def> defs)
        {
            foreach(var s in stamps) if(s.kind==StampKind.RewardChest)
            {
                var p=s.Position(root);
                defs.Add(new Features.Def{t="safe",stableId="reward-"+s.rewardId,x=p.x,y=p.y});
            }
        }
        public void Apply(LevelData data)
        {
            worldWidth=data.W;worldHeight=data.H;blockers=new byte[data.W*data.H];shadowCache.Clear();
            OriginalSolids=data.Solids; OriginalPlatforms=data.Platforms; OriginalTorches=data.Torches;
            var oldMask=data.PFE;
            data.PF=new uint[data.W*data.H]; data.PFE=new byte[data.PF.Length];
            var solids=new List<RectD>(); var platforms=new List<Platform>();
            var torches=new List<(double,double)>(); var crystals=new List<BigCrystal>();
            var lights=new List<LightSrc>(); var used=new HashSet<int>();
            var images=new Dictionary<Sprite,Img>();
            var originalLayers=new Dictionary<StampKind,Img>{{StampKind.Back,data.Back},{StampKind.Far,data.Far},{StampKind.Mid,data.Mid},{StampKind.Near,data.Near},{StampKind.Fg,data.Fg},{StampKind.UpFar,data.UpFar},{StampKind.UpMid,data.UpMid}};
            foreach(var layer in originalLayers.Values) if(layer!=null && layer.Px!=null) Array.Clear(layer.Px,0,layer.Px.Length);
            data.TownPreview = townPreviews?.Count > 0 ? new uint[data.PF.Length] : null;
            var drawing = data.TownPreview != null ? stamps.Concat(townPreviews.OrderBy(s => s.index)) : (IEnumerable<WorldStamp>)stamps;
            foreach(var s in drawing)
            {
                if(s.kind==StampKind.RewardChest)continue; // 寶箱由 Features 繪製，Prefab 圖片是編輯預覽。
                var pos=s.Position(root); var delta=pos-s.original;
                var sr=s.GetComponent<SpriteRenderer>(); Img img=null;
                if(sr && sr.enabled && sr.sprite && !images.TryGetValue(sr.sprite,out img)) images[sr.sprite]=img=ImageOf(sr.sprite);
                if (townPreviews?.Contains(s) == true)
                {
                    if (img != null) DrawTownPreview(s, img, pos, data);
                    continue;
                }
                if(originalLayers.TryGetValue(s.kind,out var layer))
                {
                    if(img!=null && layer!=null)
                    {
                        var layerPos = data.Stage == "town" && (s.kind == StampKind.Far || s.kind == StampKind.Mid || s.kind == StampKind.Fg)
                            ? pos - new Vector2Int(0, TownArt.StreetTop) : pos;
                        Blit(img,layer.Px,layer.W,layer.H,layerPos,null,null,s.original,true);
                    }
                    if(s.kind==StampKind.Near) foreach(var l in data.CrystalLights){l.X+=delta.x;l.Y+=delta.y;}
                    continue;
                }
                foreach(int i in s.lights ?? Array.Empty<int>()) if(i<data.PropLights.Count && used.Add(i))
                {
                    var l=data.PropLights[i];lights.Add(new LightSrc(l.X+delta.x,l.Y+delta.y,l.R,l.Lv,l.Col,l.Par));
                }
                switch(s.kind)
                {
                    case StampKind.PaintedGround:
                    case StampKind.PaintedPlatform:
                    case StampKind.PaintedDetail:
                        if(img==null)continue;
                        if(s.kind==StampKind.PaintedGround)solids.Add(new RectD{X=pos.x,Y=pos.y,W=s.size.x,H=s.size.y});
                        else if(s.kind==StampKind.PaintedPlatform) platforms.Add(new Platform{X=pos.x,Y=pos.y,W=s.size.x});
                        int inset = Math.Max(0, Math.Min(s.sourceInsetX, (img.W - 1) / 2));
                        int period = img.W - inset * 2;
                        for(int y=Math.Max(0,-pos.y);y<Math.Min(s.size.y,data.H-pos.y);y++)
                        for(int x=Math.Max(0,-pos.x);x<Math.Min(s.size.x,data.W-pos.x);x++)
                        {
                            uint c=img.Px[((y+s.sourceTop)%img.H)*img.W+inset+x%period];
                            if(s.kind==StampKind.PaintedDetail && c==0)continue;
                            int dest=(pos.y+y)*data.W+pos.x+x;data.PF[dest]=c;data.PFE[dest]=0;
                        }
                        continue;
                    case StampKind.Torch: torches.Add((pos.x,pos.y)); continue;
                    case StampKind.Crystal:
                        var crystal=data.BigCrystals[s.index];crystal.X+=delta.x;crystal.Y+=delta.y;crystal.X0=pos.x;crystal.Y0=pos.y;
                        if(img!=null){crystal.Img=img;crystals.Add(crystal);} continue;
                    case StampKind.Solid:
                        if(data.Stage=="town")continue;
                        var box=data.Solids[s.index];box.X+=delta.x;box.Y+=delta.y;solids.Add(box);break;
                    case StampKind.Platform:
                        if(data.Stage=="town")continue;
                        var pl=data.Platforms[s.index];pl.X+=delta.x;pl.Y+=delta.y;platforms.Add(pl);break;
                    case StampKind.Terrain: case StampKind.Decor: break;
                    default: continue;
                }
                if(img!=null) AddBlocker(pos.x,pos.y,img.Px,img.W,img.H,s.blocksLight,s.blocksSparks);
                if(img!=null) Blit(img,data.PF,data.W,data.H,pos,data.PFE,s.useBakedEmission ? oldMask : null,s.original,false);
            }
            if(data.Stage!="town"){data.Solids=solids;data.Platforms=platforms;}
            data.PropLights=lights;data.Torches=torches;data.BigCrystals=crystals;
        }
        static void DrawTownPreview(WorldStamp stamp, Img img, Vector2Int pos, LevelData data)
        {
            bool tiled = stamp.kind == StampKind.PaintedPlatform || stamp.kind == StampKind.PaintedDetail;
            int width = tiled ? stamp.size.x : img.W, height = tiled ? stamp.size.y : img.H;
            int inset = tiled ? Math.Max(0, Math.Min(stamp.sourceInsetX, (img.W - 1) / 2)) : 0;
            int period = img.W - 2 * inset;
            for (int y = Math.Max(0, -pos.y); y < Math.Min(height, data.H - pos.y); y++)
            for (int x = Math.Max(0, -pos.x); x < Math.Min(width, data.W - pos.x); x++)
            {
                uint c = img.Px[((y + stamp.sourceTop) % img.H) * img.W + inset + x % period];
                if (c == 0) continue;
                uint muted = Parallax.Over(c | 0xff000000, 0xb399847a);
                data.TownPreview[(pos.y + y) * data.W + pos.x + x] = (muted & 0xffffff) | ((c >> 24) / 4 << 24);
            }
        }
        static void Blit(Img img,uint[] dest,int w,int h,Vector2Int pos,byte[] mask,byte[] originalMask,Vector2Int original,bool wrap)
        {
            for(int y=Math.Max(0,-pos.y);y<Math.Min(img.H,h-pos.y);y++)
            for(int x=0;x<img.W;x++)
            {
                int xx=pos.x+x;if(wrap)xx=((xx%w)+w)%w;
                if((uint)xx>=w)continue;
                uint c=img.Px[y*img.W+x];if(c==0)continue;
                int i=(pos.y+y)*w+xx;dest[i]=c;
                int ox=original.x+x,oy=original.y+y;
                if(mask!=null)mask[i]=originalMask!=null && (uint)ox<w && (uint)oy<h ? originalMask[oy*w+ox] : (byte)0;
            }
        }
    }
}

