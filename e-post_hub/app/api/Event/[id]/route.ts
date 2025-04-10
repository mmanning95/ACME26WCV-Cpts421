import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import sgMail from "@sendgrid/mail";

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
        occurrences: true, 
      },
    });

    if (!event) {
      return NextResponse.json(
        { message: "Event not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ event }, { status: 200 });
  } catch (error) {
    console.error("Error fetching event:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
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
    include: {
      createdBy: { select: { email: true, name: true } },
      occurrences: true,
    },
  });

  if (!existingEvent) {
    return NextResponse.json({ message: "Event not found" }, { status: 404 });
  }

  try {
    const data = await req.json();

    let updatedLatitude = existingEvent.latitude;
    let updatedLongitude = existingEvent.longitude;

    if (data.address && data.address !== existingEvent.address) {
      try {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (apiKey) {
          const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
            data.address
          )}&key=${apiKey}`;
          const response = await fetch(geoUrl);
          const geoData = await response.json();

          if (geoData.status === "OK" && geoData.results.length > 0) {
            updatedLatitude = geoData.results[0].geometry.location.lat;
            updatedLongitude = geoData.results[0].geometry.location.lng;
          }
        }
      } catch (error) {
        console.error("Error fetching geolocation:", error);
      }
    }

    const { eventOccurrences, ...rest } = data;

    const updateData: any = {
      ...rest,
      latitude: updatedLatitude,
      longitude: updatedLongitude,
    };

    if (eventOccurrences && eventOccurrences.length > 0) {
      await prisma.$transaction([
        prisma.eventOccurrence.deleteMany({ where: { eventId: id } }),
        prisma.event.update({
          where: { id },
          data: updateData,
        }),
        prisma.eventOccurrence.createMany({
          data: eventOccurrences.map((occ: any) => ({
            eventId: id,
            date: new Date(occ.date),
            startTime: occ.startTime || null,
            endTime: occ.endTime || null,
          })),
        }),
      ]);
    } else {
      await prisma.event.update({
        where: { id },
        data: updateData,
      });
    }

    const finalEvent = await prisma.event.findUnique({
      where: { id },
      include: { createdBy: true, occurrences: true },
    });

    await sendUpdateEmail(existingEvent, finalEvent);

    return NextResponse.json(finalEvent, { status: 200 });
  } catch (error) {
    console.error("Error updating event:", error);
    return NextResponse.json({ message: "Failed to update event." }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}


// Helper function to send the email after update
async function sendUpdateEmail(existingEvent: any, updatedEvent: any) {
  if (existingEvent?.createdBy?.email) {
    const msg = {
      to: existingEvent.createdBy.email,
      from: process.env.EMAIL_FROM || "default@example.com", //Set to admin email
      subject: "Your Event Has Been Modified",
      text: `Hello ${existingEvent.createdBy.name},

Your event "${updatedEvent.title}" has been modified.

Details:
- Title: ${updatedEvent.title}
- Date: ${
        updatedEvent.startDate
          ? updatedEvent.startDate.toISOString().split("T")[0]
          : "Not specified"
      } to ${
        updatedEvent.endDate
          ? updatedEvent.endDate.toISOString().split("T")[0]
          : "Not specified"
      }
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
}
