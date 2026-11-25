# Calc-ape210k（國小應用題）

- 來源：https://huggingface.co/datasets/MU-NLPC/Calc-ape210k （Ape210K 的整理版，作者 MU-NLPC）
- 檔案：`data/test-…parquet` → `test.parquet`，`data/validation-…parquet` → `validation.parquet`，以及原始 `README.md`
- 授權：MIT（見 README.md 的 Licence 一節，與原始 Ape210K 相同；使用時要保留原作者版權聲明）
- 下載日期：2026-11-25
- 內容：國小數學應用題，簡體中文，test 1,785 題、validation 1,783 題，共 3,568 題。另有 train 約 19.5 萬題（約 50 MB），還沒下載。
- 欄位：`id, question（英譯）, question_chinese（原題）, chain（計算步驟）, result, result_float, equation`
- 轉換時要做的事：簡體轉繁體、中國用語換成台灣用語（千克→公斤、米→公尺、元的用法等），並依數字大小、運算種類分到各學年。
