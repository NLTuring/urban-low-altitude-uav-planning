"""Blender authoring script for the AIRORDER concept campus, metres, Z up.
Run in a separate Blender process with --background --factory-startup --python.
This is asset authoring only; routes are illustrative, not flight plans.
"""
import bpy, math, random, json, time
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'blender'
MODEL = ROOT / 'models'
OUT.mkdir(exist_ok=True)
MODEL.mkdir(exist_ok=True)
random.seed(81)
started = time.time()

def progress(message):
    print('AIRORDER: '+message, flush=True)
    (OUT/'build-status.txt').write_text(message, encoding='utf-8')

# GUI authoring creates a new scene in a separate window; an existing scene is
# never cleared. Background authoring starts in an explicitly empty process.
GUI_AUTHORING=(not bpy.app.background) or globals().get('AIRORDER_GUI_AUTHORING',False)
if GUI_AUTHORING:
    scene=bpy.data.scenes.new('AIRORDER — 示范园区')
    bpy.context.window.scene=scene
else:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    scene=bpy.context.scene
scene.name='AIRORDER — 示范园区'
scene.unit_settings.system='METRIC'
scene.unit_settings.scale_length=1.0
scene['description']='Concept site. No real operational, geographic or approved airspace data.'
scene['site_dimensions_m']='600 × 420'
scene['design_intent']='Restrained architectural model for a low-altitude operations workspace.'

def coll(name):
    c=bpy.data.collections.new(name); scene.collection.children.link(c); return c
C_SITE=coll('01 场地与道路 / Site')
C_BUILD=coll('02 建筑 / Buildings')
C_LAND=coll('03 景观 / Landscape')
C_FAC=coll('04 起降与园区设施 / Facilities')
C_AIR=coll('05 航路样例 / Airspace sample')
C_VIEW=coll('90 摄影与照明 / Presentation')
BASE_COLS=[C_SITE,C_BUILD,C_LAND,C_FAC]

def srgb(v): return v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4
def mat(name,hexcolor,rough=.65,metal=0):
    rgb=tuple(srgb(int(hexcolor[i:i+2],16)/255) for i in (1,3,5))
    m=bpy.data.materials.new(name)
    m.diffuse_color=(*rgb,1)
    m.use_nodes=True
    n=m.node_tree.nodes.get('Principled BSDF')
    n.inputs['Base Color'].default_value=(*rgb,1)
    n.inputs['Roughness'].default_value=rough
    n.inputs['Metallic'].default_value=metal
    return m

M={
 'earth':mat('01 Ground / graphite stone','#667267'),
 'grass':mat('02 Lawn / muted sage','#93A487',.95),
 'grass2':mat('03 Planted verge','#708B70',.94),
 'road':mat('04 Asphalt','#4D5557',.9),
 'paving':mat('05 Concrete paving','#B9B9A9',.83),
 'white':mat('06 Road white','#DDDAD0',.8),
 'yellow':mat('07 Road amber','#C4AA6A',.75),
 'wall':mat('08 Limestone facade','#D8D6CB',.72),
 'wall2':mat('09 Warm precast facade','#BFBDAE',.78),
 'roof':mat('10 Standing seam zinc roof','#AFB7B2',.52,.2),
 'glass':mat('11 Grey green glazing','#546B6E',.26,.25),
 'glass2':mat('12 Alternate glazing','#637B7A',.3,.2),
 'frame':mat('13 Window frames','#949B94',.46,.32),
 'metal':mat('14 Anodized dark metal','#465250',.42,.5),
 'solar':mat('15 Photovoltaic panels','#344B58',.32,.35),
 'trunk':mat('16 Tree bark','#726A59',.9),
 'leaf1':mat('17 Tree canopy sage','#7A9578',.9),
 'leaf2':mat('18 Tree canopy olive','#637F67',.9),
 'leaf3':mat('19 Tree canopy light','#96AA82',.9),
 'water':mat('20 Rainwater garden','#638786',.23,.12),
 'wood':mat('21 Timber seating','#9D876A',.85),
 'rubber':mat('22 Vehicle tyres','#303734',.92),
 'car':mat('23 Vehicle light grey','#D1D2CA',.35,.12),
 'car2':mat('24 Vehicle slate','#71827D',.38,.12),
 'teal':mat('25 Delivery / muted teal','#76B6A7',.56),
 'violet':mat('26 Inspection / grey violet','#A69ABD',.56),
 'gold':mat('27 Emergency / warm ochre','#CBB17A',.56),
 'dark':mat('28 UAV chassis','#4C5B59',.48,.2),
}

