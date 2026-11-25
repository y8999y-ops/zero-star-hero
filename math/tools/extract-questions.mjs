// 讀出下載的原始題庫，統一格式、分學年，輸出「待改寫清單」到 data/questions/work/。
// 用法：在 math/ 底下執行 npm run extract
// 原檔（data/questions/raw/）不會被修改。

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { parquetReadObjects } from "hyparquet";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const RAW = ROOT + "data/questions/raw/";
const OUT = ROOT + "data/questions/work/";
mkdirSync(OUT, { recursive: true });

// ── 學年判定 ──────────────────────────────────────────────
// g1：20 以內加減　g2：100 以內加減　g34：整數乘除　g56：分數、小數、百分比　jh：國中
export function gradeOf(equation) {
  const eq = equation.replace(/^x=/, "");
  const nums = (eq.match(/\d+(\.\d+)?/g) ?? []).map(Number);
  const max = Math.max(0, ...nums);
  const hasMulDiv = /[*/]/.test(eq);
  const hasDecimal = /\d\.\d/.test(eq);
  const hasPercent = /%/.test(eq);
  const hasFraction = /\(\d+\/\d+\)/.test(eq);
  const hasPow = /\^|\*\*/.test(eq);
  if (hasPow) return "jh";
  if (hasDecimal || hasPercent || hasFraction) return "g56";
  if (hasMulDiv) return max <= 10000 ? "g34" : "g56";
  if (max <= 20) return "g1";
  if (max <= 100) return "g2";
  return "g34";
}

// 答案是不是好看的數（整數或最多兩位小數），太醜的不收
function niceAnswer(v) {
  if (!Number.isFinite(v)) return false;
  return Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;
}

async function readParquet(file) {
  const buf = readFileSync(file);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return parquetReadObjects({ file: ab });
}

// ── Calc-ape210k（國小應用題） ────────────────────────────
const ape = [];
for (const split of ["test", "validation"]) {
  const rows = await readParquet(`${RAW}calc-ape210k/${split}.parquet`);
  for (const r of rows) {
    const answer = Number(r.result_float);
    if (!niceAnswer(answer)) continue;
    ape.push({
      id: r.id,
      source: "calc-ape210k",
      grade: gradeOf(r.equation),
      original: r.question_chinese,
      equation: r.equation,
      answer: Number(answer.toFixed(2)),
    });
  }
}

// ── TMMLU+ 國中數學（選擇題） ─────────────────────────────
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.length > 1);
}

// 原始資料裡次方、分數格式壞掉的題目先標記，之後改寫時人工判斷要修還是丟掉
function looksBroken(text) {
  return /\)\d/.test(text) // (3x − 2)2 這種次方
    || /[a-z]\d(?!\d*[\s.,，。)])/i.test(text) // x2 這種次方
    || /−\d{2,}(?!\d)/.test(text) && /分數|分之/.test(text) === false && /\b−1\d\b/.test(text);
}

const tm = [];
for (const split of ["dev", "train", "val", "test"]) {
  const [head, ...rows] = parseCsv(readFileSync(`${RAW}tmmluplus/junior_math_exam_${split}.csv`, "utf8"));
  rows.forEach((cells, i) => {
    const r = Object.fromEntries(head.map((h, j) => [h, cells[j]]));
    const choices = [r.A, r.B, r.C, r.D];
    tm.push({
      id: `tmmluplus__${split}_${String(i).padStart(3, "0")}`,
      source: "tmmluplus",
      grade: "jh",
      original: r.question,
      choices,
      answer: r.answer,
      maybeBroken: looksBroken([r.question, ...choices].join(" ")),
    });
  });
}

writeFileSync(OUT + "calc-ape210k.json", JSON.stringify(ape, null, 1));
writeFileSync(OUT + "tmmluplus.json", JSON.stringify(tm, null, 1));

const count = (list) => list.reduce((m, q) => ((m[q.grade] = (m[q.grade] ?? 0) + 1), m), {});
console.log("calc-ape210k", ape.length, count(ape));
console.log("tmmluplus", tm.length, "可能格式壞掉", tm.filter((q) => q.maybeBroken).length);
