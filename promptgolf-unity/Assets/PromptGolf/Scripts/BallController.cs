using System;
using UnityEngine;

namespace PromptGolf
{
    /// <summary>BallSimulator를 매 프레임 구동하며 공 트랜스폼을 갱신. 착지 임팩트 이벤트 포함.</summary>
    public class BallController : MonoBehaviour
    {
        public Action<SimulationState> OnRest;
        public Action<Vector3, float, LandingZone> OnImpact; // 위치, 충돌 속도, 존
        public bool IsActive { get; private set; }

        readonly BallSimulator sim = new BallSimulator();
        SimulationPhase prevPhase = SimulationPhase.Idle;

        public void PlaceAt(float x, float z)
        {
            float h = TerrainSampler.GetHeight(x, z);
            sim.SetPosition(x, h, z);
            transform.position = new Vector3(x, h + PhysicsConfig.BALL_RADIUS, z);
            IsActive = false;
            prevPhase = SimulationPhase.Idle;
        }

        public void Launch(Vector3 to)
        {
            Vector3 from = new Vector3(transform.position.x,
                transform.position.y - PhysicsConfig.BALL_RADIUS, transform.position.z);
            sim.Launch(from, to);
            IsActive = true;
            prevPhase = SimulationPhase.Flying;
        }

        void Update()
        {
            if (!IsActive) return;

            SimulationState s = sim.Step(Time.deltaTime);
            transform.position = new Vector3(
                s.position.x,
                s.position.y + PhysicsConfig.BALL_RADIUS,
                s.position.z);

            // 착지 임팩트 감지: 비행/튕김 → 튕김/구름 전이 순간
            if (s.phase != prevPhase &&
                (prevPhase == SimulationPhase.Flying || prevPhase == SimulationPhase.Bouncing) &&
                (s.phase == SimulationPhase.Bouncing || s.phase == SimulationPhase.Rolling))
            {
                if (OnImpact != null) OnImpact(s.position, s.velocity.magnitude, s.zone);
            }
            prevPhase = s.phase;

            Vector3 v = s.velocity;
            if (v.sqrMagnitude > 0.01f)
            {
                Vector3 axis = Vector3.Cross(Vector3.up, new Vector3(v.x, 0f, v.z)).normalized;
                float speed = new Vector2(v.x, v.z).magnitude;
                transform.Rotate(axis, speed / PhysicsConfig.BALL_RADIUS * Mathf.Rad2Deg * Time.deltaTime * 0.2f, Space.World);
            }

            if (s.isResting)
            {
                IsActive = false;
                if (OnRest != null) OnRest(s);
            }
        }
    }

    /// <summary>
    /// 카메라 컨트롤러.
    /// - Follow: 공 뒤에서 깃발 방향 추적 (플레이)
    /// - Flyover: 코스 순회 (로비)
    /// - Celebrate: 깃발 주위 궤도 회전 (홀인 연출)
    /// </summary>
    public class CameraFollow : MonoBehaviour
    {
        public enum Mode { Follow, Flyover, Celebrate }

        public Transform ball;
        public Vector3 flagPos;
        public float distance = 24f;
        public float height = 11f;
        public float smoothing = 2.5f;

        Mode mode = Mode.Follow;
        float flyT;
        float celebrateAngle;

        public void SetMode(Mode m)
        {
            mode = m;
            if (m == Mode.Flyover) flyT = 0f;
            if (m == Mode.Celebrate)
            {
                // 현재 카메라 방위각에서 이어서 회전 (점프 방지)
                Vector3 rel = transform.position - flagPos;
                celebrateAngle = Mathf.Atan2(rel.x, rel.z) * Mathf.Rad2Deg;
            }
        }

        void LateUpdate()
        {
            if (mode == Mode.Flyover) { FlyoverUpdate(); return; }
            if (mode == Mode.Celebrate) { CelebrateUpdate(); return; }
            FollowUpdate();
        }

        void FollowUpdate()
        {
            if (ball == null) return;

            Vector3 toFlag = flagPos - ball.position;
            toFlag.y = 0f;
            Vector3 dir = toFlag.sqrMagnitude < 1f ? Vector3.forward : toFlag.normalized;

            Vector3 desired = ball.position - dir * distance + Vector3.up * height;
            float ground = TerrainSampler.GetHeight(desired.x, desired.z);
            if (desired.y < ground + 3f) desired.y = ground + 3f;

            transform.position = Vector3.Lerp(transform.position, desired, Time.deltaTime * smoothing);

            Vector3 look = ball.position + dir * 14f + Vector3.up * 1.5f;
            Quaternion rot = Quaternion.LookRotation((look - transform.position).normalized, Vector3.up);
            transform.rotation = Quaternion.Slerp(transform.rotation, rot, Time.deltaTime * smoothing);
        }

        void FlyoverUpdate()
        {
            flyT += Time.deltaTime * 14f;
            float z = 430f - Mathf.Repeat(flyT, 480f);
            float cx = CourseData.GetFairwayCenterX(z);
            float h = TerrainSampler.GetHeight(cx, z);

            Vector3 pos = new Vector3(cx + 44f, h + 28f, z);
            transform.position = Vector3.Lerp(transform.position, pos, Time.deltaTime * 2f);

            Vector3 look = new Vector3(cx - 10f, h + 2f, z + 30f);
            Quaternion rot = Quaternion.LookRotation((look - transform.position).normalized, Vector3.up);
            transform.rotation = Quaternion.Slerp(transform.rotation, rot, Time.deltaTime * 2f);
        }

        void CelebrateUpdate()
        {
            celebrateAngle += Time.deltaTime * 10f;
            float rad = celebrateAngle * Mathf.Deg2Rad;
            Vector3 desired = flagPos + new Vector3(Mathf.Sin(rad), 0f, Mathf.Cos(rad)) * 13f + Vector3.up * 5.5f;
            float ground = TerrainSampler.GetHeight(desired.x, desired.z);
            if (desired.y < ground + 2f) desired.y = ground + 2f;

            transform.position = Vector3.Lerp(transform.position, desired, Time.deltaTime * 3f);
            Vector3 look = flagPos + Vector3.up * 3.5f; // 컨페티 높이까지 프레이밍
            Quaternion rot = Quaternion.LookRotation((look - transform.position).normalized, Vector3.up);
            transform.rotation = Quaternion.Slerp(transform.rotation, rot, Time.deltaTime * 4f);
        }

        public void SnapBehindBall()
        {
            if (ball == null) return;
            Vector3 toFlag = flagPos - ball.position;
            toFlag.y = 0f;
            Vector3 dir = toFlag.sqrMagnitude < 1f ? Vector3.forward : toFlag.normalized;
            transform.position = ball.position - dir * distance + Vector3.up * height;
            transform.rotation = Quaternion.LookRotation((ball.position + dir * 14f - transform.position).normalized, Vector3.up);
        }
    }
}
