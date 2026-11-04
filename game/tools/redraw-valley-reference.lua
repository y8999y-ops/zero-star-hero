-- Valley (stage) layers, redrawn natively from art/參考原圖/valley/*.png.
-- Background layers follow the approved town layers: screen height 216 (~3.35 source px per art px),
-- horizontally tileable. back 480x216 (opaque), far 640x216, mid 768x216, near 896x216, fg 640x216;
-- ground is a 256x48 tile, platform a 128x48 floating island. Colors are sampled from each reference.
-- Depth rule: the further back a layer, the darker, bluer and flatter (fewer ramp steps, no outline);
-- near and fg get outlines, moss and full ramps. Light comes from the upper left everywhere.
-- Run: aseprite -b --script-param out=art/drafts --script tools/redraw-valley-reference.lua
local OUT=app.params['out']
local W,H,TILE,img,C,name
local function sheet(n,w,h,hex,tile,opaque)
 name,W,H,TILE=n,w,h,tile;local spr=Sprite(w,h,ColorMode.RGB)
 local pal=Palette(#hex+1);pal:setColor(0,Color{r=0,g=0,b=0,a=0});C={}
 for i,v in ipairs(hex) do local r,g,b=tonumber(v:sub(1,2),16),tonumber(v:sub(3,4),16),tonumber(v:sub(5,6),16)
  C[i]=app.pixelColor.rgba(r,g,b,255);pal:setColor(i,Color{r=r,g=g,b=b,a=255}) end
 spr:setPalette(pal);img=spr.cels[1].image;spr.layers[1].name=n
 if opaque then for y=0,h-1 do for x=0,w-1 do img:drawPixel(x,y,C[1]) end end end
 return spr
end
local function px(x,y,c) x=math.floor(x);y=math.floor(y);if TILE then x=x%W end
 if x>=0 and x<W and y>=0 and y<H and c then img:drawPixel(x,y,C[c]) end end
local function key(x,y) return x..','..y end
local function each(set,fn) for k,c in pairs(set) do local x,y=k:match('(-?%d+),(-?%d+)');fn(tonumber(x),tonumber(y),c,k) end end
local function put(set,ring)
 if ring then each(set,function(x,y)
  for _,d in ipairs({{1,0},{-1,0},{0,1},{0,-1}}) do if not set[key(x+d[1],y+d[2])] then px(x+d[1],y+d[2],ring) end end end) end
 each(set,function(x,y,c) px(x,y,c) end)
end
local function hash(i,s) local h=math.sin(i*127.1+(s or 0)*311.7)*43758.5453;return h-math.floor(h) end
local function lightOf(nx,ny,nz) return -.5*nx-.62*ny+.6*nz end
local function band(l,r) local n=#r
 local t={.8,.5,.18,-.2};if n==3 then t={.45,-.05} elseif n==4 then t={.6,.2,-.2} end
 for i,th in ipairs(t) do if l>th then return r[n-i+1] end end;return r[1] end
local function poly(p,c,set)
 set=set or {};local lo,hi=1e9,-1e9;for _,a in ipairs(p) do lo=math.min(lo,a[2]);hi=math.max(hi,a[2]) end
 for y=math.floor(lo),math.ceil(hi) do local xs={};local j=#p
  for i=1,#p do local a,b=p[i],p[j];if (a[2]<=y and b[2]>y) or (b[2]<=y and a[2]>y) then xs[#xs+1]=a[1]+(y-a[2])*(b[1]-a[1])/(b[2]-a[2]) end;j=i end
  table.sort(xs);for i=1,#xs-1,2 do for x=math.floor(xs[i]+.5),math.floor(xs[i+1]-.5) do
   local c2=type(c)=='function' and c(x,y) or c;if c2 then set[key(x,y)]=c2 end end end end
 return set
end
local function ellipse(cx,cy,rx,ry,c,set)
 set=set or {}
 for y=math.floor(cy-ry),math.ceil(cy+ry) do for x=math.floor(cx-rx),math.ceil(cx+rx) do
  local u,v=(x-cx)/(rx+.5),(y-cy)/(ry+.5);if u*u+v*v<=1 then local c2=type(c)=='function' and c(x,y,u,v) or c;if c2 then set[key(x,y)]=c2 end end end end
 return set
end
local function dome(cx,cy,rx,ry,ramp,cut,set)
 return ellipse(cx,cy,rx,ry,function(x,y,u,v) if cut and y>cut then return nil end
  return band(lightOf(u,v,math.sqrt(math.max(0,1-u*u-v*v))),ramp) end,set)
end
local function tube(pts,r,ramp,set)
 set=set or {};local minx,miny,maxx,maxy=1e9,1e9,-1e9,-1e9
 for _,p in ipairs(pts) do minx=math.min(minx,p[1]);maxx=math.max(maxx,p[1]);miny=math.min(miny,p[2]);maxy=math.max(maxy,p[2]) end
 for y=math.floor(miny-r-1),math.ceil(maxy+r+1) do for x=math.floor(minx-r-1),math.ceil(maxx+r+1) do
  local best,bx,by=1e9,0,0
  for i=1,#pts-1 do local a,b=pts[i],pts[i+1];local dx,dy=b[1]-a[1],b[2]-a[2];local l2=dx*dx+dy*dy
   local t=l2==0 and 0 or math.max(0,math.min(1,((x-a[1])*dx+(y-a[2])*dy)/l2))
   local qx,qy=a[1]+dx*t,a[2]+dy*t;local d=(x-qx)^2+(y-qy)^2;if d<best then best,bx,by=d,qx,qy end end
  if math.sqrt(best)<=r+.3 then local nx,ny=(x-bx)/(r+.5),(y-by)/(r+.5)
   set[key(x,y)]=band(lightOf(nx,ny,math.sqrt(math.max(0,1-nx*nx-ny*ny))),ramp) end end end
 return set
end
-- a hanging spike (stalactite) from y0 down to y0+len; lit left half, shaded right half
local function hang(x,y0,len,w,ramp,set)
 set=set or {}
 for y=y0,y0+len do local t=(y-y0)/len;local hw=w/2*(1-t)^.85
  for xx=math.floor(x-hw+.5),math.floor(x+hw-.5) do local u=(xx-x)/math.max(.5,hw)
   set[key(xx,y)]=u<-.35 and ramp[#ramp] or u<.15 and ramp[#ramp-1] or ramp[math.max(1,#ramp-2)] end end
 return set
end
-- a standing spike/spire from the floor y0 up by h; stepped shoulders
local function spire(x,y0,h,w,ramp,seed,set)
 set=set or {}
 for y=y0-h,y0 do local t=(y0-y)/h;local hw=w/2*(1-t^1.6)+.6
  if t>.55 and hash(math.floor(y/3),seed)>.6 then hw=hw*.8 end
  local lean=math.floor(t*t*w*.15*((seed%2==0) and 1 or -1))
  for xx=math.floor(x+lean-hw+.5),math.floor(x+lean+hw-.5) do local u=(xx-x-lean)/math.max(.5,hw)
   set[key(xx,y)]=u<-.4 and ramp[#ramp] or u<.2 and ramp[#ramp-1] or ramp[math.max(1,#ramp-2)] end end
 return set
end
local function shard(bx,by,tx,ty,hw,ramp,set)
 set=set or {};local dx,dy=tx-bx,ty-by;local len=math.sqrt(dx*dx+dy*dy);local ax,ay=dx/len,dy/len;local nx,ny=-ay,ax;if nx<0 then nx,ny=-nx,-ny end
 for y=math.floor(math.min(by,ty)-hw-1),math.ceil(math.max(by,ty)+hw+1) do for x=math.floor(math.min(bx,tx)-hw-1),math.ceil(math.max(bx,tx)+hw+1) do
  local qx,qy=x-bx,y-by;local u=(qx*ax+qy*ay)/len;local v=qx*nx+qy*ny
  if u>=0 and u<=1 then local w=u<=.7 and hw or hw*(1-u)/.3
   if math.abs(v)<=w+.35 then local vn=v/math.max(.5,w)
    set[key(x,y)]=vn<.1 and ((u>.7) and ramp[4] or ramp[3]) or (vn>.5 and ramp[1] or ramp[2]) end end end end
 return set
end
local function crystals(x,y,s,ramp,ring)
 local set={};shard(x-s*.6,y,x-s*1.3,y-s*1.2,s*.35,ramp,set);shard(x+s*.6,y,x+s*1.2,y-s*1.0,s*.32,ramp,set);shard(x,y,x+s*.1,y-s*2,s*.45,ramp,set)
 put(set,ring) end
local function save(spr,scale)
 local base=OUT..'/valley/'..name
 spr:saveAs(base..'.aseprite');spr:saveCopyAs(base..'.png')
 local flat=Image(W,H,ColorMode.RGB);flat:drawSprite(spr,1)
 local reps=TILE and 2 or 1;local k=scale or 2;local pv=Image(W*reps*k,H*k,ColorMode.RGB)
 for y=0,H*k-1 do for x=0,W*reps*k-1 do local c=flat:getPixel((x//k)%W,y//k)
  if app.pixelColor.rgbaA(c)==0 then local v=((x//(k*4)+y//(k*4))%2==0) and 128 or 140;c=app.pixelColor.rgba(v,v,v+8,255) end
  pv:drawPixel(x,y,c) end end
 pv:saveAs(OUT..'/previews/valley-'..name..'.png');spr:close()
 print('valley/'..name..' '..W..'x'..H..' exported')
end

-- Irregular stones packed into a region: jittered seeds on a grid, each pixel joins its nearest seed;
-- where two stones are almost equally near, a dark joint. Each stone is lit on its upper-left and
-- shaded lower-right, steps one tone up just under a joint above and one down just over a joint below.
-- region: set of pixels to fill; ramp: dark..light (4); tone varies per stone.
local function stones(region,cw,ch,ramp,gap,seed,out)
 out=out or {}
 local minx,miny,maxx,maxy=1e9,1e9,-1e9,-1e9
 each(region,function(x,y) minx=math.min(minx,x);maxx=math.max(maxx,x);miny=math.min(miny,y);maxy=math.max(maxy,y) end)
 local grid={}
 local function sd(gx,gy) local k=gx..':'..gy;local s=grid[k]
  if not s then local i=gx*7919+gy*104729
   s={(gx+.2+hash(i,seed)*.6)*cw,(gy+.2+hash(i+1,seed)*.6)*ch+((gx%2==0) and ch*.35 or 0),hash(i+2,seed)};grid[k]=s end
  return s end
 local own,base={},{}
 each(region,function(x,y,_,k)
  local gx,gy=math.floor(x/cw),math.floor(y/ch);local d1,d2,b=1e9,1e9,nil
  for j=-1,1 do for i=-1,1 do local s=sd(gx+i,gy+j);local dx,dy=(x-s[1]),(y-s[2])*1.15;local d=math.sqrt(dx*dx+dy*dy)
   if d<d1 then d2=d1;d1=d;b=s elseif d<d2 then d2=d end end end
  if d2-d1<1.1 then base[k]=gap else
   local l=-.55*(x-b[1])/cw-.95*(y-b[2])/ch+(b[3]-.5)*.5
   base[k]=l>.38 and 4 or l>.02 and 3 or l>-.36 and 2 or 1;own[k]=b end end)
 each(base,function(x,y,c,k)
  if c==gap then out[k]=gap;return end
  local up,dn=base[key(x,y-1)],base[key(x,y+1)]
  if up==gap or up==nil then c=math.min(4,c+1) elseif dn==gap then c=math.max(1,c-1) end
  out[k]=ramp[c] end)
 return out
end

-- A broken rock resting on y=by. Outline: an irregular polygon (5-7 corners, uneven radii, flat base);
-- each corner is either left sharp or bevelled (cut back along both edges), so some read as fresh
-- breaks and some as worn. Surface: flat facets fanned out from a ridge point up and left of centre,
-- each facet one tone (1 dark .. 4 light) from the direction it faces; joins on the shaded side get a
-- seam. Returns {key -> tone} and the rock's top row per column.
local function boulder(cx,by,w,h,seed)
 local cy=by-h*.5;local n=5+math.floor(hash(seed,81)*3);local raw={}
 for i=0,n-1 do local ang=-math.pi/2+i*2*math.pi/n+(hash(i,seed+82)-.5)*.95
  local r=.5+hash(i,seed+83)*.55;raw[#raw+1]={cx+math.cos(ang)*w/2*r,math.min(by,cy+math.sin(ang)*h/2*r*1.15)} end
 raw[#raw+1]={cx-w*.47,by};raw[#raw+1]={cx+w*.45,by}
 table.sort(raw,function(p,q) return math.atan(p[2]-cy,p[1]-cx)<math.atan(q[2]-cy,q[1]-cx) end)
 local pts={}
 for i,p in ipairs(raw) do local a,b=raw[(i-2)%#raw+1],raw[i%#raw+1]
  local bev=(p[2]<by-.5 and hash(i,seed+87)>.66) and (.1+hash(i,seed+88)*.14) or 0
  if bev>0 then pts[#pts+1]={p[1]+(a[1]-p[1])*bev,p[2]+(a[2]-p[2])*bev};pts[#pts+1]={p[1]+(b[1]-p[1])*bev,p[2]+(b[2]-p[2])*bev}
  else pts[#pts+1]=p end end
 local ax,ay=cx-w*(.08+hash(seed,84)*.1),cy-h*(.05+hash(seed,85)*.15)
 local function inside(x,y) local c=false;local j=#pts
  for i=1,#pts do local p,q=pts[i],pts[j];if ((p[2]>y)~=(q[2]>y)) and (x<(q[1]-p[1])*(y-p[2])/(q[2]-p[2])+p[1]) then c=not c end;j=i end;return c end
 local ang={};for i,p in ipairs(pts) do ang[i]=math.atan(p[2]-ay,p[1]-ax) end
 local tone={}
 for i=1,#pts do local p,q=pts[i],pts[i%#pts+1];local mx,my=(p[1]+q[1])/2-ax,(p[2]+q[2])/2-ay;local l=math.sqrt(mx*mx+my*my)+.01
  local L=-.75*mx/l-.95*my/l+.2+(hash(i,seed+86)-.5)*.3
  tone[i]=L>.6 and 4 or L>.1 and 3 or L>-.45 and 2 or 1 end
 local function facet(x,y) local t=math.atan(y-ay,x-ax)
  for i=1,#pts do local a0,a1=ang[i],ang[i%#pts+1];local d=(a1-a0)%(2*math.pi);local e=(t-a0)%(2*math.pi);if e<=d then return i end end
  return 1 end
 local b,fid,top={},{},{}
 for y=math.floor(by-h*.8-2),by do for x=math.floor(cx-w*.6),math.ceil(cx+w*.6) do
  if inside(x+.5,y+.5) then local fi=facet(x+.5,y+.5);fid[key(x,y)]=fi;b[key(x,y)]=tone[fi];top[x]=math.min(top[x] or 999,y) end end end
 each(b,function(x,y,c,k)
  local r,d=fid[key(x+1,y)],fid[key(x,y+1)];local me=fid[k]
  if (r and r~=me and tone[r]<=c) or (d and d~=me and tone[d]<=c) then b[k]=math.max(1,c-1) end
  if not fid[key(x,y-1)] and c>=3 then b[k]=4 end end)
 return b,top
end
-- A pile built by gravity: each rock goes where the pile is furthest below its target contour, is only
-- as wide as the ground under it is level, and sits on the highest point under it (sunk 2px), so nothing
-- floats and only crevices are left. Then the light is decided for the whole pile: rocks deep below the
-- surface fall into shadow, the top layer on slopes facing up-left lifts a step, slopes facing away drop.
-- ramp: dark..light colour indices (any length >= 4); ring: outline colour.
local function pile(width,targetOf,wmin,wmax,hmin,hmax,ramp,ring,seed,ground)
 ground=ground or 215
 local surf={};for x=0,width-1 do surf[x]=ground end
 local function S(x) return surf[x%width] end
 local tone,order,n={},{},0
 for it=1,900 do
  local bx,room=nil,3
  for x=0,width-1,3 do local xx=(x+math.floor(hash(it,seed)*3))%width;local r=S(xx)-targetOf(xx);if r>room then room,bx=r,xx end end
  if not bx then break end
  n=n+1
  local big=hash(n,seed+5)>.3
  local w=big and (wmin+math.floor(hash(n,seed)*(wmax-wmin))) or (math.floor(wmin*.5)+math.floor(hash(n,seed+6)*wmin*.5))
  local h=big and (hmin+math.floor(hash(n,seed+1)*(hmax-hmin))) or (math.floor(hmin*.5)+math.floor(hash(n,seed+7)*hmin*.5))
  if hash(n,seed+8)>.85 then w=math.floor(w*.65);h=math.floor(h*1.4) end
  -- the rock only spans ground that is roughly level (it settles into the dip it fills), and its
  -- height follows its width: a narrow dip gets a small stone, never a sliver
  local s0=S(bx);local l,r=bx,bx
  while r-l+1<w do local grew=false
   if S(l-1)>=s0-3 then l=l-1;grew=true end
   if r-l+1<w and S(r+1)>=s0-3 then r=r+1;grew=true end
   if not grew then break end end
  -- a dip too narrow for a proper stone stays a crevice: level it off and move on
  if r-l+1<math.max(6,wmin*.55) then local lv=math.min(S(l-1),S(r+1));for x=l,r do surf[x%width]=math.min(S(x),lv) end;goto continue end
  w=r-l+1;local cx=(l+r)/2
  h=math.max(4,math.min(h,room+5,math.floor(w*.85)))
  local by=ground;for x=l,r do by=math.min(by,S(x)) end;by=by+2
  local b,top=boulder(cx,by,w,h,seed*1000+n)
  order[#order+1]=b
  for x,ty in pairs(top) do local xx=x%width;surf[xx]=math.min(surf[xx],ty) end
  ::continue::
 end
 -- paint in placement order with each rock's own outline ring, keeping tones
 local map={}
 for _,b in ipairs(order) do
  each(b,function(x,y) for _,d in ipairs({{1,0},{-1,0},{0,1},{0,-1}}) do local kk=key((x+d[1])%width,y+d[2]);if not b[key(x+d[1],y+d[2])] then map[kk]=0 end end end)
  each(b,function(x,y,c) map[key(x%width,y)]=c end) end
 -- final surface and pile-wide light
 local fin={};each(map,function(x,y) fin[x]=math.min(fin[x] or 999,y) end)
 -- everything under the final surface that no rock covers is a crevice in deep shadow
 for x=0,width-1 do local top=math.min(fin[x] or 999,surf[x]);for y=top,ground do local k=key(x,y);if map[k]==nil then map[k]=0 end end end
 local out={}
 each(map,function(x,y,c,k)
  if c==0 then out[k]=ring;return end
  local F=function(xx) return fin[xx%width] or y end
  local depth=y-F(x);local slope=F(x+6)-F(x-6)
  local off=depth<20 and 0 or depth<46 and -1 or -2
  if depth<12 and slope<-3 then off=off+1 elseif depth<20 and slope>3 then off=off-1 end
  out[k]=ramp[math.max(1,math.min(#ramp,c+(#ramp-4)+off))] end)
 return out
end
---------------------------------------------------------------- BACK: the cave's far wall, almost black
do local spr=sheet('back',480,216,{'07070f','0b0b17','0f0f1e','141426','1a1a30','2a4a80','4a7ac0'},true,true)
 -- thick, root-like ribs: wandering tubes whose radius swells and thins, a lighter rim on their left
 local function rib(pts,r0,c)
  for i=1,#pts-1 do local a,b=pts[i],pts[i+1]
   for t=0,1,.02 do local x,y=a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t;local r=r0*(.7+.5*math.abs(math.sin((i+t)*1.7)))
    for yy=math.floor(y-r),math.ceil(y+r) do for xx=math.floor(x-r),math.ceil(x+r) do if (xx-x)^2+(yy-y)^2<=r*r then px(xx,yy,(xx<x-r*.5) and c+1 or c) end end end end end
 end
 -- big arches: two ribs meeting overhead
 for _,a in ipairs({{120,30,170,60,10},{340,20,190,80,12},{250,110,120,40,8},{60,120,90,30,7},{420,130,100,34,7}}) do
  local cx,top,span,h,r=a[1],a[2],a[3],a[4],a[5]
  local pts={};for i=0,12 do local t=i/12;local x=cx-span/2+span*t;local y=top+h*(2*t-1)^2*1.6;pts[#pts+1]={x,math.min(216,y)} end
  pts[1][2]=216;pts[#pts][2]=216
  rib(pts,r,2) end
 -- hanging roots from the ceiling
 for i=0,7 do local x=i*60+hash(i,1)*30;local pts={{x,0}}
  for s=1,6 do pts[#pts+1]={x+(hash(i*9+s,2)-.5)*40,s*22} end;rib(pts,4,2) end
 -- floor mounds
 for x=0,479 do local h=10+math.floor(6*math.sin(x/37)+4*math.sin(x/13+1));for y=216-h,215 do px(x,y,(y<216-h+2) and 4 or 3) end end
 local g=poly({{226,10},{232,6},{244,5},{252,8},{248,13},{236,14}},6);put(g,4)
 for _,q in ipairs({{233,8},{234,8},{235,7},{238,7}}) do px(q[1],q[2],7) end
 save(spr,2)
end

---------------------------------------------------------------- FAR: stalactite ceiling, spires on the floor
do local spr=sheet('far',640,216,{'141432','1e2048','2a2e5e','3a4074','4c5590','1a7aa8','28aed0','4cd8ec','a0f2fa'},true,false)
 local R={2,3,4,5};local CR={6,7,8,9}
 -- ceiling: a deep band; stalactites come in groups of a big one flanked by smaller ones
 local s={}
 for x=0,639 do local d=16+math.floor(6*math.sin(x/29)+4*math.sin(x/11+2));for y=0,d do s[key(x,y)]=(y>d-3) and 3 or 2 end end
 for i=0,11 do local x=i*54+hash(i,4)*20
  hang(x,14,30+hash(i,5)*40,18+hash(i,6)*12,R,s)
  hang(x-12-hash(i,7)*6,14,12+hash(i,8)*14,9,R,s);hang(x+13+hash(i,9)*6,14,10+hash(i,10)*16,10,R,s) end
 put(s,1)
 for _,c in ipairs({{58,24,5},{304,22,3},{548,26,6},{606,20,3}}) do crystals(c[1],c[2],c[3],CR) end
 -- floor: mounds, and blocky spires built from stacked, narrowing blocks with flat ledges
 local f={}
 for x=0,639 do local d=194+math.floor(4*math.sin(x/31)+3*math.sin(x/11+1));for y=d,215 do f[key(x,y)]=y<d+2 and 4 or (y<d+8 and 3 or 2) end end
 local function pillar(x,h,w,seed)
  local y=196;local ww=w;local lean=0
  local cut=0
  while y>196-h and ww>=3 do local seg=8+math.floor(hash(y,seed)*10);lean=lean+((hash(y+5,seed)>.5) and 1 or -1)
   local l0,r0=math.floor(x+lean-ww/2),math.floor(x+lean+ww/2)
   for yy=y-seg,y do for xx=l0,r0 do local u=(xx-(x+lean))/(ww/2)
    f[key(xx,yy)]=(yy==y-seg) and 5 or (u<-.3 and 5 or u<.3 and 4 or 3) end end
   y=y-seg;local shrink=2+math.floor(hash(y,seed)*3);ww=ww-shrink
   -- lop the next block off one side only, so the steps are lopsided
   if hash(y+9,seed)>.5 then lean=lean+math.floor(shrink/2) else lean=lean-math.floor(shrink/2) end end
  -- point on top
  local tx=x+lean;for k=0,math.max(2,ww) do for xx=math.floor(tx-(ww-k)/2),math.floor(tx+(ww-k)/2) do f[key(xx,y-k)]=(xx<tx) and 5 or 4 end end
 end
 for _,p in ipairs({{86,74,26,1},{112,34,12,2},{196,40,14,3},{330,78,28,4},{356,36,12,5},{430,26,10,6},{512,62,22,7},{536,32,12,8},{600,40,14,9},{20,30,12,10},{260,22,10,11}}) do pillar(p[1],p[2],p[3],p[4]) end
 for _,m in ipairs({{150,199,24,7},{410,200,30,7},{580,200,26,6}}) do dome(m[1],m[2],m[3],m[4],R,nil,f) end
 put(f,1)
 for _,c in ipairs({{48,205,4},{176,204,3},{298,205,4},{460,206,3},{586,205,4}}) do crystals(c[1],c[2],c[3],CR) end
 save(spr,2)
end

---------------------------------------------------------------- MID: the junk heap on a bed of purple rubble
do local P={'1a1030','2a1a48','3c2864','52388a','6a4caa','8466c4'}
 local hex={P[1],P[2],P[3],P[4],P[5],P[6],'24182e','3a3050','5a5274','3c3848','5c5868','7c7884','9a968c','5a2a20','8a3e24','b05a2a','d27c3c','4a2830','7a4434','a06446','c08454','1a7aa8','28aed0','4cd8ec','a0f2fa','b07010','f0b030','ffe27a','8a1c28','c8343c'}
 local spr=sheet('mid',768,216,hex,true,false)
 local MET={10,10,11,12,13};local RUST={14,15,15,16,17};local CYAN={22,23,24,25};local RUB={7,7,8,9}
 -- the heap: a rolling contour filled with irregular rubble
 local function heapTop(x) return 150-math.floor(14*math.max(0,math.sin(x/122*math.pi*2/2.1))+8*math.sin(x/47+1)+5*math.sin(x/17)) end
 local base={};for x=0,767 do for y=heapTop(x)+6,215 do base[key(x,y)]=2 end end;put(base)
 put(pile(768,heapTop,20,36,13,22,{2,3,4,5,6},1,31))
 local function junkTube(pts,r) local p=tube(pts,r,MET);each(p,function(x,y,c,k) if hash(math.floor(x/5)*31+math.floor(y/5),3)>.5 then for i,m in ipairs(MET) do if c==m then p[k]=RUST[i] end end end end);put(p,1) end
 local function mouth(x,y,rx,ry) put(ellipse(x,y,rx,ry,function(xx,yy,u,v) return (u*u+v*v<.42) and 1 or band(lightOf(u,v,.3),RUST) end),1) end
 local function tire(cx,cy,rx,ry)
  local t={};ellipse(cx,cy,rx,ry,function(x,y,u,v) local r=u*u+v*v;if r<.3 then return nil end
   local c=band(lightOf(u,v,.4),RUB);if r>.55 and ((math.floor(math.atan(v,u)*9))%2==0) then c=7 end;return c end,t);put(t,1) end
 local function crate(x0,y0,w,h)
  local c={}
  for y=y0,y0+h do for x=x0,x0+w do local e=(x<=x0+2 or x>=x0+w-2 or y<=y0+2 or y>=y0+h-2)
   c[key(x,y)]=e and ((y<=y0+1 or x<=x0+1) and 21 or ((y>=y0+h-1 or x>=x0+w-1) and 18 or 20)) or (((x-x0)%6==0) and 18 or 20) end end
  for i=0,w-6 do local x=x0+3+i;local y=y0+h-3-math.floor(i*(h-6)/(w-6));for d=0,2 do c[key(x,y+d-1)]=d==0 and 21 or (d==2 and 18 or 20) end end
  poly({{x0+w*.5,y0+3},{x0+w*.82,y0+3},{x0+w*.78,y0+h*.5},{x0+w*.62,y0+h*.58},{x0+w*.55,y0+h*.3}},1,c)
  put(c,1) end
 local function gear(cx,cy,R)
  local g={}
  for y=cy-R-1,cy+R+1 do for x=cx-R-1,cx+R+1 do local dx,dy=x-cx,y-cy;local d=math.sqrt(dx*dx+dy*dy);local a=math.atan(dy,dx)
   local tooth=(math.floor((a+math.pi)/(math.pi/9))%2==0);local rr=tooth and R or R-2
   local spoke=math.abs(((a+math.pi)%(math.pi/3))-math.pi/6)<.2
   if d<=rr and (d>R-5 or d<4 or spoke) then g[key(x,y)]=band(lightOf(dx/R,dy/R,.5),RUST) end end end
  put(g,1) end
 local function can(cx,cy,red) put(tube({{cx-4,cy},{cx+4,cy}},4,red and {29,29,30,30,13} or MET),1);put(ellipse(cx+5,cy,1.5,3.5,red and 30 or 12),1) end
 local function star(cx,cy,r)
  local pts={};for i=0,7 do local a=-math.pi/2+i*math.pi/4;local rr=i%2==0 and r or r*.4;pts[#pts+1]={cx+math.cos(a)*rr,cy+math.sin(a)*rr} end
  put(poly(pts,function(x,y) return (x<=cx and y<=cy) and 28 or ((x>cx and y>cy) and 26 or 27) end),1) end
 local function plate(pts) put(poly(pts,function(x,y) return hash(math.floor(x/6)+math.floor(y/6)*17,6)>.45 and 15 or (y<pts[1][2]+3 and 13 or 11) end),1) end
 local function plank(x,y,len,ang) local p={}
  for i=0,len do for w=0,4 do p[key(x+math.floor(i*math.cos(ang)-w*math.sin(ang)+.5),y-math.floor(i*math.sin(ang)+w*math.cos(ang)+.5))]=w==0 and 21 or (w==4 and 18 or 20) end end
  for w=0,4 do p[key(x+math.floor(len*math.cos(ang)-w*math.sin(ang)+.5)+((w%2==0) and 1 or -1),y-math.floor(len*math.sin(ang)+w*math.cos(ang)+.5)-1)]=21 end
  put(p,1) end
 -- arranged after the reference: pipes standing out of the pile, crates half-buried, tires on their sides
 junkTube({{36,150},{36,128},{50,128}},6);mouth(56,128,3,6)
 tire(40,182,30,17);plate({{74,148},{104,142},{110,176},{78,182}});plank(98,150,32,1.15)
 crystals(126,148,11,CYAN,1);crate(118,150,56,40);can(92,192,true);can(140,196)
 star(22,196,9);plank(184,166,24,1.25)
 junkTube({{232,196},{232,152},{258,152},{258,120}},7);mouth(258,118,7,3)
 junkTube({{214,186},{290,186},{300,200}},6);gear(304,158,22);star(352,140,10)
 plate({{360,148},{394,136},{404,176},{372,186}});tire(426,186,32,18);crate(508,140,60,42)
 crystals(476,152,11,CYAN,1);plank(566,146,26,1.35);can(484,196,true);can(540,198)
 junkTube({{622,150},{622,118}},7);mouth(622,116,7,3)
 plate({{582,176},{618,168},{624,200},{588,204}});star(654,190,9);gear(700,166,13);tire(744,186,26,15)
 save(spr,2)
end

---------------------------------------------------------------- NEAR: mossy stalactites and boulders with crystals
do local P={'140c26','1c1236','2c1e50','3e2c6c','54408c','6c58aa','8a78c6'}
 local hex={P[1],P[2],P[3],P[4],P[5],P[6],P[7],'3a4a14','5e6e1a','8a9a24','b8c43a','dce070','1a7aa8','28aed0','4cd8ec','a0f2fa','e4ffff'}
 local spr=sheet('near',896,216,hex,true,false)
 local CR={13,14,15,16}
 -- moss over a pixel set's top contour in runs; each run drips
 local function mossOn(set,seed,cover)
  local top={};each(set,function(x,y) top[x]=math.min(top[x] or 999,y) end)
  for x,ty in pairs(top) do local run=math.floor(x/14)
   if hash(run,seed)<cover then
    local d=3+math.floor(hash(math.floor(x/3),seed+1)*3);for k=0,d do set[key(x,ty+k)]=k==0 and 12 or k<=2 and 11 or 10 end
    local L=hash(x,seed+2)>.55 and math.floor(hash(x,seed+3)*9)+2 or 0
    for k=1,L do local kk=key(x,ty+d+k);if set[kk] then set[kk]=k==L and 8 or 9 end end end end end
 -- ceiling with wide stalactites, mossy along the lip
 local s={}
 for x=0,895 do local d=12+math.floor(5*math.sin(x/23)+3*math.sin(x/7));for y=0,d do s[key(x,y)]=(y>d-3) and 4 or 3 end end
 for i=0,15 do local x=i*56+hash(i,11)*24;hang(x,10,26+hash(i,12)*44,20+hash(i,13)*14,{3,4,5,6},s)
  hang(x+16,10,10+hash(i,14)*16,10,{3,4,5,6},s) end
 local lip={};each(s,function(x,y,c,k) if not s[key(x,y+1)] and y<=20 then lip[x]=y end end)
 for x,y in pairs(lip) do if hash(math.floor(x/16),15)>.4 then local L=math.floor(hash(x,16)*10)+1
  for t=0,L do s[key(x,y-t+1)]=nil end;for t=1,L do s[key(x,y+t)]=t==L and 8 or (t<3 and 10 or 9) end;s[key(x,y)]=11 end end
 put(s,1)
 -- floor: big boulders packed along a rolling ridge, moss on many tops
 local function ridge(x) return 168-math.floor(30*math.max(0,math.sin(x/112))+14*math.max(0,math.sin(x/47+2))+5*math.sin(x/13)) end
 local base={};for x=0,895 do for y=ridge(x)+10,215 do base[key(x,y)]=3 end end;put(base)
 local rocks=pile(896,ridge,24,64,18,44,{2,3,4,5,6,7},1,47)
 mossOn(rocks,53,.55)
 put(rocks)
 for _,c in ipairs({{110,186,10},{246,194,6},{448,176,11},{640,188,7},{780,174,10},{860,194,5}}) do crystals(c[1],c[2],c[3],CR,1) end
 save(spr,2)
end

---------------------------------------------------------------- FG: hanging rock masses and floor silhouettes
do local hex={'0a0614','140e26','201838','2e2450','3e3266','4ad0e0','3a4a14','5e6e1a','8a9a24','b8c43a','b07010','f0b030','ffe27a','fff4c0','3a1e4a','6a2a6a','1a7aa8','4cd8ec','a0f2fa'}
 local spr=sheet('fg',640,216,hex,true,false)
 local function mass(x0,x1,seed)
  local s={}
  for x=x0,x1 do local base=12+math.floor(5*math.sin(x/13+seed)+3*math.sin(x/5))
   for y=0,base do s[key(x,y)]=(y<5) and 4 or 3 end end
  -- a few big spikes with smaller ones between
  local n=math.max(2,math.floor((x1-x0)/48))
  for i=0,n do local x=x0+14+i*(x1-x0-28)/n+(hash(i,seed+1)-.5)*10
   hang(x,10,40+hash(i,seed+2)*46,26+hash(i,seed+3)*12,{2,3,4},s)
   if i<n then hang(x+(x1-x0)/n*.5,10,14+hash(i,seed+4)*18,14,{2,3,4},s) end end
  -- cyan rim on the upper-left edges
  local rim={};each(s,function(x,y,c,k) if (not s[key(x-1,y)]) and hash(y,seed)>.1 then rim[k]=6 end end)
  for k,c in pairs(rim) do s[k]=c end
  put(s,1)
 end
 local function vine(x,y0,len)
  local v={};for y=y0,y0+len do local xx=x+math.floor(1.5*math.sin(y/7)+.5);v[key(xx,y)]=8;v[key(xx+1,y)]=7
   if y%6==0 then v[key(xx-1,y)]=9;v[key(xx-2,y-1)]=10;v[key(xx-2,y)]=9 elseif y%6==3 then v[key(xx+2,y)]=9;v[key(xx+3,y-1)]=10;v[key(xx+3,y)]=8 end end
  put(v,1) end
 mass(4,214,1);mass(236,632,5)
 for _,v in ipairs({{48,16,80},{150,18,60},{208,20,96},{330,20,54},{404,22,74},{462,18,58},{532,20,92},{598,18,70}}) do vine(v[1],v[2],v[3]) end
 for y=30,50 do px(160,y,(y%3==0) and 11 or 12) end
 local l={};for y=51,70 do for x=152,168 do local e=(x==152 or x==168 or y==51 or y==70 or y==56);l[key(x,y)]=e and 11 or (x<=157 and 14 or 13) end end
 for _,x in ipairs({157,163}) do for y=57,69 do l[key(x,y)]=11 end end
 for x=150,170 do l[key(x,50)]=12 end;for x=156,164 do l[key(x,71)]=11 end;put(l,1)
 put(shard(371,22,368,54,5,{17,17,18,19},{}),1);put(shard(382,26,386,44,3,{17,17,18,19},{}),1)
 local b={};for x=478,508 do b[key(x,54)]=12;b[key(x,55)]=11 end
 for y=57,96 do for x=482,504 do local notch=y>88 and math.abs(x-493)<(y-88)
  if not notch then b[key(x,y)]=(x<=483 or x>=503) and 12 or 15 end end end
 for _,q in ipairs({{493,68},{493,69},{493,70},{493,71},{493,72},{490,70},{491,70},{495,70},{496,70},{491,68},{495,72},{491,72},{495,68}}) do b[key(q[1],q[2])]=13 end
 put(b,1)
 local f={}
 for _,p in ipairs({{16,30,12},{34,16,8},{150,26,10},{170,14,8},{238,18,8},{350,30,12},{366,18,8},{420,14,8},{520,18,10},{606,26,12},{624,14,8}}) do spire(p[1],214,p[2],p[3],{2,3,4},p[1],f) end
 for x=0,639 do for y=212,215 do f[key(x,y)]=2 end end
 -- ruined arch built from blocks
 local function blk(x0,y0,w,h) for y=y0,y0+h-1 do for x=x0,x0+w-1 do f[key(x,y)]=(y==y0 or x==x0) and 5 or ((y==y0+h-1 or x==x0+w-1) and 2 or 3) end end end
 for i,y in ipairs({204,196,188,180}) do blk(58,y,11,8);blk(96,y,11,8) end
 blk(62,172,12,8);blk(74,168,14,8);blk(88,170,12,8)
 dome(270,204,9,10,{2,3,4,5},nil,f);for x=265,275 do f[key(x,193)]=4 end
 for y=198,213 do for x=284,300 do f[key(x,y)]=((x-284)%5==0) and 2 or (x<=287 and 4 or 3) end end;for x=284,300 do f[key(x,201)]=5;f[key(x,209)]=5 end
 for y=186,214 do for x=566,580 do f[key(x,y)]=((x-566)%4==0) and 2 or ((x<=569) and 5 or 3) end end
 for x=562,584 do f[key(x,184)]=5;f[key(x,185)]=4;f[key(x,213)]=4 end
 put(f,1)
 for x=58,107 do local top=nil;for y=165,185 do if not top and f[key(x,y)] then top=y end end
  if top and (x<80 or x>98) then px(x,top,10);px(x,top+1,9);if x%3==0 then px(x,top+2,8);px(x,top+3,8);px(x,top+4,7) end end end
 for x=562,576 do px(x,183,10);px(x,184,9) end;for y=184,200 do if y%2==0 then px(567,y,8) end end
 save(spr,2)
end

---------------------------------------------------------------- GROUND: mossy turf over packed stones
do local hex={'12122a','1a1a30','2a2e48','3c4466','545e84','7480a4','2a4a10','4a7a10','7cb01a','a8d42a','d4ec60','1a7aa8','28aed0','4cd8ec','a0f2fa','5a2a20','8a3e24','b05a2a','d27c3c','4a2830','7a4434'}
 local spr=sheet('ground',256,48,hex,true,false)
 local CR={12,13,14,15};local RUST={16,17,17,18,19}
 local region={};for x=0,255 do for y=13,47 do region[key(x,y)]=1 end end
 local s=stones(region,16,10,{3,4,5,6},2,61)
 each(s,function(x,y,c,k) if y>=44 and c~=2 then s[k]=math.max(3,c-1) end end)
 put(s)
 local g={}
 for y=26,46 do for x=50,74 do local dx,dy=x-62,y-44;local d=math.sqrt(dx*dx+dy*dy);local a=math.atan(dy,dx)
  local tooth=(math.floor((a+math.pi)/(math.pi/7))%2==0);local rr=tooth and 11 or 9
  local spoke=math.abs(((a+math.pi)%(math.pi/3))-math.pi/6)<.22
  if d<=rr and (d>7 or d<2.5 or spoke) and y<=45 then g[key(x,y)]=band(lightOf(dx/11,dy/11,.5),RUST) end end end
 put(g,1)
 local p={};for i=0,18 do for w=0,5 do p[key(124+i,38-math.floor(i*.35)+w)]=(w==0) and 19 or (w==5 and 16 or 18) end end;put(p,1)
 for _,q in ipairs({{127,39},{133,37},{139,35}}) do px(q[1],q[2],1) end
 put(ellipse(196,38,7,7,function(x,y,u,v) local r=u*u+v*v;if r<.45 then return 1 end;return band(lightOf(u,v,.3),RUST) end),1)
 crystals(18,44,7,CR,1);crystals(150,44,4,CR,1);crystals(232,44,6,CR,1)
 local t={}
 for x=0,255 do local top=9-math.floor(1.2*math.max(0,math.sin(x/5.3))+.6*math.sin(x/2.1)+.5)
  for y=top,13 do local c=y==top and 11 or (y<=top+2 and 10 or 9)
   if y>top and hash(math.floor(x/4)*7+math.floor(y/2),62)>.78 then c=c-1 end
   t[key(x,y)]=c end
  local L=({0,2,4,1,3,6,2,0,5,1,3,2})[(x*5)%12+1];for k=1,L do t[key(x,13+k)]=k==L and 7 or (k==1 and 9 or 8) end end
 for _,cx in ipairs({22,70,118,150,214,240}) do
  for i,b in ipairs({{-3,4,-1},{-1,6,0},{1,5,1},{3,3,1}}) do for k=0,b[2]-1 do t[key(cx+b[1]+math.floor(b[3]*k/3),8-k)]=k==b[2]-1 and 11 or 10 end end end
 put(t)
 save(spr,4)
end

---------------------------------------------------------------- PLATFORM: a floating island
do local hex={'140c26','1c1236','2c1e50','3e2c6c','54408c','6c58aa','8a78c6','3a4a14','5e6e1a','8a9a24','b8c43a','dce070','7a4a20','a86c34','1a7aa8','4cd8ec','a0f2fa'}
 local spr=sheet('platform',128,48,hex,false,false)
 -- body: rows of blocks that step inward, deepest under the middle-right
 local region={}
 for y=8,46 do local t=(y-8)/38;local hl=58*(1-t^1.3)-math.floor(hash(math.floor(y/5),70)*4);local hr=60*(1-t^1.6)-math.floor(hash(math.floor(y/5),71)*4)
  for x=math.floor(66-hl),math.floor(66+hr) do region[key(x,y)]=1 end end
 local s=stones(region,14,9,{3,4,5,6},2,73)
 put(s,1)
 local r={}
 local function root(pts) for k,c in pairs(tube(pts,1,{13,13,14,14,14})) do r[k]=c end end
 root({{34,14},{30,26},{22,34},{18,40}});root({{30,26},{36,34},{38,40}});root({{96,16},{100,28},{92,36},{88,42}});root({{100,28},{106,36}})
 put(r,1)
 put(shard(108,30,112,18,3,{15,15,16,17},{}),1);put(shard(103,32,102,24,2,{15,15,16,17},{}),1)
 local m={}
 for x=5,124 do local top=4-math.floor(1.2*math.max(0,math.sin(x/5.7))+.6*math.sin(x/2.3)+.5)
  for y=top,9 do local c=y==top and 12 or (y<=top+2 and 11 or (y==8 and 10 or 9))
   if y>top and hash(math.floor(x/4)*7+math.floor(y/2),74)>.75 then c=c-1 end
   m[key(x,y)]=c end
  local L=({0,3,6,1,2,9,4,0,2,7,1,5})[(x*7)%12+1];for k=1,L do m[key(x,9+k)]=k==L and 8 or 9 end end
 for _,cx in ipairs({20,56,108}) do for _,b in ipairs({{-3,3,-1},{-1,5,0},{1,4,1},{3,2,1}}) do for k=0,b[2]-1 do m[key(cx+b[1]+math.floor(b[3]*k/2),3-k)]=k==b[2]-1 and 12 or 11 end end end
 put(m,1)
 save(spr,4)
end
