using UnityEngine;

namespace PromptGolf
{
    /// <summary>
    /// lib/game/courseLayout.ts + calculateShot.ts의 BUNKER_BLOBS 포팅.
    /// Tropical Seaside Golf Course — Par 4, 395m, S-커브 페어웨이.
    /// </summary>
    public static class CourseData
    {
        public static readonly Hole Hole1 = new Hole();

        public static readonly HillDefinition[] Hills = new HillDefinition[]
        {
            // 페어웨이 초반 (+2m~+4m)
            new HillDefinition(0, 0, 60, 50, 2f),
            new HillDefinition(-20, 0, 90, 45, 3f),
            new HillDefinition(15, 0, 100, 40, 2.5f),
            // 페어웨이 중반 (S-커브 첫 굴곡, 왼쪽)
            new HillDefinition(-25, 0, 150, 55, 5f),
            new HillDefinition(10, 0, 170, 50, 4.5f),
            new HillDefinition(-15, 0, 200, 60, 6f),
            // S-커브 두 번째 굴곡 (오른쪽)
            new HillDefinition(20, 0, 250, 55, 6.5f),
            new HillDefinition(-10, 0, 280, 50, 7f),
            // 그린 접근 (+7m~+9m)
            new HillDefinition(-20, 0, 320, 60, 8f),
            new HillDefinition(5, 0, 350, 55, 9f),
            // 그린 (+10m)
            new HillDefinition(-15, 0, 380, 50, 10f),
            new HillDefinition(-25, 0, 395, 40, 10.5f),
            new HillDefinition(0, 0, 400, 35, 10f),
            // 왼쪽 해변 경계 언덕
            new HillDefinition(-70, 0, 50, 35, 4f),
            new HillDefinition(-80, 0, 120, 40, 5f),
            new HillDefinition(-75, 0, 200, 45, 6f),
            new HillDefinition(-70, 0, 280, 40, 7f),
            new HillDefinition(-65, 0, 350, 35, 8f),
            // 오른쪽 숲 경계 언덕
            new HillDefinition(70, 0, 80, 45, 5f),
            new HillDefinition(80, 0, 150, 50, 6f),
            new HillDefinition(75, 0, 220, 55, 7f),
            new HillDefinition(65, 0, 300, 45, 8f),
            new HillDefinition(60, 0, 370, 40, 9f),
        };

        public static readonly HazardZone[] Hazards = new HazardZone[]
        {
            new HazardZone("ocean", HazardType.Water, new Vector3(-130, -2, 200), new Vector3(80, 5, 400), 1, true),
            new HazardZone("lagoon", HazardType.Water, new Vector3(55, -1, 320), new Vector3(50, 4, 60), 1, true),
            new HazardZone("bunker-green-fl", HazardType.Bunker, new Vector3(-35, -0.5f, 365), new Vector3(14, 2, 12), 0, false),
            new HazardZone("bunker-green-l", HazardType.Bunker, new Vector3(-40, -0.5f, 385), new Vector3(12, 2, 16), 0, false),
            new HazardZone("bunker-green-fr", HazardType.Bunker, new Vector3(10, -0.5f, 370), new Vector3(16, 2, 10), 0, false),
            new HazardZone("bunker-green-back", HazardType.Bunker, new Vector3(-10, -0.5f, 400), new Vector3(18, 2, 10), 0, false),
            new HazardZone("bunker-fairway-1", HazardType.Bunker, new Vector3(25, -0.3f, 160), new Vector3(14, 2, 18), 0, false),
            new HazardZone("bunker-fairway-2", HazardType.Bunker, new Vector3(-30, -0.3f, 270), new Vector3(12, 2, 16), 0, false),
            new HazardZone("ob-ocean", HazardType.OB, new Vector3(-160, 0, 200), new Vector3(40, 10, 450), 1, true),
            new HazardZone("ob-right", HazardType.OB, new Vector3(130, 0, 200), new Vector3(60, 10, 450), 1, true),
        };

        // ── S-커브 페어웨이 경로 ─────────────────────────────
        struct PathPoint { public float z, x, width; public PathPoint(float z, float x, float w) { this.z = z; this.x = x; width = w; } }

