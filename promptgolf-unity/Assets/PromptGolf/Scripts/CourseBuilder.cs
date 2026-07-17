using UnityEngine;
using UnityEngine.Rendering;

namespace PromptGolf
{
    /// <summary>
    /// 코스를 런타임 생성: URP 커스텀 지형 셰이더(노이즈 디테일/그림자/포그) 기반
    /// 버텍스 컬러 지형 메쉬, 존 경계 슈퍼샘플링 블렌딩, 워터 플레인, 깃발/홀, 티, 야자수.
    /// </summary>
    public static class CourseBuilder
    {
        // 존별 색상 (열대 해변 팔레트)
        static readonly Color FairwayColor = new Color(0.30f, 0.60f, 0.27f);
        static readonly Color FairwayColor2 = new Color(0.21f, 0.46f, 0.19f); // 모잉 줄무늬
        static readonly Color GreenColor = new Color(0.36f, 0.74f, 0.32f);
        static readonly Color RoughColor = new Color(0.14f, 0.40f, 0.18f);
        static readonly Color BunkerColor = new Color(0.93f, 0.86f, 0.62f);
        static readonly Color BeachColor = new Color(0.96f, 0.90f, 0.72f);
        static readonly Color SeabedColor = new Color(0.35f, 0.75f, 0.75f);
        static readonly Color ObColor = new Color(0.12f, 0.32f, 0.16f);
        static readonly Color HoleColor = new Color(0.05f, 0.12f, 0.06f);

        // 존 경계 블렌딩용 슈퍼샘플 오프셋
        static readonly Vector2[] SampleOffsets = new Vector2[]
        {
            new Vector2(0f, 0f),
            new Vector2(1.1f, 0f), new Vector2(-1.1f, 0f),
            new Vector2(0f, 1.1f), new Vector2(0f, -1.1f),
        };

        public static GameObject Build()
        {
            var root = new GameObject("Course");

            BuildTerrain(root.transform);
            BuildWater(root.transform);
            BuildFlag(root.transform);
            BuildTee(root.transform);
            BuildHoleCup(root.transform);
            BuildMountains(root.transform);
            BuildPalms(root.transform);

            return root;
        }

        static Material MakeLitMat(Color c)
        {
            // WebGL 스트리핑 대응: URP Lit 대신 항상 포함되는 경량 커스텀 셰이더 사용
            Shader s = Shader.Find("PromptGolf/SimpleLit");
            if (s == null) s = Shader.Find("Universal Render Pipeline/Lit");
            if (s == null) s = Shader.Find("Standard");
            var m = new Material(s);
            m.color = c;
            return m;
        }

        /// <summary>
        /// GameObject 프리미티브 생성 대체 헬퍼. 기존 방식은 Collider를 추가하는데
        /// 물리 미사용으로 Physics 모듈이 빌드에서 스트리핑되면 WebGL에서 실패한다.
        /// 빌트인 메쉬로 렌더러만 구성한다.
        /// </summary>
        public static GameObject CreatePrim(PrimitiveType type, string name)
        {
            string meshName;
            switch (type)
            {
                case PrimitiveType.Sphere: meshName = "Sphere.fbx"; break;
                case PrimitiveType.Cube: meshName = "Cube.fbx"; break;
                case PrimitiveType.Cylinder: meshName = "Cylinder.fbx"; break;
                case PrimitiveType.Quad: meshName = "Quad.fbx"; break;
                default: meshName = "Cube.fbx"; break;
            }
            var go = new GameObject(name);
            go.AddComponent<MeshFilter>().sharedMesh = Resources.GetBuiltinResource<Mesh>(meshName);
            go.AddComponent<MeshRenderer>();
            return go;
        }

