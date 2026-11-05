// 輸入：鍵盤＋觸控，統一成同一組狀態。
// move: -1..1；attack: 按住中；jump / drop / dash / skill: 這一幀剛按下（讀完要用 consume 清掉）

export const input = { move: 0, attack: false, jumpHeld: false, jump: false, drop: false, dash: false, skill: false, ult: false, form: false, form1: false, form2: false, form3: false, down: false };

const pressed = { jump: 0, drop: 0, dash: 0, skill: 0, ult: 0, form: 0, form1: 0, form2: 0, form3: 0 };
// 按下的瞬間如果角色剛好動不了，保留一小段時間（輸入緩衝），手感會比較跟手
const BUFFER = 0.15;
const press = (k) => (pressed[k] = BUFFER);

export function tickInput(dt) {
  for (const k in pressed) {
    input[k] = pressed[k] > 0;
    pressed[k] = Math.max(0, pressed[k] - dt);
  }
  input.move = clampMove(keyMove() + touch.move);
  input.attack = keys.attack || keys.mouse || touch.attack;
  input.down = keys.down;
}
/** 這個動作已經用掉了，清除緩衝。 */
export const consume = (k) => { pressed[k] = 0; input[k] = false; };
const clampMove = (v) => Math.max(-1, Math.min(1, v));

