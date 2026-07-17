using UnityEngine;

namespace PromptGolf
{
    /// <summary>
    /// 코드 생성 파티클/연출 이펙트.
    /// WebGL 안전성: Sprites/Default(Always Included) + 프로시저럴 도트 텍스처만 사용.
    /// </summary>
    public static class Effects
    {
        static Texture2D dotTex;

        static Texture2D GetDotTexture()
        {
            if (dotTex != null) return dotTex;
            const int s = 32;
            dotTex = new Texture2D(s, s, TextureFormat.RGBA32, false);
            for (int y = 0; y < s; y++)
            {
                for (int x = 0; x < s; x++)
                {
                    float dx = (x - s / 2f + 0.5f) / (s / 2f);
                    float dy = (y - s / 2f + 0.5f) / (s / 2f);
                    float d = Mathf.Sqrt(dx * dx + dy * dy);
                    float a = Mathf.Clamp01(1f - d);
                    dotTex.SetPixel(x, y, new Color(1f, 1f, 1f, a * a));
                }
            }
            dotTex.Apply();
            return dotTex;
        }

        /// <summary>스크립트 Emit 전용 버스트 파티클 시스템 생성.</summary>
        public static ParticleSystem CreateBurstSystem(string name, float gravity)
        {
            var go = new GameObject(name);
            var ps = go.AddComponent<ParticleSystem>();
            ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);

            var main = ps.main;
            main.playOnAwake = false;
            main.loop = false;
            main.gravityModifier = gravity;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.maxParticles = 400;

            var emission = ps.emission;
            emission.enabled = false;

            var rol = ps.rotationOverLifetime;
            rol.enabled = true;
            rol.z = new ParticleSystem.MinMaxCurve(-6.28f, 6.28f);

            var r = go.GetComponent<ParticleSystemRenderer>();
            Shader sh = Shader.Find("Sprites/Default");
            if (sh != null)
            {
                var mat = new Material(sh);
                mat.mainTexture = GetDotTexture();
                r.material = mat;
            }
            return ps;
        }

        /// <summary>착지 임팩트: 존별 색(잔디/모래) 파편 버스트.</summary>
        public static void EmitImpact(ParticleSystem ps, Vector3 pos, float speed, LandingZone zone)
        {
            if (ps == null) return;
            Color baseColor;
            switch (zone)
            {
                case LandingZone.Bunker:
                case LandingZone.Beach:
                    baseColor = new Color(0.95f, 0.88f, 0.66f); break;
                case LandingZone.Green:
                case LandingZone.Fairway:
                    baseColor = new Color(0.45f, 0.75f, 0.35f); break;
                default:
                    baseColor = new Color(0.35f, 0.60f, 0.30f); break;
            }

            int count = Mathf.Clamp(Mathf.RoundToInt(speed * 2.5f), 16, 48);
            var ep = new ParticleSystem.EmitParams();
            for (int i = 0; i < count; i++)
            {
                Vector3 dir = new Vector3(Random.Range(-1f, 1f), Random.Range(0.7f, 1.6f), Random.Range(-1f, 1f)).normalized;
                ep.position = pos + Vector3.up * 0.1f;
                ep.velocity = dir * Random.Range(3f, 3f + speed * 0.5f);
                ep.startColor = Color.Lerp(baseColor, Color.white, Random.value * 0.5f);
                ep.startSize = Random.Range(0.35f, 0.95f);
                ep.startLifetime = Random.Range(0.5f, 1.0f);
                ps.Emit(ep, 1);
            }
            ps.Play();
        }

        static readonly Color[] ConfettiColors = new Color[]
        {
            new Color(1f, 0.85f, 0.2f),   // 골드
            new Color(1f, 0.35f, 0.55f),  // 핑크
            new Color(0.3f, 0.85f, 1f),   // 시안
            new Color(0.55f, 1f, 0.4f),   // 라임
            new Color(1f, 0.6f, 0.25f),   // 오렌지
            Color.white,
        };

        /// <summary>홀인 컨페티 분수.</summary>
        public static void EmitConfetti(ParticleSystem ps, Vector3 pos, int count)
        {
            if (ps == null) return;
            var ep = new ParticleSystem.EmitParams();
            for (int i = 0; i < count; i++)
            {
                Vector3 dir = new Vector3(Random.Range(-0.6f, 0.6f), 1f, Random.Range(-0.6f, 0.6f)).normalized;
                ep.position = pos;
                ep.velocity = dir * Random.Range(7f, 14f);
                ep.startColor = ConfettiColors[Random.Range(0, ConfettiColors.Length)];
                ep.startSize = Random.Range(0.35f, 0.65f);
                ep.startLifetime = Random.Range(1.8f, 3.2f);
                ps.Emit(ep, 1);
            }
            ps.Play();
        }
    }

    /// <summary>깃발 펄럭임 — CPU 버텍스 애니메이션 (91버텍스, WebGL 부담 없음).</summary>
    public class FlagFlutter : MonoBehaviour
    {
        public float amplitude = 0.18f;
        public float frequency = 3.2f;
        public float speed = 5.5f;

        Mesh mesh;
        Vector3[] baseVerts;
        Vector3[] work;
        float width = 2.2f;

        void Awake()
        {
            var mf = GetComponent<MeshFilter>();
            mesh = mf.mesh; // 인스턴스화
            baseVerts = mesh.vertices;
            work = new Vector3[baseVerts.Length];
            for (int i = 0; i < baseVerts.Length; i++)
                if (baseVerts[i].x > width) width = baseVerts[i].x;
        }

        void Update()
        {
            float t = Time.time * speed;
            for (int i = 0; i < baseVerts.Length; i++)
            {
                Vector3 v = baseVerts[i];
                float w = Mathf.Clamp01(v.x / width); // 폴에서 멀수록 진폭 증가
                v.z += Mathf.Sin(v.x * frequency + t) * amplitude * w
                     + Mathf.Sin(v.y * 4f + t * 1.35f) * amplitude * 0.4f * w;
                work[i] = v;
            }
            mesh.vertices = work;
            mesh.RecalculateNormals();
        }
    }
}