        static void BuildTerrain(Transform parent)
        {
            const float minX = -180f, maxX = 150f;
            const float minZ = -40f, maxZ = 450f;
            const float step = 2.5f;

            int nx = Mathf.RoundToInt((maxX - minX) / step);
            int nz = Mathf.RoundToInt((maxZ - minZ) / step);
            int vertsX = nx + 1, vertsZ = nz + 1;

            var vertices = new Vector3[vertsX * vertsZ];
            var colors = new Color[vertsX * vertsZ];

            var flag = CourseData.Hole1.flagPosition;

            for (int iz = 0; iz < vertsZ; iz++)
            {
                for (int ix = 0; ix < vertsX; ix++)
                {
                    float x = minX + ix * step;
                    float z = minZ + iz * step;
                    float y = CourseData.GetVisualHeight(x, z);
                    int idx = iz * vertsX + ix;
                    vertices[idx] = new Vector3(x, y, z);
                    colors[idx] = BlendedZoneColor(x, z, flag);
                }
            }

            var triangles = new int[nx * nz * 6];
            int ti = 0;
            for (int iz = 0; iz < nz; iz++)
            {
                for (int ix = 0; ix < nx; ix++)
                {
                    int a = iz * vertsX + ix;
                    int b = a + 1;
                    int c = a + vertsX;
                    int d = c + 1;
                    triangles[ti++] = a; triangles[ti++] = c; triangles[ti++] = b;
                    triangles[ti++] = b; triangles[ti++] = c; triangles[ti++] = d;
                }
            }

            var mesh = new Mesh();
            mesh.indexFormat = IndexFormat.UInt32;
            mesh.vertices = vertices;
            mesh.colors = colors;
            mesh.triangles = triangles;
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();

            var go = new GameObject("Terrain");
            go.transform.SetParent(parent, false);
            var mf = go.AddComponent<MeshFilter>();
            mf.sharedMesh = mesh;
            var mr = go.AddComponent<MeshRenderer>();

            Shader terrainShader = Shader.Find("PromptGolf/Terrain");
            if (terrainShader == null) terrainShader = Shader.Find("PromptGolf/VertexColor");
            mr.sharedMaterial = terrainShader != null ? new Material(terrainShader) : MakeLitMat(FairwayColor);
            mr.shadowCastingMode = ShadowCastingMode.On;
            mr.receiveShadows = true;
        }

        /// <summary>존 경계 계단 현상을 줄이기 위해 주변 5점 색을 평균.</summary>
        static Color BlendedZoneColor(float x, float z, CoursePosition flag)
        {
            Color sum = Color.black;
            for (int i = 0; i < SampleOffsets.Length; i++)
                sum += ZoneColor(x + SampleOffsets[i].x, z + SampleOffsets[i].y, flag);
            return sum / SampleOffsets.Length;
        }

        static Color ZoneColor(float x, float z, CoursePosition flag)
        {
            // 홀 컵 (시각용 2.5m 디스크; 게임 홀 반경은 8m)
            float fdx = x - flag.x, fdz = z - flag.z;
            float flagDist = Mathf.Sqrt(fdx * fdx + fdz * fdz);
            if (flagDist <= 2.5f) return HoleColor;

            // 벙커 blob 시각화 (샷 로직과 동일 소스)
            float depth;
            if (CourseData.BunkerBlobSdf(x, z, out depth) < 0f) return BunkerColor;

            LandingZone zone = CourseData.GetLandingZone(x, z);
            switch (zone)
            {
                case LandingZone.Green: return GreenColor;
                case LandingZone.Fairway:
                    return (Mathf.FloorToInt(z / 12f) % 2 == 0) ? FairwayColor : FairwayColor2;
                case LandingZone.Bunker: return BunkerColor;
                case LandingZone.Beach: return BeachColor;
                case LandingZone.Water: return SeabedColor;
                case LandingZone.OB: return ObColor;
                default: return RoughColor;
            }
        }

        static void BuildWater(Transform parent)
        {
            Shader ws = Shader.Find("PromptGolf/Water");
            if (ws == null) ws = Shader.Find("PromptGolf/WaterUnlit");
            Material waterMat = ws != null ? new Material(ws)
                : MakeLitMat(new Color(0.15f, 0.6f, 0.7f, 0.7f));

            const float waterY = -0.3f;
            // 바다: 수평선까지 확장 (버텍스에 수심을 구워 해안선 폼 생성)
            CreateWaterMesh(parent, waterMat, "Ocean", -420f, -84f, -60f, 470f, 6f, waterY);
            // 라군: 고해상 그리드
            CreateWaterMesh(parent, waterMat, "Lagoon", 30f, 80f, 290f, 350f, 2f, waterY);
        }

