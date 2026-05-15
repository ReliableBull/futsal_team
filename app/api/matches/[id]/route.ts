import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import {
  MatchNotFoundError,
  MatchValidationError,
  deleteMatchRecord,
  matchInclude,
  parseMatchJson,
  updateMatchRecord
} from "@/lib/matches";
import { prisma } from "@/lib/prisma";

function parseMatchId(id: string) {
  const matchId = Number(id);
  return Number.isInteger(matchId) ? matchId : null;
}

function errorResponse(error: unknown) {
  if (error instanceof MatchValidationError || error instanceof MatchNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json({ error: "요청을 처리할 수 없습니다." }, { status: 500 });
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const matchId = parseMatchId(params.id);
  if (!matchId) {
    return NextResponse.json({ error: "경기 ID가 올바르지 않습니다." }, { status: 400 });
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: matchInclude
  });

  if (!match) {
    return NextResponse.json({ error: "존재하지 않는 경기입니다." }, { status: 404 });
  }

  return NextResponse.json({ match });
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const matchId = parseMatchId(params.id);
  if (!matchId) {
    return NextResponse.json({ error: "경기 ID가 올바르지 않습니다." }, { status: 400 });
  }

  try {
    const payload = parseMatchJson(await request.json());
    const match = await updateMatchRecord(matchId, payload);
    return NextResponse.json({ match });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const matchId = parseMatchId(params.id);
  if (!matchId) {
    return NextResponse.json({ error: "경기 ID가 올바르지 않습니다." }, { status: 400 });
  }

  try {
    await deleteMatchRecord(matchId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
