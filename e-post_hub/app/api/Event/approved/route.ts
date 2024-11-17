import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Fetch all events with status "APPROVED"
    const approvedEvents = await prisma.event.findMany({
      where: { status: 'APPROVED' },
      include: {
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ events: approvedEvents }, { status: 200 });
  } catch (error) {
    console.error('Error fetching approved events:', error);
    return NextResponse.json({ message: 'Internal Server Error', details: error }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
