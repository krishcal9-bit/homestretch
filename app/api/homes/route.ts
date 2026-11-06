import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { SEED_HOMES } from '@/lib/seedData';

export async function GET() {
  try {
    const homes = await prisma.home.findMany({ orderBy: { completion: 'asc' } });
    return NextResponse.json({ homes: homes.length ? homes : SEED_HOMES });
  } catch {
    return NextResponse.json({ homes: SEED_HOMES });
  }
}
