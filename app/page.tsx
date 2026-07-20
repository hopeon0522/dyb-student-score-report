"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import type { PdfMetric, PdfMetricKey, PdfStudentRecord } from "./pdf-parser";

type Score = {
  name: string;
  studentId: string;
  grade: string;
  level: string;
  listening: number;
  grammar: number;
  reading: number;
  total: number;
  nationalRank: number;
  campusRank: number;
  pdfMetrics?: Record<PdfMetricKey, PdfMetric>;
};

type Exam = { id: string; label: string; filename: string; pdfFilename?: string; period: string; year: string; rows: Score[] };
type TrendMetric = "total" | "listening" | "grammar" | "reading" | "campusRank";
type View = "main" | "settings";

const initialExams: Exam[] = [];
const storageKey = "dyb-score-report-data-v1";

const getNumber = (value: string) => Number((value || "0").split("/")[0].replace(/,/g, ""));
const fileBase = (filename: string) => filename.normalize("NFC").replace(/\.(?:xlsx?|pdf)$/i, "").trim().toLocaleLowerCase("ko");
const studentNameKey = (name: string) => name.normalize("NFC").replace(/[A-Z]$/i, "").replace(/\s/g, "");

function examInfo(filename: string) {
  const base = filename.replace(/\.xls[x]?$/i, "").trim();
  const match = base.match(/^(\d{4})[.-](\d{1,2})\s+(.+)$/);
  if (!match) throw new Error("파일명 맨 앞에 연도와 월을 입력해 주세요. 예: 2026.02 중등 1차 형성평가.xls");
  const [, year, month, title] = match;
  const period = `${year.slice(2)}/${month.padStart(2, "0")}`;
  return { label: `${title}(${period})`, period, year };
}

function restoreExam(exam: Exam) {
  if (exam.year) return exam;
  return { ...exam, year: examInfo(exam.filename).year };
}

function parseHtmlExcel(text: string): Score[] {
  const doc = new DOMParser().parseFromString(text, "text/html");
  const tableRows = [...doc.querySelectorAll("tr")];
  const matrix = tableRows.map((tr) => [...tr.querySelectorAll("th,td")].map((cell) => (cell.textContent || "").trim()));
  const headerIndex = matrix.findIndex((row) => row.includes("이름") && row.includes("수험번호"));
  if (headerIndex < 0) throw new Error("이름과 수험번호 열을 찾을 수 없습니다.");
  const headers = matrix[headerIndex];
  const index = (name: string) => headers.findIndex((header) => header.replace(/\s/g, "") === name.replace(/\s/g, ""));
  return matrix.slice(headerIndex + 1).filter((row) => row[index("이름")] && row[index("수험번호")]).map((row) => ({
    name: row[index("이름")], studentId: row[index("수험번호")].padStart(7, "0"), grade: row[index("학년")] || "-", level: row[index("레벨")] || "-",
    listening: getNumber(row[index("Listening")]), grammar: getNumber(row[index("Grammar")]), reading: getNumber(row[index("Reading")]), total: getNumber(row[index("TOTAL")]),
    nationalRank: getNumber(row[index("전국석차")]), campusRank: getNumber(row[index("캠퍼스석차")]),
  }));
}

function pairPdf(exam: Exam, pdfFilename: string, pdfStudents: PdfStudentRecord[], period: string) {
  if (period !== exam.period) throw new Error(`PDF 시험 날짜(${period})가 엑셀 시험 날짜(${exam.period})와 다릅니다.`);
  const unmatched = [...pdfStudents];
  const rows = exam.rows.map((row) => {
    const matchedStudents = unmatched.filter((student) => studentNameKey(student.name) === studentNameKey(row.name) && student.level === row.level && (["listening", "grammar", "reading", "total"] as PdfMetricKey[]).every((key) => Math.abs(student.metrics[key].score - row[key]) < 0.01));
    if (!matchedStudents.length) throw new Error(`${row.name} 학생의 PDF 점수가 엑셀과 일치하지 않습니다.`);
    if (matchedStudents.length > 1) throw new Error(`${row.name} 학생이 PDF에 중복되어 자동 연결할 수 없습니다.`);
    const matched = matchedStudents[0];
    unmatched.splice(unmatched.indexOf(matched), 1);
    return { ...row, pdfMetrics: matched.metrics };
  });
  if (unmatched.length) throw new Error(`PDF의 ${unmatched[0].name} 학생을 엑셀에서 찾지 못했습니다.`);
  return { ...exam, pdfFilename, rows };
}

