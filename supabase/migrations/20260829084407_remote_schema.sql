SET local check_function_bodies = off;

CREATE EXTENSION "pg_cron";

CREATE EXTENSION "pg_net" SCHEMA "extensions";

CREATE TABLE "public"."auction_audit_log" (
  "audit_id"   uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "client_id"  uuid,
  "action"     text                     NOT NULL,
  "table_name" text,
  "record_id"  uuid,
  "old_data"   jsonb,
  "new_data"   jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "auction_audit_log_pkey" PRIMARY KEY (audit_id)
);

ALTER TABLE "public"."auction_audit_log"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."auction_bids" (
  "bid_id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "auction_item_id" uuid                     NOT NULL,
  "fb_comment_id"   text                     NOT NULL,
  "fb_user_id"      text,
  "fb_user_name"    text,
  "comment_text"    text,
  "bid_amt"         numeric(12,2),
  "is_valid"        boolean                  NOT NULL DEFAULT false,
  "invalid_reason"  text,
  "commented_at"    timestamp with time zone,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "reply_sent"      boolean                  NOT NULL DEFAULT false,
  "reply_text"      text,
  "reply_sent_at"   timestamp with time zone,
  CONSTRAINT "auction_bids_pkey" PRIMARY KEY (bid_id),
  CONSTRAINT "chk_auction_bids_amount" CHECK (((bid_amt IS NULL) OR (bid_amt >= (0)::numeric))),
  CONSTRAINT "uq_auction_bids_fb_comment_id" UNIQUE (fb_comment_id),
  CONSTRAINT "uq_auction_bids_fb_comment" UNIQUE (fb_comment_id)
);

ALTER TABLE "public"."auction_bids"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."auction_items" (
  "auction_item_id"                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "auction_post_id"                  uuid                     NOT NULL,
  "item_label"                       text                     NOT NULL,
  "status"                           text                     NOT NULL DEFAULT 'ACTIVE'::text,
  "bid_winner_id"                    uuid,
  "created_at"                       timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                       timestamp with time zone NOT NULL DEFAULT now(),
  "min_bidder_reached_at"            timestamp with time zone,
  "last_status_comment_at"           timestamp with time zone,
  "one_hour_warning_sent_at"         timestamp with time zone,
  "five_min_warning_sent_at"         timestamp with time zone,
  "buyout_window_ended_announced_at" timestamp with time zone,
  "fb_object_id"                     text,
  "item_no"                          integer,
  "inventory_item_id"                uuid,
  "inventory_owner_id"               uuid,
  "item_code_snapshot"               text,
  "item_name_snapshot"               text,
  "item_price_snapshot"              numeric(18,2),
  "quantity_committed"               numeric(18,4)            NOT NULL DEFAULT 1,
  "item_source"                      text                     NOT NULL DEFAULT 'MANUAL'::text,
  CONSTRAINT "auction_items_item_source_chk" CHECK ((item_source = ANY (ARRAY['MANUAL'::text, 'INVENTORY'::text]))),
  CONSTRAINT "auction_items_pkey" PRIMARY KEY (auction_item_id),
  CONSTRAINT "auction_items_price_snapshot_chk" CHECK (((item_price_snapshot IS NULL) OR (item_price_snapshot >= (0)::numeric))),
  CONSTRAINT "auction_items_quantity_committed_chk" CHECK ((quantity_committed > (0)::numeric)),
  CONSTRAINT "chk_auction_items_status" CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'CLOSED'::text, 'CANCELLED'::text])))
);

ALTER TABLE "public"."auction_items"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."auction_posts" (
  "post_id"     uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "client_id"   uuid                     NOT NULL,
  "fb_page_id"  text                     NOT NULL,
  "fb_post_id"  text                     NOT NULL,
  "post_type"   text                     NOT NULL,
  "caption"     text,
  "status"      text                     NOT NULL DEFAULT 'DRAFT'::text,
  "starts_at"   timestamp with time zone,
  "ends_at"     timestamp with time zone,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "environment" text,
  CONSTRAINT "auction_posts_pkey" PRIMARY KEY (post_id),
  CONSTRAINT "chk_auction_posts_dates" CHECK (((ends_at IS NULL) OR (starts_at IS NULL) OR (ends_at > starts_at))),
  CONSTRAINT "chk_auction_posts_status" CHECK ((status = ANY (ARRAY['DRAFT'::text, 'ACTIVE'::text, 'CLOSED'::text, 'CANCELLED'::text]))),
  CONSTRAINT "chk_auction_posts_type" CHECK ((post_type = ANY (ARRAY['SINGLE'::text, 'MULTIPLE'::text]))),
  CONSTRAINT "uq_auction_posts_fb_post_id" UNIQUE (fb_post_id)
);

ALTER TABLE "public"."auction_posts"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."auction_rules" (
  "rule_id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "auction_item_id"     uuid                     NOT NULL,
  "rule_name"           text                     NOT NULL,
  "min_bid"             numeric(12,2),
  "bid_increment"       numeric(12,2),
  "bid_buyout_amt"      numeric(12,2),
  "buyout_dt_limit"     timestamp with time zone,
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "min_bidder_count"    integer                  NOT NULL DEFAULT 1,
  "bid_cutoff_minutes"  integer                  NOT NULL DEFAULT 0,
  "auction_end_dt"      timestamp with time zone,
  "anti_sniper_minutes" integer                  NOT NULL DEFAULT 0,
  CONSTRAINT "auction_rules_pkey" PRIMARY KEY (rule_id),
  CONSTRAINT "chk_auction_rules_bid_cutoff_minutes" CHECK ((bid_cutoff_minutes >= 0)),
  CONSTRAINT "chk_auction_rules_bid_increment" CHECK (((bid_increment IS NULL) OR (bid_increment > (0)::numeric))),
  CONSTRAINT "chk_auction_rules_buyout" CHECK (((bid_buyout_amt IS NULL) OR (bid_buyout_amt >= (0)::numeric))),
  CONSTRAINT "chk_auction_rules_min_bidder_count" CHECK ((min_bidder_count >= 1)),
  CONSTRAINT "chk_auction_rules_min_bid" CHECK (((min_bid IS NULL) OR (min_bid >= (0)::numeric)))
);

ALTER TABLE "public"."auction_rules"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."auction_winners" (
  "bid_winner_id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "auction_item_id"            uuid                     NOT NULL,
  "bid_id"                     uuid                     NOT NULL,
  "winning_amt"                numeric(12,2)            NOT NULL,
  "status"                     text                     NOT NULL DEFAULT 'PENDING'::text,
  "won_at"                     timestamp with time zone,
  "created_at"                 timestamp with time zone NOT NULL DEFAULT now(),
  "payment_deadline_at"        timestamp with time zone,
  "payment_expired_at"         timestamp with time zone,
  "forfeiture_reason"          text,
  "payment_reopened_at"        timestamp with time zone,
  "payment_reopen_deadline_at" timestamp with time zone,
  CONSTRAINT "auction_winners_pkey" PRIMARY KEY (bid_winner_id),
  CONSTRAINT "chk_auction_winners_amount" CHECK ((winning_amt >= (0)::numeric)),
  CONSTRAINT "chk_auction_winners_status" CHECK ((status = ANY (ARRAY['PENDING'::text, 'CONFIRMED'::text, 'CANCELLED'::text]))),
  CONSTRAINT "uq_auction_winners_bid" UNIQUE (bid_id)
);

ALTER TABLE "public"."auction_winners"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."buyer_checkout_sessions" (
  "checkout_session_id" uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "client_id"           uuid                     NOT NULL,
  "order_group_id"      uuid,
  "bid_winner_id"       uuid,
  "checkout_token"      uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "status"              text                     NOT NULL DEFAULT 'ACTIVE'::text,
  "expires_at"          timestamp with time zone,
  "used_at"             timestamp with time zone,
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"          timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "buyer_checkout_sessions_pkey" PRIMARY KEY (checkout_session_id),
  CONSTRAINT "buyer_checkout_sessions_target_chk" CHECK ((((order_group_id IS NOT NULL) AND (bid_winner_id IS NULL)) OR ((order_group_id IS NULL) AND (bid_winner_id IS
    NOT NULL)))),
  CONSTRAINT "buyer_checkout_sessions_token_uk" UNIQUE (checkout_token)
);

ALTER TABLE "public"."buyer_checkout_sessions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."client_payment_accounts" (
  "client_payment_account_id" uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "client_id"                 uuid                     NOT NULL,
  "provider"                  text                     NOT NULL DEFAULT 'PAYMONGO'::text,
  "account_status"            text                     NOT NULL DEFAULT 'NOT_CONFIGURED'::text,
  "paymongo_account_id"       text,
  "payment_enabled"           boolean                  NOT NULL DEFAULT false,
  "created_at"                timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "client_payment_accounts_client_id_provider_key" UNIQUE (client_id, PROVIDER),
  CONSTRAINT "client_payment_accounts_enabled_chk" CHECK (((payment_enabled = false) OR (account_status = 'ACTIVE'::text))),
  CONSTRAINT "client_payment_accounts_pkey" PRIMARY KEY (client_payment_account_id),
  CONSTRAINT "client_payment_accounts_provider_chk" CHECK ((provider = 'PAYMONGO'::text)),
  CONSTRAINT "client_payment_accounts_status_chk"
    CHECK
    ((account_status = ANY (ARRAY['NOT_CONFIGURED'::text, 'ACCOUNT_CREATED'::text, 'LINK_PENDING'::text, 'ONBOARDING'::text, 'ACTIVE'::text, 'RESTRICTED'::text,
    'DISABLED'::text])))
);

ALTER TABLE "public"."client_payment_accounts"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."client_pickup_locations" (
  "pickup_location_id" uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "client_id"          uuid                     NOT NULL,
  "location_name"      text                     NOT NULL,
  "contact_name"       text                     NOT NULL,
  "contact_phone"      text                     NOT NULL,
  "address_line1"      text                     NOT NULL,
  "address_line2"      text,
  "city"               text                     NOT NULL,
  "province"           text                     NOT NULL,
  "postal_code"        text,
  "country"            text                     NOT NULL DEFAULT 'PH'::text,
  "latitude"           numeric(10,7)            NOT NULL,
  "longitude"          numeric(10,7)            NOT NULL,
  "is_default"         boolean                  NOT NULL DEFAULT false,
  "status"             text                     NOT NULL DEFAULT 'ACTIVE'::text,
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"         timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "client_pickup_locations_pkey" PRIMARY KEY (pickup_location_id),
  CONSTRAINT "client_pickup_locations_status_chk" CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])))
);

ALTER TABLE "public"."client_pickup_locations"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."client_subscriptions" (
  "subscription_id"     uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "client_id"           uuid                     NOT NULL,
  "plan_code"           text                     NOT NULL DEFAULT 'CLNT_TRIAL'::text,
  "subscription_status" text                     NOT NULL DEFAULT 'TRIAL'::text,
  "payment_mode"        text                     NOT NULL DEFAULT 'MANUAL'::text,
  "allowed_environment" text                     NOT NULL DEFAULT 'CLNT'::text,
  "starts_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "ends_at"             timestamp with time zone,
  "last_payment_at"     timestamp with time zone,
  "notes"               text,
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"          timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "client_subscriptions_payment_mode_check" CHECK ((upper(payment_mode) = ANY (ARRAY['MANUAL'::text, 'PAYMONGO'::text]))),
  CONSTRAINT "client_subscriptions_pkey" PRIMARY KEY (subscription_id),
  CONSTRAINT "client_subscriptions_subscription_status_check"
    CHECK ((upper(subscription_status) = ANY (ARRAY['TRIAL'::text, 'ACTIVE'::text, 'PAST_DUE'::text, 'SUSPENDED'::text, 'CANCELLED'::text, 'EXPIRED'::text])))
);

ALTER TABLE "public"."client_subscriptions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."client_users" (
  "client_user_id" uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"        uuid                     NOT NULL,
  "client_id"      uuid                     NOT NULL,
  "role"           text                     NOT NULL DEFAULT 'STAFF'::text,
  "status"         text                     NOT NULL DEFAULT 'ACTIVE'::text,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "client_users_pkey" PRIMARY KEY (client_user_id),
  CONSTRAINT "client_users_role_chk" CHECK ((role = ANY (ARRAY['OWNER'::text, 'ADMIN'::text, 'STAFF'::text, 'VIEWER'::text]))),
  CONSTRAINT "client_users_status_chk" CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text]))),
  CONSTRAINT "client_users_user_client_uk" UNIQUE (user_id, client_id)
);

ALTER TABLE "public"."client_users"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."couriers" (
  "courier_code" text                     NOT NULL,
  "courier_name" text                     NOT NULL,
  "status"       text                     NOT NULL DEFAULT 'ACTIVE'::text,
  "supports_api" boolean                  NOT NULL DEFAULT false,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "couriers_pkey" PRIMARY KEY (courier_code)
);

ALTER TABLE "public"."couriers"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."deliveries" (
  "delivery_id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "order_id"              uuid,
  "client_id"             uuid                     NOT NULL,
  "courier_code"          text,
  "courier_name"          text,
  "tracking_number"       text,
  "delivery_status"       text                     NOT NULL DEFAULT 'PENDING'::text,
  "shipping_fee"          numeric(12,2)            NOT NULL DEFAULT 0,
  "recipient_name"        text,
  "recipient_phone"       text,
  "address_line1"         text,
  "address_line2"         text,
  "city"                  text,
  "province"              text,
  "postal_code"           text,
  "country"               text                     NOT NULL DEFAULT 'PH'::text,
  "booking_reference"     text,
  "booked_at"             timestamp with time zone,
  "picked_up_at"          timestamp with time zone,
  "shipped_at"            timestamp with time zone,
  "delivered_at"          timestamp with time zone,
  "failed_at"             timestamp with time zone,
  "cancelled_at"          timestamp with time zone,
  "created_at"            timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"            timestamp with time zone NOT NULL DEFAULT now(),
  "order_group_id"        uuid,
  "courier_status"        text,
  "tracking_url"          text,
  "courier_payload"       jsonb,
  "courier_response"      jsonb,
  "last_tracking_sync_at" timestamp with time zone,
  "booking_error"         text,
  "courier_quotation_id"  text,
  "courier_service_type"  text,
  "quoted_shipping_fee"   numeric(12,2),
  "quote_expires_at"      timestamp with time zone,
  "pickup_lat"            numeric,
  "pickup_lng"            numeric,
  "recipient_lat"         numeric,
  "recipient_lng"         numeric,
  "pickup_location_id"    uuid,
  "fulfillment_method"    text                     DEFAULT 'PICKUP_BY_COURIER'::text,
  "dropoff_location_name" text,
  "dropoff_address"       text,
  "dropoff_lat"           numeric,
  "dropoff_lng"           numeric,
  "dropped_off_at"        timestamp with time zone,
  CONSTRAINT "deliveries_fulfillment_method_check" CHECK ((fulfillment_method = ANY (ARRAY['PICKUP_BY_COURIER'::text, 'CLIENT_DROP_OFF'::text]))),
  CONSTRAINT "deliveries_owner_check" CHECK (((
CASE
    WHEN (order_id IS NOT NULL) THEN 1
    ELSE 0
END +
CASE
    WHEN (order_group_id IS NOT NULL) THEN 1
    ELSE 0
END) = 1)),
  CONSTRAINT "deliveries_pkey" PRIMARY KEY (delivery_id),
  CONSTRAINT "deliveries_status_check"
    CHECK
    ((delivery_status = ANY (ARRAY['PENDING'::text, 'READY_FOR_BOOKING'::text, 'BOOKED'::text, 'PICKED_UP'::text, 'DROPPED_OFF'::text, 'IN_TRANSIT'::text, 'DELIVERED'::text,
    'FAILED'::text, 'CANCELLED'::text])))
);

