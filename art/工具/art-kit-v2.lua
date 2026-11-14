-- Aseprite native pixel drawing kit. No reference image is loaded or resampled.
local K={}
K.hex={'18122f','29203f','302857','443d73','655f93','3c405f','626d8d','96a9b9','49242c','743b32','9b5437','c38450','b79d78','e6cd9a','fff0b7','9c5b14','e6a72a','ffd94f','801e30','c53b3d','ef6b57','203b3c','39634a','71944a','a6b85b','126987','21c8db','80f0f0','0e1027'}
K.base=app.params['out']
function K.new(name,w,h,tile,opaque,hex)
 K.name=name;K.w=w;K.h=h;K.tile=tile;K.opaque=opaque;K.s=Sprite(w,h,ColorMode.RGB);K.first=true;K.cornerCuts={}
 K.c={};local pal=Palette(30);pal:setColor(0,Color{r=0,g=0,b=0,a=0})
 for i,v in ipairs(hex or K.hex) do local r=tonumber(v:sub(1,2),16);local g=tonumber(v:sub(3,4),16);local b=tonumber(v:sub(5,6),16)
  K.c[i]=app.pixelColor.rgba(r,g,b,255);pal:setColor(i,Color{r=r,g=g,b=b,a=255}) end
 K.s:setPalette(pal);K.layer('01 Structure')
end
function K.layer(name)
 local l;if K.first then l=K.s.layers[1];K.first=false else l=K.s:newLayer() end;l.name=name
 K.s:newCel(l,1,Image(K.w,K.h,ColorMode.RGB),Point(0,0));K.im=l:cel(1).image
end
function K.p(x,y,c)
 x=math.floor(x);y=math.floor(y)
 if K.tile then x=x%K.w end
 if x>=0 and x<K.w and y>=0 and y<K.h then K.im:drawPixel(x,y,c==0 and 0 or K.c[c]) end
end
function K.rect(x,y,w,h,c) for yy=y,y+h-1 do for xx=x,x+w-1 do K.p(xx,yy,c) end end end
function K.line(x,y,xx,yy,c)
 local dx=math.abs(xx-x);local sx=x<xx and 1 or -1;local dy=-math.abs(yy-y);local sy=y<yy and 1 or -1;local e=dx+dy
 while true do K.p(x,y,c);if x==xx and y==yy then break end;local e2=2*e;if e2>=dy then e=e+dy;x=x+sx end;if e2<=dx then e=e+dx;y=y+sy end end