function Delta({ value, rank = false }: { value: number; rank?: boolean }) {
  const improved = rank ? value < 0 : value > 0;
  if (!value) return <span className="delta neutral">변화 없음</span>;
  return <span className={`delta ${improved ? "up" : "down"}`}>{improved ? "↑" : "↓"} {Math.abs(value).toLocaleString()}{rank ? "위" : "점"}</span>;
}

function ComparisonBar({ metric, score, maxScore }: { metric?: PdfMetric; score: number; maxScore: number }) {
  const position = (value: number) => `${Math.min(100, Math.max(0, (value / maxScore) * 100))}%`;
  const markerPosition = (value: number) => `${Math.min(94, Math.max(6, (value / maxScore) * 100))}%`;
  return <div className={`score-comparison ${metric ? "ready" : "pending"}`}>
    <div className="comparison-track"><i style={{ width: position(score) }} />
      {metric && <><span className="comparison-marker average" style={{ left: markerPosition(metric.average) }}><b>전체 평균</b><em>{metric.average}</em></span><span className="comparison-marker top-ten" style={{ left: markerPosition(metric.top10Average) }}><b>10% 평균</b><em>{metric.top10Average}</em></span></>}
    </div>
    {!metric && <small>동일 이름의 PDF를 연결하면 평균 비교가 표시됩니다.</small>}
  </div>;
}

function HorizontalProgressBar({ label, value, unit, width, color, delta, rank = false }: { label: string; value: number; unit: string; width: number; color: string; delta?: number; rank?: boolean }) {
  return <div className="horizontal-bar-row">
    <span className="horizontal-bar-label">{label}</span>
    <div className="horizontal-track"><i className={color} style={{ width: `${Math.min(100, Math.max(6, width))}%` }}><b>{value.toLocaleString()}{unit}</b></i></div>
    <span className="horizontal-delta">{delta !== undefined && <Delta value={delta} rank={rank} />}</span>
  </div>;
}

