-- Junk sheet, redrawn natively from art/參考原圖/props/junk.png.
-- The junk reference was generated at a finer grain (~4.5 source px per art px) than the other prop
-- sheets (~7). To keep one world scale with flowers, crystals and rocks, the objects are measured at ~7
-- source px per art px: tire ~43x22, can ~20x34, pipe ~31x39, crate ~44x33, bottle ~18x36. Sheet: eight
-- 48x40 cells, ground on row 38. Colors are sampled from the reference.
-- Round things (tire, can, pipe, bottle) are shaded from their surface normals; flat things (planks,
-- crate, sign) from fixed face tones; rust is a smooth value-noise mask so it forms patches, not speckle.
-- Run: aseprite -b --script-param out=art/drafts --script tools/redraw-props-junk-reference.lua
local OUT=app.params['out']
local HEX={'140a18',                                  -- 1 outline / holes
 '24182e','342646','463c5e','5a5274','a88a6a',        -- 2-6 rubber, worn tan
 '3c3848','5c5868','7c7884','9a968c','c4bca2',        -- 7-11 metal
 '5a2a20','8a3e24','b05a2a','d27c3c',                 -- 12-15 rust
 '4a2830','7a4434','a06446','c08454','e4b072',        -- 16-20 wood
 '2a5a7a','3e8a9a','6aa6b4','b4e4ea','f4f8f8','6a5a94','8a7ab4'}  -- 21-27 glass
