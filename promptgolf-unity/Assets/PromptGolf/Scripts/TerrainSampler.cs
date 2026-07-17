using UnityEngine;

namespace PromptGolf
{
    /// <summary>lib/physics/TerrainSampler.ts 포팅 — 높이/경사/존 샘플링.</summary>
    public static class TerrainSampler
    {
        const float GRADIENT_SAMPLE_DIST = 0.5f;

        public static float GetHeight(float x, float z)
        {
            return CourseData.GetVisualHeight(x, z);
        }

        /// <summary>중앙 차분법 경사도. 반환값 방향 = 굴러 내려가는 방향.</summary>
        public static Vector2 GetGradient(float x, float z)
        {
            float h = GRADIENT_SAMPLE_DIST;
            float hPosX = GetHeight(x + h, z);
            float hNegX = GetHeight(x - h, z);
            float hPosZ = GetHeight(x, z + h);
            float hNegZ = GetHeight(x, z - h);
            return new Vector2(
                -(hPosX - hNegX) / (2f * h),
                -(hPosZ - hNegZ) / (2f * h));
        }

        public static LandingZone GetZone(float x, float z)
        {
            return CourseData.GetLandingZone(x, z);
        }
    }
}
