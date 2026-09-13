using System;

// Same forward-kinematics and weighted vertex equations as web/fold-core.js.
// Load a precomputed rig; this class has no browser, font or Unity dependency.
namespace WadalabMotion {
 [Serializable] public class FoldBone {
  public int parent;
  public float ax, ay, bx, by, length, restAngle, localAngle, foldAngle;
 }
 [Serializable] public class FoldVertex {
  public float x, y, u, v;
  public int[] bones;
  public float[] weights;
 }
 [Serializable] public class FoldRig {
  public FoldBone[] bones;
  public FoldVertex[] vertices;
  public int[] indices;
  public int width, height;
 }
 public struct FoldTransform {
  public double x, y, angle, cos, sin, ax, ay;
 }
 public static class FoldPose {
  static double Wrap(double a) { return Math.Atan2(Math.Sin(a), Math.Cos(a)); }
  public static double EntryAmount(double secondsSinceEntry, double duration = 1.35) {
   return 1 - Math.Max(0, Math.Min(1, secondsSinceEntry / duration));
  }
  public static void Evaluate(FoldRig rig, double amount, FoldTransform[] transforms, float[] xy, double bend = 1) {
   if (rig.bones.Length == 0) return;
   double t = Math.Max(0, Math.Min(1, amount)); t = t * t * (3 - 2 * t) * bend;
   var root = rig.bones[0];
   transforms[0] = new FoldTransform { x = root.bx, y = root.by, ax = root.ax, ay = root.ay, cos = 1 };
   for (int i = 1; i < rig.bones.Length; i++) {
    var b = rig.bones[i]; var p = transforms[b.parent];
    double angle = p.angle + b.localAngle + Wrap(b.foldAngle - b.localAngle) * t;
    transforms[i] = new FoldTransform {
     x = p.x + Math.Cos(angle) * b.length, y = p.y + Math.Sin(angle) * b.length,
     angle = angle, cos = Math.Cos(angle - b.restAngle), sin = Math.Sin(angle - b.restAngle), ax = p.x, ay = p.y
    };
   }
   for (int i = 0; i < rig.vertices.Length; i++) {
    var v = rig.vertices[i]; double x = 0, y = 0;
    for (int k = 0; k < v.bones.Length; k++) {
     var b = rig.bones[v.bones[k]]; var p = transforms[v.bones[k]];
     double dx = v.x - b.ax, dy = v.y - b.ay, w = v.weights[k];
     x += (p.ax + p.cos * dx - p.sin * dy) * w;
     y += (p.ay + p.sin * dx + p.cos * dy) * w;
    }
    xy[i * 2] = (float)x; xy[i * 2 + 1] = (float)y;
   }
  }
 }
}