ALTER TABLE "public"."deliveries"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."eo2mate_automation_controls" (
  "control_id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "client_id"             uuid                     NOT NULL,
  "scope_type"            text                     NOT NULL,
  "scope_id"              text                     NOT NULL,
  "is_enabled"            boolean                  NOT NULL DEFAULT true,
  "reason"                text,
  "changed_by_user_id"    uuid,
  "changed_by_fb_page_id" text,
  "changed_at"            timestamp with time zone NOT NULL DEFAULT now(),
  "created_at"            timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"            timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "eo2mate_automation_controls_pkey" PRIMARY KEY (control_id),
  CONSTRAINT "eo2mate_automation_controls_scope_type_check" CHECK ((scope_type = ANY (ARRAY['CLIENT'::text, 'PAGE'::text, 'POST'::text])))
);

ALTER TABLE "public"."eo2mate_automation_controls"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."eo2mate_command_aliases" (
  "command_alias_id" uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "client_id"        uuid,
  "command_text"     text                     NOT NULL,
  "action_code"      text                     NOT NULL,
  "description"      text,
  "is_active"        boolean                  NOT NULL DEFAULT true,
  "created_at"       timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"       timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "eo2mate_command_aliases_pkey" PRIMARY KEY (command_alias_id)
);

ALTER TABLE "public"."eo2mate_command_aliases"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."eo2mate_environments" (
  "environment_code" text                     NOT NULL,
  "environment_name" text                     NOT NULL,
  "environment_rank" integer                  NOT NULL,
  "description"      text,
  "is_active"        boolean                  NOT NULL DEFAULT true,
  "created_at"       timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"       timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "eo2mate_environments_code_upper_chk" CHECK ((environment_code = upper(environment_code))),
  CONSTRAINT "eo2mate_environments_pkey" PRIMARY KEY (environment_code),
  CONSTRAINT "eo2mate_environments_rank_chk" CHECK ((environment_rank > 0))
);

ALTER TABLE "public"."eo2mate_environments"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."eo2mate_post_command_aliases" (
  "post_command_id" uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "client_id"       uuid,
  "command_text"    text                     NOT NULL,
  "action_code"     text                     NOT NULL,
  "description"     text,
  "is_active"       boolean                  NOT NULL DEFAULT true,
  "sender_scope"    text                     NOT NULL DEFAULT 'PAGE_ONLY'::text,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "eo2mate_post_command_aliases_pkey" PRIMARY KEY (post_command_id),
  CONSTRAINT "eo2mate_post_command_aliases_sender_scope_check" CHECK ((sender_scope = 'PAGE_ONLY'::text))
);

ALTER TABLE "public"."eo2mate_post_command_aliases"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."eo2mate_post_mode_types" (
  "mode_code"      text                     NOT NULL,
  "post_type_code" text                     NOT NULL,
  "display_name"   text                     NOT NULL,
  "caption_marker" text                     NOT NULL,
  "description"    text,
  "is_active"      boolean                  NOT NULL DEFAULT true,
  "sort_order"     integer                  NOT NULL DEFAULT 100,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "eo2mate_post_mode_types_caption_marker_key" UNIQUE (caption_marker),
  CONSTRAINT "eo2mate_post_mode_types_pkey" PRIMARY KEY (mode_code, post_type_code),
  CONSTRAINT "eo2mate_post_mode_types_sort_order_chk" CHECK ((sort_order >= 0))
);

ALTER TABLE "public"."eo2mate_post_mode_types"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."eo2mate_post_modes" (
  "mode_code"   text                     NOT NULL,
  "mode_name"   text                     NOT NULL,
  "description" text,
  "sort_order"  integer                  NOT NULL DEFAULT 100,
  "is_active"   boolean                  NOT NULL DEFAULT true,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "eo2mate_post_modes_code_upper_chk" CHECK ((mode_code = upper(mode_code))),
  CONSTRAINT "eo2mate_post_modes_pkey" PRIMARY KEY (mode_code),
  CONSTRAINT "eo2mate_post_modes_sort_order_chk" CHECK ((sort_order >= 0))
);

ALTER TABLE "public"."eo2mate_post_modes"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."eo2mate_post_types" (
  "post_type_code" text                     NOT NULL,
  "post_type_name" text                     NOT NULL,
  "is_multiple"    boolean                  NOT NULL DEFAULT false,
  "min_images"     integer                  NOT NULL DEFAULT 1,
  "sort_order"     integer                  NOT NULL DEFAULT 100,
  "is_active"      boolean                  NOT NULL DEFAULT true,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "eo2mate_post_types_code_upper_chk" CHECK ((post_type_code = upper(post_type_code))),
  CONSTRAINT "eo2mate_post_types_min_images_chk" CHECK ((min_images >= 1)),
  CONSTRAINT "eo2mate_post_types_pkey" PRIMARY KEY (post_type_code),
  CONSTRAINT "eo2mate_post_types_sort_order_chk" CHECK ((sort_order >= 0))
);

ALTER TABLE "public"."eo2mate_post_types"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."eo2mate_settings" (
  "setting_id"    uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "client_id"     uuid,
  "setting_key"   text                     NOT NULL,
  "setting_value" text                     NOT NULL,
  "value_type"    text                     NOT NULL DEFAULT 'TEXT'::text,
  "description"   text,
  "is_active"     boolean                  NOT NULL DEFAULT true,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "eo2mate_settings_pkey" PRIMARY KEY (setting_id)
);

ALTER TABLE "public"."eo2mate_settings"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."facebook_oauth_states" (
  "state_id"    uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "client_id"   uuid                     NOT NULL,
  "state_token" text                     NOT NULL,
  "expires_at"  timestamp with time zone NOT NULL,
  "used_at"     timestamp with time zone,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "facebook_oauth_states_pkey" PRIMARY KEY (state_id),
  CONSTRAINT "facebook_oauth_states_state_token_key" UNIQUE (state_token)
);

ALTER TABLE "public"."facebook_oauth_states"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."fb_pages" (
  "page_id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "client_id"         uuid                     NOT NULL,
  "fb_page_id"        text                     NOT NULL,
  "page_nm"           text                     NOT NULL,
  "status"            text                     NOT NULL DEFAULT 'ACTIVE'::text,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "access_token"      text,
  "token_expires_at"  timestamp with time zone,
  "connection_status" text                     DEFAULT 'ACTIVE'::text,
  "last_token_error"  text,
  "connected_at"      timestamp with time zone,
  CONSTRAINT "chk_fb_pages_status" CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text]))),
  CONSTRAINT "fb_pages_pkey" PRIMARY KEY (page_id),
  CONSTRAINT "uq_fb_pages_fb_page_id" UNIQUE (fb_page_id)
);

ALTER TABLE "public"."fb_pages"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."inventory_import_batches" (
  "inventory_import_batch_id" uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "client_id"                 uuid                     NOT NULL,
  "import_status_code"        text                     NOT NULL DEFAULT 'UPLOADED'::text,
  "original_file_name"        text                     NOT NULL,
  "file_type"                 text                     NOT NULL,
  "duplicate_strategy"        text                     NOT NULL DEFAULT 'SKIP'::text,
  "total_rows"                integer                  NOT NULL DEFAULT 0,
  "valid_rows"                integer                  NOT NULL DEFAULT 0,
  "warning_rows"              integer                  NOT NULL DEFAULT 0,
  "error_rows"                integer                  NOT NULL DEFAULT 0,
  "imported_rows"             integer                  NOT NULL DEFAULT 0,
  "created_by_user_id"        uuid,
  "started_at"                timestamp with time zone,
  "completed_at"              timestamp with time zone,
  "created_at"                timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "inventory_import_batches_counts_chk" CHECK (((total_rows >= 0) AND (valid_rows >= 0) AND (warning_rows >= 0) AND (error_rows >= 0) AND (imported_rows >= 0))),
  CONSTRAINT "inventory_import_batches_duplicate_strategy_chk" CHECK ((duplicate_strategy = ANY (ARRAY['SKIP'::text, 'UPDATE'::text]))),
  CONSTRAINT "inventory_import_batches_file_type_chk" CHECK ((file_type = ANY (ARRAY['CSV'::text, 'XLSX'::text]))),
  CONSTRAINT "inventory_import_batches_pkey" PRIMARY KEY (inventory_import_batch_id)
);

ALTER TABLE "public"."inventory_import_batches"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."inventory_import_rows" (
  "inventory_import_row_id"     uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "inventory_import_batch_id"   uuid                     NOT NULL,
  "row_no"                      integer                  NOT NULL,
  "owner_code"                  text,
  "owner_name"                  text,
  "owner_type_code"             text,
  "item_code"                   text,
  "item_name"                   text,
  "description"                 text,
  "default_selling_price"       numeric(18,2),
  "opening_quantity"            numeric(18,4),
  "validation_status"           text                     NOT NULL DEFAULT 'PENDING'::text,
  "validation_messages"         jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "raw_data"                    jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "resolved_inventory_owner_id" uuid,
  "resolved_inventory_item_id"  uuid,
  "created_at"                  timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "inventory_import_rows_batch_row_unique" UNIQUE (inventory_import_batch_id, row_no),
  CONSTRAINT "inventory_import_rows_pkey" PRIMARY KEY (inventory_import_row_id),
  CONSTRAINT "inventory_import_rows_price_chk" CHECK (((default_selling_price IS NULL) OR (default_selling_price >= (0)::numeric))),
  CONSTRAINT "inventory_import_rows_quantity_chk" CHECK (((opening_quantity IS NULL) OR (opening_quantity >= (0)::numeric))),
  CONSTRAINT "inventory_import_rows_row_no_chk" CHECK ((row_no >= 1)),
  CONSTRAINT "inventory_import_rows_validation_status_chk"
    CHECK ((validation_status = ANY (ARRAY['PENDING'::text, 'VALID'::text, 'WARNING'::text, 'ERROR'::text, 'IMPORTED'::text, 'SKIPPED'::text])))
);

ALTER TABLE "public"."inventory_import_rows"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."inventory_import_statuses" (
  "import_status_code" text    NOT NULL,
  "import_status_name" text    NOT NULL,
  "sort_order"         integer NOT NULL DEFAULT 100,
  "is_active"          boolean NOT NULL DEFAULT true,
  CONSTRAINT "inventory_import_statuses_code_upper_chk" CHECK ((import_status_code = upper(import_status_code))),
  CONSTRAINT "inventory_import_statuses_pkey" PRIMARY KEY (import_status_code)
);

ALTER TABLE "public"."inventory_import_statuses"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."inventory_item_images" (
  "inventory_image_id" uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "inventory_item_id"  uuid                     NOT NULL,
  "client_id"          uuid                     NOT NULL,
  "storage_bucket"     text                     NOT NULL DEFAULT 'inventory-images'::text,
  "storage_path"       text                     NOT NULL,
  "original_file_name" text,
  "mime_type"          text,
  "file_size_bytes"    bigint,
  "display_order"      integer                  NOT NULL DEFAULT 1,
  "is_primary"         boolean                  NOT NULL DEFAULT false,
  "status"             text                     NOT NULL DEFAULT 'ACTIVE'::text,
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"         timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "inventory_item_images_file_size_chk" CHECK (((file_size_bytes IS NULL) OR (file_size_bytes >= 0))),
  CONSTRAINT "inventory_item_images_order_chk" CHECK ((display_order >= 1)),
  CONSTRAINT "inventory_item_images_path_unique" UNIQUE (storage_bucket, storage_path),
  CONSTRAINT "inventory_item_images_pkey" PRIMARY KEY (inventory_image_id),
  CONSTRAINT "inventory_item_images_status_chk" CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])))
);

ALTER TABLE "public"."inventory_item_images"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."inventory_items" (
  "inventory_item_id"     uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "client_id"             uuid                     NOT NULL,
  "inventory_owner_id"    uuid                     NOT NULL,
  "item_code"             text                     NOT NULL,
  "item_name"             text                     NOT NULL,
  "description"           text,
  "default_selling_price" numeric(18,2)            NOT NULL DEFAULT 0,
  "status"                text                     NOT NULL DEFAULT 'ACTIVE'::text,
  "source_type"           text                     NOT NULL DEFAULT 'MANUAL'::text,
  "created_from_post"     boolean                  NOT NULL DEFAULT false,
  "created_at"            timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"            timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "inventory_items_code_unique" UNIQUE (client_id, item_code),
  CONSTRAINT "inventory_items_pkey" PRIMARY KEY (inventory_item_id),
  CONSTRAINT "inventory_items_price_chk" CHECK ((default_selling_price >= (0)::numeric)),
  CONSTRAINT "inventory_items_source_type_chk" CHECK ((source_type = ANY (ARRAY['MANUAL'::text, 'BULK_IMPORT'::text, 'AUTO_POST'::text, 'SYSTEM'::text]))),
  CONSTRAINT "inventory_items_status_chk" CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text, 'ARCHIVED'::text])))
);

ALTER TABLE "public"."inventory_items"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."inventory_movement_types" (
  "movement_type_code" text                     NOT NULL,
  "movement_type_name" text                     NOT NULL,
  "quantity_effect"    integer                  NOT NULL,
  "description"        text,
  "sort_order"         integer                  NOT NULL DEFAULT 100,
  "is_active"          boolean                  NOT NULL DEFAULT true,
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"         timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "inventory_movement_types_code_upper_chk" CHECK ((movement_type_code = upper(movement_type_code))),
  CONSTRAINT "inventory_movement_types_effect_chk" CHECK ((quantity_effect = ANY (ARRAY['-1'::integer, 0, 1]))),
  CONSTRAINT "inventory_movement_types_pkey" PRIMARY KEY (movement_type_code)
);

ALTER TABLE "public"."inventory_movement_types"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."inventory_movements" (
  "inventory_movement_id" uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "client_id"             uuid                     NOT NULL,
  "inventory_item_id"     uuid                     NOT NULL,
  "movement_type_code"    text                     NOT NULL,
  "quantity"              numeric(18,4)            NOT NULL,
  "unit_cost"             numeric(18,2),
  "reference_type"        text,
  "reference_id"          uuid,
  "reference_text"        text,
  "remarks"               text,
  "created_by_user_id"    uuid,
  "created_at"            timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "inventory_movements_pkey" PRIMARY KEY (inventory_movement_id),
  CONSTRAINT "inventory_movements_quantity_chk" CHECK ((quantity > (0)::numeric)),
  CONSTRAINT "inventory_movements_unit_cost_chk" CHECK (((unit_cost IS NULL) OR (unit_cost >= (0)::numeric)))
);

ALTER TABLE "public"."inventory_movements"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."inventory_owner_types" (
  "owner_type_code" text                     NOT NULL,
  "owner_type_name" text                     NOT NULL,
  "description"     text,
  "sort_order"      integer                  NOT NULL DEFAULT 100,
  "is_active"       boolean                  NOT NULL DEFAULT true,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "inventory_owner_types_code_upper_chk" CHECK ((owner_type_code = upper(owner_type_code))),
  CONSTRAINT "inventory_owner_types_pkey" PRIMARY KEY (owner_type_code),
  CONSTRAINT "inventory_owner_types_sort_order_chk" CHECK ((sort_order >= 0))
);

ALTER TABLE "public"."inventory_owner_types"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."inventory_owners" (
  "inventory_owner_id" uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "client_id"          uuid                     NOT NULL,
  "owner_type_code"    text                     NOT NULL,
  "owner_code"         text,
  "owner_name"         text                     NOT NULL,
  "contact_name"       text,
  "mobile_no"          text,
  "email"              text,
  "notes"              text,
  "status"             text                     NOT NULL DEFAULT 'ACTIVE'::text,
  "is_default"         boolean                  NOT NULL DEFAULT false,
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"         timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "inventory_owners_owner_code_unique" UNIQUE (client_id, owner_code),
  CONSTRAINT "inventory_owners_pkey" PRIMARY KEY (inventory_owner_id),
  CONSTRAINT "inventory_owners_status_chk" CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])))
);

