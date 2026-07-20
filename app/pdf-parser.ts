/// <reference types="vite/client" />

export type PdfMetricKey = "listening" | "grammar" | "reading" | "total";

export type PdfMetric = {
  score: number;
  previousScore: number | null;
  average: number;
  top10Average: number;
  maxScore: number;
  nationalPercentile: number;
  campusPercentile: number;
};

export type PdfStudentRecord = {
  name: string;
  level: string;
  metrics: Record<PdfMetricKey, PdfMetric>;
};

export type ParsedPdfReport = {
  year: string;
  period: string;
  students: PdfStudentRecord[];
};

type TextItem = { str: string; transform: number[] };

function number(value: string) {
  return Number(value.replace(/[,%]/g, ""));
}

function linesFromItems(items: TextItem[]) {
  const rows = new Map<number, TextItem[]>();
  items.forEach((item) => {
    if (!item.str.trim()) return;
    const y = Math.round(item.transform[5] * 2) / 2;
    rows.set(y, [...(rows.get(y) || []), item]);
  });
  return [...rows.entries()]
    .sort(([a], [b]) => b - a)
    .map(([, row]) => row.sort((a, b) => a.transform[4] - b.transform[4]).map((item) => item.str.trim()).filter(Boolean).join(" "));
}

function metricFromLine(line: string, label: string): PdfMetric {
  const values = line.slice(label.length).trim().split(/\s+/);
  if (values.length < 9) throw new Error(`${label} 성적 데이터를 읽지 못했습니다.`);
  return {
    previousScore: values[2] === "-" ? null : number(values[2]),
    score: number(values[3]),
    average: number(values[4]),
    top10Average: number(values[5]),
    maxScore: number(values[6]),
    nationalPercentile: number(values[7]),
    campusPercentile: number(values[8]),
  };
}

function studentFromLines(lines: string[]): PdfStudentRecord | null {
  if (!lines.some((line) => line.includes("성적결과"))) return null;
  const identity = lines.find((line) => line.includes("캠퍼스") && line.includes(" - "));
  if (!identity) throw new Error("PDF에서 학생 이름과 레벨을 찾지 못했습니다.");
  const identityParts = identity.split(/\s+-\s+/).map((part) => part.trim());
  const findMetric = (label: string) => {
    const lineIndex = lines.findIndex((value) => value === label || value.startsWith(`${label} `));
    if (lineIndex < 0) throw new Error(`PDF에서 ${label} 항목을 찾지 못했습니다.`);
    const line = lines[lineIndex] === label ? `${label} ${lines[lineIndex + 1] || ""}` : lines[lineIndex];
    return metricFromLine(line, label);
  };
  return {
    name: identityParts.at(-1) || "",
    level: identityParts.at(-2) || "-",
    metrics: {
      listening: findMetric("Listening"),
      grammar: findMetric("Grammar"),
      reading: findMetric("Reading"),
      total: findMetric("Total Score"),
    },
  };
}

export async function parsePdfReport(buffer: ArrayBuffer): Promise<ParsedPdfReport> {
  // PDF.js 5 uses newer Promise APIs that older Safari/WebKit versions do not
  // implement. The v3 legacy build keeps uploads working across those browsers.
  const importedPdfjs = await import("pdfjs-dist/legacy/build/pdf.js");
  const pdfjs = (importedPdfjs.default || importedPdfjs) as typeof importedPdfjs;
  if (typeof window !== "undefined") {
    const worker = await import("pdfjs-dist/legacy/build/pdf.worker.min.js?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  }
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const students: PdfStudentRecord[] = [];
  let year = "";
  let month = "";
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const textItems = content.items.filter((item) => "str" in item && "transform" in item) as unknown as TextItem[];
    const lines = linesFromItems(textItems);
    const date = lines.join(" ").match(/(20\d{2})[.-](\d{1,2})/);
    if (date) {
      year ||= date[1];
      month ||= date[2].padStart(2, "0");
      if (year !== date[1] || month !== date[2].padStart(2, "0")) throw new Error("PDF 안에 서로 다른 시험 날짜가 섞여 있습니다.");
    }
    const student = studentFromLines(lines);
    if (student) students.push(student);
  }
  await document.destroy();
  if (!year || !month) throw new Error("PDF 장표에서 시험 연도와 월을 찾지 못했습니다.");
  if (!students.length) throw new Error("PDF에서 학생 성적결과를 찾지 못했습니다.");
  return { year, period: `${year.slice(2)}/${month}`, students };
}
/// <reference types="vite/client" />
