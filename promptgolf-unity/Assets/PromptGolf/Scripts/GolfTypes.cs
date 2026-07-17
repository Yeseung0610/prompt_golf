using System;
using UnityEngine;

namespace PromptGolf
{
    public enum LandingZone { Fairway, Rough, Bunker, Green, Water, OB, Beach }
    public enum HazardType { Water, Bunker, OB, Tree }

    [Serializable]
    public struct CoursePosition
    {
        public float x;
        public float z;
        public CoursePosition(float x, float z) { this.x = x; this.z = z; }
    }

    [Serializable]
    public class Hole
    {
        public int id = 1;
        public int par = 4;
        public float distance = 395f;
        public CoursePosition teePosition = new CoursePosition(0f, 0f);
        public CoursePosition flagPosition = new CoursePosition(-15f, 380f);
        public float windSpeed = 3.5f;
        public float windDirection = 270f;
        public string difficulty = "보통";
    }

    [Serializable]
    public class HazardZone
    {
        public string id;
        public HazardType type;
        public Vector3 position;
        public Vector3 size;
        public int penalty;
        public bool resetToLastPosition;

        public HazardZone(string id, HazardType type, Vector3 position, Vector3 size, int penalty, bool reset)
        {
            this.id = id; this.type = type; this.position = position; this.size = size;
            this.penalty = penalty; this.resetToLastPosition = reset;
        }
    }

    [Serializable]
    public class HillDefinition
    {
        public Vector3 position;
        public float radius;
        public float height;
        public HillDefinition(float x, float y, float z, float radius, float height)
        {
            position = new Vector3(x, y, z); this.radius = radius; this.height = height;
        }
    }

    [Serializable]
    public class Shot
    {
        public string prompt;
        public int targetN;
        public float similarity;
        public float distanceMoved;
        public float angleOffset;
        public bool isMissSwing;
    }

    /// <summary>lib/physics/config.ts 포팅 — 골프 물리 상수</summary>
    public static class PhysicsConfig
    {
        public const float GRAVITY = 9.81f;
        public const float AIR_DRAG = 0.02f;
        public const float BOUNCE_RESTITUTION = 0.4f;
        public const float MIN_BOUNCE_VELOCITY = 1.5f;
        public const float DEFAULT_FLIGHT_TIME = 4.0f;
        public const float MAX_FLIGHT_HEIGHT = 25f;
        public const float LAUNCH_HEIGHT_FACTOR = 0.12f;
        public const float SLOPE_ACCELERATION = 2.6f;
        public const float REST_VELOCITY_THRESHOLD = 0.15f;
        public const float REST_TIME_REQUIRED = 0.3f;
        public const float MAX_DELTA_TIME = 0.05f;
        public const float BALL_RADIUS = 0.25f;

        // 바람 가속 (플레이 시작 시 GameManager가 홀 데이터로 설정)
        public static float WindAccelX = 0f;
        public static float WindAccelZ = 0f;

        /// <summary>존별 반발계수 — 모래는 박히고 그린은 튄다.</summary>
        public static float BounceRestitution(LandingZone zone)
        {
            switch (zone)
            {
                case LandingZone.Bunker: return 0.05f;
                case LandingZone.Beach: return 0.10f;
                case LandingZone.Green: return 0.42f;
                case LandingZone.Fairway: return 0.40f;
                case LandingZone.Rough: return 0.22f;
                default: return 0.30f;
            }
        }

        public static float RollingFriction(LandingZone zone)
        {
            switch (zone)
            {
                case LandingZone.Fairway: return 0.12f;
                case LandingZone.Green: return 0.08f;
                case LandingZone.Rough: return 0.25f;
                case LandingZone.Bunker: return 0.45f;
                case LandingZone.Beach: return 0.5f;
                case LandingZone.Water: return 1f;
                case LandingZone.OB: return 1f;
                default: return 0.25f;
            }
        }
    }
}
