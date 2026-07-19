"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";

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

type Exam = { id: string; label: string; filename: string; period: string; rows: Score[] };

const initialExams: Exam[] = [];

const getNumber = (value: string) => Number((value || "0").split("/")[0].replace(/,/g, ""));

function examInfo(filename: string) {
  const base = filename.replace(/\.xls[x]?$/i, "").trim();
  const match = base.match(/^(\d{4})[.-](\d{1,2})\s+(.+)$/);
  if (!match) return { label: base, period: "날짜 미정" };
  const [, year, month, title] = match;
  const period = `${year.slice(2)}/${month.padStart(2, "0")}`;
  return { label: `${title}(${period})`, period };
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
  const fileRef = useRef<HTMLInputElement>(null);

  const students = useMemo(() => {
    const map = new Map<string, Score>();
    exams.forEach((exam) => exam.rows.forEach((row) => map.set(row.studentId, row)));
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [exams]);
  const filtered = students.filter((student) => `${student.name} ${student.studentId}`.includes(query.trim()));
  const selected = students.find((student) => student.studentId === selectedId) || students[0];
  const history = exams.map((exam) => ({ exam, score: exam.rows.find((row) => row.studentId === selected?.studentId) }));
  const valid = history.filter((item) => item.score);
  const previous = valid.at(-2)?.score;
  const current = valid.at(-1)?.score;
  const missingCount = students.filter((student) => exams.some((exam) => !exam.rows.some((row) => row.studentId === student.studentId))).length;

  async function onUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files || [])];
    for (const file of files) {
      try {
        const text = await file.text();
        const rows = parseHtmlExcel(text);
        const info = examInfo(file.name);
        setExams((items) => [...items, { id: `${file.name}-${Date.now()}`, filename: file.name, ...info, rows }]);
        setSelectedId((currentId) => currentId || rows[0]?.studentId || "");
        setUploadMessage(`${info.label} · ${rows.length}명 등록 완료`);
      } catch (error) {
        setUploadMessage(error instanceof Error ? error.message : "파일을 읽지 못했습니다.");
      }
    }
    event.target.value = "";
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">D</span><div><strong>DYB SCORE</strong><small>학생 성장 리포트</small></div></div>
        <div className="header-actions"><span className="saved">● 모든 변경사항 저장됨</span><button className="upload-button" onClick={() => fileRef.current?.click()}>＋ 성적표 업로드</button></div>
        <input ref={fileRef} hidden type="file" accept=".xls,.xlsx,text/html" multiple onChange={onUpload} />
      </header>

      <section className="hero">
        <div><p className="eyebrow">STUDENT PERFORMANCE</p><h1>성적 흐름을 한눈에,<br/><em>상담은 더 정확하게.</em></h1><p>시험별 영어 영역 점수와 석차를 연결해 학생의 변화를 빠르게 확인하세요.</p></div>
        <div className="hero-stats"><div><b>{students.length}</b><span>등록 학생</span></div><div><b>{exams.length}</b><span>누적 시험</span></div><div><b>{missingCount}</b><span>데이터 공백 학생</span></div></div>
      </section>

      {uploadMessage && <div className="toast"><span>✓</span>{uploadMessage}<button onClick={() => setUploadMessage("")}>×</button></div>}

      <section className="workspace">
        <aside className="student-panel card">
          <div className="panel-heading"><div><p>STUDENTS</p><h2>학생 목록</h2></div><span>{filtered.length}명</span></div>
          <label className="search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="이름 또는 수험번호 검색" /></label>
          <div className="student-list">
            {!filtered.length && <div className="student-empty"><span>↥</span><b>등록된 학생이 없습니다</b><small>성적표를 업로드하면 학생 목록이 생성됩니다.</small></div>}
            {filtered.map((student) => {
              const latest = [...exams].reverse().find((exam) => exam.rows.some((row) => row.studentId === student.studentId));
              const score = latest?.rows.find((row) => row.studentId === student.studentId);
              const gaps = exams.filter((exam) => !exam.rows.some((row) => row.studentId === student.studentId)).length;
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
            <div className="latest-summary"><span>최근 성적</span><b>{current?.total ?? "—"}<small>/120</small></b>{previous && current ? <Delta value={current.total - previous.total} /> : <span className="delta neutral">비교 데이터 없음</span>}</div>
          </section>

          <section className="metric-grid">
            {[
              ["Listening", current?.listening, previous ? (current?.listening || 0) - previous.listening : 0, "blue"],
              ["Grammar", current?.grammar, previous ? (current?.grammar || 0) - previous.grammar : 0, "coral"],
              ["Reading", current?.reading, previous ? (current?.reading || 0) - previous.reading : 0, "green"],
              ["캠퍼스 석차", current?.campusRank, previous ? (current?.campusRank || 0) - previous.campusRank : 0, "violet"],
            ].map(([label, value, delta, color]) => <article className={`metric-card card ${color}`} key={String(label)}><div><span>{label}</span><b>{value ?? "—"}<small>{label === "캠퍼스 석차" ? "위" : "/40"}</small></b></div>{previous && current ? <Delta value={Number(delta)} rank={label === "캠퍼스 석차"} /> : <span className="delta neutral">비교 데이터 없음</span>}<div className="meter"><i style={{width: `${label === "캠퍼스 석차" ? Math.max(8, 100 - Number(value || 100) / 2) : Number(value || 0) * 2.5}%`}} /></div></article>)}
          </section>

          <section className="trend card">
            <div className="section-title"><div><p>PROGRESS</p><h2>시험별 성적 변화</h2></div><div className="legend"><span><i className="dot total"/>TOTAL</span><span><i className="dot rank"/>캠퍼스 석차</span></div></div>
            <div className="timeline">
              {history.map(({ exam, score }, index) => <div className={`exam-column ${score ? "" : "missing"}`} key={exam.id}>
                <div className="chart-zone">{score ? <><span className="rank-badge">{score.campusRank}위</span><div className="bar" style={{height:`${Math.max(28, score.total / 120 * 150)}px`}}><b>{score.total}</b></div></> : <div className="no-bar"><span>—</span><b>데이터 없음</b></div>}</div>
                <strong>{exam.label}</strong><small>{exam.rows.length}명 등록</small>{index < history.length - 1 && <i className="connector"/>}
              </div>)}
            </div>
          </section>

          <section className="history card">
            <div className="section-title"><div><p>DETAIL</p><h2>시험별 상세 기록</h2></div><button onClick={() => fileRef.current?.click()}>파일 추가</button></div>
            <div className="table-wrap"><table><thead><tr><th>시험명</th><th>Listening</th><th>Grammar</th><th>Reading</th><th>TOTAL</th><th>전국 석차</th><th>캠퍼스 석차</th></tr></thead><tbody>
              {history.map(({exam,score}) => <tr key={exam.id} className={!score ? "empty-row" : ""}><td><b>{exam.label}</b><small>{exam.filename}</small></td>{score ? <><td>{score.listening}<small>/40</small></td><td>{score.grammar}<small>/40</small></td><td>{score.reading}<small>/40</small></td><td><b>{score.total}</b><small>/120</small></td><td>{score.nationalRank.toLocaleString()}위</td><td><b>{score.campusRank}위</b></td></> : <td colSpan={6}><span className="no-data">데이터 없음</span></td>}</tr>)}
            </tbody></table></div>
          </section>
          </>}
        </div>
      </section>
      <footer>DYB 학생 성장 리포트 <span>·</span> 성적표 원본은 현재 브라우저에서만 처리됩니다.</footer>
    </main>
  );
}