        /// <summary>
        /// 수심을 버텍스 컬러 R에 구운 워터 그리드 메쉬 생성.
        /// 뎁스 텍스처 없이(WebGL 저비용) 셰이더에서 해안선 폼/수심 색을 계산할 수 있다.
        /// </summary>
        static void CreateWaterMesh(Transform parent, Material mat, string name,
            float minX, float maxX, float minZ, float maxZ, float step, float waterY)
        {
            int nx = Mathf.CeilToInt((maxX - minX) / step);
            int nz = Mathf.CeilToInt((maxZ - minZ) / step);
            int vertsX = nx + 1, vertsZ = nz + 1;

            var vertices = new Vector3[vertsX * vertsZ];
            var colors = new Color[vertsX * vertsZ];

            for (int iz = 0; iz < vertsZ; iz++)
            {
                for (int ix = 0; ix < vertsX; ix++)
                {
                    float x = minX + ix * step;
                    float z = minZ + iz * step;
                    // 지형 메쉬 서쪽 경계 밖은 깊은 바다로 취급
                    float terrainH = x < -165f ? -3f : CourseData.GetVisualHeight(x, z);
                    float depth01 = Mathf.Clamp01((waterY - terrainH) / 1.0f);
                    int idx = iz * vertsX + ix;
                    vertices[idx] = new Vector3(x, waterY, z);
                    colors[idx] = new Color(depth01, 0f, 0f, 1f);
                }
            }

            var triangles = new int[nx * nz * 6];
            int ti = 0;
            for (int iz = 0; iz < nz; iz++)
            {
                for (int ix = 0; ix < nx; ix++)
                {
                    int a = iz * vertsX + ix;
                    int b = a + 1;
                    int c = a + vertsX;
                    int d = c + 1;
                    triangles[ti++] = a; triangles[ti++] = c; triangles[ti++] = b;
                    triangles[ti++] = b; triangles[ti++] = c; triangles[ti++] = d;
                }
            }

            var mesh = new Mesh();
            mesh.indexFormat = IndexFormat.UInt32;
            mesh.vertices = vertices;
            mesh.colors = colors;
            mesh.triangles = triangles;
            mesh.RecalculateBounds();

            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var mr = go.AddComponent<MeshRenderer>();
            mr.sharedMaterial = mat;
            mr.shadowCastingMode = ShadowCastingMode.Off;
            mr.receiveShadows = false;
        }

        static void BuildFlag(Transform parent)
        {
            var flag = CourseData.Hole1.flagPosition;
            float h = CourseData.GetVisualHeight(flag.x, flag.z);

            var poleGo = CreatePrim(PrimitiveType.Cylinder, "FlagPole");
            poleGo.transform.SetParent(parent, false);
            poleGo.transform.position = new Vector3(flag.x, h + 3.5f, flag.z);
            poleGo.transform.localScale = new Vector3(0.15f, 3.5f, 0.15f);
            poleGo.GetComponent<MeshRenderer>().sharedMaterial = MakeLitMat(new Color(0.95f, 0.95f, 0.9f));

            // 펄럭이는 깃발 (그리드 메쉬 + FlagFlutter 버텍스 애니메이션)
            var flagGo = new GameObject("Flag");
            flagGo.transform.SetParent(parent, false);
            flagGo.transform.position = new Vector3(flag.x, h + 6.3f, flag.z);
            flagGo.AddComponent<MeshFilter>().sharedMesh = BuildFlagMesh(2.2f, 1.2f, 12, 6);
            var flagMr = flagGo.AddComponent<MeshRenderer>();
            flagMr.sharedMaterial = MakeLitMat(new Color(0.9f, 0.15f, 0.15f));
            flagGo.AddComponent<FlagFlutter>();
        }

        static Mesh BuildFlagMesh(float width, float height, int segX, int segY)
        {
            int vx = segX + 1, vy = segY + 1;
            var verts = new Vector3[vx * vy];
            for (int iy = 0; iy < vy; iy++)
                for (int ix = 0; ix < vx; ix++)
                    verts[iy * vx + ix] = new Vector3(
                        (float)ix / segX * width,
                        (float)iy / segY * height - height / 2f,
                        0f);
            var tris = new int[segX * segY * 6];
            int t = 0;
            for (int iy = 0; iy < segY; iy++)
            {
                for (int ix = 0; ix < segX; ix++)
                {
                    int a = iy * vx + ix, b = a + 1, c = a + vx, d = c + 1;
                    tris[t++] = a; tris[t++] = c; tris[t++] = b;
                    tris[t++] = b; tris[t++] = c; tris[t++] = d;
                }
            }
            var mesh = new Mesh();
            mesh.vertices = verts;
            mesh.triangles = tris;
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            return mesh;
        }