ALTER TABLE "public"."inventory_owners"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."inventory_reservation_statuses" (
  "reservation_status_code" text                     NOT NULL,
  "reservation_status_name" text                     NOT NULL,
  "description"             text,
  "sort_order"              integer                  NOT NULL DEFAULT 100,
  "is_active"               boolean                  NOT NULL DEFAULT true,
  "created_at"              timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"              timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "inventory_reservation_statuses_code_upper_chk" CHECK ((reservation_status_code = upper(reservation_status_code))),
  CONSTRAINT "inventory_reservation_statuses_pkey" PRIMARY KEY (reservation_status_code)
);

ALTER TABLE "public"."inventory_reservation_statuses"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."inventory_reservations" (
  "inventory_reservation_id" uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "client_id"                uuid                     NOT NULL,
  "inventory_item_id"        uuid                     NOT NULL,
  "quantity"                 numeric(18,4)            NOT NULL,
  "reservation_status_code"  text                     NOT NULL DEFAULT 'ACTIVE'::text,
  "source_mode_code"         text,
  "source_post_type_code"    text,
  "auction_post_id"          uuid,
  "auction_item_id"          uuid,
  "source_reference_type"    text,
  "source_reference_id"      uuid,
  "reserved_at"              timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at"               timestamp with time zone,
  "released_at"              timestamp with time zone,
  "consumed_at"              timestamp with time zone,
  "remarks"                  text,
  "created_at"               timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"               timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY (inventory_reservation_id),
  CONSTRAINT "inventory_reservations_quantity_chk" CHECK ((quantity > (0)::numeric))
);

ALTER TABLE "public"."inventory_reservations"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."master_clients" (
  "client_id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"                text                     NOT NULL,
  "status"              text                     NOT NULL DEFAULT 'ACTIVE'::text,
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "onboarding_status"   text                     NOT NULL DEFAULT 'PENDING'::text,
  "onboarding_step"     text,
  "default_environment" text                     NOT NULL DEFAULT 'CLNT'::text,
  "contact_email"       text,
  "contact_phone"       text,
  "timezone"            text                     NOT NULL DEFAULT 'Asia/Manila'::text,
  "trial_started_at"    timestamp with time zone,
  "trial_ends_at"       timestamp with time zone,
  "updated_at"          timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "chk_master_clients_status" CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text]))),
  CONSTRAINT "master_clients_pkey" PRIMARY KEY (client_id)
);

ALTER TABLE "public"."master_clients"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."messenger_payment_claims" (
  "claim_id"       uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "claim_token"    text                     NOT NULL,
  "bid_winner_id"  uuid,
  "fb_page_id"     text                     NOT NULL,
  "claimed_psid"   text,
  "claimed_at"     timestamp with time zone,
  "expires_at"     timestamp with time zone NOT NULL,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "order_group_id" uuid,
  CONSTRAINT "messenger_payment_claims_claim_token_key" UNIQUE (claim_token),
  CONSTRAINT "messenger_payment_claims_pkey" PRIMARY KEY (claim_id),
  CONSTRAINT "messenger_payment_claims_target_check" CHECK (((bid_winner_id IS NOT NULL) OR (order_group_id IS NOT NULL)))
);

ALTER TABLE "public"."messenger_payment_claims"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."order_groups" (
  "order_group_id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "client_id"                  uuid                     NOT NULL,
  "buyer_fb_user_id"           text,
  "buyer_name"                 text,
  "group_status"               text                     NOT NULL DEFAULT 'OPEN'::text,
  "subtotal"                   numeric(12,2)            NOT NULL DEFAULT 0,
  "shipping_fee"               numeric(12,2)            NOT NULL DEFAULT 0,
  "total_amount"               numeric(12,2)            NOT NULL DEFAULT 0,
  "preferred_courier_code"     text,
  "shipping_name"              text,
  "shipping_phone"             text,
  "shipping_address_line1"     text,
  "shipping_address_line2"     text,
  "shipping_city"              text,
  "shipping_province"          text,
  "shipping_postal_code"       text,
  "shipping_country"           text                     NOT NULL DEFAULT 'PH'::text,
  "created_at"                 timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                 timestamp with time zone NOT NULL DEFAULT now(),
  "buyer_checkout_choice"      text,
  "buyer_choice_at"            timestamp with time zone,
  "locked_at"                  timestamp with time zone,
  "environment"                text,
  "fb_page_id"                 text,
  "payment_deadline_at"        timestamp with time zone,
  "payment_expired_at"         timestamp with time zone,
  "payment_expiry_notified_at" timestamp with time zone,
  "payment_reopened_at"        timestamp with time zone,
  "payment_reopen_deadline_at" timestamp with time zone,
  "payment_reopen_count"       integer                  NOT NULL DEFAULT 0,
  "payment_reopen_reason"      text,
  "payment_reopened_by"        uuid,
  CONSTRAINT "order_groups_checkout_choice_check" CHECK (((buyer_checkout_choice IS NULL) OR (buyer_checkout_choice = ANY (ARRAY['PAY_NOW'::text, 'KEEP_OPEN'::text])))),
  CONSTRAINT "order_groups_pkey" PRIMARY KEY (order_group_id),
  CONSTRAINT "order_groups_status_check"
    CHECK
    ((group_status = ANY (ARRAY['OPEN'::text, 'AWAITING_SHIPPING_DETAILS'::text, 'READY_FOR_PAYMENT'::text, 'PAYMENT_PENDING'::text, 'PAID'::text, 'READY_FOR_DELIVERY'::text,
    'COMPLETED'::text, 'CANCELLED'::text])))
);

ALTER TABLE "public"."order_groups"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."orders" (
  "order_id"                   uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "client_id"                  uuid                     NOT NULL,
  "bid_winner_id"              uuid                     NOT NULL,
  "auction_item_id"            uuid                     NOT NULL,
  "source_type"                text                     NOT NULL DEFAULT 'AUCTION'::text,
  "order_status"               text                     NOT NULL DEFAULT 'PAYMENT_PENDING'::text,
  "payment_status"             text                     NOT NULL DEFAULT 'PENDING'::text,
  "subtotal"                   numeric(12,2)            NOT NULL,
  "shipping_fee"               numeric(12,2)            NOT NULL DEFAULT 0,
  "total_amount"               numeric(12,2)            NOT NULL,
  "currency"                   text                     NOT NULL DEFAULT 'PHP'::text,
  "buyer_fb_user_id"           text,
  "buyer_name"                 text,
  "buyer_phone"                text,
  "buyer_email"                text,
  "shipping_name"              text,
  "shipping_phone"             text,
  "shipping_address_line1"     text,
  "shipping_address_line2"     text,
  "shipping_city"              text,
  "shipping_province"          text,
  "shipping_postal_code"       text,
  "shipping_country"           text                     NOT NULL DEFAULT 'PH'::text,
  "notes"                      text,
  "paid_at"                    timestamp with time zone,
  "ready_for_delivery_at"      timestamp with time zone,
  "completed_at"               timestamp with time zone,
  "cancelled_at"               timestamp with time zone,
  "created_at"                 timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                 timestamp with time zone NOT NULL DEFAULT now(),
  "preferred_courier_code"     text,
  "order_group_id"             uuid,
  "payment_deadline_at"        timestamp with time zone,
  "payment_expired_at"         timestamp with time zone,
  "payment_reopened_at"        timestamp with time zone,
  "payment_reopen_deadline_at" timestamp with time zone,
  CONSTRAINT "orders_bid_winner_id_key" UNIQUE (bid_winner_id),
  CONSTRAINT "orders_payment_status_check"
    CHECK ((payment_status = ANY (ARRAY['PENDING'::text, 'PAID'::text, 'FAILED'::text, 'EXPIRED'::text, 'CANCELLED'::text, 'REFUNDED'::text]))),
  CONSTRAINT "orders_pkey" PRIMARY KEY (order_id),
  CONSTRAINT "orders_status_check"
    CHECK
    ((order_status = ANY (ARRAY['PAYMENT_PENDING'::text, 'PAID'::text, 'READY_FOR_DELIVERY'::text, 'SHIPPED'::text, 'DELIVERED'::text, 'COMPLETED'::text, 'CANCELLED'::text])))
);

ALTER TABLE "public"."orders"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."payment_admin_actions" (
  "action_id"       uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "client_id"       uuid                     NOT NULL,
  "order_group_id"  uuid,
  "bid_winner_id"   uuid,
  "action"          text                     NOT NULL,
  "reason"          text,
  "old_deadline_at" timestamp with time zone,
  "new_deadline_at" timestamp with time zone,
  "performed_by"    uuid,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "payment_admin_actions_pkey" PRIMARY KEY (action_id)
);

ALTER TABLE "public"."payment_admin_actions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."payments" (
  "payment_id"                 uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "auction_item_id"            uuid,
  "bid_winner_id"              uuid,
  "winning_bid_id"             uuid,
  "amount"                     numeric(12,2)            NOT NULL,
  "currency"                   text                     NOT NULL DEFAULT 'PHP'::text,
  "provider"                   text                     NOT NULL DEFAULT 'paymongo'::text,
  "status"                     text                     NOT NULL DEFAULT 'unpaid'::text,
  "checkout_session_id"        text,
  "payment_reference"          text,
  "checkout_url"               text,
  "paid_at"                    timestamp with time zone,
  "created_at"                 timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                 timestamp with time zone NOT NULL DEFAULT now(),
  "order_id"                   uuid,
  "order_group_id"             uuid,
  "environment"                text,
  "confirmation_sent_at"       timestamp with time zone,
  "expires_at"                 timestamp with time zone,
  "expired_at"                 timestamp with time zone,
  "replaced_by_payment_id"     uuid,
  "replacement_for_payment_id" uuid,
  CONSTRAINT "payments_environment_check" CHECK (((environment IS NULL) OR (environment = ANY (ARRAY['TEST'::text, 'PROD'::text])))),
  CONSTRAINT "payments_owner_check" CHECK (((order_group_id IS NOT NULL) OR (bid_winner_id IS NOT NULL))),
  CONSTRAINT "payments_pkey" PRIMARY KEY (payment_id),
  CONSTRAINT "payments_status_check" CHECK ((status = ANY (ARRAY['unpaid'::text, 'pending'::text, 'paid'::text, 'failed'::text, 'cancelled'::text, 'expired'::text])))
);

ALTER TABLE "public"."payments"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."platform_admins" (
  "user_id"    uuid                     NOT NULL,
  "role"       text                     NOT NULL DEFAULT 'SUPER_ADMIN'::text,
  "status"     text                     NOT NULL DEFAULT 'ACTIVE'::text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "platform_admins_pkey" PRIMARY KEY (user_id),
  CONSTRAINT "platform_admins_role_check" CHECK ((upper(role) = ANY (ARRAY['SUPER_ADMIN'::text, 'ADMIN'::text]))),
  CONSTRAINT "platform_admins_status_check" CHECK ((upper(status) = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])))
);

ALTER TABLE "public"."platform_admins"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."webhook_events" (
  "event_id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "client_id"         uuid,
  "fb_page_id"        uuid,
  "event_type"        text,
  "fb_event_id"       text,
  "payload"           jsonb                    NOT NULL,
  "processing_status" text                     NOT NULL DEFAULT 'PENDING'::text,
  "error_message"     text,
  "received_at"       timestamp with time zone NOT NULL DEFAULT now(),
  "processed_at"      timestamp with time zone,
  CONSTRAINT "chk_webhook_events_status" CHECK ((processing_status = ANY (ARRAY['PENDING'::text, 'PROCESSED'::text, 'FAILED'::text]))),
  CONSTRAINT "webhook_events_pkey" PRIMARY KEY (event_id)
);

