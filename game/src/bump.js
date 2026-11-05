// 數字變化時跳一下（第 7 批）：變多＝往上跳＋閃亮色，變少＝往下沉＋閃紅。
/** 設定數字文字；跟原本不同就播動畫 */
export function setNum(el, v) {
  if (!el) return;
  const s = String(v), old = el.textContent;
  if (s === old) return;
  el.textContent = s;
  if (old === "") return;
  bump(el, parseFloat(s) >= parseFloat(old));
}
export function bump(el, up = true) {
  el.classList.remove("bump-up", "bump-dn");
  void el.offsetWidth;
  el.classList.add(up ? "bump-up" : "bump-dn");
}
