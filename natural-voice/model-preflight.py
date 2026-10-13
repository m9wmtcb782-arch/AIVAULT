"""Offline voice deployment preflight; does not run models or download weights."""
import json
import os
from pathlib import Path
import shutil
import sys

def check_environment(env=None):
    env=os.environ if env is None else env
    checks={}
    executable=env.get("PIPER_EXECUTABLE","piper")
    model=env.get("PIPER_MODEL_PATH","")
    config=model+".json" if model else ""
    checks["piper_executable"]=bool(shutil.which(executable))
    checks["piper_model"]=bool(model and Path(model).is_file() and Path(model).stat().st_size>0)
    checks["piper_config"]=bool(config and Path(config).is_file())
    checks["voice_token"]=len(env.get("AIVAULT_VOICE_TOKEN",""))>=24
    asr=env.get("ASR_MODEL_PATH","")
    checks["asr_model"]=bool(asr and Path(asr).is_dir() and (Path(asr)/"model.bin").is_file() and (Path(asr)/"model.bin").stat().st_size>0)
    checks["tts_supported_rate"]=False
    checks["tts_mandarin"]=False
    if checks["piper_config"]:
        try:
            metadata=json.loads(Path(config).read_text(encoding="utf-8"))
            checks["tts_supported_rate"]=metadata.get("audio",{}).get("sample_rate") in (22050,24000)
            checks["tts_mandarin"]=str(metadata.get("language",{}).get("code","")).lower().replace("_","-").startswith("zh")
        except (ValueError,OSError,TypeError,AttributeError):
            pass
    return checks

if __name__=="__main__":
    result=check_environment()
    print(json.dumps({"checks":result,"tts_ready":all(result[k] for k in
        ("piper_executable","piper_model","piper_config","voice_token","tts_supported_rate","tts_mandarin")),
        "asr_ready":result["asr_model"]},ensure_ascii=False,indent=2))
    sys.exit(0 if all(result.values()) else 1)
