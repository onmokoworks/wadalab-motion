"""Build motion centerlines from sampled TTF vector boundaries (no raster input).

Requires NumPy and SciPy. Boundary samples are used only in this offline export;
the browser receives polylines and animates them directly.
"""
import json
from pathlib import Path
import numpy as np
from scipy.spatial import Voronoi, cKDTree

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'web/font/ascii-outlines.json'

def contours(commands):
    points = []
    current = None
    for command in commands:
        kind = command[0]
        if kind == 'M':
            current = np.array(command[1:3], float)
            points.append(current)
        elif kind in ('L', 'Q'):
            end = np.array(command[-2:], float)
            count = max(2, int(np.linalg.norm(end-current) / 1.2) + 1)
            if kind == 'Q':
                control = np.array(command[1:3], float)
                count = max(count, int((np.linalg.norm(control-current)+np.linalg.norm(end-control))/1.2)+1)
            for t in np.linspace(0, 1, count+1)[1:]:
                point = current*(1-t)+end*t if kind == 'L' else current*(1-t)**2+control*2*t*(1-t)+end*t*t
                points.append(point)
            current = end
    return np.array(points)

def inside(points, rings):
    result = np.zeros(len(points), dtype=bool)
    x, y = points[:, 0], points[:, 1]
    for ring in rings:
        for a, b in zip(ring, np.roll(ring, -1, axis=0)):
            if abs(b[1]-a[1]) < 1e-10:
                continue
            result ^= ((a[1] > y) != (b[1] > y)) & (x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])
    return result

def simplify(points, epsilon=.45):
    if len(points) < 3:
        return points
    a, b = points[0], points[-1]
    delta = b-a
    if np.linalg.norm(delta) < 1e-8:
        distances = np.linalg.norm(points-a, axis=1)
    else:
        distances = abs(delta[0]*(points[:, 1]-a[1])-delta[1]*(points[:, 0]-a[0]))/np.linalg.norm(delta)
    index = int(np.argmax(distances))
    if distances[index] <= epsilon:
        return np.array([a, b])
    return np.concatenate([simplify(points[:index+1], epsilon)[:-1], simplify(points[index:], epsilon)])

def export(paths):
    rings = [contours(commands) for commands in paths]
    boundary = np.unique(np.concatenate(rings).round(6), axis=0)
    voronoi = Voronoi(boundary)
    vertices = voronoi.vertices
    tree = cKDTree(boundary)
    radius = tree.query(vertices)[0]
    valid = inside(vertices, rings) & (radius > .65)
    adjacency = {}
    candidates = [(a, b) for a, b in voronoi.ridge_vertices if a >= 0 and b >= 0 and valid[a] and valid[b]]
    middle_inside = inside(np.array([(vertices[a]+vertices[b])/2 for a, b in candidates]).reshape(-1, 2), rings)
    for (a, b), keep in zip(candidates, middle_inside):
        if not keep:
            continue
        adjacency.setdefault(a, set()).add(b)
        adjacency.setdefault(b, set()).add(a)
    # Discard short medial branches at corners and caps, not the long strokes.
    for _ in range(8):
        removed = set()
        for start in list(adjacency):
            if len(adjacency[start]) != 1:
                continue
            route = [start]
            previous, node = start, next(iter(adjacency[start]))
            distance = np.linalg.norm(vertices[node]-vertices[start])
            while len(adjacency[node]) == 2:
                route.append(node)
                target = next(v for v in adjacency[node] if v != previous)
                distance += np.linalg.norm(vertices[target]-vertices[node])
                previous, node = node, target
            if len(adjacency[node]) > 2 and distance < max(4, radius[node]*2.2):
                removed.update(route)
        if not removed:
            break
        for node in removed:
            for neighbor in adjacency[node]:
                adjacency[neighbor].discard(node)
        for node in removed:
            del adjacency[node]
    routes, used = [], set()
    starts = sorted(adjacency, key=lambda node: (len(adjacency[node]) == 2, vertices[node][1], vertices[node][0]))
    for start in starts:
        for neighbor in sorted(adjacency[start]):
            if tuple(sorted((start, neighbor))) in used:
                continue
            route = [start]
            previous, node = start, neighbor
            while True:
                used.add(tuple(sorted((previous, node))))
                route.append(node)
                if len(adjacency[node]) != 2 or node == start:
                    break
                target = next(v for v in adjacency[node] if v != previous)
                if tuple(sorted((node, target))) in used:
                    break
                previous, node = node, target
            routes.append(route)
    # Join tangent continuations across branches; detach crossbars naturally.
    merged = [vertices[route] for route in routes if len(route) >= 2]
    while True:
        best = None
        for i, a in enumerate(merged):
            for j in range(i+1, len(merged)):
                b = merged[j]
                for flip_a in (False, True):
                    aa = a[::-1] if flip_a else a
                    for flip_b in (False, True):
                        bb = b[::-1] if flip_b else b
                        if np.linalg.norm(aa[-1]-bb[0]) > .01:
                            continue
                        va = aa[-1]-aa[max(0, len(aa)-8)]
                        vb = bb[min(len(bb)-1, 7)]-bb[0]
                        dot = np.dot(va, vb)/(np.linalg.norm(va)*np.linalg.norm(vb)+1e-9)
                        if dot > .7 and (best is None or dot > best[0]):
                            best = (dot, i, j, aa, bb)
        if best is None:
            break
        _, i, j, a, b = best
        merged[i] = np.concatenate([a, b[1:]])
        merged.pop(j)
    width = float(np.median([radius[node]*2 for node in adjacency])) if adjacency else 6
    out = []
    for points in merged:
        if np.sum(np.linalg.norm(np.diff(points, axis=0), axis=1)) < max(1, width*.4):
            continue
        out.append(simplify(points).round(4).tolist())
    dots = []
    for ring in rings:
        size = np.ptp(ring, axis=0)
        center = (ring.min(axis=0)+ring.max(axis=0))/2
        if max(size) < 80 and min(size)/max(size) > .85 and inside(center.reshape(1, 2), rings)[0]:
            out = [path for path in out if not inside(np.array(path), [ring]).all()]
            out.append([center.round(4).tolist(), (center+np.array([.01, 0])).round(4).tolist()])
            dots.append([len(out)-1, round(float(np.mean(size)), 4)])
    return out, round(width, 4), dots

data = json.loads(SOURCE.read_text(encoding='utf-8'))
rows = []
for character, paths, advance in data['glyphs']:
    if not character.isascii() or not paths:
        continue
    centerlines, width, dots = export(paths)
    if not centerlines:
        raise ValueError(f'No centerlines for {character}')
    rows.append([character, centerlines, width, advance, dots])
(ROOT / 'web/font/alpha-centerlines.json').write_text(json.dumps({'source': 'TTF vector boundary Voronoi medial routes', 'glyphs': rows}, separators=(',', ':')), encoding='utf-8')
print(json.dumps({'characters': len(rows), 'paths': sum(len(row[1]) for row in rows), 'raster': False}))
