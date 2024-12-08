import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } } // Match the `[id]` folder parameter name
) {
  const { id: eventId } = params; // Extract `id` as `eventId`

  if (!eventId) {
    console.error("Event ID is undefined");
    return NextResponse.json(
      { message: "Event ID is required" },
      { status: 400 }
    );
  }

  console.log("Fetching comments for Event ID:", eventId); // Log to verify eventId

  try {
    const comments = await prisma.comment.findMany({
      where: { eventId },
      include: {
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
        replies: { // Include replies in the query
          include: {
            createdBy: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(comments, { status: 200 });
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
