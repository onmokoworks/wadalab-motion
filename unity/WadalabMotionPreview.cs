// Uses the actual local CLWFK service; no independent replacement font algorithm.
// Attach to a GameObject. Scene view Gizmos show the generated outline boundaries.
using System;
using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

public class WadalabMotionPreview : MonoBehaviour {
 [Serializable] public class Point { public string kind; public float x,y; }
 [Serializable] public class Outline { public Point[] points; }
 [Serializable] public class Frame { public float time; public Outline[] outlines; }
 [Serializable] public class Glyph { public string character,sourceCharacter,error,message; public Frame[] frames; }
 [Serializable] public class AnimationData { public string source,revision,text; public int steps; public Glyph[] glyphs; }
 [Serializable] public class Request { public string text="永",style="mincho";public float weight=8,serif=1,contrast=.4f;public int steps=60; }
 public Request parameters=new Request();
 [Range(0,1)] public float time=1;
 public float size=2;
 public AnimationData data;
 public event Action<AnimationData> Generated;
 IEnumerator Start(){yield return Generate();}
 public IEnumerator Generate(){
  using(var request=new UnityWebRequest("http://127.0.0.1:4184/api/generate","POST")){
   request.uploadHandler=new UploadHandlerRaw(Encoding.UTF8.GetBytes(JsonUtility.ToJson(parameters)));
   request.downloadHandler=new DownloadHandlerBuffer();request.SetRequestHeader("Content-Type","application/json");request.timeout=60;
   yield return request.SendWebRequest();
   if(request.result!=UnityWebRequest.Result.Success){Debug.LogError(request.error+" "+request.downloadHandler.text);yield break;}
   data=JsonUtility.FromJson<AnimationData>(request.downloadHandler.text);Generated?.Invoke(data);
  }
 }
 Vector3 World(Vector2 p,int index){return transform.TransformPoint(new Vector3((p.x/400-.5f+index*1.1f)*size,(.5f-p.y/400)*size,0));}
 static Vector2 V(Point p){return new Vector2(p.x,p.y);}
 void OnDrawGizmos(){
  if(data==null||data.glyphs==null)return;Gizmos.color=Color.black;
  for(int gi=0;gi<data.glyphs.Length;gi++){
   var glyph=data.glyphs[gi];if(glyph.frames==null||glyph.frames.Length==0)continue;
   var frame=glyph.frames[Mathf.RoundToInt(Mathf.Clamp01(time)*(glyph.frames.Length-1))];
   foreach(var contour in frame.outlines){var p=contour.points;if(p.Length==0)continue;var previous=V(p[0]);
    for(int i=1;i<p.Length;){
     if(p[i].kind=="angle"){Gizmos.DrawLine(World(previous,gi),World(V(p[i]),gi));previous=V(p[i++]);}
     else{if(i+1>=p.Length)break;var start=previous;var a=V(p[i]);var b=V(p[i+1]);var end=V(i+2<p.Length?p[i+2]:p[0]);for(int j=1;j<=16;j++){float t=j/16f,u=1-t;var q=u*u*u*start+3*u*u*t*a+3*u*t*t*b+t*t*t*end;Gizmos.DrawLine(World(previous,gi),World(q,gi));previous=q;}i+=3;}
    }Gizmos.DrawLine(World(previous,gi),World(V(p[0]),gi));
   }
  }
 }
}
