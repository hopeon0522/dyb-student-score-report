import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('student theme stays scoped and retains responsive/accessibility states', async () => {
  const css = await readFile(new URL('../app/student-design.css', import.meta.url), 'utf8');
  const journal = await readFile(new URL('../app/learning-journal.css', import.meta.url), 'utf8');
  assert.match(css, /\.student-view/);
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(journal, /max-width:800px/);
  assert.match(journal, /max-width:600px/);
  assert.match(journal, /--navy:/);
  assert.match(journal, /\.student-view \.metric-grid/);
});

test('report navigation, pending state and existing storage contract remain', async () => {
  const page = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /view === "main" \? "student-view"/);
  assert.match(page, /dyb-score-report-data-v1/);
  assert.match(page, /aria-busy="true"/);
  assert.match(page, /검색 결과가 없습니다/);
  assert.match(page, /id="student-report"/);
  assert.match(page, /id="progress"/);
  assert.match(page, /id="detail"/);
  assert.match(page, /scrollIntoView/);
  assert.match(page, /MY LEARNING JOURNAL/);
  assert.match(page, /const initialExams: Exam\[\] = \[\]/);
});
