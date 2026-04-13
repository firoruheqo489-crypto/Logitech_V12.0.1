import 'dotenv/config';

import { chromium } from 'playwright';

const frontendUrl = process.env.MOLD_TRIAL_EVIDENCE_E2E_FRONTEND_URL || 'http://localhost:3000/dashboard';
const apiBaseUrl = process.env.MOLD_TRIAL_EVIDENCE_E2E_API_URL || 'http://localhost:3001';
const apiKey = process.env.API_SECRET_KEY || '';
const DEFAULT_TRIAL_STAGE = 'T0';
const PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WnKxSkAAAAASUVORK5CYII=',
  'base64',
);

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildEvidenceStateUrl({ moldId, moldNo }) {
  const params = new URLSearchParams({
    moldId,
    moldNo: moldNo || '',
  });

  return `${apiBaseUrl}/api/dashboard/mold-trial-evidence-state?${params.toString()}`;
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

async function fetchEvidenceState(identity) {
  const payload = await requestJson(buildEvidenceStateUrl(identity));
  return payload?.state ?? null;
}

async function restoreEvidenceState(snapshot) {
  if (!snapshot) {
    return;
  }

  if (snapshot.state) {
    await requestJson(`${apiBaseUrl}/api/dashboard/mold-trial-evidence-state`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(snapshot.state),
    });
    return;
  }

  await requestJson(buildEvidenceStateUrl(snapshot.identity), {
    method: 'DELETE',
  });
}

async function deleteUploadedAsset(url) {
  if (!url) {
    return;
  }

  await requestJson(`${apiBaseUrl}/api/uploads/assets`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });
}

function normalizeSlotsForStage(state, trialStage) {
  const rawSlots = Array.isArray(state?.stagesByScope?.[trialStage]?.slots)
    ? state.stagesByScope[trialStage].slots
    : [];

  return Array.from({ length: 15 }, (_, index) => {
    const fallbackId = `${trialStage}-slot-${index + 1}`;
    const slot = rawSlots.find((item) => item && item.id === fallbackId) || rawSlots[index] || {};
    return {
      id: typeof slot.id === 'string' && slot.id.trim() ? slot.id.trim() : fallbackId,
      imageUrl: typeof slot.imageUrl === 'string' ? slot.imageUrl.trim() : '',
    };
  });
}

function getStageSummary(state, trialStage) {
  const slots = normalizeSlotsForStage(state, trialStage);
  const moldTempCount = slots.slice(0, 5).filter((slot) => slot.imageUrl).length;
  const defectCount = slots.slice(5, 15).filter((slot) => slot.imageUrl).length;
  const groupNote = typeof state?.stagesByScope?.[trialStage]?.groupNote === 'string'
    ? state.stagesByScope[trialStage].groupNote.trim()
    : '';

  return {
    moldTempCount,
    defectCount,
    groupNote,
    slots,
  };
}

function collectEvidenceUrls(state) {
  if (!state || typeof state !== 'object' || !state.stagesByScope || typeof state.stagesByScope !== 'object') {
    return new Set();
  }

  const urls = new Set();
  for (const stageState of Object.values(state.stagesByScope)) {
    if (!stageState || typeof stageState !== 'object' || !Array.isArray(stageState.slots)) {
      continue;
    }

    for (const slot of stageState.slots) {
      if (slot && typeof slot.imageUrl === 'string' && slot.imageUrl.trim()) {
        urls.add(slot.imageUrl.trim());
      }
    }
  }

  return urls;
}