        static readonly PathPoint[] FairwayPath = new PathPoint[]
        {
            new PathPoint(0, 0, 35), new PathPoint(50, 0, 40), new PathPoint(100, -8, 50),
            new PathPoint(150, -20, 55), new PathPoint(200, -15, 50), new PathPoint(250, 5, 48),
            new PathPoint(300, 10, 45), new PathPoint(350, -5, 40), new PathPoint(380, -15, 35),
        };

        public static float GetFairwayCenterX(float z)
        {
            for (int i = 0; i < FairwayPath.Length - 1; i++)
            {
                var curr = FairwayPath[i]; var next = FairwayPath[i + 1];
                if (z >= curr.z && z <= next.z)
                {
                    float t = (z - curr.z) / (next.z - curr.z);
                    return curr.x + (next.x - curr.x) * t;
                }
            }
            if (z < FairwayPath[0].z) return FairwayPath[0].x;
            return FairwayPath[FairwayPath.Length - 1].x;
        }

        public static float GetFairwayWidth(float z)
        {
            for (int i = 0; i < FairwayPath.Length - 1; i++)
            {
                var curr = FairwayPath[i]; var next = FairwayPath[i + 1];
                if (z >= curr.z && z <= next.z)
                {
                    float t = (z - curr.z) / (next.z - curr.z);
                    return curr.width + (next.width - curr.width) * t;
                }
            }
            if (z < FairwayPath[0].z) return FairwayPath[0].width;
            return FairwayPath[FairwayPath.Length - 1].width;
        }

        // ── 지형 높이 (cosine hill 합성) ─────────────────────
        public static float GetBaseHeight(float x, float z)
        {
            float height = 0f;
            for (int i = 0; i < Hills.Length; i++)
            {
                var hill = Hills[i];
                float dx = x - hill.position.x;
                float dz = z - hill.position.z;
                float dist = Mathf.Sqrt(dx * dx + dz * dz);
                if (dist < hill.radius)
                {
                    float t = dist / hill.radius;
                    float contribution = hill.height * (1f + Mathf.Cos(Mathf.PI * t)) / 2f;
                    height = Mathf.Max(height, contribution);
                }
            }
            return height;
        }

        /// <summary>물 카빙 + 벙커 함몰이 적용된 시각/물리 공용 높이.</summary>
        public static float GetVisualHeight(float x, float z)
        {
            float h = GetBaseHeight(x, z);
            for (int i = 0; i < Hazards.Length; i++)
            {
                var hz = Hazards[i];
                if (hz.type != HazardType.Water) continue;
                float f = InsideFactor(x, z, hz, 5f);
                if (f > 0f) h = Mathf.Lerp(h, -1.2f, f);
            }
            float depth;
            float sdf = BunkerBlobSdf(x, z, out depth);
            if (sdf < 0f)
            {
                float f = Mathf.Clamp01(-sdf / 3f);
                h -= depth * f;
            }
            return h;
        }

        static float InsideFactor(float x, float z, HazardZone hz, float margin)
        {
            float halfX = hz.size.x / 2f, halfZ = hz.size.z / 2f;
            float dx = halfX - Mathf.Abs(x - hz.position.x);
            float dz = halfZ - Mathf.Abs(z - hz.position.z);
            if (dx < 0f || dz < 0f) return 0f;
            return Mathf.Clamp01(Mathf.Min(dx, dz) / margin);
        }

        // ── 착지 존 판정 ─────────────────────────────────────
        public static LandingZone GetLandingZone(float x, float z)
        {
            for (int i = 0; i < Hazards.Length; i++)
            {
                var hazard = Hazards[i];
                float sx = hazard.size.x, sz = hazard.size.z;
                if (x >= hazard.position.x - sx / 2f && x <= hazard.position.x + sx / 2f &&
                    z >= hazard.position.z - sz / 2f && z <= hazard.position.z + sz / 2f)
                {
                    if (hazard.type == HazardType.Water) return LandingZone.Water;
                    if (hazard.type == HazardType.Bunker) return LandingZone.Bunker;
                    if (hazard.type == HazardType.OB) return LandingZone.OB;
                }
            }
            // 해변 (왼쪽 바다와 코스 사이)
            if (x < -50f && x > -90f) return LandingZone.Beach;
            // 그린
            float gdx = x - (-15f), gdz = z - 380f;
            if (Mathf.Sqrt(gdx * gdx + gdz * gdz) <= 30f) return LandingZone.Green;
            // 페어웨이 (S-커브)
            float centerX = GetFairwayCenterX(z);
            float width = GetFairwayWidth(z);
            if (Mathf.Abs(x - centerX) <= width / 2f && z >= 0f && z <= 400f) return LandingZone.Fairway;
            return LandingZone.Rough;
        }

