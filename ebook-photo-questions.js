// Photo questions OCR + book answer
(function () {
  const OCR_LANG = "chi_tra+eng";
  const INGEST = "https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/dark-star-ebook-ingest";
  const GATEWAY = "https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/ai-gateway";
  let bookPages = [];
  let questions = [];

  function loadTesseract() {
    return new Promise((resolve, reject) => {
      if (window.Tesseract) return resolve(window.Tesseract);
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      s.onload = () => resolve(window.Tesseract);
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function loadBookContent(ebookId) {
    const tocRes = await fetch(INGEST, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toc", ebook_id: ebookId })
    });
    const toc = await tocRes.json();
    bookPages = [];
    for (const item of toc.toc || []) {
      const pageRes = await fetch(INGEST, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "book", ebook_id: ebookId, page_number: item.page_number })
      });
      const page = await pageRes.json();
      bookPages.push({ page: item.page_number, content: page.page?.content || "" });
    }
    return bookPages;
  }

  async function ocrAndSplitQuestions(file) {
    const Tesseract = await loadTesseract();
    const { data: { text } } = await Tesseract.recognize(file, OCR_LANG);
    const raw = (text || "").trim();
    const parts = raw.split(/(?=\n\s*(?:\d+[\.\u3001]|[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341]+[\u3001\uff0e\.])\s*)/g)
                     .map(s => s.trim())
                     .filter(Boolean);
    questions = parts.length ? parts : [raw];
    return questions;
  }

  function findRelevantContext(q) {
    const keywords = q.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, " ").split(/\s+/).filter(w => w.length > 1);
    let best = "";
    let score = 0;
    for (const p of bookPages) {
      let s = 0;
      for (const k of keywords) if (p.content.includes(k)) s++;
      if (s > score) { score = s; best = p.content.slice(0, 1800); }
    }
    return best || bookPages.map(p => p.content).join("\n").slice(0, 2500);
  }

  async function answerAllInOrder() {
    const results = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const ctx = findRelevantContext(q);
      const prompt = `\u66f8\u7c4d\u76f8\u95dc\u5167\u5bb9\uff1a\n${ctx}\n\n\u984c\u76ee ${i + 1}\uff1a${q}\n\u8acb\u4f9d\u66f8\u7c4d\u5167\u5bb9\u7cbe\u6e96\u56de\u7b54\uff0c\u4e0d\u8981\u7de8\u9020\u3002`;

      const res = await fetch(GATEWAY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          capability: "chat",
          ownerQuestion: prompt
        })
      });
      const data = await res.json();
      results.push({
        index: i + 1,
        question: q,
        answer: data?.text || data?.content || data?.answer || data?.data?.text || JSON.stringify(data)
      });
    }
    return results;
  }

  function mount(container, ebookId) {
    if (!container || !ebookId) return;
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div style="margin:12px 0;padding:12px;border:1px solid #444;border-radius:8px;background:#1a1a1a;color:#eee">
        <button id="loadBookBtn" style="margin-right:8px">\u8f09\u5165\uff0f\u5408\u4f75\u66f8\u7c4d\u5167\u5bb9</button>
        <input type="file" id="qPhoto" accept="image/*">
        <div id="qList" style="font-size:13px;max-height:140px;overflow:auto;margin:8px 0;color:#ccc"></div>
        <button id="answerBtn">\u4f9d\u984c\u76ee\u9806\u5e8f\u627e\u7b54\u6848</button>
        <div id="ansOut" style="margin-top:8px;font-size:14px"></div>
      </div>
    `;
    container.appendChild(wrap);

    wrap.querySelector("#loadBookBtn").onclick = async () => {
      const btn = wrap.querySelector("#loadBookBtn");
      btn.disabled = true;
      btn.textContent = "\u8f09\u5165\u4e2d\u2026";
      try {
        await loadBookContent(ebookId);
        btn.textContent = "\u5df2\u8f09\u5165 " + bookPages.length + " \u9801";
      } catch (e) {
        btn.textContent = "\u8f09\u5165\u5931\u6557";
        console.error(e);
      }
      btn.disabled = false;
    };

    wrap.querySelector("#qPhoto").onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const list = wrap.querySelector("#qList");
      list.textContent = "OCR \u8fa8\u8b58\u4e2d\u2026";
      try {
        const qs = await ocrAndSplitQuestions(file);
        list.innerHTML = qs.map((q, i) => `<div>${i + 1}. ${q.slice(0, 100)}${q.length > 100 ? "\u2026" : ""}</div>`).join("");
      } catch (err) {
        list.textContent = "OCR \u5931\u6557\uff1a" + err.message;
      }
    };

    wrap.querySelector("#answerBtn").onclick = async () => {
      if (!questions.length) return;
      const out = wrap.querySelector("#ansOut");
      out.innerHTML = "\u4f9d\u5e8f\u56de\u7b54\u4e2d\u2026";
      try {
        const results = await answerAllInOrder();
        out.innerHTML = results.map(r =>
          `<div style="margin:10px 0;padding:8px;background:#222;border-radius:4px">
             <b>\u984c ${r.index}\uff1a</b>${r.question}<br>
             <b>\u7b54\uff1a</b>${r.answer}
           </div>`
        ).join("");
      } catch (err) {
        out.textContent = "\u56de\u7b54\u5931\u6557\uff1a" + err.message;
      }
    };
  }

  window.ebookMountPhotoQuestions = mount;

  document.addEventListener("DOMContentLoaded", () => {
    const stage = document.querySelector(".stage");
    const eid = new URLSearchParams(location.search).get("ebook_id") || prompt("\u8acb\u8f38\u5165 ebook_id", "");
    if (stage && eid) mount(stage, eid);
  });
})();
