#!/usr/bin/env python3
"""Generate an API-format ComfyUI SDXL text-to-image workflow. No downloads or API charges."""
import argparse, json, pathlib
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--checkpoint",required=True,help="Installed checkpoint filename shown by ComfyUI")
    p.add_argument("--prompt",default="masterpiece, professional anime illustration, detailed expressive face, elegant historical Chinese woman, flowing silk hanfu, full body, beautiful moonlit garden, coherent anatomy, cinematic lighting")
    p.add_argument("--negative",default="low quality, poorly drawn face, extra fingers, extra limbs, deformed anatomy, text, watermark, geometric shapes, stick figure")
    p.add_argument("--width",type=int,default=768);p.add_argument("--height",type=int,default=1024)
    p.add_argument("--steps",type=int,default=30);p.add_argument("--seed",type=int,default=12345)
    p.add_argument("--output",type=pathlib.Path,default=pathlib.Path("workflow_anime_sdxl_api.json"))
    a=p.parse_args()
    if a.width%8 or a.height%8 or not 256<=a.width<=2048 or not 256<=a.height<=2048: p.error("Dimensions must be multiples of 8 between 256 and 2048")
    wf={
      "1":{"class_type":"CheckpointLoaderSimple","inputs":{"ckpt_name":a.checkpoint}},
      "2":{"class_type":"CLIPTextEncode","inputs":{"text":a.prompt,"clip":["1",1]}},
      "3":{"class_type":"CLIPTextEncode","inputs":{"text":a.negative,"clip":["1",1]}},
      "4":{"class_type":"EmptyLatentImage","inputs":{"width":a.width,"height":a.height,"batch_size":1}},
      "5":{"class_type":"KSampler","inputs":{"seed":a.seed,"steps":a.steps,"cfg":7.0,"sampler_name":"euler","scheduler":"normal","denoise":1.0,"model":["1",0],"positive":["2",0],"negative":["3",0],"latent_image":["4",0]}},
      "6":{"class_type":"VAEDecode","inputs":{"samples":["5",0],"vae":["1",2]}},
      "7":{"class_type":"SaveImage","inputs":{"filename_prefix":"AIVAULT_ANIME","images":["6",0]}}
    }
    a.output.write_text(json.dumps(wf,ensure_ascii=False,indent=2),encoding="utf-8")
    print("Workflow:",a.output)
    print("Positive prompt node: 2; SaveImage node: 7")
if __name__=="__main__": main()
