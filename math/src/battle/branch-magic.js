// 分支魔法（企劃書 8.5，2026-11-25 配合中年級十個單元重新分配）：某個單元的熟練度到 ★3，就學會那個單元的戰鬥小技。
// 每場戰鬥每一招只能用一次；效果都很小，不會幫你答題（企劃書 8.1：成長不能取代算數學）。
//   heal   回復：魔力＋1
//   shield 護陣：下一次答錯不扣魔力
//   double 分身：下一題答對，王的護盾多打掉一格（一般戰鬥：連擊多加一）
//   cut    消去：劈掉這一題的一個錯誤選項
//   retry  回流：這一題答錯可以再選一次
//   slow   慢流：這一題的時間多一倍
//   hint   預知：頁頁說出這一題的第一步

export const BRANCH_MAGIC = {
  big: { name: "回復", fx: "heal", desc: "魔力＋1" },
  mul: { name: "分身", fx: "double", desc: "下一題答對，王的護盾多打掉一格" },
  div: { name: "護陣", fx: "shield", desc: "下一次答錯不扣魔力" },
  mix: { name: "消去", fx: "cut", desc: "劈掉這一題的一個錯誤選項" },
  frac: { name: "回流", fx: "retry", desc: "這一題答錯可以再選一次" },
  dec: { name: "回復", fx: "heal", desc: "魔力＋1" },
  shape: { name: "護陣", fx: "shield", desc: "下一次答錯不扣魔力" },
  measure: { name: "慢流", fx: "slow", desc: "這一題的時間多一倍" },
  round: { name: "消去", fx: "cut", desc: "劈掉這一題的一個錯誤選項" },
  seq: { name: "預知", fx: "hint", desc: "頁頁說出這一題的第一步" },
};

/** 已經學會的分支魔法（熟練度 ★3 以上） */
export const learnedMagic = (s) => Object.keys(BRANCH_MAGIC).filter((b) => (s.branches?.[b]?.best ?? 0) >= 3);
