# TMMLU+（國中數學）

- 來源：https://huggingface.co/datasets/ikala/tmmluplus （iKala AI Lab，論文 arXiv:2403.01858）
- 檔案：`data/junior_math_exam_{dev,train,val,test}.csv`，以及原始 `README.md`
- 授權：MIT（見 README.md 的 Licensing Information，使用時要保留原作者版權聲明）
- 下載日期：2026-11-25
- 內容：國中數學四選一選擇題，繁體中文，共 185 題（dev 4、train 5、val 17、test 159）
- 欄位：`question, A, B, C, D, answer`
- 已知問題：原始資料裡次方、分數的格式已經壞掉，例如「(3x − 2)2」其實是平方，「−12」其實是 −½。轉換時要篩掉這類題目或修正，修正寫在 `math/tools/` 的修正表裡，不改這裡的原檔。
