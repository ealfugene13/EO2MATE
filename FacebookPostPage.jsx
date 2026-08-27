import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AUCTION_FINALIZER_SECRET = Deno.env.get("AUCTION_FINALIZER_SECRET") || "";
const GRAPH_VERSION = "v23.0";
const META_WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/meta-webhook`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

function json(data: unknown, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    },
  );
}

function getString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const result = String(value).trim();
  return result || null;
}

async function getUser(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();

  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) return null;

  return data.user;
}

async function getMembership(userId: string, clientId: string) {
  const { data, error } = await supabase
    .from("client_users")
    .select("*")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (error) {
    throw new Error(`client_users lookup failed: ${error.message}`);
  }

  return data;
}

async function getPage(clientId: string, fbPageId: string) {
  const { data, error } = await supabase
    .from("fb_pages")
    .select("*")
    .eq("client_id", clientId)
    .eq("fb_page_id", fbPageId)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (error) {
    throw new Error(`fb_pages lookup failed: ${error.message}`);
  }

  return data;
}

async function listClientPages(
  clientId: string,
) {
  const { data, error } = await supabase
    .from("fb_pages")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "ACTIVE")
    .order("connected_at", { ascending: true });

  if (error) {
    throw new Error(`fb_pages lookup failed: ${error.message}`);
  }

  const result: any[] = [];

  for (const page of data || []) {
    const fbPageId = getString(page?.fb_page_id);
    const accessToken = getString(page?.access_token);

    if (!fbPageId) continue;

    let actualPageName: string | null = null;

    /*
     * Always prefer the actual current Facebook Page name.
     * This avoids relying on local fb_pages schema/legacy columns.
     */
    if (accessToken) {
      try {
        const graphPage = await graphJson(
          `${encodeURIComponent(fbPageId)}?fields=id,name&access_token=${encodeURIComponent(accessToken)}`,
          {
            method: "GET",
          },
        );

        actualPageName = getString(graphPage?.name);
      } catch (error) {
        console.warn(
          `Unable to resolve Facebook Page name for ${fbPageId}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    const storedName =
      getString(page?.page_name) ||
      getString(page?.fb_page_name) ||
      getString(page?.name) ||
      getString(page?.page_title) ||
      getString(page?.display_name);

    result.push({
      fb_page_id: fbPageId,
      page_name:
        actualPageName ||
        storedName ||
        "Facebook Page",
      status: page.status,
      connected_at: page.connected_at || null,
    });
  }

  return result;
}


async function listActiveEnvironments() {
  const { data, error } = await supabase
    .from("eo2mate_environments")
    .select(
      "environment_code, environment_name, environment_rank, description, is_active",
    )
    .eq("is_active", true)
    .order("environment_rank", { ascending: true });

  if (error) {
    throw new Error(`eo2mate_environments lookup failed: ${error.message}`);
  }

  return data || [];
}

async function getEnvironment(environmentCode: string) {
  const code = String(environmentCode || "").trim().toUpperCase();

  if (!code) return null;

  const { data, error } = await supabase
    .from("eo2mate_environments")
    .select(
      "environment_code, environment_name, environment_rank, description, is_active",
    )
    .eq("environment_code", code)
    .maybeSingle();

  if (error) {
    throw new Error(`eo2mate_environments lookup failed: ${error.message}`);
  }

  return data;
}


async function listActiveAuctionPostTypes() {
  const { data, error } = await supabase
    .from("eo2mate_post_mode_types")
    .select(`
      mode_code,
      post_type_code,
      display_name,
      caption_marker,
      description,
      is_active,
      sort_order,
      eo2mate_post_types!inner(
        post_type_name,
        is_multiple,
        min_images,
        is_active,
        sort_order
      ),
      eo2mate_post_modes!inner(
        mode_name,
        is_active
      )
    `)
    .eq("mode_code", "AUCTION")
    .eq("is_active", true)
    .eq("eo2mate_post_types.is_active", true)
    .eq("eo2mate_post_modes.is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`Auction post type lookup failed: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    mode_code: row.mode_code,
    post_type_code: row.post_type_code,
    display_name: row.display_name,
    caption_marker: row.caption_marker,
    description: row.description || null,
    is_multiple: row.eo2mate_post_types?.is_multiple === true,
    min_images: Number(row.eo2mate_post_types?.min_images || 1),
  }));
}


