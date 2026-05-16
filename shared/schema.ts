/**
 * Schema V3 — Five-Table Hardened Architecture
 * Drizzle ORM + Supabase PostgreSQL
 *
 * Tables: tasks, task_dependencies, evidence, resource_commitments, audit_logs
 * Enums:  task_status, lag_type, evidence_type
 */

import { relations } from 'drizzle-orm';
import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  real,
  boolean,
  date,
  timestamp,
  jsonb,
  index,
  unique,
} from 'drizzle-orm/pg-core';

// ═══════════════════════════════════════════════════════════════════════════════
// Enums
// ═══════════════════════════════════════════════════════════════════════════════

export const taskStatusEnum = pgEnum('task_status', [
  'NotStart',
  'InProgress',
  'Blocked',
  'Done',
]);

export const lagTypeEnum = pgEnum('lag_type', ['Hard', 'Soft']);

export const evidenceTypeEnum = pgEnum('evidence_type', [
  'photo',
  'video',
  'document',
  'fai_report',
  'cmm_report',
  'dimension_report',
]);

// ═══════════════════════════════════════════════════════════════════════════════
// Table 0: projects — 项目名片（表头 No.1 / LA26006 等持久化）
// ═══════════════════════════════════════════════════════════════════════════════

export const projects = pgTable('projects', {
  id: varchar('id', { length: 50 }).primaryKey(), // project_id e.g. LA26006
  indexNo: varchar('index_no', { length: 50 }),
  projectName: varchar('project_name', { length: 255 }),
  productName: varchar('product_name', { length: 255 }),
  moldNumber: varchar('mold_number', { length: 50 }),
  brand: varchar('brand', { length: 50 }).default('Logitech'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  fitterGroup: varchar('fitter_group', { length: 255 }),
  productImageUrl: varchar('product_image_url', { length: 1024 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// Table 1: tasks — 核心任务表
// ═══════════════════════════════════════════════════════════════════════════════

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: varchar('project_id', { length: 50 }).notNull(),
    logicalId: varchar('logical_id', { length: 255 }), // client task id for upsert (e.g. cavity_core_milling)
    wbsId: varchar('wbs_id', { length: 100 }), // WBS 层级编号

    name: varchar('name', { length: 255 }).notNull(),
    nameCn: varchar('name_cn', { length: 255 }).notNull(),

    // Classification
    phase: varchar('phase', { length: 50 }).notNull(), // physical | data | production
    track: varchar('track', { length: 50 }), // sub_path: cavity_core | cavity_insert | slider | lifter
    stage: varchar('stage', { length: 100 }), // process step id (milling, roughing, etc.)
    stageOrder: integer('stage_order').default(0), // order within track for topology sort

    // Weight & Duration
    weight: real('weight').default(1), // task weight for priority calculation
    durationDays: integer('duration_days').notNull().default(1),

    // Baseline (计划)
    baselineStart: date('baseline_start').notNull(),
    baselineEnd: date('baseline_end').notNull(),

    // Actual (实际)
    actualStart: date('actual_start'),
    actualEnd: date('actual_end'),

    // Progress & Status
    progress: integer('progress').default(0), // 0-100
    status: taskStatusEnum('status').default('NotStart'),

    // Flags
    isCritical: boolean('is_critical').default(false),
    isMergePoint: boolean('is_merge_point').default(false),
    isMilestone: boolean('is_milestone').default(false),

    // Metadata
    assignee: varchar('assignee', { length: 255 }),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('tasks_project_id_idx').on(table.projectId),
    index('tasks_track_idx').on(table.track),
    index('tasks_phase_idx').on(table.phase),
    index('tasks_status_idx').on(table.status),
    index('tasks_project_logical_idx').on(table.projectId, table.logicalId),
    unique('tasks_project_logical_unique').on(table.projectId, table.logicalId),
  ],
);

// ═══════════════════════════════════════════════════════════════════════════════
// Table 2: task_dependencies — 前置任务关联表
// ═══════════════════════════════════════════════════════════════════════════════

export const taskDependencies = pgTable(
  'task_dependencies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .references(() => tasks.id, { onDelete: 'cascade' })
      .notNull(),
    predecessorId: uuid('predecessor_id')
      .references(() => tasks.id, { onDelete: 'cascade' })
      .notNull(),
    lagType: lagTypeEnum('lag_type').default('Hard'),
    lagHours: real('lag_hours').default(0), // PreLag in hours (e.g. 24h)
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('task_deps_task_id_idx').on(table.taskId),
    index('task_deps_predecessor_id_idx').on(table.predecessorId),
  ],
);

// ═══════════════════════════════════════════════════════════════════════════════
// Table 3: evidence — 证据文档关联表
// ═══════════════════════════════════════════════════════════════════════════════

export const evidence = pgTable(
  'evidence',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .references(() => tasks.id, { onDelete: 'cascade' })
      .notNull(),
    type: evidenceTypeEnum('type').notNull(),
    url: varchar('url', { length: 1024 }).notNull(),
    fileName: varchar('file_name', { length: 255 }),
    fileSize: integer('file_size'), // bytes
    mimeType: varchar('mime_type', { length: 100 }),
    description: text('description'),
    uploadedBy: varchar('uploaded_by', { length: 255 }),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [index('evidence_task_id_idx').on(table.taskId)],
);

// ═══════════════════════════════════════════════════════════════════════════════
// Table 4: resource_commitments — 部门承诺状态表
// ═══════════════════════════════════════════════════════════════════════════════

export const resourceCommitments = pgTable(
  'resource_commitments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .references(() => tasks.id, { onDelete: 'cascade' })
      .notNull(),
    department: varchar('department', { length: 255 }).notNull(),
    committedBy: varchar('committed_by', { length: 255 }),
    commitStatus: varchar('commit_status', { length: 50 }).default('pending'), // pending | approved | rejected
    commitDate: timestamp('commit_date'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [index('resource_task_id_idx').on(table.taskId)],
);

// ═══════════════════════════════════════════════════════════════════════════════
// Table 5: audit_logs — 操作日志表 (全量记录)
// ═══════════════════════════════════════════════════════════════════════════════

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityType: varchar('entity_type', { length: 50 }).notNull(), // task | dependency | evidence | resource
    entityId: uuid('entity_id').notNull(),
    action: varchar('action', { length: 50 }).notNull(), // create | update | delete | status_change
    changes: jsonb('changes'), // { field: { old: value, new: value } }
    performedBy: varchar('performed_by', { length: 255 }),
    ipAddress: varchar('ip_address', { length: 45 }),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('audit_entity_idx').on(table.entityType, table.entityId),
    index('audit_created_at_idx').on(table.createdAt),
  ],
);

// ═══════════════════════════════════════════════════════════════════════════════
// Relations — Drizzle ORM 关系声明
// ═══════════════════════════════════════════════════════════════════════════════

export const tasksRelations = relations(tasks, ({ many }) => ({
  dependenciesAsTask: many(taskDependencies, { relationName: 'task_deps' }),
  dependenciesAsPredecessor: many(taskDependencies, { relationName: 'predecessor_deps' }),
  evidence: many(evidence),
  resourceCommitments: many(resourceCommitments),
}));

export const taskDependenciesRelations = relations(taskDependencies, ({ one }) => ({
  task: one(tasks, {
    fields: [taskDependencies.taskId],
    references: [tasks.id],
    relationName: 'task_deps',
  }),
  predecessor: one(tasks, {
    fields: [taskDependencies.predecessorId],
    references: [tasks.id],
    relationName: 'predecessor_deps',
  }),
}));

export const evidenceRelations = relations(evidence, ({ one }) => ({
  task: one(tasks, {
    fields: [evidence.taskId],
    references: [tasks.id],
  }),
}));

export const resourceCommitmentsRelations = relations(resourceCommitments, ({ one }) => ({
  task: one(tasks, {
    fields: [resourceCommitments.taskId],
    references: [tasks.id],
  }),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// Table 6: dashboard_projects — V1 看板项目数据（宏观管理视图）
// ═══════════════════════════════════════════════════════════════════════════════

export const dashboardProjects = pgTable(
  'dashboard_projects',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    // 项目身份
    customerName: varchar('customer_name', { length: 255 }),
    customerBase: varchar('customer_base', { length: 255 }),
    projectName: varchar('project_name', { length: 255 }),
    productName: varchar('product_name', { length: 255 }),
    factoryLocation: varchar('factory_location', { length: 255 }),
    moldCount: varchar('mold_count', { length: 50 }),
    partNumber: varchar('part_number', { length: 100 }),
    cavityNumber: varchar('cavity_number', { length: 50 }),
    moldId: varchar('mold_id', { length: 100 }),
    pmName: varchar('pm_name', { length: 255 }),
    peName: varchar('pe_name', { length: 255 }),
    moldLead: varchar('mold_lead', { length: 255 }),
    pqeName: varchar('pqe_name', { length: 255 }),
    riskLevel: varchar('risk_level', { length: 50 }),
    fitterGroup: varchar('fitter_group', { length: 255 }),
    designEngineer: varchar('design_engineer', { length: 255 }),
    // 内部里程碑
    kickoffDate: varchar('kickoff_date', { length: 50 }),
    t1Date: varchar('t1_date', { length: 50 }),
    glDate: varchar('gl_date', { length: 50 }),
    vmpDate: varchar('vmp_date', { length: 50 }),
    mpDate: varchar('mp_date', { length: 50 }),
    currentStage: varchar('current_stage', { length: 100 }),
    t1DimensionOk: varchar('t1_dimension_ok', { length: 50 }),
    trialCount: varchar('trial_count', { length: 50 }),
    toolingFai: varchar('tooling_fai', { length: 50 }),
    partFai: varchar('part_fai', { length: 50 }),
    currentNode: varchar('current_node', { length: 100 }),
    estimatedCompletion: varchar('estimated_completion', { length: 50 }),
    // 推进细节
    progressDetails: text('progress_details'),
    updateDate: varchar('update_date', { length: 50 }),
    // 元数据
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    unique('dashboard_projects_mold_id_unique').on(table.moldId),
  ],
);

// ═══════════════════════════════════════════════════════════════════════════════
// Table 7: progress_notes — 项目推进细节（手动添加的条目）
// ═══════════════════════════════════════════════════════════════════════════════

export const progressNotes = pgTable(
  'progress_notes',
  {
    id: varchar('id', { length: 50 }).primaryKey(), // client-generated id
    moldNumber: varchar('mold_number', { length: 100 }).notNull(),
    date: varchar('date', { length: 20 }).notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('progress_notes_mold_idx').on(table.moldNumber),
  ],
);

export const sipMaster = pgTable(
  'sip_master',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    partNo: varchar('part_no', { length: 255 }).notNull(),
    partName: text('part_name'),
    version: varchar('version', { length: 32 }).default('V1.0').notNull(),
    status: text('status').default('草稿').notNull(),
    effectiveDate: date('effective_date'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('sip_master_part_no_idx').on(table.partNo),
    index('sip_master_status_idx').on(table.status),
    index('sip_master_updated_at_idx').on(table.updatedAt),
  ],
);

export const sipDetails = pgTable(
  'sip_details',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sipId: uuid('sip_id')
      .references(() => sipMaster.id, { onDelete: 'cascade' })
      .notNull(),
    stepSeq: integer('step_seq').notNull(),
    inspectionItem: text('inspection_item'),
    spec: text('spec'),
    lsl: text('lsl'),
    usl: text('usl'),
    tool: text('tool'),
    defectLevel: varchar('defect_level', { length: 32 }),
    aql: varchar('aql', { length: 32 }),
    imageUrl: varchar('image_url', { length: 1024 }),
  },
  (table) => [
    index('sip_details_sip_id_idx').on(table.sipId),
    index('sip_details_sip_step_seq_idx').on(table.sipId, table.stepSeq),
  ],
);

export const sipMasterRelations = relations(sipMaster, ({ many }) => ({
  details: many(sipDetails),
}));

export const sipDetailsRelations = relations(sipDetails, ({ one }) => ({
  master: one(sipMaster, {
    fields: [sipDetails.sipId],
    references: [sipMaster.id],
  }),
}));

export type ProgressNote = typeof progressNotes.$inferSelect;
export type NewProgressNote = typeof progressNotes.$inferInsert;


export type DashboardProject = typeof dashboardProjects.$inferSelect;
export type NewDashboardProject = typeof dashboardProjects.$inferInsert;
export type SipMaster = typeof sipMaster.$inferSelect;
export type NewSipMaster = typeof sipMaster.$inferInsert;
export type SipDetail = typeof sipDetails.$inferSelect;
export type NewSipDetail = typeof sipDetails.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════════
// Type Exports — 供前端和引擎使用
// ═══════════════════════════════════════════════════════════════════════════════

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TaskDependency = typeof taskDependencies.$inferSelect;
export type NewTaskDependency = typeof taskDependencies.$inferInsert;
export type Evidence = typeof evidence.$inferSelect;
export type NewEvidence = typeof evidence.$inferInsert;
export type ResourceCommitment = typeof resourceCommitments.$inferSelect;
export type NewResourceCommitment = typeof resourceCommitments.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
