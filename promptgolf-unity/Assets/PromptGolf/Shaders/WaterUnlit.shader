Shader "PromptGolf/WaterUnlit"
{
    Properties
    {
        _Color ("Color", Color) = (0.15, 0.62, 0.72, 0.72)
    }
    SubShader
    {
        Tags { "Queue"="Transparent" "RenderType"="Transparent" }
        Blend SrcAlpha OneMinusSrcAlpha
        ZWrite Off
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            fixed4 _Color;

            struct appdata
            {
                float4 vertex : POSITION;
            };

            struct v2f
            {
                float4 pos : SV_POSITION;
                float3 worldPos : TEXCOORD0;
            };

            v2f vert (appdata v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.worldPos = mul(unity_ObjectToWorld, v.vertex).xyz;
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                float w = sin(i.worldPos.x * 0.15 + _Time.y * 0.8) * 0.5
                        + sin(i.worldPos.z * 0.11 + _Time.y * 0.6) * 0.5;
                fixed3 c = _Color.rgb * (0.9 + 0.12 * w);
                return fixed4(c, _Color.a);
            }
            ENDCG
        }
    }
}
