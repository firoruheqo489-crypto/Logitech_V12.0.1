import type { ProductModuleRecord } from '../types/product-module';

function normalizeHeaderKey(header: string): string {
  return header
    .replace(/\uFF08[^\uFF09]*\uFF09/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\u3010[^\u3011]*\u3011/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[\r\n\t\s]+/g, '')
    .replace(/[\uFF08\uFF09()\[\]\u3010\u3011]/g, '')
    .trim()
    .toUpperCase();
}

function parseExcelSerialDate(serial: number): string {
  if (!Number.isFinite(serial)) return '';
  const wholeDays = Math.floor(serial);
  if (wholeDays <= 0) return '';
  const excelEpoch = Date.UTC(1899, 11, 30);
  const date = new Date(excelEpoch + wholeDays * 86400000);
  if (isNaN(date.getTime())) return '';
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeMoldDigits(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

function parseDateValue(value: unknown): string {
  if (typeof value === 'number') {
    return parseExcelSerialDate(value);
  }

  const text = String(value ?? '').trim();
  if (!text) return '';

  const shortDotDate = text.match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
  if (shortDotDate) {
    return `20${shortDotDate[1]}-${shortDotDate[2]}-${shortDotDate[3]}`;
  }

  const parsed = new Date(text);
  if (isNaN(parsed.getTime())) return text;

  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseMonthDayValue(value: unknown): string {
  if (typeof value === 'number') {
    const normalized = parseExcelSerialDate(value);
    if (!normalized) return '';
    const [year, month, day] = normalized.split('-');
    if (!year || !month || !day) return normalized;
    return `${Number(month)}\u6708${Number(day)}\u65e5`;
  }

  const text = String(value ?? '').trim();
  if (!text) return '';

  const parsed = new Date(text);
  if (isNaN(parsed.getTime())) return text;

  return `${parsed.getMonth() + 1}\u6708${parsed.getDate()}\u65e5`;
}

const PRODUCT_COLUMN_MAPPING: Record<string, keyof ProductModuleRecord> = {
  '\u6A21\u5177\u7F16\u53F7': 'moldNumber',
  MOLDID: 'moldNumber',
  MOLDNUMBER: 'moldNumber',

  '\u5E8F\u53F7': 'serialNumber',
  NO: 'serialNumber',
  'NO.': 'serialNumber',
  SERIALNUMBER: 'serialNumber',

  '\u4EA7\u54C1\u540D\u79F0': 'productName',
  PRODUCTNAME: 'productName',

  '\u4EA7\u54C1\u51C0\u91CD': 'netWeight',
  '\u4EA7\u54C1\u51C0\u91CDG': 'netWeight',
  NETWEIGHT: 'netWeight',

  '\u6599\u5934\u51C0\u91CD': 'runnerWeight',
  '\u6599\u5934\u51C0\u91CDG': 'runnerWeight',
  RUNNERWEIGHT: 'runnerWeight',

  '\u4EA7\u54C1\u5C3A\u5BF8': 'productSize',
  '\u4EA7\u54C1\u5C3A\u5BF8MM': 'productSize',
  PRODUCTSIZE: 'productSize',

  '\u6A21\u5177\u7A74\u53F7': 'cavityNumber',
  '\u7A74\u53F7': 'cavityNumber',
  CAVITYNUMBER: 'cavityNumber',

  '\u6210\u578B\u6750\u8D28': 'material',
  MATERIAL: 'material',

  '\u6750\u6599ERP\u54C1\u540D': 'materialErpName',
  MATERIALERPNAME: 'materialErpName',

  '\u539F\u6599ERP\u54C1\u53F7': 'materialErpCode',
  '\u539F\u6599\u54C1\u53F7': 'materialErpCode',
  '\u6750\u6599ERP\u6599\u53F7': 'materialErpCode',
  MATERIALERPCODE: 'materialErpCode',

  '\u56DE\u6599ERP\u54C1\u53F7': 'recycledMaterialErpCode',
  '\u56DE\u6599\u54C1\u53F7': 'recycledMaterialErpCode',
  RECYCLEMATERIALERPCODE: 'recycledMaterialErpCode',

  '\u56DE\u6599\u89C4\u683C': 'recycledMaterialSpec',
  RECYCLEMATERIALSPEC: 'recycledMaterialSpec',

  '\u539F\u6599\u54C1\u540D': 'rawMaterialName',
  RAWMATERIALNAME: 'rawMaterialName',

  '\u539F\u6599\u89C4\u683C': 'rawMaterialSpec',
  RAWMATERIALSPEC: 'rawMaterialSpec',

  '\u6210\u54C1\u6599\u53F7': 'finishedPartNumber',
  FINISHEDPARTNUMBER: 'finishedPartNumber',

  '\u534A\u54C1\u6599\u53F7': 'semiFinishedPartNumber',
  SEMIFINISHEDPARTNUMBER: 'semiFinishedPartNumber',

  '\u5185\u90E8ERP\u6210\u54C1\u54C1\u53F7': 'internalFinishedErpCode',
  '\u6210\u54C1\u54C1\u53F7': 'internalFinishedErpCode',
  INTERNALERPFINISHEDPRODUCTCODE: 'internalFinishedErpCode',

  '\u5185\u90E8ERP\u534A\u54C1\u54C1\u53F7': 'internalSemiFinishedErpCode',
  '\u534A\u54C1\u54C1\u53F7': 'internalSemiFinishedErpCode',
  INTERNALERPSEMIFINISHEDPRODUCTCODE: 'internalSemiFinishedErpCode',

  '\u5185\u90E8ERP\u4EA7\u54C1\u540D\u79F0': 'internalProductName',
  INTERNALERPPRODUCTNAME: 'internalProductName',

  '\u6A21\u5177\u5C3A\u5BF8': 'moldSize',
  '\u6A21\u5177\u5C3A\u5BF8CM': 'moldSize',
  '\u6A21\u5177\u5C3A\u5BF8MM': 'moldSize',
  MOLDSIZE: 'moldSize',

  '\u6A21\u5177\u91CD\u91CF': 'moldWeight',
  '\u6A21\u5177\u91CD\u91CFKG': 'moldWeight',
  MOLDWEIGHT: 'moldWeight',

  '\u6210\u578B\u673A\u53F0\u5428\u4F4D': 'machineTonnage',
  MACHINETONNAGE: 'machineTonnage',

  '\u6A21\u5177\u6750\u8D28': 'moldMaterial',
  MOLDMATERIAL: 'moldMaterial',

  '\u5F00\u6A21\u65F6\u95F4': 'openMoldDate',
  OPENMOLDDATE: 'openMoldDate',

  '\u0054\u0030\u65F6\u95F4': 't0Time',
  T0TIME: 't0Time',

  '\u8D44\u4EA7\u7F16\u53F7': 'assetNumber',
  ASSETNUMBER: 'assetNumber',

  '\u6A21\u5177\u8D1F\u8D23\u4EBA': 'moldOwner',
  MOLDOWNER: 'moldOwner',

  '\u4F7F\u7528\u5BFF\u547D': 'serviceLife',
  '\u6A21\u5177\u5BFF\u547D': 'serviceLife',
  SERVICELIFE: 'serviceLife',
};

export function normalizeMoldLookupKey(value: string): string {
  const cleaned = String(value ?? '').trim().toUpperCase();
  if (!cleaned) return '';
  const digits = normalizeMoldDigits(cleaned);
  return digits || cleaned.replace(/[^A-Z0-9]/g, '');
}

export function normalizeProductSequenceLookupKey(value: unknown): string {
  const formatted = formatProductSequenceLabel(value);
  if (!formatted) return '';
  const digits = formatted.match(/\d+/)?.[0];
  return digits ? String(Number(digits)) : formatted.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function buildProductModuleLookupKey(moldNumber: string, serialNumber: unknown): string {
  const moldKey = normalizeMoldLookupKey(moldNumber);
  const sequenceKey = normalizeProductSequenceLookupKey(serialNumber);
  if (!moldKey || !sequenceKey) return '';
  return `${moldKey}::${sequenceKey}`;
}

export function formatProductSequenceLabel(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const digits = raw.match(/\d+/)?.[0];
  if (digits) {
    return `No. ${Number(digits)}`;
  }

  return raw;
}

export function parseProductModuleExcelFile(file: File): Promise<ProductModuleRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const XLSX = await import('xlsx');
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        let bestRows: unknown[][] = [];
        let bestHeaderIndex = 0;
        let bestScore = -1;

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' }) as unknown[][];
          const maxScan = Math.min(rows.length, 12);

          for (let i = 0; i < maxScan; i += 1) {
            const score = (rows[i] || []).reduce<number>((total, cell) => {
              const key = normalizeHeaderKey(String(cell ?? ''));
              return PRODUCT_COLUMN_MAPPING[key] ? total + 1 : total;
            }, 0);

            if (score > bestScore) {
              bestRows = rows;
              bestHeaderIndex = i;
              bestScore = score;
            }
          }
        }

        if (!bestRows.length || bestScore <= 0) {
          resolve([]);
          return;
        }

        const headers = (bestRows[bestHeaderIndex] || []).map((cell) =>
          normalizeHeaderKey(String(cell ?? '')),
        );
        const records: ProductModuleRecord[] = [];

        for (let rowIndex = bestHeaderIndex + 1; rowIndex < bestRows.length; rowIndex += 1) {
          const row = bestRows[rowIndex] || [];
          if (!row.some((cell) => String(cell ?? '').trim())) continue;

          const record: ProductModuleRecord = { moldNumber: '' };

          headers.forEach((header, columnIndex) => {
            const mappedKey = PRODUCT_COLUMN_MAPPING[header];
            if (!mappedKey) return;

            const rawValue = row[columnIndex];
            const textValue =
              mappedKey === 'openMoldDate'
                ? parseDateValue(rawValue)
                : mappedKey === 't0Time'
                  ? parseMonthDayValue(rawValue)
                  : String(rawValue ?? '').trim();

            if (!textValue) return;
            record[mappedKey] =
              mappedKey === 'serialNumber' ? formatProductSequenceLabel(textValue) : textValue;
          });

          if (record.moldNumber) {
            record.moldNumber = normalizeMoldLookupKey(record.moldNumber);
            records.push(record);
          }
        }

        resolve(records);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('file read failed'));
    reader.readAsBinaryString(file);
  });
}
