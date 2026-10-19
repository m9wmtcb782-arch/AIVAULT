import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * ============================================================
 * AIVAULT MAGIC HOUR TEST v3
 * ============================================================
 *
 * Purpose:
 *   1. 讀取 MAGIC_HOUR_API_KEY
 *   2. 呼叫 Magic Hour Text-to-Video API
 *   3. 使用 model = "default"
 *   4. 讓 Magic Hour 依帳號方案自行選擇可用模型
 *   5. 建立最小 5 秒測試影片 Job
 *
 * IMPORTANT:
 *   - 不修改 AIVAULT AI Gateway
 *   - 不修改 Gemini
 *   - 不修改 Groq
 *   - 不暴露 API Key
 *
 * ============================================================
 */

const VERSION = "magic-hour-test-v3.0";

const MAGIC_HOUR_API_BASE =
  "https://api.magichour.ai/v1";

const TEXT_TO_VIDEO_ENDPOINT =
  `${MAGIC_HOUR_API_BASE}/text-to-video`;

/**
 * ------------------------------------------------------------
 * 測試設定
 * ------------------------------------------------------------
 *
 * model = default
 *
 * Magic Hour 會依目前帳號方案自動選擇模型。
 *
 * 免費方案：
 *   default → ltx-2.3
 *
 * 付費方案：
 *   default → 目前推薦模型
 *
 * ------------------------------------------------------------
 */

const TEST_MODEL = "default";

const TEST_DURATION_SECONDS = 5;

const TEST_ASPECT_RATIO = "16:9";

const TEST_RESOLUTION = "480p";

const TEST_AUDIO = false;

const TEST_PROMPT =
  "A cinematic sunrise over Taipei, realistic city skyline, smooth camera movement, natural lighting.";


/* ============================================================
 * CORS
 * ============================================================ */

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",

    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",

    "Access-Control-Allow-Methods":
      "GET, POST, OPTIONS",

    "Content-Type":
      "application/json; charset=utf-8",
  };
}


/* ============================================================
 * JSON Response
 * ============================================================ */

function json(
  body: unknown,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(
      body,
      null,
      2,
    ),
    {
      status,
      headers:
        corsHeaders(),
    },
  );
}


/* ============================================================
 * Magic Hour API Key
 * ============================================================ */

function getMagicHourKey():
  string | null {

  const key =
    Deno.env.get(
      "MAGIC_HOUR_API_KEY",
    );

  if (
    !key ||
    !key.trim()
  ) {
    return null;
  }

  return key.trim();
}


/* ============================================================
 * Create Video Job
 * ============================================================ */

