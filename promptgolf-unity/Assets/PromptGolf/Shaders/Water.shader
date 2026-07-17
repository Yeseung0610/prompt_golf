Shader "PromptGolf/Water"
{
    Properties
    {
        _ShallowColor ("Shallow", Color) = (0.36, 0.86, 0.84, 0.5)
        _DeepColor ("Deep", Color) = (0.03, 0.35, 0.54, 0.93)
        _HorizonColor ("Horizon Tint", Color) = (0.75, 0.90, 0.98, 1)
        _FoamColor ("Foam", Color) = (1, 1, 1, 1)
    }
    SubShader
    {
        Tags { "RenderType"="Transparent" "Queue"="Transparent" "RenderPipeline"="UniversalPipeline" }
        Blend SrcAlpha OneMinusSrcAlpha
        ZWrite Off
        Cull Off
        Pass
        {
            Name "WaterForward"
            Tags { "LightMode"="UniversalForward" }
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fog
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

            CBUFFER_START(UnityPerMaterial)
            float4 _ShallowColor;
            float4 _DeepColor;
            float4 _HorizonColor;
            float4 _FoamColor;
            CBUFFER_END

            struct Attributes { float4 positionOS : POSITION; float4 color : COLOR; };
            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 positionWS : TEXCOORD0;
                float depth01 : TEXCOORD1;
                float fogFactor : TEXCOORD2;
            };

            float hash21(float2 p) { p = frac(p * float2(123.34, 345.45)); p += dot(p, p + 34.345); return frac(p.x * p.y); }
            float noise2(float2 p)
            {
                float2 i = floor(p); float2 f = frac(p);
                float a = hash21(i), b = hash21(i + float2(1,0)), c = hash21(i + float2(0,1)), d = hash21(i + float2(1,1));
                float2 u = f * f * (3.0 - 2.0 * f);
                return lerp(lerp(a,b,u.x), lerp(c,d,u.x), u.y);
            }

            Varyings vert(Attributes IN)
            {
                Varyings OUT;
                float3 ws = TransformObjectToWorld(IN.positionOS.xyz);
                float t = _Time.y;
                // 미세한 버텍스 웨이브
                ws.y += sin(ws.x * 0.11 + t * 1.1) * 0.05 + sin(ws.z * 0.09 + t * 0.8) * 0.05;
                OUT.positionWS = ws;
                OUT.positionCS = TransformWorldToHClip(ws);
                OUT.depth01 = IN.color.r;
                OUT.fogFactor = ComputeFogFactor(OUT.positionCS.z);
                return OUT;
            }

            half4 frag(Varyings IN) : SV_Target
            {
                float2 wp = IN.positionWS.xz;
                float t = _Time.y;
                float depth01 = saturate(IN.depth01);

                // 사인 웨이브 조합 노멀 퍼터베이션 (저비용)
                float3 N = normalize(float3(
                    sin(wp.x * 0.5 + t * 1.6) * 0.08 + sin(wp.x * 1.7 - t * 2.3) * 0.05 + sin((wp.x + wp.y) * 0.9 + t * 1.9) * 0.03,
                    1.0,
                    sin(wp.y * 0.45 + t * 1.2) * 0.08 + sin(wp.y * 1.9 + t * 2.1) * 0.05 + sin((wp.y - wp.x) * 0.8 - t * 1.5) * 0.03));

                float3 V = normalize(_WorldSpaceCameraPos.xyz - IN.positionWS);
                Light mainLight = GetMainLight();

                // 수심 기반 색 + 프레넬 (수평선 반사 톤)
                float fres = pow(1.0 - saturate(dot(V, N)), 3.0);
                float3 col = lerp(_ShallowColor.rgb, _DeepColor.rgb, depth01);
                col = lerp(col, _HorizonColor.rgb, fres * 0.55);

                // 태양 스펙큘러 + 반짝임
                float3 H = normalize(mainLight.direction + V);
                float spec = pow(saturate(dot(N, H)), 180.0) * 1.4;
                col += mainLight.color.rgb * spec;
                float sparkle = noise2(wp * 2.2 + float2(t * 0.35, -t * 0.3));
                col += smoothstep(0.80, 0.96, sparkle) * 0.07;

                // 해안선 폼: 얕은 수심 + 애니메이션 노이즈 경계
                float foamNoise = noise2(wp * 1.6 + float2(t * 0.5, -t * 0.4));
                float shore = 1.0 - smoothstep(0.0, 0.30, depth01);
                float foam = smoothstep(0.45, 0.75, shore + foamNoise * 0.35 - 0.22);
                // 파도가 밀려오는 두 번째 폼 라인
                float waveLine = sin(depth01 * 14.0 - t * 2.2) * 0.5 + 0.5;
                foam += smoothstep(0.86, 0.99, waveLine) * shore * 0.6;
                foam = saturate(foam);
                col = lerp(col, _FoamColor.rgb, foam);

                float alpha = lerp(_ShallowColor.a, _DeepColor.a, depth01);
                alpha = max(alpha, foam * 0.95);

                col = MixFog(col, IN.fogFactor);
                return half4(col, alpha);
            }
            ENDHLSL
        }
    }
}
