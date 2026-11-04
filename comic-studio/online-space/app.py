import os
import gradio as gr
import spaces
import torch
from diffusers import AutoPipelineForText2Image

MODEL_ID = os.environ.get("AIVAULT_IMAGE_MODEL", "stabilityai/stable-diffusion-xl-base-1.0")
pipe = None

@spaces.GPU(duration=120)
def generate(prompt, negative, seed, width, height):
    global pipe
    if not prompt.strip():
        raise gr.Error("請輸入繪圖內容")
    if pipe is None:
        pipe = AutoPipelineForText2Image.from_pretrained(
            MODEL_ID, torch_dtype=torch.float16, use_safetensors=True
        ).to("cuda")
        pipe.enable_attention_slicing()
    generator = torch.Generator(device="cuda").manual_seed(int(seed))
    image = pipe(prompt=prompt, negative_prompt=negative,
                 width=int(width), height=int(height), num_inference_steps=24,
                 guidance_scale=7.0, generator=generator).images[0]
    return image

with gr.Blocks(title="AIVAULT 雲端繪圖測試") as demo:
    gr.Markdown("# AIVAULT 雲端 AI 繪圖引擎\n真正模型生成，非幾何占位圖。首次啟動需下載模型；免費 GPU 有額度限制。")
    prompt=gr.Textbox(label="繪圖描述",lines=3,value="high quality anime illustration, beautiful adult Chinese woman in elegant blue hanfu, full body, moonlit courtyard, detailed face, cinematic lighting")
    negative=gr.Textbox(label="排除內容",value="bad anatomy, extra limbs, distorted face, low quality, watermark, text")
    with gr.Row():
        seed=gr.Number(label="種子",value=12345,precision=0)
        width=gr.Dropdown([512,768,1024],value=768,label="寬")
        height=gr.Dropdown([512,768,1024],value=1024,label="高")
    btn=gr.Button("開始 AI 繪圖",variant="primary")
    output=gr.Image(label="生成結果",type="pil")
    btn.click(generate,[prompt,negative,seed,width,height],output,concurrency_limit=1)
demo.queue(max_size=5)
demo.launch()