async function chooseEvidenceCandidates(rows) {
  const groups = new Map();

  for (const row of rows) {
    const moduleName = String(row?.projectName || '').trim();
    const moldId = String(row?.moldId || '').trim();
    const moldNo = String(row?.moldNo || '').trim();
    if (!moduleName || !moldId) {
      continue;
    }

    const key = `${moldId}::${moldNo}`;
    const bucket = groups.get(moduleName) || new Map();
    if (!bucket.has(key)) {
      bucket.set(key, { moldId, moldNo });
    }
    groups.set(moduleName, bucket);
  }

  for (const [moduleName, bucket] of groups.entries()) {
    const candidates = [];
    for (const identity of bucket.values()) {
      const state = await fetchEvidenceState(identity).catch(() => null);
      const summary = getStageSummary(state, DEFAULT_TRIAL_STAGE);
      const hasEmptyMoldTempSlot = summary.moldTempCount < 5;
      const hasEmptyDefectSlot = summary.defectCount < 10;

      candidates.push({
        identity,
        baselineState: state,
        baselineSummary: summary,
        score: Number(hasEmptyMoldTempSlot && hasEmptyDefectSlot),
      });
    }

    const sorted = candidates.sort((left, right) => right.score - left.score);
    if (sorted.length >= 2 && sorted[0].score > 0) {
      return {
        moduleName,
        first: sorted[0],
        second: sorted[1],
      };
    }
  }

  throw new Error('No dashboard module with two mold panels suitable for evidence refresh verification was found.');
}

async function ensureMoldTrialPage(page, moduleName) {
  const timeoutAt = Date.now() + 30000;

  while (Date.now() < timeoutAt) {
    if (await page.getByText('试模数据档案 / MOLD TRIAL DATABASE').count()) {
      return;
    }

    const moduleButton = page.getByRole('button', { name: new RegExp(escapeRegExp(moduleName)) }).first();
    if (await moduleButton.count()) {
      await moduleButton.click().catch(() => undefined);
      await page.waitForTimeout(800);
      continue;
    }

    const trialButton = page.getByRole('button', { name: '试模数据库' });
    if (await trialButton.count()) {
      await trialButton.click().catch(() => undefined);
      await page.waitForTimeout(800);
      continue;
    }

    await page.waitForTimeout(500);
  }

  await page.getByText('试模数据档案 / MOLD TRIAL DATABASE').waitFor({ timeout: 30000 });
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
    trialStage: values[2] || DEFAULT_TRIAL_STAGE,
  };
}

async function openPanelDrawer(page) {
  await page.getByRole('button', { name: /选择模号/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ timeout: 15000 });
  return dialog;
}

async function selectPanel(page, identity) {
  const dialog = await openPanelDrawer(page);
  const parts = [escapeRegExp(identity.moldId)];
  if (identity.moldNo) {
    parts.push(escapeRegExp(identity.moldNo));
  }
  const panelButton = dialog.getByRole('button', {
    name: new RegExp(parts.join('.*'), 'i'),
  }).first();
  await panelButton.click();
}

async function ensureTrialStage(page, trialStage) {
  await page.getByRole('button', { name: new RegExp(`^${escapeRegExp(trialStage)}$`) }).click();
}

async function getSectionByHeading(page, headingText) {
  const heading = page.getByText(headingText);
  await heading.waitFor({ timeout: 30000 });
  return heading.locator('xpath=ancestor::section[1]');
}

async function clickFirstEmptySlotUpload(section) {
  const emptyCard = section.locator('xpath=.//div[contains(@class,"group relative")][not(.//img)]').first();
  await emptyCard.waitFor({ timeout: 30000 });
  await emptyCard.getByRole('button', { name: '上传' }).click();
}

async function setEvidenceFiles(page, files) {
  await page.locator('input[type="file"][multiple]').setInputFiles(files);
}

