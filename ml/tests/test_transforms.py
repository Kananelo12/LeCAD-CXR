"""The resized training cache is only valid while these hold. If one fails,
the cache (make_resized_cache.py) no longer matches what the API feeds the
model: rebuild it, or fix prepare_image."""
import numpy as np
import torch
from PIL import Image

from lecad.config import CACHE_SIZE, IMAGE_SIZE
from lecad.transforms import build_transform, prepare_image


def _radiograph_like(mode: str = "L", size: int = 1024) -> Image.Image:
    rng = np.random.default_rng(0)
    pixels = rng.integers(0, 256, size=(size, size), dtype=np.uint8)
    img = Image.fromarray(pixels, mode="L")
    return img.convert(mode)


def test_prepare_image_output():
    out = prepare_image(_radiograph_like())
    assert out.mode == "L"
    assert out.size == (CACHE_SIZE, CACHE_SIZE)


def test_prepare_image_is_idempotent():
    """Training reads cached images and calls prepare_image on them again;
    that second call must change nothing."""
    once = prepare_image(_radiograph_like())
    twice = prepare_image(once)
    assert np.array_equal(np.asarray(once), np.asarray(twice))


def test_cached_and_uploaded_images_give_identical_model_input():
    original = _radiograph_like()
    cached = prepare_image(original)  # what make_resized_cache.py stores
    via_cache = build_transform("eval")(prepare_image(cached))  # training
    via_upload = build_transform("eval")(prepare_image(original))  # API
    assert torch.equal(via_cache, via_upload)
    assert via_upload.shape == (3, IMAGE_SIZE, IMAGE_SIZE)


def test_colour_and_alpha_uploads_are_handled():
    """About 1% of NIH files are RGBA; uploads may be RGB JPEGs."""
    for mode in ("RGB", "RGBA"):
        out = prepare_image(_radiograph_like(mode))
        assert out.mode == "L" and out.size == (CACHE_SIZE, CACHE_SIZE)


def test_train_transform_output_shape():
    x = build_transform("train")(prepare_image(_radiograph_like()))
    assert x.shape == (3, IMAGE_SIZE, IMAGE_SIZE)
