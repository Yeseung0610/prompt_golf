using System;
using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace PromptGolf
{
    /// <summary>
    /// 런타임 코드 생성 UI. 3개 화면을 관리:
    /// - 로비: 타이틀 / 플레이어 이름 / 게임 시작
    /// - 플레이: 홀 정보, 목표 이미지, 프롬프트 입력 + 스윙, 메시지
    /// - 결과: 총 타수 · 골프 스코어 · 샷 히스토리 · 다시 하기
    /// 한글 지원: OS 폰트 패밀리(맑은 고딕)로 TMP 다이나믹 폰트 에셋 생성.
    /// </summary>
    public class GameHUD : MonoBehaviour
    {
        public Action<string> OnSwing;      // prompt
        public Action<string> OnStartGame;  // player name
        public Action OnReplay;

        TMP_FontAsset fontAsset;

        GameObject lobbyRoot, playRoot, resultRoot;

        // 플레이
        TextMeshProUGUI infoText, messageText, targetLabel, swingLabel;
        TMP_InputField promptInput;
        Button swingButton;
        RawImage targetImage;

        // 로비
        TMP_InputField nameInput;

        // WebGL 한글 입력 오버레이 (IME 우회)
        bool useWebOverlay;
        string activeOverlay;
        float overlayTimer;

        // 결과
        TextMeshProUGUI resultTitle, resultScore, resultHistory;

        public void Build()
        {
            useWebOverlay = WebInput.Available;
            if (useWebOverlay) WebInput.ReleaseKeyboard();
            fontAsset = CreateKoreanFont();
            EnsureEventSystem();

            var canvasGo = new GameObject("HUDCanvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            canvasGo.transform.SetParent(transform, false);
            var canvas = canvasGo.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasGo.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1600, 900);
            scaler.matchWidthOrHeight = 0.5f;

            BuildLobby(canvasGo.transform);
            BuildPlayHud(canvasGo.transform);
            BuildResult(canvasGo.transform);

            ShowLobby();
        }

        // ── 화면 전환 ──────────────────────────────────────
        public void ShowLobby()
        {
            lobbyRoot.SetActive(true);
            playRoot.SetActive(false);
            resultRoot.SetActive(false);
            if (useWebOverlay) { WebInput.Hide("prompt"); ShowOverlayFor("name"); }
        }

        public void ShowPlaying()
        {
            lobbyRoot.SetActive(false);
            playRoot.SetActive(true);
            resultRoot.SetActive(false);
            if (useWebOverlay) { WebInput.Hide("name"); WebInput.SetValue("prompt", ""); ShowOverlayFor("prompt"); }
        }

        public void ShowResult(string title, string scoreLine, string historyText)
        {
            lobbyRoot.SetActive(false);
            playRoot.SetActive(false);
            resultRoot.SetActive(true);
            if (useWebOverlay) { WebInput.Hide("name"); WebInput.Hide("prompt"); activeOverlay = null; }
            resultTitle.text = title;
            resultScore.text = scoreLine;
            resultHistory.text = historyText;
        }

        // ── 로비 ───────────────────────────────────────────
        void BuildLobby(Transform root)
        {
            lobbyRoot = new GameObject("Lobby", typeof(RectTransform));
            lobbyRoot.transform.SetParent(root, false);
            StretchRect((RectTransform)lobbyRoot.transform, 0, 0);

            var panel = MakePanel(lobbyRoot.transform, "Panel", new Color(0f, 0.09f, 0.05f, 0.74f));
            SetRect(panel, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(780, 500));

            var title = MakeText(panel, "Title", 64, new Color(1f, 0.87f, 0.35f), TextAlignmentOptions.Center);
            title.fontStyle = FontStyles.Bold;
            title.text = "PROMPT GOLF";
            title.characterSpacing = 10f;
            SetRect(title.rectTransform, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -30), new Vector2(740, 80));

            var subtitle = MakeText(panel, "Subtitle", 24, Color.white, TextAlignmentOptions.Center);
            subtitle.text = "AI 프롬프트 골프 — 목표 화면을 프롬프트로 재현하면\n유사도만큼 골프공이 날아갑니다";
            SetRect(subtitle.rectTransform, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -120), new Vector2(740, 70));

            var holeInfo = MakeText(panel, "HoleInfo", 22, new Color(0.75f, 0.95f, 0.8f), TextAlignmentOptions.Center);
            holeInfo.text = "홀 1 · 파 4 · 395m · 열대 해변 코스 · 홀인까지 (골프 룰 스코어)";
            SetRect(holeInfo.rectTransform, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -200), new Vector2(740, 34));

            nameInput = MakeInputField(panel, "NameInput",
                new Vector2(0.5f, 0.5f), new Vector2(0, -30), new Vector2(430, 64),
                "플레이어 이름", false, 24);

            var startBtn = MakeButton(panel, "StartButton", "게임 시작",
                new Vector2(0.5f, 0), new Vector2(0, 36), new Vector2(280, 78),
                new Color(0.13f, 0.62f, 0.32f), 32, HandleStartClicked);
        }

        void HandleStartClicked()
        {
            string name = useWebOverlay ? WebInput.GetValue("name")
                : (nameInput != null ? nameInput.text : "");
            if (string.IsNullOrWhiteSpace(name)) name = "플레이어 1";
            if (OnStartGame != null) OnStartGame(name.Trim());
        }

        // ── 플레이 HUD ─────────────────────────────────────
        void BuildPlayHud(Transform root)
        {
            playRoot = new GameObject("Play", typeof(RectTransform));
            playRoot.transform.SetParent(root, false);
            StretchRect((RectTransform)playRoot.transform, 0, 0);
            Transform p = playRoot.transform;

            var infoPanel = MakePanel(p, "InfoPanel", new Color(0f, 0.1f, 0.05f, 0.55f));
            SetRect(infoPanel, new Vector2(0, 1), new Vector2(0, 1), new Vector2(0, 1), new Vector2(20, -20), new Vector2(470, 150));
            infoText = MakeText(infoPanel, "InfoText", 24, Color.white, TextAlignmentOptions.TopLeft);
            StretchRect(infoText.rectTransform, 14, 10);

            var targetPanel = MakePanel(p, "TargetPanel", new Color(0f, 0.1f, 0.05f, 0.55f));
            SetRect(targetPanel, new Vector2(1, 1), new Vector2(1, 1), new Vector2(1, 1), new Vector2(-20, -20), new Vector2(330, 260));
            targetLabel = MakeText(targetPanel, "TargetLabel", 22, new Color(1f, 0.92f, 0.6f), TextAlignmentOptions.Top);
            SetRect(targetLabel.rectTransform, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -8), new Vector2(310, 30));

            var imgGo = new GameObject("TargetImage", typeof(RectTransform), typeof(RawImage));
            imgGo.transform.SetParent(targetPanel, false);
            targetImage = imgGo.GetComponent<RawImage>();
            SetRect(targetImage.rectTransform, new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 10), new Vector2(310, 205));

            messagePanel = MakePanel(p, "MessagePanel", new Color(0f, 0.08f, 0.04f, 0.62f));
            SetRect(messagePanel, new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 190), new Vector2(900, 74));
            messageText = MakeText(messagePanel, "MessageText", 32, Color.white, TextAlignmentOptions.Center);
            messageText.fontStyle = FontStyles.Bold;
            StretchRect(messageText.rectTransform, 18, 6);

            var bottomPanel = MakePanel(p, "BottomPanel", new Color(0f, 0.08f, 0.04f, 0.65f));
            SetRect(bottomPanel, new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0, 18), new Vector2(1000, 130));

            promptInput = MakeInputField(bottomPanel, "PromptInput",
                new Vector2(0, 0.5f), new Vector2(15, 0), new Vector2(740, 100),
                "목표 화면을 재현할 프롬프트를 입력하세요... (유사도만큼 공이 날아갑니다)", true, 22);
            var ir = (RectTransform)promptInput.transform;
            ir.anchorMin = new Vector2(0, 0.5f); ir.anchorMax = new Vector2(0, 0.5f); ir.pivot = new Vector2(0, 0.5f);
            ir.anchoredPosition = new Vector2(15, 0);

            var btn = MakeButton(bottomPanel, "SwingButton", "스윙!",
                new Vector2(1, 0.5f), new Vector2(-15, 0), new Vector2(210, 100),
                new Color(0.13f, 0.62f, 0.32f), 30, HandleSwingClicked);
            swingButton = btn;
            swingLabel = btn.GetComponentInChildren<TextMeshProUGUI>();
            var br = (RectTransform)btn.transform;
            br.anchorMin = new Vector2(1, 0.5f); br.anchorMax = new Vector2(1, 0.5f); br.pivot = new Vector2(1, 0.5f);
            br.anchoredPosition = new Vector2(-15, 0);
        }

        void HandleSwingClicked()
        {
            string prompt = useWebOverlay ? WebInput.GetValue("prompt")
                : (promptInput != null ? promptInput.text : "");
            if (OnSwing != null) OnSwing(prompt);
        }

        // ── 결과 화면 ──────────────────────────────────────
        void BuildResult(Transform root)
        {
            resultRoot = new GameObject("Result", typeof(RectTransform));
            resultRoot.transform.SetParent(root, false);
            StretchRect((RectTransform)resultRoot.transform, 0, 0);

            var panel = MakePanel(resultRoot.transform, "Panel", new Color(0f, 0.09f, 0.05f, 0.8f));
            SetRect(panel, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(820, 620));

            resultTitle = MakeText(panel, "ResultTitle", 52, new Color(1f, 0.87f, 0.35f), TextAlignmentOptions.Center);
            resultTitle.fontStyle = FontStyles.Bold;
            SetRect(resultTitle.rectTransform, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -26), new Vector2(780, 66));

            resultScore = MakeText(panel, "ResultScore", 32, Color.white, TextAlignmentOptions.Center);
            SetRect(resultScore.rectTransform, new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -104), new Vector2(780, 46));

            // 샷 히스토리 스크롤
            var scrollGo = new GameObject("History", typeof(RectTransform), typeof(Image), typeof(ScrollRect));
            scrollGo.transform.SetParent(panel, false);
            scrollGo.GetComponent<Image>().color = new Color(0f, 0f, 0f, 0.35f);
            SetRect((RectTransform)scrollGo.transform, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, -30), new Vector2(760, 330));

            var viewportGo = new GameObject("Viewport", typeof(RectTransform), typeof(RectMask2D));
            viewportGo.transform.SetParent(scrollGo.transform, false);
            var vpRect = (RectTransform)viewportGo.transform;
            StretchRect(vpRect, 12, 10);

            var contentGo = new GameObject("Content", typeof(RectTransform));
            contentGo.transform.SetParent(viewportGo.transform, false);
            var contentRect = (RectTransform)contentGo.transform;
            contentRect.anchorMin = new Vector2(0, 1);
            contentRect.anchorMax = new Vector2(1, 1);
            contentRect.pivot = new Vector2(0.5f, 1);
            contentRect.offsetMin = new Vector2(0, 0);
            contentRect.offsetMax = new Vector2(0, 0);

            resultHistory = contentGo.AddComponent<TextMeshProUGUI>();
            resultHistory.font = fontAsset;
            resultHistory.fontSize = 21;
            resultHistory.color = new Color(0.9f, 0.95f, 0.9f);
            resultHistory.alignment = TextAlignmentOptions.TopLeft;
            var fitter = contentGo.AddComponent<ContentSizeFitter>();
            fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;

            var sr = scrollGo.GetComponent<ScrollRect>();
            sr.content = contentRect;
            sr.viewport = vpRect;
            sr.horizontal = false;
            sr.vertical = true;
            sr.scrollSensitivity = 25f;

            MakeButton(panel, "ReplayButton", "다시 하기",
                new Vector2(0.5f, 0), new Vector2(0, 26), new Vector2(260, 72),
                new Color(0.13f, 0.62f, 0.32f), 28, HandleReplayClicked);
        }

        void HandleReplayClicked()
        {
            if (OnReplay != null) OnReplay();
        }

        // ── 플레이 API ─────────────────────────────────────
        public void SetInfo(string text) { if (infoText != null) infoText.text = text; }
        public void SetMessage(string text, Color color)
        {
            if (messageText == null) return;
            messageText.text = text;
            messageText.color = color;
            if (messagePanel != null) messagePanel.gameObject.SetActive(!string.IsNullOrEmpty(text));
        }
        public void SetTarget(Texture2D tex, string label)
        {
            if (targetLabel != null) targetLabel.text = label;
            if (targetImage != null)
            {
                targetImage.texture = tex;
                targetImage.color = tex != null ? Color.white : new Color(0.2f, 0.25f, 0.22f);
            }
        }
        public void SetBusy(bool busy)
        {
            if (swingButton != null) swingButton.interactable = !busy;
            if (promptInput != null && !useWebOverlay) promptInput.interactable = !busy;
            if (useWebOverlay) WebInput.SetEnabled("prompt", !busy);
        }
        public void ClearPrompt()
        {
            if (promptInput != null) promptInput.text = "";
            if (useWebOverlay) WebInput.SetValue("prompt", "");
        }

        // ── 공통 헬퍼 ──────────────────────────────────────
        void EnsureEventSystem()
        {
            if (UnityEngine.Object.FindFirstObjectByType<EventSystem>() != null) return;
            var es = new GameObject("EventSystem", typeof(EventSystem));
            var inputModuleType = Type.GetType("UnityEngine.InputSystem.UI.InputSystemUIInputModule, Unity.InputSystem");
            if (inputModuleType != null) es.AddComponent(inputModuleType);
            else es.AddComponent<StandaloneInputModule>();
        }

        // ── 프로시저럴 라운드 스프라이트 (9-슬라이스) ──────
        static Sprite roundedSprite;
        RectTransform messagePanel;

        static Sprite GetRoundedSprite()
        {
            if (roundedSprite != null) return roundedSprite;
            const int size = 48, radius = 16;
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    // 라운드 사각형 SDF
                    float px = Mathf.Max(Mathf.Abs(x - size / 2f + 0.5f) - (size / 2f - radius), 0f);
                    float py = Mathf.Max(Mathf.Abs(y - size / 2f + 0.5f) - (size / 2f - radius), 0f);
                    float d = Mathf.Sqrt(px * px + py * py) - radius;
                    float a = Mathf.Clamp01(0.5f - d);
                    tex.SetPixel(x, y, new Color(1f, 1f, 1f, a));
                }
            }
            tex.Apply();
            roundedSprite = Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f),
                100f, 0, SpriteMeshType.FullRect, new Vector4(radius + 2, radius + 2, radius + 2, radius + 2));
            return roundedSprite;
        }

        static void ApplyRounded(Image img)
        {
            img.sprite = GetRoundedSprite();
            img.type = Image.Type.Sliced;
        }

        static TMP_FontAsset CreateKoreanFont()
        {
            // 1) 번들 폰트 (WebGL 포함 모든 플랫폼에서 동작) — OS 폰트는 브라우저에서 접근 불가
            var bundled = Resources.Load<Font>("Fonts/NotoSansKR");
            if (bundled != null)
            {
                try
                {
                    var bfa = TMP_FontAsset.CreateFontAsset(bundled);
                    if (bfa != null) return bfa;
                }
                catch { }
            }
            // 2) 에디터/데스크톱 폴백: OS 폰트 패밀리
            // OS 폰트 패밀리 이름으로 직접 생성 (FontEngine 경유, 폰트 데이터 불필요)
            string[] families = { "Malgun Gothic", "맑은 고딕", "NanumGothic", "Gulim", "Arial" };
            for (int i = 0; i < families.Length; i++)
            {
                try
                {
                    var fa = TMP_FontAsset.CreateFontAsset(families[i], "Regular", 64);
                    if (fa != null) return fa;
                }
                catch { }
            }
            try { return TMP_Settings.defaultFontAsset; } catch { return null; }
        }

        TMP_InputField MakeInputField(Transform parent, string name, Vector2 anchor, Vector2 pos, Vector2 size,
            string placeholderText, bool multiline, float fontSize)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Image));
            go.transform.SetParent(parent, false);
            var bgImg = go.GetComponent<Image>();
            bgImg.color = new Color(1f, 1f, 1f, 0.96f);
            ApplyRounded(bgImg);
            SetRect((RectTransform)go.transform, anchor, anchor, anchor, pos, size);

            var input = go.AddComponent<TMP_InputField>();

            var viewportGo = new GameObject("TextArea", typeof(RectTransform), typeof(RectMask2D));
            viewportGo.transform.SetParent(go.transform, false);
            var vpRect = (RectTransform)viewportGo.transform;
            StretchRect(vpRect, 12, 8);

            var phGo = new GameObject("Placeholder", typeof(RectTransform));
            phGo.transform.SetParent(viewportGo.transform, false);
            var ph = phGo.AddComponent<TextMeshProUGUI>();
            ph.font = fontAsset;
            ph.fontSize = fontSize;
            ph.color = new Color(0.35f, 0.38f, 0.42f, 0.75f);
            ph.text = placeholderText;
            ph.alignment = multiline ? TextAlignmentOptions.TopLeft : TextAlignmentOptions.Left;
            StretchRect(ph.rectTransform, 0, 0);

            var txtGo = new GameObject("Text", typeof(RectTransform));
            txtGo.transform.SetParent(viewportGo.transform, false);
            var txt = txtGo.AddComponent<TextMeshProUGUI>();
            txt.font = fontAsset;
            txt.fontSize = fontSize;
            txt.color = new Color(0.06f, 0.09f, 0.12f);
            txt.alignment = multiline ? TextAlignmentOptions.TopLeft : TextAlignmentOptions.Left;
            StretchRect(txt.rectTransform, 0, 0);

            input.textViewport = vpRect;
            input.textComponent = txt;
            input.placeholder = ph;
            input.fontAsset = fontAsset;
            input.lineType = multiline ? TMP_InputField.LineType.MultiLineNewline : TMP_InputField.LineType.SingleLine;
            input.characterLimit = multiline ? 2000 : 20;
            return input;
        }

        Button MakeButton(Transform parent, string name, string label, Vector2 anchor, Vector2 pos, Vector2 size,
            Color color, float fontSize, UnityEngine.Events.UnityAction onClick)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Image), typeof(Button));
            go.transform.SetParent(parent, false);
            var img = go.GetComponent<Image>();
            img.color = color;
            ApplyRounded(img);
            SetRect((RectTransform)go.transform, anchor, anchor, anchor, pos, size);

            var btn = go.GetComponent<Button>();
            btn.targetGraphic = img;
            var colors = btn.colors;
            colors.highlightedColor = new Color(1.12f, 1.12f, 1.12f, 1f);
            colors.pressedColor = new Color(0.82f, 0.82f, 0.82f, 1f);
            colors.disabledColor = new Color(0.62f, 0.62f, 0.62f, 0.8f);
            colors.fadeDuration = 0.08f;
            btn.colors = colors;
            btn.onClick.AddListener(onClick);

            var lbl = MakeText(go.transform, "Label", fontSize, Color.white, TextAlignmentOptions.Center);
            lbl.fontStyle = FontStyles.Bold;
            lbl.text = label;
            StretchRect(lbl.rectTransform, 0, 0);
            return btn;
        }

        TextMeshProUGUI MakeText(Transform parent, string name, float size, Color color, TextAlignmentOptions align)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var t = go.AddComponent<TextMeshProUGUI>();
            t.font = fontAsset;
            t.fontSize = size;
            t.color = color;
            t.alignment = align;
            t.raycastTarget = false;
            return t;
        }

        RectTransform MakePanel(Transform parent, string name, Color color)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Image));
            go.transform.SetParent(parent, false);
            var img = go.GetComponent<Image>();
            img.color = color;
            ApplyRounded(img);
            return (RectTransform)go.transform;
        }

        static void SetRect(RectTransform rt, Vector2 anchorMin, Vector2 anchorMax, Vector2 pivot, Vector2 anchoredPos, Vector2 size)
        {
            rt.anchorMin = anchorMin;
            rt.anchorMax = anchorMax;
            rt.pivot = pivot;
            rt.anchoredPosition = anchoredPos;
            rt.sizeDelta = size;
        }

        // ── WebGL 입력 오버레이 ────────────────────────────
        void ShowOverlayFor(string id)
        {
            activeOverlay = id;
            RepositionOverlay();
        }

        void RepositionOverlay()
        {
            if (!useWebOverlay || activeOverlay == null) return;
            float x, yTop, w, h;
            if (activeOverlay == "name" && nameInput != null)
            {
                WebInput.GetNormalizedRect((RectTransform)nameInput.transform, out x, out yTop, out w, out h);
                WebInput.Show("name", x, yTop, w, h, 0.028f, "플레이어 이름", false);
                nameInput.interactable = false;
            }
            else if (activeOverlay == "prompt" && promptInput != null)
            {
                WebInput.GetNormalizedRect((RectTransform)promptInput.transform, out x, out yTop, out w, out h);
                WebInput.Show("prompt", x, yTop, w, h, 0.026f, "목표 화면을 재현할 프롬프트를 입력하세요...", true);
                promptInput.interactable = false;
            }
        }

        void Update()
        {
            // 브라우저 리사이즈 대응: 0.5초마다 오버레이 위치 갱신
            if (!useWebOverlay || activeOverlay == null) return;
            overlayTimer += Time.unscaledDeltaTime;
            if (overlayTimer >= 0.5f)
            {
                overlayTimer = 0f;
                RepositionOverlay();
            }
        }

        static void StretchRect(RectTransform rt, float padX, float padY)
        {
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.offsetMin = new Vector2(padX, padY);
            rt.offsetMax = new Vector2(-padX, -padY);
        }
    }
}
