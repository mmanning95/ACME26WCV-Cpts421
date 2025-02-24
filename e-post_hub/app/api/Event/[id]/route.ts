import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import sgMail from '@sendgrid/mail';

//SG API Key
sgMail.setApiKey(process.env.SENDGRID_API_KEY as string);


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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const existingEvent = await prisma.event.findUnique({
    where: { id },
    include: { createdBy: { select: { email: true, name: true } } },
  });
  
  try {
    // Parse JSON body
    const data = await req.json();


    const updatedEvent = await prisma.event.update({
      where: { id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
    });


    // Automatic email to be sent out when event changes.
    if (existingEvent?.createdBy?.email) {
      const msg = {
        to: existingEvent.createdBy.email,
        from: process.env.EMAIL_FROM || "default@example.com", //Set to admin email
        subject: 'Your Event Has Been Modified',
        text: `Hello ${existingEvent.createdBy.name},
    
    Your event "${updatedEvent.title}" has modified.
    
    Details:
    - Title: ${updatedEvent.title}
    - Date: ${updatedEvent.startDate ? updatedEvent.startDate.toISOString().split('T')[0] : "Not specified"} to ${updatedEvent.endDate ? updatedEvent.endDate.toISOString().split('T')[0] : "Not specified"}
    - Address: ${updatedEvent.address || "Not specified"}
    - Website: ${updatedEvent.website || "Not specified"}
    
    If you did not make these changes, please contact support.
    
    Best,
    The Veteran e-Post Hub Team`,
      };
    
      try {
        await sgMail.send(msg);
        console.log("Update email sent to:", existingEvent.createdBy.email);
      } catch (emailError) {
        console.error("Failed to send update email:", emailError);
      }
    }
    

    return NextResponse.json(updatedEvent, { status: 200 });
  } catch (error) {
    console.error('Error updating event:', error);
    return NextResponse.json({ message: 'Failed to update event.' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
