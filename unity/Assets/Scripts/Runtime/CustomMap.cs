using UnityEngine;
namespace ZeroStar
{
    [DisallowMultipleComponent]
    public sealed class CustomMap : MonoBehaviour
    {
        public string displayName;
        public string template = "1-2";
        public bool blank;
        public string destination = "town";
    }
}
