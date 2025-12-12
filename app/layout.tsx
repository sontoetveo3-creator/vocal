import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vocal Remover",
  description: "Upload -> Separate vocals/instrumental -> Preview -> Download"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body style={{ fontFamily: "system-ui, Arial", margin: 0, background: "#0b0f17", color: "#e8eefc" }}>
        {children}
      </body>
    </html>
  );
}
