/* AIVAULT_DARK_STAR_JPG_GENERATION_V1
 * Purpose: connect Technical Dark Star's existing image-generation Edge Function
 * to the existing chat UI without replacing the chat/Gateway/Sandbox/voice stack.
 */
(() => {
  "use strict";
  if (window.__AIVAULT_DARK_STAR_JPG_GENERATION_V1__) return;
  window.__AIVAULT_DARK_STAR_JPG_GENERATION_V1__ = true;

  const IMAGE_URL =
    "https://clcddygkaaqqtsbswgdf.supabase.co/functions/v1/dark-star-image-generation";

  const isJpgIntent = (text) => {
    const s = String(text || "").trim();
    if (!s) return false;
    if (/svg|程式碼|code|sandbox|沙盒/i.test(s)) return false;
    return /生成\s*(一張|圖片|照片|jpg|jpeg)?|產生\s*(一張|圖片|照片|jpg|jpeg)?|生圖|生成jpg|生成jpeg|輸出jpg|輸出jpeg|jpg圖片|jpeg圖片|畫一張|畫圖片|做一張圖片|做圖片/i.test(s);
  };

  async function generateJPG(prompt, refs, signal) {
    const reference_images = (refs || [])
      .filter(x => x && x.content_type === "image" && x.content_base64)
      .slice(0, 4)
      .map(x => ({
        mime_type: x.type || "image/jpeg",
        data: x.content_base64
      }));

    const response = await fetch(IMAGE_URL, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        prompt,
        mime_type: "image/jpeg",
        aspect_ratio: "1:1",
        image_size: "1K",
        reference_images
      })
    });

    const raw = await response.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error("暗星圖片生成服務回傳不是 JSON：\n" + raw.slice(0, 1000));
    }

    if (!response.ok || data?.ok === false) {
      throw new Error(
        String(data?.error?.message || data?.message || data?.error || ("HTTP " + response.status))
      );
    }

    const artifact = data.artifact || {};
    const url = artifact.signed_url || data.url || data.image_url || null;
    if (!url) {
      throw new Error("圖片已由生成服務回傳，但沒有取得 JPG 顯示網址。");
    }

    return {
      ok: true,
      status: "generated",
      capability: "image_generation",
      provider: data.provider || "google",
      model: data.model || "gemini-3.1-flash-image",
      mime_type: "image/jpeg",
      artifact,
      images: [{
        name: "dark-star-generated.jpg",
        content_type: "image",
        type: "image/jpeg",
        url
      }]
    };
  }

  function renderGeneratedJPG(result) {
    const url = result?.artifact?.signed_url || result?.images?.[0]?.url;
    if (!url || typeof renderMediaStack !== "function") return;

    const row = document.querySelector("#messagesInner .message.ai:last-child");
    const body = row?.querySelector(".message-body");
    if (!body) return;

    const existing = body.querySelector(".jpg-generation-result");
    if (existing) existing.remove();

    const card = document.createElement("div");
    card.className = "jpg-generation-result";
    card.style.marginTop = "10px";

    const img = document.createElement("img");
    img.className = "media-image";
    img.src = url;
    img.alt = "暗星生成的 JPG";
    img.loading = "eager";

    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "開啟 JPG";
    link.style.display = "inline-block";
    link.style.marginTop = "6px";
    link.style.fontSize = "13px";

    card.appendChild(img);
    card.appendChild(link);
    body.appendChild(card);
    if (typeof scrollBottom === "function") scrollBottom();
  }

  async function runJPGGeneration(text, outgoingFiles) {
    const loading = createLoadingMessage("📍 AIVAULT → 暗星圖片生成 → JPG");
    try {
      const result = await generateJPG(
        text,
        outgoingFiles,
        typeof getDarkStarAbortSignal === "function"
          ? getDarkStarAbortSignal()
          : undefined
      );

      loading.remove();

      const reply = "已生成 JPG 圖片。";
      renderAIMessage(reply, result);

      if (Array.isArray(messagesHistory)) {
        messagesHistory.push({
          role: "assistant",
          text: reply,
          result
        });
        saveState();
      }

      return result;
    } catch (error) {
      loading.remove();
      throw error;
    }
  }

  function shouldIntercept(text) {
    return isJpgIntent(text);
  }

  async function interceptSend(event) {
    if (!shouldIntercept(input.value)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (typeof isSending !== "boolean" || isSending) return;
    if (!input.value.trim() && !attachments.length) return;

    isSending = true;
    darkStarStopRequested = false;
    activeDarkStarAbortController = new AbortController();
    sendButton.disabled = true;

    const text = input.value.trim();
    const outgoingFiles = attachments.map(file => ({...file}));

    renderUserMessage(text, outgoingFiles);
    messagesHistory.push({
      role: "user",
      text,
      attachments: outgoingFiles.map(file => ({
        name: file.name,
        type: file.type,
        size: file.size,
        content_type: file.content_type,
        preview: file.preview || file.content_base64 || null
      }))
    });
    saveState();

    input.value = "";
    attachments = [];
    renderAttachments();
    resizeInput();

    try {
      await runJPGGeneration(text, outgoingFiles);
    } catch (error) {
      const msg = "暗星 JPG 生成失敗。\n\n" + String(error?.message || error);
      renderAIMessage(msg);
      messagesHistory.push({role:"assistant", text:msg});
      saveState();
    } finally {
      isSending = false;
      activeDarkStarAbortController = null;
      darkStarStopRequested = false;
      sendButton.disabled = !input.value.trim() && attachments.length === 0;
      renderHistory();
    }
  }

  // Capture before the existing composer handlers so JPG requests do not enter
  // the old SVG Draw Sandbox route.
  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey && shouldIntercept(input.value)) {
      interceptSend(event);
    }
  }, true);

  sendButton.addEventListener("click", event => {
    if (shouldIntercept(input.value)) interceptSend(event);
  }, true);

  // Also expose a small diagnostic surface without changing the normal UI.
  window.AIVAULT_DARK_STAR_JPG = {
    generate: (prompt) => generateJPG(prompt, [], undefined)
  };

  console.info("[DarkStar][JPG] JPG generation route installed.");
})();