        // ── 벙커 blob (calculateShot.ts와 동기화) ────────────
        class BunkerBlob
        {
            public Vector2[] centers;
            public float[] radii;
            public float depth;
            public BunkerBlob(Vector2[] c, float[] r, float d) { centers = c; radii = r; depth = d; }
        }

        static readonly BunkerBlob[] BunkerBlobs = new BunkerBlob[]
        {
            // 그린 주변 벙커 7개
            new BunkerBlob(new[]{ new Vector2(-32,398), new Vector2(-38,392) }, new[]{7f,5f}, 0.7f),
            new BunkerBlob(new[]{ new Vector2(-28,385), new Vector2(-35,380) }, new[]{6f,5f}, 0.6f),
            new BunkerBlob(new[]{ new Vector2(-30,365), new Vector2(-35,358) }, new[]{6f,5f}, 0.6f),
            new BunkerBlob(new[]{ new Vector2(18,395), new Vector2(25,388) }, new[]{7f,5f}, 0.8f),
            new BunkerBlob(new[]{ new Vector2(22,378), new Vector2(28,372) }, new[]{6f,5f}, 0.7f),
            new BunkerBlob(new[]{ new Vector2(20,358), new Vector2(15,350) }, new[]{6f,5f}, 0.6f),
            new BunkerBlob(new[]{ new Vector2(-5,340), new Vector2(5,335) }, new[]{5f,4f}, 0.5f),
            // 페어웨이 벙커 4개
            new BunkerBlob(new[]{ new Vector2(30,220), new Vector2(35,212) }, new[]{7f,5f}, 0.5f),
            new BunkerBlob(new[]{ new Vector2(-28,180), new Vector2(-22,172) }, new[]{6f,5f}, 0.5f),
            new BunkerBlob(new[]{ new Vector2(25,120), new Vector2(30,112) }, new[]{5f,4f}, 0.4f),
            new BunkerBlob(new[]{ new Vector2(-20,50), new Vector2(-25,42) }, new[]{5f,4f}, 0.4f),
        };

        static float Smin(float a, float b, float k)
        {
            float h = Mathf.Clamp01(0.5f + 0.5f * (b - a) / k);
            return b * (1f - h) + a * h - k * h * (1f - h);
        }

        /// <summary>가장 가까운 벙커 blob의 signed distance와 깊이 (음수 = 내부).</summary>
        public static float BunkerBlobSdf(float x, float z, out float depth)
        {
            float best = 1000f;
            depth = 0f;
            for (int b = 0; b < BunkerBlobs.Length; b++)
            {
                var blob = BunkerBlobs[b];
                float blobDist = 1000f;
                for (int i = 0; i < blob.centers.Length; i++)
                {
                    float dx = x - blob.centers[i].x;
                    float dz = z - blob.centers[i].y;
                    float dist = Mathf.Sqrt(dx * dx + dz * dz) - blob.radii[i];
                    if (i == 0) blobDist = dist;
                    else blobDist = Smin(blobDist, dist, 5f);
                }
                if (blobDist < best) { best = blobDist; depth = blob.depth; }
            }
            if (best >= 0f) depth = 0f;
            return best;
        }

        /// <summary>calculateShot.ts의 getBunkerAtPosition 포팅.</summary>
        public static bool GetBunkerAt(float x, float z, out float depth)
        {
            float sdf = BunkerBlobSdf(x, z, out depth);
            return sdf < 0f;
        }
    }
}
