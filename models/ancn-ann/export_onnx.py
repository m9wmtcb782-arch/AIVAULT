import torch
from model import ANCNMLP

def export():
    model = ANCNMLP()
    model.eval()
    dummy = torch.zeros(1, 16)
    torch.onnx.export(
        model, dummy, "ancn-mlp.onnx",
        input_names=["features"], output_names=["score"],
        dynamic_axes={"features": {0: "batch"}, "score": {0: "batch"}},
        opset_version=17
    )
    print("Exported ancn-mlp.onnx")

if __name__ == "__main__":
    export()
