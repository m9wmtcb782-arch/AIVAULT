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

function jobId(data: Record<string, unknown> | null) {
  if (!data) return "";
  return String(data.id || data.project_id || data.video_id || data.job_id || "").trim();
}

function videoUrl(data: Record<string, unknown> | null) {
  if (!data) return "";
  const downloads = data.downloads;
  if (Array.isArray(downloads)) {
    for (const item of downloads) {
      if (typeof item === "string" && item) return item;
      if (item && typeof item === "object" && typeof (item as { url?: string }).url === "string") {
        return (item as { url: string }).url;
      }
    }
  }
  return String(data.download_url || data.video_url || data.url || "");
}

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const key = (Deno.env.get("MAGIC_HOUR_API_KEY") || "").trim();
  if (!key) {
    return json({
      agent_id: "dawn-light",
      function: "dawn-light-video",
      provider: "magic_hour",
      status: "FAILED",
      error: "missing_MAGIC_HOUR_API_KEY",
    }, 500);
  }

  let body: { prompt?: string; id?: string; duration_seconds?: number } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  let created = false;
  let id = String(body.id || "").trim();
  let createStatus = 0;
  let createBody: Record<string, unknown> | null = null;
  if (!id) {
    const prompt = String(body.prompt || "").trim();
    if (!prompt) return json({ agent_id: "dawn-light", error: "need_prompt_or_id" }, 400);
    const seconds = Math.min(5, Math.max(5, Number(body.duration_seconds) || 5));
    const response = await fetch(API + "/text-to-video", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "dawn-light short video",
        end_seconds: seconds,
        aspect_ratio: "16:9",
        resolution: "480p",
        model: "default",
        audio: false,
        style: { prompt },
      }),
    });
    createStatus = response.status;
    createBody = await readJson(response);
    if (!response.ok) {
      return json({
        agent_id: "dawn-light",
        function: "dawn-light-video",
        provider: "magic_hour",
        runtime: "magic-hour-test text-to-video",
        status: "FAILED",
        upstream_status: createStatus,
        error: createBody,
      }, response.status);
    }
    id = jobId(createBody);
    created = true;
    if (!id) {
      return json({
        agent_id: "dawn-light",
        function: "dawn-light-video",
        provider: "magic_hour",
        status: "FAILED",
        upstream_status: createStatus,
        error: "no_job_id",
        create: createBody,
      }, 502);
    }
  }

  let project: Record<string, unknown> | null = null;
  let projectStatus = 0;
  for (let i = 0; i < 6; i++) {
    const response = await fetch(API + "/video-projects/" + encodeURIComponent(id), {
      headers: { Accept: "application/json", Authorization: "Bearer " + key },
    });
    projectStatus = response.status;
    project = await readJson(response);
    const state = String(project?.status || "").toLowerCase();
    if (state === "complete" || state === "completed" || videoUrl(project)) break;
    if (state === "error" || state === "failed") break;
    await new Promise((resolve) => setTimeout(resolve, 8000));
  }

  const state = String(project?.status || "");
  const url = videoUrl(project);
  const done = state.toLowerCase() === "complete" || state.toLowerCase() === "completed" || Boolean(url);
  return json({
    agent_id: "dawn-light",
    function: "dawn-light-video",
    provider: "magic_hour",
    runtime: "existing MAGIC_HOUR_API_KEY text-to-video plus video-projects",
    created,
    job_id: id,
    duration_seconds: 5,
    format: "mp4",
    status: done ? "COMPLETE" : state || "PROCESSING",
    create_status: createStatus || null,
    project_status: projectStatus,
    video_url: url,
    downloads: project?.downloads || null,
    error: project?.error || null,
  }, done ? 200 : 202);
});