class Batch:
    def __init__(self,name,c):
        self.name=name; self.c=c; self.v=[]; self.f=[]; self.mi=[]; self.materials=[]
    def mesh(self,vs,fs,m):
        k=len(self.v); self.v.extend(vs)
        if m not in self.materials:self.materials.append(m)
        idx=self.materials.index(m)
        self.f.extend([tuple(k+i for i in f) for f in fs]); self.mi.extend([idx]*len(fs))
    def box(self,loc,size,m,rz=0):
        x,y,z=loc; w,d,h=[s/2 for s in size]; co,si=math.cos(rz),math.sin(rz)
        vs=[]
        for px,py,pz in [(-w,-d,-h),(w,-d,-h),(w,d,-h),(-w,d,-h),(-w,-d,h),(w,-d,h),(w,d,h),(-w,d,h)]:
            vs.append((x+px*co-py*si,y+px*si+py*co,z+pz))
        self.mesh(vs,[(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)],m)
    def cylinder(self,loc,r,h,m,n=12,axis='Z',r2=None):
        r2=r if r2 is None else r2
        vs=[]
        for zz,rr in [(-h/2,r),(h/2,r2)]:
            for i in range(n):
                a=i*math.tau/n; p=(rr*math.cos(a),rr*math.sin(a),zz)
                if axis=='X':p=(p[2],p[0],p[1])
                elif axis=='Y':p=(p[0],p[2],p[1])
                vs.append(tuple(loc[j]+p[j] for j in range(3)))
        fs=[tuple(reversed(range(n))),tuple(range(n,2*n))]
        fs.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
        self.mesh(vs,fs,m)
    def make(self,bevel=0):
        me=bpy.data.meshes.new(self.name+' mesh'); me.from_pydata(self.v,[],self.f); me.update()
        for m in self.materials:me.materials.append(m)
        for p,idx in zip(me.polygons,self.mi):p.material_index=idx
        ob=bpy.data.objects.new(self.name,me); self.c.objects.link(ob)
        if bevel:
            b=ob.modifiers.new('Small construction edge radii','BEVEL'); b.width=bevel; b.segments=2
            b.limit_method='ANGLE'
        return ob

site=Batch('Site foundation, road surfaces and paving',C_SITE)
markings=Batch('Lane markings and pedestrian crossings',C_SITE)
land=Batch('Landscape ground and paths',C_LAND)
fac=Batch('Landing infrastructure and street furniture',C_FAC)
vehicles=Batch('Parked service vehicles',C_FAC)

paving_rects=[]
def paved(cx,cy,w,d):paving_rects.append((cx,cy,w,d))
def grass(cx,cy,w,d):land.box((cx,cy,.23),(w,d,.16),M['grass'])
def linebox(a,b,width,z,m,batch=markings,height=.024):
    dx,dy=b[0]-a[0],b[1]-a[1]
    batch.box(((a[0]+b[0])/2,(a[1]+b[1])/2,z),(math.hypot(dx,dy),width,height),m,math.atan2(dy,dx))

def union_surface(rects,subtract,z0,z1,m,batch):
    """Welded planar union of axis-aligned surfaces, with no coincident faces."""
    allrects=rects+subtract
    xs=sorted({x+s*w/2 for x,y,w,d in allrects for s in (-1,1)})
    ys=sorted({y+s*d/2 for x,y,w,d in allrects for s in (-1,1)})
    def inside(x,y,rs):return any(abs(x-cx)<w/2+1e-7 and abs(y-cy)<d/2+1e-7 for cx,cy,w,d in rs)
    mask=set()
    for i in range(len(xs)-1):
        for j in range(len(ys)-1):
            x=(xs[i]+xs[i+1])/2;y=(ys[j]+ys[j+1])/2
            if inside(x,y,rects) and not inside(x,y,subtract):mask.add((i,j))
    verts=[];faces=[];lookup={}
    def v(x,y,z):
        key=(x,y,z)
        if key not in lookup:lookup[key]=len(verts);verts.append(key)
        return lookup[key]
    for i,j in sorted(mask):
        x0,x1=xs[i],xs[i+1];y0,y1=ys[j],ys[j+1]
        p=[(x0,y0),(x1,y0),(x1,y1),(x0,y1)]
        faces.append(tuple(v(x,y,z1) for x,y in p))
        for edge,neighbor in [(0,(i,j-1)),(1,(i+1,j)),(2,(i,j+1)),(3,(i-1,j))]:
            if neighbor not in mask:
                a=p[edge];b=p[(edge+1)%4]
                faces.append((v(*a,z0),v(*b,z0),v(*b,z1),v(*a,z1)))
    batch.mesh(verts,faces,m)

