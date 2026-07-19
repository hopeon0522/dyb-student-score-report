import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DYB 학생 성장 리포트",
  description: "시험별 영어 영역 점수와 석차 변화를 확인하는 학생 성적관리 도구",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
