import sys
from pathlib import Path
import pytest
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from data_io import load_directory,integrate
from scoring import score_dataset

@pytest.fixture
def demo():
    return load_directory(ROOT/'demo_data')

@pytest.fixture
def joined(demo):
    return integrate(demo,'2026-09-30','2026-10-10')

@pytest.fixture
def scored(joined):
    return score_dataset(joined)
