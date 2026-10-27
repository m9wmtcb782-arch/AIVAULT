#!/usr/bin/env python3
"""Produce up to 100 REAL Dark Star MP4 edit variants from ORIGINAL guide footage.
No synthetic avatar, no face replacement, no false claim of new body motion.
Requires ffmpeg/ffprobe; never overwrites original files.
"""
import argparse,json,subprocess,hashlib
from pathlib import Path
SOURCES=['guide_idle','guide_intro','guide_point','guide_walk','guide_explain','guide_ask','guide_bow','guide_talk','guide_gesture','guide_present']
def probe(path):
 p=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(path)],capture_output=True,text=True,check=True)
 return float(p.stdout.strip())
def main():
 a=argparse.ArgumentParser();a.add_argument('--source',default='digital-human-real/guide');a.add_argument('--output',default='artifacts/darkstar-real-motion-edits');a.add_argument('--limit',type=int,default=100);args=a.parse_args()
 src=Path(args.source);out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
 records=[]
 for stem in SOURCES:
  f=src/(stem+'.mp4')
  if not f.is_file():continue
  duration=probe(f)
  if duration<.55:continue
  # Each variant is a genuinely distinct time window and/or tempo of the SAME REAL person.
  # Never label as a newly synthesized gesture.
  for j in range(10):
   if len(records)>=args.limit:break
   speed=[.85,.92,1.0,1.08,1.15][j%5]
   segment=min(2.6,max(.45,duration*.65))
   maxstart=max(0,duration-segment-.05)
   start=maxstart*(j//5)/2+maxstart*(j%5)/10
   output=out/(f'{stem}_edit_{j+1:02}.mp4')
   vf=f'setpts=(PTS-STARTPTS)/{speed:.4f},fps=24,format=yuv420p'
   cmd=['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y','-ss',f'{start:.3f}','-i',str(f),'-t',f'{segment:.3f}','-an','-vf',vf,'-c:v','libx264','-preset','veryfast','-crf','25','-movflags','+faststart',str(output)]
   subprocess.run(cmd,check=True)
   if not output.is_file() or output.stat().st_size==0:raise RuntimeError('empty output '+str(output))
   records.append({'id':output.stem,'file':output.name,'source':f.name,'source_start_sec':round(start,3),'source_window_sec':round(segment,3),'speed':speed,'kind':'EDIT_OF_ORIGINAL_REAL_FOOTAGE','new_joint_action':False,'identity':'original-dark-star','sha256':hashlib.sha256(output.read_bytes()).hexdigest()})
  if len(records)>=args.limit:break
 (out/'manifest.json').write_text(json.dumps({'status':'GENERATED_FROM_ORIGINAL_REAL_FOOTAGE','count':len(records),'warning':'Edited variants only. Not 100 new joint movements. Not automatically deployed.','clips':records},ensure_ascii=False,indent=2),encoding='utf8')
 print('Generated',len(records),'real-footage edited clips in',out)
if __name__=='__main__':main()