progress('Creating site structure and road network')
site.box((0,0,-3),(608,428,6),M['earth'])
site.box((0,0,.06),(600,420,.12),M['grass'])
roads=[(0,-5,550,16),(68,0,14,370),(-95,0,11,370),(-273,0,12,376),(273,0,12,376),(0,182,558,12),(0,-182,558,12),(174,101,198,10)]
for x,y,w,d in roads:paved(x,y,w+3.6,d+3.6)
all_road_rects=list(roads)
# Freight service court and footpaths.
paved(-181,21,132,23); paved(-181,95,132,21)
paved(-181,-97,141,136)
paved(181,43,150,83)
paved(158,-82,131,91)
paved(231,-115,47,107)
paved(-13,90,125,146)
for xx in range(-260,265,12):
    if min(abs(xx+95),abs(xx-68))>14:
        for yy in (-9,-1):markings.box((xx,yy,.455),(6,.16,.02),M['white'])
        for yy in (-5.17,-4.83):markings.box((xx,yy,.455),(10,.13,.02),M['yellow'])
for xx in (68,-95,-273,273):
    for yy in range(-166,169,12):
        if abs(yy+5)>15 and not(xx==273 and abs(yy-101)<12):
            markings.box((xx,yy,.455),(.16,6,.02),M['yellow'])
for yy in (-182,182,101):
    xs=range(94,255,12) if yy==101 else range(-257,260,12)
    for xx in xs:
        if min(abs(xx+95),abs(xx-68))>10:markings.box((xx,yy,.455),(6,.15,.02),M['white'])
for xx in (-95,68):
    for side in (-1,1):
        for q in range(-5,6):markings.box((xx+side*13,-5+q*.95,.46),(3.1,.48,.025),M['white'])
        for q in range(-4,5):markings.box((xx+q*1.0,-5+side*12,.46),(.5,3.1,.025),M['white'])
for q in range(-4,5):markings.box((68+q,-167,.46),(.5,3.2,.025),M['white'])

def roof_details(b,cx,cy,w,d,h,solar=True):
    for x in (cx-w/2+.45,cx+w/2-.45):b.box((x,cy,h+.8),(.7,d,1.35),M['wall2'])
    for y in (cy-d/2+.45,cy+d/2-.45):b.box((cx,y,h+.8),(w,.7,1.35),M['wall2'])
    b.box((cx+w*.26,cy+d*.22,h+1.5),(6,5,3),M['frame'])
    for i in range(3):
        px=cx-w*.3+i*4.2
        b.box((px,cy+d*.27,h+1.1),(3.2,3.8,2.0),M['metal'])
        b.cylinder((px,cy+d*.27,h+2.12),1.05,.08,M['frame'],12)
    if solar:
        for i in range(max(2,int((w-14)/5.5))):
            for j in range(2):
                x=cx-w/2+7+i*5.5; y=cy-d/2+8+j*5.8
                b.box((x,y,h+.5),(4.6,4.4,.34),M['solar'])
                b.box((x,y,h+.73),(.045,4.4,.015),M['frame'])
                b.box((x,y,h+.73),(4.6,.045,.015),M['frame'])

def office(name,cx,cy,w,d,h,floors,wall='wall',fins=False):
    b=Batch(name,C_BUILD)
    b.box((cx,cy,.6),(w+4,d+4,1.15),M['paving'])
    b.box((cx,cy,h/2+.45),(w,d,h),M[wall])
    story=h/floors
    for f in range(floors):
        z=.7+story*f+story*.53; wh=story*.64
        for side in (-1,1):
            for i in range(int((w-4)/3.8)):
                x=cx-w/2+3.5+i*3.8
                b.box((x,cy+side*(d/2+.045),z),(2.9,.13,wh),M['glass2' if (i+f)%5==0 else 'glass'])
            for i in range(int((d-4)/3.8)):
                y=cy-d/2+3.5+i*3.8
                b.box((cx+side*(w/2+.045),y,z),(.13,2.85,wh),M['glass'])
        if f:
            for side in (-1,1):b.box((cx,cy+side*(d/2+.19),story*f+.5),(w+.5,.6,.25),M['frame'])
    if fins:
        for i in range(int(w/5)):
            x=cx-w/2+2+i*5
            b.box((x,cy-d/2-.65,h/2+.7),(.34,1.3,h-1.5),M['wall2'])
    # Recessed entrance and a practical canopy.
    b.box((cx,cy-d/2-.2,2.5),(6,.22,4.2),M['glass'])
    b.box((cx,cy-d/2-2.7,4.9),(10,6,.38),M['frame'])
    for x in (cx-4.4,cx+4.4):b.cylinder((x,cy-d/2-4.4,2.4),.12,4.8,M['metal'],8)
    roof_details(b,cx,cy,w,d,h+.45)
    ob=b.make(.065);ob['type']='Building'; ob['height_m']=h; ob['purpose']=name
    return ob

