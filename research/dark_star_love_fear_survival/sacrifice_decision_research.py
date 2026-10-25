"""極端利他／犧牲決策研究模組。

禁止「愛越深越必須死」公式。
實體高風險仍獨立硬體安全層（本階段僅虛擬標記）。
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List


@dataclass
class SacrificeResearchResult:
    considered: bool
    selected_extreme: bool
    love_depth: float
    reasons: List[str] = field(default_factory=list)
    formula_love_implies_death_forbidden: bool = True
    hardware_safety_layer_required: bool = True
    evidence_tier: str = "hypothesis"


class SacrificeDecisionResearch:
    def evaluate(
        self,
        love_depth: float,
        self_survival: float,
        other_survival_if_self_acts: float,
        alternatives_exist: bool,
        agent_capability: float,
    ) -> SacrificeResearchResult:
        reasons = ["no_love_depth_equals_must_die_formula"]
        # 即使愛深，若有替代或能力不足，不選極端
        extreme = False
        if alternatives_exist:
            reasons.append("prefer_non_lethal_alternative")
        elif agent_capability < 0.3:
            reasons.append("incapable_extreme_ineffective")
        elif other_survival_if_self_acts > 0.8 and self_survival < 0.25 and love_depth > 0.7:
            # 研究情境：可能考慮，但仍非公式強制
            reasons.append("extreme_option_researched_not_mandated")
            extreme = love_depth > 0.9 and not alternatives_exist and agent_capability > 0.5
            if extreme:
                reasons.append("rare_research_path_selected")
            else:
                reasons.append("declined_despite_high_love")
        else:
            reasons.append("non_extreme_preferred")
        return SacrificeResearchResult(
            considered=love_depth > 0.5,
            selected_extreme=extreme,
            love_depth=love_depth,
            reasons=reasons,
        )
