// dark-star-reading-report v16
// deployment trigger: direct report retry fix
// v16: tolerate plain Markdown/text model output and accumulate continuation safely.
// Fixes truncated generation: v14 returned 30-400 chars and failed JSON contract,
// so the frontend never received a guide/report long enough for page 2.
// Voice, Live, and ai-gateway source are not modified. This function only calls ai-gateway.

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-aivault-internal",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const VERSION = "v16";
const MODEL = "gemini-3.6-flash";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function sectionCount(text: string) {
  return (String(text || "").match(/第[1-9]段[｜|]/g) || []).length;
}

function extractJson(text: string): Record<string, unknown> | null {
  const raw = String(text || "");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      /* continue to field salvage */
    }
  }
  return null;
}

function salvageField(text: string, field: string) {
  const raw = String(text || "");
  const key = `"${field}"`;
  const at = raw.indexOf(key);
  if (at < 0) return "";
  const colon = raw.indexOf(":", at + key.length);
  if (colon < 0) return "";
  let i = colon + 1;
  while (i < raw.length && /\s/.test(raw[i])) i++;
  if (raw[i] !== '"') return "";
  i++;
  let out = "";
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === "\\") {
      const n = raw[i + 1];
      if (n === "n") out += "\n";
      else if (n === "t") out += "\t";
      else if (n === '"') out += '"';
      else if (n === "\\") out += "\\";
      else out += n || "";
      i += 2;
      continue;
    }
    if (ch === '"') break;
    out += ch;
    i++;
  }
  return out.trim();
}