ALTER TABLE "public"."webhook_events"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.attach_order_to_open_group (
  p_order_id uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
    v_client_id uuid;
    v_buyer_fb_user_id text;
    v_buyer_name text;

    v_order_group_id uuid;
begin

    /*
      Load order information.
    */

    select
        o.client_id,
        o.buyer_fb_user_id,
        o.buyer_name

    into
        v_client_id,
        v_buyer_fb_user_id,
        v_buyer_name

    from public.orders o
    where o.order_id = p_order_id;


    if v_client_id is null then
        raise exception
            'ORDER_NOT_FOUND';
    end if;


    /*
      For automatic consolidation,
      Facebook user ID is required.

      We intentionally do not consolidate
      using buyer name alone.
    */

    if v_buyer_fb_user_id is null
       or trim(v_buyer_fb_user_id) = '' then

        return null;

    end if;


    /*
      Check whether this order is already grouped.
    */

    select
        o.order_group_id

    into
        v_order_group_id

    from public.orders o
    where o.order_id = p_order_id;


    if v_order_group_id is not null then

        perform
            public.recalculate_order_group(
                v_order_group_id
            );

        return
            v_order_group_id;

    end if;


    /*
      Find one OPEN group for the same
      client + Facebook buyer.
    */

    select
        og.order_group_id

    into
        v_order_group_id

    from public.order_groups og

    where og.client_id =
          v_client_id

      and og.buyer_fb_user_id =
          v_buyer_fb_user_id

      and og.group_status =
          'OPEN'

    order by
        og.created_at asc

    limit 1

    for update;


    /*
      Create group if none exists.
    */

    if v_order_group_id is null then

        insert into public.order_groups (
            client_id,
            buyer_fb_user_id,
            buyer_name,
            group_status,
            subtotal,
            shipping_fee,
            total_amount
        )
        values (
            v_client_id,
            v_buyer_fb_user_id,
            v_buyer_name,
            'OPEN',
            0,
            0,
            0
        )
        returning
            order_group_id
        into
            v_order_group_id;

    end if;


    /*
      Attach order.
    */

    update public.orders
    set
        order_group_id =
            v_order_group_id,

        updated_at =
            now()

    where order_id =
          p_order_id;


    /*
      Recalculate totals.
    */

    perform
        public.recalculate_order_group(
            v_order_group_id
        );


    return
        v_order_group_id;

end;
$function$;

CREATE OR REPLACE FUNCTION public.current_client_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select cu.client_id
  from public.client_users cu
  where cu.user_id = auth.uid()
    and cu.status = 'ACTIVE'
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.current_client_role()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
    SELECT cu.role
    FROM public.client_users cu
    WHERE cu.user_id = auth.uid()
      AND cu.status = 'ACTIVE'
    ORDER BY cu.created_at
    LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.current_user_has_client_access (
  target_client_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select
    public.is_platform_admin()
    or exists (
      select 1
      from public.client_users cu
      where cu.user_id = auth.uid()
        and cu.client_id = target_client_id
        and upper(coalesce(cu.status, '')) = 'ACTIVE'
    );
$function$;

CREATE OR REPLACE FUNCTION public.finalize_order_group (
  p_order_group_id         uuid,
  p_shipping_name          text,
  p_shipping_phone         text,
  p_address_line1          text,
  p_address_line2          text,
  p_city                   text,
  p_province               text,
  p_postal_code            text,
  p_country                text,
  p_preferred_courier_code text,
  p_shipping_fee           numeric
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
    v_client_id uuid;
    v_group_status text;
begin

    select
        client_id,
        group_status

    into
        v_client_id,
        v_group_status

    from public.order_groups

    where order_group_id =
          p_order_group_id

    for update;


    if v_client_id is null then

        raise exception
            'ORDER_GROUP_NOT_FOUND';

    end if;


    /*
      During client-portal testing this
      keeps tenant isolation enforced.
    */

    if auth.uid() is not null
       and v_client_id <>
           public.current_client_id() then

        raise exception
            'UNAUTHORIZED';

    end if;


    if v_group_status not in (
        'OPEN',
        'AWAITING_SHIPPING_DETAILS'
    ) then

        raise exception
            'ORDER_GROUP_NOT_READY_FOR_SHIPPING';

    end if;


    if p_shipping_name is null
       or trim(p_shipping_name) = '' then

        raise exception
            'SHIPPING_NAME_REQUIRED';

    end if;


    if p_shipping_phone is null
       or trim(p_shipping_phone) = '' then

        raise exception
            'SHIPPING_PHONE_REQUIRED';

    end if;


    if p_address_line1 is null
       or trim(p_address_line1) = '' then

        raise exception
            'ADDRESS_REQUIRED';

    end if;


    if p_city is null
       or trim(p_city) = '' then

        raise exception
            'CITY_REQUIRED';

    end if;


    if p_province is null
       or trim(p_province) = '' then

        raise exception
            'PROVINCE_REQUIRED';

    end if;


    if p_preferred_courier_code is null
       or trim(p_preferred_courier_code) = '' then

        raise exception
            'COURIER_REQUIRED';

    end if;


    if coalesce(
        p_shipping_fee,
        0
    ) < 0 then

        raise exception
            'INVALID_SHIPPING_FEE';

    end if;


    update public.order_groups
    set
        shipping_name =
            trim(
                p_shipping_name
            ),

        shipping_phone =
            trim(
                p_shipping_phone
            ),

        shipping_address_line1 =
            trim(
                p_address_line1
            ),

        shipping_address_line2 =
            nullif(
                trim(
                    coalesce(
                        p_address_line2,
                        ''
                    )
                ),
                ''
            ),

        shipping_city =
            trim(
                p_city
            ),

        shipping_province =
            trim(
                p_province
            ),

        shipping_postal_code =
            nullif(
                trim(
                    coalesce(
                        p_postal_code,
                        ''
                    )
                ),
                ''
            ),

        shipping_country =
            coalesce(
                nullif(
                    trim(
                        p_country
                    ),
                    ''
                ),
                'PH'
            ),

        preferred_courier_code =
            trim(
                p_preferred_courier_code
            ),

        shipping_fee =
            coalesce(
                p_shipping_fee,
                0
            ),

        buyer_checkout_choice =
            'PAY_NOW',

        buyer_choice_at =
            coalesce(
                buyer_choice_at,
                now()
            ),

        locked_at =
            coalesce(
                locked_at,
                now()
            ),

        group_status =
            'READY_FOR_PAYMENT',

        updated_at =
            now()

    where order_group_id =
          p_order_group_id;


    perform
        public.recalculate_order_group(
            p_order_group_id
        );


    /*
      Keep child orders compatible with
      existing Order UI.
    */

    update public.orders
    set
        shipping_name =
            trim(
                p_shipping_name
            ),

        shipping_phone =
            trim(
                p_shipping_phone
            ),

        shipping_address_line1 =
            trim(
                p_address_line1
            ),

        shipping_address_line2 =
            nullif(
                trim(
                    coalesce(
                        p_address_line2,
                        ''
                    )
                ),
                ''
            ),

        shipping_city =
            trim(
                p_city
            ),

        shipping_province =
            trim(
                p_province
            ),

        shipping_postal_code =
            nullif(
                trim(
                    coalesce(
                        p_postal_code,
                        ''
                    )
                ),
                ''
            ),

        shipping_country =
            coalesce(
                nullif(
                    trim(
                        p_country
                    ),
                    ''
                ),
                'PH'
            ),

        preferred_courier_code =
            trim(
                p_preferred_courier_code
            ),

        updated_at =
            now()

    where order_group_id =
          p_order_group_id;

end;
$function$;

CREATE OR REPLACE FUNCTION public.generate_order_group_number()
  RETURNS text
  LANGUAGE plpgsql
  AS $function$
declare
    v_number text;
begin

    loop

        v_number :=
            'GRP-' ||
            to_char(
                now() at time zone 'Asia/Manila',
                'YYYYMMDD'
            ) ||
            '-' ||
            upper(
                substr(
                    replace(
                        gen_random_uuid()::text,
                        '-',
                        ''
                    ),
                    1,
                    6
                )
            );

        exit when not exists (
            select 1
            from public.order_groups
            where group_number = v_number
        );

    end loop;

    return v_number;

end;
$function$;

CREATE OR REPLACE FUNCTION public.generate_order_number()
  RETURNS text
  LANGUAGE plpgsql
  AS $function$
declare
    v_order_number text;
begin

    loop

        v_order_number :=
            'ORD-' ||
            to_char(
                now() at time zone 'Asia/Manila',
                'YYYYMMDD'
            ) ||
            '-' ||
            upper(
                substr(
                    replace(
                        gen_random_uuid()::text,
                        '-',
                        ''
                    ),
                    1,
                    6
                )
            );

        exit when not exists (
            select 1
            from public.orders
            where order_number = v_order_number
        );

    end loop;

    return v_order_number;

end;
$function$;

CREATE OR REPLACE FUNCTION public.is_client_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
    SELECT EXISTS
    (
        SELECT 1
        FROM public.client_users cu
        WHERE cu.user_id = auth.uid()
          AND cu.status = 'ACTIVE'
          AND cu.role IN ('OWNER', 'ADMIN')
    );
$function$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = auth.uid()
      and upper(pa.status) = 'ACTIVE'
  );
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_order_group (
  p_order_group_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
    v_subtotal numeric(12,2);
    v_shipping numeric(12,2);
begin

    select
        coalesce(
            sum(o.subtotal),
            0
        )
    into v_subtotal
    from public.orders o
    where o.order_group_id = p_order_group_id
      and o.order_status <> 'CANCELLED';


    select
        coalesce(
            og.shipping_fee,
            0
        )
    into v_shipping
    from public.order_groups og
    where og.order_group_id = p_order_group_id;


    update public.order_groups
    set
        subtotal =
            v_subtotal,

        total_amount =
            v_subtotal +
            coalesce(
                v_shipping,
                0
            ),

        updated_at =
            now()

    where order_group_id =
          p_order_group_id;

end;
$function$;

CREATE OR REPLACE FUNCTION public.set_deliveries_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
    new.updated_at := now();
    return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_eo2mate_environment_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_eo2mate_reference_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_inventory_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_order_group_checkout_choice (
  p_order_group_id uuid,
  p_choice         text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
declare
    v_group_status text;
    v_item_count integer;
    v_result_status text;
begin

    p_choice :=
        upper(
            trim(
                coalesce(
                    p_choice,
                    ''
                )
            )
        );


    if p_choice not in (
        'PAY_NOW',
        'KEEP_OPEN'
    ) then

        raise exception
            'INVALID_CHECKOUT_CHOICE';

    end if;


    /*
      Lock the group row so two simultaneous
      actions cannot alter the same group.
    */

    select
        group_status

    into
        v_group_status

    from public.order_groups

    where order_group_id =
          p_order_group_id

    for update;


    if v_group_status is null then

        raise exception
            'ORDER_GROUP_NOT_FOUND';

    end if;


    /*
      Choice is only valid while the
      consolidation group is OPEN.
    */

    if v_group_status <> 'OPEN' then

        raise exception
            'ORDER_GROUP_ALREADY_LOCKED';

    end if;


    select
        count(*)

    into
        v_item_count

    from public.orders

    where order_group_id =
          p_order_group_id

      and order_status <>
          'CANCELLED';


    if v_item_count = 0 then

        raise exception
            'ORDER_GROUP_HAS_NO_ITEMS';

    end if;


    /*
      KEEP_OPEN:
      remember the preference but continue
      accepting new wins/items.
    */

    if p_choice = 'KEEP_OPEN' then

        update public.order_groups
        set
            buyer_checkout_choice =
                'KEEP_OPEN',

            buyer_choice_at =
                now(),

            updated_at =
                now()

        where order_group_id =
              p_order_group_id;


        v_result_status :=
            'OPEN';


    /*
      PAY_NOW:
      lock consolidation immediately.
      No more orders can enter this group.
    */

    else

        update public.order_groups
        set
            buyer_checkout_choice =
                'PAY_NOW',

            buyer_choice_at =
                now(),

            locked_at =
                now(),

            group_status =
                'AWAITING_SHIPPING_DETAILS',

            updated_at =
                now()

        where order_group_id =
              p_order_group_id;


        v_result_status :=
            'AWAITING_SHIPPING_DETAILS';

    end if;


    return jsonb_build_object(
        'success',
        true,

        'order_group_id',
        p_order_group_id,

        'choice',
        p_choice,

        'group_status',
        v_result_status,

        'item_count',
        v_item_count
    );

end;
$function$;

CREATE OR REPLACE FUNCTION public.set_orders_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin
    new.updated_at := now();
    return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_order_shipping (
  p_order_id               uuid,
  p_shipping_name          text,
  p_shipping_phone         text,
  p_address_line1          text,
  p_address_line2          text,
  p_city                   text,
  p_province               text,
  p_postal_code            text,
  p_country                text,
  p_preferred_courier_code text
)
  RETURNS void
  LANGUAGE plpgsql
  AS $function$
begin

    update public.orders
    set
        shipping_name = p_shipping_name,
        shipping_phone = p_shipping_phone,
        shipping_address_line1 = p_address_line1,
        shipping_address_line2 = p_address_line2,
        shipping_city = p_city,
        shipping_province = p_province,
        shipping_postal_code = p_postal_code,
        shipping_country = coalesce(p_country, 'PH'),
        preferred_courier_code = p_preferred_courier_code,
        updated_at = now()
    where order_id = p_order_id
      and client_id = public.current_client_id();

end;
$function$;

CREATE OR REPLACE FUNCTION public.user_has_client_access (
  p_client_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
    SELECT EXISTS
    (
        SELECT 1
        FROM public.client_users cu
        WHERE cu.user_id = auth.uid()
          AND cu.client_id = p_client_id
          AND cu.status = 'ACTIVE'
    );
$function$;

ALTER TABLE "public"."auction_bids"
  ADD CONSTRAINT "fk_auction_bids_item" FOREIGN KEY (auction_item_id) REFERENCES public.auction_items(auction_item_id);

ALTER TABLE "public"."auction_items"
  ADD CONSTRAINT "fk_auction_items_post" FOREIGN KEY (auction_post_id) REFERENCES public.auction_posts(post_id);

ALTER TABLE "public"."auction_rules"
  ADD CONSTRAINT "fk_auction_rules_item" FOREIGN KEY (auction_item_id) REFERENCES public.auction_items(auction_item_id);

ALTER TABLE "public"."auction_items"
  ADD CONSTRAINT "fk_auction_items_winner" FOREIGN KEY (bid_winner_id) REFERENCES public.auction_winners(bid_winner_id);

ALTER TABLE "public"."auction_winners"
  ADD CONSTRAINT "fk_auction_winners_bid" FOREIGN KEY (bid_id) REFERENCES public.auction_bids(bid_id);

ALTER TABLE "public"."auction_winners"
  ADD CONSTRAINT "fk_auction_winners_item" FOREIGN KEY (auction_item_id) REFERENCES public.auction_items(auction_item_id);

ALTER TABLE "public"."buyer_checkout_sessions"
  ADD CONSTRAINT "buyer_checkout_sessions_bid_winner_id_fkey" FOREIGN KEY (bid_winner_id) REFERENCES public.auction_winners(bid_winner_id);

ALTER TABLE "public"."client_users"
  ADD CONSTRAINT "client_users_user_fk" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."deliveries"
  ADD CONSTRAINT "deliveries_pickup_location_id_fkey" FOREIGN KEY (pickup_location_id) REFERENCES public.client_pickup_locations(pickup_location_id);

ALTER TABLE "public"."auction_posts"
  ADD CONSTRAINT "auction_posts_environment_fkey" FOREIGN KEY (environment) REFERENCES public.eo2mate_environments(environment_code) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "public"."client_subscriptions"
  ADD CONSTRAINT "client_subscriptions_allowed_environment_fkey" FOREIGN KEY (allowed_environment) REFERENCES public.eo2mate_environments(environment_code) ON UPDATE CASCADE
    ON DELETE RESTRICT;

ALTER TABLE "public"."eo2mate_post_mode_types"
  ADD CONSTRAINT "eo2mate_post_mode_types_mode_fkey" FOREIGN KEY (mode_code) REFERENCES public.eo2mate_post_modes(mode_code) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "public"."auction_posts"
  ADD CONSTRAINT "auction_posts_post_type_fkey" FOREIGN KEY (post_type) REFERENCES public.eo2mate_post_types(post_type_code) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "public"."eo2mate_post_mode_types"
  ADD CONSTRAINT "eo2mate_post_mode_types_type_fkey" FOREIGN KEY (post_type_code) REFERENCES public.eo2mate_post_types(post_type_code) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "public"."auction_posts"
  ADD CONSTRAINT "fk_auction_posts_fb_page" FOREIGN KEY (fb_page_id) REFERENCES public.fb_pages(fb_page_id);

ALTER TABLE "public"."inventory_import_rows"
  ADD CONSTRAINT "inventory_import_rows_batch_fkey" FOREIGN KEY (inventory_import_batch_id) REFERENCES public.inventory_import_batches(inventory_import_batch_id) ON UPDATE CASCADE
    ON DELETE CASCADE;

ALTER TABLE "public"."inventory_import_batches"
  ADD CONSTRAINT "inventory_import_batches_status_fkey" FOREIGN KEY (import_status_code) REFERENCES public.inventory_import_statuses(import_status_code) ON UPDATE CASCADE
    ON DELETE RESTRICT;

ALTER TABLE "public"."auction_items"
  ADD CONSTRAINT "auction_items_inventory_item_fkey" FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(inventory_item_id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_import_rows"
  ADD CONSTRAINT "inventory_import_rows_item_fkey" FOREIGN KEY (resolved_inventory_item_id) REFERENCES public.inventory_items(inventory_item_id) ON UPDATE CASCADE ON DELETE
    SET NULL;

ALTER TABLE "public"."inventory_item_images"
  ADD CONSTRAINT "inventory_item_images_item_fkey" FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(inventory_item_id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "public"."inventory_movements"
  ADD CONSTRAINT "inventory_movements_item_fkey" FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(inventory_item_id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_movements"
  ADD CONSTRAINT "inventory_movements_type_fkey" FOREIGN KEY (movement_type_code) REFERENCES public.inventory_movement_types(movement_type_code) ON UPDATE CASCADE
    ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_import_rows"
  ADD CONSTRAINT "inventory_import_rows_owner_type_fkey" FOREIGN KEY (owner_type_code) REFERENCES public.inventory_owner_types(owner_type_code) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_owners"
  ADD CONSTRAINT "inventory_owners_owner_type_fkey" FOREIGN KEY (owner_type_code) REFERENCES public.inventory_owner_types(owner_type_code) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "public"."auction_items"
  ADD CONSTRAINT "auction_items_inventory_owner_fkey" FOREIGN KEY (inventory_owner_id) REFERENCES public.inventory_owners(inventory_owner_id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_import_rows"
  ADD CONSTRAINT "inventory_import_rows_owner_fkey" FOREIGN KEY (resolved_inventory_owner_id) REFERENCES public.inventory_owners(inventory_owner_id) ON UPDATE CASCADE ON DELETE
    SET NULL;

ALTER TABLE "public"."inventory_items"
  ADD CONSTRAINT "inventory_items_owner_fkey" FOREIGN KEY (inventory_owner_id) REFERENCES public.inventory_owners(inventory_owner_id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_reservations"
  ADD CONSTRAINT "inventory_reservations_auction_item_fkey" FOREIGN KEY (auction_item_id) REFERENCES public.auction_items(auction_item_id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE "public"."inventory_reservations"
  ADD CONSTRAINT "inventory_reservations_auction_post_fkey" FOREIGN KEY (auction_post_id) REFERENCES public.auction_posts(post_id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE "public"."inventory_reservations"
  ADD CONSTRAINT "inventory_reservations_item_fkey" FOREIGN KEY (inventory_item_id) REFERENCES public.inventory_items(inventory_item_id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_reservations"
  ADD CONSTRAINT "inventory_reservations_mode_fkey" FOREIGN KEY (source_mode_code) REFERENCES public.eo2mate_post_modes(mode_code) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_reservations"
  ADD CONSTRAINT "inventory_reservations_post_type_fkey" FOREIGN KEY (source_post_type_code) REFERENCES public.eo2mate_post_types(post_type_code) ON UPDATE CASCADE
    ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_reservations"
  ADD CONSTRAINT "inventory_reservations_status_fkey" FOREIGN KEY (reservation_status_code) REFERENCES public.inventory_reservation_statuses(reservation_status_code)
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "public"."auction_audit_log"
  ADD CONSTRAINT "fk_auction_audit_log_client" FOREIGN KEY (client_id) REFERENCES public.master_clients(client_id);

ALTER TABLE "public"."auction_posts"
  ADD CONSTRAINT "fk_auction_posts_client" FOREIGN KEY (client_id) REFERENCES public.master_clients(client_id);

ALTER TABLE "public"."buyer_checkout_sessions"
  ADD CONSTRAINT "buyer_checkout_sessions_client_id_fkey" FOREIGN KEY (client_id) REFERENCES public.master_clients(client_id);

ALTER TABLE "public"."client_payment_accounts"
  ADD CONSTRAINT "client_payment_accounts_client_id_fkey" FOREIGN KEY (client_id) REFERENCES public.master_clients(client_id) ON DELETE CASCADE;

ALTER TABLE "public"."client_pickup_locations"
  ADD CONSTRAINT "client_pickup_locations_client_id_fkey" FOREIGN KEY (client_id) REFERENCES public.master_clients(client_id) ON DELETE CASCADE;

ALTER TABLE "public"."client_subscriptions"
  ADD CONSTRAINT "client_subscriptions_client_id_fkey" FOREIGN KEY (client_id) REFERENCES public.master_clients(client_id) ON DELETE CASCADE;

ALTER TABLE "public"."client_users"
  ADD CONSTRAINT "client_users_client_fk" FOREIGN KEY (client_id) REFERENCES public.master_clients(client_id) ON DELETE CASCADE;

ALTER TABLE "public"."deliveries"
  ADD CONSTRAINT "deliveries_client_fk" FOREIGN KEY (client_id) REFERENCES public.master_clients(client_id);

ALTER TABLE "public"."fb_pages"
  ADD CONSTRAINT "fk_fb_pages_client" FOREIGN KEY (client_id) REFERENCES public.master_clients(client_id);

ALTER TABLE "public"."inventory_import_batches"
  ADD CONSTRAINT "inventory_import_batches_client_fkey" FOREIGN KEY (client_id) REFERENCES public.master_clients(client_id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_item_images"
  ADD CONSTRAINT "inventory_item_images_client_fkey" FOREIGN KEY (client_id) REFERENCES public.master_clients(client_id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_items"
  ADD CONSTRAINT "inventory_items_client_fkey" FOREIGN KEY (client_id) REFERENCES public.master_clients(client_id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_movements"
  ADD CONSTRAINT "inventory_movements_client_fkey" FOREIGN KEY (client_id) REFERENCES public.master_clients(client_id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_owners"
  ADD CONSTRAINT "inventory_owners_client_fkey" FOREIGN KEY (client_id) REFERENCES public.master_clients(client_id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "public"."inventory_reservations"
  ADD CONSTRAINT "inventory_reservations_client_fkey" FOREIGN KEY (client_id) REFERENCES public.master_clients(client_id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "public"."messenger_payment_claims"
  ADD CONSTRAINT "messenger_payment_claims_bid_winner_id_fkey" FOREIGN KEY (bid_winner_id) REFERENCES public.auction_winners(bid_winner_id);

ALTER TABLE "public"."order_groups"
  ADD CONSTRAINT "order_groups_client_id_fkey" FOREIGN KEY (client_id) REFERENCES public.master_clients(client_id);

ALTER TABLE "public"."order_groups"
  ADD CONSTRAINT "order_groups_environment_fkey" FOREIGN KEY (environment) REFERENCES public.eo2mate_environments(environment_code) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "public"."buyer_checkout_sessions"
  ADD CONSTRAINT "buyer_checkout_sessions_order_group_id_fkey" FOREIGN KEY (order_group_id) REFERENCES public.order_groups(order_group_id);

ALTER TABLE "public"."deliveries"
  ADD CONSTRAINT "deliveries_order_group_fk" FOREIGN KEY (order_group_id) REFERENCES public.order_groups(order_group_id);

ALTER TABLE "public"."messenger_payment_claims"
  ADD CONSTRAINT "messenger_payment_claims_order_group_fk" FOREIGN KEY (order_group_id) REFERENCES public.order_groups(order_group_id) ON DELETE CASCADE;

ALTER TABLE "public"."orders"
  ADD CONSTRAINT "orders_auction_item_fk" FOREIGN KEY (auction_item_id) REFERENCES public.auction_items(auction_item_id);

ALTER TABLE "public"."orders"
  ADD CONSTRAINT "orders_client_fk" FOREIGN KEY (client_id) REFERENCES public.master_clients(client_id);

ALTER TABLE "public"."orders"
  ADD CONSTRAINT "orders_order_group_fk" FOREIGN KEY (order_group_id) REFERENCES public.order_groups(order_group_id);

ALTER TABLE "public"."deliveries"
  ADD CONSTRAINT "deliveries_order_fk" FOREIGN KEY (order_id) REFERENCES public.orders(order_id);

ALTER TABLE "public"."orders"
  ADD CONSTRAINT "orders_winner_fk" FOREIGN KEY (bid_winner_id) REFERENCES public.auction_winners(bid_winner_id);

ALTER TABLE "public"."payments"
  ADD CONSTRAINT "payments_order_group_id_fk" FOREIGN KEY (order_group_id) REFERENCES public.order_groups(order_group_id);

ALTER TABLE "public"."payments"
  ADD CONSTRAINT "payments_order_id_fk" FOREIGN KEY (order_id) REFERENCES public.orders(order_id);

ALTER TABLE "public"."platform_admins"
  ADD CONSTRAINT "platform_admins_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."webhook_events"
  ADD CONSTRAINT "fk_webhook_events_client" FOREIGN KEY (client_id) REFERENCES public.master_clients(client_id);

ALTER TABLE "public"."webhook_events"
  ADD CONSTRAINT "fk_webhook_events_fb_page" FOREIGN KEY (fb_page_id) REFERENCES public.fb_pages(page_id);

CREATE VIEW "public"."client_auction_bid_history" WITH (security_invoker=true) AS  SELECT ap.client_id,
    ap.post_id,
    ap.fb_post_id,
    ai.auction_item_id,
    ai.item_label,
    ab.bid_id,
    ab.fb_comment_id,
    ab.fb_user_id,
    ab.fb_user_name,
    ab.comment_text,
    ab.bid_amt,
    ab.is_valid,
    ab.invalid_reason,
    ab.commented_at
   FROM ((public.auction_bids ab
     JOIN public.auction_items ai ON ((ai.auction_item_id = ab.auction_item_id)))
     JOIN public.auction_posts ap ON ((ap.post_id = ai.auction_post_id)));

CREATE VIEW "public"."client_auction_dashboard" WITH (security_invoker=true) AS  SELECT ap.client_id,
    ap.post_id,
    ap.fb_post_id,
    ap.post_type,
    ap.status AS post_status,
    ap.created_at AS post_created_at,
    ai.auction_item_id,
    ai.item_label,
    ai.status AS item_status,
    ai.min_bidder_reached_at,
    ai.bid_winner_id,
    ar.min_bid,
    ar.bid_increment,
    ar.min_bidder_count,
    ar.bid_buyout_amt,
    ar.buyout_dt_limit,
    ar.auction_end_dt,
    ar.anti_sniper_minutes,
    ( SELECT ab.bid_amt
           FROM public.auction_bids ab
          WHERE ((ab.auction_item_id = ai.auction_item_id) AND (ab.is_valid = true))
          ORDER BY ab.bid_amt DESC, ab.commented_at
         LIMIT 1) AS highest_bid,
    ( SELECT ab.fb_user_name
           FROM public.auction_bids ab
          WHERE ((ab.auction_item_id = ai.auction_item_id) AND (ab.is_valid = true))
          ORDER BY ab.bid_amt DESC, ab.commented_at
         LIMIT 1) AS highest_bidder_name,
    ( SELECT ab.fb_user_id
           FROM public.auction_bids ab
          WHERE ((ab.auction_item_id = ai.auction_item_id) AND (ab.is_valid = true))
          ORDER BY ab.bid_amt DESC, ab.commented_at
         LIMIT 1) AS highest_bidder_id,
    ( SELECT count(DISTINCT ab.fb_user_id) AS count
           FROM public.auction_bids ab
          WHERE ((ab.auction_item_id = ai.auction_item_id) AND (ab.is_valid = true) AND (ab.fb_user_id IS NOT NULL))) AS valid_bidder_count,
    ( SELECT count(*) AS count
           FROM public.auction_bids ab
          WHERE ((ab.auction_item_id = ai.auction_item_id) AND (ab.is_valid = true))) AS valid_bid_count,
    ( SELECT count(*) AS count
           FROM public.auction_bids ab
          WHERE ((ab.auction_item_id = ai.auction_item_id) AND (ab.is_valid = false))) AS invalid_bid_count,
    aw.bid_id AS winning_bid_id,
    aw.winning_amt,
    aw.status AS winner_status,
    aw.won_at,
    p.payment_id,
    p.amount AS payment_amount,
    p.status AS payment_status,
    p.checkout_url,
        CASE
            WHEN ((ai.status = 'CLOSED'::text) AND (ai.bid_winner_id IS NOT NULL)) THEN 'COMPLETED_WITH_WINNER'::text
            WHEN ((ai.status = 'CLOSED'::text) AND (ai.bid_winner_id IS NULL)) THEN 'CLOSED_NO_WINNER'::text
            WHEN ((ai.status = 'ACTIVE'::text) AND (ar.auction_end_dt <= now())) THEN 'AWAITING_FINALIZER'::text
            WHEN (ai.status = 'ACTIVE'::text) THEN 'ACTIVE'::text
            ELSE ai.status
        END AS ui_status,
        CASE
            WHEN (( SELECT count(DISTINCT ab.fb_user_id) AS count
               FROM public.auction_bids ab
              WHERE ((ab.auction_item_id = ai.auction_item_id) AND (ab.is_valid = true) AND (ab.fb_user_id IS NOT NULL))) >= COALESCE(ar.min_bidder_count, 1)) THEN true
            ELSE false
        END AS minimum_bidder_reached
   FROM ((((public.auction_posts ap
     JOIN public.auction_items ai ON ((ai.auction_post_id = ap.post_id)))
     JOIN public.auction_rules ar ON ((ar.auction_item_id = ai.auction_item_id)))
     LEFT JOIN public.auction_winners aw ON ((aw.bid_winner_id = ai.bid_winner_id)))
     LEFT JOIN LATERAL ( SELECT p1.payment_id,
            p1.auction_item_id,
            p1.bid_winner_id,
            p1.winning_bid_id,
            p1.amount,
            p1.currency,
            p1.provider,
            p1.status,
            p1.checkout_session_id,
            p1.payment_reference,
            p1.checkout_url,
            p1.paid_at,
            p1.created_at,
            p1.updated_at
           FROM public.payments p1
          WHERE (p1.bid_winner_id = aw.bid_winner_id)
          ORDER BY p1.created_at DESC
         LIMIT 1) p ON (true));

CREATE VIEW "public"."client_auction_detail" WITH (security_invoker=true) AS  SELECT ap.client_id,
    ap.post_id,
    ap.fb_post_id,
    ap.post_type,
    ap.caption,
    ap.status AS post_status,
    ap.created_at AS post_created_at,
    ai.auction_item_id,
    ai.item_label,
    ai.status AS item_status,
    ai.min_bidder_reached_at,
    ai.bid_winner_id,
    ar.rule_name,
    ar.min_bid,
    ar.bid_increment,
    ar.min_bidder_count,
    ar.bid_buyout_amt,
    ar.buyout_dt_limit,
    ar.auction_end_dt,
    ar.anti_sniper_minutes,
    ( SELECT count(DISTINCT ab.fb_user_id) AS count
           FROM public.auction_bids ab
          WHERE ((ab.auction_item_id = ai.auction_item_id) AND (ab.is_valid = true) AND (ab.fb_user_id IS NOT NULL))) AS valid_bidder_count,
    ( SELECT count(*) AS count
           FROM public.auction_bids ab
          WHERE ((ab.auction_item_id = ai.auction_item_id) AND (ab.is_valid = true))) AS valid_bid_count,
    ( SELECT count(*) AS count
           FROM public.auction_bids ab
          WHERE ((ab.auction_item_id = ai.auction_item_id) AND (ab.is_valid = false))) AS invalid_bid_count,
    ( SELECT ab.bid_amt
           FROM public.auction_bids ab
          WHERE ((ab.auction_item_id = ai.auction_item_id) AND (ab.is_valid = true))
          ORDER BY ab.bid_amt DESC, ab.commented_at
         LIMIT 1) AS highest_bid,
    ( SELECT ab.fb_user_name
           FROM public.auction_bids ab
          WHERE ((ab.auction_item_id = ai.auction_item_id) AND (ab.is_valid = true))
          ORDER BY ab.bid_amt DESC, ab.commented_at
         LIMIT 1) AS highest_bidder_name,
    aw.bid_id AS winning_bid_id,
    aw.winning_amt,
    aw.status AS winner_status,
    aw.won_at,
    p.payment_id,
    p.amount AS payment_amount,
    p.status AS payment_status,
    p.checkout_url,
        CASE
            WHEN ((ai.status = 'CLOSED'::text) AND (ai.bid_winner_id IS NOT NULL)) THEN 'COMPLETED_WITH_WINNER'::text
            WHEN ((ai.status = 'CLOSED'::text) AND (ai.bid_winner_id IS NULL)) THEN 'CLOSED_NO_WINNER'::text
            WHEN ((ai.status = 'ACTIVE'::text) AND (ar.auction_end_dt <= now())) THEN 'AWAITING_FINALIZER'::text
            WHEN (ai.status = 'ACTIVE'::text) THEN 'ACTIVE'::text
            ELSE ai.status
        END AS ui_status
   FROM ((((public.auction_posts ap
     JOIN public.auction_items ai ON ((ai.auction_post_id = ap.post_id)))
     JOIN public.auction_rules ar ON ((ar.auction_item_id = ai.auction_item_id)))
     LEFT JOIN public.auction_winners aw ON ((aw.bid_winner_id = ai.bid_winner_id)))
     LEFT JOIN LATERAL ( SELECT p1.payment_id,
            p1.auction_item_id,
            p1.bid_winner_id,
            p1.winning_bid_id,
            p1.amount,
            p1.currency,
            p1.provider,
            p1.status,
            p1.checkout_session_id,
            p1.payment_reference,
            p1.checkout_url,
            p1.paid_at,
            p1.created_at,
            p1.updated_at
           FROM public.payments p1
          WHERE (p1.bid_winner_id = aw.bid_winner_id)
          ORDER BY p1.created_at DESC
         LIMIT 1) p ON (true));

CREATE VIEW "public"."client_auction_list" WITH (security_invoker=true) AS  SELECT client_id,
    post_id,
    fb_post_id,
    post_type,
    post_status,
    post_created_at,
    auction_item_id,
    item_label,
    item_status,
    ui_status,
    min_bid,
    bid_increment,
    min_bidder_count,
    valid_bidder_count,
    valid_bid_count,
    invalid_bid_count,
    highest_bid,
    highest_bidder_name,
    highest_bidder_id,
    minimum_bidder_reached,
    min_bidder_reached_at,
    bid_buyout_amt,
    buyout_dt_limit,
    auction_end_dt,
    anti_sniper_minutes,
    bid_winner_id,
    winning_bid_id,
    winning_amt,
    winner_status,
    won_at,
    payment_id,
    payment_amount,
    payment_status,
    checkout_url
   FROM public.client_auction_dashboard d;

CREATE VIEW "public"."client_delivery_summary" WITH (security_invoker=true) AS  SELECT client_id,
    count(*) AS total_deliveries,
    count(*) FILTER (WHERE (delivery_status = 'READY_FOR_BOOKING'::text)) AS ready_for_booking,
    count(*) FILTER (WHERE (delivery_status = 'BOOKED'::text)) AS booked,
    count(*) FILTER (WHERE (delivery_status = 'PICKED_UP'::text)) AS picked_up,
    count(*) FILTER (WHERE (delivery_status = 'IN_TRANSIT'::text)) AS in_transit,
    count(*) FILTER (WHERE (delivery_status = 'DELIVERED'::text)) AS delivered,
    count(*) FILTER (WHERE (delivery_status = 'FAILED'::text)) AS failed,
    count(*) FILTER (WHERE (delivery_status = 'CANCELLED'::text)) AS cancelled
   FROM public.deliveries
  GROUP BY client_id;

CREATE VIEW "public"."client_order_summary" WITH (security_invoker=true) AS  SELECT client_id,
    count(*) AS total_orders,
    count(*) FILTER (WHERE (order_status = 'PAYMENT_PENDING'::text)) AS payment_pending_orders,
    count(*) FILTER (WHERE (order_status = 'PAID'::text)) AS paid_orders,
    count(*) FILTER (WHERE (order_status = 'READY_FOR_DELIVERY'::text)) AS ready_for_delivery_orders,
    count(*) FILTER (WHERE (order_status = 'SHIPPED'::text)) AS shipped_orders,
    count(*) FILTER (WHERE (order_status = 'DELIVERED'::text)) AS delivered_orders,
    count(*) FILTER (WHERE (order_status = 'COMPLETED'::text)) AS completed_orders,
    COALESCE(sum(total_amount), (0)::numeric) AS total_order_value,
    COALESCE(sum(total_amount) FILTER (WHERE (payment_status = 'PAID'::text)), (0)::numeric) AS paid_order_value
   FROM public.orders
  GROUP BY client_id;

CREATE VIEW "public"."client_payment_summary" WITH (security_invoker=true) AS  SELECT o.client_id,
    count(*) AS total_payments,
    count(*) FILTER (WHERE (lower(p.status) = 'pending'::text)) AS pending_payments,
    count(*) FILTER (WHERE (lower(p.status) = 'paid'::text)) AS paid_payments,
    count(*) FILTER (WHERE (lower(p.status) = 'failed'::text)) AS failed_payments,
    count(*) FILTER (WHERE (lower(p.status) = 'expired'::text)) AS expired_payments,
    count(*) FILTER (WHERE (lower(p.status) = 'refunded'::text)) AS refunded_payments,
    COALESCE(sum(p.amount), (0)::numeric) AS total_payment_value,
    COALESCE(sum(p.amount) FILTER (WHERE (lower(p.status) = 'paid'::text)), (0)::numeric) AS total_paid_value
   FROM (public.payments p
     JOIN public.orders o ON ((o.order_id = p.order_id)))
  GROUP BY o.client_id;

CREATE VIEW "public"."inventory_stock_balances" AS  WITH movement_totals AS (
         SELECT im.inventory_item_id,
            (COALESCE(sum((im.quantity * (imt.quantity_effect)::numeric)), (0)::numeric))::numeric(18,4) AS qty_on_hand
           FROM (public.inventory_movements im
             JOIN public.inventory_movement_types imt ON ((imt.movement_type_code = im.movement_type_code)))
          GROUP BY im.inventory_item_id
        ), reservation_totals AS (
         SELECT ir.inventory_item_id,
            (COALESCE(sum(ir.quantity), (0)::numeric))::numeric(18,4) AS qty_reserved
           FROM public.inventory_reservations ir
          WHERE (ir.reservation_status_code = 'ACTIVE'::text)
          GROUP BY ir.inventory_item_id
        )
 SELECT ii.inventory_item_id,
    ii.client_id,
    ii.inventory_owner_id,
    ii.item_code,
    ii.item_name,
    (COALESCE(mt.qty_on_hand, (0)::numeric))::numeric(18,4) AS qty_on_hand,
    (COALESCE(rt.qty_reserved, (0)::numeric))::numeric(18,4) AS qty_reserved,
    ((COALESCE(mt.qty_on_hand, (0)::numeric) - COALESCE(rt.qty_reserved, (0)::numeric)))::numeric(18,4) AS qty_available
   FROM ((public.inventory_items ii
     LEFT JOIN movement_totals mt ON ((mt.inventory_item_id = ii.inventory_item_id)))
     LEFT JOIN reservation_totals rt ON ((rt.inventory_item_id = ii.inventory_item_id)));

CREATE VIEW "public"."inventory_items_with_stock" AS  SELECT ii.inventory_item_id,
    ii.client_id,
    ii.inventory_owner_id,
    io.owner_type_code,
    io.owner_code,
    io.owner_name,
    ii.item_code,
    ii.item_name,
    ii.description,
    ii.default_selling_price,
    ii.status,
    ii.source_type,
    ii.created_from_post,
    (COALESCE(isb.qty_on_hand, (0)::numeric))::numeric(18,4) AS qty_on_hand,
    (COALESCE(isb.qty_reserved, (0)::numeric))::numeric(18,4) AS qty_reserved,
    (COALESCE(isb.qty_available, (0)::numeric))::numeric(18,4) AS qty_available,
    ii.created_at,
    ii.updated_at
   FROM ((public.inventory_items ii
     JOIN public.inventory_owners io ON ((io.inventory_owner_id = ii.inventory_owner_id)))
     LEFT JOIN public.inventory_stock_balances isb ON ((isb.inventory_item_id = ii.inventory_item_id)));

CREATE INDEX idx_auction_bids_commented_at ON public.auction_bids USING btree (commented_at);

CREATE INDEX idx_auction_bids_fb_user_id ON public.auction_bids USING btree (fb_user_id);

CREATE INDEX idx_auction_bids_item_id ON public.auction_bids USING btree (auction_item_id);

CREATE INDEX idx_auction_items_fb_object_id ON public.auction_items USING btree (fb_object_id);

CREATE INDEX idx_auction_items_inventory_item ON public.auction_items USING btree (inventory_item_id);

CREATE INDEX idx_auction_items_post_id ON public.auction_items USING btree (auction_post_id);

CREATE INDEX idx_auction_posts_client_id ON public.auction_posts USING btree (client_id);

CREATE INDEX idx_auction_posts_environment ON public.auction_posts USING btree (environment);

CREATE INDEX idx_auction_posts_fb_page_id ON public.auction_posts USING btree (fb_page_id);

CREATE INDEX idx_auction_rules_item_id ON public.auction_rules USING btree (auction_item_id);

CREATE INDEX idx_auction_winners_item_id ON public.auction_winners USING btree (auction_item_id);

CREATE INDEX idx_audit_log_client_id ON public.auction_audit_log USING btree (client_id);

CREATE INDEX idx_audit_log_record_id ON public.auction_audit_log USING btree (record_id);

CREATE INDEX idx_client_payment_accounts_client ON public.client_payment_accounts USING btree (client_id);

CREATE INDEX idx_client_pickup_locations_client ON public.client_pickup_locations USING btree (client_id);

CREATE INDEX idx_client_pickup_locations_default ON public.client_pickup_locations USING btree (client_id, is_default)
  WHERE (status = 'ACTIVE'::text);

CREATE INDEX idx_client_subscriptions_allowed_environment ON public.client_subscriptions USING btree (allowed_environment);

CREATE INDEX idx_client_users_client_id ON public.client_users USING btree (client_id);

CREATE INDEX idx_client_users_status ON public.client_users USING btree (status);

CREATE INDEX idx_client_users_user_id ON public.client_users USING btree (user_id);

CREATE INDEX idx_deliveries_client_id ON public.deliveries USING btree (client_id);

CREATE INDEX idx_deliveries_order_id ON public.deliveries USING btree (order_id);

CREATE INDEX idx_deliveries_status ON public.deliveries USING btree (delivery_status);

CREATE INDEX idx_deliveries_tracking_number ON public.deliveries USING btree (tracking_number);

CREATE INDEX idx_eo2mate_automation_controls_client ON public.eo2mate_automation_controls USING btree (client_id, scope_type, is_enabled);

CREATE INDEX idx_eo2mate_post_mode_types_mode_active ON public.eo2mate_post_mode_types USING btree (mode_code, is_active, sort_order);

CREATE INDEX idx_eo2mate_post_types_active ON public.eo2mate_post_types USING btree (is_active, sort_order);

CREATE INDEX idx_facebook_oauth_states_client ON public.facebook_oauth_states USING btree (client_id);

CREATE INDEX idx_facebook_oauth_states_token ON public.facebook_oauth_states USING btree (state_token);

CREATE INDEX idx_fb_pages_client_id ON public.fb_pages USING btree (client_id);

CREATE INDEX idx_inventory_import_batches_client_created ON public.inventory_import_batches USING btree (client_id, created_at DESC);

CREATE INDEX idx_inventory_import_rows_batch_status ON public.inventory_import_rows USING btree (inventory_import_batch_id, validation_status, row_no);

CREATE INDEX idx_inventory_item_images_item_order ON public.inventory_item_images USING btree (inventory_item_id, status, display_order);

CREATE INDEX idx_inventory_items_client_status ON public.inventory_items USING btree (client_id, status);

CREATE INDEX idx_inventory_items_name ON public.inventory_items USING btree (client_id, item_name);

CREATE INDEX idx_inventory_items_owner ON public.inventory_items USING btree (inventory_owner_id);

CREATE INDEX idx_inventory_movements_client_created ON public.inventory_movements USING btree (client_id, created_at DESC);

CREATE INDEX idx_inventory_movements_item_created ON public.inventory_movements USING btree (inventory_item_id, created_at DESC);

CREATE INDEX idx_inventory_movements_reference ON public.inventory_movements USING btree (reference_type, reference_id);

CREATE INDEX idx_inventory_owners_client_status ON public.inventory_owners USING btree (client_id, status);

CREATE INDEX idx_inventory_reservations_auction_item ON public.inventory_reservations USING btree (auction_item_id);

CREATE INDEX idx_inventory_reservations_item_status ON public.inventory_reservations USING btree (inventory_item_id, reservation_status_code);

CREATE INDEX idx_inventory_reservations_source ON public.inventory_reservations USING btree (source_reference_type, source_reference_id);

CREATE INDEX idx_messenger_claim_group ON public.messenger_payment_claims USING btree (order_group_id);

CREATE INDEX idx_messenger_payment_claims_token ON public.messenger_payment_claims USING btree (claim_token);

CREATE INDEX idx_messenger_payment_claims_winner ON public.messenger_payment_claims USING btree (bid_winner_id);

CREATE INDEX idx_order_groups_buyer ON public.order_groups USING btree (client_id, buyer_fb_user_id);

CREATE INDEX idx_order_groups_client_buyer_status ON public.order_groups USING btree (client_id, buyer_fb_user_id, group_status);

CREATE INDEX idx_order_groups_environment ON public.order_groups USING btree (environment);

CREATE INDEX idx_order_groups_payment_deadline ON public.order_groups USING btree (payment_deadline_at)
  WHERE (payment_expired_at IS NULL);

CREATE INDEX idx_orders_auction_item_id ON public.orders USING btree (auction_item_id);

CREATE INDEX idx_orders_bid_winner_id ON public.orders USING btree (bid_winner_id);

CREATE INDEX idx_orders_client_id ON public.orders USING btree (client_id);

CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at DESC);

CREATE INDEX idx_orders_order_group_id ON public.orders USING btree (order_group_id);

CREATE INDEX idx_orders_order_status ON public.orders USING btree (order_status);

CREATE INDEX idx_orders_payment_deadline ON public.orders USING btree (payment_deadline_at)
  WHERE (payment_expired_at IS NULL);

CREATE INDEX idx_orders_payment_status ON public.orders USING btree (payment_status);

CREATE INDEX idx_payment_admin_actions_group ON public.payment_admin_actions USING btree (order_group_id, created_at DESC);

CREATE INDEX idx_payment_admin_actions_winner ON public.payment_admin_actions USING btree (bid_winner_id, created_at DESC);

CREATE INDEX idx_payments_auction_item_id ON public.payments USING btree (auction_item_id);

CREATE INDEX idx_payments_bid_winner_id ON public.payments USING btree (bid_winner_id);

CREATE INDEX idx_payments_checkout_session_id ON public.payments USING btree (checkout_session_id);

CREATE INDEX idx_payments_order_group_id ON public.payments USING btree (order_group_id);

CREATE INDEX idx_payments_order_id ON public.payments USING btree (order_id);

CREATE INDEX idx_payments_status ON public.payments USING btree (status);

CREATE INDEX idx_payments_winning_bid_id ON public.payments USING btree (winning_bid_id);

CREATE INDEX idx_webhook_events_fb_page_id ON public.webhook_events USING btree (fb_page_id);

CREATE INDEX idx_webhook_events_received_at ON public.webhook_events USING btree (received_at);

CREATE INDEX idx_webhook_events_status ON public.webhook_events USING btree (processing_status);

CREATE UNIQUE INDEX uq_auction_items_post_fb_object ON public.auction_items USING btree (auction_post_id, fb_object_id)
  WHERE (fb_object_id IS NOT NULL);

CREATE UNIQUE INDEX uq_auction_items_post_item_no ON public.auction_items USING btree (auction_post_id, item_no)
  WHERE (item_no IS NOT NULL);

CREATE UNIQUE INDEX uq_auction_winners_one_pending ON public.auction_winners USING btree (auction_item_id)
  WHERE (status = 'PENDING'::text);

CREATE UNIQUE INDEX uq_client_pickup_locations_default ON public.client_pickup_locations USING btree (client_id)
  WHERE ((is_default = true) AND (status = 'ACTIVE'::text));

CREATE UNIQUE INDEX uq_client_subscriptions_client ON public.client_subscriptions USING btree (client_id);

CREATE UNIQUE INDEX uq_deliveries_order_group ON public.deliveries USING btree (order_group_id)
  WHERE (order_group_id IS NOT NULL);

CREATE UNIQUE INDEX uq_deliveries_order ON public.deliveries USING btree (order_id)
  WHERE (order_id IS NOT NULL);

CREATE UNIQUE INDEX uq_eo2mate_automation_control_scope ON public.eo2mate_automation_controls USING btree (client_id, scope_type, scope_id);

CREATE UNIQUE INDEX uq_eo2mate_command_client ON public.eo2mate_command_aliases USING btree (client_id, upper(command_text))
  WHERE (client_id IS NOT NULL);

CREATE UNIQUE INDEX uq_eo2mate_command_global ON public.eo2mate_command_aliases USING btree (upper(command_text))
  WHERE (client_id IS NULL);

CREATE UNIQUE INDEX uq_eo2mate_post_command_client ON public.eo2mate_post_command_aliases USING btree (client_id, upper(command_text))
  WHERE (client_id IS NOT NULL);

CREATE UNIQUE INDEX uq_eo2mate_post_command_global ON public.eo2mate_post_command_aliases USING btree (upper(command_text))
  WHERE (client_id IS NULL);

CREATE UNIQUE INDEX uq_eo2mate_settings_client ON public.eo2mate_settings USING btree (client_id, setting_key)
  WHERE (client_id IS NOT NULL);

CREATE UNIQUE INDEX uq_eo2mate_settings_global ON public.eo2mate_settings USING btree (setting_key)
  WHERE (client_id IS NULL);

CREATE UNIQUE INDEX uq_messenger_payment_claim_group ON public.messenger_payment_claims USING btree (order_group_id)
  WHERE (order_group_id IS NOT NULL);

CREATE UNIQUE INDEX uq_order_groups_open_buyer_page_env ON public.order_groups USING btree (client_id, fb_page_id, buyer_fb_user_id, environment)
  WHERE ((group_status = 'OPEN'::text) AND (locked_at IS NULL) AND (buyer_fb_user_id IS NOT NULL) AND (fb_page_id IS NOT NULL) AND (environment IS NOT NULL));

CREATE UNIQUE INDEX ux_inventory_item_primary_image ON public.inventory_item_images USING btree (inventory_item_id)
  WHERE ((is_primary = true) AND (status = 'ACTIVE'::text));

CREATE UNIQUE INDEX ux_inventory_owners_default_per_client ON public.inventory_owners USING btree (client_id)
  WHERE (is_default = true);

CREATE TRIGGER trg_deliveries_updated_at
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_deliveries_updated_at();

CREATE TRIGGER trg_eo2mate_environments_updated_at
  BEFORE UPDATE ON public.eo2mate_environments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_eo2mate_environment_updated_at();

CREATE TRIGGER trg_eo2mate_post_mode_types_updated_at
  BEFORE UPDATE ON public.eo2mate_post_mode_types
  FOR EACH ROW
  EXECUTE FUNCTION public.set_eo2mate_reference_updated_at();

CREATE TRIGGER trg_eo2mate_post_modes_updated_at
  BEFORE UPDATE ON public.eo2mate_post_modes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_eo2mate_reference_updated_at();

CREATE TRIGGER trg_eo2mate_post_types_updated_at
  BEFORE UPDATE ON public.eo2mate_post_types
  FOR EACH ROW
  EXECUTE FUNCTION public.set_eo2mate_reference_updated_at();

CREATE TRIGGER trg_inventory_import_batches_updated_at
  BEFORE UPDATE ON public.inventory_import_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.set_inventory_updated_at();

CREATE TRIGGER trg_inventory_import_rows_updated_at
  BEFORE UPDATE ON public.inventory_import_rows
  FOR EACH ROW
  EXECUTE FUNCTION public.set_inventory_updated_at();

CREATE TRIGGER trg_inventory_item_images_updated_at
  BEFORE UPDATE ON public.inventory_item_images
  FOR EACH ROW
  EXECUTE FUNCTION public.set_inventory_updated_at();

CREATE TRIGGER trg_inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_inventory_updated_at();

CREATE TRIGGER trg_inventory_movement_types_updated_at
  BEFORE UPDATE ON public.inventory_movement_types
  FOR EACH ROW
  EXECUTE FUNCTION public.set_inventory_updated_at();

CREATE TRIGGER trg_inventory_owner_types_updated_at
  BEFORE UPDATE ON public.inventory_owner_types
  FOR EACH ROW
  EXECUTE FUNCTION public.set_inventory_updated_at();

CREATE TRIGGER trg_inventory_owners_updated_at
  BEFORE UPDATE ON public.inventory_owners
  FOR EACH ROW
  EXECUTE FUNCTION public.set_inventory_updated_at();

CREATE TRIGGER trg_inventory_reservation_statuses_updated_at
  BEFORE UPDATE ON public.inventory_reservation_statuses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_inventory_updated_at();

CREATE TRIGGER trg_inventory_reservations_updated_at
  BEFORE UPDATE ON public.inventory_reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_inventory_updated_at();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_orders_updated_at();

CREATE POLICY "portal_select_own_audit_log" ON "public"."auction_audit_log"
  FOR SELECT
  TO "authenticated"
  USING (public.user_has_client_access(client_id));

CREATE POLICY "auction_bids_select_own" ON "public"."auction_bids"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM (public.auction_items ai
     JOIN public.auction_posts ap ON ((ap.post_id = ai.auction_post_id)))
  WHERE ((ai.auction_item_id = auction_bids.auction_item_id) AND (ap.client_id = public.current_client_id())))));

CREATE POLICY "portal_select_own_auction_bids" ON "public"."auction_bids"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM (public.auction_items ai
     JOIN public.auction_posts ap ON ((ap.post_id = ai.auction_post_id)))
  WHERE ((ai.auction_item_id = auction_bids.auction_item_id) AND public.user_has_client_access(ap.client_id)))));

CREATE POLICY "auction_items_select_own" ON "public"."auction_items"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.auction_posts ap
  WHERE ((ap.post_id = auction_items.auction_post_id) AND (ap.client_id = public.current_client_id())))));

CREATE POLICY "portal_select_own_auction_items" ON "public"."auction_items"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.auction_posts ap
  WHERE ((ap.post_id = auction_items.auction_post_id) AND public.user_has_client_access(ap.client_id)))));

CREATE POLICY "auction_posts_select_own" ON "public"."auction_posts"
  FOR SELECT
  TO "authenticated"
  USING ((client_id = public.current_client_id()));

CREATE POLICY "portal_select_own_auction_posts" ON "public"."auction_posts"
  FOR SELECT
  TO "authenticated"
  USING (public.user_has_client_access(client_id));

CREATE POLICY "auction_rules_select_own" ON "public"."auction_rules"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM (public.auction_items ai
     JOIN public.auction_posts ap ON ((ap.post_id = ai.auction_post_id)))
  WHERE ((ai.auction_item_id = auction_rules.auction_item_id) AND (ap.client_id = public.current_client_id())))));

CREATE POLICY "portal_select_own_auction_rules" ON "public"."auction_rules"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM (public.auction_items ai
     JOIN public.auction_posts ap ON ((ap.post_id = ai.auction_post_id)))
  WHERE ((ai.auction_item_id = auction_rules.auction_item_id) AND public.user_has_client_access(ap.client_id)))));

