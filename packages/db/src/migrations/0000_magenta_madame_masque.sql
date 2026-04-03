CREATE TYPE "public"."autopilot_mode" AS ENUM('full_auto', 'suggest_only', 'approve_required');--> statement-breakpoint
CREATE TYPE "public"."competitor_scan_frequency" AS ENUM('every_30min', 'hourly', 'every_4h');--> statement-breakpoint
CREATE TYPE "public"."decision_status" AS ENUM('executed', 'pending_approval', 'approved', 'rejected', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."decision_type" AS ENUM('budget_adjust', 'campaign_pause', 'campaign_resume', 'creative_rotate', 'campaign_create', 'targeting_change', 'strategy_insight');--> statement-breakpoint
CREATE TYPE "public"."optimization_frequency" AS ENUM('hourly', 'every_4h', 'daily');--> statement-breakpoint
CREATE TYPE "public"."risk_tolerance" AS ENUM('conservative', 'moderate', 'aggressive');--> statement-breakpoint
CREATE TYPE "public"."approval_request_type" AS ENUM('campaign_create', 'campaign_edit', 'budget_change', 'creative_deploy', 'rule_change');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."rule_execution_status" AS ENUM('success', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."alert_severity" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."alert_type" AS ENUM('impression_share_drop', 'new_competitor', 'creative_surge', 'bid_war', 'competitor_pause', 'seasonal_attack', 'market_shift');--> statement-breakpoint
CREATE TYPE "public"."counter_action_status" AS ENUM('proposed', 'executing', 'executed', 'rolled_back', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."counter_action_type" AS ENUM('bid_adjust', 'budget_shift', 'creative_counter', 'targeting_expand', 'keyword_defense', 'timing_attack', 'do_nothing');--> statement-breakpoint
CREATE TYPE "public"."attribution_model" AS ENUM('markov', 'shapley', 'linear', 'last_click', 'first_click');--> statement-breakpoint
CREATE TYPE "public"."campaign_objective" AS ENUM('awareness', 'traffic', 'engagement', 'leads', 'conversion', 'retargeting');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'active', 'paused', 'completed', 'error');--> statement-breakpoint
CREATE TYPE "public"."counter_strategy" AS ENUM('aggressive', 'defensive', 'opportunistic');--> statement-breakpoint
CREATE TYPE "public"."creative_type" AS ENUM('text', 'image', 'video', 'carousel');--> statement-breakpoint
CREATE TYPE "public"."funnel_status" AS ENUM('draft', 'active', 'paused');--> statement-breakpoint
CREATE TYPE "public"."plan_tier" AS ENUM('starter', 'pro', 'business', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('meta', 'google', 'x', 'tiktok', 'line_yahoo', 'amazon', 'microsoft');--> statement-breakpoint
CREATE TYPE "public"."platform_status" AS ENUM('active', 'expired', 'revoked', 'error');--> statement-breakpoint
CREATE TYPE "public"."touchpoint_type" AS ENUM('impression', 'click', 'view', 'conversion');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'admin', 'manager', 'analyst', 'creative');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('dashboard', 'email', 'slack', 'line');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('alert', 'info', 'success', 'warning');--> statement-breakpoint
CREATE TABLE "account_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"platform_connection_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"account_id" text NOT NULL,
	"account_name" text NOT NULL,
	"summary" jsonb NOT NULL,
	"existing_campaigns" jsonb NOT NULL,
	"spending_pattern" jsonb NOT NULL,
	"performance_diagnosis" jsonb NOT NULL,
	"improvements" jsonb NOT NULL,
	"risks" jsonb NOT NULL,
	"overall_score" real NOT NULL,
	"ai_summary" text NOT NULL,
	"analyzed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_decision_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"decision_type" "decision_type" NOT NULL,
	"campaign_id" uuid,
	"reasoning" text NOT NULL,
	"recommendation" jsonb NOT NULL,
	"action" jsonb,
	"status" "decision_status" NOT NULL,
	"confidence_score" real NOT NULL,
	"result_before" jsonb,
	"result_after" jsonb,
	"executed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"claude_api_key_encrypted" text,
	"autopilot_enabled" boolean DEFAULT false NOT NULL,
	"autopilot_mode" "autopilot_mode" DEFAULT 'suggest_only' NOT NULL,
	"optimization_frequency" "optimization_frequency" DEFAULT 'daily' NOT NULL,
	"budget_auto_adjust" boolean DEFAULT true NOT NULL,
	"max_budget_change_percent" integer DEFAULT 20 NOT NULL,
	"creative_auto_rotate" boolean DEFAULT true NOT NULL,
	"campaign_auto_create" boolean DEFAULT false NOT NULL,
	"risk_tolerance" "risk_tolerance" DEFAULT 'moderate' NOT NULL,
	"target_roas" real,
	"monthly_budget_cap" numeric(14, 2),
	"competitive_monitor_enabled" boolean DEFAULT false NOT NULL,
	"auto_counter_enabled" boolean DEFAULT false NOT NULL,
	"default_counter_strategy" "counter_strategy" DEFAULT 'defensive' NOT NULL,
	"competitor_scan_frequency" "competitor_scan_frequency" DEFAULT 'hourly' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_settings_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "approval_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"entity_type" text NOT NULL,
	"conditions" jsonb NOT NULL,
	"required_approvers" integer DEFAULT 1 NOT NULL,
	"approver_roles" text[] DEFAULT '{}'::text[] NOT NULL,
	"auto_approve_below" numeric(14, 2),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"requester_id" uuid NOT NULL,
	"approver_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"type" "approval_request_type" NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"changes" jsonb NOT NULL,
	"reason" text,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"rejected_by" uuid,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"comments" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attribution_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"model_type" "attribution_model" NOT NULL,
	"period" jsonb NOT NULL,
	"channel_credits" jsonb NOT NULL,
	"computed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attribution_touchpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visitor_id" text NOT NULL,
	"organization_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"campaign_id" uuid NOT NULL,
	"touchpoint_type" "touchpoint_type" NOT NULL,
	"timestamp" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audience_overlaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audience_a_id" uuid NOT NULL,
	"audience_b_id" uuid NOT NULL,
	"overlap_percentage" real NOT NULL,
	"computed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"platform" "platform" NOT NULL,
	"external_audience_id" text,
	"size" integer NOT NULL,
	"segment_definition" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"old_value" jsonb,
	"new_value" jsonb,
	"ip_address" text,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_rule_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"campaign_id" text,
	"condition_snapshot" jsonb NOT NULL,
	"actions_executed" jsonb NOT NULL,
	"status" "rule_execution_status" NOT NULL,
	"error_message" text,
	"executed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"conditions" jsonb NOT NULL,
	"actions" jsonb NOT NULL,
	"cooldown_minutes" integer DEFAULT 60 NOT NULL,
	"last_triggered_at" timestamp with time zone,
	"trigger_count" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"date" date NOT NULL,
	"allocations" jsonb NOT NULL,
	"total_budget" numeric(14, 2) NOT NULL,
	"predicted_roas" real,
	"actual_roas" real,
	"algorithm_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"name" text NOT NULL,
	"platform" "platform" NOT NULL,
	"external_ad_group_id" text,
	"targeting_config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ad_group_id" uuid NOT NULL,
	"creative_id" uuid,
	"name" text NOT NULL,
	"platform" "platform" NOT NULL,
	"external_ad_id" text,
	"status" "campaign_status" NOT NULL,
	"platform_specific_config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_platform_deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"external_campaign_id" text,
	"platform_status" text NOT NULL,
	"platform_budget" numeric(14, 2) NOT NULL,
	"last_sync_at" timestamp with time zone,
	"platform_specific_config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"objective" "campaign_objective" NOT NULL,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"total_budget" numeric(14, 2) NOT NULL,
	"daily_budget" numeric(14, 2) NOT NULL,
	"funnel_id" uuid,
	"target_roas" real,
	"target_cpa" numeric(14, 2),
	"bid_strategy" text,
	"landing_page_url" text,
	"conversion_endpoint_id" uuid,
	"targeting_config" jsonb,
	"kpi_alerts" jsonb,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auction_insight_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"campaign_id" uuid,
	"platform" "platform" NOT NULL,
	"snapshot_date" date NOT NULL,
	"impression_share" real NOT NULL,
	"top_of_page_rate" real,
	"overlap_rate" real,
	"position_above_rate" real,
	"outranking_share" real,
	"avg_cpc" real,
	"competitor_domain" text,
	"raw_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitor_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"competitor_id" uuid,
	"alert_type" "alert_type" NOT NULL,
	"severity" "alert_severity" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"data" jsonb NOT NULL,
	"counter_action_id" uuid,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitor_creatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"competitor_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"external_ad_id" text,
	"headline" text,
	"body_text" text,
	"image_url" text,
	"video_url" text,
	"start_date" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"themes" text[],
	"sentiment" text,
	"estimated_spend" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitor_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"platforms" text[] DEFAULT ARRAY['google','meta']::text[] NOT NULL,
	"keywords" text[] DEFAULT '{}'::text[] NOT NULL,
	"meta_page_ids" text[],
	"auto_counter_enabled" boolean DEFAULT true NOT NULL,
	"counter_strategy" "counter_strategy" DEFAULT 'defensive' NOT NULL,
	"max_bid_increase_percent" integer DEFAULT 15 NOT NULL,
	"max_budget_shift_percent" integer DEFAULT 20 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "counter_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"alert_id" uuid,
	"competitor_id" uuid,
	"action_type" "counter_action_type" NOT NULL,
	"strategy" "counter_strategy" NOT NULL,
	"campaign_id" uuid,
	"details" jsonb NOT NULL,
	"reasoning" text NOT NULL,
	"confidence_score" real NOT NULL,
	"status" "counter_action_status" DEFAULT 'proposed' NOT NULL,
	"result_before" jsonb,
	"result_after" jsonb,
	"rolled_back_at" timestamp with time zone,
	"rollback_reason" text,
	"executed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversion_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"pixel_id" text NOT NULL,
	"secret_key" text NOT NULL,
	"allowed_domains" text[] DEFAULT '{}'::text[] NOT NULL,
	"event_types" text[] DEFAULT '{}'::text[] NOT NULL,
	"platform_mappings" jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversion_endpoints_pixel_id_unique" UNIQUE("pixel_id")
);
--> statement-breakpoint
CREATE TABLE "conversion_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_name" text NOT NULL,
	"event_value" numeric(14, 2),
	"currency" text DEFAULT 'JPY' NOT NULL,
	"source_url" text,
	"user_agent" text,
	"ip_address" text,
	"hashed_email" text,
	"hashed_phone" text,
	"external_click_id" text,
	"platform" "platform",
	"campaign_id" uuid,
	"metadata" jsonb,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creative_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creative_id" uuid NOT NULL,
	"embedding" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "creative_embeddings_creative_id_unique" UNIQUE("creative_id")
);
--> statement-breakpoint
CREATE TABLE "creative_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creative_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"adapted_content" jsonb NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"format" text NOT NULL,
	"file_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"type" "creative_type" NOT NULL,
	"base_content" jsonb NOT NULL,
	"ai_generated" boolean DEFAULT false NOT NULL,
	"prompt_used" text,
	"model_used" text,
	"performance_score" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funnel_stage_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"funnel_id" uuid NOT NULL,
	"stage_index" integer NOT NULL,
	"campaign_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funnels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"stages" jsonb NOT NULL,
	"status" "funnel_status" DEFAULT 'draft' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"plan" "plan_tier" NOT NULL,
	"billing_email" text NOT NULL,
	"stripe_customer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" NOT NULL,
	"avatar_url" text,
	"password_hash" text NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "platform_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"platform_account_id" text NOT NULL,
	"platform_account_name" text NOT NULL,
	"status" "platform_status" DEFAULT 'active' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrics_daily" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"campaign_id" uuid NOT NULL,
	"ad_group_id" uuid,
	"ad_id" uuid,
	"platform" "platform" NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"spend" numeric(14, 2) DEFAULT '0' NOT NULL,
	"revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	"ctr" real DEFAULT 0 NOT NULL,
	"cpc" real DEFAULT 0 NOT NULL,
	"cpa" real DEFAULT 0 NOT NULL,
	"roas" real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrics_hourly" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"campaign_id" uuid NOT NULL,
	"ad_group_id" uuid,
	"ad_id" uuid,
	"platform" "platform" NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"spend" numeric(14, 2) DEFAULT '0' NOT NULL,
	"revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	"ctr" real DEFAULT 0 NOT NULL,
	"cpc" real DEFAULT 0 NOT NULL,
	"cpa" real DEFAULT 0 NOT NULL,
	"roas" real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"critical_only" boolean DEFAULT false NOT NULL,
	"webhook_url" text
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"action_url" text,
	"read" boolean DEFAULT false NOT NULL,
	"source" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cohort_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"cohort_month" text NOT NULL,
	"platform" "platform",
	"customers_acquired" integer DEFAULT 0 NOT NULL,
	"total_acquisition_cost" numeric(14, 2) DEFAULT '0' NOT NULL,
	"cac" numeric(14, 2) DEFAULT '0' NOT NULL,
	"avg_ltv" numeric(14, 2) DEFAULT '0' NOT NULL,
	"ltv_cac_ratio" real DEFAULT 0 NOT NULL,
	"retention_rates" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"hashed_identifier" text NOT NULL,
	"first_conversion_at" timestamp with time zone NOT NULL,
	"last_conversion_at" timestamp with time zone NOT NULL,
	"total_conversions" integer DEFAULT 1 NOT NULL,
	"total_revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	"acquisition_campaign_id" uuid,
	"acquisition_platform" "platform",
	"acquisition_cost" numeric(14, 2),
	"ltv" numeric(14, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_analyses" ADD CONSTRAINT "account_analyses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_analyses" ADD CONSTRAINT "account_analyses_platform_connection_id_platform_connections_id_fk" FOREIGN KEY ("platform_connection_id") REFERENCES "public"."platform_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_decision_log" ADD CONSTRAINT "ai_decision_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_decision_log" ADD CONSTRAINT "ai_decision_log_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_policies" ADD CONSTRAINT "approval_policies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribution_results" ADD CONSTRAINT "attribution_results_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribution_touchpoints" ADD CONSTRAINT "attribution_touchpoints_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribution_touchpoints" ADD CONSTRAINT "attribution_touchpoints_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audience_overlaps" ADD CONSTRAINT "audience_overlaps_audience_a_id_audiences_id_fk" FOREIGN KEY ("audience_a_id") REFERENCES "public"."audiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audience_overlaps" ADD CONSTRAINT "audience_overlaps_audience_b_id_audiences_id_fk" FOREIGN KEY ("audience_b_id") REFERENCES "public"."audiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audiences" ADD CONSTRAINT "audiences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rule_executions" ADD CONSTRAINT "automation_rule_executions_rule_id_automation_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."automation_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rule_executions" ADD CONSTRAINT "automation_rule_executions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_allocations" ADD CONSTRAINT "budget_allocations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_groups" ADD CONSTRAINT "ad_groups_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ads" ADD CONSTRAINT "ads_ad_group_id_ad_groups_id_fk" FOREIGN KEY ("ad_group_id") REFERENCES "public"."ad_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ads" ADD CONSTRAINT "ads_creative_id_creatives_id_fk" FOREIGN KEY ("creative_id") REFERENCES "public"."creatives"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_platform_deployments" ADD CONSTRAINT "campaign_platform_deployments_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_funnel_id_funnels_id_fk" FOREIGN KEY ("funnel_id") REFERENCES "public"."funnels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_conversion_endpoint_id_conversion_endpoints_id_fk" FOREIGN KEY ("conversion_endpoint_id") REFERENCES "public"."conversion_endpoints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_insight_snapshots" ADD CONSTRAINT "auction_insight_snapshots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_insight_snapshots" ADD CONSTRAINT "auction_insight_snapshots_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_alerts" ADD CONSTRAINT "competitor_alerts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_alerts" ADD CONSTRAINT "competitor_alerts_competitor_id_competitor_profiles_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitor_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_creatives" ADD CONSTRAINT "competitor_creatives_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_creatives" ADD CONSTRAINT "competitor_creatives_competitor_id_competitor_profiles_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_profiles" ADD CONSTRAINT "competitor_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counter_actions" ADD CONSTRAINT "counter_actions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counter_actions" ADD CONSTRAINT "counter_actions_alert_id_competitor_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."competitor_alerts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counter_actions" ADD CONSTRAINT "counter_actions_competitor_id_competitor_profiles_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitor_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counter_actions" ADD CONSTRAINT "counter_actions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversion_endpoints" ADD CONSTRAINT "conversion_endpoints_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversion_events" ADD CONSTRAINT "conversion_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversion_events" ADD CONSTRAINT "conversion_events_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creative_embeddings" ADD CONSTRAINT "creative_embeddings_creative_id_creatives_id_fk" FOREIGN KEY ("creative_id") REFERENCES "public"."creatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creative_variants" ADD CONSTRAINT "creative_variants_creative_id_creatives_id_fk" FOREIGN KEY ("creative_id") REFERENCES "public"."creatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_stage_campaigns" ADD CONSTRAINT "funnel_stage_campaigns_funnel_id_funnels_id_fk" FOREIGN KEY ("funnel_id") REFERENCES "public"."funnels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_stage_campaigns" ADD CONSTRAINT "funnel_stage_campaigns_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnels" ADD CONSTRAINT "funnels_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnels" ADD CONSTRAINT "funnels_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_connections" ADD CONSTRAINT "platform_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metrics_daily" ADD CONSTRAINT "metrics_daily_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metrics_daily" ADD CONSTRAINT "metrics_daily_ad_group_id_ad_groups_id_fk" FOREIGN KEY ("ad_group_id") REFERENCES "public"."ad_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metrics_daily" ADD CONSTRAINT "metrics_daily_ad_id_ads_id_fk" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metrics_hourly" ADD CONSTRAINT "metrics_hourly_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metrics_hourly" ADD CONSTRAINT "metrics_hourly_ad_group_id_ad_groups_id_fk" FOREIGN KEY ("ad_group_id") REFERENCES "public"."ad_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metrics_hourly" ADD CONSTRAINT "metrics_hourly_ad_id_ads_id_fk" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_analysis" ADD CONSTRAINT "cohort_analysis_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_acquisition_campaign_id_campaigns_id_fk" FOREIGN KEY ("acquisition_campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_analyses_org_connection_idx" ON "account_analyses" USING btree ("organization_id","platform_connection_id");--> statement-breakpoint
CREATE INDEX "ai_decision_log_org_idx" ON "ai_decision_log" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ai_decision_log_org_status_idx" ON "ai_decision_log" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "ai_decision_log_campaign_idx" ON "ai_decision_log" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "approval_policies_org_idx" ON "approval_policies" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "approval_policies_entity_type_idx" ON "approval_policies" USING btree ("organization_id","entity_type");--> statement-breakpoint
CREATE INDEX "approval_requests_org_idx" ON "approval_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "approval_requests_status_idx" ON "approval_requests" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "approval_requests_requester_idx" ON "approval_requests" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "approval_requests_entity_idx" ON "approval_requests" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "rule_executions_rule_idx" ON "automation_rule_executions" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "rule_executions_org_idx" ON "automation_rule_executions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "rule_executions_executed_at_idx" ON "automation_rule_executions" USING btree ("executed_at");--> statement-breakpoint
CREATE INDEX "automation_rules_org_idx" ON "automation_rules" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "automation_rules_enabled_idx" ON "automation_rules" USING btree ("organization_id","enabled");--> statement-breakpoint
CREATE INDEX "auction_snapshots_org_idx" ON "auction_insight_snapshots" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "auction_snapshots_org_date_idx" ON "auction_insight_snapshots" USING btree ("organization_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "auction_snapshots_campaign_idx" ON "auction_insight_snapshots" USING btree ("campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auction_snapshots_dedup_idx" ON "auction_insight_snapshots" USING btree ("organization_id","campaign_id","platform","snapshot_date","competitor_domain");--> statement-breakpoint
CREATE INDEX "competitor_alerts_org_idx" ON "competitor_alerts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "competitor_alerts_org_type_idx" ON "competitor_alerts" USING btree ("organization_id","alert_type");--> statement-breakpoint
CREATE INDEX "competitor_alerts_org_ack_idx" ON "competitor_alerts" USING btree ("organization_id","acknowledged");--> statement-breakpoint
CREATE INDEX "competitor_creatives_org_idx" ON "competitor_creatives" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "competitor_creatives_competitor_idx" ON "competitor_creatives" USING btree ("competitor_id");--> statement-breakpoint
CREATE INDEX "competitor_creatives_external_idx" ON "competitor_creatives" USING btree ("external_ad_id");--> statement-breakpoint
CREATE INDEX "competitor_profiles_org_idx" ON "competitor_profiles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "competitor_profiles_org_active_idx" ON "competitor_profiles" USING btree ("organization_id","active");--> statement-breakpoint
CREATE INDEX "counter_actions_org_idx" ON "counter_actions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "counter_actions_org_status_idx" ON "counter_actions" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "counter_actions_alert_idx" ON "counter_actions" USING btree ("alert_id");--> statement-breakpoint
CREATE INDEX "counter_actions_campaign_idx" ON "counter_actions" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "conversion_endpoints_org_idx" ON "conversion_endpoints" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "conversion_endpoints_pixel_idx" ON "conversion_endpoints" USING btree ("pixel_id");--> statement-breakpoint
CREATE INDEX "conversion_events_org_idx" ON "conversion_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "conversion_events_event_name_idx" ON "conversion_events" USING btree ("organization_id","event_name");--> statement-breakpoint
CREATE INDEX "conversion_events_campaign_idx" ON "conversion_events" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "conversion_events_created_at_idx" ON "conversion_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "conversion_events_platform_idx" ON "conversion_events" USING btree ("organization_id","platform");--> statement-breakpoint
CREATE INDEX "conversion_events_click_id_idx" ON "conversion_events" USING btree ("external_click_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_connections_org_platform_account_idx" ON "platform_connections" USING btree ("organization_id","platform","platform_account_id");--> statement-breakpoint
CREATE INDEX "metrics_daily_campaign_date_idx" ON "metrics_daily" USING btree ("campaign_id","date");--> statement-breakpoint
CREATE INDEX "metrics_daily_platform_date_idx" ON "metrics_daily" USING btree ("platform","date");--> statement-breakpoint
CREATE UNIQUE INDEX "metrics_daily_campaign_date_platform_uniq" ON "metrics_daily" USING btree ("campaign_id","date","platform");--> statement-breakpoint
CREATE INDEX "metrics_hourly_campaign_timestamp_idx" ON "metrics_hourly" USING btree ("campaign_id","timestamp");--> statement-breakpoint
CREATE INDEX "metrics_hourly_platform_timestamp_idx" ON "metrics_hourly" USING btree ("platform","timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "metrics_hourly_campaign_timestamp_platform_uniq" ON "metrics_hourly" USING btree ("campaign_id","timestamp","platform");--> statement-breakpoint
CREATE INDEX "notification_prefs_user_idx" ON "notification_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_org_idx" ON "notifications" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("user_id","organization_id","read");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "cohort_analysis_org_idx" ON "cohort_analysis" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "cohort_analysis_org_month_idx" ON "cohort_analysis" USING btree ("organization_id","cohort_month");--> statement-breakpoint
CREATE INDEX "cohort_analysis_org_platform_idx" ON "cohort_analysis" USING btree ("organization_id","platform");--> statement-breakpoint
CREATE INDEX "customer_profiles_org_idx" ON "customer_profiles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "customer_profiles_hashed_id_idx" ON "customer_profiles" USING btree ("organization_id","hashed_identifier");--> statement-breakpoint
CREATE INDEX "customer_profiles_acquisition_campaign_idx" ON "customer_profiles" USING btree ("acquisition_campaign_id");--> statement-breakpoint
CREATE INDEX "customer_profiles_ltv_idx" ON "customer_profiles" USING btree ("organization_id","ltv");