"""驗證：每個被改的既有檔案，移除插入的 neural 掛勾後，與 HEAD 位元組完全相同。"""
import subprocess, sys, re
root = sys.argv[1]; bad = 0; n = 0
for p in subprocess.check_output(["git", "-C", root, "diff", "--name-only"], text=True).splitlines():
    cur = open(f"{root}/{p}", "rb").read(); head = subprocess.check_output(["git", "-C", root, "show", f"HEAD:{p}"])
    stripped = re.sub(rb'<script src="[^"]*neural-bus\.js" data-neural-program="[^"]*"></script>', b"", cur)
    stripped = re.sub(rb'import "(\.\./)+_shared/neural-bus\.ts"; // neural bus \(NEURAL_BUS_ON, default off\)\n', b"", stripped)
    n += 1
    if stripped != head: bad += 1; print("MISMATCH", p)
print({"modified_files": n, "insert_only_verified": n - bad, "mismatch": bad})
