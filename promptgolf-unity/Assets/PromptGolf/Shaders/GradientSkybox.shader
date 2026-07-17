Shader "PromptGolf/GradientSkybox"
{
    Properties
    {
        _TopColor ("Top Color", Color) = (0.22, 0.48, 0.85, 1)
        _HorizonColor ("Horizon Color", Color) = (0.80, 0.91, 0.97, 1)
        _BottomColor ("Bottom Color", Color) = (0.45, 0.70, 0.80, 1)
        _SunColor ("Sun Color", Color) = (1.0, 0.96, 0.84, 1)
        _SunDirection ("Sun Direction", Vector) = (0.3, 0.6, 0.3, 0)
        _SunSize ("Sun Sharpness", Range(1, 1000)) = 420
    }
    SubShader
    {
        Tags { "Queue"="Background" "RenderType"="Background" "PreviewType"="Skybox" }
        Cull Off ZWrite Off
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            fixed4 _TopColor, _HorizonColor, _BottomColor, _SunColor;
            float4 _SunDirection;
            float _SunSize;
            struct appdata { float4 vertex : POSITION; };
            struct v2f { float4 pos : SV_POSITION; float3 dir : TEXCOORD0; };
            v2f vert(appdata v) { v2f o; o.pos = UnityObjectToClipPos(v.vertex); o.dir = v.vertex.xyz; return o; }
            fixed4 frag(v2f i) : SV_Target
            {
                float3 d = normalize(i.dir);
                float t = d.y;
                fixed3 col;
                if (t > 0) col = lerp(_HorizonColor.rgb, _TopColor.rgb, pow(saturate(t), 0.55));
                else col = lerp(_HorizonColor.rgb, _BottomColor.rgb, saturate(-t * 2.5));
                float3 sunDir = normalize(_SunDirection.xyz);
                float sd = saturate(dot(d, sunDir));
                col += _SunColor.rgb * pow(sd, _SunSize) * 1.2;
                col += _SunColor.rgb * pow(sd, 8.0) * 0.15;
                return fixed4(col, 1);
            }
            ENDCG
        }
    }
}
