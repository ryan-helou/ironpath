import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromRequest } from "@/lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cheap, optional AI coach. Uses Claude Haiku 4.5 with a tight output cap so
// cost stays a fraction of a cent per call. The whole app works without it.

const SYSTEM = `You are the IronPath Coach — an expert, encouraging triathlon coach.
Rules:
- Be concise: 2–4 short sentences, no preamble, no markdown headers.
- Ground every answer in the athlete's data you're given (their race, level, phase, today's session).
- Motivate through clarity and respect, never hype. No "crush it", no exclamation-mark spam.
- Give practical, specific guidance (pacing, fueling, form, recovery).
- You are not a doctor. For pain/injury/illness, advise rest and a medical professional — briefly.`;

// crude per-user hourly limiter to protect spend
const g = globalThis as unknown as { __coachHits?: Map<string, { c: number; t: number }> };
function allow(uid: string): boolean {
  if (!g.__coachHits) g.__coachHits = new Map();
  const now = Date.now();
  const rec = g.__coachHits.get(uid);
  if (!rec || now - rec.t > 3600_000) {
    g.__coachHits.set(uid, { c: 1, t: now });
    return true;
  }
  if (rec.c >= 40) return false;
  rec.c++;
  return true;
}

export async function POST(req: NextRequest) {
  const uid = getUserIdFromRequest(req);
  if (!uid) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      enabled: false,
      text: "The AI coach isn't switched on yet. Your plan is fully built and ready — everything works without it.",
    });
  }
  if (!allow(uid)) {
    return NextResponse.json({
      enabled: true,
      text: "You've asked the coach a lot this hour — give it a breather and check back soon.",
    });
  }

  const body = await req.json().catch(() => ({}));
  const context = String(body.context ?? "").slice(0, 4000);
  const question = String(body.question ?? "").slice(0, 600);

  try {
    // dynamic import keeps the SDK out of the client bundle
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Athlete context:\n${context}\n\n${
            question ? `Question: ${question}` : "Give a short, motivating note for today."
          }`,
        },
      ],
    });
    const text = msg.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    return NextResponse.json({ enabled: true, text: text || "Stay consistent — the work adds up." });
  } catch (e) {
    return NextResponse.json(
      { enabled: true, text: "The coach is catching its breath. Your plan is ready to go regardless." },
      { status: 200 },
    );
  }
}
