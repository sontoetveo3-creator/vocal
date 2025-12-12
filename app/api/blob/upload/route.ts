import { handleUpload } from "@vercel/blob/client";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json();

  const jsonResponse = await handleUpload({
    body,
    request: req,
    onBeforeGenerateToken: async () => ({
      allowedContentTypes: [
        "audio/mpeg",
        "audio/mp3",
        "audio/wav",
        "audio/x-wav",
        "audio/mp4",
        "audio/aac",
        "audio/flac",
        "audio/ogg",
        "audio/webm"
      ],
      tokenPayload: JSON.stringify({ scope: "audio-upload" })
    }),
    onUploadCompleted: async () => {
      // no-op
    }
  });

  return Response.json(jsonResponse);
}
