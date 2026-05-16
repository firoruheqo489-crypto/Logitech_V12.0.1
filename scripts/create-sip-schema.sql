CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.sip_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_no VARCHAR(255) NOT NULL,
  part_name TEXT,
  version VARCHAR(32) NOT NULL DEFAULT 'V1.0',
  status TEXT NOT NULL DEFAULT '草稿',
  effective_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.sip_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sip_id UUID NOT NULL REFERENCES public.sip_master(id) ON DELETE CASCADE,
  step_seq INTEGER NOT NULL,
  inspection_item TEXT,
  spec TEXT,
  lsl TEXT,
  usl TEXT,
  tool TEXT,
  defect_level VARCHAR(32),
  aql VARCHAR(32),
  image_url TEXT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sip_master_part_no_idx
  ON public.sip_master(part_no);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sip_master_status_idx
  ON public.sip_master(status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sip_master_updated_at_idx
  ON public.sip_master(updated_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sip_details_sip_id_idx
  ON public.sip_details(sip_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sip_details_sip_step_seq_idx
  ON public.sip_details(sip_id, step_seq);
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_sip_master_updated_at ON public.sip_master;
--> statement-breakpoint
CREATE TRIGGER trg_sip_master_updated_at
BEFORE UPDATE ON public.sip_master
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();