async function getAuctionPostType(
  postTypeCode: string,
) {
  const code = String(postTypeCode || "")
    .trim()
    .toUpperCase();

  if (!code) return null;

  const rows =
    await listActiveAuctionPostTypes();

  return rows.find(
    (row: any) =>
      String(row.post_type_code).toUpperCase() === code,
  ) || null;
}


async function getSubscription(clientId: string) {
  const { data, error } = await supabase
    .from("client_subscriptions")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) {
    throw new Error(`client_subscriptions lookup failed: ${error.message}`);
  }

  return data;
}

async function getAutomationControl(
  clientId: string,
  scopeType: "CLIENT" | "PAGE",
  scopeId: string,
) {
  const { data, error } = await supabase
    .from("eo2mate_automation_controls")
    .select("*")
    .eq("client_id", clientId)
    .eq("scope_type", scopeType)
    .eq("scope_id", scopeId)
    .maybeSingle();

  if (error) {
    throw new Error(`automation control lookup failed: ${error.message}`);
  }

  return data;
}

async function assertPostingAllowed(
  clientId: string,
  fbPageId: string,
  requestedEnvironment: string,
) {
  const [
    subscription,
    clientControl,
    pageControl,
    requestedEnvironmentRow,
  ] = await Promise.all([
    getSubscription(clientId),
    getAutomationControl(clientId, "CLIENT", clientId),
    getAutomationControl(clientId, "PAGE", fbPageId),
    getEnvironment(requestedEnvironment),
  ]);

  if (clientControl?.is_enabled === false) {
    throw new Error(
      clientControl?.reason
        ? `Client automation is suspended: ${clientControl.reason}`
        : "Client automation is suspended.",
    );
  }

  if (pageControl?.is_enabled === false) {
    throw new Error(
      pageControl?.reason
        ? `Facebook Page automation is suspended: ${pageControl.reason}`
        : "Facebook Page automation is suspended.",
    );
  }

  if (!requestedEnvironmentRow) {
    throw new Error(
      `${requestedEnvironment} is not configured in eo2mate_environments.`,
    );
  }

  if (requestedEnvironmentRow.is_active !== true) {
    throw new Error(
      `${requestedEnvironment} is currently disabled in EO2MATE setup.`,
    );
  }

  if (!subscription) {
    // Backward compatibility for legacy clients.
    return;
  }

  const subscriptionStatus = String(
    subscription.subscription_status || "",
  ).toUpperCase();

  if (!["TRIAL", "ACTIVE"].includes(subscriptionStatus)) {
    throw new Error(
      `Subscription status is ${subscriptionStatus || "UNKNOWN"}.`,
    );
  }

  const allowedEnvironment = String(
    subscription.allowed_environment || "CLNT",
  ).toUpperCase();

  const allowedEnvironmentRow =
    await getEnvironment(allowedEnvironment);

  if (!allowedEnvironmentRow) {
    throw new Error(
      `Allowed mode ${allowedEnvironment} is not configured in eo2mate_environments.`,
    );
  }

  if (
    Number(requestedEnvironmentRow.environment_rank) >
    Number(allowedEnvironmentRow.environment_rank)
  ) {
    throw new Error(
      `${requestedEnvironment} is not enabled for this client. Allowed mode: ${allowedEnvironment}.`,
    );
  }
}

