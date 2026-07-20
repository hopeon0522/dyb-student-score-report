import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../app/page.tsx", import.meta.url);
const layoutUrl = new URL("../app/layout.tsx", import.meta.url);

test("contains the student report and upload workflow", async () => {
  const page = await readFile(pageUrl, "utf8");

  assert.match(page, /DYB SCORE/);
  assert.match(page, /성적표 업로드/);
  assert.doesNotMatch(page, /성적 흐름을 한눈에|상담은 더 정확하게|STUDENT PERFORMANCE|시험별 영어 영역 점수와 석차를 연결/);
  assert.match(page, /localStorage/);
  assert.match(page, /백업 저장/);
  assert.match(page, /백업 복원/);
  assert.match(page, /등록한 성적표/);
  assert.match(page, /setTrendMetric\("total"\)/);
  assert.match(page, /aria-pressed/);
  assert.match(page, /score\[trendMetric\]/);
  assert.match(page, /previousScore/);
  assert.match(page, /change !== undefined.*<Delta/);
  assert.match(page, /activeTrend\.label.*성적 변화/);
  assert.match(page, /데이터 없음/);
  assert.match(page, /DOMParser/);
  assert.match(page, /수험번호/);
  assert.match(page, /전국석차/);
  assert.match(page, /캠퍼스석차/);
  assert.match(page, /score\.nationalRank - previousScore\.nationalRank/);
  assert.match(page, /score\.campusRank - previousScore\.campusRank/);
  assert.match(page, /className="rank-cell"/);
  assert.match(page, /className="rank-delta-slot"/);
  assert.match(page, /검색어 지우기/);
  assert.match(page, /view === "settings"/);
  assert.match(page, /연도 선택/);
  assert.match(page, /setActiveYear/);
  assert.match(page, /파일명 맨 앞에 연도와 월/);
  assert.match(page, />총원</);
  assert.doesNotMatch(page, /등록 학생|데이터 공백 학생|학생 성장 리포트/);
  assert.match(page, /const initialExams: Exam\[\] = \[\]/);
  assert.doesNotMatch(page, /const (feb|may): Score\[\]/);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
});

test("uses the finished Korean site metadata", async () => {
  const layout = await readFile(layoutUrl, "utf8");

  assert.match(layout, /lang="ko"/);
  assert.match(layout, /title: "DYB SCORE"/);
  assert.match(layout, /학생 성적관리 도구/);
  assert.doesNotMatch(layout, /Starter Project|Your site is taking shape/);
});
