import { kv } from "@vercel/kv";
import Replicate from "replicate";
import { randomUUID } from "crypto";

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

async function resolveModelVersion(replicate: Replicate, model: string): Promise<string> {
  const [owner, name] = model.split("/");
  if (!owner || !name) throw new Error("REPLICATE_MODEL must be like owner/name");
  const info: any = await replicate.models.get(owner, name);
  const v = info?.latest_version?.id;
  if (!v) throw new Error("Could not resolve latest_version for model " + model);
  return v;
}

export async function POST(req: Request) {
  const { inputUrl, filename } = await req.json();

  if (!inputUrl || typeof inputUrl !== "string") return new Response("Missing inputUrl", { status: 400 });
  if (!process.env.REPLICATE_API_TOKEN) return new Response("Missing REPLICATE_API_TOKEN env", { status: 500 });

  const id = randomUUID();
  const job: Job = {
    id,
    status: "queued",
    progress: 1,
    createdAt: Date.now(),
    input: { url: inputUrl, filename: filename ?? "audio" }
  };

  await kv.set(`job:${id}`, job);
  await kv.expire(`job:${id}`, 60 * 60 * 6);

  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  const model = process.env.REPLICATE_MODEL ?? "facebookresearch/demucs";
  const version = process.env.REPLICATE_MODEL_VERSION ?? (await resolveModelVersion(replicate, model));

  const prediction = await replicate.predictions.create({
    version,
    input: { audio: inputUrl }
  });

  job.status = "processing";
  job.progress = 5;
  job.replicate = { predictionId: prediction.id, model, version };
  await kv.set(`job:${id}`, job);

  return Response.json(job);
}