async function graphJson(
  path: string,
  init: RequestInit,
) {
  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${path}`,
    init,
  );

  const text = await response.text();

  let result: any = {};

  try {
    result = text ? JSON.parse(text) : {};
  } catch {
    result = { raw: text };
  }

  if (!response.ok || result?.error) {
    throw new Error(
      `Meta API error ${response.status}: ${JSON.stringify(result)}`,
    );
  }

  return result;
}

async function uploadUnpublishedPhoto(
  fbPageId: string,
  accessToken: string,
  file: File,
  caption: string,
) {
  const form = new FormData();

  form.append("source", file, file.name || "auction-photo.jpg");
  form.append("published", "false");
  form.append("access_token", accessToken);

  if (caption.trim()) {
    /*
     * Page Photo objects expose their text via the "name" field.
     * The upload endpoint uses caption for the Photo description.
     */
    form.append("caption", caption.trim());
  }

  const result = await graphJson(
    `${encodeURIComponent(fbPageId)}/photos`,
    {
      method: "POST",
      body: form,
    },
  );

  const id = getString(result?.id);

  if (!id) {
    throw new Error("Facebook photo upload returned no photo ID.");
  }

  return id;
}

async function publishFeedPost(
  fbPageId: string,
  accessToken: string,
  message: string,
  photoIds: string[],
) {
  const body = new URLSearchParams();

  body.set("access_token", accessToken);
  body.set("message", message);

  photoIds.forEach((photoId, index) => {
    body.set(
      `attached_media[${index}]`,
      JSON.stringify({
        media_fbid: photoId,
      }),
    );
  });

  const result = await graphJson(
    `${encodeURIComponent(fbPageId)}/feed`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );

  const postId = getString(result?.id);

  if (!postId) {
    throw new Error("Facebook feed publish returned no post ID.");
  }

  return postId;
}

/* =========================================================
   REGISTER UI-CREATED AUCTION WITH EO2MATE
   ========================================================= */

async function registerPublishedAuction(
  fbPageId: string,
  fbPostId: string,
  mainCaption: string,
  inventoryItems: any[] = [],
) {
  if (!AUCTION_FINALIZER_SECRET) {
    throw new Error(
      "AUCTION_FINALIZER_SECRET is not configured in auction-publish.",
    );
  }

  const response = await fetch(
    `${META_WEBHOOK_URL}?action=register-published-auction`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AUCTION_FINALIZER_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fb_page_id: fbPageId,
        fb_post_id: fbPostId,
        message: mainCaption,
        inventory_items: inventoryItems,
      }),
    },
  );

  const text = await response.text();

  let result: any = {};

  try {
    result = text ? JSON.parse(text) : {};
  } catch {
    result = { raw: text };
  }

  if (!response.ok || result?.success !== true) {
    throw new Error(
      `EO2MATE auction registration failed (${response.status}): ${JSON.stringify(result)}`,
    );
  }

  if (result?.registered !== true) {
    throw new Error(
      `EO2MATE auction registration was not confirmed: ${JSON.stringify(result)}`,
    );
  }

  return result;
}

async function getPermalink(
  postId: string,
  accessToken: string,
) {
  try {
    const result = await graphJson(
      `${encodeURIComponent(postId)}?fields=permalink_url&access_token=${encodeURIComponent(accessToken)}`,
      {
        method: "GET",
      },
    );

    return getString(result?.permalink_url);
  } catch (error) {
    console.warn(
      "Unable to read Facebook permalink:",
      error instanceof Error ? error.message : String(error),
    );

    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(
      "ok",
      {
        status: 200,
        headers: corsHeaders,
      },
    );
  }

  try {
    if (req.method !== "POST") {
      return json(
        {
          success: false,
          error: "METHOD_NOT_ALLOWED",
        },
        405,
      );
    }

    const user = await getUser(req);

    if (!user) {
      return json(
        {
          success: false,
          error: "UNAUTHORIZED",
        },
        401,
      );
    }

    const contentType =
      String(
        req.headers.get("content-type") || "",
      )
        .toLowerCase();

    /*
     * JSON request = posting screen setup/read.
     * Multipart form = publish action.
     */
    if (
      contentType.includes(
        "application/json",
      )
    ) {
      let body: any = {};

      try {
        body =
          await req.json();
      } catch {
        body = {};
      }

      const action =
        String(
          body?.action ||
          "",
        )
          .trim()
          .toUpperCase();

      const clientId =
        getString(
          body?.client_id,
        );

      if (
        action !==
        "LIST_SETUP"
      ) {
        return json(
          {
            success: false,
            error: "UNSUPPORTED_ACTION",
          },
          400,
        );
      }

      if (
        !clientId
      ) {
        return json(
          {
            success: false,
            error: "CLIENT_ID_REQUIRED",
          },
          400,
        );
      }

      const membership =
        await getMembership(
          user.id,
          clientId,
        );

      if (
        !membership
      ) {
        return json(
          {
            success: false,
            error: "FORBIDDEN",
          },
          403,
        );
      }

      const [
        pages,
        subscription,
        environments,
        auctionPostTypes,
      ] =
        await Promise.all(
          [
            listClientPages(
              clientId,
            ),
            getSubscription(
              clientId,
            ),
            listActiveEnvironments(),
            listActiveAuctionPostTypes(),
          ],
        );

      return json(
        {
          success: true,
          action: "LIST_SETUP",
          pages,
          subscription,
          environments,
          auction_post_types:
            auctionPostTypes,
        },
      );
    }

    if (
      !contentType.includes(
        "multipart/form-data",
      )
    ) {
      return json(
        {
          success: false,
          error: "UNSUPPORTED_CONTENT_TYPE",
        },
        415,
      );
    }

    const form =
      await req.formData();

    const payloadRaw =
      getString(
        form.get(
          "payload",
        ),
      );

    if (
      !payloadRaw
    ) {
      return json(
        {
          success: false,
          error: "PAYLOAD_REQUIRED",
        },
        400,
      );
    }

    let payload: any;

    try {
      payload =
        JSON.parse(
          payloadRaw,
        );
    } catch {
      return json(
        {
          success: false,
          error: "INVALID_PAYLOAD_JSON",
        },
        400,
      );
    }

    const clientId = getString(payload?.client_id);
    const fbPageId = getString(payload?.fb_page_id);
    const environment = String(payload?.environment || "")
      .trim()
      .toUpperCase();
    const postType = String(payload?.post_type || "")
      .trim()
      .toUpperCase();
    const mainCaption = getString(payload?.main_caption);
    const inventoryItems = Array.isArray(payload?.inventory_items)
      ? payload.inventory_items
      : [];
    const photoCaptions = Array.isArray(payload?.photo_captions)
      ? payload.photo_captions.map((value: unknown) => String(value ?? ""))
      : [];

    if (!clientId || !fbPageId || !mainCaption) {
      return json(
        {
          success: false,
          error: "REQUIRED_FIELDS_MISSING",
        },
        400,
      );
    }

    const environmentRow =
      await getEnvironment(environment);

    if (!environmentRow || environmentRow.is_active !== true) {
      return json(
        {
          success: false,
          error: "INVALID_ENVIRONMENT",
          message:
            environment
              ? `${environment} is not an active EO2MATE operating mode.`
              : "Operating mode is required.",
        },
        400,
      );
    }

    const postTypeConfig =
      await getAuctionPostType(
        postType,
      );

    if (!postTypeConfig) {
      return json(
        {
          success: false,
          error: "INVALID_POST_TYPE",
          message:
            postType
              ? `${postType} is not an active Auction post type.`
              : "Auction post type is required.",
        },
        400,
      );
    }

    const isMultiple =
      postTypeConfig.is_multiple ===
      true;

    const minimumImages =
      Math.max(
        1,
        Number(
          postTypeConfig.min_images ||
          1,
        ),
      );

    const membership = await getMembership(
      user.id,
      clientId,
    );

    if (!membership) {
      return json(
        {
          success: false,
          error: "FORBIDDEN",
        },
        403,
      );
    }

    const page = await getPage(
      clientId,
      fbPageId,
    );

    if (!page) {
      return json(
        {
          success: false,
          error: "PAGE_NOT_FOUND",
        },
        404,
      );
    }

    await assertPostingAllowed(
      clientId,
      fbPageId,
      environment,
    );

    const accessToken = getString(page?.access_token);

    if (!accessToken) {
      throw new Error(
        "The connected Facebook Page has no stored access token.",
      );
    }

    const files: File[] = [];

    for (let index = 0; index < 10; index++) {
      const value = form.get(`image_${index}`);

      if (!value) continue;

      if (!(value instanceof File)) {
        throw new Error(`image_${index} is not a file.`);
      }

      if (!["image/jpeg", "image/png"].includes(value.type)) {
        throw new Error(
          `${value.name}: only JPG and PNG are supported.`,
        );
      }

      if (value.size > 10 * 1024 * 1024) {
        throw new Error(
          `${value.name}: maximum image size is 10 MB.`,
        );
      }

      files.push(value);
    }

    if (files.length === 0) {
      return json(
        {
          success: false,
          error: "IMAGE_REQUIRED",
        },
        400,
      );
    }

    if (
      files.length <
      minimumImages
    ) {
      return json(
        {
          success: false,
          error: "POST_TYPE_MINIMUM_IMAGES_NOT_MET",
          message:
            `${postTypeConfig.display_name} requires at least ${minimumImages} image(s).`,
        },
        400,
      );
    }

    if (
      isMultiple &&
      photoCaptions.length !== files.length
    ) {
      return json(
        {
          success: false,
          error: "PHOTO_CAPTION_COUNT_MISMATCH",
        },
        400,
      );
    }

    const uploadedPhotoIds: string[] = [];

    /*
     * Upload sequentially. This preserves the exact order the
     * seller arranged in the UI and avoids hammering the Page
     * photos endpoint with a burst of multipart uploads.
     */
    for (let index = 0; index < files.length; index++) {
      const caption =
        isMultiple
          ? String(photoCaptions[index] || "")
          : "";

      const photoId = await uploadUnpublishedPhoto(
        fbPageId,
        accessToken,
        files[index],
        caption,
      );

      uploadedPhotoIds.push(photoId);
    }

    const fbPostId = await publishFeedPost(
      fbPageId,
      accessToken,
      mainCaption,
      uploadedPhotoIds,
    );

    /*
     * Critical EO2MATE fix:
     *
     * Register the UI-created Facebook auction immediately
     * instead of depending only on Meta to echo the Page-created
     * post back through the normal feed webhook.
     */
    const registration = await registerPublishedAuction(
      fbPageId,
      fbPostId,
      mainCaption,
      inventoryItems,
    );

    const permalinkUrl = await getPermalink(
      fbPostId,
      accessToken,
    );

    return json({
      success: true,
      fb_post_id: fbPostId,
      permalink_url: permalinkUrl,
      fb_page_id: fbPageId,
      environment,
      post_type: postType,
      post_type_display_name:
        postTypeConfig.display_name,
      image_count: files.length,
      uploaded_photo_ids: uploadedPhotoIds,
      automation_registered: true,
      auction_post_id:
        registration?.auction_post_id || null,
      message:
        "Facebook auction post published and EO2MATE automation activated successfully.",
    });
  } catch (error) {
    console.error(error);

    return json(
      {
        success: false,
        error: "FACEBOOK_AUCTION_PUBLISH_FAILED",
        message:
          error instanceof Error
            ? error.message
            : String(error),
      },
      500,
    );
  }
});
