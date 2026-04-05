import { NextResponse } from "next/server";

const ALLOWED_MODELS = new Set([
  "building-models/building-model-typeA.glb",
  "building-models/building-model-typeB.glb",
  "building-models/building-model-typeC.glb",
  "building-models/building-model-typeD.glb",
  "building-models/building-model-typeE.glb",
]);

function normalizeModel(model: string) {
  return (model || "").trim().replace(/^\/+/, "");
}

function toBuildingName(model: string, fallbackIndex: number) {
  const map: Record<string, string> = {
    "building-models/building-model-typeA.glb": "Building A",
    "building-models/building-model-typeB.glb": "Building B",
    "building-models/building-model-typeC.glb": "Building C",
    "building-models/building-model-typeD.glb": "Building D",
    "building-models/building-model-typeE.glb": "Building E",
  };

  return map[model] || `Building ${fallbackIndex + 1}`;
}

export async function GET() {
  try {
    const baseUrl = process.env.BACKEND_URL;
    if (!baseUrl) {
      return NextResponse.json(
        { ok: false, message: "BACKEND_URL is not set" },
        { status: 500 }
      );
    }

    const r = await fetch(`${baseUrl}/auth/building/all`, {
      cache: "no-store",
    });

    if (!r.ok) {
      const t = await r.text();
      return new NextResponse(t, { status: r.status });
    }

    const rows = await r.json();
    const assetsBase =
      process.env.ASSETS_PUBLIC_BASE ||
      process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL ||
      "https://vcep-assets-dev.s3.ap-southeast-2.amazonaws.com";

    const items = (Array.isArray(rows) ? rows : [])
      .map((x: any, index: number) => {
        const id = String(x.building_id ?? x.id ?? "");
        const raw =
          String(x.building_model ?? x.model ?? x.buildingModel ?? "");
        const model = normalizeModel(raw);
        const unlockLevel = Number(x.unlock_level ?? 0);

        return {
          id,
          model,
          unlockLevel,
          name:
            String(x.building_name ?? "").trim() ||
            toBuildingName(model, index),
          previewUrl: String(x.preview_url ?? "").trim() || null,
        };
      })
      .filter((it: any) => it.id && it.model && ALLOWED_MODELS.has(it.model))
      .map((it: any) => ({
        id: it.id,
        name: it.name,
        modelUrl: `${assetsBase.replace(/\/+$/, "")}/${it.model}`,
        previewUrl: it.previewUrl,
        unlockLevel: it.unlockLevel,
      }));

    return NextResponse.json(items);
  } catch (e: any) {
    console.error("GET /api/options/buildings ERROR:", e);
    return NextResponse.json(
      { ok: false, message: e?.message || "failed" },
      { status: 500 }
    );
  }
}