export default function Home() {
  const [exams, setExams] = useState(initialExams);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [view, setView] = useState<View>("main");
  const [activeYear, setActiveYear] = useState("");
  const [selectedExamId, setSelectedExamId] = useState("");
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("total");
  const [hydrated, setHydrated] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const restored = JSON.parse(saved) as Exam[];
        if (Array.isArray(restored)) {
          const normalized = restored.map(restoreExam);
          setExams(normalized);
          setActiveYear([...new Set(normalized.map((exam) => exam.year))].sort().at(-1) || "");
          setSelectedId(normalized[0]?.rows[0]?.studentId || "");
        }
      }
    } catch {
      setUploadMessage("저장된 데이터를 불러오지 못했습니다.");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(storageKey, JSON.stringify(exams));
  }, [exams, hydrated]);

  const years = useMemo(() => [...new Set(exams.map((exam) => exam.year))].sort((a, b) => b.localeCompare(a)), [exams]);
  const yearExams = useMemo(() => exams.filter((exam) => exam.year === activeYear), [exams, activeYear]);

  useEffect(() => {
    if (years.length && !years.includes(activeYear)) setActiveYear(years[0]);
    if (!years.length && activeYear) setActiveYear("");
  }, [activeYear, years]);

  const students = useMemo(() => {
    const map = new Map<string, Score>();
    yearExams.forEach((exam) => exam.rows.forEach((row) => map.set(row.studentId, row)));
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [yearExams]);
  const filtered = students.filter((student) => `${student.name} ${student.studentId}`.includes(query.trim()));
  const selected = students.find((student) => student.studentId === selectedId) || students[0];
  const history = yearExams.map((exam) => ({ exam, score: exam.rows.find((row) => row.studentId === selected?.studentId) }));
  const valid = history.filter((item) => item.score);
  const focusedItem = history.find((item) => item.exam.id === selectedExamId) || valid.at(-1) || history.at(-1);
  const focusedIndex = focusedItem ? history.findIndex((item) => item.exam.id === focusedItem.exam.id) : -1;
  const focusedScore = focusedItem?.score;
  const focusedPrevious = focusedIndex > 0 ? history.slice(0, focusedIndex).filter((item) => item.score).at(-1)?.score : undefined;

  useEffect(() => {
    if (focusedItem && focusedItem.exam.id !== selectedExamId) setSelectedExamId(focusedItem.exam.id);
  }, [focusedItem, selectedExamId]);
  const trendConfig: Record<TrendMetric, { label: string; max: number; unit: string }> = {
    total: { label: "TOTAL", max: 120, unit: "점" },
    listening: { label: "Listening", max: 40, unit: "점" },
    grammar: { label: "Grammar", max: 40, unit: "점" },
    reading: { label: "Reading", max: 40, unit: "점" },
    campusRank: { label: "캠퍼스 석차", max: Math.max(1, ...valid.map((item) => item.score?.campusRank || 1)), unit: "위" },
  };
  const activeTrend = trendConfig[trendMetric];
  const nationalRankMax = Math.max(1, ...valid.map((item) => item.score?.nationalRank || 1));

  function scoreWidth(value: number) {
    return (value / activeTrend.max) * 100;
  }

  function rankWidth(value: number, max: number) {
    return max <= 1 ? 100 : (1 - (value - 1) / max) * 100;
  }

  async function onUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files || [])];
    let nextExams = exams;
    let nextSelectedId = selectedId;
    let nextYear = activeYear;
    const messages: string[] = [];
    for (const file of files) {
      try {
        if (/\.pdf$/i.test(file.name)) {
          const matchingIndex = nextExams.findIndex((exam) => fileBase(exam.filename) === fileBase(file.name));
          if (matchingIndex < 0) throw new Error("같은 이름의 엑셀 성적표를 먼저 업로드해 주세요.");
          const { parsePdfReport } = await import("./pdf-parser");
          const parsed = await parsePdfReport(await file.arrayBuffer());
          const paired = pairPdf(nextExams[matchingIndex], file.name, parsed.students, parsed.period);
          nextExams = nextExams.map((exam, index) => index === matchingIndex ? paired : exam);
          nextYear = paired.year;
          messages.push(`${paired.label} · PDF 연결 완료`);
        } else {
          const info = examInfo(file.name);
          if (nextExams.some((exam) => fileBase(exam.filename) === fileBase(file.name))) throw new Error("같은 이름의 엑셀 성적표가 이미 등록되어 있습니다.");
          const rows = parseHtmlExcel(await file.text());
          const exam = { id: `${file.name}-${Date.now()}`, filename: file.name, ...info, rows };
          nextExams = [...nextExams, exam];
          nextYear = info.year;
          nextSelectedId ||= rows[0]?.studentId || "";
          messages.push(`${info.label} · 엑셀 ${rows.length}명 등록 완료`);
        }
      } catch (error) {
        messages.push(`${file.name}: ${error instanceof Error ? error.message : "파일을 읽지 못했습니다."}`);
      }
    }
    setExams(nextExams);
    setActiveYear(nextYear);
    setSelectedId(nextSelectedId);
    setUploadMessage(messages.join(" · "));
    event.target.value = "";
  }

  function removePdf(id: string) {
    setExams((items) => items.map((exam) => exam.id === id ? { ...exam, pdfFilename: undefined, rows: exam.rows.map(({ pdfMetrics: _pdfMetrics, ...row }) => row) } : exam));
    setUploadMessage("연결된 PDF 데이터를 해제했습니다.");
  }

  function removeExam(id: string) {
    setExams((items) => items.filter((exam) => exam.id !== id));
    setUploadMessage("선택한 성적표를 삭제했습니다.");
  }

  function clearData() {
    if (!window.confirm("등록한 모든 시험과 학생 데이터를 삭제할까요?")) return;
    setExams([]);
    setSelectedId("");
    setUploadMessage("모든 홈페이지 데이터를 초기화했습니다.");
    setView("main");
  }

  function downloadBackup() {
    const backup = JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), exams }, null, 2);
    const url = URL.createObjectURL(new Blob([backup], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `dyb-score-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setUploadMessage("홈페이지 데이터 백업을 저장했습니다.");
  }

  async function restoreBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as { exams?: Exam[] } | Exam[];
      const restored = Array.isArray(data) ? data : data.exams;
      if (!Array.isArray(restored) || restored.some((exam) => !exam.id || !Array.isArray(exam.rows))) throw new Error();
      const normalized = restored.map(restoreExam);
      setExams(normalized);
      setActiveYear([...new Set(normalized.map((exam) => exam.year))].sort().at(-1) || "");
      setSelectedId(normalized[0]?.rows[0]?.studentId || "");
      setUploadMessage(`${normalized.length}개 시험 데이터를 복원했습니다.`);
      setView("main");
    } catch {
      setUploadMessage("올바른 DYB 백업 파일이 아닙니다.");
    }
    event.target.value = "";
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">D</span><strong>DYB SCORE</strong></div>
        <div className="header-stats"><div><b>{students.length}</b><span>총원</span></div><div><b>{yearExams.length}</b><span>누적 시험</span></div></div>
        <div className="header-actions"><span className="saved">● 로컬 저장됨</span><button className={`settings-button ${view === "settings" ? "main-button" : ""}`} onClick={() => setView(view === "settings" ? "main" : "settings")}>{view === "settings" ? "← 메인" : "⚙ 설정"}</button><button className="upload-button" onClick={() => fileRef.current?.click()}>＋ 엑셀/PDF 업로드</button></div>
        <input ref={fileRef} hidden type="file" accept=".xls,.xlsx,.pdf,text/html,application/pdf" multiple onChange={onUpload} />
        <input ref={restoreRef} hidden type="file" accept="application/json,.json" onChange={restoreBackup} />
      </header>

      {uploadMessage && <div className="toast"><span>✓</span>{uploadMessage}<button onClick={() => setUploadMessage("")}>×</button></div>}

      {view === "settings" ? <section className="settings-workspace">
        <section className="settings-page card" aria-label="데이터 설정">
          <div className="settings-head"><div><p>SETTINGS</p><h2>데이터 관리</h2></div><span>엑셀을 먼저 등록한 뒤 같은 이름의 PDF를 연결해 주세요.</span></div>
          <div className="settings-actions"><button onClick={downloadBackup}><b>↓ 백업 저장</b><span>현재 등록한 모든 시험 데이터를 JSON 파일로 저장합니다.</span></button><button onClick={() => restoreRef.current?.click()}><b>↑ 백업 복원</b><span>저장해 둔 JSON 파일로 홈페이지 데이터를 복원합니다.</span></button></div>
          <div className="file-manager"><div className="file-manager-title"><b>등록한 성적표</b><span>{exams.length}개 시험</span></div>{!exams.length ? <p className="no-files">아직 등록한 성적표가 없습니다.</p> : <div className="managed-files">{exams.map((exam) => <div className="managed-file" key={exam.id}><span className={`file-icon ${exam.pdfFilename ? "paired" : ""}`}>{exam.pdfFilename ? "PAIR" : "XLS"}</span><div><b>{exam.label}</b><small>{exam.filename} · {exam.rows.length}명</small><small className={exam.pdfFilename ? "pdf-connected" : "pdf-waiting"}>{exam.pdfFilename ? `PDF 연결됨 · ${exam.pdfFilename}` : "PDF 미연결"}</small></div><div className="file-buttons">{exam.pdfFilename && <button onClick={() => removePdf(exam.id)}>PDF 해제</button>}<button onClick={() => removeExam(exam.id)}>시험 삭제</button></div></div>)}</div>}</div>
          <div className="settings-foot"><button className="danger-button" disabled={!exams.length} onClick={clearData}>전체 데이터 초기화</button><small>성적 데이터는 이 브라우저에만 저장됩니다.</small></div>
        </section>
      </section> : <>

      {!!years.length && <nav className="year-tabs" aria-label="연도 선택">{years.map((year) => <button key={year} className={activeYear === year ? "active" : ""} aria-pressed={activeYear === year} onClick={() => { setActiveYear(year); setQuery(""); }}>{year}년</button>)}</nav>}

      <section className="workspace">
        <aside className="student-panel card">
          <div className="panel-heading"><div><p>STUDENTS</p><h2>학생 목록</h2></div><span>{filtered.length}명</span></div>
          <label className="search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="이름 또는 수험번호 검색" />{query && <button type="button" aria-label="검색어 지우기" onClick={() => setQuery("")}>×</button>}</label>
          <div className="student-list">
            {!filtered.length && <div className="student-empty"><span>↥</span><b>등록된 학생이 없습니다</b><small>성적표를 업로드하면 학생 목록이 생성됩니다.</small></div>}
            {filtered.map((student) => {
              const latest = [...yearExams].reverse().find((exam) => exam.rows.some((row) => row.studentId === student.studentId));
              const score = latest?.rows.find((row) => row.studentId === student.studentId);
              const gaps = yearExams.filter((exam) => !exam.rows.some((row) => row.studentId === student.studentId)).length;
              const attended = yearExams.length - gaps;
              return <button key={student.studentId} className={`student-row ${selected?.studentId === student.studentId ? "active" : ""}`} onClick={() => setSelectedId(student.studentId)}>
                <span className="avatar">{student.name.slice(0,1)}</span><span className="student-meta"><b>{student.name}</b><small>{student.grade} · {student.level} · {student.studentId}</small></span>
                <span className="latest-score"><b>{score?.total ?? "—"}</b><small>{gaps ? `${gaps}회 미응시` : "전체 응시"} ({attended}/{yearExams.length})</small></span>
              </button>;
            })}
          </div>
        </aside>

        <div className="report">
          {!selected ? <section className="empty-report card"><span className="empty-icon">↥</span><p>GET STARTED</p><h2>엑셀 성적표를 먼저 업로드해 주세요</h2><span>같은 이름의 PDF를 이어서 올리면 평균과 백분위까지 연결됩니다.</span><button onClick={() => fileRef.current?.click()}>＋ 성적표 선택</button><small>업로드한 파일은 서버로 전송되지 않고 현재 브라우저에서만 처리됩니다.</small></section> : <>
          <nav className="exam-tabs card" aria-label="시험 선택">{history.map(({ exam, score }) => <button key={exam.id} className={focusedItem?.exam.id === exam.id ? "active" : ""} aria-pressed={focusedItem?.exam.id === exam.id} onClick={() => setSelectedExamId(exam.id)}><b>{exam.label}</b><small>{!score ? "데이터 없음" : exam.pdfFilename ? "XLS + PDF" : "XLS"}</small></button>)}</nav>

          <section className="profile card">
            <div className="profile-main"><span className="profile-avatar">{selected?.name.slice(0,1)}</span><div><button className={`profile-total-button ${trendMetric === "total" ? "active" : ""}`} onClick={() => setTrendMetric("total")}>TOTAL</button><div className="profile-name"><h2>{selected?.name}</h2><span>{selected?.level}</span></div><p>{selected?.grade} · 수험번호 {selected?.studentId}</p></div></div>
            <div className="latest-summary"><span>{focusedItem?.exam.label || "선택 시험"}</span><div className="total-line"><b>{focusedScore?.total ?? "—"}<small>/120</small></b>{focusedPrevious && focusedScore ? <Delta value={focusedScore.total - focusedPrevious.total} /> : <span className="delta neutral">비교 데이터 없음</span>}</div>{focusedScore && <ComparisonBar metric={focusedScore.pdfMetrics?.total} score={focusedScore.total} maxScore={120} />}</div>
          </section>

          <section className="metric-grid">
            {[
              ["listening", "Listening", focusedScore?.listening, focusedPrevious ? (focusedScore?.listening || 0) - focusedPrevious.listening : 0, "blue"],
              ["grammar", "Grammar", focusedScore?.grammar, focusedPrevious ? (focusedScore?.grammar || 0) - focusedPrevious.grammar : 0, "coral"],
              ["reading", "Reading", focusedScore?.reading, focusedPrevious ? (focusedScore?.reading || 0) - focusedPrevious.reading : 0, "green"],
            ].map(([metric, label, value, delta, color]) => {
              const scoreMetric = metric as TrendMetric;
              const pdfMetric = focusedScore?.pdfMetrics?.[scoreMetric as PdfMetricKey];
              return <button aria-pressed={trendMetric === metric} onClick={() => setTrendMetric(scoreMetric)} className={`metric-card card ${color} ${trendMetric === metric ? "active" : ""}`} key={String(label)}><div><span>{label}</span><b>{value ?? "—"}<small>/40</small></b></div>{focusedPrevious && focusedScore ? <Delta value={Number(delta)} /> : <span className="delta neutral">비교 데이터 없음</span>}{value !== undefined && <ComparisonBar metric={pdfMetric} score={Number(value)} maxScore={40} />}</button>;
            })}
            <button aria-pressed={trendMetric === "campusRank"} onClick={() => setTrendMetric("campusRank")} className={`metric-card rank-card card violet ${trendMetric === "campusRank" ? "active" : ""}`}>
              <div className="rank-card-head"><span>석차</span></div>
              <div className="rank-card-grid">
                <div className="rank-summary"><span>전국 석차</span><b>{focusedScore?.nationalRank?.toLocaleString() ?? "—"}<small>위</small></b><em>{focusedScore?.pdfMetrics ? `(${focusedScore.pdfMetrics.total.nationalPercentile.toFixed(1)}%)` : "백분위 없음"}</em>{focusedPrevious && focusedScore && <Delta value={focusedScore.nationalRank - focusedPrevious.nationalRank} rank />}</div>
                <div className="rank-summary"><span>캠퍼스 석차</span><b>{focusedScore?.campusRank ?? "—"}<small>위</small></b><em>{focusedScore?.pdfMetrics ? `(${focusedScore.pdfMetrics.total.campusPercentile.toFixed(1)}%)` : "백분위 없음"}</em>{focusedPrevious && focusedScore && <Delta value={focusedScore.campusRank - focusedPrevious.campusRank} rank />}</div>
              </div>
            </button>
          </section>

          <section className="trend card">
            <div className="section-title"><div><p>PROGRESS</p><h2>{trendMetric === "campusRank" ? "전국·캠퍼스 석차 변화" : `${activeTrend.label} 성적 변화`}</h2></div><div className="legend">{trendMetric === "campusRank" ? <><span><i className="dot campus"/>캠퍼스 석차</span><span><i className="dot national"/>전국 석차</span></> : <><span><i className="dot total"/>학생점수</span><span><i className="dot average"/>전체평균</span><span><i className="dot top-ten"/>상위 10% 평균</span></>}</div></div>
            <div className="horizontal-timeline">
              {history.map(({ exam, score }, index) => {
                const previousScore = index > 0 ? history[index - 1].score : undefined;
                const change = score && previousScore ? score[trendMetric] - previousScore[trendMetric] : undefined;
                const referenceMetric = score && trendMetric !== "campusRank" ? score.pdfMetrics?.[trendMetric as PdfMetricKey] : undefined;
                return <div className={`horizontal-exam ${score ? "" : "missing"}`} key={exam.id}>
                  <strong>{exam.label}</strong>
                  {!score ? <div className="horizontal-no-data">데이터 없음</div> : trendMetric === "campusRank" ? <div className="horizontal-series-list rank-series-list">
                    <HorizontalProgressBar label="캠퍼스 석차" value={score.campusRank} unit="위" width={rankWidth(score.campusRank, activeTrend.max)} color="campus-bar" delta={change} rank />
                    <HorizontalProgressBar label="전국 석차" value={score.nationalRank} unit="위" width={rankWidth(score.nationalRank, nationalRankMax)} color="national-bar" delta={previousScore ? score.nationalRank - previousScore.nationalRank : undefined} rank />
                  </div> : <div className="horizontal-series-list">
                    <HorizontalProgressBar label="학생점수" value={score[trendMetric]} unit={activeTrend.unit} width={scoreWidth(score[trendMetric])} color="student-bar" delta={change} />
                    {referenceMetric && <><HorizontalProgressBar label="전체평균" value={referenceMetric.average} unit="점" width={scoreWidth(referenceMetric.average)} color="average-bar" /><HorizontalProgressBar label="상위 10% 평균" value={referenceMetric.top10Average} unit="점" width={scoreWidth(referenceMetric.top10Average)} color="top-ten-bar" /></>}
                  </div>}
                </div>})}
            </div>
          </section>

          <section className="history card">
            <div className="section-title"><div><p>DETAIL</p><h2>시험별 상세 기록</h2></div></div>
            <div className="table-wrap"><table><thead><tr><th>시험명</th><th>Listening</th><th>Grammar</th><th>Reading</th><th>TOTAL</th><th>전국 석차</th><th>캠퍼스 석차</th></tr></thead><tbody>
              {history.map(({exam,score}, index) => {
                const previousScore = index > 0 ? history[index - 1].score : undefined;
                return <tr key={exam.id} className={!score ? "empty-row" : ""}><td><b>{exam.label}</b><small>{exam.filename}{exam.pdfFilename ? " · PDF 연결" : " · PDF 미연결"}</small></td>{score ? <><td>{score.listening}<small>/40</small></td><td>{score.grammar}<small>/40</small></td><td>{score.reading}<small>/40</small></td><td><b>{score.total}</b><small>/120</small></td><td><span className="rank-cell"><span className="rank-value"><span>{score.nationalRank.toLocaleString()}위</span>{score.pdfMetrics && <small>({score.pdfMetrics.total.nationalPercentile.toFixed(1)}%)</small>}</span><span className="rank-delta-slot">{previousScore && <Delta value={score.nationalRank - previousScore.nationalRank} rank />}</span></span></td><td><span className="rank-cell"><span className="rank-value"><b>{score.campusRank}위</b>{score.pdfMetrics && <small>({score.pdfMetrics.total.campusPercentile.toFixed(1)}%)</small>}</span><span className="rank-delta-slot">{previousScore && <Delta value={score.campusRank - previousScore.campusRank} rank />}</span></span></td></> : <td colSpan={6}><span className="no-data">데이터 없음</span></td>}</tr>;
              })}
            </tbody></table></div>
          </section>
          </>}
        </div>
      </section>
      </>}
      <footer>DYB SCORE <span>·</span> 성적표 원본은 현재 브라우저에서만 처리됩니다.</footer>
    </main>
  );
}
