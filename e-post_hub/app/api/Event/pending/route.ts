import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const pendingEvents = await prisma.event.findMany({
      where: {
        status: 'PENDING',
      },
      include: {
        occurrences: true,
        createdBy: {
          select : {
            name: true,
            email: true
          }
        }
      }
    });


    return NextResponse.json({ events: pendingEvents }, { status: 200 });
  } catch (error) {
    console.error('Error fetching pending events:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