async function waitForEvidenceState(identity, trialStage, predicate, message) {
  const timeoutAt = Date.now() + 30000;
  while (Date.now() < timeoutAt) {
    const state = await fetchEvidenceState(identity).catch(() => null);
    if (predicate(state)) {
      return state;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(message);
}

function buildFilePayload(name) {
  return {
    name,
    mimeType: 'image/png',
    buffer: PNG_BUFFER,
  };
}

async function countSectionImages(section) {
  return section.locator('img').count();
}

async function waitForEvidenceUiState({
  moldTempSection,
  defectSection,
  noteField,
  expectedNote,
  minMoldTempCount,
  minDefectCount,
  exactMoldTempCount,
  exactDefectCount,
}) {
  const timeoutAt = Date.now() + 30000;

  while (Date.now() < timeoutAt) {
    const moldTempCount = await countSectionImages(moldTempSection);
    const defectCount = await countSectionImages(defectSection);
    const noteValue = (await noteField.inputValue()).trim();

    const moldTempMatches = typeof exactMoldTempCount === 'number'
      ? moldTempCount === exactMoldTempCount
      : moldTempCount >= (minMoldTempCount || 0);
    const defectMatches = typeof exactDefectCount === 'number'
      ? defectCount === exactDefectCount
      : defectCount >= (minDefectCount || 0);
    const noteMatches = noteValue === (expectedNote || '');

    if (moldTempMatches && defectMatches && noteMatches) {
      return { moldTempCount, defectCount, noteValue };
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return {
    moldTempCount: await countSectionImages(moldTempSection),
    defectCount: await countSectionImages(defectSection),
    noteValue: (await noteField.inputValue()).trim(),
  };
}

async function main() {
  const rows = await fetchProjects();
  const selection = await chooseEvidenceCandidates(rows);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const snapshots = [];
  let uploadedAssetUrls = new Set();
  let firstVisibleIdentity = null;
  let secondVisibleIdentity = null;

  try {
    await page.goto(frontendUrl, { waitUntil: 'domcontentloaded' });
    await ensureMoldTrialPage(page, selection.moduleName);

    await selectPanel(page, selection.first.identity);
    await ensureTrialStage(page, DEFAULT_TRIAL_STAGE);

    const toolingSection = await readToolingSection(page);
    firstVisibleIdentity = await readVisibleIdentity(toolingSection);
    snapshots.push({ identity: firstVisibleIdentity, state: selection.first.baselineState });

    const moldTempSection = await getSectionByHeading(page, '现场模温照片 / MOLD TEMP PHOTOS');
    const defectSection = await getSectionByHeading(page, '试模缺陷与物理证据 / DEFECT EVIDENCE GALLERY');
    const noteField = page.locator('#evidence-group-note');
    const baselineFirst = selection.first.baselineSummary;
    const baselineSecond = selection.second.baselineSummary;
    const noteText = `e2e-note-${Date.now()}`;

    await clickFirstEmptySlotUpload(moldTempSection);
    await setEvidenceFiles(page, [buildFilePayload(`mold-temp-${Date.now()}.png`)]);

    await clickFirstEmptySlotUpload(defectSection);
    await setEvidenceFiles(page, [buildFilePayload(`defect-${Date.now()}.png`)]);

    await noteField.fill(noteText);
    await defectSection.getByRole('button', { name: '保存记录 / SAVE' }).click();

    const persistedFirstState = await waitForEvidenceState(
      firstVisibleIdentity,
      DEFAULT_TRIAL_STAGE,
      (state) => {
        const summary = getStageSummary(state, DEFAULT_TRIAL_STAGE);
        return summary.moldTempCount >= baselineFirst.moldTempCount + 1
          && summary.defectCount >= baselineFirst.defectCount + 1
          && summary.groupNote === noteText;
      },
      'Evidence state did not persist after uploads and note save.',
    );

    uploadedAssetUrls = new Set(
      [...collectEvidenceUrls(persistedFirstState)].filter((url) => !collectEvidenceUrls(selection.first.baselineState).has(url)),
    );

    await page.reload({ waitUntil: 'domcontentloaded' });
    await ensureMoldTrialPage(page, selection.moduleName);
    await selectPanel(page, selection.first.identity);
    await ensureTrialStage(page, DEFAULT_TRIAL_STAGE);

    const refreshedMoldTempSection = await getSectionByHeading(page, '现场模温照片 / MOLD TEMP PHOTOS');
    const refreshedDefectSection = await getSectionByHeading(page, '试模缺陷与物理证据 / DEFECT EVIDENCE GALLERY');
    const refreshedNoteField = page.locator('#evidence-group-note');
    const refreshedUiState = await waitForEvidenceUiState({
      moldTempSection: refreshedMoldTempSection,
      defectSection: refreshedDefectSection,
      noteField: refreshedNoteField,
      expectedNote: noteText,
      minMoldTempCount: baselineFirst.moldTempCount + 1,
      minDefectCount: baselineFirst.defectCount + 1,
    });
    const refreshedMoldTempCount = refreshedUiState.moldTempCount;
    const refreshedDefectCount = refreshedUiState.defectCount;
    const refreshedNoteValue = refreshedUiState.noteValue;

    if (refreshedMoldTempCount < baselineFirst.moldTempCount + 1) {
      throw new Error(`Mold temp evidence did not survive refresh. Expected at least ${baselineFirst.moldTempCount + 1}, got ${refreshedMoldTempCount}.`);
    }

    if (refreshedDefectCount < baselineFirst.defectCount + 1) {
      throw new Error(`Defect evidence did not survive refresh. Expected at least ${baselineFirst.defectCount + 1}, got ${refreshedDefectCount}.`);
    }

    if (refreshedNoteValue.trim() !== noteText) {
      throw new Error(`Evidence group note did not survive refresh. Expected ${noteText}, got ${refreshedNoteValue}.`);
    }

    await selectPanel(page, selection.second.identity);
    await ensureTrialStage(page, DEFAULT_TRIAL_STAGE);
    secondVisibleIdentity = await readVisibleIdentity(await readToolingSection(page));
    snapshots.push({ identity: secondVisibleIdentity, state: selection.second.baselineState });

    const secondMoldTempSection = await getSectionByHeading(page, '现场模温照片 / MOLD TEMP PHOTOS');
    const secondDefectSection = await getSectionByHeading(page, '试模缺陷与物理证据 / DEFECT EVIDENCE GALLERY');
    const secondUiState = await waitForEvidenceUiState({
      moldTempSection: secondMoldTempSection,
      defectSection: secondDefectSection,
      noteField: page.locator('#evidence-group-note'),
      expectedNote: baselineSecond.groupNote,
      exactMoldTempCount: baselineSecond.moldTempCount,
      exactDefectCount: baselineSecond.defectCount,
    });
    const secondNoteValue = secondUiState.noteValue;
    const secondMoldTempCount = secondUiState.moldTempCount;
    const secondDefectCount = secondUiState.defectCount;

    if (secondMoldTempCount !== baselineSecond.moldTempCount) {
      throw new Error(`Mold temp evidence leaked into second panel. Expected ${baselineSecond.moldTempCount}, got ${secondMoldTempCount}.`);
    }

    if (secondDefectCount !== baselineSecond.defectCount) {
      throw new Error(`Defect evidence leaked into second panel. Expected ${baselineSecond.defectCount}, got ${secondDefectCount}.`);
    }

    if (secondNoteValue !== baselineSecond.groupNote) {
      throw new Error(`Evidence group note leaked into second panel. Expected ${baselineSecond.groupNote}, got ${secondNoteValue}.`);
    }

    console.log(JSON.stringify({
      moduleName: selection.moduleName,
      firstPanel: firstVisibleIdentity,
      secondPanel: secondVisibleIdentity,
      noteText,
      refreshedMoldTempCount,
      refreshedDefectCount,
      verified: true,
    }, null, 2));
  } finally {
    for (const snapshot of snapshots.reverse()) {
      try {
        await restoreEvidenceState(snapshot);
      } catch (error) {
        console.error('Failed to restore mold trial evidence snapshot:', error);
      }
    }

    for (const url of uploadedAssetUrls) {
      try {
        await deleteUploadedAsset(url);
      } catch (error) {
        console.error('Failed to delete uploaded evidence asset:', url, error);
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