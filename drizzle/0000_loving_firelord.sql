CREATE TABLE `alert_actions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`alert_id` text NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_alert_actions_alert_created` ON `alert_actions` (`alert_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`asset_id` text,
	`alert_type` text NOT NULL,
	`severity` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`confidence` real NOT NULL,
	`impact_kwh` real DEFAULT 0 NOT NULL,
	`evidence_json` text DEFAULT '[]' NOT NULL,
	`model_version` text NOT NULL,
	`opened_at` text NOT NULL,
	`resolved_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_alerts_site_status_opened` ON `alerts` (`site_id`,`status`,`opened_at`);--> statement-breakpoint
CREATE INDEX `idx_alerts_asset_opened` ON `alerts` (`asset_id`,`opened_at`);--> statement-breakpoint
CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`parent_asset_id` text,
	`asset_type` text NOT NULL,
	`name` text NOT NULL,
	`capacity_kw` real,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_assets_site_type` ON `assets` (`site_id`,`asset_type`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`site_id` text,
	`event_type` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_site_created` ON `audit_logs` (`site_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `carbon_ledger_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`grid_import_kwh` real NOT NULL,
	`pv_generation_kwh` real NOT NULL,
	`factor_id` text NOT NULL,
	`emissions_kg_co2e` real NOT NULL,
	`calculation_version` text NOT NULL,
	`data_version` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`factor_id`) REFERENCES `emission_factors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_carbon_ledger_site_period` ON `carbon_ledger_entries` (`site_id`,`period_start`,`period_end`);--> statement-breakpoint
CREATE TABLE `data_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`name` text NOT NULL,
	`source_type` text NOT NULL,
	`licence_url` text,
	`commercial_use_status` text DEFAULT 'review_required' NOT NULL,
	`source_version` text,
	`checksum` text,
	`downloaded_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `emission_factors` (
	`id` text PRIMARY KEY NOT NULL,
	`region` text NOT NULL,
	`scope` text DEFAULT 'scope_2_location' NOT NULL,
	`value_kg_co2e_per_kwh` real NOT NULL,
	`effective_year` integer NOT NULL,
	`source_version` text NOT NULL,
	`source_url` text NOT NULL,
	`downloaded_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_emission_factors_region_year_scope` ON `emission_factors` (`region`,`effective_year`,`scope`);--> statement-breakpoint
CREATE TABLE `model_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`model_name` text NOT NULL,
	`version` text NOT NULL,
	`training_data_version` text NOT NULL,
	`metrics_json` text NOT NULL,
	`thresholds_json` text NOT NULL,
	`status` text DEFAULT 'candidate' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_model_versions_name_version` ON `model_versions` (`model_name`,`version`);--> statement-breakpoint
CREATE TABLE `site_memberships` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`site_id` text NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_site_memberships_site_user` ON `site_memberships` (`site_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_site_memberships_user_id` ON `site_memberships` (`user_id`);--> statement-breakpoint
CREATE TABLE `sites` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`location` text NOT NULL,
	`timezone` text DEFAULT 'Australia/Darwin' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
