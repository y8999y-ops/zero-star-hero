-- Town decoration sheet, redrawn natively from art/參考原圖/props/town-deco.png.
-- Measured at the shared prop world scale (~7 source px per art px; the reference itself is finer):
-- barrel ~32x36, crates ~33x44, fence ~40x34, signpost ~30x44, star lamp ~40x70, potted mushroom
-- ~28x40, sack ~32x39, bench ~42x31. Sheet: eight 48x72 cells, ground on row 70.
-- Wood is drawn as boards with a lit top/left edge, a shaded bottom/right edge and grain; round bodies
-- (barrel, sack, cap, trunk) are shaded from their normals; everything gets a 1px outline ring.
-- Run: aseprite -b --script-param out=art/drafts --script tools/redraw-props-towndeco-reference.lua
local OUT=app.params['out']
local HEX={'1a1020',                                  -- 1 outline
 '5a2e1e','8a4a24','b06a30','d08a40','eaae5c',        -- 2-6 wood
 '2e3448','4a5068','6c7490','9aa0b8',                 -- 7-10 slate metal
 'b07010','f0b030','ffe27a',                          -- 11-13 gold studs / star
 '4a4a5c','6a6a80','8e8ea4','b4b4c8',                 -- 14-17 stone
 '1a6a6a','2aa0a0','5cd8c8',                          -- 18-20 teal leaf
 '9a1830','d83040','f05a50','f6e6c2',                 -- 21-24 red cap, cream
 '8a6a50','b8987a','d8c0a0','f0e2c8',                 -- 25-28 sack
 'c07a10','fff4b0'}                                   -- 29-30 star dark, star white
