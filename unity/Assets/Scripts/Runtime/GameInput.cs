// game/src/input.js 翻成 C#：鍵盤＋滑鼠＋觸控，統一成同一組狀態。
// Move：-1..1；Attack：按住中；Jump／Drop／Dash／Skill：這一步剛按下（有 0.15 秒的輸入緩衝，用了要 Consume）。
// 鍵盤事件用網頁的按鍵名（KeyD、Space…），比對測試可以直接餵同一串按鍵。
using System;
using System.Collections.Generic;

namespace ZeroStar
{
    public class GameInput
    {
        public double Move;
        public bool Attack, Absorb, JumpHeld, Down, Air;
        public bool Jump, Drop, Dash, Skill, Ult;

        const double BUFFER = 0.15;
        readonly Dictionary<string, double> pressed = new Dictionary<string, double> { ["jump"] = 0, ["drop"] = 0, ["dash"] = 0, ["skill"] = 0, ["ult"] = 0 };
        static readonly string[] KEYS = { "jump", "drop", "dash", "skill", "ult" };
        bool kLeft, kRight, kDown, kAttack, kMouse, kAbsorb;
        public double TouchMove; public bool TouchAttack, TouchAbsorb;

        public void Press(string k) { pressed[k] = BUFFER; }

        public void Tick(double dt)
        {
            foreach (var k in KEYS)
            {
                Set(k, pressed[k] > 0);
                pressed[k] = Math.Max(0, pressed[k] - dt);
            }
            Move = Math.Max(-1, Math.Min(1, ((kRight ? 1 : 0) - (kLeft ? 1 : 0)) + TouchMove));
            Attack = kAttack || kMouse || TouchAttack;
            Absorb = kAbsorb || TouchAbsorb;
            Down = kDown;
        }
        void Set(string k, bool v)
        {
            switch (k) { case "jump": Jump = v; break; case "drop": Drop = v; break; case "dash": Dash = v; break; case "skill": Skill = v; break; case "ult": Ult = v; break; }
        }
        /// 這個動作已經用掉了，清除緩衝
        public void Consume(string k) { pressed[k] = 0; Set(k, false); }

        static bool IsJumpKey(string c) => c == "KeyW" || c == "Space" || c == "ArrowUp" || c == "KeyZ";
        public void KeyDown(string code)
        {
            switch (code)
            {
                case "KeyA": case "ArrowLeft": kLeft = true; break;
                case "KeyD": case "ArrowRight": kRight = true; break;
                case "KeyS": case "ArrowDown": kDown = true; break;
                case "KeyJ": case "KeyX": kAttack = true; break;
                case "KeyF": kAbsorb = true; break;
            }
            if (IsJumpKey(code)) { if (kDown) Press("drop"); else Press("jump"); JumpHeld = true; }
            if (code == "KeyK" || code == "ShiftLeft" || code == "KeyC") Press("dash");
            if (code == "KeyE" || code == "KeyU" || code == "KeyV") Press("skill");
            if (code == "KeyQ" || code == "KeyL" || code == "KeyB") Press("ult");
        }
        public void KeyUp(string code)
        {
            switch (code)
            {
                case "KeyA": case "ArrowLeft": kLeft = false; break;
                case "KeyD": case "ArrowRight": kRight = false; break;
                case "KeyS": case "ArrowDown": kDown = false; break;
                case "KeyJ": case "KeyX": kAttack = false; break;
                case "KeyF": kAbsorb = false; break;
            }
            if (IsJumpKey(code)) JumpHeld = false;
        }
        public void Mouse(bool left) { kMouse = left; }
        public void ReleaseAll() { kLeft = kRight = kDown = kAttack = kMouse = kAbsorb = false; TouchAttack = TouchAbsorb = false; TouchMove = 0; JumpHeld = false; }
    }
}
