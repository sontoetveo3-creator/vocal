"use client";

import { useEffect, useMemo, useState } from "react";
import { upload } from "@vercel/blob/client";

type JobStatus = "queued" | "processing" | "done" | "error";

type Job = {
  id: string;
  status: JobStatus;
  progress?: number;
  message?: string;
  input?: { url: string; filename: string };
  output?: { vocalsUrl?: string; instrumentalUrl?: string };
};

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [uploadPct, setUploadPct] = useState<number>(0);
  const [busy, setBusy] = useState(false);

  const canStart = useMemo(() => !!file && !busy, [file, busy]);

  async function start() {
    if (!file) return;
    setBusy(true);
    setJob(null);
    setUploadPct(0);

    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/blob/upload",
        onUploadProgress: (p) => setUploadPct(Math.round((p.loaded / p.total) * 100))
      });

      const r = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inputUrl: blob.url, filename: file.name, mode: "2stems" })
      });

      if (!r.ok) throw new Error(await r.text());
      const created: Job = await r.json();
      setJob(created);
    } catch (e: any) {
      setJob({ id: "N/A", status: "error", message: e?.message ?? "Error" });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!job?.id || job.status === "done" || job.status === "error") return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/jobs/${job.id}`, { cache: "no-store" });
      if (!r.ok) return;
      const updated: Job = await r.json();
      setJob(updated);
    }, 1500);
    return () => clearInterval(t);
  }, [job?.id, job?.status]);

  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: 24 }}>
      <h1 style={{ marginTop: 8, fontSize: 30 }}>Vocal Remover</h1>
      <p style={{ opacity: 0.85, marginTop: 6 }}>
        Upload nhạc → tách <b>Vocals</b> / <b>Instrumental</b> → nghe thử & tải về.
      </p>

      <div style={{ display: "grid", gap: 14, padding: 16, borderRadius: 14, background: "#111a2b", border: "1px solid #22304a" }}>
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          style={{ padding: 12, background: "#0b1220", borderRadius: 10, border: "1px solid #22304a", color: "#e8eefc" }}
        />

        <button
          onClick={start}
          disabled={!canStart}
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid #2a3a5b",
            background: canStart ? "#1c6cff" : "#23314d",
            color: "#fff",
            cursor: canStart ? "pointer" : "not-allowed",
            fontWeight: 650
          }}
        >
          Tách ngay
        </button>

        {(busy || uploadPct > 0) && (
          <div style={{ fontSize: 14, opacity: 0.9 }}>
            Upload: {uploadPct}%
            <div style={{ height: 8, background: "#0b1220", border: "1px solid #22304a", borderRadius: 999, overflow: "hidden", marginTop: 6 }}>
              <div style={{ width: `${uploadPct}%`, height: "100%", background: "#1c6cff" }} />
            </div>
          </div>
        )}
      </div>

      {job && (
        <section style={{ marginTop: 18, padding: 16, borderRadius: 14, background: "#111a2b", border: "1px solid #22304a" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>Job</div>
              <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{job.id}</div>
            </div>
            <div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>Trạng thái</div>
              <div style={{ fontWeight: 700 }}>
                {job.status.toUpperCase()}
                {typeof job.progress === "number" ? ` • ${job.progress}%` : ""}
              </div>
            </div>
          </div>

          {job.message && <p style={{ marginTop: 10, color: "#ffb4b4" }}>{job.message}</p>}

          {job.status !== "done" && job.status !== "error" && (
            <div style={{ marginTop: 12 }}>
              <div style={{ height: 10, background: "#0b1220", border: "1px solid #22304a", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${job.progress ?? 10}%`, height: "100%", background: "#1c6cff" }} />
              </div>
              <p style={{ marginTop: 8, opacity: 0.8, fontSize: 14 }}>Đang tách… (tùy bài có thể vài chục giây đến vài phút)</p>
            </div>
          )}

          {job.status === "done" && (
            <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
              <Track title="Vocals" url={job.output?.vocalsUrl} />
              <Track title="Instrumental" url={job.output?.instrumentalUrl} />

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {job.output?.vocalsUrl && (
                  <a className="btn" href={job.output.vocalsUrl} download>
                    Tải Vocals
                  </a>
                )}
                {job.output?.instrumentalUrl && (
                  <a className="btn" href={job.output.instrumentalUrl} download>
                    Tải Instrumental
                  </a>
                )}
              </div>

              <style jsx>{`
                .btn {
                  padding: 10px 12px;
                  border-radius: 10px;
                  border: 1px solid #2a3a5b;
                  background: #0b1220;
                  color: #e8eefc;
                  text-decoration: none;
                  font-weight: 650;
                }
                .btn:hover {
                  background: #0f1b33;
                }
              `}</style>
            </div>
          )}
        </section>
      )}

      <footer style={{ marginTop: 18, opacity: 0.7, fontSize: 13 }}>
        Tip: Đừng commit <code>node_modules</code>. Vercel sẽ tự <code>npm install</code> khi build.
      </footer>
    </main>
  );
}

function Track({ title, url }: { title: string; url?: string }) {
  return (
    <div style={{ padding: 12, borderRadius: 12, background: "#0b1220", border: "1px solid #22304a" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 750 }}>{title}</div>
        {url ? (
          <div style={{ fontSize: 12, opacity: 0.7, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>ready</div>
        ) : (
          <div style={{ fontSize: 12, opacity: 0.7 }}>chưa có</div>
        )}
      </div>
      {url && <audio controls src={url} style={{ width: "100%", marginTop: 10 }} />}
    </div>
  );
}
