from __future__ import annotations

from pathlib import Path

from lecad.serving.settings import REPO_ROOT, resolve_model_path


def test_repo_root_is_the_repository():
    assert (REPO_ROOT / "ml" / "pyproject.toml").is_file()


def test_relative_model_path_is_from_the_repo_root_not_the_cwd(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    rel = "ml/models/model_sens90.pt"
    assert resolve_model_path(rel) == REPO_ROOT / rel


def test_absolute_model_path_is_kept(tmp_path):
    p = tmp_path / "m.pt"
    assert resolve_model_path(str(p)) == p


def test_the_deployed_model_ships_with_the_repo():
    assert resolve_model_path("ml/models/model_sens90.pt").is_file(), (
        "ml/models/model_sens90.pt is missing; the README's run steps depend on it")
    assert Path(REPO_ROOT / "ml/models/model_sens90.pt").stat().st_size > 1_000_000
