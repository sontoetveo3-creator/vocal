import { kv } from "@vercel/kv";
import Replicate from "replicate";

export const runtime = "nodejs";
export const maxDuration = 60;

type JobStatus = "queued" | "processing" | "done" | "error";

type Job = {
  id: string;
  status: JobStatus;
  progress?: number;
  message?: string;
  createdAt: number;
  input: { url: string; filename: string };
  output?: { vocalsUrl?: string; instrumentalUrl?: string };
  replicate?: { predictionId: string; model: string; version: string };
};

function pickFromArray(urls: string[], needle: string) {
  const n = needle.toLowerCase();
  return urls.find((u) => u.toLowerCase().includes(n));
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  const job = (await kv.get(`job:${id}`)) as Job | null;
  if (!job) return new Response("Not found", { status: 404 });

  if (job.status === "done" || job.status === "error") {
    return Response.json(job, { headers: { "cache-control": "no-store" } });
  }

  const predictionId = job.replicate?.predictionId;
  if (!predictionId) {
    job.status = "error";
    job.message = "Missing predictionId";
    await kv.set(`job:${id}`, job);
    return Response.json(job, { headers: { "cache-control": "no-store" } });
  }

  if (!process.env.REPLICATE_API_TOKEN) {
    job.status = "error";
    job.message = "Missing REPLICATE_API_TOKEN env";
    await kv.set(`job:${id}`, job);
    return Response.json(job, { headers: { "cache-control": "no-store" } });
  }

  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  const pred: any = await replicate.predictions.get(predictionId);

  const status = pred.status;
  if (status === "starting") job.progress = Math.max(job.progress ?? 5, 10);
  if (status === "processing") job.progress = Math.max(job.progress ?? 10, 35);

  if (status === "failed" || status === "canceled") {
    job.status = "error";
    job.message = pred.error ?? `Prediction ${status}`;
    await kv.set(`job:${id}`, job);
    return Response.json(job, { headers: { "cache-control": "no-store" } });
  }

  if (status === "succeeded") {
    const out: any = pred.output;

    let vocalsUrl: string | undefined;
    let instrumentalUrl: string | undefined;

    if (out && typeof out === "object" && !Array.isArray(out)) {
      vocalsUrl = out.vocals ?? out.vocal ?? out["vocals.wav"] ?? out["vocals.mp3"] ?? out["vocals"];
      instrumentalUrl = out.no_vocals ?? out.instrumental ?? out.accompaniment ?? out["no_vocals.wav"] ?? out["no_vocals.mp3"];
    } else if (Array.isArray(out)) {
      const urls = out.filter((x) => typeof x === "string") as string[];
      vocalsUrl = pickFromArray(urls, "vocals") ?? pickFromArray(urls, "vocal");
      instrumentalUrl = pickFromArray(urls, "no_vocals") ?? pickFromArray(urls, "instrumental") ?? pickFromArray(urls, "accompaniment");
    } else if (typeof out === "string") {
      job.message = "Model returned a single file. Prefer a Demucs model that outputs separate stems.";
    }

    job.status = "done";
    job.progress = 100;
    job.output = { vocalsUrl, instrumentalUrl };

    if (!vocalsUrl || !instrumentalUrl) {
      job.message = (job.message ? job.message + " " : "") + "Tách xong nhưng không map được vocals/instrumental. Đổi model/version hoặc sửa mapping.";
    }

    await kv.set(`job:${id}`, job);
  }

  return Response.json(job, { headers: { "cache-control": "no-store" } });
}
