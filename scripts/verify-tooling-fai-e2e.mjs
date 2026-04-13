import 'dotenv/config';

import { chromium } from 'playwright';
import * as XLSX from 'xlsx';

const frontendUrl = process.env.TOOLING_FAI_E2E_FRONTEND_URL || 'http://localhost:3000/dashboard';
const apiBaseUrl = process.env.TOOLING_FAI_E2E_API_URL || 'http://localhost:3001';
const apiKey = process.env.API_SECRET_KEY || '';

function buildStateUrl({ moldId, moldNo, trialStage }) {
  const params = new URLSearchParams({
    moldId,
    moldNo: moldNo || '',
    trialStage: trialStage || 'T0',
  });

  return `${apiBaseUrl}/api/dashboard/tooling-fai-state?${params.toString()}`;
}

async function requestJson(url, init = {}) {
  const headers = new Headers(init.headers || {});
  if (init.method && init.method !== 'GET' && init.method !== 'HEAD' && apiKey) {
    headers.set('x-api-key', apiKey);
  }

  const response = await fetch(url, { ...init, headers });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && typeof payload.error === 'string'
      ? payload.error
      : `${init.method || 'GET'} ${url} failed`;
    throw new Error(message);
  }

  return payload;
}

async function fetchProjects() {
  const payload = await requestJson(`${apiBaseUrl}/api/dashboard/projects`);
  return Array.isArray(payload) ? payload : [];
}

function chooseModuleName(rows) {
  const groups = new Map();

  for (const row of rows) {
    const moduleName = String(row?.projectName || '').trim();
    const moldId = String(row?.moldId || '').trim();
    if (!moduleName || !moldId) {
      continue;
    }

    const bucket = groups.get(moduleName) || new Set();
    bucket.add(moldId);
    groups.set(moduleName, bucket);
  }

  for (const [moduleName, moldIds] of groups.entries()) {
    if (moldIds.size >= 2) {
      return moduleName;
    }
  }

  throw new Error('No dashboard module with at least two mold panels was found.');
}

function buildWorkbookBuffer() {
  const rows = Array.from({ length: 7 }, () => []);
  rows.push([
    'FAI-1',
    '1-1',
    10,
    0.02,
    0.02,
    9.98,
    10,
    0.01,
    0.01,
    'EDM',
    10,
    10.01,
    9.99,
    10,
    4,
    4,
  ]);

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, 'ToolingFAI');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

async function readToolingSection(page) {
  const heading = page.getByText('TOOLING FAI PARSING DATA / 模具尺寸解析');
  await heading.waitFor({ timeout: 30000 });
  return heading.locator('xpath=ancestor::section[1]');
}

async function readVisibleIdentity(toolingSection) {
  const metaContainer = toolingSection.locator('xpath=.//div[contains(@class,"font-mono") and contains(@class,"tracking-widest")]').first();
  const chips = (await metaContainer.locator('span').allTextContents())
    .map((value) => value.trim())
    .filter(Boolean);

  const values = chips.filter((value) => !/^current sheet only$/i.test(value));
  if (values.length < 2) {
    throw new Error(`Unexpected tooling identity chips: ${JSON.stringify(chips)}`);
  }

  if (/^T\d+/i.test(values[1])) {
    return {
      moldId: values[0],
      moldNo: '',
      trialStage: values[1],
    };
  }

  return {
    moldId: values[0],
    moldNo: values[1] || '',
    trialStage: values[2] || 'T0',
  };
}

async function backupState(identity) {
  const payload = await requestJson(buildStateUrl(identity));
  return {
    identity,
    state: payload?.state ?? null,
  };
}

async function restoreState(snapshot) {
  if (!snapshot) {
    return;
  }

  if (snapshot.state) {
    await requestJson(`${apiBaseUrl}/api/dashboard/tooling-fai-state`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(snapshot.state),
    });
    return;
  }

  await requestJson(buildStateUrl(snapshot.identity), {
    method: 'DELETE',
  });
}

async function openPanelDrawer(page) {
  await page.getByRole('button', { name: /选择模号/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ timeout: 15000 });
  return dialog;
}

async function collectPanelButtons(dialog) {
  const panelButtons = dialog.locator('button').filter({ hasText: /LA\d+/ });
  const count = await panelButtons.count();
  if (count < 2) {
    throw new Error(`Expected at least 2 mold panels, found ${count}.`);
  }

  return {
    first: panelButtons.nth(0),
    second: panelButtons.nth(1),
    firstText: (await panelButtons.nth(0).innerText()).trim(),
    secondText: (await panelButtons.nth(1).innerText()).trim(),
  };
}

async function waitForIdentity(toolingSection, moldId) {
  await toolingSection.getByText(moldId, { exact: true }).waitFor({ timeout: 15000 });
}

async function main() {
  const rows = await fetchProjects();
  const moduleName = chooseModuleName(rows);
  const fileName = `tooling-fai-e2e-${Date.now()}.xlsx`;
  const buffer = buildWorkbookBuffer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const snapshots = [];

  try {
    await page.goto(frontendUrl, { waitUntil: 'domcontentloaded' });
    await page.getByText('项目大厅').waitFor({ timeout: 30000 });
    await page.getByRole('button', { name: new RegExp(moduleName) }).first().click();
    await page.getByText(`${moduleName} 系列主看板`).waitFor({ timeout: 30000 });
    await page.getByRole('button', { name: '试模数据库' }).click();

    const toolingSection = await readToolingSection(page);
    const firstDrawer = await openPanelDrawer(page);
    const { first, second, firstText, secondText } = await collectPanelButtons(firstDrawer);
    await first.click();

    const firstIdentity = await readVisibleIdentity(toolingSection);
    snapshots.push(await backupState(firstIdentity));

    const uploadPromise = page.waitForResponse((response) => {
      return response.url().includes('/api/dashboard/tooling-fai-state') && response.request().method() === 'PUT';
    }, { timeout: 30000 });
    await toolingSection.locator('input[type="file"]').setInputFiles({
      name: fileName,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    });
    const uploadResponse = await uploadPromise;
    if (!uploadResponse.ok()) {
      throw new Error(`Tooling FAI upload save request failed with ${uploadResponse.status()}.`);
    }

    await toolingSection.getByText(fileName, { exact: true }).waitFor({ timeout: 30000 });

    const secondDrawer = await openPanelDrawer(page);
    const refreshedPanels = await collectPanelButtons(secondDrawer);
    await refreshedPanels.second.click();
    await waitForIdentity(toolingSection, secondText.split(/\s+/)[0]);

    const secondIdentity = await readVisibleIdentity(toolingSection);
    snapshots.push(await backupState(secondIdentity));

    if (await toolingSection.getByText(fileName, { exact: true }).count()) {
      throw new Error('Tooling FAI file name leaked into the second mold panel.');
    }

    const thirdDrawer = await openPanelDrawer(page);
    const finalPanels = await collectPanelButtons(thirdDrawer);
    await finalPanels.first.click();
    await waitForIdentity(toolingSection, firstText.split(/\s+/)[0]);
    await toolingSection.getByText(fileName, { exact: true }).waitFor({ timeout: 30000 });

    const summary = {
      moduleName,
      firstPanel: firstIdentity,
      secondPanel: secondIdentity,
      fileName,
      verified: true,
    };

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    for (const snapshot of snapshots.reverse()) {
      try {
        await restoreState(snapshot);
      } catch (error) {
        console.error('Failed to restore tooling FAI state snapshot:', error);
      }
    }
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});