import { describe, expect, it, beforeAll } from 'vitest';
import * as XLSX from 'xlsx';
import { parseExcelFile } from './projectUtils';

class MockFileReader {
  onload: ((event: { target: { result: string } }) => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;

  async readAsBinaryString(file: Blob) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const binary = buffer.toString('binary');
      this.onload?.({ target: { result: binary } });
    } catch (error) {
      this.onerror?.(error);
    }
  }
}

describe('parseExcelFile', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'FileReader', {
      configurable: true,
      writable: true,
      value: MockFileReader,
    });
  });

  it('parses a standard dashboard project worksheet', async () => {
    const rows = [
      ['NO.', '项目名称', '产品名称', '模具编号', '当前节点', '项目启动时间', '日期', '项目推进细节'],
      ['1', 'Bioko M', 'Wheel', 'LA26021', '进行中', '2026-04-28', '2026-04-29', '正常推进'],
    ];

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    const output = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const file = new File([output], 'project-upload.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const projects = await parseExcelFile(file);

    expect(projects).toHaveLength(1);
    expect(projects[0]?.identity.projectName).toBe('Bioko M');
    expect(projects[0]?.identity.moldNumber).toBe('LA26021');
    expect(projects[0]?.milestones.currentNode).toBe('进行中');
    expect(projects[0]?.details.detailProgress).toBe('正常推进');
  });
});
