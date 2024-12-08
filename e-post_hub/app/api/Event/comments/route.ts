import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  const { content, eventId, userId, parentId } = await req.json();

  if (!content || !eventId || !userId) {
    return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
  }

  try {
    const newComment = await prisma.comment.create({
      data: {
        content,
        eventId,
        userId,
        parentId, // Optional parentId for replies
      },
      include: {
        createdBy: { // Include user info in the response
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(newComment, { status: 201 });
  } catch (error) {
    console.error("Error adding comment:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
