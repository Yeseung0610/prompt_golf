using UnityEngine;

namespace PromptGolf
{
    public enum SimulationPhase { Idle, Flying, Bouncing, Rolling, Resting }

    public struct SimulationState
    {
        public Vector3 position;
        public Vector3 velocity;
        public SimulationPhase phase;
        public LandingZone zone;
        public bool isResting;
    }

    /// <summary>
    /// lib/physics/BallSimulator.ts 포팅 — 경량 골프공 물리.
    /// 포물선 비행(공기저항) → 착지/튕김 → 굴러감(경사·마찰) → 정지.
    /// </summary>
    public class BallSimulator
    {
        float posX, posY, posZ;
        float velX, velY, velZ;
        SimulationPhase phase = SimulationPhase.Idle;
        float restTimer;

        public void Launch(Vector3 from, Vector3 to, float flightTime = -1f)
        {
            float terrainHeight = TerrainSampler.GetHeight(from.x, from.z);
            posX = from.x;
            posY = Mathf.Max(from.y, terrainHeight + 0.5f);
            posZ = from.z;

            float dx = to.x - from.x;
            float dz = to.z - from.z;
            float horizontalDist = Mathf.Sqrt(dx * dx + dz * dz);

            if (horizontalDist < 0.1f)
            {
                velX = 0f; velY = 5f; velZ = 0f;
                phase = SimulationPhase.Flying; restTimer = 0f;
                return;
            }

            float t = flightTime > 0f ? flightTime
                : Mathf.Min(Mathf.Max(horizontalDist / 80f, 2.5f), PhysicsConfig.DEFAULT_FLIGHT_TIME);

            float horizontalSpeed = horizontalDist / t;
            velX = dx / horizontalDist * horizontalSpeed;
            velZ = dz / horizontalDist * horizontalSpeed;

            float maxHeight = Mathf.Min(horizontalDist * PhysicsConfig.LAUNCH_HEIGHT_FACTOR, PhysicsConfig.MAX_FLIGHT_HEIGHT);
            velY = Mathf.Sqrt(2f * PhysicsConfig.GRAVITY * maxHeight);

            phase = SimulationPhase.Flying;
            restTimer = 0f;
        }

        public SimulationState Step(float delta)
        {
            float dt = Mathf.Min(delta, PhysicsConfig.MAX_DELTA_TIME);
            if (phase == SimulationPhase.Idle || phase == SimulationPhase.Resting) return GetState();

            float terrainHeight = TerrainSampler.GetHeight(posX, posZ);
            LandingZone zone = TerrainSampler.GetZone(posX, posZ);

            if (phase == SimulationPhase.Flying || phase == SimulationPhase.Bouncing)
                UpdateFlying(dt, terrainHeight, zone);
            else if (phase == SimulationPhase.Rolling)
                UpdateRolling(dt, terrainHeight, zone);

            return GetState();
        }

        void UpdateFlying(float dt, float terrainHeight, LandingZone zone)
        {
            float speed = Mathf.Sqrt(velX * velX + velY * velY + velZ * velZ);
            if (speed > 0.01f)
            {
                float dragFactor = 1f - PhysicsConfig.AIR_DRAG * dt * speed;
                velX *= dragFactor;
                velZ *= dragFactor;
            }

            // 바람 (비행 중 횡가속)
            velX += PhysicsConfig.WindAccelX * dt;
            velZ += PhysicsConfig.WindAccelZ * dt;

            velY -= PhysicsConfig.GRAVITY * dt;

            posX += velX * dt;
            posY += velY * dt;
            posZ += velZ * dt;

            float newTerrainHeight = TerrainSampler.GetHeight(posX, posZ);
            if (posY <= newTerrainHeight)
            {
                posY = newTerrainHeight;

                if (zone == LandingZone.Water || zone == LandingZone.OB)
                {
                    velX = 0f; velY = 0f; velZ = 0f;
                    phase = SimulationPhase.Resting;
                    return;
                }

                if (velY < -PhysicsConfig.MIN_BOUNCE_VELOCITY)
                {
                    // 존별 반발: 모래는 박히고 그린/페어웨이는 튄다
                    float restitution = PhysicsConfig.BounceRestitution(zone);
                    float hDamp = (zone == LandingZone.Bunker || zone == LandingZone.Beach) ? 0.35f : 0.85f;
                    velY = -velY * restitution;
                    velX *= hDamp;
                    velZ *= hDamp;
                    phase = SimulationPhase.Bouncing;
                }
                else
                {
                    velY = 0f;
                    phase = SimulationPhase.Rolling;
                }
            }
        }

        void UpdateRolling(float dt, float terrainHeight, LandingZone zone)
        {
            Vector2 gradient = TerrainSampler.GetGradient(posX, posZ);
            float friction = PhysicsConfig.RollingFriction(zone);

            velX += gradient.x * PhysicsConfig.SLOPE_ACCELERATION * dt;
            velZ += gradient.y * PhysicsConfig.SLOPE_ACCELERATION * dt;

            float speed = Mathf.Sqrt(velX * velX + velZ * velZ);
            if (speed > 0.01f)
            {
                float frictionDecel = friction * PhysicsConfig.GRAVITY * dt;
                float newSpeed = Mathf.Max(0f, speed - frictionDecel);
                float factor = newSpeed / speed;
                velX *= factor;
                velZ *= factor;
            }

            posX += velX * dt;
            posZ += velZ * dt;
            posY = TerrainSampler.GetHeight(posX, posZ);

            float currentSpeed = Mathf.Sqrt(velX * velX + velZ * velZ);
            if (currentSpeed < PhysicsConfig.REST_VELOCITY_THRESHOLD)
            {
                restTimer += dt;
                if (restTimer >= PhysicsConfig.REST_TIME_REQUIRED)
                {
                    velX = 0f; velZ = 0f;
                    phase = SimulationPhase.Resting;
                }
            }
            else restTimer = 0f;
        }

        public SimulationState GetState()
        {
            return new SimulationState
            {
                position = new Vector3(posX, posY, posZ),
                velocity = new Vector3(velX, velY, velZ),
                phase = phase,
                zone = TerrainSampler.GetZone(posX, posZ),
                isResting = phase == SimulationPhase.Resting,
            };
        }

        public void SetPosition(float x, float y, float z)
        {
            posX = x; posY = y; posZ = z;
            velX = 0f; velY = 0f; velZ = 0f;
            phase = SimulationPhase.Idle;
            restTimer = 0f;
        }
    }
}
