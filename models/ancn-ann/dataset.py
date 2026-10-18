"""Train / validation / test isolation and leakage protection.
"""
def split_dataset(samples: list, train_ratio=0.7, val_ratio=0.15):
    n = len(samples)
    if n == 0:
        return [], [], []
    t = int(n * train_ratio)
    v = int(n * (train_ratio + val_ratio))
    return samples[:t], samples[t:v], samples[v:]
