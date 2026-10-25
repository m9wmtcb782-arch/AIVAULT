"""AIVAULT Dark Star：虛擬痛覺神經研究套件。

仿生神經模擬 ≠ 主觀疼痛經驗；現階段僅虛擬環境，不控制實體硬體。
"""
from .nociception_core import NociceptionCore, NociceptiveEvent, BodySite

__all__ = ["NociceptionCore", "NociceptiveEvent", "BodySite"]
__version__ = "0.2.0"
