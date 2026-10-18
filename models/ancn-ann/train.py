"""Offline training pipeline.
Supports synthetic data for pipeline test only.
Must not claim real capability when data is insufficient.
"""
import torch
import torch.nn as nn
from model import ANCNMLP

def train_synthetic(epochs: int = 5):
    model = ANCNMLP()
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    loss_fn = nn.BCELoss()
    # Synthetic demo only
    for _ in range(epochs):
        x = torch.randn(32, 16)
        y = (x[:, 0] > 0).float()  # trivial rule
        opt.zero_grad()
        pred = model(x)
        loss = loss_fn(pred, y)
        loss.backward()
        opt.step()
    torch.save(model.state_dict(), "ancn-mlp-synthetic.pt")
    return model

if __name__ == "__main__":
    print("Synthetic pipeline test only. Not real training.")
    m = train_synthetic()
    print("params:", m.count_params())
