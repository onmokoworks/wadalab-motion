import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FONT = ROOT / 'web/font/wlmaru2004emoji.ttf'
OUTLINES = ROOT / 'web/font/ascii-outlines.json'
OUTPUT = ROOT / 'web/font/clock-skeletons.json'

def thin(binary):
    image = np.pad(binary.astype(np.uint8), 1)
    while True:
        changed = False
        for phase in (0, 1):
            p = image[1:-1, 1:-1]
            n = [image[:-2,1:-1], image[:-2,2:], image[1:-1,2:], image[2:,2:], image[2:,1:-1], image[2:,:-2], image[1:-1,:-2], image[:-2,:-2]]
            count = sum(n)
            transitions = sum((n[i] == 0) & (n[(i+1)%8] == 1) for i in range(8))
            if phase == 0:
                removable = (p == 1) & (count >= 2) & (count <= 6) & (transitions == 1) & ((n[0]*n[2]*n[4]) == 0) & ((n[2]*n[4]*n[6]) == 0)
            else:
                removable = (p == 1) & (count >= 2) & (count <= 6) & (transitions == 1) & ((n[0]*n[2]*n[6]) == 0) & ((n[0]*n[4]*n[6]) == 0)
            if removable.any():
                p[removable] = 0
                changed = True
        if not changed:
            return image[1:-1,1:-1].astype(bool)

NEIGHBORS = [(dx,dy) for dy in (-1,0,1) for dx in (-1,0,1) if dx or dy]
def rdp(points, epsilon):
    if len(points) < 3: return points
    a,b=np.array(points[0],float),np.array(points[-1],float); line=b-a
    if np.linalg.norm(line) < 1e-8: distances=[np.linalg.norm(np.array(p)-a) for p in points]
    else: distances=[abs(line[0]*(np.array(p)-a)[1]-line[1]*(np.array(p)-a)[0])/np.linalg.norm(line) for p in points]
    index=int(np.argmax(distances))
    if distances[index] <= epsilon: return [points[0],points[-1]]
    return rdp(points[:index+1],epsilon)[:-1]+rdp(points[index:],epsilon)

def trace(skeleton):
    pixels={(int(x),int(y)) for y,x in np.argwhere(skeleton)}
    adjacent={}
    for p in pixels:
        near=[]
        for dx,dy in NEIGHBORS:
            q=(p[0]+dx,p[1]+dy)
            if q not in pixels: continue
            if dx and dy and ((p[0]+dx,p[1]) in pixels or (p[0],p[1]+dy) in pixels): continue
            near.append(q)
        adjacent[p]=near
    nodes={p for p,near in adjacent.items() if len(near)!=2}; visited=set(); paths=[]
    def edge(a,b): return tuple(sorted((a,b)))
    def walk(start,next_point):
        path=[start,next_point];visited.add(edge(start,next_point));previous,current=start,next_point
        while current not in nodes:
            choices=[p for p in adjacent[current] if p!=previous and edge(current,p) not in visited]
            if not choices: break
            following=choices[0];visited.add(edge(current,following));path.append(following);previous,current=current,following
        return path
    for start in nodes:
        for following in adjacent[start]:
            if edge(start,following) not in visited: paths.append(walk(start,following))
    for start in pixels:
        for following in adjacent[start]:
            if edge(start,following) in visited: continue
            path=walk(start,following)
            while path[-1]!=start:
                current=path[-1];choices=[p for p in adjacent[current] if edge(current,p) not in visited]
                if not choices: break
                following=choices[0];visited.add(edge(current,following));path.append(following)
            paths.append(path)
    return [rdp(path,2.2) for path in paths if len(path)>2]

data=json.loads(OUTLINES.read_text('utf-8'))
rows={row[0]:row for row in data['glyphs']}
font=ImageFont.truetype(str(FONT),800)
result=[]
for character in '0123456789:':
    bbox=font.getbbox(character);pad=24
    image=Image.new('L',(bbox[2]-bbox[0]+pad*2,bbox[3]-bbox[1]+pad*2),0)
    ImageDraw.Draw(image).text((pad-bbox[0],pad-bbox[1]),character,font=font,fill=255)
    binary=np.asarray(image)>127;skeleton=thin(binary); paths=trace(skeleton)
    commands=rows[character][1]; values=[float(value) for contour in commands for command in contour for value in command[1:]]
    xs=values[0::2];ys=values[1::2];inset=7.8125
    target=(min(xs)+inset,min(ys)+inset,max(xs)-inset,max(ys)-inset)
    sy,sx=np.where(skeleton)
    if not len(sx) and character==':':
        result.append([character,[[{'x':99,'y':132},{'x':101,'y':132}],[{'x':99,'y':279},{'x':101,'y':279}]],15.625,rows[character][2]])
        continue
    if not len(sx): raise RuntimeError(f'{character}: thinning removed all {int(binary.sum())} source pixels')
    source=(sx.min(),sy.min(),sx.max(),sy.max())
    mapped=[]
    for path in paths:
        mapped_path=[{'x':target[0]+(x-source[0])/(source[2]-source[0] or 1)*(target[2]-target[0]),'y':target[1]+(y-source[1])/(source[3]-source[1] or 1)*(target[3]-target[1])} for x,y in path]
        length=sum(((b['x']-a['x'])**2+(b['y']-a['y'])**2)**.5 for a,b in zip(mapped_path,mapped_path[1:]))
        if length>=12: mapped.append(mapped_path)
    result.append([character,mapped,15.625,rows[character][2]])
OUTPUT.write_text(json.dumps({'source':'wlmaru2004emoji.ttf','method':'offline medial-axis thinning fixed as vectors','glyphs':result},separators=(',',':')),'utf-8')
print(json.dumps({'glyphs':len(result),'paths':sum(len(row[1]) for row in result)}))
