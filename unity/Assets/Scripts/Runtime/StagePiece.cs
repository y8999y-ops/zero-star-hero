using UnityEngine;

namespace ZeroStar
{
    public enum SceneryLayer { Sky, Playfield, Foreground }

    [RequireComponent(typeof(SpriteRenderer))]
    public sealed class StagePiece : MonoBehaviour
    {
        public SceneryLayer layer;
        [Range(0, 1.5f)] public float parallax = 1;
        [Tooltip("背景水平漂移速度（像素／秒）。")] public float drift;
        [Min(0)] public int repeatWidth;
        public bool receivesLight = true;
        public bool blocksLight;
        public bool blocksSparks;
        [Tooltip("光源與火星相對於圖片原點的位置，Y 向上。")] public Vector2 effectAnchor;
        [Range(0, 96)] public int lightRadius;
        public Color lightColor = new Color(1, 0.65f, 0.2f);
        public bool sparks;
    }
}