CREATE POLICY "portal_update_own_auction_rules" ON "public"."auction_rules"
  FOR UPDATE
  TO "authenticated"
  USING ((public.is_client_admin() AND (EXISTS ( SELECT 1
   FROM (public.auction_items ai
     JOIN public.auction_posts ap ON ((ap.post_id = ai.auction_post_id)))
  WHERE ((ai.auction_item_id = auction_rules.auction_item_id) AND public.user_has_client_access(ap.client_id))))))
  WITH CHECK ((public.is_client_admin() AND (EXISTS ( SELECT 1
   FROM (public.auction_items ai
     JOIN public.auction_posts ap ON ((ap.post_id = ai.auction_post_id)))
  WHERE ((ai.auction_item_id = auction_rules.auction_item_id) AND public.user_has_client_access(ap.client_id))))));

CREATE POLICY "auction_winners_select_own" ON "public"."auction_winners"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM (public.auction_items ai
     JOIN public.auction_posts ap ON ((ap.post_id = ai.auction_post_id)))
  WHERE ((ai.auction_item_id = auction_winners.auction_item_id) AND (ap.client_id = public.current_client_id())))));

CREATE POLICY "portal_select_own_auction_winners" ON "public"."auction_winners"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM (public.auction_items ai
     JOIN public.auction_posts ap ON ((ap.post_id = ai.auction_post_id)))
  WHERE ((ai.auction_item_id = auction_winners.auction_item_id) AND public.user_has_client_access(ap.client_id)))));