local CW,CH,N,G=48,40,8,38
local spr=Sprite(CW*N,CH,ColorMode.RGB)
local pal=Palette(#HEX+1);pal:setColor(0,Color{r=0,g=0,b=0,a=0})
local C={}
for i,v in ipairs(HEX) do local r,g,b=tonumber(v:sub(1,2),16),tonumber(v:sub(3,4),16),tonumber(v:sub(5,6),16)
 C[i]=app.pixelColor.rgba(r,g,b,255);pal:setColor(i,Color{r=r,g=g,b=b,a=255}) end
spr:setPalette(pal)
local img=spr.cels[1].image;spr.layers[1].name='Junk'
local OX=0
local function px(x,y,c) x=OX+x;if x>=OX and x<OX+CW and y>=0 and y<CH then img:drawPixel(x,y,C[c]) end end
local function key(x,y) return x..','..y end
local function each(set,fn) for k,c in pairs(set) do local x,y=k:match('(-?%d+),(-?%d+)');fn(tonumber(x),tonumber(y),c,k) end end
local function put(set,noring)
 if not noring then each(set,function(x,y)
  for _,d in ipairs({{1,0},{-1,0},{0,1},{0,-1}}) do if not set[key(x+d[1],y+d[2])] then px(x+d[1],y+d[2],1) end end end) end
 each(set,function(x,y,c) px(x,y,c) end)
end
local function lightOf(nx,ny,nz) return -.5*nx-.62*ny+.6*nz end
local function band(l,r) if l>.8 then return r[5] elseif l>.5 then return r[4] elseif l>.18 then return r[3] elseif l>-.2 then return r[2] else return r[1] end end
local RUBBER={2,3,4,5,6};local METAL={7,8,9,10,11};local RUST={12,13,13,14,15};local WOOD={16,17,18,19,20}
-- smooth value noise in [0,1], grid of `cell` px
local function hash(i,j,s) local h=math.sin(i*127.1+j*311.7+s*74.7)*43758.5453;return h-math.floor(h) end
local function vnoise(x,y,cell,s)
 local fx,fy=x/cell,y/cell;local i,j=math.floor(fx),math.floor(fy);local u,v=fx-i,fy-j
 u=u*u*(3-2*u);v=v*v*(3-2*v)
 local a,b,c,d=hash(i,j,s),hash(i+1,j,s),hash(i,j+1,s),hash(i+1,j+1,s)
 return (a*(1-u)+b*u)*(1-v)+(c*(1-u)+d*u)*v
end
-- turn metal pixels to rust where the noise is high; keeps the light band so the form survives
local function rustify(set,seed,amount)
 each(set,function(x,y,c,k)
  for i,m in ipairs(METAL) do if c==m and vnoise(x,y,4,seed)>1-amount then set[k]=RUST[i] end end end)
end
-- tube along a polyline, radius r, shaded from its normals
local function tube(pts,r,ramp,set)
 set=set or {}
 local minx,miny,maxx,maxy=1e9,1e9,-1e9,-1e9
 for _,p in ipairs(pts) do minx=math.min(minx,p[1]);maxx=math.max(maxx,p[1]);miny=math.min(miny,p[2]);maxy=math.max(maxy,p[2]) end
 for y=math.floor(miny-r-1),math.ceil(maxy+r+1) do for x=math.floor(minx-r-1),math.ceil(maxx+r+1) do
  local best,bx,by=1e9,0,0
  for i=1,#pts-1 do local a,b=pts[i],pts[i+1];local dx,dy=b[1]-a[1],b[2]-a[2];local l2=dx*dx+dy*dy
   local t=l2==0 and 0 or math.max(0,math.min(1,((x-a[1])*dx+(y-a[2])*dy)/l2))
   local qx,qy=a[1]+dx*t,a[2]+dy*t;local d=(x-qx)^2+(y-qy)^2
   if d<best then best,bx,by=d,qx,qy end end
  local d=math.sqrt(best)
  if d<=r+.3 then local nx,ny=(x-bx)/(r+.5),(y-by)/(r+.5);local nz=math.sqrt(math.max(0,1-nx*nx-ny*ny))
   set[key(x,y)]=band(lightOf(nx,ny,nz),ramp) end end end
 return set
end
local function ellipse(cx,cy,rx,ry,c,set)
 set=set or {}
 for y=math.floor(cy-ry),math.ceil(cy+ry) do for x=math.floor(cx-rx),math.ceil(cx+rx) do
  local u,v=(x-cx)/(rx+.5),(y-cy)/(ry+.5);if u*u+v*v<=1 then set[key(x,y)]=type(c)=='function' and c(x,y,u,v) or c end end end
 return set
end
local function poly(p,c,set)
 set=set or {};local lo,hi=1e9,-1e9;for _,a in ipairs(p) do lo=math.min(lo,a[2]);hi=math.max(hi,a[2]) end
 for y=math.floor(lo),math.ceil(hi) do local xs={};local j=#p
  for i=1,#p do local a,b=p[i],p[j];if (a[2]<=y and b[2]>y) or (b[2]<=y and a[2]>y) then xs[#xs+1]=a[1]+(y-a[2])*(b[1]-a[1])/(b[2]-a[2]) end;j=i end
  table.sort(xs);for i=1,#xs-1,2 do for x=math.floor(xs[i]+.5),math.floor(xs[i+1]-.5) do set[key(x,y)]=type(c)=='function' and c(x,y) or c end end end
 return set
end
local function pebbles(list) for _,p in ipairs(list) do
 put(ellipse(p[1],p[2],p[3],p[4],function(x,y,u,v) return band(lightOf(u,v,math.sqrt(math.max(0,1-u*u-v*v))),METAL) end)) end end
local function nail(x,y) px(x,y,10);px(x+1,y,8);px(x,y+1,8);px(x+1,y+1,7) end

-- 1 worn tire lying flat: tan-worn top ring around a dark hole, cracked tread on the side wall, a torn gap
OX=0
do local cx,ty,rx,ryT,h=24,22,20,6,11
 local s={}
 -- side wall first: a band between the top ellipse and the bottom ellipse, shaded across its width
 for y=ty,ty+h+ryT do for x=cx-rx,cx+rx do local u=(x-cx)/(rx+.5)
  local yb=ty+h+ryT*math.sqrt(math.max(0,1-u*u))
  if y<=yb then local row=(y-ty)/(h+ryT)
   -- the wall bulges: lit just under the rim and on the left, falling into shade below and right
   local l=-.7*u+.35-row*.9;local c=l>.3 and 5 or l>-.25 and 4 or l>-.75 and 3 or 2
   -- tread: two rows of blocks; seams bunch up toward the sides because the wall turns away
   local a=math.asin(math.max(-1,math.min(1,u)))/(math.pi/2)
   local seam=((a*11+(y>ty+h*.55 and .5 or 0))%1)<.13
   local mid=math.floor(ty+ryT*math.sqrt(math.max(0,1-u*u))*.4+h*.55)
   if (seam and y>ty+3) or y==mid then c=math.max(2,c-2) end
   s[key(x,y)]=c end end end
 -- top surface: worn tan toward the upper left, rubber elsewhere; the hole is a dark ellipse inside it
 ellipse(cx,ty,rx,ryT,function(x,y,u,v) local l=-.7*u-.7*v;return l>.55 and 6 or l>.1 and 5 or l>-.4 and 4 or 3 end,s)
 ellipse(cx,ty,11,3,function(x,y,u,v) return v>.2 and 2 or 1 end,s)
 -- torn gap in the wall, its edges catch a little tan
 poly({{31,27},{34,30},{32,35},{29,31}},1,s);s[key(29,30)]=6;s[key(31,27)]=6
 put(s)
 pebbles({{3,37,2.5,1.5},{8,38,2,1},{44,37,2.5,1.5}})
end
-- 2 crumpled tin can, rusty, with its pull tab sticking up
OX=48
do local s={}
 for y=9,37 do local pinch=(y>=19 and y<=26) and ((y==22 or y==23) and 2 or 1) or 0
  for x=15+pinch,33-pinch do local u=(x-24)/(9.5-pinch);local l=lightOf(u,0,math.sqrt(math.max(0,1-u*u)))
   local c=band(l,METAL)
   -- dents: a light and a dark crease forming a Z across the waist
   if y==19 and x>=19 and x<=29 then c=11 elseif y==20 and x>=19 and x<=29 then c=7 end
   if (y>=20 and y<=26) and x==30-(y-20) then c=11 end;if (y>=21 and y<=27) and x==31-(y-21) then c=7 end
   if y==27 and x>=18 and x<=28 then c=11 elseif y==28 and x>=18 and x<=28 then c=8 end
   s[key(x,y)]=c end end
 rustify(s,3,.45)
 for x=15,33 do s[key(x,36)]=13;s[key(x,37)]=12 end   -- rusted bottom rim
 ellipse(24,8,9,3,function(x,y,u,v) return (u*u+v*v<.45) and (v<0 and 1 or 2) or (v<0 and 11 or 9) end,s)
 put(s)
 -- pull tab: a bent ring with two holes, rising from the rim
 local t=ellipse(29,3,5,2.4,function(x,y,u,v) return v<0 and 11 or 10 end)
 for _,h in ipairs({{28,3},{29,3},{30,3}}) do t[key(h[1],h[2])]=nil end
 for y=4,7 do t[key(25,y)]=10 end
 put(t)
 for _,h in ipairs({{28,3},{29,3},{30,3}}) do px(h[1],h[2],1) end
end
-- 3 two broken planks, the top one holed, nails at the ends, splintered right ends
OX=96
do local function plank(p,s)
  local ys={};for _,q in ipairs(p) do ys[#ys+1]=q[2] end
  poly(p,function(x,y)
   local top=p[1][2]+(p[2][2]-p[1][2])*(x-p[1][1])/(p[2][1]-p[1][1])
   local d=y-top;return d<1 and 20 or d<2 and 19 or (d>=5 and 17) or ((x+y*3)%9==0 and 17 or 18) end,s)
  return s end
 local s=plank({{3,30},{40,26},{43,29},{41,33},{44,35},{4,37}},{})
 put(s)
 local t=plank({{6,21},{36,17},{40,20},{37,22},{41,25},{38,27},{7,29}},{})
 poly({{20,21},{25,20},{24,23},{20,24}},1,t)
 put(t)
 nail(8,24);nail(8,32);nail(33,22)
end
-- 4 elbow pipe on a flange: up, round the bend, open end facing right; a collar halfway
OX=144
do local s=tube({{20,34},{20,16},{21,12},{24,9},{28,8},{34,8}},5.2,METAL)
 rustify(s,7,.5)
 -- collar
 for y=24,26 do for x=14,26 do local u=(x-20)/6.5;s[key(x,y)]=band(lightOf(u,0,math.sqrt(math.max(0,1-u*u))),RUST) end end
 for x=15,25 do s[key(x,27)]=12 end
 put(s)
 -- flange plate on the ground with bolts
 local f={};for y=35,38 do for x=9,31 do f[key(x,y)]=y==35 and 11 or y==36 and 9 or 8 end end
 put(f);nail(11,36);nail(28,36)
 -- open end: a flared ring seen side-on, dark inside
 put(ellipse(36,8,3,6.5,function(x,y,u,v) local r=u*u+v*v
  if r<.4 then return 1 end;return band(lightOf(u,v,.3),RUST) end))
end
-- 5 wooden crate split by a crack, braced diagonally, nails in the frame
OX=192
do local x0,y0,x1,y1=3,7,44,38
 local s={}
 for y=y0,y1 do for x=x0,x1 do local edge=(x<=x0+2 or x>=x1-2 or y<=y0+2 or y>=y1-2)
  local c
  if edge then c=(y<=y0+1 or x<=x0+1) and 19 or ((y>=y1-1 or x>=x1-1) and 17 or 18)
  else c=((x-x0)%7==0) and 16 or (((x-x0)%7==1) and 19 or 18) end
  s[key(x,y)]=c end end
 -- diagonal brace from lower left to upper right
 for i=0,30 do local x=x0+4+i;local y=y1-4-math.floor(i*.8+.5)
  for w=0,5 do local k=key(x,y+w-2);if s[k] then s[k]=(w==0 or w==5) and 1 or w==1 and 20 or w==4 and 17 or 19 end end end
 -- lid: the top edge is splintered where the crack starts
 for _,q in ipairs({{21,7},{22,7},{22,8},{25,7},{26,7}}) do s[key(q[1],q[2])]=nil end
 for _,q in ipairs({{19,5},{20,5},{20,6},{27,5},{28,6},{29,6}}) do s[key(q[1],q[2])]=19 end
 -- crack: a jagged dark line down the middle
 local cx=23;for y=y0,y1-6 do cx=cx+(((y*7)%5==0) and 1 or (((y*3)%7==0) and -1 or 0));s[key(cx,y)]=1;if y%4==0 then s[key(cx+1,y)]=1 end end
 put(s)
 nail(5,9);nail(41,9);nail(5,35);nail(41,35)
 pebbles({{2,38,2,1},{46,38,2,1}})
end
-- 6 bent metal sign on two rusty posts, four bolts
OX=240
do local s={}
 for _,x in ipairs({7,36}) do for y=18,38 do for i=0,2 do s[key(x+i,y)]=i==0 and 14 or i==1 and 13 or 12 end end end
 put(s)
 local p={}
 for x=2,45 do local wob=math.floor(1.6*math.sin((x-2)/43*math.pi*1.6)+.5)
  for y=4+wob,21+wob-((x>30 and x<40) and 1 or 0) do local top=4+wob
   local c=(y==top) and 11 or (y<=top+1) and 10 or 9
   if x>=20 and x<=27 and y>=top+4 and y<=top+12 and x-20<=y-top-4 then c=8 end  -- a shallow dent
   if x<=3 or x>=44 or y>=20+wob then c=8 end
   p[key(x,y)]=c end end
 rustify(p,11,.3)
 put(p)
 nail(4,6);nail(42,6);nail(4,18);nail(42,19)
end
-- 7 scrap heap: a bent bracket, a split plank, a rusty gear and a spring, on pebbles
OX=288
do pebbles({{5,37,3,1.6},{12,37,2.5,1.5},{36,37,3,1.6},{43,37,2.5,1.5}})
 local s=poly({{6,26},{20,15},{25,18},{12,30}},function(x,y) return (x+y)%6==0 and 17 or 18 end)
 for _,q in ipairs({{19,15},{20,15},{21,16}}) do s[key(q[1],q[2])]=20 end
 put(s)
 local b=poly({{14,20},{27,14},{31,19},{30,23},{18,29}},function(x,y) return y<18 and 10 or 9 end)
 rustify(b,5,.55);put(b);px(22,19,1);px(26,17,1)
 -- gear: a ring with eight teeth and a dark hub
 local g={}
 for y=20,38 do for x=17,37 do local dx,dy=x-27,y-29;local d=math.sqrt(dx*dx+dy*dy);local a=math.atan(dy,dx)
  local tooth=(math.floor((a+math.pi)/(math.pi/8))%2==0)
  local R=tooth and 8.6 or 6.8
  if d<=R and d>2.2 then g[key(x,y)]=band(lightOf(dx/9,dy/9,.5),RUST) end end end
 put(g);px(27,29,1);px(26,29,2);px(27,28,2)
 -- spring: stacked coils, each a short lit-top ellipse
 for i=0,4 do put(ellipse(40,34-i*3,3,1.2,function(x,y,u,v) return v<0 and 10 or 8 end)) end
end
-- 8 glass bottle with a cork, a little teal liquid and a cracked shard inside
OX=336
do local s={}
 local function glass(x,y)
  local u=(x-24)/8.5;local c=27
  if u<-.55 then c=24 elseif u<-.35 then c=25 elseif u>.6 then c=26 end
  if y>=26 then c=(u<-.35) and 23 or (u>.55 and 21 or 22) end
  if y==26 then c=24 end
  return c end
 for y=13,37 do local hw=(y<16) and 6+(y-13) or 8;if y>=36 then hw=7 end
  for x=24-hw,24+hw do s[key(x,y)]=glass(x,y) end end
 for y=6,12 do for x=21,27 do s[key(x,y)]=(x<=22) and 24 or (x>=26 and 26 or 27) end end
 for x=20,28 do s[key(x,6)]=24 end
 -- the shard inside the liquid
 for _,q in ipairs({{27,28},{26,29},{25,30},{20,15},{20,16},{19,17}}) do s[key(q[1],q[2])]=25 end
 put(s)
 local c={};for y=1,5 do for x=21,27 do c[key(x,y)]=(y==1) and 20 or (x<=22 and 19 or 18) end end;put(c)
end

local base=OUT..'/props/junk'
spr:saveAs(base..'.aseprite');spr:saveCopyAs(base..'.png')
local flat=Image(CW*N,CH,ColorMode.RGB);flat:drawSprite(spr,1)
local k=5;local pv=Image(CW*N*k,CH*k,ColorMode.RGB)
for y=0,CH*k-1 do for x=0,CW*N*k-1 do local c=flat:getPixel(x//k,y//k)
 if app.pixelColor.rgbaA(c)==0 then local v=((x//(k*2)+y//(k*2))%2==0) and 150 or 164;c=app.pixelColor.rgba(v,v,v+6,255) end
 pv:drawPixel(x,y,c) end end
pv:saveAs(OUT..'/previews/props-junk-5x.png')
print('props/junk '..(CW*N)..'x'..CH..' exported')