        static void BuildTee(Transform parent)
        {
            var tee = CourseData.Hole1.teePosition;
            float h = CourseData.GetVisualHeight(tee.x, tee.z);

            var go = CreatePrim(PrimitiveType.Cube, "TeeMarker");
            go.transform.SetParent(parent, false);
            go.transform.position = new Vector3(tee.x, h + 0.1f, tee.z - 1.5f);
            go.transform.localScale = new Vector3(4f, 0.2f, 1f);
            go.GetComponent<MeshRenderer>().sharedMaterial = MakeLitMat(Color.white);
        }

        // ── 배경 산맥 (원본 CourseProps.MountainRange 포팅) ──
        static void BuildMountains(Transform parent)
        {
            // 원본: 코스 뒤(z=600, 550) 두 겹의 로우폴리 산맥
            CreateMountainRange(parent, 600f, 700f, 18, new Color(0.227f, 0.478f, 0.333f)); // #3a7a55
            CreateMountainRange(parent, 550f, 500f, 12, new Color(0.290f, 0.541f, 0.376f)); // #4a8a60
        }

        static void CreateMountainRange(Transform parent, float z, float spread, int count, Color baseColor)
        {
            var matA = MakeLitMat(baseColor * 0.85f);
            var matB = MakeLitMat(baseColor * 0.97f);

            var range = new GameObject("MountainRange_z" + z);
            range.transform.SetParent(parent, false);

            for (int i = 0; i < count; i++)
            {
                float t = count > 1 ? (float)i / (count - 1) : 0.5f;
                float x = (t - 0.5f) * spread;
                // 원본 의사난수 높이 재현
                float v = Mathf.Sin(i * 12.9898f) * 43758.5453f;
                float h = 60f + Mathf.Abs(v - Mathf.Floor(v)) * 50f;
                float r = 60f + (i % 3) * 15f;

                var peak = new GameObject("Peak_" + i);
                peak.transform.SetParent(range.transform, false);
                peak.transform.localPosition = new Vector3(x, -8f, z + (i % 2) * -25f);
                peak.AddComponent<MeshFilter>().sharedMesh = BuildConeMesh(r, h, 5);
                var mr = peak.AddComponent<MeshRenderer>();
                mr.sharedMaterial = (i % 2 == 0) ? matA : matB;
                mr.shadowCastingMode = ShadowCastingMode.Off;
            }
        }

        /// <summary>플랫 셰이딩 로우폴리 콘 (면별 버텍스 분리). 베이스 y=0, 꼭짓점 y=height.</summary>
        static Mesh BuildConeMesh(float radius, float height, int sides)
        {
            var verts = new Vector3[sides * 3];
            var tris = new int[sides * 3];
            for (int i = 0; i < sides; i++)
            {
                float a0 = (float)i / sides * Mathf.PI * 2f;
                float a1 = (float)(i + 1) / sides * Mathf.PI * 2f;
                int b = i * 3;
                verts[b + 0] = new Vector3(Mathf.Cos(a0) * radius, 0f, Mathf.Sin(a0) * radius);
                verts[b + 1] = new Vector3(0f, height, 0f);
                verts[b + 2] = new Vector3(Mathf.Cos(a1) * radius, 0f, Mathf.Sin(a1) * radius);
                tris[b + 0] = b; tris[b + 1] = b + 1; tris[b + 2] = b + 2;
            }
            var mesh = new Mesh();
            mesh.vertices = verts;
            mesh.triangles = tris;
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            return mesh;
        }
        // ── 야자수 (프로시저럴: 휘어진 트렁크 + 처지는 잎 + 코코넛) ──
        static readonly Vector2[] PalmSpots = new Vector2[]
        {
            new Vector2(-52, 40), new Vector2(-56, 110), new Vector2(-50, 180),
            new Vector2(-54, 250), new Vector2(-48, 320),
            new Vector2(52, 60), new Vector2(58, 130), new Vector2(55, 250), new Vector2(48, 415),
        };

        static Mesh trunkMesh;
        static Mesh frondMesh;