CREATE POLICY "client_payment_accounts_select_own" ON "public"."client_payment_accounts"
  FOR SELECT
  TO "authenticated"
  USING (public.user_has_client_access(client_id));

CREATE POLICY "client_pickup_locations_select_own" ON "public"."client_pickup_locations"
  FOR SELECT
  TO "authenticated"
  USING (public.user_has_client_access(client_id));

CREATE POLICY "client_subscriptions_tenant_read" ON "public"."client_subscriptions"
  FOR SELECT
  TO "authenticated"
  USING (public.current_user_has_client_access(client_id));

CREATE POLICY "client_users_select_own" ON "public"."client_users"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = auth.uid()));

CREATE POLICY "client_users_tenant_read" ON "public"."client_users"
  FOR SELECT
  TO "authenticated"
  USING (public.current_user_has_client_access(client_id));

CREATE POLICY "couriers_select_active" ON "public"."couriers"
  FOR SELECT
  TO "authenticated"
  USING ((status = 'ACTIVE'::text));

CREATE POLICY "deliveries_select_own" ON "public"."deliveries"
  FOR SELECT
  TO "authenticated"
  USING ((client_id = public.current_client_id()));

CREATE POLICY "eo2mate_automation_controls_read" ON "public"."eo2mate_automation_controls"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.client_users cu
  WHERE ((cu.client_id = eo2mate_automation_controls.client_id) AND (cu.user_id = auth.uid()) AND (cu.status = 'ACTIVE'::text)))));

