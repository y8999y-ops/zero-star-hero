-- Crystal clusters sheet, redrawn natively from art/參考原圖/props/crystals.png.
-- Reference measures ~7 source px per art px: clusters are about 24x26, 34x37 and 46x49 art px, so the
-- sheet is six 52x52 cells (gold small/medium/large, then cyan small/medium/large), bottom row = ground.
-- A shard is a prism: straight sides up to a shoulder, then a point. Its left face is lit, its right face
-- in shade, a bright ridge runs between them and the facet above the shoulder on the lit side is brightest.
-- Every shard and stone lays a 1px outline ring first, so overlaps stay readable.
-- Run: aseprite -b --script-param out=art/drafts --script tools/redraw-props-crystals-reference.lua
local OUT=app.params['out']
local HEX={'2a1640',                                  -- 1 outline
 'b8700e','e09a1c','f4c030','fde27a','fff6c8',        -- 2-6 gold: dark, mid, light, high, white
 '1a7aa8','28aed0','4cd8ec','a0f2fa','e4ffff',        -- 7-11 cyan
 '3a2468','5a3c94','7a5cb8','9a80d0'}                 -- 12-15 stone
local CW,CH,N=52,52,6
local spr=Sprite(CW*N,CH,ColorMode.RGB)
local pal=Palette(#HEX+1);pal:setColor(0,Color{r=0,g=0,b=0,a=0})
local C={}
for i,v in ipairs(HEX) do local r,g,b=tonumber(v:sub(1,2),16),tonumber(v:sub(3,4),16),tonumber(v:sub(5,6),16)
 C[i]=app.pixelColor.rgba(r,g,b,255);pal:setColor(i,Color{r=r,g=g,b=b,a=255}) end
spr:setPalette(pal)
local img=spr.cels[1].image;spr.layers[1].name='Crystal clusters'
local OX=0
local function px(x,y,c) x=OX+x;if x>=OX and x<OX+CW and y>=0 and y<CH then img:drawPixel(x,y,C[c]) end end
local function key(x,y) return x..','..y end
local function put(set)
 for k,_ in pairs(set) do local x,y=k:match('(-?%d+),(-?%d+)');x,y=tonumber(x),tonumber(y)
  for _,d in ipairs({{1,0},{-1,0},{0,1},{0,-1}}) do if not set[key(x+d[1],y+d[2])] then px(x+d[1],y+d[2],1) end end end
 for k,c in pairs(set) do local x,y=k:match('(-?%d+),(-?%d+)');px(tonumber(x),tonumber(y),c) end
end

local GOLD={2,3,4,5,6};local CYAN={7,8,9,10,11}
-- shard from base centre (bx,by) to tip (tx,ty), half-width hw, straight up to `sh` of its length
local function shard(bx,by,tx,ty,hw,ramp,sh)
 sh=sh or .7
 local dx,dy=tx-bx,ty-by;local len=math.sqrt(dx*dx+dy*dy);local ax,ay=dx/len,dy/len;local nx,ny=-ay,ax  -- n points right
 if nx<0 then nx,ny=-nx,-ny end
 local s={};local R=math.ceil(len+hw)+1
 for y=math.floor(math.min(by,ty)-hw-1),math.ceil(math.max(by,ty)+1) do
  for x=math.floor(math.min(bx,tx)-hw-1),math.ceil(math.max(bx,tx)+hw+1) do
   local qx,qy=x-bx,y-by;local u=(qx*ax+qy*ay)/len;local v=(qx*nx+qy*ny)
   if u>=0 and u<=1 then
    local w=u<=sh and hw or hw*(1-u)/(1-sh)
    if math.abs(v)<=w+.35 then
     local vn=v/math.max(.5,w);local ridge=.12
     local c
     if vn<ridge then c=(u>sh) and ramp[4] or ramp[3] else c=(vn>.45) and ramp[1] or ramp[2] end
     -- the ridge itself: one bright column along the face boundary below the shoulder
     if math.abs(v-ridge*w)<.5 and u>.08 and u<=sh+.02 then c=ramp[4] end
     -- the facet above the shoulder on the shaded side catches a little light too
     if u>sh and vn>=ridge and vn<.4 then c=ramp[2] end
     if u>.97 or (u>sh+.12 and vn<-.4) then c=ramp[5] end
     s[key(x,y)]=c
    end
   end
  end
 end
 put(s)
end
-- a stone at the foot: an outlined dome, lit from the upper left, flat where it meets the ground
local function stone(cx,cy,rx,ry)
 local s={}
 for y=math.floor(cy-ry),50 do for x=math.floor(cx-rx),math.ceil(cx+rx) do
  local u,v=(x-cx)/(rx+.5),(y-cy)/(ry+.5);local d=u*u+v*v
  if d<=1 or (y>cy and math.abs(u)<=1-.15*(y-cy)/ry) then
   local nz=math.sqrt(math.max(0,1-d));local l=-.55*u-.6*v+.58*nz
   s[key(x,y)]=l>.75 and 15 or l>.35 and 14 or l>-.1 and 13 or 12 end end end
 put(s)
end
local function rocks(list) for _,r in ipairs(list) do stone(r[1],r[2],r[3],r[4]) end end

-- each cluster: back shards, centre, front shards, then the stones over their feet
-- each cluster: back shards fanning out, the centre, stones over their feet, then small front shards
local CL={
 -- small (about 24x26)
 function(R) shard(20,47,11,33,3,R);shard(30,47,38,35,3,R);shard(25,48,26,23,4,R)
  rocks({{20,47,4,2.5},{29,46,5,3}});shard(16,49,10,41,2.4,R) end,
 -- medium (about 34x37)
 function(R) shard(21,46,8,22,4.5,R);shard(32,46,44,25,4.5,R);shard(26,47,29,10,6,R)
  rocks({{15,46,5,3},{27,45,7,4},{38,47,4,2.5}});shard(40,48,47,38,2.6,R);shard(12,49,7,42,2.4,R) end,
 -- large (about 46x49)
 function(R) shard(18,45,3,17,6,R);shard(32,45,46,20,6,R);shard(25,46,29,2,8,R)
  rocks({{11,46,6,3.5},{25,44,8,4.5},{38,46,6,3.5}})
  shard(9,48,1,37,3.4,R);shard(41,48,50,35,3.2,R) end,
}
for i=1,3 do OX=(i-1)*CW;CL[i](GOLD) end
for i=1,3 do OX=(i+2)*CW;CL[i](CYAN) end

local base=OUT..'/props/crystals'
spr:saveAs(base..'.aseprite');spr:saveCopyAs(base..'.png')
local flat=Image(CW*N,CH,ColorMode.RGB);flat:drawSprite(spr,1)
local k=6;local pv=Image(CW*N*k,CH*k,ColorMode.RGB)
for y=0,CH*k-1 do for x=0,CW*N*k-1 do local c=flat:getPixel(x//k,y//k)
 if app.pixelColor.rgbaA(c)==0 then local v=((x//(k*2)+y//(k*2))%2==0) and 150 or 164;c=app.pixelColor.rgba(v,v,v+6,255) end
 pv:drawPixel(x,y,c) end end
pv:saveAs(OUT..'/previews/props-crystals-6x.png')
print('props/crystals '..(CW*N)..'x'..CH..' exported')
