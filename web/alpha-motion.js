import {clamp, smooth} from './fold-core.js';

const delta = (a, b) => Math.atan2(Math.sin(a-b), Math.cos(a-b));
const distance = (a, b) => Math.hypot(b.x-a.x, b.y-a.y);

export function prepareAlphaMotion(paths, width, dots=[]) {
  const dotWidths=new Map(dots);
  const strokes = paths.map((path, id) => {
    let points = path.map(([x, y]) => ({x, y}));
    // Prefer a straight endpoint as the fixed root of open curves.
    const endpointTurn = p => {
      const take = p.slice(0, Math.min(p.length, 5));
      const angles = take.slice(1).map((q, i) => Math.atan2(q.y-take[i].y, q.x-take[i].x));
      return angles.slice(1).reduce((sum, a, i) => sum+Math.abs(delta(a, angles[i])), 0);
    };
    if (distance(points[0], points.at(-1)) > width*2 && endpointTurn([...points].reverse()) < endpointTurn(points)) points.reverse();
    const lengths = points.slice(1).map((p, i) => distance(points[i], p));
    const angles = points.slice(1).map((p, i) => Math.atan2(p.y-points[i].y, p.x-points[i].x));
    const turns = angles.map((angle, i) => i ? delta(angle, angles[i-1]) : 0);
    const turning = turns.reduce((sum, value) => sum+Math.abs(value), 0);
    return {id, dotWidth:dotWidths.get(id), motionPath: points, lengths, angles, turns, curve: turning > .65, length: lengths.reduce((a, b) => a+b, 0)};
  });
  // Attach a shorter route to a longer stem at its actual source junction.
  const ordered = [...strokes].sort((a, b) => b.length-a.length);
  for (let i=1; i<ordered.length; i++) {
    const stroke = ordered[i];
    let best = null;
    for (const parent of ordered.slice(0, i)) for (const endpoint of [0, stroke.motionPath.length-1]) {
      const root = stroke.motionPath[endpoint];
      for (let index=0; index<parent.motionPath.length; index++) {
        const gap = distance(root, parent.motionPath[index]);
        if (gap < .1 && (!best || gap < best.gap)) best = {parent: parent.id, index, endpoint, gap};
      }
    }
    if (best) stroke.attachment = best;
  }
  return {strokes, ordered, width};
}

export function alphaMotionPaths(rig, amount) {
  const progress = clamp(1-amount), growth = smooth(clamp(progress/.58));
  const posed = new Map();
  for (const stroke of rig.ordered) {
    const source = stroke.motionPath;
    if (progress >= .999999) { posed.set(stroke.id, source.map(p => ({...p}))); continue; }
    const points = [{...source[0]}];
    let angle = stroke.angles[0];
    const phase = clamp((progress-.06)/.86);
    for (let i=0; i<stroke.lengths.length; i++) {
      // A curvature wave travels from the root to the tip. Inflections stay
      // signed, so S-shaped routes open as one continuous stroke as well.
      const position = i/Math.max(1, stroke.lengths.length-1);
      const local = stroke.curve ? smooth(clamp(phase*1.3-position*.3)) : smooth(progress);
      angle += stroke.turns[i]*local;
      const previous = points.at(-1), length = stroke.lengths[i]*growth;
      points.push({x:previous.x+Math.cos(angle)*length, y:previous.y+Math.sin(angle)*length});
    }
    if (stroke.attachment) {
      const {parent, index, endpoint} = stroke.attachment;
      const target = posed.get(parent)[index], root = points[endpoint];
      const dx = target.x-root.x, dy = target.y-root.y;
      for (const point of points) { point.x += dx; point.y += dy; }
    }
    posed.set(stroke.id, points);
  }
  return rig.strokes.map(stroke => ({stroke:stroke.id, order:0, fixed:false, pivot:stroke.motionPath[0], path:posed.get(stroke.id),dotWidth:stroke.dotWidth,opacity:stroke.dotWidth?growth:1}));
}