CREATE POLICY "eo2mate_command_aliases_read" ON "public"."eo2mate_command_aliases"
  FOR SELECT
  TO "authenticated"
  USING (((client_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.client_users cu
  WHERE ((cu.client_id = eo2mate_command_aliases.client_id) AND (cu.user_id = auth.uid()))))));

CREATE POLICY "eo2mate_command_delete_client_admin" ON "public"."eo2mate_command_aliases"
  FOR DELETE
  TO "authenticated"
  USING (((client_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.client_users cu
  WHERE
    ((cu.client_id = eo2mate_command_aliases.client_id) AND (cu.user_id = auth.uid()) AND (cu.status = 'ACTIVE'::text) AND (upper(COALESCE(cu.role, ''::text)) = ANY
    (ARRAY['ADMIN'::text, 'OWNER'::text, 'SUPER_ADMIN'::text])))))));

CREATE POLICY "eo2mate_command_insert_client_admin" ON "public"."eo2mate_command_aliases"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((client_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.client_users cu
  WHERE
    ((cu.client_id = eo2mate_command_aliases.client_id) AND (cu.user_id = auth.uid()) AND (cu.status = 'ACTIVE'::text) AND (upper(COALESCE(cu.role, ''::text)) = ANY
    (ARRAY['ADMIN'::text, 'OWNER'::text, 'SUPER_ADMIN'::text])))))));

CREATE POLICY "eo2mate_command_update_client_admin" ON "public"."eo2mate_command_aliases"
  FOR UPDATE
  TO "authenticated"
  USING (((client_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.client_users cu
  WHERE
    ((cu.client_id = eo2mate_command_aliases.client_id) AND (cu.user_id = auth.uid()) AND (cu.status = 'ACTIVE'::text) AND (upper(COALESCE(cu.role, ''::text)) = ANY
    (ARRAY['ADMIN'::text, 'OWNER'::text, 'SUPER_ADMIN'::text])))))))
  WITH CHECK (((client_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.client_users cu
  WHERE
    ((cu.client_id = eo2mate_command_aliases.client_id) AND (cu.user_id = auth.uid()) AND (cu.status = 'ACTIVE'::text) AND (upper(COALESCE(cu.role, ''::text)) = ANY
    (ARRAY['ADMIN'::text, 'OWNER'::text, 'SUPER_ADMIN'::text])))))));

CREATE POLICY "eo2mate_post_commands_read" ON "public"."eo2mate_post_command_aliases"
  FOR SELECT
  TO "authenticated"
  USING (((client_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.client_users cu
  WHERE ((cu.client_id = eo2mate_post_command_aliases.client_id) AND (cu.user_id = auth.uid()) AND (cu.status = 'ACTIVE'::text))))));

CREATE POLICY "eo2mate_settings_delete_client_admin" ON "public"."eo2mate_settings"
  FOR DELETE
  TO "authenticated"
  USING (((client_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.client_users cu
  WHERE
    ((cu.client_id = eo2mate_settings.client_id) AND (cu.user_id = auth.uid()) AND (cu.status = 'ACTIVE'::text) AND (upper(COALESCE(cu.role, ''::text)) = ANY (ARRAY['ADMIN'::text,
    'OWNER'::text, 'SUPER_ADMIN'::text])))))));

CREATE POLICY "eo2mate_settings_insert_client_admin" ON "public"."eo2mate_settings"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((client_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.client_users cu
  WHERE
    ((cu.client_id = eo2mate_settings.client_id) AND (cu.user_id = auth.uid()) AND (cu.status = 'ACTIVE'::text) AND (upper(COALESCE(cu.role, ''::text)) = ANY (ARRAY['ADMIN'::text,
    'OWNER'::text, 'SUPER_ADMIN'::text])))))));

CREATE POLICY "eo2mate_settings_read" ON "public"."eo2mate_settings"
  FOR SELECT
  TO "authenticated"
  USING (((client_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.client_users cu
  WHERE ((cu.client_id = eo2mate_settings.client_id) AND (cu.user_id = auth.uid()))))));

CREATE POLICY "eo2mate_settings_update_client_admin" ON "public"."eo2mate_settings"
  FOR UPDATE
  TO "authenticated"
  USING (((client_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.client_users cu
  WHERE
    ((cu.client_id = eo2mate_settings.client_id) AND (cu.user_id = auth.uid()) AND (cu.status = 'ACTIVE'::text) AND (upper(COALESCE(cu.role, ''::text)) = ANY (ARRAY['ADMIN'::text,
    'OWNER'::text, 'SUPER_ADMIN'::text])))))))
  WITH CHECK (((client_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.client_users cu
  WHERE
    ((cu.client_id = eo2mate_settings.client_id) AND (cu.user_id = auth.uid()) AND (cu.status = 'ACTIVE'::text) AND (upper(COALESCE(cu.role, ''::text)) = ANY (ARRAY['ADMIN'::text,
    'OWNER'::text, 'SUPER_ADMIN'::text])))))));

CREATE POLICY "fb_pages_select_own" ON "public"."fb_pages"
  FOR SELECT
  TO "authenticated"
  USING ((client_id = public.current_client_id()));

CREATE POLICY "fb_pages_tenant_read" ON "public"."fb_pages"
  FOR SELECT
  TO "authenticated"
  USING (public.current_user_has_client_access(client_id));

CREATE POLICY "master_clients_select_own" ON "public"."master_clients"
  FOR SELECT
  TO "authenticated"
  USING ((client_id = public.current_client_id()));

CREATE POLICY "master_clients_tenant_read" ON "public"."master_clients"
  FOR SELECT
  TO "authenticated"
  USING (public.current_user_has_client_access(client_id));

CREATE POLICY "portal_select_own_client" ON "public"."master_clients"
  FOR SELECT
  TO "authenticated"
  USING (public.user_has_client_access(client_id));

CREATE POLICY "portal_select_own_payment_claims" ON "public"."messenger_payment_claims"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM ((public.auction_winners aw
     JOIN public.auction_items ai ON ((ai.auction_item_id = aw.auction_item_id)))
     JOIN public.auction_posts ap ON ((ap.post_id = ai.auction_post_id)))
  WHERE ((aw.bid_winner_id = messenger_payment_claims.bid_winner_id) AND public.user_has_client_access(ap.client_id)))));

CREATE POLICY "order_groups_select_own" ON "public"."order_groups"
  FOR SELECT
  TO "authenticated"
  USING (public.user_has_client_access(client_id));

CREATE POLICY "orders_select_own" ON "public"."orders"
  FOR SELECT
  TO "authenticated"
  USING ((client_id = public.current_client_id()));

CREATE POLICY "payments_select_own" ON "public"."payments"
  FOR SELECT
  TO "authenticated"
  USING ((((order_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.order_id = payments.order_id) AND public.user_has_client_access(o.client_id))))) OR ((order_group_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.order_groups og
  WHERE ((og.order_group_id = payments.order_group_id) AND public.user_has_client_access(og.client_id))))) OR ((auction_item_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (public.auction_items ai
     JOIN public.auction_posts ap ON ((ap.post_id = ai.auction_post_id)))
  WHERE ((ai.auction_item_id = payments.auction_item_id) AND public.user_has_client_access(ap.client_id)))))));

CREATE POLICY "platform_admins_self_read" ON "public"."platform_admins"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = auth.uid()));

COMMENT ON COLUMN "public"."auction_items"."min_bidder_reached_at" IS 'Timestamp when the auction first reached the required minimum number of unique bidders';

COMMENT ON COLUMN "public"."auction_rules"."anti_sniper_minutes" IS 'Number of minutes used for anti-sniper auction extension. Zero disables anti-sniper.';

COMMENT ON EXTENSION "pg_cron" IS 'Job scheduler for PostgreSQL';

COMMENT ON EXTENSION "pg_net" IS 'Async HTTP';

GRANT EXECUTE ON FUNCTION "public"."attach_order_to_open_group"(uuid) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."current_client_id"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."current_client_role"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."current_user_has_client_access"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."current_user_has_client_access"(uuid) TO "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE
  ON FUNCTION "public"."finalize_order_group"(uuid, text, text, text, text, text, text, text, text, text, numeric)
  TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."generate_order_group_number"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."generate_order_number"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."is_client_admin"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