// ---- 鍵盤
const keys = { left: false, right: false, down: false, attack: false, mouse: false };
const MAP = {
  KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right", KeyS: "down", ArrowDown: "down",
  KeyJ: "attack", KeyX: "attack",
};
const keyMove = () => (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
addEventListener("keydown", (e) => {
  if (e.repeat) return;
  const k = MAP[e.code];
  if (k) keys[k] = true;
  if (e.code === "KeyW" || e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyZ") {
    if (keys.down) press("drop");
    else press("jump");
    input.jumpHeld = true;
  }
  if (e.code === "KeyK" || e.code === "ShiftLeft" || e.code === "KeyC") press("dash");
  if (e.code === "KeyE" || e.code === "KeyU" || e.code === "KeyV") press("skill");
  if (e.code === "KeyQ" || e.code === "KeyL" || e.code === "KeyB") press("ult");
  if (e.code === "KeyO") press("form");
  if (e.code === "Digit1" || e.code === "Digit2" || e.code === "Digit3") press("form" + e.code.slice(5));
  if (k || ["Space", "ArrowUp", "ArrowDown"].includes(e.code)) e.preventDefault();
});
addEventListener("keyup", (e) => {
  const k = MAP[e.code];
  if (k) keys[k] = false;
  if (e.code === "KeyW" || e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyZ") input.jumpHeld = false;
});
// ---- 滑鼠（電腦）：左鍵攻擊（按住連段）、右鍵衝刺。只算點在遊戲畫面上的，點介面（按鈕、視窗）不算
const onField = (t) => t?.id === "screen" || (t?.closest?.("#touch") && !t.closest(".btn"));
let lastTouch = -1e9;   // 手機點一下也會補發 mousedown，剛摸過螢幕就不算滑鼠
addEventListener("touchstart", () => (lastTouch = performance.now()), { passive: true, capture: true });
addEventListener("mousedown", (e) => {
  if (performance.now() - lastTouch < 800 || !onField(e.target)) return;
  if (e.button === 0) keys.mouse = true;
  else if (e.button === 2) { press("dash"); e.preventDefault(); }
});
addEventListener("contextmenu", (e) => onField(e.target) && e.preventDefault());   // 右鍵＝衝刺，不跳出選單
addEventListener("mouseup", (e) => { if (e.button === 0) keys.mouse = false; });
addEventListener("blur", () => { for (const k in keys) keys[k] = false; touch.attack = false; touch.move = 0; });

// ---- 觸控
const touch = { move: 0, attack: false };
const DEAD = 10;        // 拖動多少 px 才開始走
const FULL = 38;        // 拖動多少 px 算全速
const FOLLOW = 60;      // 手指拖超過這個距離，搖桿中心跟著手指走（浮動搖桿）
const SWIPE = 26;       // 往上／往下快滑多少 px 算一次
const SWIPE_AIR = 16;   // 空中的二段跳滑動，距離放寬
const SWIPE_TIME = 0.18;

export function initTouch() {
  const zone = document.getElementById("leftZone");
  const base = document.getElementById("stickBase"), knob = document.getElementById("stickKnob");
  let id = null, ax = 0, ay = 0, hist = [], lock = 0;   // lock：剛滑出一跳，一小段時間內不連發（一次長滑不會變成兩段跳）
  const showStick = (x, y, kx) => {
    base.style.left = ax + "px";
    base.style.top = ay + "px";
    knob.style.transform = `translate(${kx}px, ${Math.max(-30, Math.min(30, y - ay))}px)`;
  };
  zone.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;   // 滑鼠左鍵＝攻擊，不叫出搖桿
    // 在空中點一下左半邊＝二段跳（抬手再點，或另一根手指點都可以）
    if (input.air) { press("jump"); input.jumpHeld = true; }
    if (id !== null) return;
    id = e.pointerId;
    try { zone.setPointerCapture(id); } catch {}
    const r = zone.getBoundingClientRect();
    ax = e.clientX - r.left;
    ay = e.clientY - r.top;
    hist = [{ y: e.clientY, t: e.timeStamp }];
    base.classList.add("on");
    showStick(ax, ay, 0);
    document.getElementById("hintLeft").style.opacity = 0;
  });
  zone.addEventListener("pointermove", (e) => {
    if (e.pointerId !== id) return;
    const r = zone.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let dx = x - ax;
    if (Math.abs(dx) > FOLLOW) { ax += dx - Math.sign(dx) * FOLLOW; dx = x - ax; }
    touch.move = Math.abs(dx) < DEAD ? 0 : Math.sign(dx) * Math.min(1, (Math.abs(dx) - DEAD) / (FULL - DEAD) * 0.6 + 0.4);
    // 垂直快滑：跟一小段時間前的位置比
    const now = e.timeStamp;
    hist.push({ y: e.clientY, t: now });
    while (hist.length > 2 && now - hist[0].t > SWIPE_TIME * 1000) hist.shift();
    // 往上滑跟這段時間內「最低」的點比：手指先拉回來再往上滑也算；往下滑跟最高點比
    const up = e.clientY - Math.max(...hist.map((h) => h.y)), down = e.clientY - Math.min(...hist.map((h) => h.y));
    if (up < -(input.air ? SWIPE_AIR : SWIPE) && now > lock) { press("jump"); lock = now + 220; input.jumpHeld = true; hist = [{ y: e.clientY, t: now }]; ay = y; }
    // 空中往下滑不算下跳，才能放心把手指拉回來再滑一次
    else if (down > SWIPE && !input.air) { press("drop"); hist = [{ y: e.clientY, t: now }]; ay = y; }
    showStick(ax, y, Math.max(-34, Math.min(34, dx)));
  });
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    touch.move = 0;
    input.jumpHeld = false;
    base.classList.remove("on");
  };
  zone.addEventListener("pointerup", end);
  zone.addEventListener("pointercancel", end);
  zone.addEventListener("lostpointercapture", end);   // 對話打開時觸控層停用，手指還按著也要放開

  for (const btn of document.querySelectorAll(".btn")) {
    const k = btn.dataset.key;
    btn.addEventListener("pointerdown", (e) => {
      try { btn.setPointerCapture(e.pointerId); } catch {}
      btn.classList.add("on");
      if (k === "attack") touch.attack = true;
      else press(k);
      navigator.vibrate?.(8);
    });
    const up = () => { btn.classList.remove("on"); if (k === "attack") touch.attack = false; };
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("lostpointercapture", up);
  }
  addEventListener("contextmenu", (e) => e.preventDefault());
}
/** 對話打開時呼叫：放開所有觸控（按著的攻擊鍵、搖桿），不然對話結束後第一次按會沒反應、按鈕一直亮著 */
export function releaseTouch() {
  touch.attack = false;
  touch.move = 0;
  for (const b of document.querySelectorAll(".btn.on")) b.classList.remove("on");
  document.getElementById("stickBase")?.classList.remove("on");
}
