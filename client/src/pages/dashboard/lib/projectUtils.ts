/**
 * Project utilities for parsing and processing Excel data
 * Three-section data model support
 */

import { ProjectData, ProjectStats, DEFAULT_COLUMN_MAPPING } from '../types/project';

function parseExcelSerialDate(serial: number): { y: number; m: number; d: number } | null {
  if (!Number.isFinite(serial)) return null;
  const wholeDays = Math.floor(serial);
  if (wholeDays <= 0) return null;
  const excelEpoch = Date.UTC(1899, 11, 30);
  const date = new Date(excelEpoch + wholeDays * 86400000);
  if (isNaN(date.getTime())) return null;
  return {
    y: date.getUTCFullYear(),
    m: date.getUTCMonth() + 1,
    d: date.getUTCDate(),
  };
}

function normalizeHeaderKey(header: string): string {
  return header
    .replace(/[\r\n\t\s]+/g, '')
    .replace(/[：:]/g, '')
    .trim()
    .toUpperCase();
}

/**
 * Set nested property value using dot notation path
 */
function setNestedValue(obj: any, path: string, value: any) {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key]) {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[keys[keys.length - 1]] = value;
}

/**
 * Get nested property value using dot notation path
 */
function getNestedValue(obj: any, path: string): any {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current === undefined || current === null) {
      return undefined;
    }
    current = current[key];
  }
  
  return current;
}

/**
 * Parse Excel serial date number to ISO date string
 */