REVOKE ALL ON FUNCTION "public"."is_platform_admin"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."is_platform_admin"() TO "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."recalculate_order_group"(uuid) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."set_deliveries_updated_at"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."set_eo2mate_environment_updated_at"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."set_eo2mate_reference_updated_at"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."set_inventory_updated_at"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."set_order_group_checkout_choice"(uuid, text) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."set_orders_updated_at"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE
  ON FUNCTION "public"."update_order_shipping"(uuid, text, text, text, text, text, text, text, text, text)
  TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."user_has_client_access"(uuid) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."auction_audit_log" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."auction_bids" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."auction_items" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."auction_posts" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."auction_rules" TO "anon";

REVOKE ALL ("auction_end_dt") ON TABLE "public"."auction_rules" FROM "authenticated";

GRANT UPDATE ("auction_end_dt") ON TABLE "public"."auction_rules" TO "authenticated";

REVOKE ALL ("bid_buyout_amt") ON TABLE "public"."auction_rules" FROM "authenticated";

GRANT UPDATE ("bid_buyout_amt") ON TABLE "public"."auction_rules" TO "authenticated";

REVOKE ALL ("bid_cutoff_minutes") ON TABLE "public"."auction_rules" FROM "authenticated";

GRANT UPDATE ("bid_cutoff_minutes") ON TABLE "public"."auction_rules" TO "authenticated";

REVOKE ALL ("bid_increment") ON TABLE "public"."auction_rules" FROM "authenticated";

GRANT UPDATE ("bid_increment") ON TABLE "public"."auction_rules" TO "authenticated";

REVOKE ALL ("buyout_dt_limit") ON TABLE "public"."auction_rules" FROM "authenticated";

GRANT UPDATE ("buyout_dt_limit") ON TABLE "public"."auction_rules" TO "authenticated";

REVOKE ALL ("min_bidder_count") ON TABLE "public"."auction_rules" FROM "authenticated";

GRANT UPDATE ("min_bidder_count") ON TABLE "public"."auction_rules" TO "authenticated";

REVOKE ALL ("min_bid") ON TABLE "public"."auction_rules" FROM "authenticated";

GRANT UPDATE ("min_bid") ON TABLE "public"."auction_rules" TO "authenticated";

REVOKE ALL ("rule_name") ON TABLE "public"."auction_rules" FROM "authenticated";

GRANT UPDATE ("rule_name") ON TABLE "public"."auction_rules" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."auction_rules" TO "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."auction_winners" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."buyer_checkout_sessions" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."client_payment_accounts" TO "anon";

REVOKE ALL ON TABLE "public"."client_payment_accounts" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."client_payment_accounts" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."client_payment_accounts" TO "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."client_pickup_locations" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."client_subscriptions" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."client_users" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."couriers" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."deliveries" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."eo2mate_automation_controls" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."eo2mate_command_aliases" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."eo2mate_environments" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
  ON TABLE "public"."eo2mate_post_command_aliases"
  TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."eo2mate_post_mode_types" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."eo2mate_post_modes" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."eo2mate_post_types" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."eo2mate_settings" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."facebook_oauth_states" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."fb_pages" TO "anon";

REVOKE ALL ON TABLE "public"."fb_pages" FROM "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."fb_pages" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."fb_pages" TO "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."inventory_import_batches" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."inventory_import_rows" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."inventory_import_statuses" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."inventory_item_images" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."inventory_items" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."inventory_movement_types" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."inventory_movements" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."inventory_owner_types" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."inventory_owners" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
  ON TABLE "public"."inventory_reservation_statuses"
  TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."inventory_reservations" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."master_clients" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."messenger_payment_claims" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."order_groups" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."orders" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."payment_admin_actions" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."payments" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."platform_admins" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."webhook_events" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."client_auction_bid_history" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."client_auction_dashboard" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."client_auction_detail" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."client_auction_list" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."client_delivery_summary" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."client_order_summary" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."client_payment_summary" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."inventory_items_with_stock" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."inventory_stock_balances" TO "anon", "authenticated", "postgres", "service_role";

SELECT cron.schedule_in_database('auction-finalizer-every-minute', '* * * * *', '
  select net.http_post(
    url :=
      (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = ''auction_project_url''
      )
      || ''/functions/v1/meta-webhook?action=finalize'',

    headers :=
      jsonb_build_object(
        ''Content-Type'',
        ''application/json'',
        ''Authorization'',
        ''Bearer '' ||
        (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = ''auction_finalizer_secret''
        )
      ),

    body :=
      jsonb_build_object(
        ''trigger'',
        ''auction_cron'',
        ''time'',
        now()
      ),

    timeout_milliseconds :=
      10000
  ) as request_id;
  ', 'postgres', NULL, true);

ALTER TABLE "public"."order_groups"
  ADD COLUMN "group_number" text NOT NULL DEFAULT public.generate_order_group_number();

ALTER TABLE "public"."order_groups"
  ADD CONSTRAINT "order_groups_group_number_key" UNIQUE (group_number);

CREATE VIEW "public"."client_order_group_list" WITH (security_invoker=true) AS  SELECT og.client_id,
    og.order_group_id,
    og.group_number,
    og.buyer_fb_user_id,
    og.buyer_name,
    og.group_status,
    count(o.order_id) AS item_count,
    og.subtotal,
    og.shipping_fee,
    og.total_amount,
    og.preferred_courier_code,
    og.shipping_name,
    og.shipping_phone,
    og.shipping_city,
    og.shipping_province,
    og.shipping_postal_code,
    og.shipping_country,
    og.created_at,
    og.updated_at
   FROM (public.order_groups og
     LEFT JOIN public.orders o ON ((o.order_group_id = og.order_group_id)))
  GROUP BY og.client_id, og.order_group_id, og.group_number, og.buyer_fb_user_id, og.buyer_name, og.group_status, og.subtotal, og.shipping_fee, og.total_amount, og.preferred_courier_code, og.shipping_name, og.shipping_phone, og.shipping_city, og.shipping_province, og.shipping_postal_code, og.shipping_country, og.created_at, og.updated_at;

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."client_order_group_list" TO "anon", "authenticated", "postgres", "service_role";

ALTER TABLE "public"."orders"
  ADD COLUMN "order_number" text NOT NULL DEFAULT public.generate_order_number();

ALTER TABLE "public"."orders"
  ADD CONSTRAINT "orders_order_number_key" UNIQUE (order_number);

CREATE VIEW "public"."client_delivery_detail" WITH (security_invoker=true) AS  SELECT d.delivery_id,
    d.order_id,
    d.client_id,
    d.courier_code,
    d.courier_name,
    d.tracking_number,
    d.delivery_status,
    d.shipping_fee,
    d.recipient_name,
    d.recipient_phone,
    d.address_line1,
    d.address_line2,
    d.city,
    d.province,
    d.postal_code,
    d.country,
    d.booking_reference,
    d.booked_at,
    d.picked_up_at,
    d.shipped_at,
    d.delivered_at,
    d.failed_at,
    d.cancelled_at,
    d.created_at,
    d.updated_at,
    d.order_group_id,
    d.courier_status,
    d.tracking_url,
    d.courier_payload,
    d.courier_response,
    d.last_tracking_sync_at,
    d.booking_error,
    o.order_number,
    og.group_number,
        CASE
            WHEN (d.order_group_id IS NOT NULL) THEN 'Consolidated shipment'::text
            ELSE ai.item_label
        END AS item_label,
    COALESCE(og.buyer_name, o.buyer_name) AS buyer_name,
    COALESCE(og.total_amount, o.total_amount) AS total_amount,
    o.order_status,
        CASE
            WHEN (d.order_group_id IS NOT NULL) THEN og.group_status
            ELSE o.order_status
        END AS parent_status,
    p.payment_id,
    p.provider,
    p.status AS latest_payment_status,
    p.amount AS payment_amount,
    p.paid_at AS payment_paid_at
   FROM ((((public.deliveries d
     LEFT JOIN public.orders o ON ((o.order_id = d.order_id)))
     LEFT JOIN public.auction_items ai ON ((ai.auction_item_id = o.auction_item_id)))
     LEFT JOIN public.order_groups og ON ((og.order_group_id = d.order_group_id)))
     LEFT JOIN LATERAL ( SELECT p1.payment_id,
            p1.auction_item_id,
            p1.bid_winner_id,
            p1.winning_bid_id,
            p1.amount,
            p1.currency,
            p1.provider,
            p1.status,
            p1.checkout_session_id,
            p1.payment_reference,
            p1.checkout_url,
            p1.paid_at,
            p1.created_at,
            p1.updated_at,
            p1.order_id,
            p1.order_group_id
           FROM public.payments p1
          WHERE (((d.order_id IS NOT NULL) AND (p1.order_id = d.order_id)) OR ((d.order_group_id IS NOT NULL) AND (p1.order_group_id = d.order_group_id)))
          ORDER BY p1.created_at DESC
         LIMIT 1) p ON (true));

CREATE VIEW "public"."client_delivery_list" WITH (security_invoker=true) AS  SELECT d.client_id,
    d.delivery_id,
    d.order_id,
    d.order_group_id,
    o.order_number,
    og.group_number,
        CASE
            WHEN (d.order_group_id IS NOT NULL) THEN 'Consolidated shipment'::text
            ELSE ai.item_label
        END AS item_label,
    COALESCE(og.buyer_name, o.buyer_name) AS buyer_name,
    d.delivery_status,
    d.courier_code,
    d.courier_name,
    d.courier_status,
    d.tracking_number,
    d.tracking_url,
    d.booking_reference,
    d.shipping_fee,
    d.recipient_name,
    d.recipient_phone,
    d.city,
    d.province,
    d.postal_code,
    d.country,
    d.booked_at,
    d.picked_up_at,
    d.shipped_at,
    d.delivered_at,
    d.failed_at,
    d.cancelled_at,
    d.created_at,
    d.updated_at
   FROM (((public.deliveries d
     LEFT JOIN public.orders o ON ((o.order_id = d.order_id)))
     LEFT JOIN public.auction_items ai ON ((ai.auction_item_id = o.auction_item_id)))
     LEFT JOIN public.order_groups og ON ((og.order_group_id = d.order_group_id)));

CREATE VIEW "public"."client_order_detail" WITH (security_invoker=true) AS  SELECT o.order_id,
    o.client_id,
    o.bid_winner_id,
    o.auction_item_id,
    o.order_number,
    o.source_type,
    o.order_status,
    o.payment_status,
    o.subtotal,
    o.shipping_fee,
    o.total_amount,
    o.currency,
    o.buyer_fb_user_id,
    o.buyer_name,
    o.buyer_phone,
    o.buyer_email,
    o.shipping_name,
    o.shipping_phone,
    o.shipping_address_line1,
    o.shipping_address_line2,
    o.shipping_city,
    o.shipping_province,
    o.shipping_postal_code,
    o.shipping_country,
    o.notes,
    o.paid_at,
    o.ready_for_delivery_at,
    o.completed_at,
    o.cancelled_at,
    o.created_at,
    o.updated_at,
    ai.item_label,
    aw.winning_amt,
    aw.won_at,
    ab.fb_user_name AS winning_bidder_name,
    ab.fb_user_id AS winning_bidder_id,
    ab.fb_comment_id AS winning_comment_id,
    ap.fb_post_id,
    ap.post_type,
    p.payment_id,
    p.provider,
    p.status AS latest_payment_status,
    p.amount AS payment_amount,
    p.checkout_session_id,
    p.checkout_url,
    p.payment_reference,
    p.paid_at AS payment_paid_at,
    p.created_at AS payment_created_at,
    p.updated_at AS payment_updated_at
   FROM (((((public.orders o
     JOIN public.auction_items ai ON ((ai.auction_item_id = o.auction_item_id)))
     JOIN public.auction_winners aw ON ((aw.bid_winner_id = o.bid_winner_id)))
     JOIN public.auction_bids ab ON ((ab.bid_id = aw.bid_id)))
     JOIN public.auction_posts ap ON ((ap.post_id = ai.auction_post_id)))
     LEFT JOIN LATERAL ( SELECT p1.payment_id,
            p1.auction_item_id,
            p1.bid_winner_id,
            p1.winning_bid_id,
            p1.amount,
            p1.currency,
            p1.provider,
            p1.status,
            p1.checkout_session_id,
            p1.payment_reference,
            p1.checkout_url,
            p1.paid_at,
            p1.created_at,
            p1.updated_at,
            p1.order_id
           FROM public.payments p1
          WHERE (p1.order_id = o.order_id)
          ORDER BY p1.created_at DESC
         LIMIT 1) p ON (true));

CREATE VIEW "public"."client_order_list" WITH (security_invoker=true) AS  SELECT o.client_id,
    o.order_id,
    o.order_number,
    o.bid_winner_id,
    o.auction_item_id,
    ai.item_label,
    o.source_type,
    o.order_status,
    o.payment_status,
    o.subtotal,
    o.shipping_fee,
    o.total_amount,
    o.currency,
    o.buyer_fb_user_id,
    o.buyer_name,
    o.buyer_phone,
    o.buyer_email,
    o.shipping_name,
    o.shipping_phone,
    o.shipping_city,
    o.shipping_province,
    o.shipping_country,
    o.paid_at,
    o.ready_for_delivery_at,
    o.completed_at,
    o.cancelled_at,
    o.created_at,
    o.updated_at,
    p.payment_id,
    p.provider,
    p.status AS latest_payment_status,
    p.checkout_url,
    p.payment_reference,
    p.paid_at AS payment_paid_at
   FROM ((public.orders o
     JOIN public.auction_items ai ON ((ai.auction_item_id = o.auction_item_id)))
     LEFT JOIN LATERAL ( SELECT p1.payment_id,
            p1.auction_item_id,
            p1.bid_winner_id,
            p1.winning_bid_id,
            p1.amount,
            p1.currency,
            p1.provider,
            p1.status,
            p1.checkout_session_id,
            p1.payment_reference,
            p1.checkout_url,
            p1.paid_at,
            p1.created_at,
            p1.updated_at,
            p1.order_id
           FROM public.payments p1
          WHERE (p1.order_id = o.order_id)
          ORDER BY p1.created_at DESC
         LIMIT 1) p ON (true));

CREATE VIEW "public"."client_payment_detail" WITH (security_invoker=true) AS  SELECT p.payment_id,
    p.order_id,
    o.client_id,
    o.order_number,
    o.order_status,
    o.bid_winner_id,
    o.auction_item_id,
    ai.item_label,
    o.buyer_name,
    o.buyer_fb_user_id,
    o.buyer_phone,
    o.buyer_email,
    p.amount,
    p.currency,
    p.provider,
    p.status AS payment_status,
    p.checkout_session_id,
    p.payment_reference,
    p.checkout_url,
    p.paid_at,
    p.created_at,
    p.updated_at,
    aw.winning_amt,
    aw.won_at,
    ap.fb_post_id
   FROM ((((public.payments p
     JOIN public.orders o ON ((o.order_id = p.order_id)))
     JOIN public.auction_items ai ON ((ai.auction_item_id = o.auction_item_id)))
     JOIN public.auction_winners aw ON ((aw.bid_winner_id = o.bid_winner_id)))
     JOIN public.auction_posts ap ON ((ap.post_id = ai.auction_post_id)));

CREATE VIEW "public"."client_payment_list" WITH (security_invoker=true) AS  SELECT o.client_id,
    p.payment_id,
    p.order_id,
    o.order_number,
    o.auction_item_id,
    ai.item_label,
    o.buyer_name,
    p.amount,
    p.currency,
    p.provider,
    p.status AS payment_status,
    p.checkout_session_id,
    p.payment_reference,
    p.checkout_url,
    p.paid_at,
    p.created_at,
    p.updated_at,
    o.order_status
   FROM ((public.payments p
     JOIN public.orders o ON ((o.order_id = p.order_id)))
     JOIN public.auction_items ai ON ((ai.auction_item_id = o.auction_item_id)));

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."client_delivery_detail" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."client_delivery_list" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."client_order_detail" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."client_order_list" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."client_payment_detail" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."client_payment_list" TO "anon", "authenticated", "postgres", "service_role";

