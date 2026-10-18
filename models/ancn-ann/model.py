import torch
import torch.nn as nn

class ANCNMLP(nn.Module):
    """Small MLP for Worker-task suitability scoring.
    Status: IMPLEMENTED. Not trained on real verified data.
    """
    def __init__(self, input_dim: int = 16):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 32),
            nn.ReLU(),
            nn.Linear(32, 16),
            nn.ReLU(),
            nn.Linear(16, 1),
            nn.Sigmoid()
        )

    def forward(self, x):
        return self.net(x).squeeze(-1)

    def count_params(self):
        return sum(p.numel() for p in self.parameters() if p.requires_grad)
