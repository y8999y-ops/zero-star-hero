-- Flowers & mushrooms sheet, redrawn natively from art/參考原圖/props/flowers.png.
-- Reference measures ~6.8 source px per art px: each plant is 24-30 art px tall, so the sheet is
-- eight 32x32 cells (bottom row = ground). Nothing is resampled; colors are sampled from the reference.
-- Method: every part is a pixel set drawn back-to-front; each part first lays a 1px ring of outline
-- color around itself, so overlapping parts stay separated and the silhouette gets its outer line.
-- Shading is banded from each part's surface normal against a fixed upper-left light.
-- Run: aseprite -b --script-param out=art/drafts --script tools/redraw-props-flowers-reference.lua
local OUT=app.params['out']
local HEX={'1e1048',                                  -- 1 outline
 '1f5a40','2f8a3c','5cb84a','a6dc5a',                 -- 2-5 leaf ramp
 'f6f4e6','c4d0d4','8a96b0',                          -- 6-8 white petal
 'c07020','e8a426','f4c836','fae078',                 -- 9-12 yellow
 '8a1440','d23440','ec5848',                          -- 13-15 red cap
 'f2e4b0','b08a64','7a5a50',                          -- 16-18 cream stem
 '2050a0','3c8ad8','58c4ec',                          -- 19-21 blue cap
 'fffaf0'}                                            -- 22 brightest highlight