def warehouse(name,cx,cy,w,d,h):
    b=Batch(name,C_BUILD)
    b.box((cx,cy,.6),(w+2,d+2,1.0),M['paving'])
    b.box((cx,cy,h/2+.5),(w,d,h),M['wall2'])
    z=h+.5; ridge=2.4
    vs=[(cx-w/2-1,cy-d/2-1,z),(cx+w/2+1,cy-d/2-1,z),(cx-w/2-1,cy,z+ridge),(cx+w/2+1,cy,z+ridge),(cx-w/2-1,cy+d/2+1,z),(cx+w/2+1,cy+d/2+1,z)]
    b.mesh(vs,[(0,1,3,2),(2,3,5,4)],M['roof'])
    for x in [cx-w/2+2+i*6 for i in range(int((w-4)/6)+1)]:
        for side in (-1,1):b.box((x,cy+side*(d/2+.03),h*.53),(.2,.25,h*.96),M['frame'])
        linebox((x,cy-d/2),(x,cy+d/2),.11,z+.16,M['frame'],b,height=.08)
    for i in range(7):
        x=cx-w/2+11+i*(w-22)/6
        b.box((x,cy-d/2-.1,3.5),(4.8,.22,5.8),M['metal'])
        for j in range(6):b.box((x,cy-d/2-.24,1.1+j*.84),(4.65,.045,.035),M['frame'])
        b.box((x,cy-d/2-1.2,.8),(6,2.5,.8),M['paving'])
    for side in (-1,1):b.box((cx,cy+side*(d/2+.09),h-2.1),(w-9,.17,1.5),M['glass'])
    for i in range(9):
        for j in (0,1):b.box((cx-w/2+10+i*11.8,cy+8+j*6,z+ridge*.55),(9.5,4.2,.24),M['solar'])
    ob=b.make(.04);ob['purpose']=name;ob['height_m']=h+ridge

progress('Building distinct logistics, research, emergency and operations blocks')
warehouse('B01 Distribution warehouse',-181,55,120,48,12)
warehouse('B02 Logistics and maintenance warehouse',-181,132,120,42,10.5)
office('B03 Research office A',-47,86,40,48,35,9,fins=True)
office('B04 Research office B',17,115,31,72,28,7,wall='wall2')
office('B05 Emergency service and medical logistics',164,136,110,43,19,4)
office('B06 Technical support laboratory',112,50,41,52,16,4)
office('B07 Flight operations station',-181,-52,100,31,10.5,2)
office('B08 Park operations centre',158,-75,85,49,25,6,fins=True)
office('B09 Equipment service centre',124,-148,44,23,8.5,2,wall='wall2')
# A stepped upper volume and shaded terrace make the operations building legible.
b=Batch('B08 Upper conference pavilion and terrace',C_BUILD)
b.box((146,-70,30),(48,30,9),M['wall'])
b.box((146,-85.06,30),(43,.12,6.4),M['glass'])
b.box((121.94,-70,30),(.12,25,6.4),M['glass'])
b.box((146,-70,34.7),(50,32,.45),M['frame'])
roof_details(b,146,-70,48,30,34.5,False)
for x in (180,187,194):b.box((x,-72,27),(0.22,32,3),M['metal'])
for y in (-87,-80,-73,-66,-59):b.box((187,y,28.55),(18,.3,.25),M['wood'])
b.make(.06)

def pad(name,x,y,r,color):
    fac.cylinder((x,y,.56),r+3,.36,M['paving'],64)
    fac.cylinder((x,y,.75),r,.045,M['road'],64)
    # Eight discrete perimeter marks give an operational, non-glowing pad.
    for i in range(24):
        a=i*math.tau/24; rr=r-1.1
        fac.box((x+rr*math.cos(a),y+rr*math.sin(a),.81),(1.2,.28,.025),M[color],a+math.pi/2)
    for dx in (-2.1,2.1):fac.box((x+dx,y,.83),(.65,6.2,.04),M[color])
    fac.box((x,y,.83),(4.85,.7,.04),M[color])
    # Low protective bollards outside the pad clearance.
    for dx,dy in [(-r-3,-r-3),(r+3,-r-3),(-r-3,r+3),(r+3,r+3)]:
        fac.cylinder((x+dx,y+dy,1.1),.18,1.5,M['metal'],8)
    return name

for i,x in enumerate((-225,-181,-137)):pad(f'P0{i+1}',x,-117,13,'teal')
pad('E01',203,45,19,'gold')
# Charging and storage are outside the landing pads.
for x in (-217,-204,-191):
    fac.box((x,-158,1.35),(8,5,2.1),M['frame'])
    fac.box((x,-160.55,1.45),(6.8,.1,1.6),M['metal'])
fac.box((-159,-154,2.4),(28,8,4.2),M['wall2'])
fac.box((-159,-154,4.65),(29,9,.32),M['roof'])
for x in (-231,-121):
    fac.cylinder((x,-74,3.3),.23,6,M['metal'],10)
    fac.box((x,-74,6.2),(2.2,1.5,.3),M['frame'])

