"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

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
};

type Exam = { id: string; label: string; filename: string; period: string; year: string; rows: Score[] };
type TrendMetric = "total" | "listening" | "grammar" | "reading" | "campusRank";
type View = "main" | "settings";

const initialExams: Exam[] = [];
const storageKey = "dyb-score-report-data-v1";

const getNumber = (value: string) => Number((value || "0").split("/")[0].replace(/,/g, ""));

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

function Delta({ value, rank = false }: { value: number; rank?: boolean }) {
  const improved = rank ? value < 0 : value > 0;
  if (!value) return <span className="delta neutral">변화 없음</span>;
  return <span className={`delta ${improved ? "up" : "down"}`}>{improved ? "↑" : "↓"} {Math.abs(value).toLocaleString()}{rank ? "위" : "점"}</span>;
}

export default function Home() {
  const [exams, setExams] = useState(initialExams);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [view, setView] = useState<View>("main");
  const [activeYear, setActiveYear] = useState("");
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
  const previous = valid.at(-2)?.score;
  const current = valid.at(-1)?.score;
  const trendConfig: Record<TrendMetric, { label: string; max: number; unit: string }> = {
    total: { label: "TOTAL", max: 120, unit: "점" },
    listening: { label: "Listening", max: 40, unit: "점" },
    grammar: { label: "Grammar", max: 40, unit: "점" },
    reading: { label: "Reading", max: 40, unit: "점" },
    campusRank: { label: "캠퍼스 석차", max: Math.max(1, ...valid.map((item) => item.score?.campusRank || 1)), unit: "위" },
  };
  const activeTrend = trendConfig[trendMetric];

  function trendHeight(score: Score) {
    if (trendMetric === "campusRank") return Math.max(28, (1 - (score.campusRank - 1) / activeTrend.max) * 150);
    return Math.max(28, (score[trendMetric] / activeTrend.max) * 150);
  }

  async function onUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files || [])];
    for (const file of files) {
      try {
        const text = await file.text();
        const rows = parseHtmlExcel(text);
        const info = examInfo(file.name);
        setExams((items) => [...items, { id: `${file.name}-${Date.now()}`, filename: file.name, ...info, rows }]);
        setActiveYear(info.year);
        setSelectedId((currentId) => currentId || rows[0]?.studentId || "");
        setUploadMessage(`${info.label} · ${rows.length}명 등록 완료`);
      } catch (error) {
        setUploadMessage(error instanceof Error ? error.message : "파일을 읽지 못했습니다.");
      }
    }
    event.target.value = "";
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
    const backup = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), exams }, null, 2);
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
        <div className="header-actions"><span className="saved">● 로컬 저장됨</span><button className={`settings-button ${view === "settings" ? "main-button" : ""}`} onClick={() => setView(view === "settings" ? "main" : "settings")}>{view === "settings" ? "← 메인" : "⚙ 설정"}</button><button className="upload-button" onClick={() => fileRef.current?.click()}>＋ 성적표 업로드</button></div>
        <input ref={fileRef} hidden type="file" accept=".xls,.xlsx,text/html" multiple onChange={onUpload} />
        <input ref={restoreRef} hidden type="file" accept="application/json,.json" onChange={restoreBackup} />
      </header>

      {uploadMessage && <div className="toast"><span>✓</span>{uploadMessage}<button onClick={() => setUploadMessage("")}>×</button></div>}

      {view === "settings" ? <section className="settings-workspace">
        <section className="settings-page card" aria-label="데이터 설정">
          <div className="settings-head"><div><p>SETTINGS</p><h2>데이터 관리</h2></div><span>등록한 성적표와 백업 파일을 관리합니다.</span></div>
          <div className="settings-actions"><button onClick={downloadBackup}><b>↓ 백업 저장</b><span>현재 등록한 모든 시험 데이터를 JSON 파일로 저장합니다.</span></button><button onClick={() => restoreRef.current?.click()}><b>↑ 백업 복원</b><span>저장해 둔 JSON 파일로 홈페이지 데이터를 복원합니다.</span></button></div>
          <div className="file-manager"><div className="file-manager-title"><b>등록한 성적표</b><span>{exams.length}개</span></div>{!exams.length ? <p className="no-files">아직 등록한 성적표가 없습니다.</p> : <div className="managed-files">{exams.map((exam) => <div className="managed-file" key={exam.id}><span className="file-icon">XLS</span><div><b>{exam.label}</b><small>{exam.filename} · {exam.rows.length}명</small></div><button onClick={() => removeExam(exam.id)}>삭제</button></div>)}</div>}</div>
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
              return <button key={student.studentId} className={`student-row ${selected?.studentId === student.studentId ? "active" : ""}`} onClick={() => setSelectedId(student.studentId)}>
                <span className="avatar">{student.name.slice(0,1)}</span><span className="student-meta"><b>{student.name}</b><small>{student.grade} · {student.level} · {student.studentId}</small></span>
                <span className="latest-score"><b>{score?.total ?? "—"}</b><small>{gaps ? `${gaps}회 공백` : "전체 응시"}</small></span>
              </button>;
            })}
          </div>
        </aside>

        <div className="report">
          {!selected ? <section className="empty-report card"><span className="empty-icon">↥</span><p>GET STARTED</p><h2>첫 성적표를 업로드해 주세요</h2><span>학생별 영역 점수와 석차 변화를 자동으로 연결해 드립니다.</span><button onClick={() => fileRef.current?.click()}>＋ 성적표 선택</button><small>업로드한 파일은 서버로 전송되지 않고 현재 브라우저에서만 처리됩니다.</small></section> : <>
          <section className="profile card">
            <div className="profile-main"><span className="profile-avatar">{selected?.name.slice(0,1)}</span><div><div className="profile-name"><h2>{selected?.name}</h2><span>{selected?.level}</span></div><p>{selected?.grade} · 수험번호 {selected?.studentId}</p></div></div>
            <div className="latest-summary"><span>최근 성적</span><div className="total-line"><button className={trendMetric === "total" ? "active" : ""} onClick={() => setTrendMetric("total")}>TOTAL</button><b>{current?.total ?? "—"}<small>/120</small></b></div>{previous && current ? <Delta value={current.total - previous.total} /> : <span className="delta neutral">비교 데이터 없음</span>}</div>
          </section>

          <section className="metric-grid">
            {[
              ["listening", "Listening", current?.listening, previous ? (current?.listening || 0) - previous.listening : 0, "blue"],
              ["grammar", "Grammar", current?.grammar, previous ? (current?.grammar || 0) - previous.grammar : 0, "coral"],
              ["reading", "Reading", current?.reading, previous ? (current?.reading || 0) - previous.reading : 0, "green"],
              ["campusRank", "캠퍼스 석차", current?.campusRank, previous ? (current?.campusRank || 0) - previous.campusRank : 0, "violet"],
            ].map(([metric, label, value, delta, color]) => <button aria-pressed={trendMetric === metric} onClick={() => setTrendMetric(metric as TrendMetric)} className={`metric-card card ${color} ${trendMetric === metric ? "active" : ""}`} key={String(label)}><div><span>{label}</span><b>{value ?? "—"}<small>{label === "캠퍼스 석차" ? "위" : "/40"}</small></b></div>{previous && current ? <Delta value={Number(delta)} rank={label === "캠퍼스 석차"} /> : <span className="delta neutral">비교 데이터 없음</span>}<div className="meter"><i style={{width: `${label === "캠퍼스 석차" ? Math.max(8, 100 - Number(value || 100) / 2) : Number(value || 0) * 2.5}%`}} /></div></button>)}
          </section>

          <section className="trend card">
            <div className="section-title"><div><p>PROGRESS</p><h2>{activeTrend.label} 성적 변화</h2></div><div className="legend"><span><i className="dot total"/>{activeTrend.label}</span></div></div>
            <div className="timeline">
              {history.map(({ exam, score }, index) => {
                const previousScore = index > 0 ? history[index - 1].score : undefined;
                const change = score && previousScore ? score[trendMetric] - previousScore[trendMetric] : undefined;
                return <div className={`exam-column ${score ? "" : "missing"}`} key={exam.id}>
                <div className="chart-zone">{score ? <div className="chart-stack">{change !== undefined && <Delta value={change} rank={trendMetric === "campusRank"} />}<div className="bar" style={{height:`${trendHeight(score)}px`}}><b>{score[trendMetric]}{activeTrend.unit}</b></div></div> : <div className="no-bar"><span>—</span><b>데이터 없음</b></div>}</div>
                <strong>{exam.label}</strong><small>{exam.rows.length}명 등록</small>{index < history.length - 1 && <i className="connector"/>}
              </div>})}
            </div>
          </section>

          <section className="history card">
            <div className="section-title"><div><p>DETAIL</p><h2>시험별 상세 기록</h2></div><button onClick={() => fileRef.current?.click()}>파일 추가</button></div>
            <div className="table-wrap"><table><thead><tr><th>시험명</th><th>Listening</th><th>Grammar</th><th>Reading</th><th>TOTAL</th><th>전국 석차</th><th>캠퍼스 석차</th></tr></thead><tbody>
              {history.map(({exam,score}, index) => {
                const previousScore = index > 0 ? history[index - 1].score : undefined;
                return <tr key={exam.id} className={!score ? "empty-row" : ""}><td><b>{exam.label}</b><small>{exam.filename}</small></td>{score ? <><td>{score.listening}<small>/40</small></td><td>{score.grammar}<small>/40</small></td><td>{score.reading}<small>/40</small></td><td><b>{score.total}</b><small>/120</small></td><td><span className="rank-cell"><span>{score.nationalRank.toLocaleString()}위</span><span className="rank-delta-slot">{previousScore && <Delta value={score.nationalRank - previousScore.nationalRank} rank />}</span></span></td><td><span className="rank-cell"><b>{score.campusRank}위</b><span className="rank-delta-slot">{previousScore && <Delta value={score.campusRank - previousScore.campusRank} rank />}</span></span></td></> : <td colSpan={6}><span className="no-data">데이터 없음</span></td>}</tr>;
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
