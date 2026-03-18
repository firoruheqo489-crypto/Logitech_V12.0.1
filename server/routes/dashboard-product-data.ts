import type { Request, Response } from 'express';
import { sql as dbSql } from '../db.js';

type ProductModuleRow = {
  mold_number: string;
  serial_number: string | null;
  product_name: string | null;
  net_weight: string | null;
  runner_weight: string | null;
  product_size: string | null;
  cavity_number: string | null;
  material: string | null;
  material_erp_name: string | null;
  material_erp_code: string | null;
  recycled_material_erp_code: string | null;
  recycled_material_spec: string | null;
  raw_material_name: string | null;
  raw_material_spec: string | null;
  finished_part_number: string | null;
  semi_finished_part_number: string | null;
  internal_finished_erp_code: string | null;
  internal_semi_finished_erp_code: string | null;
  internal_product_name: string | null;
  mold_size: string | null;
  mold_weight: string | null;
  machine_tonnage: string | null;
  mold_material: string | null;
  open_mold_date: string | null;
  t0_time: string | null;
  asset_number: string | null;
  mold_owner: string | null;
  service_life: string | null;
  updated_at: string;
};

type ProductModulePayload = {
  moldNumber?: string;
  serialNumber?: string;
  productName?: string;
  netWeight?: string;
  runnerWeight?: string;
  productSize?: string;
  cavityNumber?: string;
  material?: string;
  materialErpName?: string;
  materialErpCode?: string;
  recycledMaterialErpCode?: string;
  recycledMaterialSpec?: string;
  rawMaterialName?: string;
  rawMaterialSpec?: string;
  finishedPartNumber?: string;
  semiFinishedPartNumber?: string;
  internalFinishedErpCode?: string;
  internalSemiFinishedErpCode?: string;
  internalProductName?: string;
  moldSize?: string;
  moldWeight?: string;
  machineTonnage?: string;
  moldMaterial?: string;
  openMoldDate?: string;
  t0Time?: string;
  assetNumber?: string;
  moldOwner?: string;
  serviceLife?: string;
};

type ProductDataRouteErrorCode =
  | 'BODY_MUST_BE_ARRAY'
  | 'DATABASE_NOT_CONFIGURED'
  | 'PRODUCT_MODULE_DATA_LOAD_FAILED'
  | 'PRODUCT_MODULE_DATA_SAVE_FAILED';

const PRODUCT_DATA_ROUTE_ERROR_MESSAGES: Record<ProductDataRouteErrorCode, string> = {
  BODY_MUST_BE_ARRAY: 'Body must be an array',
  DATABASE_NOT_CONFIGURED: 'Database not configured',
  PRODUCT_MODULE_DATA_LOAD_FAILED: 'Failed to load product module data',
  PRODUCT_MODULE_DATA_SAVE_FAILED: 'Failed to save product module data',
};

let dashboardProductDataTableReady: Promise<void> | null = null;

function sendProductDataRouteError(res: Response, status: number, code: ProductDataRouteErrorCode): void {
  res.status(status).json({
    error: PRODUCT_DATA_ROUTE_ERROR_MESSAGES[code],
    code,
  });
}

