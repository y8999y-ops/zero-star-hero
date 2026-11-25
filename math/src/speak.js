// 題目朗讀（待辦 G4）：用瀏覽器內建的語音（speechSynthesis），不用下載檔案。
// 算式符號改成念得出來的字：＋ 加、－ 減、× 乘以、÷ 除以、＝？ 等於多少；3/4 念「4 分之 3」、2又3/4 念「2 又 4 分之 3」；千分位逗號拿掉。
// 網址有 ?mute 或設定靜音時不念。

const MUTE_URL = new URLSearchParams(location.search).has("mute");
export const canSpeak = () => typeof speechSynthesis !== "undefined" && typeof SpeechSynthesisUtterance !== "undefined";

export function speakable(text) {
  return String(text ?? "")
    .replace(/(\d),(?=\d{3})/g, "$1")
    .replace(/(\d+)又(\d+)\/(\d+)/g, "$1又$3分之$2")
    .replace(/(\d+)\/(\d+)/g, "$2分之$1")
    .replace(/＝\s*？/g, "等於多少").replace(/＝/g, "等於").replace(/？/g, "")
    .replace(/＋/g, "加").replace(/[－−-]/g, "減").replace(/×/g, "乘以").replace(/÷/g, "除以")
    .replace(/□/g, "空格").replace(/[（(]/g, "括號，").replace(/[）)]/g, "，括號完，")
    .replace(/(\d+):(\d\d)/g, "$1點$2分");
}

let voice = null;
function pickVoice() {
  if (voice || !canSpeak()) return voice;
  const vs = speechSynthesis.getVoices();
  voice = vs.find((v) => /zh[-_]TW/i.test(v.lang)) ?? vs.find((v) => /zh/i.test(v.lang)) ?? null;
  return voice;
}
if (canSpeak()) speechSynthesis.addEventListener?.("voiceschanged", () => { voice = null; pickVoice(); });

/** 念一段文字（會先停掉正在念的） */
export function speak(text, muted = false) {
  if (!canSpeak() || MUTE_URL || muted) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(speakable(text));
  u.lang = "zh-TW"; u.rate = 0.9;
  const v = pickVoice(); if (v) u.voice = v;
  speechSynthesis.speak(u);
}
export const stopSpeak = () => { if (canSpeak()) speechSynthesis.cancel(); };
