using System;
using PixelFX;
using UnityEngine;

namespace ZeroStar
{
    /// 共用的畫布輸出。每個顯示端持有自己的貼圖，尺寸改變或關閉時一併釋放。
    public sealed class FramePresentation : IDisposable
    {
        public Texture2D Source { get; }
        public byte[] Pixels { get; }
        readonly byte[] padded;
        RenderTexture target;

        public FramePresentation(int width, int height)
        {
            Pixels = new byte[width * height * 4];
            padded = new byte[(width + 2) * (height + 2) * 4];
            Source = new Texture2D(width + 2, height + 2, TextureFormat.RGBA32, false)
            {
                name = "PixelScreen", hideFlags = HideFlags.HideAndDontSave,
                filterMode = FilterMode.Point, wrapMode = TextureWrapMode.Clamp
            };
        }

        public void Composite(Frame frame, Action<byte[]> postComposite)
        {
            frame.SoftLight = true;
            frame.Composite(Pixels, null, 0.8);
            postComposite?.Invoke(Pixels);
        }

        public Texture Upload(Frame frame)
        {
            for (int i=3; i<Pixels.Length; i+=4) Pixels[i]=255;
            PixelScreen.PadEdges(Pixels, padded, frame.W, frame.H);
            Source.SetPixelData(padded, 0);
            Source.Apply(false);
            return PostFx.Resolve(Source, frame, ref target);
        }

        public void Dispose()
        {
            if (target) { target.Release(); PostFx.ReleaseObject(target); target=null; }
            if (Source) PostFx.ReleaseObject(Source);
        }
    }
}
