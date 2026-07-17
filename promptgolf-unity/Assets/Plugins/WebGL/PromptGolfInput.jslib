mergeInto(LibraryManager.library, {
  PG_ShowInput: function(idPtr, x, yTop, w, h, fontFrac, placeholderPtr, multiline) {
    var id = UTF8ToString(idPtr);
    var placeholder = UTF8ToString(placeholderPtr);
    var canvas = document.querySelector('#unity-canvas') || document.querySelector('canvas');
    if (!canvas) return;
    var rect = canvas.getBoundingClientRect();
    var el = document.getElementById('pg-input-' + id);
    if (!el) {
      el = document.createElement(multiline ? 'textarea' : 'input');
      el.id = 'pg-input-' + id;
      el.style.position = 'absolute';
      el.style.zIndex = '100';
      el.style.border = 'none';
      el.style.borderRadius = '3px';
      el.style.background = 'rgba(255,255,255,0.97)';
      el.style.color = '#101820';
      el.style.padding = '8px 12px';
      el.style.boxSizing = 'border-box';
      el.style.fontFamily = "'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
      el.style.resize = 'none';
      el.style.outline = 'none';
      document.body.appendChild(el);
    }
    el.placeholder = placeholder;
    el.style.left = (rect.left + window.scrollX + rect.width * x) + 'px';
    el.style.top = (rect.top + window.scrollY + rect.height * yTop) + 'px';
    el.style.width = (rect.width * w) + 'px';
    el.style.height = (rect.height * h) + 'px';
    el.style.fontSize = (rect.height * fontFrac) + 'px';
    el.style.display = 'block';
  },
  PG_HideInput: function(idPtr) {
    var el = document.getElementById('pg-input-' + UTF8ToString(idPtr));
    if (el) el.style.display = 'none';
  },
  PG_GetInputValue: function(idPtr) {
    var el = document.getElementById('pg-input-' + UTF8ToString(idPtr));
    var val = el ? el.value : '';
    var size = lengthBytesUTF8(val) + 1;
    var buf = _malloc(size);
    stringToUTF8(val, buf, size);
    return buf;
  },
  PG_SetInputValue: function(idPtr, valPtr) {
    var el = document.getElementById('pg-input-' + UTF8ToString(idPtr));
    if (el) el.value = UTF8ToString(valPtr);
  },
  PG_SetInputEnabled: function(idPtr, enabled) {
    var el = document.getElementById('pg-input-' + UTF8ToString(idPtr));
    if (el) el.disabled = (enabled === 0);
  }
});
