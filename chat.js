// Cloudflare Pages Function
// Bu dosya siteye deploy edildiğinde otomatik olarak /api/chat adresinde çalışır.
// Görevi: tarayıcıdan gelen mesajı, Hugging Face Space'teki gerçek modele iletmek
// ve cevabı geri döndürmek (CORS derdi olmadan, tek origin üzerinden).

const SPACE_URL = "https://gokturk97-astrumdemo.hf.space";
const API_NAME = "chat"; // app.py'deki send_btn.click(..., api_name="chat") ile eşleşmeli

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const message = (body.message || "").toString();
    const history = Array.isArray(body.history) ? body.history : [];
    const sessionCount = Number.isFinite(body.session_count) ? body.session_count : 0;

    if (!message.trim()) {
      return json({ error: "Boş mesaj gönderilemez." }, 400);
    }

    // 1) Gradio'nun REST API'sine isteği başlat
    const callRes = await fetch(`${SPACE_URL}/gradio_api/call/${API_NAME}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [message, history, sessionCount] }),
    });

    if (!callRes.ok) {
      const text = await callRes.text();
      return json(
        { error: "Model sunucusuna ulaşılamadı.", detail: text.slice(0, 500) },
        502
      );
    }

    const { event_id } = await callRes.json();
    if (!event_id) {
      return json({ error: "Model sunucusundan event_id alınamadı." }, 502);
    }

    // 2) Sonucu SSE (server-sent events) akışından oku
    const streamRes = await fetch(
      `${SPACE_URL}/gradio_api/call/${API_NAME}/${event_id}`
    );

    if (!streamRes.ok || !streamRes.body) {
      return json({ error: "Model çıktısı okunamadı." }, 502);
    }

    const reader = streamRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalData = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop(); // yarım kalan satırı sonraki turda tamamla

      for (const line of lines) {
        if (line.startsWith("data:")) {
          const raw = line.slice(5).trim();
          if (!raw || raw === "null") continue;
          try {
            finalData = JSON.parse(raw);
          } catch (_) {
            // bu satır parse edilemedi, sıradaki data satırını bekle
          }
        }
      }
    }

    if (!finalData) {
      return json({ error: "Model bir cevap döndürmedi (zaman aşımı olabilir)." }, 504);
    }

    // outputs sırası app.py'deki ile birebir aynı olmalı:
    // [chatbot, session_count_state, file_output, msg_box, tool_info_box]
    const [newHistory, newSessionCount, fileOutput, , toolInfoRaw] = finalData;

    let toolInfo = { tool: null, detail: null, code: null };
    try {
      toolInfo =
        typeof toolInfoRaw === "string" ? JSON.parse(toolInfoRaw) : (toolInfoRaw || toolInfo);
    } catch (_) {
      // varsayılanla devam
    }

    let fileUrl = null;
    if (fileOutput) {
      if (typeof fileOutput === "string") {
        fileUrl = `${SPACE_URL}/file=${fileOutput}`;
      } else if (fileOutput.url) {
        fileUrl = fileOutput.url;
      } else if (fileOutput.path) {
        fileUrl = `${SPACE_URL}/file=${fileOutput.path}`;
      }
    }

    const lastAssistant = [...newHistory].reverse().find((m) => m.role === "assistant");

    return json({
      response: lastAssistant ? lastAssistant.content : "",
      history: newHistory,
      session_count: newSessionCount,
      file_url: fileUrl,
      tool: toolInfo.tool,
      tool_detail: toolInfo.detail,
      code_to_run: toolInfo.code,
    });
  } catch (err) {
    return json({ error: "Sunucu hatası.", detail: String(err) }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
