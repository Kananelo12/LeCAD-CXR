# Notebooks

Notebooks are for **looking at things**: exploratory data analysis, plotting
results, sanity-checking a trained model's Grad-CAM output.

Notebooks are **not** for logic that runs twice. Anything a second person —
or the API, or a rerun three months from now — needs to execute lives in
`ml/src/lecad/` and is *imported* here:

```python
import sys; sys.path.insert(0, "../src")
from lecad.splits import load_split_frame
from lecad.data import build_loader

df = load_split_frame()
df.groupby("split").size()
```

Why the discipline:

- The API cannot `import` from a `.ipynb`. Preprocessing therefore has to
  live in a module, or training and serving will drift apart.
- Notebooks execute out of order and carry hidden state. A cell you deleted
  may still be defining a variable. This produces results you cannot
  reproduce, which is fatal for a dissertation.
- `git diff` on a notebook is unreadable — outputs and execution counts
  churn on every save.

**Suggested notebooks**

| file | purpose |
|---|---|
| `01_eda.ipynb` | label prevalence, co-occurrence, patient/age/view distributions |
| `02_image_checks.ipynb` | look at actual radiographs; hunt for burned-in text markers |
| `03_results.ipynb` | ROC curves, confusion matrices, Grad-CAM panels for the write-up |

Run EDA on **train and validation only**. The test set stays closed.
