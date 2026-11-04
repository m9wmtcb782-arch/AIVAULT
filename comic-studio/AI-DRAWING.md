# AIVAULT Drawing Engine — Local AI Generation V0.2

This adapter connects to a **locally running ComfyUI** and saves real PNG outputs with asset metadata. It does **not** create images on its own: you must install ComfyUI, a compatible image model, and a working API-format workflow. No paid API calls or keys are used.

## Run

1. Start ComfyUI on localhost port 8188.
2. In ComfyUI, export a workflow in **API format** (not ordinary UI workflow JSON). Confirm that it includes a positive `CLIPTextEncode` node with `inputs.text` and a `SaveImage` node.
3. Run:

```bash
python comic-studio/comfy_generate.py --workflow workflow_api.json --node 6 --prompt "anime woman in traditional Chinese dress, full body, neutral pose, plain background" --name character
```

Replace node 6 with the actual positive prompt node ID. Files are saved in `comic-studio/output/` by default. For environments without a supported GPU, generation may be slow or unavailable. This is a CLI prototype, not yet integrated with the browser drawing page.

## Asset conventions

- `character`: full-body character reference, consistent character ID to be added in next phase.
- `prop`: objects and costume components.
- `background`: environments and locations.
- Each generated PNG has a sibling JSON record containing prompt and provenance.

## Safety and architecture

The CLI accepts only a loopback HTTP ComfyUI endpoint; it does not expose the model server publicly. Avoid uploading private assets to third-party providers. No paid API is invoked. Image generation quality, character consistency, and GPU support depend on the locally installed model. Next: character reference locking, segmentation into layers, and animation-ready asset validation.
