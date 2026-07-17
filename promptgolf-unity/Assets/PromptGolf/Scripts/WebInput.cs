using UnityEngine;
#if UNITY_WEBGL && !UNITY_EDITOR
using System.Runtime.InteropServices;
#endif

namespace PromptGolf
{
    /// <summary>
    /// WebGL 한글 입력 우회: Unity WebGL의 CJK IME 결함을 피해
    /// 브라우저 네이티브 input/textarea를 캔버스 위에 오버레이한다.
    /// 좌표는 캔버스 기준 정규화(0~1) 값. 에디터/데스크톱에서는 no-op.
    /// </summary>
    public static class WebInput
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] static extern void PG_ShowInput(string id, float x, float yTop, float w, float h, float fontFrac, string placeholder, int multiline);
        [DllImport("__Internal")] static extern void PG_HideInput(string id);
        [DllImport("__Internal")] static extern string PG_GetInputValue(string id);
        [DllImport("__Internal")] static extern void PG_SetInputValue(string id, string val);
        [DllImport("__Internal")] static extern void PG_SetInputEnabled(string id, int enabled);

        public static bool Available { get { return true; } }
        public static void Show(string id, float x, float yTop, float w, float h, float fontFrac, string placeholder, bool multiline)
        {
            PG_ShowInput(id, x, yTop, w, h, fontFrac, placeholder, multiline ? 1 : 0);
        }
        public static void Hide(string id) { PG_HideInput(id); }
        public static string GetValue(string id) { return PG_GetInputValue(id); }
        public static void SetValue(string id, string val) { PG_SetInputValue(id, val); }
        public static void SetEnabled(string id, bool enabled) { PG_SetInputEnabled(id, enabled ? 1 : 0); }
        /// <summary>Unity의 전역 키보드 캡처 해제 — HTML 오버레이가 일반 키 입력을 받게 한다.</summary>
        public static void ReleaseKeyboard() { UnityEngine.WebGLInput.captureAllKeyboardInput = false; }
#else
        public static bool Available { get { return false; } }
        public static void Show(string id, float x, float yTop, float w, float h, float fontFrac, string placeholder, bool multiline) { }
        public static void Hide(string id) { }
        public static string GetValue(string id) { return ""; }
        public static void SetValue(string id, string val) { }
        public static void SetEnabled(string id, bool enabled) { }
        public static void ReleaseKeyboard() { }
#endif

        /// <summary>오버레이 캔버스 기준 RectTransform → 브라우저 정규화 좌표.</summary>
        public static void GetNormalizedRect(RectTransform rt, out float x, out float yTop, out float w, out float h)
        {
            var corners = new Vector3[4];
            rt.GetWorldCorners(corners); // Screen Space Overlay: 픽셀 좌표, [0]=좌하 [2]=우상
            float sw = Screen.width, sh = Screen.height;
            x = corners[0].x / sw;
            w = (corners[2].x - corners[0].x) / sw;
            yTop = 1f - corners[2].y / sh;
            h = (corners[2].y - corners[0].y) / sh;
        }
    }
}