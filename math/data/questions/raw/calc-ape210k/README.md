---
license: mit
dataset_info:
- config_name: default
  features:
  - name: id
    dtype: string
  - name: question
    dtype: string
  - name: question_chinese
    dtype: string
  - name: chain
    dtype: string
  - name: result
    dtype: string
  - name: result_float
    dtype: float64
  - name: equation
    dtype: string
  splits:
  - name: test
    num_bytes: 1153807
    num_examples: 1785
  - name: train
    num_bytes: 111628273
    num_examples: 195179
  - name: validation
    num_bytes: 1169676
    num_examples: 1783
  download_size: 50706818
  dataset_size: 113951756
- config_name: original-splits
  features:
  - name: id
    dtype: string
  - name: question
    dtype: string
  - name: question_chinese
    dtype: string
  - name: chain
    dtype: string
  - name: result
    dtype: string
  - name: result_float
    dtype: float64
  - name: equation
    dtype: string
  splits:
  - name: test
    num_bytes: 2784396
    num_examples: 4867
  - name: train
    num_bytes: 111628273
    num_examples: 195179
  - name: validation
    num_bytes: 2789481
    num_examples: 4867
  download_size: 52107586
  dataset_size: 117202150
configs:
- config_name: default
  data_files:
  - split: test
    path: data/test-*
  - split: train
    path: data/train-*
  - split: validation
    path: data/validation-*
- config_name: original-splits
  data_files:
  - split: test
    path: original-splits/test-*
  - split: train
    path: original-splits/train-*
  - split: validation
    path: original-splits/validation-*
---

# Dataset Card for Calc-ape210k


## Summary

This dataset is an instance of Ape210K dataset, converted to a simple HTML-like language that can be easily parsed (e.g. by BeautifulSoup). The data contains 3 types of tags:
- gadget: A tag whose content is intended to be evaluated by calling an external tool (sympy-based calculator in this case)
- output: An output of the external tool
- result: The final answer to the mathematical problem (a number)


## Supported Tasks

The dataset is intended for training Chain-of-Thought reasoning **models able to use external tools** to enhance the factuality of their responses.
This dataset presents in-context scenarios where models can outsource the computations in the reasoning chain to a calculator.


## Construction Process

First, we translated the questions into English using Google Translate. Next, we parsed the equations and the results. We linearized
the equations into a sequence of elementary steps and evaluated them using a sympy-based calculator. We numerically compare the output
with the result in the data and remove all examples where they do not match (less than 3% loss in each split). Finally, we save the
chain of steps in the HTML-like language in the `chain` column. We keep the original columns in the dataset for convenience. We also perform
in-dataset and cross-dataset data-leak detection within [Calc-X collection](https://huggingface.co/collections/MU-NLPC/calc-x-652fee9a6b838fd820055483).
Specifically for Ape210k, we removed parts of the validation and test split, with around 1700 remaining in each.

You can read more information about this process in our [Calc-X paper](https://arxiv.org/abs/2305.15017).


## Data splits

The default config contains filtered splits with data leaks removed.
You can load it using:

```python
datasets.load_dataset("MU-NLPC/calc-ape210k")
```

In the `original-splits` config, the data splits are unfiltered and correspond to the original Ape210K dataset. See [ape210k dataset github](https://github.com/Chenny0808/ape210k) and [the paper](https://arxiv.org/abs/2009.11506) for more info.
You can load it using:

```python
datasets.load_dataset("MU-NLPC/calc-ape210k", "original-splits")
```


## Attributes

- **id** - id of the example
- **question** - the description of the math problem. Automatically translated from the `question_chinese` column into English using Google Translate
- **question_chinese** - the original description of the math problem in Chinese
- **chain** - linearized `equation`, sequence of arithmetic steps in HTML-like language that can be evaluated using our sympy-based calculator
- **result** - result as a string (can be an integer, float, or a fraction)
- **result_float** - result, converted to a float
- **equation** - a nested expression that evaluates to the correct answer

Attributes **id**, **question**, **chain**, and **result** are present in all datasets in [Calc-X collection](https://huggingface.co/collections/MU-NLPC/calc-x-652fee9a6b838fd820055483).



## Related work

This dataset was created as a part of a larger effort in training models capable of using a calculator during inference, which we call Calcformers.

- [**Calc-X collection**](https://huggingface.co/collections/MU-NLPC/calc-x-652fee9a6b838fd820055483) - datasets for training Calcformers
- [**Calcformers collection**](https://huggingface.co/collections/MU-NLPC/calcformers-65367392badc497807b3caf5) - calculator-using models we trained and published on HF
- [**Calc-X and Calcformers paper**](https://arxiv.org/abs/2305.15017)
- [**Calc-X and Calcformers repo**](https://github.com/prompteus/calc-x)

Here are links to the original dataset:

- [**original Ape210k dataset and repo**](https://github.com/Chenny0808/ape210k)
- [**original Ape210k paper**](https://arxiv.org/abs/2009.11506)



## Licence

MIT, consistently with the original dataset.


## Cite

If you use this version of the dataset in research, please cite the [original Ape210k paper](https://arxiv.org/abs/2009.11506), and the [Calc-X paper](https://arxiv.org/abs/2305.15017) as follows:

```bibtex
@inproceedings{kadlcik-etal-2023-soft,
    title = "Calc-X and Calcformers: Empowering Arithmetical Chain-of-Thought through Interaction with Symbolic Systems",
    author = "Marek Kadlčík and Michal Štefánik and Ondřej Sotolář and Vlastimil Martinek",
    booktitle = "Proceedings of the The 2023 Conference on Empirical Methods in Natural Language Processing: Main track",
    month = dec,
    year = "2023",
    address = "Singapore, Singapore",
    publisher = "Association for Computational Linguistics",
    url = "https://arxiv.org/abs/2305.15017",
}
```