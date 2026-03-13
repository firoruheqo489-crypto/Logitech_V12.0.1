CREATE TYPE "public"."evidence_type" AS ENUM('photo', 'video', 'document', 'fai_report', 'cmm_report', 'dimension_report');--> statement-breakpoint
CREATE TYPE "public"."lag_type" AS ENUM('Hard', 'Soft');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('NotStart', 'InProgress', 'Blocked', 'Done');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" varchar(50) NOT NULL,
	"changes" jsonb,
	"performed_by" varchar(255),
	"ip_address" varchar(45),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"type" "evidence_type" NOT NULL,
	"url" varchar(1024) NOT NULL,
	"file_name" varchar(255),
	"file_size" integer,
	"mime_type" varchar(100),
	"description" text,
	"uploaded_by" varchar(255),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"index_no" varchar(50),
	"project_name" varchar(255),
	"product_name" varchar(255),
	"mold_number" varchar(50),
	"brand" varchar(50) DEFAULT 'Logitech',
	"start_date" date,
	"end_date" date,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "resource_commitments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"department" varchar(255) NOT NULL,
	"committed_by" varchar(255),
	"commit_status" varchar(50) DEFAULT 'pending',
	"commit_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"predecessor_id" uuid NOT NULL,
	"lag_type" "lag_type" DEFAULT 'Hard',
	"lag_hours" real DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar(50) NOT NULL,
	"logical_id" varchar(255),
	"wbs_id" varchar(100),
	"name" varchar(255) NOT NULL,
	"name_cn" varchar(255) NOT NULL,
	"phase" varchar(50) NOT NULL,
	"track" varchar(50),
	"stage" varchar(100),
	"stage_order" integer DEFAULT 0,
	"weight" real DEFAULT 1,
	"duration_days" integer DEFAULT 1 NOT NULL,
	"baseline_start" date NOT NULL,
	"baseline_end" date NOT NULL,
	"actual_start" date,
	"actual_end" date,
	"progress" integer DEFAULT 0,
	"status" "task_status" DEFAULT 'NotStart',
	"is_critical" boolean DEFAULT false,
	"is_merge_point" boolean DEFAULT false,
	"is_milestone" boolean DEFAULT false,
	"assignee" varchar(255),
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tasks_project_logical_unique" UNIQUE("project_id","logical_id")
);
--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_commitments" ADD CONSTRAINT "resource_commitments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_predecessor_id_tasks_id_fk" FOREIGN KEY ("predecessor_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "evidence_task_id_idx" ON "evidence" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "resource_task_id_idx" ON "resource_commitments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_deps_task_id_idx" ON "task_dependencies" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_deps_predecessor_id_idx" ON "task_dependencies" USING btree ("predecessor_id");--> statement-breakpoint
CREATE INDEX "tasks_project_id_idx" ON "tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "tasks_track_idx" ON "tasks" USING btree ("track");--> statement-breakpoint
CREATE INDEX "tasks_phase_idx" ON "tasks" USING btree ("phase");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_project_logical_idx" ON "tasks" USING btree ("project_id","logical_id");