function parseExcelDate(value: any): string {
  if (!value) return '';
  
  // If it's a number, treat as Excel serial date
  if (typeof value === 'number') {
    const date = parseExcelSerialDate(value);
    if (!date) return '';
    if (date.y < 2015 || date.y > 2040) return '';
    return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
  }
  
  // If it's already a string, try to parse as date
  if (typeof value === 'string') {
    const trimmed = value.trim();

    // Chinese date with year: 2026年2月23日 / 2026-2-23 / 2026/2/23
    const fullDateMatch = trimmed.match(/^(\d{4})[年\-\/\.](\d{1,2})[月\-\/\.](\d{1,2})日?$/);
    if (fullDateMatch) {
      const year = Number(fullDateMatch[1]);
      const month = Number(fullDateMatch[2]);
      const day = Number(fullDateMatch[3]);
      if (year >= 2015 && year <= 2040 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }

    // Chinese month-day only: 2月23日（保留原值，避免误判年份）
    if (/^\d{1,2}月\d{1,2}日$/.test(trimmed)) {
      return trimmed;
    }

    // If string looks like a bare Excel serial number (e.g. "36905"), convert via serial formula
    if (/^\d{4,6}$/.test(trimmed)) {
      const serial = Number(trimmed);
      // Excel serial range for 2015-2040: ~42005 to ~51499
      if (serial >= 42005 && serial <= 51499) {
        const date = parseExcelSerialDate(serial);
        if (date) {
          return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
        }
      }
      // Out of valid range — ignore to avoid wrong-year dates
      return '';
    }
    const dateTest = new Date(trimmed);
    if (!isNaN(dateTest.getTime())) {
      const y = dateTest.getFullYear();
      // Sanity check: project dates should be between 2015 and 2040
      if (y < 2015 || y > 2040) return '';
      return dateTest.toISOString().split('T')[0];
    }
  }
  
  return '';
}

/**
 * Format date value for display in "MM月DD日" format
 * Handles Excel serial numbers, text strings, and empty values
 * 
 * @param value - Raw value from Excel cell (number, string, or undefined)
 * @returns Formatted date string like "12月24日" or "暂无日期"
 */
export function formatExcelDate(value: any): string {
  // Handle empty/undefined first
  if (!value || value === '') {
    return '暂无日期';
  }
  
  // PRIORITY 1: If it's already a clean string like "12月24日", just return it
  if (typeof value === 'string' && value.includes('月')) {
    return value;
  }
  
  // PRIORITY 2: If it's a number (e.g., 45325), convert it strictly
  if (!isNaN(value) && typeof value === 'number') {
    try {
      // Excel serial date formula: (serial - 25569) * 86400 * 1000
      const date = new Date((value - 25569) * 86400 * 1000);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}月${day}日`;
    } catch {
      return String(value);
    }
  }
  
  // PRIORITY 3: Try to parse as ISO date (YYYY-MM-DD)
  if (typeof value === 'string') {
    const dateMatch = value.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (dateMatch) {
      const month = parseInt(dateMatch[2]);
      const day = parseInt(dateMatch[3]);
      return `${month}月${day}日`;
    }
  }
  
  // Fallback: return as string
  return String(value);
}

/**
 * Parse Excel file and extract project data
 */
export function parseExcelFile(file: File): Promise<ProjectData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const XLSX = await import('xlsx');
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const normalizedMapping: Record<string, string> = {};
        Object.entries(DEFAULT_COLUMN_MAPPING).forEach(([k, v]) => {
          normalizedMapping[normalizeHeaderKey(String(k))] = v;
        });

        const resolveMappedPath = (header: any): string | undefined => {
          const key = header !== undefined && header !== null ? String(header) : '';
          return DEFAULT_COLUMN_MAPPING[key] || normalizedMapping[normalizeHeaderKey(key)];
        };

        const getRowScore = (row: any[] | undefined): number => {
          if (!row) return 0;
          return row.reduce((acc, cell) => (resolveMappedPath(cell) ? acc + 1 : acc), 0);
        };

        // Auto-detect best worksheet + header row based on mapping hits
        let bestRows: any[][] = [];
        let bestHeaderRowIndex = 2;
        let bestScore = -1;

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            raw: false,
            dateNF: 'yyyy-mm-dd',
          }) as any[][];

          const maxScan = Math.min(20, rows.length);
          for (let i = 0; i < maxScan; i++) {
            const score = getRowScore(rows[i]);
            if (score > bestScore) {
              bestScore = score;
              bestRows = rows;
              bestHeaderRowIndex = i;
            }
          }
        }

        if (!bestRows.length || bestScore <= 0) {
          resolve([]);
          return;
        }

        const jsonData = bestRows;
        const headerRowIndex = bestHeaderRowIndex;
        const headers = (jsonData[headerRowIndex] || []) as string[];
        const nextHeaderRow = (jsonData[headerRowIndex + 1] || []) as string[];
        
        // Parse data rows (starting from row 3)
        const projects: ProjectData[] = [];
        
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          
          // Skip empty rows or rows that are just instructions
          if (!row || row.every((v: any) => String(v ?? '').trim() === '') || String(row[0] ?? '').includes('列')) {
            continue;
          }
          
          // Initialize project with nested structure
          const project: any = {
            no: '',
            identity: {},
            milestones: {},
            details: {}
          };
          
          // First column (index 0) is NO., even though header is undefined/empty
          project.no = row[0] !== undefined && row[0] !== null ? String(row[0]) : '-';
          
          // Map other columns starting from index 1
          headers.forEach((header, index) => {
            if (index === 0) return; // Skip first column as we already handled it

            const mappedPath = resolveMappedPath(header) || resolveMappedPath(nextHeaderRow[index]);
            if (mappedPath) {
              const value = row[index];
              let processedValue = value !== undefined && value !== null ? String(value) : '-';
              
              // Special handling for date fields
              if ([
                'milestones.projectStart',
                'milestones.t1',
                'milestones.glTime',
                'milestones.vmp',
                'milestones.mp',
                'milestones.estimatedCompletion',
              ].includes(mappedPath)) {
                processedValue = parseExcelDate(value) || '-';
              }
              
              setNestedValue(project, mappedPath, processedValue);
            }
          });
          
          // Only add if it has a project name
          if (project.identity?.projectName && project.identity.projectName !== '-') {
            projects.push(project as ProjectData);
          }
        }
        
        resolve(projects);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsBinaryString(file);
  });
}

/**
 * Get risk level color based on risk level text
 */
export function getRiskColor(riskLevel: string): string {
  const level = riskLevel?.trim() || '';
  
  if (level === '高' || level.includes('高')) {
    return 'rgb(220, 38, 38)'; // Red for high risk
  } else if (level === '中' || level.includes('中')) {
    return 'rgb(234, 179, 8)'; // Yellow for medium risk
  } else {
    return 'rgb(34, 197, 94)'; // Green for low/normal risk
  }
}

/**
 * Get risk level badge variant
 */
export function getRiskBadgeClass(riskLevel: string): string {
  const level = riskLevel?.trim() || '';
  
  if (level === '高' || level.includes('高')) {
    return 'bg-[#FF3B3B]/10 text-[#FF3B3B] border-[#FF3B3B]/20';
  } else if (level === '中' || level.includes('中')) {
    return 'bg-[#FACC15]/10 text-[#FACC15] border-[#FACC15]/20';
  } else {
    return 'bg-[#00FFA3]/10 text-[#00FFA3] border-[#00FFA3]/20';
  }
}

/**
 * Get status badge class
 */
export function getStatusBadgeClass(status: string): string {
  const statusText = status?.trim() || '';
  
  if (statusText === '已完成' || statusText.includes('完成')) {
    return 'bg-[#00FFA3]/10 text-[#00FFA3] border-[#00FFA3]/20';
  } else if (statusText === '进行中' || statusText.includes('进行')) {
    return 'bg-[#00B4FF]/10 text-[#00B4FF] border-[#00B4FF]/20';
  } else if (statusText === '已超时' || statusText.includes('超时')) {
    return 'bg-[#FF3B3B]/10 text-[#FF3B3B] border-[#FF3B3B]/20';
  } else {
    return 'bg-white/5 text-[#8B949E] border-white/10';
  }
}

/**
 * Calculate project statistics based EXCLUSIVELY on 当前节点 (Current Node)
 * SINGLE SOURCE OF TRUTH - Ignore all other columns for status determination
 * 
 * Strict Mapping:
 * - "已完成" (Completed) → Green Theme
 * - "已超时" (Overdue) → Red Theme
 * - "进行中" (Ongoing) → Blue Theme
 * - Anything else or empty → Do NOT count, treat as null
 */
export function calculateStats(projects: ProjectData[]): ProjectStats {
  const stats: ProjectStats = {
    total: projects.length,
    highRisk: 0,  // Now represents "已超时" (Overdue) ONLY
    inProgress: 0,
    completed: 0
  };
  
  projects.forEach(project => {
    const currentNode = project.milestones?.currentNode?.trim() || ''; // No default, treat empty as null
    
    // Strict matching - only count exact matches
    if (currentNode === '已完成') {
      stats.completed++;
    } else if (currentNode === '已超时') {
      stats.highRisk++;
    } else if (currentNode === '进行中') {
      stats.inProgress++;
    }
    // Anything else: do NOT count in any category
  });
  
  return stats;
}

/**
 * Format date string for display
 */
export function formatDate(dateStr: string): string {
  if (!dateStr || dateStr === '-' || dateStr === 'N/A') {
    return '-';
  }
  
  try {
    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    
    // Try to parse as date
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    
    return dateStr;
  } catch {
    return dateStr;
  }
}

/**
 * Get display value with fallback
 */
export function getDisplayValue(value: string | undefined | null, fallback: string = '-'): string {
  if (!value || value === 'undefined' || value === 'null' || value === '-') {
    return fallback;
  }
  return value;
}

/**
 * Check if project is high risk (for red border highlighting)
 * @deprecated Use getCardVisualState instead
 */
export function isHighRisk(riskLevel: string): boolean {
  const level = riskLevel?.trim() || '';
  return level === '高' || level.includes('高');
}

/**
 * Get card visual state based EXCLUSIVELY on 当前节点 (Current Node)
 * SINGLE SOURCE OF TRUTH - Returns visual styling configuration
 * 
 * Strict Mapping:
 * - "已完成" → Green border + Light green background
 * - "已超时" → Red border + Light red background
 * - "进行中" → Blue border + White background
 * - Anything else → Neutral style, no badge
 */
export function getCardVisualState(currentNode: string | undefined) {
  const node = currentNode?.trim() || ''; // No default, treat empty as null
  
  // Case A: 已完成 (Completed) - Green Theme
  if (node === '已完成') {
    return {
      type: 'completed' as const,
      borderClass: 'border border-[#00FFA3]/30',
      bgClass: 'bg-[#151B23]',
      badgeClass: 'bg-[#00FFA3]/10 text-[#00FFA3] border-[#00FFA3]/20',
      badgeLabel: '已完成',
      showBadge: true
    };
  }
  
  // Case B: 已超时 (Overdue) - Red Theme
  if (node === '已超时') {
    return {
      type: 'overdue' as const,
      borderClass: 'border border-[#FF3B3B]/30',
      bgClass: 'bg-[#151B23]',
      badgeClass: 'bg-[#FF3B3B]/10 text-[#FF3B3B] border-[#FF3B3B]/20',
      badgeLabel: '已超时',
      showBadge: true
    };
  }
  
  // Case C: 进行中 (Ongoing) - Yellow Theme
  if (node === '进行中') {
    return {
      type: 'ongoing' as const,
      borderClass: 'border border-[#FACC15]/30',
      bgClass: 'bg-[#151B23]',
      badgeClass: 'bg-[#FACC15]/10 text-[#FACC15] border-[#FACC15]/20',
      badgeLabel: '进行中',
      showBadge: true
    };
  }
  
  // Default: Null/Unknown - Neutral style, no badge
  return {
    type: 'unknown' as const,
    borderClass: 'border border-white/[0.04]',
    bgClass: 'bg-[#151B23]',
    badgeClass: 'bg-white/5 text-[#6E7681] border-white/10',
    badgeLabel: 'N/A',
    showBadge: false
  };
}

/**
 * Parse FAI value to percentage format
 * Handles both decimal (0.9) and percentage (90%) inputs
 * Returns formatted string like "90%"
 */
export function parseFAIValue(value: string | undefined | null): string {
  if (!value || value === '-' || value === 'N/A') {
    return '-';
  }
  
  const strValue = String(value).trim();
  
  // If already has %, just return it
  if (strValue.includes('%')) {
    return strValue;
  }
  
  // Try to parse as number
  const numValue = parseFloat(strValue);
  if (isNaN(numValue)) {
    return strValue; // Return as-is if not a number
  }
  
  // If value is between 0 and 1, treat as decimal (e.g., 0.9 = 90%)
  if (numValue > 0 && numValue <= 1) {
    return `${Math.round(numValue * 100)}%`;
  }
  
  // If value is 1, treat as 100%
  if (numValue === 1) {
    return '100%';
  }
  
  // If value is greater than 1, assume it's already a percentage
  return `${Math.round(numValue)}%`;
}

/**
 * Get FAI color class based on value (traffic light system)
 * < 100% = Red (alert)
 * = 100% = Green (pass)
 */
export function getFAIColorClass(value: string | undefined | null): string {
  const parsed = parseFAIValue(value);
  
  // Extract numeric value from percentage string
  const numericMatch = parsed.match(/\d+/);
  if (!numericMatch) {
    return 'text-[#FF3B3B] font-bold';
  }
  
  const numValue = parseInt(numericMatch[0], 10);
  
  if (numValue === 100) {
    return 'text-[#00FFA3] font-bold'; // Green for 100%
  } else {
    return 'text-[#FF3B3B] font-bold'; // Red for < 100%
  }
}

/**
 * Module 2 field definitions for completeness calculation
 */
const MODULE_2_FIELDS = [
  'milestones.projectStart',
  'milestones.t1',
  'milestones.glTime',
  'milestones.vmp',
  'milestones.mp',
  'milestones.currentStage',
  'milestones.trialCount',
  'milestones.toolingFAI',
  'milestones.partFAI',
  'milestones.t1SizeQualified',
] as const;

/**
 * Check if a field value is considered empty
 */
function isFieldEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' || trimmed === '-' || trimmed === 'N/A';
  }
  return false;
}

/**
 * Calculate Module 2 completeness percentage
 */
export function calculateCompleteness(project: ProjectData): number {
  const totalFields = MODULE_2_FIELDS.length;
  let filledFields = 0;

  for (const fieldPath of MODULE_2_FIELDS) {
    const value = getNestedValue(project, fieldPath);
    if (!isFieldEmpty(value)) {
      filledFields++;
    }
  }

  return Math.round((filledFields / totalFields) * 100);
}

/**
 * Get list of missing fields in Module 2
 */
export function getMissingFields(project: ProjectData): string[] {
  const fieldLabels: Record<string, string> = {
    'milestones.projectStart': '项目启动时间',
    'milestones.t1': 'T1时间',
    'milestones.glTime': 'G/L时间',
    'milestones.vmp': 'VMP时间',
    'milestones.mp': 'MP时间',
    'milestones.currentStage': '当前阶段',
    'milestones.trialCount': '试模次数',
    'milestones.toolingFAI': 'Tooling FAI',
    'milestones.partFAI': 'Part FAI',
    'milestones.t1SizeQualified': 'T1尺寸是否达标',
  };

  const missingFields: string[] = [];

  for (const fieldPath of MODULE_2_FIELDS) {
    const value = getNestedValue(project, fieldPath);
    if (isFieldEmpty(value)) {
      missingFields.push(fieldLabels[fieldPath] || fieldPath);
    }
  }

  return missingFields;
}