local CW,CH,N=32,32,8
local spr=Sprite(CW*N,CH,ColorMode.RGB)
local pal=Palette(#HEX+1);pal:setColor(0,Color{r=0,g=0,b=0,a=0})
local C={}
for i,v in ipairs(HEX) do local r,g,b=tonumber(v:sub(1,2),16),tonumber(v:sub(3,4),16),tonumber(v:sub(5,6),16)
 C[i]=app.pixelColor.rgba(r,g,b,255);pal:setColor(i,Color{r=r,g=g,b=b,a=255}) end
spr:setPalette(pal)
local img=spr.cels[1].image;spr.layers[1].name='Flowers and mushrooms'
local OX=0
local function px(x,y,c) x=OX+x;if x>=OX and x<OX+CW and y>=0 and y<CH then img:drawPixel(x,y,C[c]) end end

-- A part is {["x,y"]=color}. put() rings it in outline, then paints it.
local function key(x,y) return x..','..y end
local function put(set,noline)
 if not noline then
  for k,_ in pairs(set) do local x,y=k:match('(-?%d+),(-?%d+)');x,y=tonumber(x),tonumber(y)
   for _,d in ipairs({{1,0},{-1,0},{0,1},{0,-1}}) do local kk=key(x+d[1],y+d[2]);if not set[kk] then px(x+d[1],y+d[2],1) end end
  end
 end
 for k,c in pairs(set) do local x,y=k:match('(-?%d+),(-?%d+)');px(tonumber(x),tonumber(y),c) end
end
-- light band from a unit normal (nx,ny,nz) against light from the upper left, toward the viewer
local function band(nx,ny,nz,ramp)
 local l=-.55*nx-.6*ny+.58*nz
 if l>.78 and ramp[4] then return ramp[4] elseif l>.42 then return ramp[3] elseif l>.05 then return ramp[2] else return ramp[1] end
end
-- ellipse (optionally rotated by ang) shaded as a dome
local function ell(cx,cy,a,b,ramp,ang,cut)
 local s={};ang=ang or 0;local ca,sa=math.cos(ang),math.sin(ang);local R=math.ceil(math.max(a,b))+1
 for y=math.floor(cy-R),math.ceil(cy+R) do for x=math.floor(cx-R),math.ceil(cx+R) do
  local dx,dy=x-cx,y-cy;local u=(dx*ca+dy*sa)/(a+.5);local v=(-dx*sa+dy*ca)/(b+.5)
  local d=u*u+v*v
  if d<=1 and (not cut or y<=cut) then
   local nx,ny=dx/(math.max(a,b)+.5),dy/(math.max(a,b)+.5);local nz=math.sqrt(math.max(0,1-d))
   s[key(x,y)]=band(nx,ny,nz,ramp) end end end
 return s
end
-- tapered leaf from base to tip, bowed by bend; upper half lit, lower half dark, lit rim on top
local function leaf(bx,by,tx,ty,w,bend)
 local s={};local n=math.max(6,math.floor(math.abs(tx-bx)+math.abs(ty-by))*2)
 local dx,dy=tx-bx,ty-by;local l=math.sqrt(dx*dx+dy*dy);local nx,ny=-dy/l,dx/l
 if ny>0 then nx,ny=-nx,-ny end   -- (nx,ny) now points to the upper side
 for i=0,n do local t=i/n;local bow=math.sin(math.pi*t)*(bend or 1.5)
  local cx,cy=bx+dx*t+nx*bow,by+dy*t+ny*bow;local hw=(w/2)*math.sin(math.pi*math.min(1,t*1.15))^.7
  for k=-math.ceil(hw),math.ceil(hw) do if math.abs(k)<=hw+.25 then
   local x,y=math.floor(cx+nx*k+.5),math.floor(cy+ny*k+.5)
   local c=k>0 and 4 or 3;if k<=-hw+1 then c=2 end;if k>=hw-.5 and t>.15 and t<.85 then c=5 end
   s[key(x,y)]=c end end
 end
 return s
end
local function line(x0,y0,x1,y1,c,w)
 local s={};local n=math.max(math.abs(x1-x0),math.abs(y1-y0))
 for i=0,n do local t=n==0 and 0 or i/n;local x,y=math.floor(x0+(x1-x0)*t+.5),math.floor(y0+(y1-y0)*t+.5)
  s[key(x,y)]=c;if w and w>1 then s[key(x+1,y)]=w==2 and c or w end end
 return s
end
local function curve(pts,c,c2)
 local s={}
 for i=0,40 do local t=i/40;local u=1-t
  local x=u*u*pts[1][1]+2*u*t*pts[2][1]+t*t*pts[3][1];local y=u*u*pts[1][2]+2*u*t*pts[2][2]+t*t*pts[3][2]
  s[key(math.floor(x+.5),math.floor(y+.5))]=c
  if c2 then s[key(math.floor(x+.5)+1,math.floor(y+.5))]=c2 end
 end
 return s
end
local WHITE={8,7,6,22};local YEL={9,10,11,12};local RED={13,14,15};local BLUE={19,20,21,22};local CREAM={18,17,16}
local function daisy(cx,cy,r)
 for _,deg in ipairs({198,126,-18,54,-90}) do local a=math.rad(deg)
  put(ell(cx+math.cos(a)*r*1.1,cy+math.sin(a)*r*1.1,r*.78,r*.62,WHITE,a)) end
 put(ell(cx,cy,math.max(1,r*.42),math.max(1,r*.42),YEL))
end
-- six pointed petals as one outlined shape; each petal is one flat tone (lit side up-left),
-- with a dark seam where two petals meet
local function star6(cx,cy,r)
 local s={};local R=math.ceil(r*2)+1
 for y=math.floor(cy-R),math.ceil(cy+R) do for x=math.floor(cx-R),math.ceil(cx+R) do
  local dx,dy=x-cx,y-cy;local d=math.sqrt(dx*dx+dy*dy);local ang=math.atan(dy,dx)
  local sec=(ang+math.pi/2)/(math.pi/3);local k=math.floor(sec+.5);local off=math.abs(sec-k)  -- 0 on a petal axis
  local reach=r*1.8*(1-off*1.05)
  if d<=math.max(r*.55,reach) then
   local pa=k*math.pi/3-math.pi/2;local lit=-(math.cos(pa)+math.sin(pa))
   local c=lit>.6 and 12 or lit>-.1 and 11 or lit>-.9 and 10 or 9
   if off>.36 and d>r*.55 then c=9 end
   s[key(x,y)]=c end end end
 put(s)
 put(ell(cx,cy,r*.38,r*.38,{9,9,10,11}),true)
end
local function cap(cx,cy,rx,ry,ramp,base)
 put(ell(cx,cy,rx,ry,ramp,0,base))
 local s={};for x=math.floor(cx-rx+1),math.ceil(cx+rx-1) do s[key(x,base+1)]=18 end;put(s)
end
local function stem(x,y0,y1,w)
 local s={};for y=y0,y1 do for i=0,w-1 do s[key(x+i,y)]=(i==0 and 16) or (i==w-1 and 18) or 17 end end;put(s)
end
local function spots(list) for _,p in ipairs(list) do
 local s={};for _,q in ipairs(p) do s[key(q[1],q[2])]=16 end;s[key(p[1][1],p[1][2])]=22;put(s,true) end end
local function tuft(cx) -- short grass blades at a mushroom's foot
 put(leaf(cx-1,29,cx-6,25,3,.5));put(leaf(cx+1,29,cx+6,26,3,.5));put(leaf(cx,29,cx-2,24,2,.3))
end

-- 1 white five-petal flower with a smaller second bloom
OX=0
put(line(13,29,13,14,3,2));put(curve({{15,28},{18,24},{21,21}},3))
put(leaf(12,29,2,22,5,1.5));put(leaf(15,29,27,23,5,1.5));put(leaf(13,29,8,25,3,.5))
daisy(22,19,2.6);daisy(13,9,3.4)
-- 2 nodding bells on an arching stem
OX=32
put(leaf(14,29,3,21,6,1.8));put(leaf(16,29,28,22,6,1.8))
put(curve({{13,29},{12,8},{20,4}},3,2));put(curve({{20,4},{25,3},{26,8}},3));put(curve({{14,15},{15,10},{18,9}},3))
local function bell(cx,cy)
 put(ell(cx,cy,2.6,2.8,WHITE,0,cy+1))
 local s={};for x=cx-3,cx+3 do s[key(x,cy+2)]=((x-cx)%2==0) and 7 or 6 end;s[key(cx-3,cy+3)]=7;s[key(cx+3,cy+3)]=7;s[key(cx-1,cy+3)]=7;s[key(cx+1,cy+3)]=7;put(s)
end
bell(18,12);bell(26,11)
put(ell(15,21,1.4,1.6,WHITE))
-- 3 six-petal yellow star flower
OX=64
put(line(13,29,13,15,3,2));put(curve({{15,28},{18,24},{21,22}},3))
put(leaf(12,29,2,22,5,1.5));put(leaf(15,29,27,23,5,1.5));put(leaf(14,29,19,24,3,.5))
star6(22,18,2.6);star6(13,9,3.8)
-- 4 three round yellow pompom heads
OX=96
put(line(15,29,15,11,3,2));put(curve({{14,28},{10,24},{8,19}},3));put(curve({{17,28},{21,24},{23,19}},3))
put(leaf(14,29,4,24,4,1));put(leaf(17,29,27,24,4,1))
local function pom(cx,cy,r) local s=ell(cx,cy,r,r,YEL)
 for k,c in pairs(s) do local x,y=k:match('(-?%d+),(-?%d+)');x,y=tonumber(x),tonumber(y)
  if (c==11 or c==12) and (x+2*y)%4==0 then s[k]=10 end end
 put(s) end
pom(8,16,3.4);pom(23,16,3.4);pom(15,7,4.4)
-- 5 large spotted red mushroom with a small one beside it
OX=128
stem(12,16,29,5)
cap(14,13,10,8,RED,15)
spots({{{9,8},{10,8},{9,9},{10,9}},{{16,6},{17,6},{16,7}},{{20,10},{21,10},{21,11}},{{6,12},{7,12}},{{13,11}}})
stem(23,23,29,3)
cap(24,21,4.5,4,RED,22)
spots({{{22,19},{23,19}},{{26,20}}})
tuft(4);put(leaf(28,29,31,26,2,.3))
-- 6 three small red mushrooms
OX=160
stem(14,20,29,3);cap(15,18,5.5,5,RED,19);spots({{{12,15},{13,15},{12,16}},{{17,14},{18,14}},{{19,17}}})
stem(7,25,29,2);cap(8,24,3.5,3,RED,25);spots({{{7,22}}})
stem(23,25,29,2);cap(24,24,3.5,3,RED,25);spots({{{23,22}}})
tuft(16)
-- 7 smooth blue mushroom
OX=192
stem(14,20,29,4)
cap(15,17,8,7,{19,20,21},19)
do local s={};for _,q in ipairs({{11,12},{12,12},{10,13},{13,11}}) do s[key(q[1],q[2])]=22 end;put(s,true) end
tuft(15)
-- 8 white flower with a closed bud
OX=224
put(line(12,29,12,15,3,2));put(curve({{14,28},{20,22},{24,17}},3))
put(leaf(11,29,2,22,5,1.5));put(leaf(14,29,27,24,5,1.5));put(leaf(14,26,19,22,3,.6))
put(ell(24,13,2.2,3.2,WHITE));put(leaf(24,17,22,14,2,.2));put(leaf(24,17,26,14,2,.2))
daisy(12,10,3.4)

local base=OUT..'/props/flowers'
spr:saveAs(base..'.aseprite');spr:saveCopyAs(base..'.png')
local flat=Image(CW*N,CH,ColorMode.RGB);flat:drawSprite(spr,1)
for _,z in ipairs({{4,'-4x'},{8,'-8x'}}) do local k=z[1]
 local pv=Image(CW*N*k,CH*k,ColorMode.RGB)
 for y=0,CH*k-1 do for x=0,CW*N*k-1 do local c=flat:getPixel(x//k,y//k)
  if app.pixelColor.rgbaA(c)==0 then local v=((x//(k*2)+y//(k*2))%2==0) and 150 or 164;c=app.pixelColor.rgba(v,v,v+6,255) end
  pv:drawPixel(x,y,c) end end
 pv:saveAs(OUT..'/previews/props-flowers'..z[2]..'.png') end
print('props/flowers '..(CW*N)..'x'..CH..' exported')
