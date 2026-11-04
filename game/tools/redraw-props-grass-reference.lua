-- Grass tufts sheet, redrawn natively from art/參考原圖/props/grass.png.
-- Reference measures ~13 source px per art px: tufts are 6-19 art px tall, 12-17 wide, so the sheet is
-- eight 24x24 cells (bottom row = ground). No outline, as in the reference: blue-teal roots, green body,
-- lime upper blade, pale yellow-green tips that hook outward.
-- A blade climbs one row at a time; its sideways drift grows with height squared, so the steps run
-- long at the root and shorten toward the tip (a controlled curve, never random jitter).
-- Run: aseprite -b --script-param out=art/drafts --script tools/redraw-props-grass-reference.lua
local OUT=app.params['out']
local HEX={'123246','1f5a6a','2f8a3c','5cb440','9ad048','d6e67a','236a46'}
local CW,CH,N=24,24,8
local spr=Sprite(CW*N,CH,ColorMode.RGB)
local pal=Palette(#HEX+1);pal:setColor(0,Color{r=0,g=0,b=0,a=0})
local C={}
for i,v in ipairs(HEX) do local r,g,b=tonumber(v:sub(1,2),16),tonumber(v:sub(3,4),16),tonumber(v:sub(5,6),16)
 C[i]=app.pixelColor.rgba(r,g,b,255);pal:setColor(i,Color{r=r,g=g,b=b,a=255}) end
spr:setPalette(pal)
local img=spr.cels[1].image;spr.layers[1].name='Grass tufts'
local OX,G=0,23
local function px(x,y,c) x=OX+x;if x>=OX and x<OX+CW and y>=0 and y<CH then img:drawPixel(x,y,C[c]) end end

-- one blade: base column x, height h, drift direction dir (-1/1/0), total drift at the tip, back row?
local function blade(x,h,dir,drift,back)
 local sh=back and 1 or 0
 local prev=0
 for k=0,h-1 do local f=k/math.max(1,h-1)
  local dx=dir*math.floor(drift*f*f+.5);local y=G-k
  local c=f<.18 and 2 or f<.5 and 3 or f<.8 and 4 or 5
  if back then c=({1,7,3,4})[c-1] end   -- back blades: one step darker, still green above the root
  local wide=k<h-2 and h>3
  -- a row that drifts more than one column fills the gap, so the stair stays connected
  local a,b=math.min(prev,dx),math.max(prev,dx);if math.abs(dx-prev)<=1 then a,b=dx,dx end
  for xx=a,b do px(x+xx,y,c) end
  if wide then px(x+b+1,y,({1,1,7,3,4,5,2})[c]) end   -- right edge one step into shade
  prev=dx
  if k==h-1 then
   local tip=back and 4 or 6
   px(x+dx,y,tip)
   -- a hooked tip: one more pixel outward on the top row when the blade leans
   if dir~=0 and drift>=2 then px(x+dx+dir,y,tip) end
  end
 end
 if not back then px(x,G,1) end
end
-- a tuft is a list of blades {dx, h, dir, drift, back}
local function tuft(cx,list)
 for _,b in ipairs(list) do if b[5] then blade(cx+b[1],b[2],b[3],b[4],true) end end
 for _,b in ipairs(list) do if not b[5] then blade(cx+b[1],b[2],b[3],b[4]) end end
end
local T={
 -- 1 small (12x7)
 {{-5,4,-1,2,true},{4,5,1,2,true},{-3,5,-1,2},{-1,7,0,0},{1,6,1,1},{3,5,1,2},{-6,3,-1,2},{5,3,1,2}},
 -- 2 medium (16x12)
 {{-6,8,-1,3,true},{-2,10,0,1,true},{3,10,1,2,true},{7,7,1,3,true},
  {-7,6,-1,3},{-4,9,-1,2},{-1,12,0,1},{1,11,1,1},{4,9,1,2},{7,5,1,3},{-8,3,-1,2},{8,3,1,2}},
 -- 3 tall (14x19)
 {{-4,14,-1,2,true},{0,16,0,1,true},{4,12,1,3,true},
  {-6,10,-1,4},{-3,15,-1,2},{-1,19,0,1},{1,17,1,2},{3,14,1,3},{5,9,1,4},{-7,5,-1,2},{7,6,1,3}},
 -- 4 low and wide (17x6)
 {{-6,4,-1,2,true},{0,5,0,1,true},{6,4,1,2,true},
  {-8,3,-1,2},{-5,5,-1,1},{-3,4,-1,2},{-1,6,0,0},{2,5,1,1},{4,4,1,2},{7,5,1,1},{9,3,1,2}},
 -- 5 medium, lopsided right (16x13)
 {{-5,8,-1,2,true},{0,11,0,1,true},{5,9,1,3,true},
  {-7,5,-1,2},{-4,8,-1,2},{-1,11,0,1},{1,13,1,2},{4,10,1,3},{6,7,1,4},{8,4,1,2}},
 -- 6 tall and full (16x19)
 {{-5,13,-1,3,true},{-1,17,0,1,true},{3,15,1,2,true},{7,10,1,3,true},
  {-7,8,-1,4},{-4,13,-1,3},{-2,17,-1,1},{0,19,0,0},{2,16,1,2},{4,12,1,3},{6,8,1,4},{-8,4,-1,2},{8,5,1,2}},
 -- 7 small, upright (12x8)
 {{-4,5,-1,1,true},{3,6,1,2,true},{-5,4,-1,2},{-2,6,-1,1},{0,8,0,0},{2,7,1,1},{4,5,1,2}},
 -- 8 medium, leaning right (16x13)
 {{-4,9,-1,2,true},{1,11,1,2,true},{5,8,1,4,true},
  {-6,6,-1,3},{-3,10,-1,1},{-1,12,1,2},{1,13,1,4},{3,10,1,5},{5,7,1,4},{7,4,1,2}},
}
for i,t in ipairs(T) do OX=(i-1)*CW;tuft(12,t) end

local base=OUT..'/props/grass'
spr:saveAs(base..'.aseprite');spr:saveCopyAs(base..'.png')
local flat=Image(CW*N,CH,ColorMode.RGB);flat:drawSprite(spr,1)
local k=8;local pv=Image(CW*N*k,CH*k,ColorMode.RGB)
for y=0,CH*k-1 do for x=0,CW*N*k-1 do local c=flat:getPixel(x//k,y//k)
 if app.pixelColor.rgbaA(c)==0 then local v=((x//(k*2)+y//(k*2))%2==0) and 150 or 164;c=app.pixelColor.rgba(v,v,v+6,255) end
 pv:drawPixel(x,y,c) end end
pv:saveAs(OUT..'/previews/props-grass-8x.png')
print('props/grass '..(CW*N)..'x'..CH..' exported')
