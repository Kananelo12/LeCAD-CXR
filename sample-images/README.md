# Sample chest X-rays for testing

75 chest X-rays from the NIH ChestX-ray14 dataset for trying the system:
five for each of the 14 findings, and five labelled *No Finding*. Each
folder is named after the finding its images are labelled with.

`labels.csv` lists every image with its label, the patient's age and sex,
the radiologist's box where one exists, and what the deployed model
(`densenet121-00cd10b12611`) shows for it. Compare the app's result with
that file.

## How the images were chosen

The selection was made by fixed rules and a seeded shuffle, not by looking
at the model's output, so the set does not favour images the model gets
right. Every image:

- is from the NIH's **held-out test set** (`test_list.txt`), so the model
  never saw it during training or tuning;
- has **exactly one** label, so it is clear which finding should appear;
- is a frontal **PA** view of an **adult** (18 to 90), as the app expects;
- comes from a different patient within its folder.

For the eight findings that have them (Atelectasis, Cardiomegaly,
Effusion, Infiltration, Mass, Nodule, Pneumonia, Pneumothorax), every image
has a **bounding box drawn by a radiologist** (`BBox_List_2017.csv`), so
both the label and its location were checked by a person. The labels of
the other images were mined from radiology reports by software; the NIH
estimates that over 90% of those labels are correct, so a few may be wrong.
*No Finding* means none of the 14 patterns was reported, not that the film
is certainly normal.

The box is given as x, y, width and height in pixels on the 1024 × 1024
image, measured from the top left. Compare it with the Grad-CAM heatmap
for that finding.

## What to expect

The model was set to **90% sensitivity**: it is tuned to miss as few
findings as possible, at the cost of flagging many that are not there.
On these 75 images:

| | Result |
|---|---|
| The labelled finding is under *Review suggested* | 63 of 70 |
| ...under *Weaker signal* instead | 4 of 70 |
| ...not flagged | 3 of 70 (1 Edema, 2 Hernia) |
| The labelled finding is the strongest flag | 15 of 70 |
| ...among the three strongest | 39 of 70 |
| Findings under *Review suggested* per image | about 9 of 14, including on *No Finding* images |

So the right finding is almost always flagged, but rarely alone. This is
the trade-off described in the dissertation (sections 4.5.1 and 5.8).
Pneumothorax, Emphysema, Fibrosis and Mass usually come first; Atelectasis
and Infiltration are flagged but rank low. Hernia is the least reliable.
These figures come from 75 images and only illustrate what the app does.
The model's measured performance is the test-set evaluation in
`docs/results-and-findings.md`.

## Source

Wang, X., Peng, Y., Lu, L., Lu, Z., Bagheri, M. and Summers, R.M. (2017)
*ChestX-ray8: Hospital-scale Chest X-ray Database and Benchmarks on
Weakly-Supervised Classification and Localization of Common Thorax
Diseases.* IEEE CVPR, pp. 3462–3471. The images are released by the NIH
Clinical Center for public use and are de-identified.