        static void BuildPalms(Transform parent)
        {
            if (trunkMesh == null) trunkMesh = BuildTrunkMesh(5.2f, 1.1f, 0.26f, 0.12f, 9, 7);
            if (frondMesh == null) frondMesh = BuildFrondMesh(2.7f, 0.55f, 9);

            var trunkMat = MakeLitMat(new Color(0.46f, 0.34f, 0.21f));
            var leafMats = new Material[]
            {
                MakeLitMat(new Color(0.10f, 0.42f, 0.16f)),
                MakeLitMat(new Color(0.14f, 0.50f, 0.20f)),
                MakeLitMat(new Color(0.17f, 0.55f, 0.23f)),
            };
            var cocoMat = MakeLitMat(new Color(0.38f, 0.27f, 0.15f));

            var oldState = Random.state;
            Random.InitState(20260706); // 결정적 배치

            for (int i = 0; i < PalmSpots.Length; i++)
            {
                float x = PalmSpots[i].x, z = PalmSpots[i].y;
                float h = CourseData.GetVisualHeight(x, z);

                var palm = new GameObject("Palm_" + i);
                palm.transform.SetParent(parent, false);
                palm.transform.position = new Vector3(x, h - 0.1f, z);
                palm.transform.rotation = Quaternion.Euler(0f, Random.Range(0f, 360f), 0f);
                palm.transform.localScale = Vector3.one * Random.Range(0.85f, 1.25f);

                var trunk = new GameObject("Trunk");
                trunk.transform.SetParent(palm.transform, false);
                trunk.AddComponent<MeshFilter>().sharedMesh = trunkMesh;
                trunk.AddComponent<MeshRenderer>().sharedMaterial = trunkMat;

                // 트렁크 곡선(t=1) 끝 = 수관 위치
                Vector3 crown = new Vector3(1.1f, 5.2f, 0f);

                const int fronds = 8;
                for (int f = 0; f < fronds; f++)
                {
                    var frond = new GameObject("Frond_" + f);
                    frond.transform.SetParent(palm.transform, false);
                    frond.transform.localPosition = crown;
                    float ang = f * (360f / fronds) + Random.Range(-10f, 10f);
                    frond.transform.localRotation = Quaternion.Euler(Random.Range(-18f, 2f), ang, 0f);
                    frond.transform.localScale = new Vector3(Random.Range(0.85f, 1.15f), 1f, Random.Range(0.9f, 1.1f));
                    frond.AddComponent<MeshFilter>().sharedMesh = frondMesh;
                    frond.AddComponent<MeshRenderer>().sharedMaterial = leafMats[Random.Range(0, leafMats.Length)];
                }

                // 위로 솟은 어린 잎
                for (int f = 0; f < 3; f++)
                {
                    var frond = new GameObject("TopFrond_" + f);
                    frond.transform.SetParent(palm.transform, false);
                    frond.transform.localPosition = crown;
                    frond.transform.localRotation = Quaternion.Euler(-46f, f * 120f + Random.Range(-15f, 15f), 0f);
                    frond.transform.localScale = new Vector3(0.55f, 1f, 0.6f);
                    frond.AddComponent<MeshFilter>().sharedMesh = frondMesh;
                    frond.AddComponent<MeshRenderer>().sharedMaterial = leafMats[1];
                }

                // 코코넛
                for (int cn = 0; cn < 3; cn++)
                {
                    var coco = CreatePrim(PrimitiveType.Sphere, "Coconut_" + cn);
                    coco.transform.SetParent(palm.transform, false);
                    float ca = cn * 120f * Mathf.Deg2Rad;
                    coco.transform.localPosition = crown + new Vector3(Mathf.Sin(ca) * 0.28f, -0.28f, Mathf.Cos(ca) * 0.28f);
                    coco.transform.localScale = Vector3.one * 0.34f;
                    coco.GetComponent<MeshRenderer>().sharedMaterial = cocoMat;
                }
            }

            Random.state = oldState; // 게임플레이 RNG 복원
        }

        /// <summary>+X로 기우는 휘어진 마디 원통 트렁크.</summary>
        static Mesh BuildTrunkMesh(float height, float lean, float baseRadius, float topRadius, int rings, int sides)
        {
            var verts = new Vector3[(rings + 1) * (sides + 1)];
            for (int r = 0; r <= rings; r++)
            {
                float t = (float)r / rings;
                float y = height * t;
                float cx = lean * t * t;
                float radius = Mathf.Lerp(baseRadius, topRadius, t);
                radius *= 1f + ((r % 2 == 0) ? 0.07f : -0.04f); // 마디 변조
                for (int s = 0; s <= sides; s++)
                {
                    float a = (float)s / sides * Mathf.PI * 2f;
                    verts[r * (sides + 1) + s] = new Vector3(cx + Mathf.Cos(a) * radius, y, Mathf.Sin(a) * radius);
                }
            }
            var tris = new int[rings * sides * 6];
            int ti = 0;
            for (int r = 0; r < rings; r++)
            {
                for (int s = 0; s < sides; s++)
                {
                    int a = r * (sides + 1) + s, b = a + 1, c = a + sides + 1, d = c + 1;
                    tris[ti++] = a; tris[ti++] = c; tris[ti++] = b;
                    tris[ti++] = b; tris[ti++] = c; tris[ti++] = d;
                }
            }
            var mesh = new Mesh();
            mesh.vertices = verts;
            mesh.triangles = tris;
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            return mesh;
        }

