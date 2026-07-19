import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../app/page.tsx", import.meta.url);
const layoutUrl = new URL("../app/layout.tsx", import.meta.url);

test("contains the student report and upload workflow", async () => {
  const page = await readFile(pageUrl, "utf8");

  assert.match(page, /DYB SCORE/);
  assert.match(page, /성적표 업로드/);
  assert.match(page, /시험별 성적 변화/);
  assert.match(page, /데이터 없음/);
  assert.match(page, /DOMParser/);
  assert.match(page, /수험번호/);
  assert.match(page, /전국석차/);
  assert.match(page, /캠퍼스석차/);
  assert.match(page, /const initialExams: Exam\[\] = \[\]/);
  assert.doesNotMatch(page, /const (feb|may): Score\[\]/);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
});

test("uses the finished Korean site metadata", async () => {
  const layout = await readFile(layoutUrl, "utf8");

  assert.match(layout, /lang="ko"/);
  assert.match(layout, /DYB 학생 성장 리포트/);
  assert.match(layout, /학생 성적관리 도구/);
  assert.doesNotMatch(layout, /Starter Project|Your site is taking shape/);
});
