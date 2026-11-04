-- Hanging moss & vines sheet, redrawn natively from art/參考原圖/props/moss.png.
-- Reference measures ~12 source px per art px: six pieces 19-24 art px wide that hang 25-52 px, so the
-- sheet is six 32x56 cells whose top row is the ceiling they cling to.
-- Parts: a moss pad (lime top edge, narrowing body lit on the left, strands hanging from its underside),
-- vines (a 1px stem that sways with a slow sine), outlined leaves, and cyan crystal drops at the ends.
-- Run: aseprite -b --script-param out=art/drafts --script tools/redraw-props-moss-reference.lua
local OUT=app.params['out']
local HEX={'1e4c50',                                  -- 1 leaf outline / deep shadow
 'd2e43a','9cc22a','5e9a2a','2e6a3a','1a4448',        -- 2-6 moss: top edge, light, mid, dark, deepest
 '2a5e36','4a8a30',                                   -- 7-8 vine stem dark / lit
 '1a3050','3cc8e8','a0f0ff','f4ffff','2088b8'}        -- 9-13 crystal drop: outline, cyan, light, white, dark
local CW,CH,N=32,56,6
local spr=Sprite(CW*N,CH,ColorMode.RGB)
local pal=Palette(#HEX+1);pal:setColor(0,Color{r=0,g=0,b=0,a=0})
local C={}
for i,v in ipairs(HEX) do local r,g,b=tonumber(v:sub(1,2),16),tonumber(v:sub(3,4),16),tonumber(v:sub(5,6),16)
 C[i]=app.pixelColor.rgba(r,g,b,255);pal:setColor(i,Color{r=r,g=g,b=b,a=255}) end
spr:setPalette(pal)
local img=spr.cels[1].image;spr.layers[1].name='Hanging moss and vines'
local OX=0
local function px(x,y,c) x=OX+x;if x>=OX and x<OX+CW and y>=0 and y<CH then img:drawPixel(x,y,C[c]) end end
local function key(x,y) return x..','..y end
local function put(set,ring)
 if ring then
  for k,_ in pairs(set) do local x,y=k:match('(-?%d+),(-?%d+)');x,y=tonumber(x),tonumber(y)
   for _,d in ipairs({{1,0},{-1,0},{0,1},{0,-1}}) do if not set[key(x+d[1],y+d[2])] then px(x+d[1],y+d[2],ring) end end end
 end
 for k,c in pairs(set) do local x,y=k:match('(-?%d+),(-?%d+)');px(tonumber(x),tonumber(y),c) end
end
local function map(x,y,rows,flip,cols)   -- authored pixel map; '.' empty
 local s={}
 for j,row in ipairs(rows) do for i=1,#row do local ch=row:sub(i,i)
  if ch~='.' then local xx=flip and (x-(i-1)) or (x+(i-1));s[key(xx,y+j-1)]=cols[ch] end end end
 return s
end

-- moss pad hanging from the ceiling: lime only along the top edge; a dark body lit by streaks on the
-- left; ragged sides (each row's inset wobbles by a pixel); many strands drop from the underside
local JIT={0,1,0,0,1,1,0,1}
local function pad(cx,w,depth,seed,lens)
 local s={};local half=w/2
 for r=0,depth-1 do local base=math.floor(r*(w*.22)/depth+.5)
  local x0=math.floor(cx-half)+base+(r>1 and JIT[(r+seed)%8+1] or 0)
  local x1=math.floor(cx+half)-1-base-(r>1 and JIT[(r*3+seed)%8+1] or 0)
  for x=x0,x1 do local f=(x-x0)/math.max(1,x1-x0)
   local c
   if r==0 then c=2 elseif r==1 then c=(f<.7 and (x+seed)%4~=0) and 2 or 3
   else local p=({0,1,0,2,1,0,1,2})[(x*5+seed)%8+1]
    c=f<.3 and ({4,3,4})[p+1] or f<.72 and ({5,4,5})[p+1] or ({6,5,6})[p+1] end
   s[key(x,r)]=c end
  -- strands: from the underside, and a few from the ragged side rows
  local function strand(x,L) for k=1,L do local c=k==L and 6 or 5
    if k<=2 and (x+seed)%3==0 then c=4 end;if k==1 and (x+seed)%5==0 then c=3 end
    s[key(x,r+k)]=s[key(x,r+k)] or c end end
  if r==depth-1 then for x=x0,x1 do strand(x,lens[(x*3+seed)%#lens+1]) end
  elseif r>=2 and r%2==0 then strand(x0,lens[(r+seed)%#lens+1]//2);strand(x1,lens[(r*7+seed)%#lens+1]//2) end
 end
 put(s)
end
-- a lump of moss caught on the vine: narrow where it grips, fattest in the middle, strands below
local function lump(cx,cy,w,h,lens)
 local s={}
 for r=0,h-1 do local hw=w/2*math.sin(math.pi*(r+1)/(h+1))^1.1
  local x0,x1=math.floor(cx-hw+.5),math.floor(cx+hw-.5)
  for x=x0,x1 do local f=(x-x0)/math.max(1,x1-x0)
   s[key(x,cy+r)]=(r==0 and f<.75) and 2 or (r==1 and f<.4) and 3 or f<.3 and (((x+r)%3==0) and 3 or 4) or f<.7 and 5 or 6 end
  if r>=h-2 then for x=x0,x1 do local L=lens[(x*5+r)%#lens+1]
   for k=1,L do s[key(x,cy+r+k)]=s[key(x,cy+r+k)] or (k==L and 6 or 5) end end end
 end
 put(s)
end
-- vine stem: x sways sinusoidally between y0 and y1
local function vine(x0,y0,y1,amp,period,phase)
 local s={};local prev
 for y=y0,y1 do local x=x0+math.floor(amp*math.sin((y-y0)/period*2*math.pi+(phase or 0))+.5)
  if prev and math.abs(x-prev)>1 then for xx=math.min(x,prev)+1,math.max(x,prev)-1 do s[key(xx,y)]=7 end end
  s[key(x,y)]=(y%5==0) and 8 or 7;prev=x end
 put(s)
 return function(y) return x0+math.floor(amp*math.sin((y-y0)/period*2*math.pi+(phase or 0))+.5) end
end
local LEAF={['L']=3,['M']=4,['D']=5,['T']=2}
-- leaf growing from the stem at (x,y) toward dir; big leaves are 5 wide
local function leaf(x,y,dir,big)
 local rows=big and {'.TL..','LLMM.','MMMDD','.DD..'} or {'.TL.','LMMD','.DD.'}
 put(map(x+dir,y-1,rows,dir<0,LEAF),1)
end
local function droop(x,y)   -- the end leaf of a vine, hanging point-down
 put(map(x-1,y,{'LMD','LMD','.M.'},false,LEAF),1)
end
local function drop(x,y)
 put(map(x-1,y,{'.c.','wcd','ccd','.d.'},false,{c=10,w=12,d=13}),9)
end

-- 1 broad pad, a long vine carrying two lumps of moss, two leaves, a drop at the end
OX=0
pad(16,24,9,1,{3,6,2,8,4,1,5,3,7,2,4})
local v1=vine(15,9,50,1.6,22)
lump(14,13,14,10,{2,5,1,6,3,2,4})
lump(17,29,9,7,{1,4,2,5,3})
leaf(v1(39),39,-1,true);leaf(v1(45),45,1)
drop(v1(51),51)
-- 2 pad with a leafy vine that zigzags down and ends in a hanging leaf
OX=32
pad(16,20,5,4,{2,4,1,3,5,2,3})
local v2=vine(15,5,34,2.2,20,.4)
for _,l in ipairs({{10,1,true},{15,-1,true},{22,1,true},{27,-1,true},{31,1}}) do leaf(v2(l[1]),l[1],l[2],l[3]) end
droop(v2(35),35)
-- 3 pad with long strands; one vine with two leaves and a drop, a short strand with a drop
OX=64
pad(16,21,7,2,{5,2,7,3,9,4,2,6,3,8,1})
local v3=vine(13,7,36,.8,30)
leaf(v3(20),20,-1,true);leaf(v3(27),27,1,true)
drop(v3(37),37)
local v3b=vine(25,7,17,0,10)
drop(25,18)
-- 4 small pad with a short S-shaped vine
OX=96
pad(16,19,6,5,{3,1,4,2,5,3,2})
local v4=vine(15,6,23,1.8,17)
leaf(v4(12),12,1,true);leaf(v4(18),18,-1,true)
droop(v4(24),24)
-- 5 deep pad with two vines, the longer one carrying three leaves
OX=128
pad(16,23,10,3,{4,7,2,9,3,6,1,8,4,5})
local v5=vine(12,10,49,1.2,26)
leaf(v5(26),26,-1,true);leaf(v5(35),35,1,true);leaf(v5(42),42,-1)
drop(v5(50),50)
local v5b=vine(21,10,27,.8,16)
leaf(v5b(19),19,1)
drop(v5b(28),28)
-- 6 pad with a curling vine, four leaves and a drop
OX=160
pad(16,21,5,6,{2,3,5,1,4,2,3,6})
local v6=vine(16,5,38,2.6,24,.8)
for _,l in ipairs({{11,1,true},{16,-1,true},{23,1,true},{29,-1,true}}) do leaf(v6(l[1]),l[1],l[2],l[3]) end
drop(v6(39),39)

local base=OUT..'/props/moss'
spr:saveAs(base..'.aseprite');spr:saveCopyAs(base..'.png')
local flat=Image(CW*N,CH,ColorMode.RGB);flat:drawSprite(spr,1)
local k=6;local pv=Image(CW*N*k,CH*k,ColorMode.RGB)
for y=0,CH*k-1 do for x=0,CW*N*k-1 do local c=flat:getPixel(x//k,y//k)
 if app.pixelColor.rgbaA(c)==0 then local v=((x//(k*2)+y//(k*2))%2==0) and 150 or 164;c=app.pixelColor.rgba(v,v,v+6,255) end
 pv:drawPixel(x,y,c) end end
pv:saveAs(OUT..'/previews/props-moss-6x.png')
print('props/moss '..(CW*N)..'x'..CH..' exported')