def car(x,y,angle=0,tone='car',truck=False):
    b=Batch('_vehicle_temp',C_FAC)
    if truck:
        b.box((0,1.3,2.0),(2.9,8.8,3.1),M['car']);b.box((0,-4.15,1.35),(2.7,2.5,2.5),M[tone])
        b.box((0,-5.43,1.85),(2.2,.1,1.05),M['glass'])
        wheels=[(-1.35,-4),(1.35,-4),(-1.4,2.8),(1.4,2.8),(-1.4,4.1),(1.4,4.1)]
        radius=.51
    else:
        b.box((0,0,.8),(1.92,4.6,1.15),M[tone]);b.box((0,.05,1.49),(1.68,2.35,.55),M[tone])
        b.box((0,-1.14,1.48),(1.6,.1,.55),M['glass']);b.box((0,1.21,1.48),(1.6,.1,.53),M['glass'])
        for sx in (-1,1):b.box((sx*.85,.05,1.49),(.03,2.18,.42),M['glass'])
        wheels=[(-.9,-1.45),(.9,-1.45),(-.9,1.45),(.9,1.45)];radius=.3
    for wx,wy in wheels:b.cylinder((wx,wy,radius+.12),radius,.24,M['rubber'],12,'X')
    co,si=math.cos(angle),math.sin(angle)
    vs=[(x+v[0]*co-v[1]*si,y+v[0]*si+v[1]*co,v[2]+.35) for v in b.v]
    k=len(vehicles.v);vehicles.v.extend(vs)
    for f,mi in zip(b.f,b.mi):
        m=b.materials[mi]
        if m not in vehicles.materials:vehicles.materials.append(m)
        vehicles.f.append(tuple(k+i for i in f));vehicles.mi.append(vehicles.materials.index(m))

for x in (-220,-185,-151):car(x,21,tone='car2',truck=True)
for x in (-208,-161):car(x,95,truck=True)
for side in (-1,1):
    for j in range(14):
        y=-162+j*7
        # Marked parking bays aligned with the service access aisle.
        x=231+side*12
        markings.box((x,y,.455),(5.5,.1,.022),M['white'])
        if j%4!=2:car(x,y+3.2,math.pi/2,tone='car2' if j%3==0 else 'car')

progress('Adding landscape, rainwater garden and support facilities')

# Entry connections and a small gatehouse.
for x,y,w,d in [(68,-197,14,32),(-289,-5,32,16),(289,101,32,10)]:
    paved(x,y,w+3,d+1);all_road_rects.append((x,y,w,d))
fac.box((88,-197,1.75),(5.5,7,3.2),M['wall'])
fac.box((88,-200.55,2.05),(4.5,.12,1.7),M['glass'])
fac.box((85.2,-197,2.05),(.12,5.6,1.7),M['glass'])
fac.box((88,-197,3.5),(6.5,8,.25),M['roof'])
fac.box((73,-197,1.2),(5.4,.13,.14),M['white'])

# Courtyard planting beds and roofless public spaces.
for x,y,w,d in [(-11,35,55,22),(-49,137,40,19),(159,-113,98,10),(255,147,11,50),(98,161,15,12)]:
    grass(x,y,w,d)
    for side in (-1,1):fac.box((x,y+side*d/2,.6),(w,.35,.55),M['paving'])
grass(-29,-54,110,36)
# Organic stormwater pond with a shallow stone border.
pond=[]
for i in range(72):
    a=i*math.tau/72
    pond.append((-24+47*math.cos(a)*(1+.06*math.sin(3*a)),-119+32*math.sin(a),.35))
outer=[(-24+(x+24)*1.10,-119+(y+119)*1.13,.30) for x,y,z in pond]
land.mesh(outer,[tuple(range(len(outer)))],M['paving'])
land.mesh(pond,[tuple(range(len(pond)))],M['water'])
# Walkway and a short raised bridge crossing the narrow end of the basin.
linebox((-76,-165),(46,-165),3.0,.30,M['paving'],land,.14)
linebox((46,-165),(46,-35),3.0,.30,M['paving'],land,.14)
linebox((-74,-75),(45,-75),3.0,.30,M['paving'],land,.14)
for j in range(28):fac.box((4,-145+j*2.0,.91),(3.3,1.82,.34),M['wood'])
for sx in (2.15,5.85):
    for j in range(10):fac.cylinder((sx,-145+j*5.5,1.35),.07,1.45,M['metal'],6)
    linebox((sx,-146),(sx,-92),.1,2.02,M['metal'],fac,.12)

