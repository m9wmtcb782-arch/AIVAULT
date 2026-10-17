# AIVAULT EOT v1: Mandarin end-of-turn detector. Data: google/fleurs cmn_hans_cn (CC-BY-4.0).
# train = FLEURS "test" split, eval = FLEURS "dev" split (different sentences/recordings).
import numpy as np, soundfile as sf, glob, json, time, random, torch, torch.nn as nn, os
random.seed(0); np.random.seed(0); torch.manual_seed(0); torch.set_num_threads(6)
SR=16000; WIN=16000; FR=160
def load(split):
    out=[]
    for f in sorted(glob.glob(f"data/{split}/*.wav")):
        x,sr=sf.read(f,dtype="float32")
        if x.ndim>1: x=x.mean(1)
        if sr!=SR: continue
        out.append(x)
    return out
def segs(x):
    n=len(x)//FR; e=np.sqrt((x[:n*FR].reshape(n,FR)**2).mean(1)+1e-10)
    db=20*np.log10(e+1e-8); th=db.max()-35; sp=db>th
    idx=np.where(sp)[0]
    if len(idx)<20: return None
    start,end=idx[0],idx[-1]
    pauses=[]; i=start
    while i<end:
        if not sp[i]:
            j=i
            while j<end and not sp[j]: j+=1
            if j-i>=15: pauses.append((i,j))
            i=j
        else: i+=1
    return start,end,pauses
def window(x,endsample):
    s=endsample-WIN; w=np.zeros(WIN,np.float32)
    a=max(0,s); b=min(len(x),endsample); w[a-s:b-s]=x[a:b]
    return w
def make(xs,rng,per=1):
    X=[];Y=[];H=[]
    for x in xs:
        r=segs(x)
        if r is None: continue
        st,en,ps=r
        for _ in range(per):
            d=rng.integers(10,31)
            X.append(window(x,(en+1+d)*FR)); Y.append(1); H.append(1)
            cand=[p for p in ps if p[1]-p[0]>=d and p[0]>st+30]
            if cand:
                p=cand[rng.integers(len(cand))]; X.append(window(x,(p[0]+d)*FR)); Y.append(0); H.append(1)
            m=rng.integers(st+50,max(st+51,en-20)); X.append(window(x,m*FR)); Y.append(0); H.append(0)
    return np.stack(X),np.array(Y,np.float32),np.array(H)
