using System.Collections;
using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace PromptGolf
{
    public enum GamePhase { Lobby, Playing, Result }

    /// <summary>
    /// Prompt Golf 게임 루프 오케스트레이터.
    /// 로비 → 플레이(프롬프트 → 유사도 → 샷 → 물리 비행 → 존/벌타 → 홀인) → 결과 → 로비.
    /// 종료 조건: 상한 없이 홀인까지, 점수는 골프 룰(파 대비)로 계산.
    /// 씬에 빈 GameObject 하나에 붙이면 코스/공/카메라/UI를 전부 런타임 생성한다.
    /// </summary>
    public class GameManager : MonoBehaviour
    {
        [Tooltip("목표 이미지 폴더 (없으면 StreamingAssets/targets 사용)")]
        public string targetsFolderOverride = "";

        Hole hole;
        BallController ball;
        CameraFollow camFollow;
        GameHUD hud;
        readonly ISimilarityProvider similarity = new MockSimilarityProvider();
        readonly List<Texture2D> targets = new List<Texture2D>();

        GamePhase phase = GamePhase.Lobby;
        string playerName = "플레이어 1";

        int swings;      // 실제 스윙 수
        int penalties;   // 벌타
        CoursePosition ballPos;
        CoursePosition lastSafePos;
        float totalDistance;
        bool busy;
        ShotResult pending;
        readonly List<string> history = new List<string>();

        ParticleSystem impactFx;
        ParticleSystem confettiFx;
        Vector3 flagTop;

        static readonly Color MsgNormal = Color.white;
        static readonly Color MsgGood = new Color(0.55f, 1f, 0.55f);
        static readonly Color MsgWarn = new Color(1f, 0.8f, 0.3f);
        static readonly Color MsgBad = new Color(1f, 0.45f, 0.4f);

        int Strokes { get { return swings + penalties; } }

        void Start()
        {
            hole = CourseData.Hole1;
            Application.targetFrameRate = 60;

            // 바람: 기상 방위각(바람이 불어오는 방향) → 미는 방향으로 변환
            float windTo = (hole.windDirection + 180f) * Mathf.Deg2Rad;
            PhysicsConfig.WindAccelX = Mathf.Sin(windTo) * hole.windSpeed * 0.3f;
            PhysicsConfig.WindAccelZ = Mathf.Cos(windTo) * hole.windSpeed * 0.3f;
            Application.runInBackground = true;

            CourseBuilder.Build();
            SetupEnvironment();
            SetupBall();
            SetupCamera();
            impactFx = Effects.CreateBurstSystem("ImpactFX", 1.4f);
            confettiFx = Effects.CreateBurstSystem("ConfettiFX", 0.55f);
            float flagH = CourseData.GetVisualHeight(hole.flagPosition.x, hole.flagPosition.z);
            flagTop = new Vector3(hole.flagPosition.x, flagH + 0.6f, hole.flagPosition.z); // 홀컵 위치
            LoadTargets();

            hud = gameObject.AddComponent<GameHUD>();
            hud.Build();
            hud.OnStartGame = StartGame;
            hud.OnSwing = OnSwingClicked;
            hud.OnReplay = EnterLobby;

            EnterLobby();
        }

        // ── 페이즈 전환 ────────────────────────────────────
        void EnterLobby()
        {
            phase = GamePhase.Lobby;
            busy = false;
            ball.PlaceAt(hole.teePosition.x, hole.teePosition.z);
            camFollow.SetMode(CameraFollow.Mode.Flyover);
            hud.ShowLobby();
        }

        void StartGame(string name)
        {
            playerName = name;
            phase = GamePhase.Playing;

            swings = 0;
            penalties = 0;
            busy = false;
            ballPos = hole.teePosition;
            lastSafePos = hole.teePosition;
            totalDistance = 0f;
            history.Clear();

            ball.PlaceAt(ballPos.x, ballPos.z);
            camFollow.SetMode(CameraFollow.Mode.Follow);
            camFollow.SnapBehindBall();

            hud.ShowPlaying();
            hud.SetBusy(false);
            hud.SetMessage("목표 화면을 재현하는 프롬프트를 쓰면 유사도만큼 공이 날아갑니다!", MsgNormal);
            UpdateHudInfo();
            ShowTargetForNextStroke();
        }

        void EnterResult()
        {
            phase = GamePhase.Result;
            int diff = Strokes - hole.par;
            string scoreLine = playerName + " · 총 " + Strokes + "타 (파 " + hole.par + ") · " +
                ShotCalculator.ScoreName(diff) + " (" + ShotCalculator.ScoreDiffLabel(diff) + ")";
            string historyText = history.Count > 0 ? string.Join("\n", history.ToArray()) : "기록 없음";
            hud.ShowResult("홀인!", scoreLine, historyText);
        }

        // ── 플레이 흐름 ────────────────────────────────────
        void OnSwingClicked(string prompt)
        {
            if (phase != GamePhase.Playing || busy) return;
            if (string.IsNullOrWhiteSpace(prompt))
            {
                hud.SetMessage("프롬프트를 입력하세요!", MsgWarn);
                return;
            }
            StartCoroutine(SwingRoutine(prompt));
        }

        IEnumerator SwingRoutine(string prompt)
        {
            busy = true;
            hud.SetBusy(true);
            hud.SetMessage("AI가 화면을 생성하는 중...", MsgNormal);
            yield return new WaitForSeconds(0.9f);

            float sim = similarity.Score(prompt, swings + 1);
            pending = ShotCalculator.Calculate(hole, ballPos, totalDistance, sim, prompt, swings + 1);
            lastSafePos = ballPos;

            if (pending.shot.isMissSwing)
                hud.SetMessage("헛스윙! 유사도 " + Mathf.RoundToInt(sim * 100f) + "% (30% 미만)", MsgBad);
            else
                hud.SetMessage("유사도 " + Mathf.RoundToInt(sim * 100f) + "% → " +
                    pending.shot.distanceMoved.ToString("F0") + "m 비행!", sim >= 0.7f ? MsgGood : MsgNormal);

            AddHistory((swings + 1) + "타  유사도 " + Mathf.RoundToInt(sim * 100f) + "%  " +
                pending.shot.distanceMoved.ToString("F0") + "m" +
                (pending.shot.isMissSwing ? "  [헛스윙]" : "") + "  ─ " + Truncate(prompt, 26));

            hud.ClearPrompt();

            float th = TerrainSampler.GetHeight(pending.position.x, pending.position.z);
            ball.Launch(new Vector3(pending.position.x, th, pending.position.z));
        }

        void OnBallRest(SimulationState state)
        {
            if (phase != GamePhase.Playing) return;

            swings++;
            LandingZone zone = state.zone;

            if (zone == LandingZone.Water || zone == LandingZone.OB)
            {
                penalties++;
                ballPos = lastSafePos;
                ball.PlaceAt(ballPos.x, ballPos.z);
                string what = zone == LandingZone.Water ? "워터 해저드" : "OB";
                hud.SetMessage(what + "! +1벌타 · 이전 위치에서 다시 칩니다", MsgBad);
                AddHistory("      " + what + " +1벌타");
            }
            else
            {
                ballPos = new CoursePosition(state.position.x, state.position.z);
                totalDistance = Mathf.Clamp(state.position.z, 0f, hole.distance + 20f);
                float rem = RemainingToFlag();

                if (rem <= ShotCalculator.HOLE_RADIUS)
                {
                    UpdateHudInfo();
                    StartCoroutine(HoleInSequence());
                    return;
                }

                if (zone == LandingZone.Bunker)
                    hud.SetMessage("벙커! 다음 샷의 거리와 정확도가 떨어집니다 (남은 " + rem.ToString("F0") + "m)", MsgWarn);
                else
                    hud.SetMessage(ZoneName(zone) + " 안착 · 남은 거리 " + rem.ToString("F0") + "m", MsgNormal);
            }

            busy = false;
            hud.SetBusy(false);
            UpdateHudInfo();
            ShowTargetForNextStroke();
        }

        // ── 셋업 ───────────────────────────────────────────
        void SetupEnvironment()
        {
            // 포그
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Exponential;
            RenderSettings.fogDensity = 0.0010f;
            RenderSettings.fogColor = new Color(0.66f, 0.84f, 0.92f);

            // 디렉셔널 라이트 (소프트 섀도우)
            Light dirLight = null;
            var lights = UnityEngine.Object.FindObjectsByType<Light>(FindObjectsSortMode.None);
            for (int i = 0; i < lights.Length; i++)
                if (lights[i].type == LightType.Directional) { dirLight = lights[i]; break; }
            if (dirLight == null)
            {
                var lgo = new GameObject("Directional Light", typeof(Light));
                dirLight = lgo.GetComponent<Light>();
                dirLight.type = LightType.Directional;
            }
            dirLight.transform.rotation = Quaternion.Euler(35f, -40f, 0f);
            dirLight.color = new Color(1f, 0.96f, 0.87f);
            dirLight.intensity = 1.25f;
            dirLight.shadows = LightShadows.Soft;
            dirLight.shadowStrength = 0.85f;

            // URP 그림자 거리 확장 (코스 스케일)
            var rp = GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;
            if (rp != null) rp.shadowDistance = 300f;

            // 그라디언트 스카이박스 + 태양
            Shader skyShader = Shader.Find("PromptGolf/GradientSkybox");
            if (skyShader != null)
            {
                var sky = new Material(skyShader);
                sky.SetVector("_SunDirection", -dirLight.transform.forward);
                RenderSettings.skybox = sky;
            }

            // 앰비언트 (트라이라이트: 하늘/수평선/지면)
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.42f, 0.56f, 0.74f);
            RenderSettings.ambientEquatorColor = new Color(0.45f, 0.54f, 0.47f);
            RenderSettings.ambientGroundColor = new Color(0.24f, 0.30f, 0.22f);

            // 포스트프로세싱 볼륨 (Bloom + ACES 톤매핑 + 비네트 + 컬러)
            var volGo = new GameObject("PostFX", typeof(Volume));
            var vol = volGo.GetComponent<Volume>();
            vol.isGlobal = true;
            var profile = ScriptableObject.CreateInstance<VolumeProfile>();
            var bloom = profile.Add<Bloom>(true);
            bloom.intensity.Override(0.4f);
            bloom.threshold.Override(1.0f);
            var tone = profile.Add<Tonemapping>(true);
            tone.mode.Override(TonemappingMode.ACES);
            var vig = profile.Add<Vignette>(true);
            vig.intensity.Override(0.16f);
            var ca = profile.Add<ColorAdjustments>(true);
            ca.saturation.Override(8f);
            ca.postExposure.Override(0f);
            ca.contrast.Override(15f);
            vol.profile = profile;
        }

        void SetupBall()
        {
            var go = CourseBuilder.CreatePrim(PrimitiveType.Sphere, "Ball");
            go.transform.localScale = Vector3.one * 0.9f;

            Shader s = Shader.Find("PromptGolf/SimpleLit");
            if (s == null) s = Shader.Find("Universal Render Pipeline/Lit");
            if (s == null) s = Shader.Find("Standard");
            var mat = new Material(s);
            mat.color = Color.white;
            go.GetComponent<MeshRenderer>().material = mat;

            ball = go.AddComponent<BallController>();
            ball.OnRest = OnBallRest;
            ball.OnImpact = OnBallImpact;

            var trail = go.AddComponent<TrailRenderer>();
            Shader ts = Shader.Find("Sprites/Default");
            if (ts != null)
            {
                trail.material = new Material(ts);
                trail.time = 1.8f;
                trail.startWidth = 0.4f;
                trail.endWidth = 0.02f;
                trail.startColor = new Color(1f, 1f, 1f, 0.85f);
                trail.endColor = new Color(1f, 1f, 1f, 0f);
                trail.minVertexDistance = 0.5f;
            }
            else trail.enabled = false;
        }

        void SetupCamera()
        {
            Camera cam = Camera.main;
            if (cam == null)
            {
                var cgo = new GameObject("Main Camera", typeof(Camera), typeof(AudioListener));
                cgo.tag = "MainCamera";
                cam = cgo.GetComponent<Camera>();
            }
            cam.clearFlags = CameraClearFlags.Skybox;
            cam.farClipPlane = 1500f;
            cam.allowHDR = true;
            var camData = cam.GetComponent<UniversalAdditionalCameraData>();
            if (camData == null) camData = cam.gameObject.AddComponent<UniversalAdditionalCameraData>();
            camData.renderPostProcessing = true;
            camData.antialiasing = AntialiasingMode.FastApproximateAntialiasing;

            camFollow = cam.gameObject.GetComponent<CameraFollow>();
            if (camFollow == null) camFollow = cam.gameObject.AddComponent<CameraFollow>();
            camFollow.ball = ball.transform;
            float fh = CourseData.GetVisualHeight(hole.flagPosition.x, hole.flagPosition.z);
            camFollow.flagPos = new Vector3(hole.flagPosition.x, fh, hole.flagPosition.z);
        }

        void LoadTargets()
        {
            StartCoroutine(LoadTargetsRoutine());
        }

        /// <summary>
        /// StreamingAssets/targets의 manifest.txt에 나열된 이미지를 UnityWebRequest로 로드.
        /// WebGL에서는 파일 시스템 접근이 불가하고 StreamingAssets가 URL이므로 이 방식이 필수.
        /// </summary>
        IEnumerator LoadTargetsRoutine()
        {
            targets.Clear();
            string baseUrl = Application.streamingAssetsPath + "/targets";
            string manifestUrl = baseUrl + "/manifest.txt";
            if (!manifestUrl.Contains("://")) manifestUrl = "file://" + manifestUrl;

            string[] files = null;
            using (var req = UnityEngine.Networking.UnityWebRequest.Get(manifestUrl))
            {
                yield return req.SendWebRequest();
                if (req.result != UnityEngine.Networking.UnityWebRequest.Result.Success)
                {
                    Debug.LogWarning("[PromptGolf] manifest 로드 실패: " + req.error);
                    yield break;
                }
                files = req.downloadHandler.text.Split(new[] { '\n', '\r' },
                    System.StringSplitOptions.RemoveEmptyEntries);
            }

            for (int i = 0; i < files.Length; i++)
            {
                string file = files[i].Trim();
                if (file.Length == 0) continue;
                string url = baseUrl + "/" + file;
                if (!url.Contains("://")) url = "file://" + url;
                using (var treq = UnityEngine.Networking.UnityWebRequestTexture.GetTexture(url))
                {
                    yield return treq.SendWebRequest();
                    if (treq.result == UnityEngine.Networking.UnityWebRequest.Result.Success)
                        targets.Add(UnityEngine.Networking.DownloadHandlerTexture.GetContent(treq));
                    else
                        Debug.LogWarning("[PromptGolf] 이미지 로드 실패: " + file + " (" + treq.error + ")");
                }
            }

            Debug.Log("[PromptGolf] 목표 이미지 " + targets.Count + "장 로드");
            // 비동기 로드가 늦게 끝난 경우 현재 표시 갱신
            if (phase == GamePhase.Playing) ShowTargetForNextStroke();
        }

        // ── 헬퍼 ───────────────────────────────────────────
        void OnBallImpact(Vector3 pos, float speed, LandingZone zone)
        {
            Effects.EmitImpact(impactFx, pos, speed, zone);
        }

        /// <summary>홀인 연출: 카메라 궤도 + 컨페티 → 결과 화면.</summary>
        IEnumerator HoleInSequence()
        {
            hud.SetBusy(true);
            camFollow.SetMode(CameraFollow.Mode.Celebrate);
            // 공을 홀컵으로 스냅 (컵인 표현)
            ball.PlaceAt(hole.flagPosition.x, hole.flagPosition.z);
            hud.SetMessage("홀인!!", new Color(1f, 0.85f, 0.2f));
            Effects.EmitConfetti(confettiFx, flagTop, 90);
            yield return new WaitForSeconds(0.9f);
            Effects.EmitConfetti(confettiFx, flagTop, 60);
            yield return new WaitForSeconds(1.7f);
            EnterResult();
        }

        float RemainingToFlag()
        {
            float dx = ballPos.x - hole.flagPosition.x;
            float dz = ballPos.z - hole.flagPosition.z;
            return Mathf.Sqrt(dx * dx + dz * dz);
        }

        void UpdateHudInfo()
        {
            string penaltyStr = penalties > 0 ? " (벌타 " + penalties + ")" : "";
            hud.SetInfo("<color=#FFD84D><b>" + playerName + "</b></color>\n" +
                "홀 " + hole.id + " · 파" + hole.par + " · " + hole.distance.ToString("F0") + "m · 바람 " +
                hole.windSpeed.ToString("F1") + "m/s (서풍)\n" +
                "타수: " + Strokes + penaltyStr + "\n" +
                "남은 거리: " + RemainingToFlag().ToString("F0") + "m");
        }

        void ShowTargetForNextStroke()
        {
            int n = swings + 1;
            if (targets.Count > 0)
            {
                var tex = targets[(n - 1) % targets.Count];
                hud.SetTarget(tex, n + "번째 샷 · 목표 화면");
            }
            else
            {
                hud.SetTarget(null, "목표 이미지 없음 (StreamingAssets/targets)");
            }
        }

        void AddHistory(string line)
        {
            history.Add(line);
        }

        static string Truncate(string s, int len)
        {
            if (string.IsNullOrEmpty(s)) return "";
            s = s.Replace("\n", " ");
            return s.Length <= len ? s : s.Substring(0, len) + "…";
        }

        static string ZoneName(LandingZone z)
        {
            switch (z)
            {
                case LandingZone.Fairway: return "페어웨이";
                case LandingZone.Green: return "그린";
                case LandingZone.Rough: return "러프";
                case LandingZone.Bunker: return "벙커";
                case LandingZone.Beach: return "해변";
                case LandingZone.Water: return "워터 해저드";
                case LandingZone.OB: return "OB";
                default: return z.ToString();
            }
        }
    }
}