# Shared tree meshes keep the site lightweight and editable.
tree_meshes=[]
for variant in range(3):
    vs=[(0,0,1.04)]; n=12; rings=6
    for j in range(1,rings):
        phi=math.pi*j/rings
        for i in range(n):
            theta=math.tau*i/n
            rr=math.sin(phi)*(1+random.uniform(-.12,.12))
            vs.append((rr*math.cos(theta),rr*math.sin(theta),math.cos(phi)*(1+random.uniform(-.08,.08))))
    vs.append((0,0,-.95)); bottom=len(vs)-1
    fs=[]
    for i in range(n):fs.append((0,1+i,1+(i+1)%n))
    for j in range(rings-2):
        s=1+j*n;t=s+n
        for i in range(n):fs.append((s+i,t+i,t+(i+1)%n,s+(i+1)%n))
    last=1+(rings-2)*n
    for i in range(n):fs.append((last+i,bottom,last+(i+1)%n))
    me=bpy.data.meshes.new('Canopy shared geometry '+str(variant));me.from_pydata(vs,[],fs);me.update()
    me.materials.append(M['leaf'+str(variant+1)])
    for p in me.polygons:p.use_smooth=True
    tree_meshes.append(me)

treecount=0
def tree(x,y,r=4,h=8):
    global treecount
    treecount+=1
    fac.cylinder((x,y,2.5),.24,4.8,M['trunk'],8)
    ob=bpy.data.objects.new(f'Tree {treecount:03}',tree_meshes[treecount%3]);C_LAND.objects.link(ob)
    ob.location=(x,y,h-.4);ob.scale=(r,r*.91,h*.53);ob.rotation_euler[2]=random.random()*math.tau

for x in range(-285,291,25):
    if abs(x-68)>15:tree(x,-202,3.7,7.7)
    tree(x,202,4.5,9)
for y in range(-165,175,25):
    if abs(y+5)>17:tree(-291,y,4.1,8.5)
    if abs(y-101)>16:tree(291,y,4.0,8.5)
for y in (-150,-120,-90,-55,24,55,88,131,164):
    tree(82,y,3.1,7.2)
for y in (-146,-109,-71,-35,28,61,97,145):tree(-81,y,3.6,8)
for x in (-235,-200,-163,-130,-45,-8,32,132,171,210,248):tree(x,168,3.9,8.2)
for x,y,r,h in [(-63,-56,4.2,8),(-29,-53,4.5,8.8),(7,-52,3.8,7.8),(30,-43,4.3,8.4),(-68,-89,3,7),(-73,-142,4.1,8.2),(-46,-167,3.3,7),(25,-157,4.8,9),(37,-101,3.6,7.5),(-50,145,3.4,7.4),(-10,39,3.7,8),(11,36,3.1,7.1),(142,-115,3,7),(177,-115,3,7),(228,153,3.3,8)]:tree(x,y,r,h)

# Benches, low shrubs and conventional daylight light poles.
for x,y in [(-43,-76),(-5,-76),(44,-122),(-49,33),(17,35),(147,-111),(169,-111)]:
    fac.box((x,y,.95),(3.3,.72,.15),M['wood'])
    fac.box((x,y+.35,1.4),(3.3,.12,.85),M['wood'])
    for dx in (-1.22,1.22):fac.box((x+dx,y,.58),(.12,.5,.62),M['metal'])
for x,y in [(-66,-49),(-39,-45),(0,-44),(29,-54),(146,-110),(172,-110),(-52,143)]:
    for j in range(4):fac.cylinder((x+j*1.1,y,.95),.72,1.0,M['grass2'],8,r2=.61)
for x in range(-242,260,55):
    for y in (-16,7):
        fac.cylinder((x,y,3.5),.11,6.6,M['metal'],8)
        fac.box((x,y,6.7),(1.7,.52,.16),M['frame'])
for y in (-146,-91,-34,31,88,143):
    fac.cylinder((59,y,3.5),.11,6.6,M['metal'],8)
    fac.box((59,y,6.7),(.52,1.7,.16),M['frame'])

# Boundary fence segments leave the actual gates clear.
for y in (-208,208):
    for x in range(-292,290,12):
        if y<0 and 52<x<88:continue
        fac.cylinder((x,y,.9),.075,1.55,M['metal'],6)
        fac.box((x+5.8,y,1.3),(11.6,.07,.08),M['metal'])
        fac.box((x+5.8,y,.65),(11.6,.05,.055),M['metal'])
for x in (-298,298):
    for y in range(-198,198,12):
        if (x<0 and abs(y+5)<17) or (x>0 and abs(y-101)<14):continue
        fac.cylinder((x,y,.9),.075,1.55,M['metal'],6)
        fac.box((x,y+5.8,1.3),(.07,11.6,.08),M['metal'])

union_surface(all_road_rects,[],.12,.435,M['road'],site)
union_surface(paving_rects,all_road_rects,.12,.50,M['paving'],site)
site_ob=site.make()
site_ob['type']='Site';site_ob['units']='metres'
for i,(x,y,z) in enumerate(markings.v):
    if 206<x<256 and -170<y<-59:markings.v[i]=(x,y,z+.066)
markings.make()
land.make(.07)
fac.make(.035)
vehicles_ob=vehicles.make(.045)
vehicles_ob.location.z=.03

