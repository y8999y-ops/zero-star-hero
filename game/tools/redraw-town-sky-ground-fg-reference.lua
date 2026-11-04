-- Town sky / ground / foreground, redrawn natively from art/參考原圖/town/{sky,ground,fg}.png.
-- The reference bitmaps are only measured (colors sampled, positions read off at ~8 display px per art px);
-- nothing is resampled. Ground and fg are 256-wide horizontal tiles, sky is a flat 480x216 backdrop.
-- Run: aseprite -b --script-param kit=tools/art-kit-v2.lua --script-param out=art/drafts --script tools/redraw-town-sky-ground-fg-reference.lua
local K=dofile(app.params['kit']);local P,R,L,O,PX=K.poly,K.rect,K.line,K.oval,K.p

local function save(name)
 local base=K.base..'/'..name
 K.s:saveAs(base..'.aseprite');K.s:saveCopyAs(base..'.png')
 local flat=Image(K.w,K.h,ColorMode.RGB);flat:drawSprite(K.s,1)
 -- 4x preview on a neutral checker, plus a 2-tile repeat to check the seam.
 local reps=K.tile and 2 or 1;local pv=Image(K.w*reps*4,K.h*4,ColorMode.RGB)
 for y=0,K.h*4-1 do for x=0,K.w*reps*4-1 do
  local c=flat:getPixel((x//4)%K.w,y//4)
  if app.pixelColor.rgbaA(c)==0 then local v=((x//16+y//16)%2==0) and 96 or 108;c=app.pixelColor.rgba(v,v,v+6,255) end
  pv:drawPixel(x,y,c) end end
 pv:saveAs(K.base..'/previews/'..name:gsub('/','-')..'-4x.png')
 print(name..' '..K.w..'x'..K.h..' exported')
end

-- A curved, tapering blade or leaf: quadratic curve base->ctrl->tip, width w0 at the base.
local function blade(bx,by,cx,cy,tx,ty,w0,body,lit)
 local n=math.max(4,math.floor(math.abs(ty-by)+math.abs(tx-bx)))
 local left,right={},{}
 for i=0,n do local t=i/n;local u=1-t
  local x=u*u*bx+2*u*t*cx+t*t*tx;local y=u*u*by+2*u*t*cy+t*t*ty
  local hw=(w0/2)*(1-t)
  left[#left+1]={math.floor(x-hw+.5),math.floor(y+.5)};table.insert(right,1,{math.floor(x+hw+.5),math.floor(y+.5)})
 end
 local pts={};for _,p in ipairs(left) do pts[#pts+1]=p end;for _,p in ipairs(right) do pts[#pts+1]=p end
 P(pts,body)
 if lit then for i=2,#left-1 do PX(left[i][1],left[i][2],lit) end end
end

---------------------------------------------------------------- SKY
-- Four flat night bands, darkest on top; sparse 1px stars in gold and lilac, four small crosses.
K.new('town/sky',480,216,true,true,{'110540','1b0a57','26096a','330b80','ffd27a','b98aff','fff4d0'})
for i=1,4 do R(0,(i-1)*54,480,54,i) end
K.layer('02 Stars')
-- positions read from the reference (x*0.287, y*0.23), nudged off the band joins
local dots={{35,19,5},{168,11,6},{277,22,5},{207,44,5},{362,38,6},{401,26,5},{459,18,6},
 {28,70,6},{122,77,5},{285,76,6},{240,96,5},{387,91,5},{466,88,6},{66,100,6},
 {181,122,6},{35,141,5},{122,148,6},{285,148,6},{451,141,5},
 {225,172,5},{141,198,5},{326,203,5},{387,175,6},{445,193,6},{20,199,6}}
for _,d in ipairs(dots) do PX(d[1],d[2],d[3]) end
for _,c in ipairs({{81,35},{423,57},{316,124},{62,183}}) do
 local x,y=c[1],c[2];L(x-2,y,x+2,y,5);L(x,y-2,x,y+2,5);PX(x,y,7)
end
save('town/sky')

---------------------------------------------------------------- GROUND
-- Rounded block with stepped corners (2-1 or 1-1 stairs, never single-pixel nubs).
local function blob(x,y,w,h,c)
 for yy=0,h-1 do local inset=0
  if yy==0 or yy==h-1 then inset=(h>=4 and w>=6) and 2 or 1
  elseif (yy==1 or yy==h-2) and h>=5 then inset=1 end
  for xx=x+inset,x+w-1-inset do PX(xx,y+yy,c) end
 end
end
local gpal={'1c0a30','2c0e40','4a1a3a','5e2636','73343a','965030','b26a38','c98848',
 '2e4a22','4d6e1e','7c9a14','a2bc12','c6d838','e6ee80',
 '3e4066','646a96','9098c0','c8d0e8',
 'f6cc3c','fff2a0','c88a1c','36c8ec','a8f0ff','1e88b0','3a2410'}
K.new('town/ground',256,40,true,false,gpal)
R(0,12,256,28,4)
K.layer('02 Cobbled soil clumps')
-- Four staggered rows; widths cycle irregularly and each row closes exactly at 256 so the tile wraps.
local rows={{y=13,h=6,x0=0,ws={11,8,14,9,12,7,13,10}},{y=19,h=6,x0=5,ws={9,13,8,12,10,14,7,11}},
 {y=25,h=5,x0=2,ws={13,9,11,8,14,10,12,7}},{y=30,h=5,x0=7,ws={10,12,8,13,9,11,14,8}}}
for ri,r in ipairs(rows) do local x,i=r.x0,0
 while x<r.x0+256 do i=i+1;local w=r.ws[(i-1)%#r.ws+1]
  if r.x0+256-x-w-1<6 then w=r.x0+256-x-1 end
  local deep=ri==4
  blob(x,r.y,w,r.h,deep and 4 or 5)
  blob(x,r.y,w-1,r.h-1,deep and 5 or 6)
  if not deep then L(x+2,r.y+1,x+1+math.floor(w*.45),r.y+1,7);PX(x+1,r.y+2,7) end
  if not deep and i%3==0 then PX(x+3,r.y+1,8) end
  x=x+w+1
 end
end
K.layer('03 Purple underside')
for x=0,255 do local d=({35,35,34,35,36,35})[(x//5)%6+1];PX(x,d,3);for y=d+1,39 do PX(x,y,2) end end
L(0,39,255,39,1)
K.layer('04 Embedded stones')
local function stone(x,y,w,h)
 blob(x,y,w,h,15);blob(x,y,w-1,h-1,16);L(x+2,y+1,x+1+math.floor(w*.4),y+1,17);PX(x+2,y+1,18)
end
for _,s in ipairs({{10,19,8,6},{38,25,7,5},{76,23,7,5},{82,20,8,6},{102,26,6,5},{144,27,7,5},{164,22,8,6},{203,24,7,5},{209,21,8,6},{240,22,7,5}}) do stone(s[1],s[2],s[3],s[4]) end
K.layer('05 Grass mat')
R(0,9,256,3,12);L(0,9,255,9,13);L(0,12,255,12,11)
-- rounded drips over the soil: {x, width, depth}
local x=0;local dw={5,3,6,4,5,3,7,4};local dd={2,1,3,2,2,1,3,2};local i=0
while x<256 do i=i+1;local w,d=dw[(i-1)%8+1],dd[(i-1)%8+1]
 for xx=x,x+w-1 do local dep=(xx==x or xx==x+w-1) and d-1 or d
  for y=13,12+dep do PX(xx,y,11) end;if dep>0 then PX(xx,13+dep,10) else PX(xx,13,10) end end
 x=x+w+({1,2,1,2})[(i-1)%4+1]
end
K.layer('06 Grass tufts')
-- a spike rises from the mat; rows narrow toward the tip, lit on the left, pale tip
local function spike(x,h,w,lean,body,lit,tip)
 for k=0,h-1 do local ww=math.max(1,math.floor(w*(1-k/h)+.5));local xs=x+math.floor(lean*k/h+.5)
  for xx=xs,xs+ww-1 do PX(xx,8-k,body) end
  if lit and ww>1 then PX(xs,8-k,lit) end
  if k==h-1 and tip then PX(xs,8-k,tip) end
 end
end
local pats={
 {{-3,3,2,-1,11},{0,5,3,-1,12,13,14},{3,4,2,1,12,13},{5,2,2,1,11}},
 {{-2,4,2,-1,11},{1,3,2,0,12,13},{3,6,3,1,12,13,14}},
 {{-1,2,2,0,11},{1,4,3,-1,12,13,14},{4,3,2,1,11}},
 {{-3,5,3,-1,12,13,14},{0,3,2,0,11},{2,4,2,1,12,13}}}
for i=0,28 do local cx=math.floor(i*256/29)+({0,1,-1,2,0,-1})[i%6+1]
 for _,s in ipairs(pats[i%4+1]) do spike(cx+s[1],s[2],s[3],s[4],s[5],s[6],s[7]) end
end
K.layer('07 Flowers')
local function flower(x,y,c,lt,sh)
 for yy=y+2,8 do PX(x,yy,10) end
 PX(x,y-1,lt);PX(x-1,y,c);PX(x+1,y,c);PX(x,y+1,sh);PX(x-1,y-1,lt);PX(x+1,y+1,sh);PX(x-1,y+1,c);PX(x+1,y-1,c);PX(x,y,25)
end
for _,f in ipairs({{22,4,true},{27,5,true},{64,5,false},{69,3,false},{126,5,true},{131,4,true},{180,5,false},{185,3,false},{224,5,true},{229,3,true}}) do
 if f[3] then flower(f[1],f[2],19,20,21) else flower(f[1],f[2],22,23,24) end
end
save('town/ground')

---------------------------------------------------------------- FOREGROUND
-- Near-black silhouettes, purple mid-tones, teal leaves lit from the upper left, warm amber mushrooms.
local fpal={'050a10','0c1820','16203a','2e2462','4a3c8c','6e5cb0','1a5a66','2a8f9c','36b4ba','7ce0d0',
 'f2c46a','a85c1c','e89a34','f7c25a','ffe9a4','3a2a6a','8a78c4'}
K.new('town/fg',256,40,true,false,fpal)
local G=37   -- ground line; the dark base strip sits on rows 37..39
-- Spiky grass fan. Each blade: {base dx, tip dx, height, base width, body, lit edge, tip color}.
local function fan(cx,blades)
 for _,b in ipairs(blades) do local bx,tx=cx+b[1],cx+b[2]
  blade(bx,G,bx+(tx-bx)*.25,G-b[3]*.55,tx,G-b[3],b[4],b[5],b[6])
  if b[7] then PX(tx,G-b[3],b[7]) end
 end
end
-- Serrated fern leaf along a curve: widest about 40% up, notched every third step,
-- lower half in shade, upper edge lit.
local function fern(bx,by,cx,cy,tx,ty,w,body,dark,lit)
 local n=math.max(6,math.floor(math.abs(ty-by)+math.abs(tx-bx)))
 local mid,A,B={}, {}, {}
 for i=0,n do local t=i/n;local u=1-t
  local x=u*u*bx+2*u*t*cx+t*t*tx;local y=u*u*by+2*u*t*cy+t*t*ty
  local dx=2*u*(cx-bx)+2*t*(tx-cx);local dy=2*u*(cy-by)+2*t*(ty-cy);local l=math.sqrt(dx*dx+dy*dy);if l==0 then l=1 end
  local nx,ny=-dy/l,dx/l
  local hw=(w/2)*math.sin(math.pi*(t^0.8));if i%3==0 and i>0 then hw=hw*.45 end
  mid[#mid+1]={x,y};A[#A+1]={x+nx*hw,y+ny*hw,ny};B[#B+1]={x-nx*hw,y-ny*hw}
 end
 local function rp(p) return {math.floor(p[1]+.5),math.floor(p[2]+.5)} end
 local poly={};for _,p in ipairs(A) do poly[#poly+1]=rp(p) end;for i=#B,1,-1 do poly[#poly+1]=rp(B[i]) end
 P(poly,body)
 -- the side whose normal points down is the shaded underside
 local low=A[math.floor(#A/2)][3]>0 and A or B;local up=low==A and B or A
 local half={};for _,p in ipairs(mid) do half[#half+1]=rp(p) end;for i=#low,1,-1 do half[#half+1]=rp(low[i]) end
 P(half,dark)
 for i=2,#up-1 do if (i-1)%3~=0 then local p=rp(up[i]);PX(p[1],p[2],lit) end end
 for i=4,#mid-3,3 do local m=rp(mid[i])
  local u=rp(up[i]);L(m[1],m[2],u[1],u[2],dark)

 end
end
local function shroom(cx,h,r,thin)
 local top=G-h
 if thin then R(cx,top+2,1,h-2,17) else R(cx-1,top+2,1,h-2,17);R(cx,top+2,1,h-2,16) end
 P({{cx-r,top+2},{cx-r+1,top},{cx-r+3,top-2},{cx+r-3,top-2},{cx+r-1,top},{cx+r,top+2}},13)
 L(cx-r+1,top+2,cx+r-1,top+2,12)
 L(cx-r+3,top-2,cx,top-2,15);L(cx-r+1,top,cx-r+2,top-1,14)
 if r>=4 then L(cx-r+3,top-1,cx-1,top-1,14) end
 if r>=5 then L(cx+2,top+1,cx+r-1,top+1,12) end
end
local function curl(sx,sy,r,col,dark,lit)
 local prev;local cx,cy=sx+r,sy
 for i=0,40 do local a=math.pi+i*.26;local rr=r*(1-i/52)
  local x=math.floor(cx+math.cos(a)*rr+.5);local y=math.floor(cy+math.sin(a)*rr+.5)
  if prev then L(prev[1],prev[2],x,y,col) end;prev={x,y}
  if i<20 and r>=4 then local ix=math.floor(cx+math.cos(a)*(rr-1)+.5);local iy=math.floor(cy+math.sin(a)*(rr-1)+.5);PX(ix,iy,dark) end
  if i>1 and i<10 then PX(x,y,lit) end
 end
end
K.layer('01 Clump A: spiky grass + mushroom')
fan(18,{{-12,-17,7,3,2},{-9,-15,11,3,4,5},{-14,-16,4,2,3}})
fan(18,{{-6,-9,16,4,8,10,14},{-2,-1,20,4,2},{0,4,15,4,8,10,14},{3,9,11,3,4,5},{7,13,7,3,2}})
shroom(29,10,5)
shroom(35,4,2,true)
fan(38,{{-3,-6,5,2,2},{0,2,7,2,8,10},{2,6,4,2,4}})
K.layer('02 Clump B: fern sprays')
fan(70,{{-12,-16,6,3,2},{-8,-12,9,3,4,5}})
fern(74,G,77,G-12,92,G-21,6,8,7,10)
fern(78,G,88,G-6,100,G-12,5,8,7,10)
fern(70,G,67,G-8,63,G-14,4,8,7,10)
fan(70,{{12,17,7,3,2},{18,24,5,2,8,10},{-2,-5,6,2,2},{2,1,8,3,3}})
K.layer('03 Clump C: tall mushroom pair')
fan(140,{{-20,-24,5,2,2},{-16,-19,9,3,8,10,14},{-12,-13,10,3,2}})
shroom(141,15,7)
shroom(149,8,3,true)
fan(140,{{-7,-10,7,2,4,5},{10,15,8,3,2},{15,21,6,3,8,10,14},{20,25,4,2,2}})
K.layer('04 Clump D: fiddlehead and leafy sprig')
fan(216,{{-30,-35,6,2,2},{-26,-29,9,3,4,5}})
-- leafy sprig: a thin stem with paired rounded leaves, shrinking upward
L(190,G,190,G-17,7)
for i,y in ipairs({G-4,G-8,G-12,G-15}) do local s=4-i
 if s>=1 then blob(190-s*2-1,y-1,s*2+1,math.max(2,s+1),8);PX(190-s*2,y-1,10);blob(191,y-2,s*2+1,math.max(2,s+1),7)
 else PX(189,y,8);PX(191,y-1,7) end
end
PX(190,G-18,10)
fern(212,G,206,G-10,198,G-17,6,8,7,10)
blade(211,G,208,G-14,211,G-21,3,8,10)
curl(211,G-21,5,8,7,10)
blade(220,G,224,G-9,227,G-15,2,7,9)
curl(227,G-15,3,8,7,10)
fern(215,G,223,G-5,233,G-8,4,8,7,10)
shroom(232,6,3,true)
fan(216,{{18,23,10,3,8,10,14},{24,30,7,3,2},{29,34,4,2,4}})
K.layer('05 Ground strip')
-- a dark strip ties every clump to the floor; its top steps up a pixel under denser growth
for _,r in ipairs({{1,44},{55,104},{115,167},{180,252}}) do
 for x=r[1],r[2] do local up=((x-r[1])%7<3 and x>r[1]+1 and x<r[2]-1) and 1 or 0
  for y=G-up,39 do PX(x,y,(y>=G) and 1 or 2) end end
end
save('town/fg')