async function createVideoJob(
  apiKey: string,
) {

  const payload = {
    name:
      "AIVAULT Magic Hour Test",

    end_seconds:
      TEST_DURATION_SECONDS,

    aspect_ratio:
      TEST_ASPECT_RATIO,

    resolution:
      TEST_RESOLUTION,

    model:
      TEST_MODEL,

    audio:
      TEST_AUDIO,

    style: {
      prompt:
        TEST_PROMPT,
    },
  };

  const response =
    await fetch(
      TEXT_TO_VIDEO_ENDPOINT,
      {
        method:
          "POST",

        headers: {
          Accept:
            "application/json",

          Authorization:
            `Bearer ${apiKey}`,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify(
            payload,
          ),
      },
    );

  const responseText =
    await response.text();

  let data:
    unknown = null;

  try {
    data =
      responseText
        ? JSON.parse(
            responseText,
          )
        : null;
  } catch {
    data =
      responseText;
  }

  return {
    response,
    data,
  };
}


/* ============================================================
 * HTTP Handler
 * ============================================================ */

Deno.serve(
  async (
    req: Request,
  ) => {

    const started =
      Date.now();


    /* ========================================================
     * OPTIONS
     * ======================================================== */

    if (
      req.method ===
      "OPTIONS"
    ) {
      return new Response(
        null,
        {
          status:
            204,

          headers:
            corsHeaders(),
        },
      );
    }


    /* ========================================================
     * GET / POST
     * ======================================================== */

    if (
      req.method !==
        "GET" &&
      req.method !==
        "POST"
    ) {

      return json(
        {
          success:
            false,

          error:
            "METHOD_NOT_ALLOWED",

          message:
            "Use GET or POST.",
        },

        405,
      );
    }


    /* ========================================================
     * API KEY CHECK
     * ======================================================== */

    const apiKey =
      getMagicHourKey();

    if (!apiKey) {

      return json(
        {
          success:
            false,

          service:
            "AIVAULT_MAGIC_HOUR_TEST",

          version:
            VERSION,

          provider:
            "magic_hour",

          status:
            "configuration_error",

          error:
            "MAGIC_HOUR_API_KEY_NOT_CONFIGURED",

          message:
            "MAGIC_HOUR_API_KEY is missing from Supabase Edge Function secrets.",

          magic_hour_api_called:
            false,

          video_job_created:
            false,

          credits_consumed:
            false,

          security: {
            api_key_exposed:
              false,
          },
        },

        500,
      );
    }


    /* ========================================================
     * CREATE VIDEO
     * ======================================================== */

    try {

      const {
        response,
        data,
      } =
        await createVideoJob(
          apiKey,
        );


      /* ======================================================
       * SUCCESS
       * ====================================================== */

      if (
        response.ok
      ) {

        const result =
          data as Record<
            string,
            unknown
          >;


        return json(
          {
            success:
              true,

            service:
              "AIVAULT_MAGIC_HOUR_TEST",

            version:
              VERSION,

            provider:
              "magic_hour",

            status:
              "job_created",

            authentication:
              "accepted",

            magic_hour_api_called:
              true,

            video_job_created:
              true,

            credits_consumed:
              "job_created",

            video: {

              id:
                result?.id ??
                null,

              model_requested:
                TEST_MODEL,

              duration_seconds:
                TEST_DURATION_SECONDS,

              aspect_ratio:
                TEST_ASPECT_RATIO,

              resolution:
                TEST_RESOLUTION,

              audio:
                TEST_AUDIO,

              prompt:
                TEST_PROMPT,

              credits_charged:
                result?.credits_charged ??
                null,
            },

            magic_hour_response:
              data,

            timing: {
              response_time_ms:
                Date.now() -
                started,
            },

            security: {
              api_key_exposed:
                false,
            },
          },
        );
      }


      /* ======================================================
       * ERROR CLASSIFICATION
       * ====================================================== */

      let errorCode =
        "MAGIC_HOUR_API_ERROR";


      if (
        response.status ===
        401
      ) {

        errorCode =
          "MAGIC_HOUR_INVALID_API_KEY";

      } else if (
        response.status ===
        402
      ) {

        errorCode =
          "MAGIC_HOUR_INSUFFICIENT_CREDITS";

      } else if (
        response.status ===
        403
      ) {

        errorCode =
          "MAGIC_HOUR_ACCESS_DENIED";

      } else if (
        response.status ===
        422
      ) {

        errorCode =
          "MAGIC_HOUR_INVALID_REQUEST";

      } else if (
        response.status ===
        429
      ) {

        errorCode =
          "MAGIC_HOUR_RATE_LIMITED";
      }


      return json(
        {
          success:
            false,

          service:
            "AIVAULT_MAGIC_HOUR_TEST",

          version:
            VERSION,

          provider:
            "magic_hour",

          status:
            "error",

          authentication:
            response.status ===
              401
              ? "failed"
              : "unknown",

          error:
            errorCode,

          http_status:
            response.status,

          message:
            "Magic Hour rejected the video request.",

          magic_hour_api_called:
            true,

          video_job_created:
            false,

          credits_consumed:
            false,

          magic_hour_response:
            data,

          request: {
            model:
              TEST_MODEL,

            duration_seconds:
              TEST_DURATION_SECONDS,

            aspect_ratio:
              TEST_ASPECT_RATIO,

            resolution:
              TEST_RESOLUTION,

            audio:
              TEST_AUDIO,
          },

          timing: {
            response_time_ms:
              Date.now() -
              started,
          },

          security: {
            api_key_exposed:
              false,
          },
        },

        response.status,
      );

    } catch (
      error
    ) {

      const message =
        error instanceof Error
          ? error.message
          : String(error);


      return json(
        {
          success:
            false,

          service:
            "AIVAULT_MAGIC_HOUR_TEST",

          version:
            VERSION,

          provider:
            "magic_hour",

          status:
            "connection_error",

          error:
            "MAGIC_HOUR_CONNECTION_FAILED",

          message,

          magic_hour_api_called:
            false,

          video_job_created:
            false,

          credits_consumed:
            false,

          timing: {
            response_time_ms:
              Date.now() -
              started,
          },

          security: {
            api_key_exposed:
              false,
          },
        },

        502,
      );
    }
  },
);