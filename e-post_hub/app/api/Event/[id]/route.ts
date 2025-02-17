import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  try {
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ message: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json({ event }, { status: 200 });
  } catch (error) {
    console.error('Error fetching event:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// ADD THIS PATCH HANDLER
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  try {
    // Parse JSON body
    const data = await req.json();

    // You can destructure if you want only certain fields:
    // const { title, description, address, type, website, startDate, endDate } = data;
    // Then pass them to `data:` in your update

    // Example:
    const updatedEvent = await prisma.event.update({
      where: { id },
      data: {
        ...data,
        // If startDate / endDate are strings that need to be Date objects:
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
    });

    return NextResponse.json(updatedEvent, { status: 200 });
  } catch (error) {
    console.error('Error updating event:', error);
    return NextResponse.json({ message: 'Failed to update event.' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
