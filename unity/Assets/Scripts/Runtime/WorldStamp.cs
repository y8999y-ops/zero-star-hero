using UnityEngine;
namespace ZeroStar
{
    public enum StampKind { Terrain, Decor, Solid, Platform, Back, Far, Mid, Near, Fg, UpFar, UpMid, Torch, Crystal, Start, Exit, Chest, Altar, Feature, Hazard, Cloud, Tuft, Box, SmallCrystal, Puddle, Hang, Critter, Swarm, Resident, EnemySpawn, PaintedGround, PaintedPlatform, RewardChest }
    // 圖片左上角為原點，互動物件則以遊戲內的腳底或效果掛點為原點。
    public sealed class WorldStamp : MonoBehaviour
    {
        public StampKind kind;
        [HideInInspector] public Vector2Int size = new Vector2Int(32,8);
        [HideInInspector] public string rewardId;
        [Tooltip("物件的不透明像素會遮住固定場景光源。")] public bool blocksLight;
        [Tooltip("火星碰到這張圖片的不透明像素時會消失。")] public bool blocksSparks;
        [HideInInspector] public int index;
        [HideInInspector] public Vector2Int original;
        [HideInInspector] public string role;
        [HideInInspector] public int[] lights;
        public Vector2Int Position(Transform root)
        {
            Vector3 p=root.InverseTransformPoint(transform.position);
            return new Vector2Int(Mathf.RoundToInt(p.x),Mathf.RoundToInt(-p.y));
        }
    }
}