local CW,CH,N,G=48,72,8,70
local spr=Sprite(CW*N,CH,ColorMode.RGB)
local pal=Palette(#HEX+1);pal:setColor(0,Color{r=0,g=0,b=0,a=0})
local C={}
for i,v in ipairs(HEX) do local r,g,b=tonumber(v:sub(1,2),16),tonumber(v:sub(3,4),16),tonumber(v:sub(5,6),16)
 C[i]=app.pixelColor.rgba(r,g,b,255);pal:setColor(i,Color{r=r,g=g,b=b,a=255}) end
spr:setPalette(pal)
local img=spr.cels[1].image;spr.layers[1].name='Town decorations'
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
local function band(l,r) if l>.8 and r[5] then return r[5] elseif l>.5 then return r[4] elseif l>.18 then return r[3] elseif l>-.2 then return r[2] else return r[1] end end
local WOOD={2,3,4,5,6};local SLATE={7,7,8,9,10};local STONE={14,14,15,16,17};local GOLD={11,11,12,13,30}
local LEAF={18,18,19,20,20};local RED={21,21,22,23,23};local SACK={25,25,26,27,28};local STAR={29,11,12,13,30}
local function ellipse(cx,cy,rx,ry,c,set)
 set=set or {}
 for y=math.floor(cy-ry),math.ceil(cy+ry) do for x=math.floor(cx-rx),math.ceil(cx+rx) do
  local u,v=(x-cx)/(rx+.5),(y-cy)/(ry+.5);if u*u+v*v<=1 then set[key(x,y)]=type(c)=='function' and c(x,y,u,v) or c end end end
 return set
end
local function dome(cx,cy,rx,ry,ramp,cut,set)
 return ellipse(cx,cy,rx,ry,function(x,y,u,v) if cut and y>cut then return nil end
  return band(lightOf(u,v,math.sqrt(math.max(0,1-u*u-v*v))),ramp) end,set)
end
local function poly(p,c,set)
 set=set or {};local lo,hi=1e9,-1e9;for _,a in ipairs(p) do lo=math.min(lo,a[2]);hi=math.max(hi,a[2]) end
 for y=math.floor(lo),math.ceil(hi) do local xs={};local j=#p
  for i=1,#p do local a,b=p[i],p[j];if (a[2]<=y and b[2]>y) or (b[2]<=y and a[2]>y) then xs[#xs+1]=a[1]+(y-a[2])*(b[1]-a[1])/(b[2]-a[2]) end;j=i end
  table.sort(xs);for i=1,#xs-1,2 do for x=math.floor(xs[i]+.5),math.floor(xs[i+1]-.5) do set[key(x,y)]=type(c)=='function' and c(x,y) or c end end end
 return set
end
-- a board: lit top row and left column, shaded bottom row and right column, grain every few rows
local function board(x0,y0,x1,y1,set,vertical)
 set=set or {}
 for y=y0,y1 do for x=x0,x1 do local c=4
  if y==y0 or x==x0 then c=6 elseif y==y1 or x==x1 then c=2 elseif (vertical and (x-x0)%5==3) or (not vertical and (y-y0)%4==2 and (x*3+y)%11>2) then c=3 end
  if y==y0+1 and x>x0 and x<x1 and c==4 then c=5 end
  set[key(x,y)]=c end end
 return set
end
local function stud(x,y) px(x,y,13);px(x+1,y,12);px(x,y+1,12);px(x+1,y+1,11) end
local function tube(pts,r,ramp,set)
 set=set or {}
 local minx,miny,maxx,maxy=1e9,1e9,-1e9,-1e9
 for _,p in ipairs(pts) do minx=math.min(minx,p[1]);maxx=math.max(maxx,p[1]);miny=math.min(miny,p[2]);maxy=math.max(maxy,p[2]) end
 local rm=type(r)=="function" and r(0) or r
 for y=math.floor(miny-rm-1),math.ceil(maxy+rm+1) do for x=math.floor(minx-rm-1),math.ceil(maxx+rm+1) do
  local best,bx,by,bi=1e9,0,0,1
  for i=1,#pts-1 do local a,b=pts[i],pts[i+1];local dx,dy=b[1]-a[1],b[2]-a[2];local l2=dx*dx+dy*dy
   local t=l2==0 and 0 or math.max(0,math.min(1,((x-a[1])*dx+(y-a[2])*dy)/l2))
   local qx,qy=a[1]+dx*t,a[2]+dy*t;local d=(x-qx)^2+(y-qy)^2
   if d<best then best,bx,by,bi=d,qx,qy,i end end
  local rr=type(r)=='function' and r(bi/#pts) or r
  local d=math.sqrt(best)
  if d<=rr+.3 then local nx,ny=(x-bx)/(rr+.5),(y-by)/(rr+.5);local nz=math.sqrt(math.max(0,1-nx*nx-ny*ny))
   set[key(x,y)]=band(lightOf(nx,ny,nz),ramp) end end end
 return set
end
local function stones(list) local s={}
 for _,b in ipairs(list) do for y=b[2],b[4] do for x=b[1],b[3] do
  local c=(y==b[2]) and 17 or (x==b[1]) and 16 or (y==b[4] or x==b[3]) and 14 or 15
  if (y==b[2] or y==b[4]) and (x==b[1] or x==b[3]) then c=nil end
  if c then s[key(x,y)]=c end end end end
 put(s) end
local function leaf(x,y,dir)
 local rows={'..aab.','.abbbc','abbbcc','.bccc.','..cc..'};local cols={a=20,b=19,c=18}
 local s={};for j,row in ipairs(rows) do for i=1,#row do local ch=row:sub(i,i)
  if cols[ch] then s[key(dir>0 and x+i-1 or x-(i-1),y+j-1)]=cols[ch] end end end
 put(s) end

-- 1 barrel: bulging staves that bunch toward the sides, two slate hoops with gold studs, open top
OX=0
do local s={};local cx,top,bot=24,36,70
 for y=top,bot do local t=(y-top)/(bot-top);local hw=12+3*math.sin(math.pi*t)
  for x=math.floor(cx-hw+.5),math.floor(cx+hw-.5) do local u=(x-cx)/hw
   local c=band(lightOf(u,0,math.sqrt(math.max(0,1-u*u)))-(t>.85 and .3 or 0),WOOD)
   local a=math.asin(math.max(-1,math.min(1,u)))/(math.pi/2)
   if ((a*4+.5)%1)<.12 then c=math.max(2,c-1) end
   s[key(x,y)]=c end end
 for _,hy in ipairs({41,62}) do local t=(hy-top)/(bot-top);local hw=12+3*math.sin(math.pi*t)
  for y=hy,hy+2 do for x=math.floor(cx-hw+.5),math.floor(cx+hw-.5) do local u=(x-cx)/hw
   s[key(x,y)]=band(lightOf(u,(y-hy-1)*.4,math.sqrt(math.max(0,1-u*u))),SLATE) end end end
 ellipse(cx,top,12,3,function(x,y,u,v) return (u*u+v*v<.5) and (v<.1 and 1 or 2) or (v<0 and 6 or 3) end,s)
 put(s)
 for _,hy in ipairs({41,62}) do for _,x in ipairs({14,20,27,33}) do stud(x,hy+1) end end
end
-- 2 two stacked crates: a big braced crate with slate corner plates, a smaller one on top
OX=48
do local s=board(7,46,41,70,{},true)
 for i=0,26 do local x=10+i;local y=67-math.floor(i*.72+.5);for w=0,3 do local k=key(x,y+w-1);if s[k] then s[k]=w==0 and 1 or w==1 and 6 or w==3 and 3 or 5 end end end
 put(s)
 local p={};for _,c in ipairs({{7,46},{36,46},{7,65},{36,65}}) do for y=c[2],c[2]+5 do for x=c[1],c[1]+5 do p[key(x,y)]=(y==c[2] or x==c[1]) and 10 or 8 end end end;put(p,true)
 for _,c in ipairs({{9,48},{38,48},{9,67},{38,67}}) do stud(c[1],c[2]) end
 local t=board(12,27,36,46,{},true)
 for x=13,39 do for y=24,26 do if x>=12+(26-y) and x<=36+(26-y)-0 then t[key(x,y)]=(y==24) and 6 or 5 end end end
 for i=0,18 do local x=15+i;local y=43-math.floor(i*.75+.5);for w=0,2 do local k=key(x,y+w-1);if t[k] then t[k]=w==0 and 1 or w==1 and 6 or 3 end end end
 put(t)
end
-- 3 fence: two pointed posts on stone feet, two rails, gold studs where they cross
OX=96
do stones({{3,64,15,70},{33,64,45,70}})
 local s={}
 for _,x0 in ipairs({6,36}) do board(x0,40,x0+6,64,s,true)
  for y=34,39 do local w=y-34;for x=x0+3-w,x0+3+w do if x>=x0 and x<=x0+6 then s[key(x,y)]=(x<=x0+3) and 6 or 3 end end end end
 put(s)
 local r={};board(2,45,46,50,r);board(2,56,46,61,r);put(r)
 for _,x in ipairs({8,38}) do stud(x,47);stud(x,58) end
end
-- 4 signpost with an arrow board pointing right, on a heap of stones
OX=144
do stones({{12,63,22,70},{20,61,30,70},{28,64,37,70}})
 put(board(20,26,27,62,{},true))
 local s=board(7,35,37,47,{})
 poly({{37,32},{46,41},{37,50}},function(x,y) return y<38 and 6 or y<44 and 4 or 2 end,s)
 put(s)
 stud(10,40);stud(32,40);stud(22,29)
end
-- 5 star lamp: a twisting trunk rising from a studded collar on stone, hooking over to hang a star
OX=192
do stones({{6,62,20,70},{17,60,31,70},{28,63,38,70}})
 local trunk=tube({{19,58},{21,48},{17,38},{16,28},{19,16},{24,8},{31,5},{35,8}},function(t) return 4.2-2.6*t end,WOOD)
 put(trunk)
 for x=30,37 do end
 put(tube({{35,8},{37,11},{35,13}},1.2,WOOD))
 local col={};for y=53,60 do for x=11,29 do local u=(x-20)/9;col[key(x,y)]=band(lightOf(u,(y-56)*.25,math.sqrt(math.max(0,1-u*u))),SLATE) end end;put(col)
 for _,x in ipairs({13,19,25}) do stud(x,56) end
 -- string and the five-point star, lit on its upper-left facets
 for y=13,15 do px(37,y,10) end
 local st={};local cx,cy,R=37,25,9
 local pts={};for i=0,9 do local a=-math.pi/2+i*math.pi/5;local rr=i%2==0 and R or R*.45;pts[#pts+1]={cx+math.cos(a)*rr,cy+math.sin(a)*rr} end
 poly(pts,function(x,y) local dx,dy=x-cx,y-cy;local a=math.atan(dy,dx)
  local sec=math.floor((a+math.pi/2)/(math.pi/5)+10)%10
  local lit=({4,3,2,1,1,1,2,2,3,4})[sec+1]
  return ({29,11,12,13})[lit] end,st)
 st[key(cx,cy)]=30;st[key(cx-1,cy-1)]=30
 put(st)
 leaf(18,10,-1);leaf(14,30,-1);leaf(22,43,1)   -- each leaf starts at the trunk's edge
end
-- 6 potted red mushroom: a studded clay pot, teal leaves at the rim, a spotted cap
OX=240
do local p=poly({{12,55},{36,55},{33,70},{15,70}},function(x,y) local u=(x-24)/12
  return band(lightOf(u,0,math.sqrt(math.max(0,1-u*u))),WOOD) end)
 for x=10,38 do for y=52,55 do p[key(x,y)]=(y==52) and 6 or (y==55 and 3 or 5) end end
 put(p)
 for _,x in ipairs({17,23,29}) do px(x,62,13);px(x+1,61,12);px(x+1,63,11);px(x+2,62,12) end
 leaf(8,47,1);leaf(40,47,-1);leaf(13,44,1);leaf(35,44,-1)
 put(dome(24,38,12,9,RED,40))
 local u={};for x=14,34 do u[key(x,41)]=26 end;put(u,true)
 local st={};for y=42,52 do for x=21,27 do st[key(x,y)]=(x<=22) and 28 or (x>=26 and 26 or 24) end end;put(st)
 -- spots: small rounded blobs, the bigger ones with a lit corner
 for _,sp in ipairs({{16,32,3},{24,30,3},{30,34,2},{20,36,2},{33,38,2},{27,36,2}}) do local x,y,n=sp[1],sp[2],sp[3]
  local m={};for j=0,(n==3 and 1 or n-1) do for i=0,n-1 do if not (n==3 and j==0 and i==0) then m[key(x+i,y+j)]=24 end end end
  if n==3 then m[key(x+1,y)]=28 end;put(m,true) end
end
-- 7 tied grain sack with a gold wheat mark
OX=288
do local s={}
 dome(24,57,15,13,SACK,70,s)
 for x=10,38 do if s[key(x,70)] then end end
 for y=40,46 do local hw=6-(y-40)*.2;for x=math.floor(24-hw),math.floor(24+hw) do s[key(x,y)]=band(lightOf((x-24)/7,.2,.7),SACK) end end
 put(s)
 local r={};for _,q in ipairs({{17,33},{20,31},{24,32},{28,30},{31,33},{30,37},{18,37}}) do end
 poly({{16,36},{19,31},{23,33},{26,30},{30,32},{33,36},{29,40},{19,40}},function(x,y) return y<34 and 28 or y<37 and 27 or 26 end,r);put(r)
 local t={};for x=18,30 do t[key(x,40)]=3;t[key(x,41)]=2 end;t[key(28,42)]=3;t[key(29,43)]=3;t[key(29,44)]=2;t[key(30,45)]=3;put(t)
 -- wheat: a stalk with paired grains
 local w={};for y=52,63 do w[key(24,y)]=11 end
 for i,y in ipairs({53,56,59}) do w[key(23,y)]=12;w[key(22,y-1)]=13;w[key(25,y)]=12;w[key(26,y-1)]=13 end
 w[key(24,51)]=13;put(w,true)
end
-- 8 bench: back rest and seat boards on two legs with slate feet
OX=336
do stones({{4,66,12,70},{36,66,44,70}})
 local l={};board(6,40,10,66,l,true);board(38,40,42,66,l,true);put(l)
 local b={};board(2,38,46,44,b);board(2,52,46,57,b);board(6,47,42,49,b);put(b)
 for _,x in ipairs({7,39}) do stud(x,40);stud(x,54) end
end

local base=OUT..'/props/town-deco'
spr:saveAs(base..'.aseprite');spr:saveCopyAs(base..'.png')
local flat=Image(CW*N,CH,ColorMode.RGB);flat:drawSprite(spr,1)
local k=4;local pv=Image(CW*N*k,CH*k,ColorMode.RGB)
for y=0,CH*k-1 do for x=0,CW*N*k-1 do local c=flat:getPixel(x//k,y//k)
 if app.pixelColor.rgbaA(c)==0 then local v=((x//(k*2)+y//(k*2))%2==0) and 150 or 164;c=app.pixelColor.rgba(v,v,v+6,255) end
 pv:drawPixel(x,y,c) end end
pv:saveAs(OUT..'/previews/props-town-deco-4x.png')
print('props/town-deco '..(CW*N)..'x'..CH..' exported')
