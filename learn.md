"AP" and "PA" describe **which direction the X-ray beam passes through the chest.** It matters a lot for this dataset.

## PA vs AP

An X-ray image is a shadow: the beam comes from a tube on one side of the patient, passes through the body, and lands on a detector on the other side.

| | **PA (posteroanterior)** | **AP (anteroposterior)** |
|---|---|---|
| Beam direction | From **back** (posterior) to **front** (anterior) | From **front** to **back** |
| How it's taken | Patient **standing**, chest pressed against the detector | Patient often **lying or sitting in bed**, detector behind their back |
| Where | The X-ray department | Usually **at the bedside** with a portable machine (wards, ICU) |
| Who | Typically outpatients, people well enough to stand | Typically **sicker, hospitalised patients** |
| Image quality | The standard, best-quality view | Harder to read |

**Why AP images are harder:**
- **The heart looks bigger.** On an AP film the heart is further from the detector, so its shadow is magnified, much like your hand's shadow growing when you move it towards a torch. That makes Cardiomegaly (enlarged heart) harder to judge.
- **Lying down changes the picture.** Fluid and air settle differently when a patient is flat, so effusions and pneumothoraces look different than when they're standing.
- **Equipment gets in the way.** Bedside patients often have ECG leads, tubes and lines across the chest; you saw these in the EDA example grid.
- **Positioning is harder,** so the patient may be rotated or the exposure poor.

In your validation set, **65% of images are PA and 35% AP.**

## Why we keep checking it: shortcut learning

Sick patients get AP films, and sick patients have more disease. So in this dataset, "the film is AP" is itself a clue that disease is present. The EDA found **Edema is 11 times more common on AP films** than on PA films.

A neural network looks for **any** pattern that predicts the label. It could learn to detect the *type of film* (portable-X-ray look, ECG wires, a lying posture) instead of actually seeing fluid in the lungs. That's called **shortcut learning**. The model scores well on this dataset but would fail somewhere where the link doesn't hold, such as a clinic in Lesotho where everyone is X-rayed differently.

**How we tested for it:** within PA films only, every image is PA, so the type of film can't help; the same goes for AP only. If a model relied on the shortcut, its score on **all films mixed** would come out clearly *higher* than on either type alone.

**What we found:**
- **Consolidation:** yes, mildly, in all three models (about +0.03 AUC from mixing). That's your clearest shortcut finding.
- **Edema:** no consistent sign, despite being the most AP-skewed finding.
- **Every finding scores well above chance within a single type of film,** so the models are genuinely reading the lungs, not only the type of film.
- **All models do worse on AP films** (about 0.77–0.80 against 0.82–0.83 on PA). That's expected, because AP films are harder to read.

## Other terms we've been using

**AUC (Area Under the ROC Curve)** is the main score. Take one random image *with* a disease and one *without*: AUC is how often the model gives the diseased one the higher score. 0.5 is a coin flip and 1.0 is perfect. Your models score about **0.83 on average**, ranging from about 0.70 (Infiltration) to about 0.96 (Hernia).

**Macro AUC** is the AUC worked out separately for each of the 14 diseases, then averaged. Every disease counts equally, so rare diseases aren't drowned out by common ones.

**Validation set vs test set.** Your data is split three ways:
- **Training** (73,499 images): the model learns from these.
- **Validation** (13,025): used to make decisions, such as which epoch is best and which architecture to choose. All the numbers so far are validation numbers.
- **Test** (25,596): locked away and used **once**, at the end. Because none of your decisions were based on it, it gives an honest estimate of real performance. Looking earlier and then adjusting anything would bias it.

**Split by patient.** Many patients have several X-rays. If one person's images landed in both training and validation, the model would partly be recognising *that person*, and scores would look better than they are. So every patient's images all go to one side.

**Epoch, overfitting and early stopping:**
- **Epoch:** one full pass through all the training images.
- **Overfitting:** after a few epochs, the model starts *memorising* the training images instead of learning general patterns. Training loss keeps falling while validation AUC starts falling. Your baseline peaked at epoch 4 of 15.
- **Early stopping:** stop once validation AUC hasn't improved for 3 epochs. It saved about half the GPU time on runs 2 and 3, with no loss in quality.

**Confidence interval (CI)** is a range of plausible values for a score. Validation has only 13,025 images from 4,201 patients, and a different sample of patients would give slightly different numbers. "0.8297 [0.8210, 0.8376]" means the true value is very probably between 0.821 and 0.838.

**Bootstrap** is how those intervals were calculated. Re-draw the 4,201 validation patients at random, with replacement, 2,000 times. Score all three models on each redraw, and see how much the scores, and the gaps between models, move around. If a model wins in at least 97.5% of redraws, the difference is real. Ours won in at most 80–93%, so the architectures are statistically **tied**.

**Why Hernia keeps getting a warning:** validation has only **22** Hernia cases overall, and just **2** on AP films. With 2 examples, a model getting both "right" or "wrong" swings its AUC from 0.6 to 0.95 by luck. That's why EfficientNet's AP advantage dissolved once Hernia was left out.

**Sensitivity and specificity** need a cut-off ("flag this disease if the score is above X"):
- **Sensitivity:** of the people *with* the disease, how many were flagged.
- **Specificity:** of the people *without* it, how many were correctly *not* flagged.

Raising one lowers the other. The cut-offs were chosen on validation, so these two numbers look slightly better there than they will on the test set.

**PR-AUC** is like AUC, but focused on how many flags are correct when a disease is rare. It's much lower for your models (about 0.24). That's normal when most images don't have a given disease, but it's worth stating honestly: a flag from the model is often a false alarm, which is why the app presents results as decision support for a clinician.

## The current situation, in one paragraph

You trained three standard architectures on 73,499 chest X-rays. All three reach about **0.83 macro AUC** on validation, inside the published range for this dataset. The bootstrap shows they're **statistically equivalent**, including on the harder bedside films. There's mild evidence of shortcut learning for Consolidation, but every model genuinely reads the lungs. What's left: choose one model, with a stated reason; open the test set once for the honest final number; and connect that model to the app.