        /// <summary>포물선으로 처지는 V자 접힘 잎 스트립 (+X 방향).</summary>
        static Mesh BuildFrondMesh(float length, float width, int segs)
        {
            var verts = new Vector3[(segs + 1) * 3];
            for (int i = 0; i <= segs; i++)
            {
                float t = (float)i / segs;
                float x = length * t;
                float y = Mathf.Sin(t * Mathf.PI * 0.55f) * 0.55f - t * t * 1.15f;
                float w = width * (0.35f + 0.65f * Mathf.Sin(t * Mathf.PI)) * (1f - t * 0.55f);
                float edgeDrop = 0.16f * (1f - t * 0.5f);
                verts[i * 3 + 0] = new Vector3(x, y - edgeDrop, -w);
                verts[i * 3 + 1] = new Vector3(x, y, 0f);
                verts[i * 3 + 2] = new Vector3(x, y - edgeDrop, w);
            }
            var tris = new int[segs * 12];
            int ti = 0;
            for (int i = 0; i < segs; i++)
            {
                int a = i * 3, b = a + 1, c = a + 2;
                int d = a + 3, e = a + 4, f = a + 5;
                tris[ti++] = a; tris[ti++] = d; tris[ti++] = b;
                tris[ti++] = b; tris[ti++] = d; tris[ti++] = e;
                tris[ti++] = b; tris[ti++] = e; tris[ti++] = c;
                tris[ti++] = c; tris[ti++] = e; tris[ti++] = f;
            }
            var mesh = new Mesh();
            mesh.vertices = verts;
            mesh.triangles = tris;
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            return mesh;
        }

        // ── 홀컵 + 홀인 반경 가이드 ───────────────────────
        static void BuildHoleCup(Transform parent)
        {
            var flag = CourseData.Hole1.flagPosition;
            CreateGroundRing(parent, "CupRim", flag.x, flag.z, 2.1f, 2.55f, 0.06f,
                MakeLitMat(new Color(0.95f, 0.95f, 0.92f)));
            CreateGroundRing(parent, "CupInner", flag.x, flag.z, 0f, 2.15f, 0.045f,
                MakeLitMat(new Color(0.05f, 0.10f, 0.06f)));
            Shader ut = Shader.Find("PromptGolf/UnlitTransparent");
            if (ut != null)
            {
                var m = new Material(ut);
                m.SetColor("_Color", new Color(1f, 1f, 1f, 0.35f));
                CreateGroundRing(parent, "HoleRadiusGuide", flag.x, flag.z, 7.85f, 8.05f, 0.05f, m);
            }
        }

        /// <summary>지형을 따라 드레이핑되는 평면 링/원반 메쉬.</summary>
        static void CreateGroundRing(Transform parent, string name, float cx, float cz,
            float innerR, float outerR, float lift, Material mat)
        {
            const int segs = 64;
            var verts = new Vector3[(segs + 1) * 2];
            for (int i = 0; i <= segs; i++)
            {
                float a = (float)i / segs * Mathf.PI * 2f;
                float ix = cx + Mathf.Cos(a) * innerR;
                float iz = cz + Mathf.Sin(a) * innerR;
                float ox = cx + Mathf.Cos(a) * outerR;
                float oz = cz + Mathf.Sin(a) * outerR;
                verts[i * 2] = new Vector3(ix, CourseData.GetVisualHeight(ix, iz) + lift, iz);
                verts[i * 2 + 1] = new Vector3(ox, CourseData.GetVisualHeight(ox, oz) + lift, oz);
            }
            var tris = new int[segs * 6];
            for (int i = 0; i < segs; i++)
            {
                int a = i * 2, b = a + 1, c = a + 2, d = a + 3;
                tris[i * 6 + 0] = a; tris[i * 6 + 1] = c; tris[i * 6 + 2] = b;
                tris[i * 6 + 3] = b; tris[i * 6 + 4] = c; tris[i * 6 + 5] = d;
            }
            var mesh = new Mesh();
            mesh.vertices = verts;
            mesh.triangles = tris;
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var mr = go.AddComponent<MeshRenderer>();
            mr.sharedMaterial = mat;
            mr.shadowCastingMode = ShadowCastingMode.Off;
        }
    }
}
