using UnityEngine;

namespace PromptGolf
{
    public class ShotResult
    {
        public Shot shot;
        public CoursePosition position;
        public float totalDistance;
        public float remaining;
        public bool sunk;
    }

    /// <summary>
    /// lib/game/calculateShot.ts 포팅 + 개선 — AI 유사도 점수를 공 이동으로 변환.
    /// - similarity &lt; 0.3 → 헛스윙 (공이 거의 안 움직임)
    /// - 거리는 similarity^1.3으로 스케일, 남은 거리 + 25m 로 상한 (그린 근처는 어프로치)
    /// - -3°~+3° 랜덤 각도 오차 (벙커에서는 -8°~+8°)
    /// - 벙커에서 치면 거리 40~70% 감소
    /// - [개선] 샷 방향 = 깃발 방향. 원본은 +z 고정이라 깃발을 지나치면
    ///   영원히 홀인이 불가능한 결함이 있었음. 상한 없는 골프 룰에서는
    ///   항상 홀아웃이 도달 가능해야 하므로 방향 기준으로 수정.
    /// </summary>
    public static class ShotCalculator
    {
        public const float MISS_SWING_THRESHOLD = 0.3f;
        public const float HOLE_RADIUS = 8f;
        const float MAX_SHOT_DISTANCE = 160f;

        public static ShotResult Calculate(Hole hole, CoursePosition from, float fromDistance,
            float similarity, string prompt, int targetN)
        {
            bool isMissSwing = similarity < MISS_SWING_THRESHOLD;

            float bunkerDepth;
            bool inBunker = CourseData.GetBunkerAt(from.x, from.z, out bunkerDepth);

            float power = isMissSwing ? 0.04f : Mathf.Pow(similarity, 1.3f);

            if (inBunker)
            {
                float depthPenalty = 0.4f + (bunkerDepth / 2f) * 0.2f;
                power *= (1f - Mathf.Min(depthPenalty, 0.7f));
            }

            // 깃발까지 직선 거리 기준으로 샷 상한 결정
            float toFlagX = hole.flagPosition.x - from.x;
            float toFlagZ = hole.flagPosition.z - from.z;
            float remainingBefore = Mathf.Sqrt(toFlagX * toFlagX + toFlagZ * toFlagZ);

            // 쇼트게임(30m 이내)은 남은 거리 비례로 정밀해져 퍼팅이 수렴한다
            float reach = remainingBefore <= 30f
                ? remainingBefore * 1.25f
                : Mathf.Min(MAX_SHOT_DISTANCE, remainingBefore + 25f);
            float distanceMoved = Mathf.Round(power * reach);
            if (isMissSwing) distanceMoved = Mathf.Min(distanceMoved, 12f);

            float angleRange = inBunker ? 16f : (remainingBefore <= 30f ? 3f : 6f);
            float angleOffset = Random.value * angleRange - angleRange / 2f;
            float angleRad = angleOffset * Mathf.Deg2Rad;

            // 샷 방향 = 깃발 방향 + 각도 오차
            float dirX, dirZ;
            if (remainingBefore < 0.01f) { dirX = 0f; dirZ = 1f; }
            else { dirX = toFlagX / remainingBefore; dirZ = toFlagZ / remainingBefore; }
            float cosA = Mathf.Cos(angleRad), sinA = Mathf.Sin(angleRad);
            float rx = dirX * cosA - dirZ * sinA;
            float rz = dirX * sinA + dirZ * cosA;

            var position = new CoursePosition(
                from.x + rx * distanceMoved,
                from.z + rz * distanceMoved);

            float newDistance = Mathf.Clamp(position.z, 0f, hole.distance + 20f);

            float dx = position.x - hole.flagPosition.x;
            float dz = position.z - hole.flagPosition.z;
            float remaining = Mathf.Round(Mathf.Sqrt(dx * dx + dz * dz));

            return new ShotResult
            {
                shot = new Shot
                {
                    prompt = prompt,
                    targetN = targetN,
                    similarity = similarity,
                    distanceMoved = distanceMoved,
                    angleOffset = Mathf.Round(angleOffset * 10f) / 10f,
                    isMissSwing = isMissSwing,
                },
                position = position,
                totalDistance = newDistance,
                remaining = remaining,
                sunk = remaining <= HOLE_RADIUS,
            };
        }

        /// <summary>골프 스코어 명칭 (파 대비 차이).</summary>
        public static string ScoreName(int diff)
        {
            if (diff <= -4) return "콘도르";
            if (diff == -3) return "알바트로스";
            if (diff == -2) return "이글";
            if (diff == -1) return "버디";
            if (diff == 0) return "파";
            if (diff == 1) return "보기";
            if (diff == 2) return "더블 보기";
            if (diff == 3) return "트리플 보기";
            return "+" + diff;
        }

        public static string ScoreDiffLabel(int diff)
        {
            if (diff == 0) return "E";
            return diff > 0 ? "+" + diff : diff.ToString();
        }
    }

    /// <summary>
    /// 유사도 제공자. 원본은 프롬프트→AI 화면 생성→비전 비교 파이프라인이며,
    /// Unity 클라이언트에서 API 키를 직접 쓰면 안 되므로(전환 문서 참고)
    /// 기본은 원본 mock과 동일한 FNV-1a 해시 기반 결정적 점수(0.45~0.85).
    /// 서버 프록시 연동 시 이 인터페이스만 교체하면 됨.
    /// </summary>
    public interface ISimilarityProvider
    {
        float Score(string prompt, int targetN);
    }

    public class MockSimilarityProvider : ISimilarityProvider
    {
        public float Score(string prompt, int targetN)
        {
            string sample = prompt ?? "";
            if (sample.Length > 256) sample = sample.Substring(0, 256);
            uint h = 2166136261u;
            for (int i = 0; i < sample.Length; i++)
            {
                h ^= sample[i];
                h *= 16777619u;
            }
            float f = (h % 1000u) / 1000f;
            float score = 0.45f + f * 0.4f;
            return Mathf.Round(score * 100f) / 100f;
        }
    }
}
