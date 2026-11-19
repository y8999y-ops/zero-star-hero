using System;
using System.Linq;
using System.Reflection;
using UnityEditor;
using UnityEngine;
using ZeroStar;
using ZeroStar.Tests;

// 僅用於移植版面提交時的對照；創作者之後手調版面會自然產生像素差異。
public static class AuditWorldLayouts
{
    public static void Run()
    {
        var townFields=new[]{"MAIN","EMIT","FAR","MID","FG"};
        Array[] Snapshot() => townFields.Select(name => (Array)((Array)typeof(TownArt).GetField(name,BindingFlags.Static|BindingFlags.NonPublic).GetValue(null)).Clone()).ToArray();
        TownArt.Reset();
        var old=Snapshot();TownArt.Reset(WorldComposition.Load("town"));var current=Snapshot();
        for(int i=0;i<old.Length;i++)
        {
            if(old[i] is uint[] a && !a.SequenceEqual((uint[])current[i]))throw new Exception("Town image mismatch: "+townFields[i]);
            if(old[i] is byte[] b && !b.SequenceEqual((byte[])current[i]))throw new Exception("Town emission mismatch");
        }
        foreach(var id in WorldLayoutEditor.Stages.Where(q=>q!="town"))
        {
            var a=Baked.Level(id);var b=Baked.Level(id);WorldComposition.Load(id).Apply(b);
            if(!a.PF.SequenceEqual(b.PF) || !a.PFE.SequenceEqual(b.PFE)){int first=Array.FindIndex(Enumerable.Range(0,a.PF.Length).ToArray(),i=>a.PF[i]!=b.PF[i] || a.PFE[i]!=b.PFE[i]);throw new Exception($"Playfield/mask mismatch: {id} at {first%a.W},{first/a.W} {a.PF[first]:x8}/{b.PF[first]:x8} masks {a.PFE[first]}/{b.PFE[first]} pixels {Enumerable.Range(0,a.PF.Length).Count(i=>a.PF[i]!=b.PF[i])}");} 
            if(a.PropLights.Count!=b.PropLights.Count || a.Torches.Count!=b.Torches.Count || a.BigCrystals.Count!=b.BigCrystals.Count)throw new Exception($"Lights or props mismatch: {id} ({a.PropLights.Count}/{b.PropLights.Count})");
            foreach(var pair in new[]{(a.Back,b.Back),(a.Far,b.Far),(a.Mid,b.Mid),(a.Near,b.Near),(a.Fg,b.Fg),(a.UpFar,b.UpFar),(a.UpMid,b.UpMid)})
                if(pair.Item1.Px!=null && !pair.Item1.Px.SequenceEqual(pair.Item2.Px)) throw new Exception("Layer mismatch: "+id);
        }
        Debug.Log("[WorldAudit] PASS original terrain pixels, emissive masks, seven scenery layers, lights, crystals and torches");
        WorldLayoutEditor.Verify();
    }
}

