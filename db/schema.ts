import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const sites = sqliteTable("sites", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  timezone: text("timezone").notNull().default("Australia/Darwin"),
  status: text("status").notNull().default("active"),
  ...timestamps,
});

export const siteMemberships = sqliteTable("site_memberships", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  siteId: text("site_id").notNull().references(() => sites.id),
  userId: text("user_id").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("viewer"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("uq_site_memberships_site_user").on(table.siteId, table.userId),
  index("idx_site_memberships_user_id").on(table.userId),
]);

export const assets = sqliteTable("assets", {
  id: text("id").primaryKey(),
  siteId: text("site_id").notNull().references(() => sites.id),
  parentAssetId: text("parent_asset_id"),
  assetType: text("asset_type").notNull(),
  name: text("name").notNull(),
  capacityKw: real("capacity_kw"),
  metadataJson: text("metadata_json").notNull().default("{}"),
  ...timestamps,
}, (table) => [index("idx_assets_site_type").on(table.siteId, table.assetType)]);

export const dataSources = sqliteTable("data_sources", {
  id: text("id").primaryKey(),
  siteId: text("site_id").notNull().references(() => sites.id),
  name: text("name").notNull(),
  sourceType: text("source_type").notNull(),
  licenceUrl: text("licence_url"),
  commercialUseStatus: text("commercial_use_status").notNull().default("review_required"),
  sourceVersion: text("source_version"),
  checksum: text("checksum"),
  downloadedAt: text("downloaded_at"),
  ...timestamps,
});

export const alerts = sqliteTable("alerts", {
  id: text("id").primaryKey(),
  siteId: text("site_id").notNull().references(() => sites.id),
  assetId: text("asset_id").references(() => assets.id),
  alertType: text("alert_type").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull().default("open"),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  confidence: real("confidence").notNull(),
  impactKwh: real("impact_kwh").notNull().default(0),
  evidenceJson: text("evidence_json").notNull().default("[]"),
  modelVersion: text("model_version").notNull(),
  openedAt: text("opened_at").notNull(),
  resolvedAt: text("resolved_at"),
  ...timestamps,
}, (table) => [
  index("idx_alerts_site_status_opened").on(table.siteId, table.status, table.openedAt),
  index("idx_alerts_asset_opened").on(table.assetId, table.openedAt),
]);

export const alertActions = sqliteTable("alert_actions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  alertId: text("alert_id").notNull(),
  userId: text("user_id").notNull(),
  action: text("action").notNull(),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_alert_actions_alert_created").on(table.alertId, table.createdAt)]);

export const emissionFactors = sqliteTable("emission_factors", {
  id: text("id").primaryKey(),
  region: text("region").notNull(),
  scope: text("scope").notNull().default("scope_2_location"),
  valueKgCo2ePerKwh: real("value_kg_co2e_per_kwh").notNull(),
  effectiveYear: integer("effective_year").notNull(),
  sourceVersion: text("source_version").notNull(),
  sourceUrl: text("source_url").notNull(),
  downloadedAt: text("downloaded_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("uq_emission_factors_region_year_scope").on(table.region, table.effectiveYear, table.scope)]);

export const carbonLedgerEntries = sqliteTable("carbon_ledger_entries", {
  id: text("id").primaryKey(),
  siteId: text("site_id").notNull().references(() => sites.id),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  gridImportKwh: real("grid_import_kwh").notNull(),
  pvGenerationKwh: real("pv_generation_kwh").notNull(),
  factorId: text("factor_id").notNull().references(() => emissionFactors.id),
  emissionsKgCo2e: real("emissions_kg_co2e").notNull(),
  calculationVersion: text("calculation_version").notNull(),
  dataVersion: text("data_version").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("uq_carbon_ledger_site_period").on(table.siteId, table.periodStart, table.periodEnd)]);

export const modelVersions = sqliteTable("model_versions", {
  id: text("id").primaryKey(),
  modelName: text("model_name").notNull(),
  version: text("version").notNull(),
  trainingDataVersion: text("training_data_version").notNull(),
  metricsJson: text("metrics_json").notNull(),
  thresholdsJson: text("thresholds_json").notNull(),
  status: text("status").notNull().default("candidate"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("uq_model_versions_name_version").on(table.modelName, table.version)]);

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  siteId: text("site_id"),
  eventType: text("event_type").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  payloadJson: text("payload_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_audit_logs_site_created").on(table.siteId, table.createdAt)]);
