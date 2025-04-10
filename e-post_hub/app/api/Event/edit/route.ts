import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Handle GET request
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
  }

  try {
    const event = await prisma.event.findUnique({
      where: { id },
      include: { occurrences: true },
    });

    if (!event) {
      console.log("Event not found for ID:", id);
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json(event, { status: 200 });
  } catch (error) {
    console.error('Error fetching event:', error);
    return NextResponse.json(
      { error: 'Failed to fetch the event' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Handle PUT request for updating an event
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      title,
      description,
      type,
      address,
      flyer,
      website,
      eventOccurrences,
    } = body;

    if (!id || !title) {
      return NextResponse.json(
        { error: 'ID and title are required' },
        { status: 400 }
      );
    }

    let updatedLatitude = null;
    let updatedLongitude = null;

    if (address) {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (apiKey) {
        const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
        const response = await fetch(geoUrl);
        const geoData = await response.json();

        if (geoData.status === "OK" && geoData.results.length > 0) {
          updatedLatitude = geoData.results[0].geometry.location.lat;
          updatedLongitude = geoData.results[0].geometry.location.lng;
        } else {
          console.warn("Geolocation lookup failed for address:", address);
        }
      }
    }

    // Transaction to handle occurrences properly
    await prisma.$transaction([
      // Delete existing occurrences
      prisma.eventOccurrence.deleteMany({ where: { eventId: id } }),

      // Update main event data
      prisma.event.update({
        where: { id },
        data: {
          title,
          description,
          type,
          address,
          flyer,
          website,
          latitude: updatedLatitude,
          longitude: updatedLongitude,
        },
      }),

      // Create new occurrences if provided
      ...(eventOccurrences?.length > 0 ? [
        prisma.eventOccurrence.createMany({
          data: eventOccurrences.map((occ: any) => ({
            eventId: id,
            date: new Date(occ.date),
            startTime: occ.startTime || null,
            endTime: occ.endTime || null,
          })),
        }),
      ] : []),
    ]);

    const updatedEvent = await prisma.event.findUnique({
      where: { id },
      include: { occurrences: true },
    });

    return NextResponse.json(updatedEvent, { status: 200 });
  } catch (error) {
    console.error('Error updating event:', error);
    return NextResponse.json(
      { error: 'Failed to update the event' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