class Mel(nn.Module):
    def __init__(s,n_fft=400,n_mels=40):
        super().__init__()
        t=np.arange(n_fft); win=0.5-0.5*np.cos(2*np.pi*t/n_fft); k=np.arange(n_fft//2+1)[:,None]
        re=(np.cos(2*np.pi*k*t/n_fft)*win); im=(-np.sin(2*np.pi*k*t/n_fft)*win)
        s.re=nn.Conv1d(1,n_fft//2+1,n_fft,stride=FR,bias=False); s.im=nn.Conv1d(1,n_fft//2+1,n_fft,stride=FR,bias=False)
        s.re.weight.data=torch.tensor(re,dtype=torch.float32)[:,None]; s.im.weight.data=torch.tensor(im,dtype=torch.float32)[:,None]
        for p in s.parameters(): p.requires_grad=False
        hz=lambda m:700*(10**(m/2595)-1); mel=lambda f:2595*np.log10(1+f/700)
        pts=hz(np.linspace(mel(60),mel(7600),n_mels+2)); bins=np.floor((n_fft+1)*pts/SR).astype(int); fb=np.zeros((n_mels,n_fft//2+1))
        for i in range(n_mels):
            for j in range(bins[i],bins[i+1]): fb[i,j]=(j-bins[i])/max(1,bins[i+1]-bins[i])
            for j in range(bins[i+1],bins[i+2]): fb[i,j]=(bins[i+2]-j)/max(1,bins[i+2]-bins[i+1])
        s.register_buffer("fb",torch.tensor(fb,dtype=torch.float32))
    def forward(s,x):
        x=x[:,None]; p=s.re(x)**2+s.im(x)**2
        m=torch.log(torch.matmul(s.fb,p)+1e-6)
        return m-m.mean(dim=(1,2),keepdim=True)
class EOT(nn.Module):
    def __init__(s):
        super().__init__(); s.mel=Mel()
        s.cnn=nn.Sequential(nn.Conv1d(40,64,5,padding=2),nn.BatchNorm1d(64),nn.ReLU(),nn.Conv1d(64,64,5,padding=2,stride=2),nn.BatchNorm1d(64),nn.ReLU())
        s.gru=nn.GRU(64,64,batch_first=True); s.fc=nn.Linear(64,1)
    def forward(s,x):
        h=s.cnn(s.mel(x)).transpose(1,2); o,_=s.gru(h); return torch.sigmoid(s.fc(o[:,-1]))[:,0]
def aug(X,rng):
    X=X*rng.uniform(0.3,2.0,(len(X),1)).astype(np.float32)
    return X+rng.normal(0,1,X.shape).astype(np.float32)*rng.uniform(0,0.004,(len(X),1)).astype(np.float32)
def metrics(p,y):
    pr=(p>0.5); tp=((pr==1)&(y==1)).sum(); fp=((pr==1)&(y==0)).sum(); fn=((pr==0)&(y==1)).sum()
    P=tp/max(1,tp+fp); R=tp/max(1,tp+fn); return dict(acc=round(float((pr==y).mean()),4),precision=round(float(P),4),recall=round(float(R),4),f1=round(float(2*P*R/max(1e-9,P+R)),4),n=int(len(y)))
if __name__=="__main__":
    t0=time.time(); rng=np.random.default_rng(0)
    tr=load("test"); ev=load("dev"); print("clips train",len(tr),"eval",len(ev),flush=True)
    Xtr,Ytr,Htr=make(tr,rng,per=3); Xev,Yev,Hev=make(ev,np.random.default_rng(1),per=1)
    print("windows train",len(Ytr),"eval",len(Yev),"hard eval",int(Hev.sum()),flush=True)
    m=EOT(); opt=torch.optim.Adam([p for p in m.parameters() if p.requires_grad],2e-3); bce=nn.BCELoss()
    Xe=torch.tensor(Xev); best=-1; E=int(os.environ.get('EP','12')); sch=torch.optim.lr_scheduler.OneCycleLR(opt,3e-3,total_steps=E*((len(Ytr)+63)//64))
    for ep in range(int(os.environ.get("EP","12"))):
        m.train(); perm=rng.permutation(len(Ytr)); L=0
        for i in range(0,len(perm),64):
            b=perm[i:i+64]; xb=torch.tensor(aug(Xtr[b],rng)); yb=torch.tensor(Ytr[b])
            opt.zero_grad(); l=bce(m(xb),yb); l.backward(); opt.step(); sch.step(); L+=l.item()*len(b)
        m.eval()
        with torch.no_grad(): p=m(Xe).numpy()
        print(ep,"loss",round(L/len(Ytr),4),"eval",metrics(p,Yev),"hard",metrics(p[Hev==1],Yev[Hev==1]),round(time.time()-t0),"s",flush=True)
    m.eval(); torch.save(m.state_dict(),"eot.pt")
    with torch.no_grad(): p=m(Xe).numpy()
    res=dict(dataset="google/fleurs cmn_hans_cn (CC-BY-4.0)",split="train=FLEURS test split, eval=FLEURS dev split (final epoch, no early stopping on eval)",train_clips=len(tr),eval_clips=len(ev),train_windows=int(len(Ytr)),eval_windows=int(len(Yev)),
      params=sum(p.numel() for p in m.parameters() if p.requires_grad),overall=metrics(p,Yev),hard_pause_vs_end=metrics(p[Hev==1],Yev[Hev==1]),train_seconds=round(time.time()-t0))
    torch.set_num_threads(1); xb=Xe[:1]; ts=[]
    with torch.no_grad():
        for _ in range(100): a=time.perf_counter(); m(xb); ts.append((time.perf_counter()-a)*1000)
    res["torch_cpu_ms_per_1s_window_1thread_median"]=round(float(np.median(ts)),2)
    torch.onnx.export(m,xb,"aivault-eot-v1.onnx",input_names=["audio"],output_names=["p_end"],dynamic_axes={"audio":{0:"b"},"p_end":{0:"b"}},opset_version=17,dynamo=False)
    import onnxruntime as ort
    o=ort.SessionOptions(); o.intra_op_num_threads=1; s=ort.InferenceSession("aivault-eot-v1.onnx",o)
    po=s.run(None,{"audio":Xev[:64]})[0]; res["onnx_max_abs_diff_vs_torch"]=float(np.abs(po-p[:64]).max())
    ts=[]
    for _ in range(100): a=time.perf_counter(); s.run(None,{"audio":Xev[:1]}); ts.append((time.perf_counter()-a)*1000)
    res["onnx_cpu_ms_per_1s_window_1thread_median"]=round(float(np.median(ts)),2); res["onnx_bytes"]=os.path.getsize("aivault-eot-v1.onnx")
    json.dump(res,open("metrics.json","w"),ensure_ascii=False,indent=1); print(json.dumps(res,ensure_ascii=False,indent=1))
