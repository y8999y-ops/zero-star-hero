-- The seven remaining rocks of art/參考原圖/props/rocks.png, drawn to match the approved
-- art/approved/props/largest-rock-64 (same ~5 source px per art px, same 64x64 cell, same palette and
-- plane structure). Sizes measured from the reference: pebbles ~20x10, small ~23x17, small mossy ~31x21,
-- medium ~37x29, mossy medium ~43x34, rock with crystals ~48x35, big mossy ~57x47. Ground on row 57.
-- Each rock is one faceted template (in 0..1 box units, jittered per rock): a lit crown plane facing up
-- and left, an upper and a lower front plane, a dark side plane on the right, a bevel highlight where the
-- crown turns, a fracture line, and a darker foot. Moss caps follow the top contour and drip; tufts sit
-- at the foot. 1px outline around everything.
-- Run: aseprite -b --script-param out=art/drafts --script tools/redraw-props-rocks-reference.lua
local OUT=app.params['out']
local HEX={'1e2230','29354c','363e58','465771','5c7189','7990a3','a6bcc7','c8d6d6','4c506a','2d4437','526c36','80953e','acba53','d3db93','146580','299fbb','58d7e8','b1f8fa','374963','60728c','8a9caa'}
local CW,CH,N,G=64,64,7,57
local spr=Sprite(CW*N,CH,ColorMode.RGB)
local pal=Palette(#HEX+1);pal:setColor(0,Color{r=0,g=0,b=0,a=0})
local C={}
for i,v in ipairs(HEX) do local r,g,b=tonumber(v:sub(1,2),16),tonumber(v:sub(3,4),16),tonumber(v:sub(5,6),16)
 C[i]=app.pixelColor.rgba(r,g,b,255);pal:setColor(i,Color{r=r,g=g,b=b,a=255}) end
spr:setPalette(pal)
local img=spr.cels[1].image;spr.layers[1].name='Rocks'
local OX=0
local function px(x,y,c) x=OX+x;if x>=OX and x<OX+CW and y>=0 and y<CH then img:drawPixel(x,y,C[c]) end end
local function key(x,y) return x..','..y end
local function each(set,fn) for k,c in pairs(set) do local x,y=k:match('(-?%d+),(-?%d+)');fn(tonumber(x),tonumber(y),c,k) end end
local function put(set,noring)
 if not noring then each(set,function(x,y)
  for _,d in ipairs({{1,0},{-1,0},{0,1},{0,-1}}) do if not set[key(x+d[1],y+d[2])] then px(x+d[1],y+d[2],1) end end end) end
 each(set,function(x,y,c) px(x,y,c) end)
end
local function inside(p,x,y)
 local c=false;local j=#p
 for i=1,#p do local a,b=p[i],p[j];if ((a[2]>y)~=(b[2]>y)) and (x<(b[1]-a[1])*(y-a[2])/(b[2]-a[2])+a[1]) then c=not c end;j=i end
 return c
end
local function hash(i,s) local h=math.sin(i*127.1+s*311.7)*43758.5453;return h-math.floor(h) end

-- template in box units; each entry is a polygon
local T={
 sil={{0,1},{.03,.58},{.16,.28},{.38,.06},{.6,0},{.78,.06},{.92,.3},{.98,.6},{1,1}},
 crown={{-.1,.7},{.16,.28},{.38,.06},{.6,-.1},{.8,.04},{.7,.2},{.5,.33},{.3,.48},{.08,.72}},
 side={{.8,.04},{.95,.28},{1.1,.6},{1.1,1.1},{.78,1.1},{.72,.7},{.76,.32}},
 upper={{.08,.72},{.3,.48},{.5,.33},{.7,.2},{.79,.32},{.73,.52},{.5,.6},{.25,.7},{.04,.82}},
 ledge={{.12,.86},{.36,.75},{.56,.76},{.47,.86},{.22,.93}},
}
-- returns the rock's pixel set and its top contour (column -> top y)
local function rock(cx,w,h,seed,opt)
 opt=opt or {}
 local x0,y0=math.floor(cx-w/2),G-h+1
 local function J(p,amt) local q={}
  for i,v in ipairs(p) do local jx=(hash(i,seed)-.5)*amt;local jy=(hash(i+9,seed)-.5)*amt
   if v[2]>=1 then jy=0 end;q[#q+1]={x0+(v[1]+jx)*w,y0+(v[2]+jy)*h} end
  return q end
 local sil=J(T.sil,opt.flat and .04 or .1)
 if opt.flat then sil[4][2]=y0+.04*h;sil[5][2]=y0;sil[6][2]=y0+.02*h end
 local crown,side,upper,ledge=J(T.crown,.06),J(T.side,.05),J(T.upper,.05),J(T.ledge,.05)
 local s,top={},{}
 for y=y0-2,G do for x=x0-2,x0+w+2 do if inside(sil,x+.5,y+.5) then
  local c=4
  if inside(side,x+.5,y+.5) then c=3 elseif inside(crown,x+.5,y+.5) then c=6 elseif inside(upper,x+.5,y+.5) then c=5 elseif h>14 and inside(ledge,x+.5,y+.5) then c=5 end
  if y>=G-1 and c~=3 then c=19 elseif y>=G-1 then c=2 end
  s[key(x,y)]=c;top[x]=math.min(top[x] or 999,y) end end end
 -- small facets inside each plane: a jittered grid of seeds, nearest seed wins (distance squashed
 -- vertically so the chips run in horizontal slabs). Each chip shifts one step along its plane's ramp;
 -- where a chip meets the one below it the edge is a dark crease, where it meets the one above, a lit bevel.
 if h>8 then
  local RAMP={[6]={20,6,21},[5]={4,5,20},[4]={19,4,5},[3]={2,3,19}}
  local seeds={};local cw,chh=math.max(7,math.floor(w/3.2)),math.max(5,math.floor(h/3.6))
  for gy=0,math.ceil(h/chh) do for gx=0,math.ceil(w/cw) do local i=#seeds+1
   seeds[i]={x0+gx*cw+(hash(i,seed+20)-.3)*cw*.8,y0+gy*chh+(hash(i+50,seed+20)-.5)*chh*.7,
    ({1,2,2,2,3,3})[math.floor(hash(i+90,seed+20)*6)+1]} end end
  local fid={}
  each(s,function(x,y,c,k) if RAMP[c] then local best,bi=1e9,1
   for i,sd in ipairs(seeds) do local d=((x-sd[1])*.8)^2+((y-sd[2])*1.15)^2;if d<best then best,bi=d,i end end
   fid[k]=bi end end)
  local base={};each(s,function(x,y,c,k) base[k]=c end)
  each(s,function(x,y,c,k) local f=fid[k];if not f then return end;local r=RAMP[base[k]]
   local v=seeds[f][3];local below,above=fid[key(x,y+1)],fid[key(x,y-1)]
   -- only some chip edges are cut: a crease or bevel shows where the pair's hash says so
   if below and below~=f and base[key(x,y+1)]==base[k] and hash(f*31+below,seed)>.45 then s[k]=(base[k]==3) and 2 or 19;return end
   if above and above~=f and base[key(x,y-1)]==base[k] and hash(f*17+above,seed)>.5 then v=math.min(3,v+1) end
   if base[k]==6 and v==1 then v=2 end   -- the crown stays light
   s[k]=r[v] end)
 end
 -- bevels: the crown's top rim catches the most light; its lower boundary gets a light seam
 for x,ty in pairs(top) do local k=key(x,ty);if s[k]==6 then s[k]=(x-x0)<w*.4 and 8 or 7 end
  for r=1,2 do local k2=key(x,ty+r);if s[k2]==6 and (x-x0)<w*(r==1 and .62 or .4) then s[k2]=7 end end end
 local sh={}
 each(s,function(x,y,c,k) local up=s[key(x,y-1)]
  if c==4 and (up==5 or up==6) then sh[k]=19 end
  if c==5 and up==6 then sh[k]=21 end
  if c==5 and s[key(x+1,y)]==3 then sh[k]=20 end
  if c==3 and s[key(x-1,y)]==6 then sh[k]=2 end end)
 for k,c in pairs(sh) do s[k]=c end
 local pk=key(math.floor(x0+w*.33),top[math.floor(x0+w*.33)] or y0);if s[pk] then s[pk]=8 end
 -- fracture: from the upper front's lower corner down to the foot
 local fx,fy=x0+w*(.42+(hash(3,seed)-.5)*.1),y0+h*.66
 for i=0,math.floor(G-fy) do local x=math.floor(fx+i*.35+.5);local k=key(x,math.floor(fy+i));if s[k] and s[k]~=3 then s[k]=19 end end
 if opt.chunk then local gx,gy=x0+w*.18,y0+h*.82
  for i=0,math.floor(w*.3) do local k=key(math.floor(gx+i),math.floor(gy-i*.35));if s[k] and s[k]~=3 then s[k]=19 end end end
 return s,top,x0,y0
end
-- moss cap over the top contour between fractions a..b, with drips
local function moss(s,top,x0,w,a,b,depth,seed,drip)
 for x=math.floor(x0+w*a),math.floor(x0+w*b) do local ty=top[x];if ty then
  local f=(x-(x0+w*a))/math.max(1,w*(b-a));local d=math.floor(depth*math.sin(math.pi*math.min(1,f*1.1))+.5)+((x%3==0) and 1 or 0)
  if f>.95 or f<.03 then d=math.min(d,1) end
  for k=0,d do local c=k==0 and 14 or k<=2 and 13 or k<d and 12 or 11;if x-x0>w*.65 and k>0 then c=math.max(11,c-1) end
   s[key(x,ty+k)]=c end
  local L=drip and (hash(x,seed)>.55 and math.floor(hash(x+40,seed)*drip)+2 or 0) or 0
  for k=1,L do local c=k==L and 10 or (k==1 and 12 or 11);local kk=key(x,ty+d+k);if s[kk] then s[kk]=c end
   if L>4 and k<L-1 and hash(x+7,seed)>.5 then local k2=key(x+1,ty+d+k);if s[k2] and s[k2]<10 then s[k2]=10 end end end
 end end
end
local function tuft(cx,w,h)
 local s={}
 for y=G-h+1,G do for x=cx-w,cx+w do local u=(x-cx)/(w+.5);local v=(y-(G+1))/(h+.5)
  if u*u+v*v<=1 then local l=-.5*u-.7*v;s[key(x,y)]=l>.75 and 14 or l>.45 and 13 or l>.2 and 12 or 11 end end end
 put(s) end
local function shard(bx,by,tx,ty,hw)
 local dx,dy=tx-bx,ty-by;local len=math.sqrt(dx*dx+dy*dy);local ax,ay=dx/len,dy/len;local nx,ny=-ay,ax;if nx<0 then nx,ny=-nx,-ny end
 local s={}
 for y=math.floor(math.min(by,ty)-hw-1),math.ceil(math.max(by,ty)+1) do for x=math.floor(math.min(bx,tx)-hw-1),math.ceil(math.max(bx,tx)+hw+1) do
  local qx,qy=x-bx,y-by;local u=(qx*ax+qy*ay)/len;local v=qx*nx+qy*ny
  if u>=0 and u<=1 then local w=u<=.7 and hw or hw*(1-u)/.3
   if math.abs(v)<=w+.35 then local vn=v/math.max(.5,w)
    local c=vn<.1 and ((u>.7) and 18 or 17) or (vn>.5 and 15 or 16)
    if math.abs(v-.1*w)<.5 and u>.08 and u<=.72 then c=18 end
    s[key(x,y)]=c end end end end
 put(s) end

-- 1 two pebbles
OX=0
do local s=rock(27,14,9,1);put(s);local t=rock(37,8,5,2);put(t) end
-- 2 small flat-topped rock
OX=64
do local s=rock(32,23,17,3,{flat=true});put(s) end
-- 3 small rock with a moss cap and two tufts
OX=128
do local s,top,x0=rock(32,31,21,4);moss(s,top,x0,31,.14,.8,4,4,4);put(s);tuft(18,5,3);tuft(46,4,3) end
-- 4 medium rock, split into two chunks
OX=192
do local s=rock(32,37,29,5,{chunk=true});put(s) end
-- 5 medium rock with a dripping moss cap and tufts
OX=256
do local s,top,x0=rock(32,43,34,6,{chunk=true});moss(s,top,x0,43,.24,.94,6,6,8);put(s);tuft(13,6,4);tuft(50,5,3) end
-- 6 rock with a cyan crystal cluster growing from its right side
OX=320
do local s=rock(28,40,35,7,{chunk=true});put(s)
 shard(45,57,47,32,4.2);shard(52,57,57,40,3.4);shard(40,57,37,46,2.4);shard(57,57,61,50,2) end
-- 7 big rock under a heavy, dripping moss cap
OX=384
do local s,top,x0=rock(32,57,47,8,{chunk=true});moss(s,top,x0,57,.3,.98,8,8,12);put(s);tuft(8,7,5);tuft(54,6,4) end

local base=OUT..'/props/rocks'
spr:saveAs(base..'.aseprite');spr:saveCopyAs(base..'.png')
local flat=Image(CW*N,CH,ColorMode.RGB);flat:drawSprite(spr,1)
local k=4;local pv=Image(CW*N*k,CH*k,ColorMode.RGB)
for y=0,CH*k-1 do for x=0,CW*N*k-1 do local c=flat:getPixel(x//k,y//k)
 if app.pixelColor.rgbaA(c)==0 then local v=((x//(k*2)+y//(k*2))%2==0) and 150 or 164;c=app.pixelColor.rgba(v,v,v+6,255) end
 pv:drawPixel(x,y,c) end end
pv:saveAs(OUT..'/previews/props-rocks-4x.png')
print('props/rocks '..(CW*N)..'x'..CH..' exported')