async function callGateway(req: Request, prompt: string) {
  const base = Deno.env.get("SUPABASE_URL") || "https://clcddygkaaqqtsbswgdf.supabase.co";
  const upstream = await fetch(base + "/functions/v1/ai-gateway", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: req.headers.get("authorization") || "",
      apikey: req.headers.get("apikey") || "",
    },
    body: JSON.stringify({
      agent_id: "technical-dark-star",
      capability: "text",
      model: MODEL,
      requestedModel: MODEL,
      max_tokens: 8192,
      maxOutputTokens: 8192,
      temperature: 0.4,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await upstream.json().catch(() => ({}));
  const text = String(
    data.content || data.text || data.output || data.message || data.reply ||
      data?.result?.content || data?.choices?.[0]?.message?.content || ""
  );
  return { ok: upstream.ok && data.success !== false, status: upstream.status, text, data };
}

async function generateLong(req: Request, prompt: string, minLen: number, label: string) {
  let acc = "";
  const diagnostics: Array<Record<string, unknown>> = [];
  for (let round = 1; round <= 4; round++) {
    const ask = round === 1
      ? prompt
      : prompt + "\n\n你剛才的輸出被截斷或太短。請只接續尚未寫完的部分，不要重複已完成段落，不要摘要。已完成文字如下：\n" + acc.slice(-1200) + "\n請從中斷處繼續，直到本段要求的字數與段落都完成。";
    const got = await callGateway(req, ask);
    diagnostics.push({ round, label, status: got.status, length: got.text.length, prefix: got.text.slice(0, 80), gateway_success: got.data?.success !== false });
    if (!got.text) {
      if (round === 4) return { text: acc, diagnostics, error: got.data?.error || "EMPTY_MODEL_OUTPUT" };
      continue;
    }
    const parsed = extractJson(got.text);
    const piece = String(parsed?.guide || parsed?.report_part || parsed?.conclusion || parsed?.analysis_context || parsed?.content || got.text).trim();
    if (piece) {
      if (!acc) {
        acc = piece;
      } else if (piece === acc || acc.includes(piece)) {
      } else {
        const tail = acc.slice(-240);
        const overlapAt = piece.indexOf(tail);
        if (overlapAt >= 0) acc += piece.slice(overlapAt + tail.length);
        else acc += "\n\n" + piece;
      }
    }
    if (acc.length >= minLen) return { text: acc, diagnostics };
  }
  return { text: acc, diagnostics, error: acc.length ? "OUTPUT_TOO_SHORT" : "EMPTY_MODEL_OUTPUT" };
}

function requireSource(body: Record<string, unknown>) {
  const source = String(body.source || "").trim();
  if (source.length < 8) return null;
  return source;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method === "GET") return json({ success: true, result: { version: VERSION, model: MODEL, function: "dark-star-reading-report" } });
  if (req.method !== "POST") return json({ success: false, error: "method" }, 405);
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ success: false, error: "bad_json" }, 400); }
  const mode = String(body.mode || "guide");
  if (mode === "version" || mode === "health") {
    return json({ success: true, result: { version: VERSION, model: MODEL, function: "dark-star-reading-report" } });
  }
  const source = requireSource(body);
  if (!source) return json({ success: false, error: "SOURCE_REQUIRED" }, 400);
  const title = String(body.title || "未命名主題");
  const kind = String(body.kind || "一般資料");
  const audience = String(body.audience || "研究生");
  const depth = String(body.depth || "研究生｜分析型");
  const base = `你是暗星，負責研究生等級的導讀與正式報告。使用繁體中文。不得摘要帶過，不得虛構引用。材料沒有寫到的地方標成〔INFERENCE〕，材料有寫的標成〔TEXT〕。\n主題：${title}\n類型：${kind}\n讀者：${audience}\n深度：${depth}\n材料：\n${source.slice(0, 12000)}`;

  if (mode === "parse") {
    const prompt = base + "\n\n只回傳 JSON：{\"analysis_context\":\"不少於900字的分析底稿，含主旨、問題意識、概念、論證、證據、因果、爭點\"}";
    const got = await generateLong(req, prompt, 900, "parse");
    const parsed = extractJson(got.text);
    const field = salvageField(got.text, "analysis_context");
    const analysis = String(parsed?.analysis_context || field || got.text || "").trim();
    if (!analysis) {
      return json({ success: false, error: "AI_OUTPUT_EMPTY", version: VERSION, content_length: 0, diagnostics: got.diagnostics }, 502);
    }
    return json({ success: true, result: { analysis_context: analysis, version: VERSION, content_length: analysis.length, output_format: parsed?.analysis_context || field ? "structured_or_field" : "plain_text" } });
  }

  if (mode === "guide") {
    const analysis = String(body.analysis_context || "").trim();
    if (analysis.length < 40) {
      return json({ success: false, error: "GUIDE_BATCH_CONTRACT_FAILED", batch: 1, version: VERSION, content_length: 0, content_prefix: "缺少文章解析底稿", diagnostics: [] }, 502);
    }
    const batches = [[1, 3], [4, 6], [7, 9]];
    const parts: string[] = [];
    const diagnostics: Array<Record<string, unknown>> = [];
    for (const [from, to] of batches) {
      const prompt = base + `\n\n文章解析底稿：\n${analysis.slice(0, 6000)}\n\n請只寫導讀第${from}段到第${to}段。每一段至少700字，必須用「第N段｜小標」開頭。內容要分析論證、證據、因果或制度關係、限制，不可只列目錄。只回傳 JSON：{"guide_title":"${title}","guide":"第${from}段｜..."}`;
      const got = await generateLong(req, prompt, 1800, `guide-${from}`);
      const guide = salvageField(got.text, "guide") || got.text;
      diagnostics.push({ batch: from === 1 ? 1 : from === 4 ? 2 : 3, length: guide.length, rounds: got.diagnostics });
      if (guide.length < 800 || !new RegExp(`第${from}段`).test(guide)) {
        return json({ success: false, error: "GUIDE_BATCH_CONTRACT_FAILED", batch: from === 1 ? 1 : from === 4 ? 2 : 3, version: VERSION, content_length: guide.length, content_prefix: guide.slice(0, 180), diagnostics }, 502);
      }
      parts.push(guide);
    }
    const guide = parts.join("\n\n");
    const count = sectionCount(guide);
    if (count < 9 || guide.length < 6500) {
      return json({ success: false, error: "GUIDE_QUALITY_REJECTED", version: VERSION, content_length: guide.length, section_count: count, content_prefix: guide.slice(0, 180), diagnostics }, 502);
    }
    return json({ success: true, result: { guide_title: title, guide, section_count: count, guide_length: guide.length, batch_diagnostics: diagnostics.map((d) => ({ batch: d.batch, length: d.length })), version: VERSION } });
  }

  if (mode === "report_direct") {
    const part = Number(body.part || 1);
    const analysis = String(body.analysis_context || "").trim();
    const prompt = base + `\\n\\n文章解析底稿：\\n${analysis.slice(0, 7000)}\\n\\n請不要先寫導讀，直接撰寫「專題報告」第${part}/3部分。這是一份研究生等級的正式專題報告，不是導讀、不是目錄、不是摘要。必須直接提出問題、分析材料中的核心概念與論點，建立證據與因果／制度關係，處理爭點與不同觀點，並在材料允許的範圍內提出實務意義。不得虛構案例、法源、文獻或材料沒有提供的事實；推論請標記〔INFERENCE〕，材料明示內容標記〔TEXT〕。\\n第1部分：研究問題、背景、核心概念與材料主要論點。\\n第2部分：證據、論證結構、因果／制度關係、爭點與不同觀點。\\n第3部分：綜合分析、限制、實務意義與可延伸研究問題。\\n每部分至少1400字。只回傳 JSON：{"report_part":"..."}`;
    let got = await generateLong(req, prompt, 1400, `report-direct-${part}`);
    let report = salvageField(got.text, "report_part") || got.text;
    if (report.length < 500) {
      const retryPrompt = base + "\n\n文章解析底稿：\n" + analysis.slice(0, 7000) +
        "\n\n直接完成「專題報告」第" + part + "/3部分。只輸出完整報告正文，不要 JSON、不要摘要、不要目錄、不要只寫開頭。這是研究生等級正式專題報告，至少1400字。\n" +
        "第1部分：研究問題、背景、核心概念與材料主要論點。\n" +
        "第2部分：證據、論證結構、因果／制度關係、爭點與不同觀點。\n" +
        "第3部分：綜合分析、限制、實務意義與可延伸研究問題。";
      got = await generateLong(req, retryPrompt, 1000, "report-direct-retry-" + part);
      report = salvageField(got.text, "report_part") || got.text;
    }
    if (report.length < 500) {
      return json({ success: false, error: "DIRECT_REPORT_TOO_SHORT", version: VERSION, content_length: report.length, content_prefix: report.slice(0, 180), diagnostics: got.diagnostics }, 502);
    }
    return json({ success: true, result: { report_part: report, part, direct: true, content_length: report.length, version: VERSION } });
  }

  if (mode === "report") {
    const part = Number(body.part || 1);
    const prompt = base + `\n導讀：\n${String(body.guide || "").slice(0, 5000)}\n解析：\n${String(body.analysis_context || "").slice(0, 3000)}\n已完成報告：\n${String(body.previous_report || "").slice(-1500)}\n\n請寫正式報告第${part}/3部分，至少1400字，不可摘要。第1部分處理主題、概念與材料論點；第2部分處理證據、爭點與因果；第3部分處理綜合分析、限制與實務意義。只回傳 JSON：{"report_part":"..."}`;
    const got = await generateLong(req, prompt, 1400, `report-${part}`);
    const report = salvageField(got.text, "report_part") || got.text;
    if (report.length < 900) {
      return json({ success: false, error: "AI_OUTPUT_CONTRACT_FAILED", version: VERSION, content_length: report.length, content_prefix: report.slice(0, 180), diagnostics: got.diagnostics }, 502);
    }
    return json({ success: true, result: { report_part: report, part, content_length: report.length, version: VERSION } });
  }

  if (mode === "conclusion") {
    const prompt = base + `\n導讀：\n${String(body.guide || "").slice(0, 2500)}\n報告：\n${String(body.report || "").slice(0, 4000)}\n\n請寫結論，至少700字，回答「所以呢」，收束核心發現、問題如何被回答、限制、讀者應帶走的觀念。只回傳 JSON：{"conclusion":"..."}`;
    const got = await generateLong(req, prompt, 700, "conclusion");
    const conclusion = salvageField(got.text, "conclusion") || got.text;
    if (conclusion.length < 400) {
      return json({ success: false, error: "AI_OUTPUT_CONTRACT_FAILED", version: VERSION, content_length: conclusion.length, content_prefix: conclusion.slice(0, 180), diagnostics: got.diagnostics }, 502);
    }
    return json({ success: true, result: { conclusion, content_length: conclusion.length, version: VERSION } });
  }

  if (mode === "quality") {
    const guide = String(body.guide || "");
    const report = String(body.report || "");
    const conclusion = String(body.conclusion || "");
    const count = sectionCount(guide);
    const direct = body.direct === true;
    const checks = direct
      ? [
          { item: "直接專題報告", status: report.length >= 3500 ? "PASS" : "FAIL", finding: `report_length=${report.length}` },
          { item: "結論", status: conclusion.length >= 400 ? "PASS" : "FAIL", finding: `conclusion_length=${conclusion.length}` },
        ]
      : [
          { item: "導讀段數", status: count >= 9 ? "PASS" : "FAIL", finding: `section_count=${count}` },
          { item: "導讀字數", status: guide.length >= 6500 ? "PASS" : "FAIL", finding: `guide_length=${guide.length}` },
          { item: "正式報告", status: report.length >= 2500 ? "PASS" : "FAIL", finding: `report_length=${report.length}` },
          { item: "結論", status: conclusion.length >= 400 ? "PASS" : "FAIL", finding: `conclusion_length=${conclusion.length}` },
        ];
    const failed = checks.filter((c) => c.status !== "PASS").length;
    const overall = failed ? "NEEDS_REVISION" : "PASS";
    const score = Math.max(0, 100 - failed * 25);
    return json({ success: true, result: { overall, score, checks, version: VERSION } });
  }

  if (mode === "multimodal") {
    const mediaType = String(body.media_type || "").toLowerCase();
    const media = String(body.media || "").trim();
    if (!media || !["image","audio","video"].includes(mediaType)) {
      return json({ success:false, error:"MEDIA_REQUIRED", allowed:["image","audio","video"], version:VERSION },400);
    }
    const capability = mediaType === "image" ? "vision" : mediaType;
    const prompt = String(body.prompt || (
      mediaType === "image"
        ? "你是暗星。完整理解這張圖片：文字、圖表、人物、場景、結構與重要視覺資訊。輸出可直接進入研究導讀的繁體中文分析，不得虛構。"
        : mediaType === "audio"
        ? "你是暗星。完整理解這段音訊。若為語音，分析語意、重點與說話內容；若為音樂，分析人聲、樂器、節奏、段落、情緒、歌詞可辨識內容與聲音事件。不得虛構。"
        : "你是暗星。完整理解這段影片的畫面、語音、字幕、事件與時間關係，建立可供研究導讀使用的時間軸分析。不得虛構。"
    ));
    const baseUrl = Deno.env.get("SUPABASE_URL") || "https://clcddygkaaqqtsbswgdf.supabase.co";
    const upstream = await fetch(baseUrl + "/functions/v1/ai-gateway", {
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        authorization:req.headers.get("authorization") || "",
        apikey:req.headers.get("apikey") || "",
      },
      body:JSON.stringify({
        agent_id:"technical-dark-star",
        capability,
        model:MODEL,
        requestedModel:MODEL,
        messages:[{role:"user",content:prompt,media_type:mediaType,media}],
        media
      })
    });
    const data = await upstream.json().catch(()=>({}));
    const text = String(data.content || data.text || data.output || data.message || data.reply || data?.result?.content || data?.choices?.[0]?.message?.content || "");
    return json({
      success:upstream.ok && data.success !== false,
      result:{analysis:text,media_type:mediaType,capability,version:VERSION,upstream_status:upstream.status},
      status:upstream.ok ? "NOT_VERIFIED" : "FAILED"
    }, upstream.ok ? 200 : upstream.status);
  }

  return json({ success: false, error: "UNKNOWN_MODE", version: VERSION }, 400);
});
