import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL("../app/page.tsx", import.meta.url);
const layoutUrl = new URL("../app/layout.tsx", import.meta.url);
const cssUrl = new URL("../app/globals.css", import.meta.url);
const pdfParserUrl = new URL("../app/pdf-parser.ts", import.meta.url);
const packageUrl = new URL("../package.json", import.meta.url);

test("contains the student report and upload workflow", async () => {
  const page = await readFile(pageUrl, "utf8");

  assert.match(page, /DYB SCORE/);
  assert.match(page, /엑셀\/PDF 업로드/);
  assert.match(page, /accept="\.xls,\.xlsx,\.pdf/);
  assert.match(page, /같은 이름의 엑셀 성적표를 먼저 업로드/);
  assert.match(page, /fileBase\(exam\.filename\) === fileBase\(file\.name\)/);
  assert.match(page, /pairPdf/);
  assert.match(page, /PDF 연결 완료/);
  assert.doesNotMatch(page, /성적 흐름을 한눈에|상담은 더 정확하게|STUDENT PERFORMANCE|시험별 영어 영역 점수와 석차를 연결/);
  assert.match(page, /localStorage/);
  assert.match(page, /백업 저장/);
  assert.match(page, /백업 복원/);
  assert.match(page, /등록한 성적표/);
  assert.match(page, /setTrendMetric\("total"\)/);
  assert.match(page, /aria-pressed/);
  assert.match(page, /score\[trendMetric\]/);
  assert.match(page, /previousScore/);
  assert.match(page, /delta !== undefined && <Delta/);
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
  assert.match(page, /nationalPercentile\.toFixed\(1\)/);
  assert.match(page, /campusPercentile\.toFixed\(1\)/);
  assert.match(page, /profile-total-button/);
  assert.match(page, /rank-card-grid/);
  assert.doesNotMatch(page, /전국 · 캠퍼스/);
  assert.doesNotMatch(page, /label === "캠퍼스 석차" \? <div className="meter"/);
  assert.match(page, /회 미응시/);
  assert.match(page, /attended.*yearExams\.length/);
  assert.match(page, /className="horizontal-timeline"/);
  assert.match(page, /horizontal-bar-row/);
  assert.match(page, /score-progress-single/);
  assert.match(page, /score-track-marker average/);
  assert.match(page, /score-track-marker top-ten/);
  assert.match(page, /score-track-marker student/);
  assert.match(page, /maxScore=\{activeTrend\.max\}/);
  assert.match(page, /campus-bar/);
  assert.match(page, /national-bar/);
  assert.match(page, /100 - rankMetric\.campusPercentile/);
  assert.match(page, /100 - rankMetric\.nationalPercentile/);
  assert.match(page, /campusPercentile\.toFixed\(1\).*%/);
  assert.match(page, /nationalPercentile\.toFixed\(1\).*%/);
  assert.match(page, /percentileAxis/);
  assert.match(page, /전국·캠퍼스 석차 변화/);
  assert.match(page, /학생점수/);
  assert.match(page, /전체평균/);
  assert.match(page, /상위 10% 평균/);
  assert.doesNotMatch(page, /exam\.rows\.length\}명 등록/);
  assert.doesNotMatch(page, />파일 추가</);
  assert.match(page, /className="exam-tabs card"/);
  assert.match(page, /<ComparisonBar/);
  assert.match(page, /전체 평균/);
  assert.match(page, /10% 평균/);
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

test("aligns rank headings with rank values", async () => {
  const css = await readFile(cssUrl, "utf8");
  assert.match(css, /th:nth-child\(6\),th:nth-child\(7\)\{padding-right:90px\}/);
  assert.match(css, /\.legend\{gap:18px;font-size:14px/);
  assert.match(css, /\.profile-total-button\{position:absolute;top:14px;left:92px.*font-size:16px/);
  assert.match(css, /\.profile-total-button\{left:24px\}/);
  assert.match(css, /\.horizontal-track\{height:27px/);
});

test("parses paired PDF report fields in the browser", async () => {
  const parser = await readFile(pdfParserUrl, "utf8");
  const packageJson = JSON.parse(await readFile(packageUrl, "utf8"));

  assert.equal(packageJson.dependencies["pdfjs-dist"], "3.11.174");
  assert.match(parser, /pdfjs-dist\/legacy\/build\/pdf\.js/);
  assert.match(parser, /previousScore/);
  assert.match(parser, /average/);
  assert.match(parser, /top10Average/);
  assert.match(parser, /nationalPercentile/);
  assert.match(parser, /campusPercentile/);
  assert.match(parser, /PDF 장표에서 시험 연도와 월/);
});