export function ensureDashboardProductDataTable(): Promise<void> {
  if (!dbSql) return Promise.resolve();
  if (!dashboardProductDataTableReady) {
    dashboardProductDataTableReady = (async () => {
      await dbSql.unsafe(`
        CREATE TABLE IF NOT EXISTS dashboard_product_data (
          id BIGSERIAL PRIMARY KEY,
          mold_number VARCHAR(100) NOT NULL UNIQUE,
          serial_number VARCHAR(100),
          product_name VARCHAR(255),
          net_weight VARCHAR(100),
          runner_weight VARCHAR(100),
          product_size VARCHAR(255),
          cavity_number VARCHAR(100),
          material VARCHAR(255),
          material_erp_name VARCHAR(255),
          material_erp_code VARCHAR(255),
          recycled_material_erp_code VARCHAR(255),
          recycled_material_spec VARCHAR(255),
          raw_material_name VARCHAR(255),
          raw_material_spec VARCHAR(255),
          finished_part_number VARCHAR(255),
          semi_finished_part_number VARCHAR(255),
          internal_finished_erp_code VARCHAR(255),
          internal_semi_finished_erp_code VARCHAR(255),
          internal_product_name VARCHAR(255),
          mold_size VARCHAR(255),
          mold_weight VARCHAR(255),
          machine_tonnage VARCHAR(255),
          mold_material VARCHAR(255),
          open_mold_date VARCHAR(100),
          t0_time VARCHAR(100),
          asset_number VARCHAR(100),
          mold_owner VARCHAR(255),
          service_life VARCHAR(255),
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      await dbSql.unsafe(`
        ALTER TABLE dashboard_product_data
        ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100)
      `);
      await dbSql.unsafe(`
        ALTER TABLE dashboard_product_data
        ADD COLUMN IF NOT EXISTS internal_finished_erp_code VARCHAR(255)
      `);
      await dbSql.unsafe(`
        ALTER TABLE dashboard_product_data
        ADD COLUMN IF NOT EXISTS recycled_material_erp_code VARCHAR(255)
      `);
      await dbSql.unsafe(`
        ALTER TABLE dashboard_product_data
        ADD COLUMN IF NOT EXISTS recycled_material_spec VARCHAR(255)
      `);
      await dbSql.unsafe(`
        ALTER TABLE dashboard_product_data
        ADD COLUMN IF NOT EXISTS raw_material_name VARCHAR(255)
      `);
      await dbSql.unsafe(`
        ALTER TABLE dashboard_product_data
        ADD COLUMN IF NOT EXISTS raw_material_spec VARCHAR(255)
      `);
      await dbSql.unsafe(`
        ALTER TABLE dashboard_product_data
        ADD COLUMN IF NOT EXISTS finished_part_number VARCHAR(255)
      `);
      await dbSql.unsafe(`
        ALTER TABLE dashboard_product_data
        ADD COLUMN IF NOT EXISTS semi_finished_part_number VARCHAR(255)
      `);
      await dbSql.unsafe(`
        ALTER TABLE dashboard_product_data
        ADD COLUMN IF NOT EXISTS internal_semi_finished_erp_code VARCHAR(255)
      `);
      await dbSql.unsafe(`
        ALTER TABLE dashboard_product_data
        ADD COLUMN IF NOT EXISTS internal_product_name VARCHAR(255)
      `);
      await dbSql.unsafe(`
        ALTER TABLE dashboard_product_data
        ADD COLUMN IF NOT EXISTS mold_weight VARCHAR(255)
      `);
      await dbSql.unsafe(`
        ALTER TABLE dashboard_product_data
        ADD COLUMN IF NOT EXISTS machine_tonnage VARCHAR(255)
      `);
      await dbSql.unsafe(`
        ALTER TABLE dashboard_product_data
        ADD COLUMN IF NOT EXISTS t0_time VARCHAR(100)
      `);
      await dbSql.unsafe(`
        ALTER TABLE dashboard_product_data
        ADD COLUMN IF NOT EXISTS asset_number VARCHAR(100)
      `);
      await dbSql.unsafe(`
        ALTER TABLE dashboard_product_data
        ADD COLUMN IF NOT EXISTS mold_owner VARCHAR(255)
      `);
    })();
  }
  return dashboardProductDataTableReady;
}

function normalizeValue(value: unknown, maxLength: number): string | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

export async function listDashboardProductData(_req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendProductDataRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  try {
    await ensureDashboardProductDataTable();
    const rows = (await dbSql`
      SELECT
        mold_number,
        serial_number,
        product_name,
        net_weight,
        runner_weight,
        product_size,
        cavity_number,
        material,
        material_erp_name,
        material_erp_code,
        recycled_material_erp_code,
        recycled_material_spec,
        raw_material_name,
        raw_material_spec,
        finished_part_number,
        semi_finished_part_number,
        internal_finished_erp_code,
        internal_semi_finished_erp_code,
        internal_product_name,
        mold_size,
        mold_weight,
        machine_tonnage,
        mold_material,
        open_mold_date,
        t0_time,
        asset_number,
        mold_owner,
        service_life,
        updated_at
      FROM dashboard_product_data
      ORDER BY mold_number ASC
    `) as ProductModuleRow[];

    res.status(200).json({ rows });
  } catch (err) {
    console.error('GET /api/dashboard/product-data error:', err);
    sendProductDataRouteError(res, 500, 'PRODUCT_MODULE_DATA_LOAD_FAILED');
  }
}

export async function batchUpsertDashboardProductData(req: Request, res: Response): Promise<void> {
  if (!dbSql) {
    sendProductDataRouteError(res, 503, 'DATABASE_NOT_CONFIGURED');
    return;
  }

  const items = Array.isArray(req.body) ? (req.body as ProductModulePayload[]) : null;
  if (!items) {
    sendProductDataRouteError(res, 400, 'BODY_MUST_BE_ARRAY');
    return;
  }

  try {
    await ensureDashboardProductDataTable();

    let affected = 0;
    for (const item of items) {
      const moldNumber = normalizeValue(item.moldNumber, 100);
      if (!moldNumber) continue;

      await dbSql`
        INSERT INTO dashboard_product_data (
          mold_number,
          serial_number,
          product_name,
          net_weight,
          runner_weight,
          product_size,
          cavity_number,
          material,
          material_erp_name,
          material_erp_code,
          recycled_material_erp_code,
          recycled_material_spec,
          raw_material_name,
          raw_material_spec,
          finished_part_number,
          semi_finished_part_number,
          internal_finished_erp_code,
          internal_semi_finished_erp_code,
          internal_product_name,
          mold_size,
          mold_weight,
          machine_tonnage,
          mold_material,
          open_mold_date,
          t0_time,
          asset_number,
          mold_owner,
          service_life,
          created_at,
          updated_at
        )
        VALUES (
          ${moldNumber},
          ${normalizeValue(item.serialNumber, 100)},
          ${normalizeValue(item.productName, 255)},
          ${normalizeValue(item.netWeight, 100)},
          ${normalizeValue(item.runnerWeight, 100)},
          ${normalizeValue(item.productSize, 255)},
          ${normalizeValue(item.cavityNumber, 100)},
          ${normalizeValue(item.material, 255)},
          ${normalizeValue(item.materialErpName, 255)},
          ${normalizeValue(item.materialErpCode, 255)},
          ${normalizeValue(item.recycledMaterialErpCode, 255)},
          ${normalizeValue(item.recycledMaterialSpec, 255)},
          ${normalizeValue(item.rawMaterialName, 255)},
          ${normalizeValue(item.rawMaterialSpec, 255)},
          ${normalizeValue(item.finishedPartNumber, 255)},
          ${normalizeValue(item.semiFinishedPartNumber, 255)},
          ${normalizeValue(item.internalFinishedErpCode, 255)},
          ${normalizeValue(item.internalSemiFinishedErpCode, 255)},
          ${normalizeValue(item.internalProductName, 255)},
          ${normalizeValue(item.moldSize, 255)},
          ${normalizeValue(item.moldWeight, 255)},
          ${normalizeValue(item.machineTonnage, 255)},
          ${normalizeValue(item.moldMaterial, 255)},
          ${normalizeValue(item.openMoldDate, 100)},
          ${normalizeValue(item.t0Time, 100)},
          ${normalizeValue(item.assetNumber, 100)},
          ${normalizeValue(item.moldOwner, 255)},
          ${normalizeValue(item.serviceLife, 255)},
          NOW(),
          NOW()
        )
        ON CONFLICT (mold_number)
        DO UPDATE SET
          serial_number = EXCLUDED.serial_number,
          product_name = EXCLUDED.product_name,
          net_weight = EXCLUDED.net_weight,
          runner_weight = EXCLUDED.runner_weight,
          product_size = EXCLUDED.product_size,
          cavity_number = EXCLUDED.cavity_number,
          material = EXCLUDED.material,
          material_erp_name = EXCLUDED.material_erp_name,
          material_erp_code = EXCLUDED.material_erp_code,
          recycled_material_erp_code = EXCLUDED.recycled_material_erp_code,
          recycled_material_spec = EXCLUDED.recycled_material_spec,
          raw_material_name = EXCLUDED.raw_material_name,
          raw_material_spec = EXCLUDED.raw_material_spec,
          finished_part_number = EXCLUDED.finished_part_number,
          semi_finished_part_number = EXCLUDED.semi_finished_part_number,
          internal_finished_erp_code = EXCLUDED.internal_finished_erp_code,
          internal_semi_finished_erp_code = EXCLUDED.internal_semi_finished_erp_code,
          internal_product_name = EXCLUDED.internal_product_name,
          mold_size = EXCLUDED.mold_size,
          mold_weight = EXCLUDED.mold_weight,
          machine_tonnage = EXCLUDED.machine_tonnage,
          mold_material = EXCLUDED.mold_material,
          open_mold_date = EXCLUDED.open_mold_date,
          t0_time = EXCLUDED.t0_time,
          asset_number = EXCLUDED.asset_number,
          mold_owner = EXCLUDED.mold_owner,
          service_life = EXCLUDED.service_life,
          updated_at = NOW()
      `;
      affected += 1;
    }

    res.status(200).json({ success: true, count: affected });
  } catch (err) {
    console.error('POST /api/dashboard/product-data/batch-upsert error:', err);
    sendProductDataRouteError(res, 500, 'PRODUCT_MODULE_DATA_SAVE_FAILED');
  }
}