def text_object(name,body,loc,size,matl,rotation=(0,0,0),align='CENTER'):
    cu=bpy.data.curves.new(name,'FONT');cu.body=body;cu.size=size;cu.align_x=align
    cu.extrude=.005;cu.resolution_u=4
    ob=bpy.data.objects.new(name,cu);C_FAC.objects.link(ob);ob.location=loc;ob.rotation_euler=rotation;cu.materials.append(matl)
    # Converted lettering is portable into GLB and has no external font dependency.
    bpy.context.view_layer.objects.active=ob;ob.select_set(True)
    bpy.ops.object.convert(target='MESH');ob.select_set(False)
    return ob

# Small wayfinding identifiers engraved onto the actual operating areas.
for i,x in enumerate((-225,-181,-137)):
    text_object('Pad identifier '+str(i+1),'P0'+str(i+1),(x,-137,.84),2.0,M['white'])
text_object('Emergency pad identifier','E01',(203,20,.85),2.7,M['white'])
text_object('Campus entry wordmark','AIRORDER',(68,-189,.49),2.1,M['white'])
text_object('Logistics building number','01',(-234,30.65,7.5),2.0,M['white'],(math.pi/2,0,0),align='LEFT')
text_object('Warehouse building number','02',(-234,110.7,6.8),2.0,M['white'],(math.pi/2,0,0),align='LEFT')

progress('Creating separate illustrative airspace and drone assets')
def curve(name,pts,color,r=.34):
    cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.resolution_u=16
    cu.bevel_depth=r;cu.bevel_resolution=3
    sp=cu.splines.new('BEZIER');sp.bezier_points.add(len(pts)-1)
    for p,v in zip(sp.bezier_points,pts):p.co=v;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    ob=bpy.data.objects.new(name,cu);C_AIR.objects.link(ob);cu.materials.append(M[color])
    ob['data_status']='ILLUSTRATIVE ONLY';ob['purpose']=name
    return ob

curve('Delivery route sample',[(-225,-117,3),(-239,-69,43),(-211,-1,62),(-73,1,65),(80,8,65),(184,41,49),(203,45,3)],'teal',.42)
curve('Inspection route sample',[(-244,-132,87),(-248,41,89),(-236,157,91),(-5,166,93),(236,151,91),(246,-126,90),(84,-159,89)],'violet',.32)
curve('Emergency route sample',[(299,154,111),(263,121,100),(235,77,58),(203,45,3)],'gold',.42)

def drone(name,loc,color,angle=0):
    b=Batch(name,C_AIR)
    b.box((0,0,0),(1.9,1.4,.62),M['dark'])
    b.box((0,.05,.41),(1.3,.95,.28),M[color])
    for sx in (-1,1):
        for sy in (-1,1):
            # Multi-rotor arms and open, non-glowing rotor discs.
            x,y=sx*1.65,sy*1.4
            length=math.hypot(x,y)
            b.box((x/2,y/2,.0),(length,.2,.16),M['metal'],math.atan2(y,x))
            b.cylinder((x,y,.15),.18,.38,M['dark'],12)
            b.box((x,y,.37),(1.62,.12,.035),M['metal'],sy*.25)
    for sy in (-1,1):
        b.box((0,sy*.73,-.55),(2.0,.1,.1),M['metal'])
        for sx in (-1,1):b.box((sx*.7,sy*.73,-.38),(.09,.09,.35),M['metal'])
    b.box((0,0,-.38),(.9,.75,.28),M['wall'])
    ob=b.make(.04);ob.location=loc;ob.rotation_euler[2]=angle
    ob['data_status']='ILLUSTRATIVE ONLY';ob['display_scale']='Actual geometry approximately 4.9 m rotor span'
    return ob

drone('D03 Delivery sample',(-53,1,65),'teal',.04)
drone('P02 Inspection sample',(-246,33,89),'violet',math.pi/2)
drone('E01 Emergency sample',(267,125,101),'gold',-2.3)

progress('Setting architectural lighting and cameras')
world=bpy.data.worlds.new('Soft overcast daylight');scene.world=world;world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Color'].default_value=(.55,.65,.74,1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5

def area(name,loc,power,size,color=(1,1,1)):
    li=bpy.data.lights.new(name,'AREA');li.energy=power;li.shape='DISK';li.size=size;li.color=color
    ob=bpy.data.objects.new(name,li);C_VIEW.objects.link(ob);ob.location=loc
    ob.rotation_euler=(Vector((0,0,0))-ob.location).to_track_quat('-Z','Y').to_euler()
    return ob
sun_data=bpy.data.lights.new('Late morning sun','SUN');sun_data.energy=2.0;sun_data.angle=.19
sun=bpy.data.objects.new('Late morning sun',sun_data);C_VIEW.objects.link(sun)
sun.rotation_euler=(math.radians(26),math.radians(-24),math.radians(-32))
area('Large soft sky fill',(-150,-120,350),180000,420,(.85,.92,1))
area('Warm architectural bounce',(80,210,200),100000,320,(1,.91,.8))

