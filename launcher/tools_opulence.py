from PIL import Image,ImageDraw,ImageFilter
import math
from pathlib import Path
r=Path(r"C:\Users\insan\Documents\Horizon-PortalV1\launcher\src\assets\themes")
W,H=1600,900
bg=Image.new("RGB",(W,H),(8,5,12))
px=bg.load()
for y in range(H):
    for x in range(W):
        dx=(x-W*.5)/W
        dy=(y-H*.48)/H
        g=max(0,1-math.sqrt(dx*dx+dy*dy)*2.4)
        px[x,y]=(int(8+18*g),int(5+7*g),int(12+25*g))
d=ImageDraw.Draw(bg,"RGBA")
for rr,a in [(650,45),(470,30),(300,22)]:
    d.ellipse((W//2-rr,H//2-rr,W//2+rr,H//2+rr),outline=(173,117,42,a),width=2)
for ang in range(0,360,30):
    t=math.radians(ang)
    d.line((W//2,H//2,W//2+650*math.cos(t),H//2+650*math.sin(t)),fill=(157,95,40,22),width=1)
cx,cy=W//2,H//2
d.polygon([(cx-190,cy-100),(cx+190,cy-100),(cx+125,cy+25),(cx+48,cy+55),(cx-48,cy+55),(cx-125,cy+25)],fill=(185,128,38,18))
d.polygon([(cx-42,cy+45),(cx+42,cy+45),(cx+26,cy+160),(cx-26,cy+160)],fill=(185,128,38,18))
d.polygon([(cx-95,cy+160),(cx+95,cy+160),(cx+125,cy+185),(cx-125,cy+185)],fill=(185,128,38,18))
bg=bg.filter(ImageFilter.GaussianBlur(.35))
bg.save(r/"opulence-art.png","PNG",optimize=True)
print("OPULENCE_ART_REFRESHED")