end
function K.poly(p,c)
 local lo,hi=K.h,0;for _,a in ipairs(p) do lo=math.min(lo,a[2]);hi=math.max(hi,a[2]) end
 for y=lo,hi do local xs={};local j=#p
  for i=1,#p do local a,b=p[i],p[j];if (a[2]<=y and b[2]>y) or (b[2]<=y and a[2]>y) then xs[#xs+1]=a[1]+(y-a[2])*(b[1]-a[1])/(b[2]-a[2]) end;j=i end
  table.sort(xs);for i=1,#xs-1,2 do for x=math.floor(xs[i]+.5),math.floor(xs[i+1]+.5) do K.p(x,y,c) end end
 end
 for i,a in ipairs(p) do local b=p[i%#p+1];K.line(a[1],a[2],b[1],b[2],c) end
end
function K.box(x,y,w,h,c)
 K.rect(x+1,y,w-2,h,c);K.rect(x,y+1,w,h-2,c)
end
function K.oval(cx,cy,rx,ry,c)
 for y=-ry,ry do local r=math.floor(rx*math.sqrt(math.max(0,1-y*y/(ry*ry)))+.35)
  for x=-r,r do K.p(cx+x,cy+y,c) end end
end
function K.arch(cx,y,r,h,c)
 for yy=0,h-1 do local rr=r
  if yy<r then rr=math.floor(math.sqrt(math.max(0,r*r-(r-yy)*(r-yy)))+.35) end
  for x=-rr,rr do K.p(cx+x,y+yy,c) end end
end
function K.star(cx,cy,r,c)
 local p={};for i=0,9 do local a=-math.pi/2+i*math.pi/5;local rr=i%2==0 and r or r*.43;p[#p+1]={cx+math.floor(math.cos(a)*rr+.5),cy+math.floor(math.sin(a)*rr+.5)} end;K.poly(p,c)
end
function K.shard(x,y,w,h,gold)
 local sh,md,hi=26,27,28;if gold then sh,md,hi=16,17,18 end
 local tip=x+math.floor(w*.65);local knee=y-h+math.floor(h*.35)
 K.poly({{x,y},{x+1,knee},{tip,y-h},{x+w,knee+2},{x+w-2,y}},sh)
 K.poly({{x+1,knee},{tip,y-h},{tip-2,y-2},{x+2,y}},md)
 K.poly({{x+1,knee},{tip,y-h},{tip-2,knee+4}},hi)
 K.line(x+1,knee+1,x+1,y-3,hi)
end
function K.crystals(cx,y,size,gold)
 K.shard(cx-size,y,math.max(4,math.floor(size*.7)),size,false==gold and false or gold)
 K.shard(cx-2,y,math.max(5,size),size*2,gold)
 K.shard(cx+size-3,y,math.max(4,math.floor(size*.6)),size+2,gold)
 K.poly({{cx-size-2,y},{cx-size,y-2},{cx+size+3,y-2},{cx+size+5,y},{cx+size+5,y+2},{cx-size-2,y+2}},6)
 K.line(cx-size,y-2,cx-3,y-2,7)
end
function K.rock(x,y,w,h,moss)
 local a=math.floor(w*.25);local b=math.floor(w*.65)
 K.poly({{x,y},{x+1,y-h+4},{x+a,y-h},{x+b,y-h},{x+w-2,y-math.floor(h*.6)},{x+w,y},{x,y}},6)
 K.poly({{x+1,y-h+4},{x+a,y-h},{x+b,y-h},{x+b-2,y-h+4},{x+math.floor(w*.45),y-math.floor(h*.4)},{x+2,y-math.floor(h*.3)}},7)
 K.line(x+2,y-h+4,x+a,y-h+1,8);K.line(x+a,y-h+1,x+b-2,y-h+1,8)
 K.poly({{x+b,y-h+1},{x+w-2,y-math.floor(h*.6)},{x+w-1,y},{x+b-3,y}},4)
 if moss then K.line(x+a,y-h,x+b,y-h,25);K.rect(x+a,y-h+1,b-a,2,24);K.line(x+a+2,y-h+2,x+a+2,y-h+5,23) end
end
function K.grass(cx,y,h,width,dark)
 local a,b,c=23,24,25;if dark then a,b,c=22,23,26 end
 K.poly({{cx-width,y},{cx-width-2,y-math.floor(h*.6)},{cx-3,y-4},{cx-4,y-h},{cx,y-6},{cx+4,y-h+2},{cx+3,y-3},{cx+width+2,y-math.floor(h*.5)},{cx+width,y}},a)
 K.line(cx-3,y-2,cx-4,y-h+2,b);K.line(cx+1,y-3,cx+4,y-h+4,b)
 K.line(cx-width+1,y-3,cx-width-1,y-math.floor(h*.6)+2,c)
end
function K.mushroom(cx,y,r,blue)
 local sh,md,hi=19,20,21;if blue then sh,md,hi=26,27,28 end
 K.rect(cx-1,y-r,4,r+1,13);K.line(cx,y-r,cx,y-1,14)
 K.oval(cx,y-r,r,math.max(2,math.floor(r*.5)),sh)
 K.poly({{cx-r,y-r},{cx-r+2,y-r-3},{cx-2,y-2*r},{cx+2,y-2*r},{cx+r-1,y-r-2},{cx+r,y-r}},md)
 K.line(cx-r+2,y-r-3,cx-2,y-2*r+1,hi)
 if not blue then K.box(cx-2,y-2*r+2,4,3,15);K.rect(cx-r+3,y-r-2,2,1,14) end
end
function K.window(cx,y,r,h,warm)
 K.arch(cx,y,r,h,6);K.arch(cx,y+2,r-2,h-3,2);K.arch(cx,y+3,r-3,h-5,warm and 18 or 27)
 K.line(cx,y+3,cx,y+h-3,9);K.line(cx-r+3,y+math.floor(h*.55),cx+r-3,y+math.floor(h*.55),9)
 K.rect(cx-r-1,y+h-1,r*2+3,2,7);K.line(cx-r,y+h-1,cx+r,y+h-1,8)
end
function K.crate(x,y,w,h)
 K.box(x,y,w,h,9);K.rect(x+2,y+2,w-4,h-4,10)
 for xx=x+4,x+w-4,5 do K.line(xx,y+3,xx,y+h-4,11) end
 K.rect(x+1,y+1,w-2,3,12);K.rect(x+1,y+h-4,w-2,3,11)
 for i=0,math.min(w-5,h-5) do K.p(x+2+i,y+h-4-i,12);K.p(x+3+i,y+h-4-i,11) end
 K.p(x+2,y+2,8);K.p(x+w-3,y+2,8);K.p(x+2,y+h-3,6);K.p(x+w-3,y+h-3,6)
end
function K.barrel(cx,y,w,h)
 local rx=math.floor(w/2)
 K.poly({{cx-rx+2,y-h},{cx+rx-2,y-h},{cx+rx,y-h+4},{cx+rx,y-4},{cx+rx-2,y},{cx-rx+2,y},{cx-rx,y-4},{cx-rx,y-h+4}},10)
 K.rect(cx-rx+3,y-h+2,math.max(2,rx-2),h-3,11);K.line(cx-rx+4,y-h+3,cx-rx+4,y-3,12)
 for xx=cx-rx+2,cx+rx-2,5 do K.line(xx,y-h+2,xx,y-1,9) end
 for _,yy in ipairs({y-h+3,y-5}) do K.rect(cx-rx,yy,w+1,3,6);K.line(cx-rx+1,yy,cx+rx-1,yy,8) end
 K.oval(cx,y-h,rx-2,2,9);K.line(cx-rx+3,y-h-1,cx+rx-3,y-h-1,12)
end
function K.vine(x,y,h,cyan)
 for t=0,h do local xx=x+math.floor(t/8)%2;K.p(xx,y+t,23)
  if t%8==2 then K.poly({{xx,y+t},{xx-4,y+t-2},{xx-5,y+t},{xx-2,y+t+2}},24) end
  if t%8==6 then K.poly({{xx,y+t},{xx+4,y+t-2},{xx+5,y+t},{xx+2,y+t+2}},22);K.line(xx+1,y+t,xx+4,y+t-1,24) end
 end
 if cyan then K.box(x-1,y+h-1,4,4,27);K.rect(x,y+h,2,1,28) end
end

-- Version 2: keep silhouette intact; never globally erase corner pixels.
-- The exterior ink is a dedicated color appearing on the boundary only.
function K.contour(color)
 local flat=Image(K.w,K.h,ColorMode.RGB);flat:drawSprite(K.s,1)
 local function on(x,y)
  if K.tile then x=x%K.w end
  return x>=0 and x<K.w and y>=0 and y<K.h and app.pixelColor.rgbaA(flat:getPixel(x,y))>0
 end
 local function edge(x,y) return on(x,y) and not(on(x-1,y) and on(x+1,y) and on(x,y-1) and on(x,y+1)) end
 K.layer('Material restored beneath old interior ink')
 for y=0,K.h-1 do for x=0,K.w-1 do
  if on(x,y) and not edge(x,y) and flat:getPixel(x,y)==K.c[1] then K.p(x,y,2) end
 end end
 K.layer('Single 1px continuous outer contour')
 for y=0,K.h-1 do for x=0,K.w-1 do
  if edge(x,y) and not(K.tile and (y==0 or y==K.h-1)) then K.p(x,y,1) end
 end end
end
function K.finish(contour)
 for _,q in ipairs(K.cornerCuts or {}) do
  for _,l in ipairs(K.s.layers) do local c=l:cel(1);if c then
   local x,y=q[1]-c.position.x,q[2]-c.position.y
   if x>=0 and y>=0 and x<c.image.width and y<c.image.height then c.image:drawPixel(x,y,0) end
  end end
 end
 if not K.opaque and contour~=false then K.contour(type(contour)=='number' and contour or 1) end
 -- Periodic layers share identical endpoint columns; tile art is planned away from seam.
 if K.tile then
  for _,l in ipairs(K.s.layers) do local cel=l:cel(1);if cel then
   for y=0,K.h-1 do cel.image:drawPixel(K.w-1,y,cel.image:getPixel(0,y)) end
  end end
 end
 local base=K.base..'/'..K.name
 K.s:saveAs(base..'.aseprite');K.s:saveCopyAs(base..'.png')
 local flat=Image(K.w,K.h,ColorMode.RGB);flat:drawSprite(K.s,1);flat:resize(K.w*4,K.h*4)
 flat:saveAs(K.base..'/previews/'..K.name:gsub('/','-')..'-4x.png')
 print(K.name..' '..K.w..'x'..K.h..' exported')
end
return K
