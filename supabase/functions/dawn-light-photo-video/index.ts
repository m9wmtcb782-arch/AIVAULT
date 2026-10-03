const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://m9wmtcb782-arch.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const API = "https://api.magichour.ai/v1";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

function videoUrl(data: Record<string, unknown> | null) {
  const downloads = data?.downloads;
  if (Array.isArray(downloads)) {
    for (const item of downloads) {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && typeof (item as { url?: string }).url === "string") return (item as { url: string }).url;
    }
  }
  return String(data?.download_url || data?.video_url || "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const key = (Deno.env.get("MAGIC_HOUR_API_KEY") || "").trim();
  if (!key) return json({ agent_id: "dawn-light", status: "FAILED", error: "missing_MAGIC_HOUR_API_KEY" }, 500);
  const auth = { Accept: "application/json", Authorization: "Bearer " + key, "Content-Type": "application/json" };

  let body: { id?: string; prompt?: string; image_base64?: string; extension?: string } = {};
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  let id = String(body.id || "").trim();
  let created = false;
  if (!id) {
    const b64 = String(body.image_base64 || "").replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
    if (!b64) return json({ agent_id: "dawn-light", error: "need_image_or_id" }, 400);
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const extension = bytes[0] === 0x89 ? "png" : "jpg";
    const upload = await fetch(API + "/files/upload-urls", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ items: [{ type: "image", extension }] }),
    });
    const uploadBody = await readJson(upload);
    const slot = Array.isArray(uploadBody) ? uploadBody[0] : uploadBody.items?.[0] || uploadBody;
    if (!upload.ok || !slot?.upload_url || !slot?.file_path) {
      return json({ agent_id: "dawn-light", function: "dawn-light-photo-video", status: "FAILED", step: "upload-urls", upstream_status: upload.status, error: uploadBody }, upload.status || 502);
    }
    const put = await fetch(slot.upload_url, { method: "PUT", headers: { "Content-Type": extension === "png" ? "image/png" : "image/jpeg" }, body: bytes });
    if (!put.ok) return json({ agent_id: "dawn-light", status: "FAILED", step: "upload-put", upstream_status: put.status }, put.status);
    const create = await fetch(API + "/image-to-video", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        name: "dawn-light photo video",
        end_seconds: 5,
        model: "ltx-2.5",
        resolution: "480p",
        audio: body.audio !== false,
        assets: { image_file_path: slot.file_path },
        style: { prompt: String(body.prompt || "subtle natural motion, ambient scene sound") },
      }),
    });
    const createBody = await readJson(create);
    if (!create.ok || !createBody.id) {
      return json({ agent_id: "dawn-light", function: "dawn-light-photo-video", provider: "magic_hour", status: "FAILED", step: "image-to-video", upstream_status: create.status, error: createBody }, create.status || 502);
    }
    id = String(createBody.id);
    created = true;
  }

  const projectResponse = await fetch(API + "/video-projects/" + encodeURIComponent(id), { headers: { Accept: "application/json", Authorization: "Bearer " + key } });
  const project = await readJson(projectResponse);
  const state = String(project.status || "");
  const url = videoUrl(project);
  const done = state.toLowerCase() === "complete" || Boolean(url);
  return json({
    agent_id: "dawn-light",
    function: "dawn-light-photo-video",
    provider: "magic_hour",
    endpoint: "POST /v1/image-to-video",
    model: "ltx-2.5",
    audio_requested: body.audio !== false,
    created,
    job_id: id,
    duration_seconds: 5,
    status: done ? "COMPLETE" : state || "PROCESSING",
    project_status: projectResponse.status,
    video_url: url,
    downloads: project.downloads || null,
    error: project.error || null,
  }, done ? 200 : 202);
});
