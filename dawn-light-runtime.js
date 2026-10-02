(function (root) {
  "use strict";
  if (root.DawnLightRuntime) return;

  var SUPABASE_URL = "https://clcddygkaaqqtsbswgdf.supabase.co";
  var ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsY2RkeWdrYWFxcXRzYnN3Z2RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MzUwNjQsImV4cCI6MjEwMjMxMTA2NH0.kYg6h7n74CtbiIjNjZ2xxJj16SV42INZVzQ9dLNUfKE";

  var ENDPOINTS = {
    gateway: SUPABASE_URL + "/functions/v1/ai-gateway",
    image: SUPABASE_URL + "/functions/v1/dark-star-image-generation",
    videoResult: SUPABASE_URL + "/functions/v1/magic-hour-result"
  };

  function headers() {
    return {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: "Bearer " + ANON_KEY
    };
  }

  async function post(url, body) {
    var started = Date.now();
    var response = await fetch(url, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body)
    });
    var raw = await response.text();
    var data;
    try { data = JSON.parse(raw); } catch (e) { data = { raw: raw }; }
    return {
      http: response.status,
      okHttp: response.ok,
      latency_ms: Date.now() - started,
      data: data
    };
  }

  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || "")); };
      reader.onerror = function () { reject(new Error("讀取圖片失敗")); };
      reader.readAsDataURL(file);
    });
  }

  async function vision(file) {
    var dataUrl = await fileToDataUrl(file);
    var result = await post(ENDPOINTS.gateway, {
      agent_id: "dawn-light",
      capability: "vision",
      prompt: "描述這張圖片的主色與可見內容。不要猜測沒有送達的圖片。",
      image: dataUrl
    });
    var text = result.data.content || result.data.text || result.data.message || "";
    return {
      capability: "vision",
      status: text ? "REQUIRES_TEST" : "NOT_VERIFIED",
      request_http: result.http,
      provider: result.data.provider || null,
      model: result.data.model || null,
      latency_ms: result.latency_ms,
      result: text,
      note: "現有 ai-gateway 會回文字，但 2026-10-03 實測紅色測試圖被答成黑色，不能標 CONFIRMED。"
    };
  }

  async function image(prompt) {
    var result = await post(ENDPOINTS.image, {
      prompt: prompt,
      mime_type: "image/jpeg",
      aspect_ratio: "1:1"
    });
    var artifact = result.data.artifact || {};
    var url = artifact.signed_url || "";
    var verified = false;
    var downloadedMime = "";
    if (url) {
      var imageResponse = await fetch(url);
      downloadedMime = imageResponse.headers.get("content-type") || "";
      var bytes = new Uint8Array(await imageResponse.arrayBuffer());
      verified = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    }
    var pass = result.data.ok === true && result.data.format_verified === true && result.data.mime_type === "image/jpeg" && verified;
    return {
      capability: "image",
      status: pass ? "CONFIRMED" : "NOT_VERIFIED",
      request_http: result.http,
      provider: result.data.provider || null,
      model: result.data.model || null,
      mime_type: result.data.mime_type || null,
      downloaded_mime: downloadedMime,
      jpeg_magic: verified,
      format_verified: result.data.format_verified === true,
      latency_ms: result.latency_ms,
      url: url,
      bytes: result.data.bytes || null,
      runtime: "dark-star-image-generation",
      note: "重用現有圖片函式，不是新的 Gateway，也沒有改暗星頁面。"
    };
  }

  async function videoResult(projectId) {
    var result = await post(ENDPOINTS.videoResult, { id: projectId });
    var ready = result.data.video_ready === true || (result.data.magic_hour_response && result.data.magic_hour_response.status === "complete");
    var saved = result.data.storage_saved === true;
    return {
      capability: "video",
      status: saved ? "CONFIRMED" : "BLOCKED",
      request_http: result.http,
      provider: result.data.provider || "magic_hour",
      project_id: result.data.project_id || projectId,
      video_ready: ready,
      storage_saved: saved,
      error: result.data.error || result.data.message || null,
      latency_ms: result.latency_ms,
      note: "不在此頁建立新影片任務。2026-10-03 既有任務已完成，但 aivault-videos bucket 不存在。"
    };
  }

  function blocked3d() {
    return {
      capability: "3d",
      status: "BLOCKED",
      provider: null,
      model: null,
      note: "repository 沒有 3D generation runtime。js/aivault-engine-bus.js 將 3D 標為 RESERVED。aivault-3d-stage.html 只是 Three.js 顯示加文字對話。"
    };
  }

  root.DawnLightRuntime = {
    agent_id: "dawn-light",
    endpoints: ENDPOINTS,
    vision: vision,
    image: image,
    videoResult: videoResult,
    blocked3d: blocked3d
  };
})(window);