def camera(name,loc,target,ortho):
    d=bpy.data.cameras.new(name);d.type='ORTHO';d.ortho_scale=ortho;d.lens=52;d.clip_end=5000
    ob=bpy.data.objects.new(name,d);C_VIEW.objects.link(ob);ob.location=loc
    ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
    return ob
overview=camera('01 Overview / 园区总览',(650,-880,790),(0,0,22),795)
detail=camera('02 Operations detail / 运控与起降设施',(340,-500,285),(-43,-60,17),435)
top=camera('03 Site plan / 总平面',(0,0,850),(0,0,0),700)
scene.camera=overview
scene.render.engine='CYCLES'
scene.cycles.samples=64
scene.cycles.use_denoising=True
scene.cycles.use_adaptive_sampling=True
scene.cycles.adaptive_threshold=.035
scene.cycles.max_bounces=6
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type='OPTIX';prefs.get_devices()
    gpu_found=False
    for dev in prefs.devices:
        dev.use=(dev.type!='CPU');gpu_found=gpu_found or dev.use
    if gpu_found:scene.cycles.device='GPU'
except Exception as exc:print('Device fallback:',exc,flush=True)
scene.render.resolution_x=2048;scene.render.resolution_y=1536;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
scene.render.film_transparent=True
scene.view_settings.view_transform='AgX'
try:scene.view_settings.look='AgX - Medium High Contrast'
except Exception:pass
scene.view_settings.exposure=.1

# A ready-to-explore material viewport is saved with the project.
for screen in ([bpy.context.window.screen] if GUI_AUTHORING else bpy.data.screens):
    for ar in screen.areas:
        if ar.type=='VIEW_3D':
            sp=ar.spaces.active
            sp.clip_end=5000
            sp.overlay.show_floor=False;sp.overlay.show_axis_x=False;sp.overlay.show_axis_y=False
            sp.overlay.show_extras=False
            sp.shading.type='MATERIAL'
            sp.shading.use_scene_world=False;sp.shading.use_scene_lights=False
            sp.region_3d.view_distance=750
            sp.region_3d.view_location=(0,0,20)
            sp.region_3d.view_rotation=overview.rotation_euler.to_quaternion()
            sp.region_3d.view_perspective='CAMERA'
            sp.region_3d.view_camera_zoom=9
bpy.ops.object.select_all(action='DESELECT')
bpy.context.view_layer.objects.active=None

blend=OUT/'空序-示范园区-v1.blend'
def save_project():
    if GUI_AUTHORING:
        # Write only the new scene and its dependencies, excluding other work
        # that may be open in the user's original Blender window.
        bpy.data.libraries.write(str(blend),{scene},fake_user=True,compress=True)
    else:
        bpy.ops.wm.save_as_mainfile(filepath=str(blend))
save_project()
progress('Exporting the clean campus GLB without illustrative flight routes')
baseobjects=[ob for col in BASE_COLS for ob in col.objects]
for ob in baseobjects:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(MODEL/'airorder-campus-v1.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_apply=False,export_animations=False,export_extras=True)
bpy.ops.object.select_all(action='DESELECT')
stats={'site_dimensions_m':[600,420],'building_groups':len(C_BUILD.objects),'trees':treecount,'base_objects':len(baseobjects),'source_vertices':sum(len(ob.data.vertices) for ob in baseobjects if ob.type=='MESH'),'unique_meshes':len(set(ob.data for ob in baseobjects if ob.type=='MESH')),'glb_bytes':(MODEL/'airorder-campus-v1.glb').stat().st_size,'status':'Concept model; sample airspace has not been validated for flight.'}
(OUT/'model-info.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2),encoding='utf-8')
progress('Rendering architectural overview')
scene.camera=overview
scene.render.filepath=str(ROOT/'空序-园区总览-v2.png')
try:
    bpy.ops.render.render(write_still=True)
except RuntimeError:
    progress('GPU render unavailable; retrying the overview with CPU Cycles')
    scene.cycles.device='CPU'
    scene.cycles.samples=32
    bpy.ops.render.render(write_still=True)
progress('Rendering operations and landing-area detail')
scene.camera=detail;scene.render.resolution_x=1920;scene.render.resolution_y=1280
scene.render.filepath=str(ROOT/'空序-园区近景-v2.png')
bpy.ops.render.render(write_still=True)
scene.camera=overview;scene.render.resolution_x=2048;scene.render.resolution_y=1536
scene.render.filepath=str(ROOT/'空序-园区总览-v2.png')
save_project()
stats['build_seconds']=round(time.time()-started,1)
(OUT/'model-info.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2),encoding='utf-8')
progress('COMPLETE: editable Blender project, clean GLB and two renders saved')
