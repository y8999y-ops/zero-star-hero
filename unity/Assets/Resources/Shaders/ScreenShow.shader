// 把 PostFx 的結果（RenderTexture）畫到螢幕：掛在 PixelScreen 的 SpriteRenderer 上，
// 形狀、位置、上下翻轉照舊由 SpriteRenderer 決定，只是顏色改從 _PostTex 拿（最近點，不模糊）。
Shader "Hidden/ZeroStar/ScreenShow"
{
    Properties
    {
        _MainTex ("Sprite", 2D) = "white" {}
        _PostTex ("Post", 2D) = "black" {}
    }
    SubShader
    {
        Tags { "Queue" = "Transparent" "RenderType" = "Transparent" "IgnoreProjector" = "True" "PreviewType" = "Plane" "CanUseSpriteAtlas" = "False" }
        Cull Off ZWrite Off Lighting Off
        Blend One OneMinusSrcAlpha
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma target 2.0
            #include "UnityCG.cginc"
            sampler2D _PostTex;
            struct appdata { float4 vertex : POSITION; float2 uv : TEXCOORD0; float4 color : COLOR; };
            struct v2f { float4 pos : SV_POSITION; float2 uv : TEXCOORD0; float4 color : COLOR; };
            v2f vert(appdata v) { v2f o; o.pos = UnityObjectToClipPos(v.vertex); o.uv = v.uv; o.color = v.color; return o; }
            fixed4 frag(v2f i) : SV_Target { fixed4 c = tex2D(_PostTex, i.uv) * i.color; c.rgb *= c.a; return c; }
            ENDCG
        }
    }
}
