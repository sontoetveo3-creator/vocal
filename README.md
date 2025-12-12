# Vocal Remover (Vercel) – Full

Upload audio -> separate vocals/instrumental using Replicate (Demucs) -> preview -> download.

## Deploy on Vercel
1. Import repo to Vercel (Next.js auto-detect)
2. Add Storage:
   - Vercel Blob
   - Vercel KV
3. Add env vars:
   - REPLICATE_API_TOKEN (required)
   - REPLICATE_MODEL (optional, default: facebookresearch/demucs)
   - REPLICATE_MODEL_VERSION (optional; if omitted, server queries Replicate for latest model version)
4. Deploy

## Local dev
```bash
npm i
npm run dev
```
