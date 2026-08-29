import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const INVENTORY_BUCKET = "inventory-images";
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
function getString(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const result = String(value).trim();
  return result || null;
}
function getNumber(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replaceAll(",", "").replaceAll("₱", "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}
async function getUser(req) {
  const auth = req.headers.get("Authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) {
    return null;
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return null;
  }
  return data.user;
}
async function getMembership(userId, clientId) {
  const { data, error } = await supabase.from("client_users").select("*").eq("user_id", userId).eq("client_id", clientId).eq("status", "ACTIVE").maybeSingle();
  if (error) {
    throw new Error(`client_users lookup failed: ${error.message}`);
  }
  return data;
}
async function assertMembership(userId, clientId) {
  const membership = await getMembership(userId, clientId);
  if (!membership) {
    throw new Error("FORBIDDEN");
  }
  return membership;
}
async function getDefaultOwner(clientId) {
  const { data, error } = await supabase.from("inventory_owners").select("*").eq("client_id", clientId).eq("is_default", true).maybeSingle();
  if (error) {
    throw new Error(`Default inventory owner lookup failed: ${error.message}`);
  }
  return data;
}
async function ensureDefaultOwner(clientId) {
  const existing = await getDefaultOwner(clientId);
  if (existing) {
    return existing;
  }
  const { data: client, error: clientError } = await supabase.from("master_clients").select("client_id,name").eq("client_id", clientId).single();
  if (clientError) {
    throw new Error(`Client lookup failed: ${clientError.message}`);
  }
  const { data, error } = await supabase.from("inventory_owners").insert({
    client_id: clientId,
    owner_type_code: "OWN",
    owner_code: "OWN",
    owner_name: client.name,
    status: "ACTIVE",
    is_default: true
  }).select("*").single();
  if (error) {
    throw new Error(`Default inventory owner creation failed: ${error.message}`);
  }
  return data;
}
async function listSetup(clientId) {
  await ensureDefaultOwner(clientId);
  const [ownersResult, ownerTypesResult, movementTypesResult] = await Promise.all([
    supabase.from("inventory_owners").select("*").eq("client_id", clientId).order("is_default", {
      ascending: false
    }).order("owner_name", {
      ascending: true
    }),
    supabase.from("inventory_owner_types").select("*").eq("is_active", true).order("sort_order", {
      ascending: true
    }),
    supabase.from("inventory_movement_types").select("*").eq("is_active", true).order("sort_order", {
      ascending: true
    })
  ]);
  if (ownersResult.error) {
    throw new Error(`Owner list failed: ${ownersResult.error.message}`);
  }
  if (ownerTypesResult.error) {
    throw new Error(`Owner type list failed: ${ownerTypesResult.error.message}`);
  }
  if (movementTypesResult.error) {
    throw new Error(`Movement type list failed: ${movementTypesResult.error.message}`);
  }
  return {
    owners: ownersResult.data || [],
    owner_types: ownerTypesResult.data || [],
    movement_types: movementTypesResult.data || []
  };
}
async function listItems(clientId, search, status) {
  let query = supabase.from("inventory_items_with_stock").select("*").eq("client_id", clientId).order("updated_at", {
    ascending: false
  });
  if (status && status !== "ALL") {
    query = query.eq("status", status);
  }
  if (search) {
    const safe = search.replaceAll("%", "").replaceAll(",", " ");
    query = query.or(`item_code.ilike.%${safe}%,item_name.ilike.%${safe}%,owner_name.ilike.%${safe}%`);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error(`Inventory list failed: ${error.message}`);
  }
  const itemIds = (data || []).map((row)=>row.inventory_item_id);
  let images = [];
  if (itemIds.length) {
    const imageResult = await supabase.from("inventory_item_images").select("*").in("inventory_item_id", itemIds).eq("status", "ACTIVE").order("display_order", {
      ascending: true
    });
    if (imageResult.error) {
      throw new Error(`Inventory image list failed: ${imageResult.error.message}`);
    }
    images = imageResult.data || [];
  }
  const imageMap = new Map();
  for (const image of images){
    const key = String(image.inventory_item_id);
    const current = imageMap.get(key) || [];
    current.push(image);
    imageMap.set(key, current);
  }
  return (data || []).map((row)=>({
      ...row,
      images: imageMap.get(String(row.inventory_item_id)) || []
    }));
}
async function getItem(clientId, inventoryItemId) {
  const { data, error } = await supabase.from("inventory_items_with_stock").select("*").eq("client_id", clientId).eq("inventory_item_id", inventoryItemId).maybeSingle();
  if (error) {
    throw new Error(`Inventory item lookup failed: ${error.message}`);
  }
  if (!data) {
    return null;
  }
  const [imagesResult, movementsResult, reservationsResult] = await Promise.all([
    supabase.from("inventory_item_images").select("*").eq("inventory_item_id", inventoryItemId).order("display_order", {
      ascending: true
    }),
    supabase.from("inventory_movements").select("*").eq("inventory_item_id", inventoryItemId).order("created_at", {
      ascending: false
    }).limit(100),
    supabase.from("inventory_reservations").select("*").eq("inventory_item_id", inventoryItemId).order("created_at", {
      ascending: false
    }).limit(100)
  ]);
  if (imagesResult.error) {
    throw new Error(`Inventory image lookup failed: ${imagesResult.error.message}`);
  }
  if (movementsResult.error) {
    throw new Error(`Inventory movement lookup failed: ${movementsResult.error.message}`);
  }
  if (reservationsResult.error) {
    throw new Error(`Inventory reservation lookup failed: ${reservationsResult.error.message}`);
  }
  return {
    ...data,
    images: imagesResult.data || [],
    movements: movementsResult.data || [],
    reservations: reservationsResult.data || []
  };
}
async function createOwner(clientId, body) {
  const ownerTypeCode = String(body?.owner_type_code || "CONSIGNOR").trim().toUpperCase();
  const ownerName = getString(body?.owner_name);
  if (!ownerName) {
    throw new Error("Owner name is required.");
  }
  const { data, error } = await supabase.from("inventory_owners").insert({
    client_id: clientId,
    owner_type_code: ownerTypeCode,
    owner_code: getString(body?.owner_code),
    owner_name: ownerName,
    contact_name: getString(body?.contact_name),
    mobile_no: getString(body?.mobile_no),
    email: getString(body?.email),
    notes: getString(body?.notes),
    status: "ACTIVE",
    is_default: false
  }).select("*").single();
  if (error) {
    throw new Error(`Inventory owner create failed: ${error.message}`);
  }
  return data;
}
async function saveItem(clientId, userId, body) {
  const inventoryItemId = getString(body?.inventory_item_id);
  const itemCode = getString(body?.item_code)?.toUpperCase();
  const itemName = getString(body?.item_name);
  if (!itemCode) {
    throw new Error("Item Code is required.");
  }
  if (!itemName) {
    throw new Error("Item Name is required.");
  }
  let inventoryOwnerId = getString(body?.inventory_owner_id);
  if (!inventoryOwnerId) {
    const defaultOwner = await ensureDefaultOwner(clientId);
    inventoryOwnerId = defaultOwner.inventory_owner_id;
  }
  const payload = {
    client_id: clientId,
    inventory_owner_id: inventoryOwnerId,
    item_code: itemCode,
    item_name: itemName,
    description: getString(body?.description),
    default_selling_price: Math.max(0, getNumber(body?.default_selling_price, 0)),
    status: String(body?.status || "ACTIVE").trim().toUpperCase(),
    source_type: String(body?.source_type || (inventoryItemId ? "MANUAL" : "MANUAL")).trim().toUpperCase(),
    created_from_post: body?.created_from_post === true
  };
  if (inventoryItemId) {
    const { data, error } = await supabase.from("inventory_items").update(payload).eq("inventory_item_id", inventoryItemId).eq("client_id", clientId).select("*").single();
    if (error) {
      throw new Error(`Inventory item update failed: ${error.message}`);
    }
    return {
      item: data,
      created: false
    };
  }
  const { data, error } = await supabase.from("inventory_items").insert(payload).select("*").single();
  if (error) {
    throw new Error(`Inventory item create failed: ${error.message}`);
  }
  const openingQuantity = Math.max(0, getNumber(body?.opening_quantity, 0));
  if (openingQuantity > 0) {
    const movementResult = await supabase.from("inventory_movements").insert({
      client_id: clientId,
      inventory_item_id: data.inventory_item_id,
      movement_type_code: "OPENING",
      quantity: openingQuantity,
      reference_type: "INVENTORY_ITEM",
      reference_id: data.inventory_item_id,
      remarks: "Opening stock from item creation.",
      created_by_user_id: userId
    });
    if (movementResult.error) {
      throw new Error(`Opening stock creation failed: ${movementResult.error.message}`);
    }
  }
  return {
    item: data,
    created: true
  };
}
async function adjustStock(clientId, userId, body) {
  const inventoryItemId = getString(body?.inventory_item_id);
  if (!inventoryItemId) {
    throw new Error("inventory_item_id is required.");
  }
  const movementTypeCode = String(body?.movement_type_code || "").trim().toUpperCase();
  const allowed = [
    "RECEIPT",
    "ADJUST_IN",
    "ADJUST_OUT",
    "RETURN"
  ];
  if (!allowed.includes(movementTypeCode)) {
    throw new Error("Invalid stock adjustment type.");
  }
  const quantity = getNumber(body?.quantity, 0);
  if (quantity <= 0) {
    throw new Error("Quantity must be greater than zero.");
  }
  const current = await getItem(clientId, inventoryItemId);
  if (!current) {
    throw new Error("Inventory item not found.");
  }
  if (movementTypeCode === "ADJUST_OUT" && Number(current.qty_available || 0) < quantity) {
    throw new Error(`Insufficient available stock. Available: ${current.qty_available}.`);
  }
  const { data, error } = await supabase.from("inventory_movements").insert({
    client_id: clientId,
    inventory_item_id: inventoryItemId,
    movement_type_code: movementTypeCode,
    quantity,
    reference_type: "MANUAL_ADJUSTMENT",
    remarks: getString(body?.remarks),
    created_by_user_id: userId
  }).select("*").single();
  if (error) {
    throw new Error(`Stock adjustment failed: ${error.message}`);
  }
  return data;
}
async function uploadImage(clientId, inventoryItemId, file, isPrimary) {
  if (![
    "image/jpeg",
    "image/png",
    "image/webp"
  ].includes(file.type)) {
    throw new Error("Only JPG, PNG and WEBP images are supported.");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Maximum image size is 10 MB.");
  }
  const item = await getItem(clientId, inventoryItemId);
  if (!item) {
    throw new Error("Inventory item not found.");
  }
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const storagePath = `${clientId}/${inventoryItemId}/${crypto.randomUUID()}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const storageResult = await supabase.storage.from(INVENTORY_BUCKET).upload(storagePath, bytes, {
    contentType: file.type,
    upsert: false
  });
  if (storageResult.error) {
    throw new Error(`Inventory image upload failed: ${storageResult.error.message}`);
  }
  if (isPrimary) {
    const resetPrimary = await supabase.from("inventory_item_images").update({
      is_primary: false
    }).eq("inventory_item_id", inventoryItemId);
    if (resetPrimary.error) {
      throw new Error(`Primary image reset failed: ${resetPrimary.error.message}`);
    }
  }
  const orderResult = await supabase.from("inventory_item_images").select("display_order").eq("inventory_item_id", inventoryItemId).order("display_order", {
    ascending: false
  }).limit(1);
  if (orderResult.error) {
    throw new Error(`Image order lookup failed: ${orderResult.error.message}`);
  }
  const nextOrder = Number(orderResult.data?.[0]?.display_order || 0) + 1;
  const { data, error } = await supabase.from("inventory_item_images").insert({
    inventory_item_id: inventoryItemId,
    client_id: clientId,
    storage_bucket: INVENTORY_BUCKET,
    storage_path: storagePath,
    original_file_name: file.name,
    mime_type: file.type,
    file_size_bytes: file.size,
    display_order: nextOrder,
    is_primary: isPrimary,
    status: "ACTIVE"
  }).select("*").single();
  if (error) {
    throw new Error(`Inventory image metadata save failed: ${error.message}`);
  }
  return data;
}
async function getSignedImageUrl(image) {
  const { data, error } = await supabase.storage.from(image.storage_bucket).createSignedUrl(image.storage_path, 60 * 60);
  if (error) {
    return null;
  }
  return data?.signedUrl || null;
}
async function hydrateImageUrls(items) {
  const result = [];
  for (const item of items){
    const images = [];
    for (const image of item.images || []){
      images.push({
        ...image,
        signed_url: await getSignedImageUrl(image)
      });
    }
    result.push({
      ...item,
      images
    });
  }
  return result;
}
function normalizeHeader(value) {
  return String(value ?? "").trim().toLowerCase().replaceAll(" ", "_").replaceAll("-", "_");
}
function parseWorkbook(bytes) {
  const workbook = XLSX.read(bytes, {
    type: "array"
  });
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) {
    throw new Error("The uploaded file does not contain a worksheet.");
  }
  const worksheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(worksheet, {
    defval: ""
  });
  return raw.map((source, index)=>{
    const row = {};
    for (const [key, value] of Object.entries(source)){
      row[normalizeHeader(key)] = value;
    }
    return {
      row_no: index + 2,
      raw_data: source,
      normalized: row
    };
  });
}
async function validateImportRows(clientId, rows) {
  const { data: existingItems, error: existingError } = await supabase.from("inventory_items").select("inventory_item_id,item_code,item_name").eq("client_id", clientId);
  if (existingError) {
    throw new Error(`Existing item lookup failed: ${existingError.message}`);
  }
  const existingMap = new Map((existingItems || []).map((row)=>[
      String(row.item_code).trim().toUpperCase(),
      row
    ]));
  const seen = new Set();
  return rows.map((row)=>{
    const data = row.normalized;
    const itemCode = getString(data.item_code)?.toUpperCase();
    const itemName = getString(data.item_name);
    const ownerCode = getString(data.owner_code);
    const ownerName = getString(data.owner_name);
    const ownerTypeCode = String(data.owner_type || data.owner_type_code || (ownerName ? "CONSIGNOR" : "OWN")).trim().toUpperCase();
    const defaultSellingPrice = Math.max(0, getNumber(data.price ?? data.default_selling_price, 0));
    const openingQuantity = Math.max(0, getNumber(data.quantity ?? data.opening_quantity, 0));
    const messages = [];
    let status = "VALID";
    if (!itemCode) {
      messages.push("Item Code is required.");
      status = "ERROR";
    }
    if (!itemName) {
      messages.push("Item Name is required.");
      status = "ERROR";
    }
    if (![
      "OWN",
      "CONSIGNOR"
    ].includes(ownerTypeCode)) {
      messages.push("Owner Type must be OWN or CONSIGNOR.");
      status = "ERROR";
    }
    if (itemCode && seen.has(itemCode)) {
      messages.push("Duplicate Item Code inside the uploaded file.");
      status = "ERROR";
    }
    if (itemCode) {
      seen.add(itemCode);
    }
    const existing = itemCode ? existingMap.get(itemCode) : null;
    if (existing && status !== "ERROR") {
      messages.push("Item Code already exists in inventory.");
      status = "WARNING";
    }
    return {
      row_no: row.row_no,
      owner_code: ownerCode,
      owner_name: ownerName,
      owner_type_code: ownerTypeCode,
      item_code: itemCode,
      item_name: itemName,
      description: getString(data.description),
      default_selling_price: defaultSellingPrice,
      opening_quantity: openingQuantity,
      validation_status: status,
      validation_messages: messages,
      raw_data: row.raw_data,
      existing_inventory_item_id: existing?.inventory_item_id || null
    };
  });
}
async function createImportPreview(clientId, userId, file, duplicateStrategy) {
  const fileName = file.name || "inventory.xlsx";
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (![
    "csv",
    "xlsx"
  ].includes(extension || "")) {
    throw new Error("Bulk inventory upload supports CSV and XLSX only.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const parsedRows = parseWorkbook(bytes);
  const validatedRows = await validateImportRows(clientId, parsedRows);
  const totalRows = validatedRows.length;
  const validRows = validatedRows.filter((row)=>row.validation_status === "VALID").length;
  const warningRows = validatedRows.filter((row)=>row.validation_status === "WARNING").length;
  const errorRows = validatedRows.filter((row)=>row.validation_status === "ERROR").length;
  const { data: batch, error: batchError } = await supabase.from("inventory_import_batches").insert({
    client_id: clientId,
    import_status_code: errorRows > 0 ? "UPLOADED" : "READY",
    original_file_name: fileName,
    file_type: extension === "csv" ? "CSV" : "XLSX",
    duplicate_strategy: duplicateStrategy,
    total_rows: totalRows,
    valid_rows: validRows,
    warning_rows: warningRows,
    error_rows: errorRows,
    imported_rows: 0,
    created_by_user_id: userId
  }).select("*").single();
  if (batchError) {
    throw new Error(`Import batch creation failed: ${batchError.message}`);
  }
  if (validatedRows.length) {
    const rowInsert = await supabase.from("inventory_import_rows").insert(validatedRows.map((row)=>({
        inventory_import_batch_id: batch.inventory_import_batch_id,
        row_no: row.row_no,
        owner_code: row.owner_code,
        owner_name: row.owner_name,
        owner_type_code: row.owner_type_code,
        item_code: row.item_code,
        item_name: row.item_name,
        description: row.description,
        default_selling_price: row.default_selling_price,
        opening_quantity: row.opening_quantity,
        validation_status: row.validation_status,
        validation_messages: row.validation_messages,
        raw_data: row.raw_data,
        resolved_inventory_item_id: row.existing_inventory_item_id
      })));
    if (rowInsert.error) {
      throw new Error(`Import row staging failed: ${rowInsert.error.message}`);
    }
  }
  return {
    batch,
    rows: validatedRows
  };
}
async function resolveOwnerForImport(clientId, row) {
  if (row.owner_type_code === "OWN") {
    return await ensureDefaultOwner(clientId);
  }
  if (row.owner_code) {
    const { data, error } = await supabase.from("inventory_owners").select("*").eq("client_id", clientId).eq("owner_code", row.owner_code).maybeSingle();
    if (error) {
      throw new Error(`Owner lookup failed: ${error.message}`);
    }
    if (data) {
      return data;
    }
  }
  if (row.owner_name) {
    const { data, error } = await supabase.from("inventory_owners").select("*").eq("client_id", clientId).eq("owner_name", row.owner_name).eq("owner_type_code", "CONSIGNOR").maybeSingle();
    if (error) {
      throw new Error(`Owner lookup failed: ${error.message}`);
    }
    if (data) {
      return data;
    }
  }
  return await createOwner(clientId, {
    owner_type_code: "CONSIGNOR",
    owner_code: row.owner_code,
    owner_name: row.owner_name || row.owner_code || "Consignor"
  });
}
async function commitImport(clientId, userId, batchId) {
  const { data: batch, error: batchError } = await supabase.from("inventory_import_batches").select("*").eq("inventory_import_batch_id", batchId).eq("client_id", clientId).single();
  if (batchError) {
    throw new Error(`Import batch lookup failed: ${batchError.message}`);
  }
  if (Number(batch.error_rows || 0) > 0) {
    throw new Error("Import cannot proceed while rows contain validation errors.");
  }
  const { data: rows, error: rowError } = await supabase.from("inventory_import_rows").select("*").eq("inventory_import_batch_id", batchId).order("row_no", {
    ascending: true
  });
  if (rowError) {
    throw new Error(`Import row lookup failed: ${rowError.message}`);
  }
  await supabase.from("inventory_import_batches").update({
    import_status_code: "IMPORTING",
    started_at: new Date().toISOString()
  }).eq("inventory_import_batch_id", batchId);
  let importedRows = 0;
  const results = [];
  for (const row of rows || []){
    if (row.validation_status === "ERROR") {
      continue;
    }
    const existingId = getString(row.resolved_inventory_item_id);
    if (existingId && batch.duplicate_strategy === "SKIP") {
      await supabase.from("inventory_import_rows").update({
        validation_status: "SKIPPED"
      }).eq("inventory_import_row_id", row.inventory_import_row_id);
      results.push({
        row_no: row.row_no,
        status: "SKIPPED",
        item_code: row.item_code
      });
      continue;
    }
    const owner = await resolveOwnerForImport(clientId, row);
    const saveResult = await saveItem(clientId, userId, {
      inventory_item_id: existingId,
      inventory_owner_id: owner.inventory_owner_id,
      item_code: row.item_code,
      item_name: row.item_name,
      description: row.description,
      default_selling_price: row.default_selling_price,
      opening_quantity: existingId ? 0 : row.opening_quantity,
      source_type: "BULK_IMPORT"
    });
    await supabase.from("inventory_import_rows").update({
      validation_status: "IMPORTED",
      resolved_inventory_owner_id: owner.inventory_owner_id,
      resolved_inventory_item_id: saveResult.item.inventory_item_id
    }).eq("inventory_import_row_id", row.inventory_import_row_id);
    importedRows += 1;
    results.push({
      row_no: row.row_no,
      status: "IMPORTED",
      item_code: row.item_code,
      inventory_item_id: saveResult.item.inventory_item_id
    });
  }
  const finalStatus = importedRows > 0 ? "COMPLETED" : "PARTIAL";
  await supabase.from("inventory_import_batches").update({
    import_status_code: finalStatus,
    imported_rows: importedRows,
    completed_at: new Date().toISOString()
  }).eq("inventory_import_batch_id", batchId);
  return {
    imported_rows: importedRows,
    results
  };
}
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders
    });
  }
  try {
    if (req.method !== "POST") {
      return json({
        success: false,
        error: "METHOD_NOT_ALLOWED"
      }, 405);
    }
    const user = await getUser(req);
    if (!user) {
      return json({
        success: false,
        error: "UNAUTHORIZED"
      }, 401);
    }
    const contentType = String(req.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const action = String(form.get("action") || "").trim().toUpperCase();
      const clientId = getString(form.get("client_id"));
      if (!clientId) {
        return json({
          success: false,
          error: "CLIENT_ID_REQUIRED"
        }, 400);
      }
      await assertMembership(user.id, clientId);
      if (action === "UPLOAD_IMAGE") {
        const inventoryItemId = getString(form.get("inventory_item_id"));
        const file = form.get("file");
        if (!inventoryItemId || !(file instanceof File)) {
          return json({
            success: false,
            error: "IMAGE_UPLOAD_FIELDS_REQUIRED"
          }, 400);
        }
        const isPrimary = String(form.get("is_primary") || "").trim().toLowerCase() === "true";
        const image = await uploadImage(clientId, inventoryItemId, file, isPrimary);
        return json({
          success: true,
          action,
          image: {
            ...image,
            signed_url: await getSignedImageUrl(image)
          }
        });
      }
      if (action === "IMPORT_PREVIEW") {
        const file = form.get("file");
        if (!(file instanceof File)) {
          return json({
            success: false,
            error: "IMPORT_FILE_REQUIRED"
          }, 400);
        }
        const duplicateStrategy = String(form.get("duplicate_strategy") || "SKIP").trim().toUpperCase();
        if (![
          "SKIP",
          "UPDATE"
        ].includes(duplicateStrategy)) {
          return json({
            success: false,
            error: "INVALID_DUPLICATE_STRATEGY"
          }, 400);
        }
        const preview = await createImportPreview(clientId, user.id, file, duplicateStrategy);
        return json({
          success: true,
          action,
          ...preview
        });
      }
      return json({
        success: false,
        error: "UNSUPPORTED_MULTIPART_ACTION"
      }, 400);
    }
    let body = {};
    try {
      body = await req.json();
    } catch  {
      body = {};
    }
    const action = String(body?.action || "").trim().toUpperCase();
    const clientId = getString(body?.client_id);
    if (!clientId) {
      return json({
        success: false,
        error: "CLIENT_ID_REQUIRED"
      }, 400);
    }
    await assertMembership(user.id, clientId);
    if (action === "LIST_SETUP") {
      return json({
        success: true,
        action,
        ...await listSetup(clientId)
      });
    }
    if (action === "LIST_ITEMS") {
      const items = await listItems(clientId, getString(body?.search), getString(body?.status));
      return json({
        success: true,
        action,
        items: await hydrateImageUrls(items)
      });
    }
    if (action === "GET_ITEM") {
      const inventoryItemId = getString(body?.inventory_item_id);
      if (!inventoryItemId) {
        return json({
          success: false,
          error: "INVENTORY_ITEM_ID_REQUIRED"
        }, 400);
      }
      const item = await getItem(clientId, inventoryItemId);
      if (!item) {
        return json({
          success: false,
          error: "INVENTORY_ITEM_NOT_FOUND"
        }, 404);
      }
      const hydrated = await hydrateImageUrls([
        item
      ]);
      return json({
        success: true,
        action,
        item: hydrated[0]
      });
    }
    if (action === "CREATE_OWNER") {
      return json({
        success: true,
        action,
        owner: await createOwner(clientId, body)
      });
    }
    if (action === "SAVE_ITEM") {
      return json({
        success: true,
        action,
        ...await saveItem(clientId, user.id, body)
      });
    }
    if (action === "ADJUST_STOCK") {
      return json({
        success: true,
        action,
        movement: await adjustStock(clientId, user.id, body)
      });
    }
    if (action === "IMPORT_COMMIT") {
      const batchId = getString(body?.inventory_import_batch_id);
      if (!batchId) {
        return json({
          success: false,
          error: "IMPORT_BATCH_ID_REQUIRED"
        }, 400);
      }
      return json({
        success: true,
        action,
        ...await commitImport(clientId, user.id, batchId)
      });
    }
    return json({
      success: false,
      error: "UNSUPPORTED_ACTION"
    }, 400);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : String(error);
    if (message === "FORBIDDEN") {
      return json({
        success: false,
        error: "FORBIDDEN"
      }, 403);
    }
    return json({
      success: false,
      error: "INVENTORY_ADMIN_FAILED",
      message
    }, 500);
  }
});
