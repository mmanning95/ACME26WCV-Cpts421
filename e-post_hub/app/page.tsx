"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, CardHeader } from "@nextui-org/react";
import Link from "next/link";
import EventCalendar from "./Components/Calendar/EventCalendar";
import jwt from "jsonwebtoken";
import BottomBar from "./Components/BottomBar/BottomBar";
import MilitaryBranches from "./Images/Military-Branches.jpg";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@nextui-org/react";
import PdfViewer from "./Components/PdfViewer/PdfViewer";


type EventOccurrence = {
  id: string;
  eventId: string;
  date: string;
  startTime?: string;
  endTime?: string;
};

type Event = {
  id: string;
  title: string;
  description?: string;
  createdBy: {
    name: string;
    email: string;
  };
  status: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  website?: string;
  flyer?: string;
  type?: string;
  interested: number;
  latitude: number;
  longitude: number;
  distance: number;
  address?: string;
  occurrences?: EventOccurrence[];

};

export default function HomePage() {
  const router = useRouter();

  function isPdfUrl(url?: string | null) {
    if (!url) return false;
    return url.toLowerCase().endsWith(".pdf");
  }
  

  // -- All events (past + future) --
  const [events, setEvents] = useState<Event[]>([]);
  // -- The subset (upcoming‐only) --
  const [defaultEvents, setDefaultEvents] = useState<Event[]>([]);
  // -- The currently displayed list (can be filtered) --
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  // -- True if the user has applied filters/date picks, etc. --
  const [isFiltering, setIsFiltering] = useState(false);

  const [message, setMessage] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [eventTypes, setEventTypes] = useState<string[]>([]);

  const [selectedProximity, setSelectedProximity] = useState<number | null>(
    null
  );
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // ------------------------------ FETCH EVENTS --------------------------------
  useEffect(() => {
    async function fetchApprovedEvents() {
      try {
        const response = await fetch("/api/Event/approved");
        if (!response.ok) {
          console.error(
            "Failed to fetch approved events:",
            response.statusText
          );
          return;
        }

        const data = await response.json();
        const allEvents = data.events as Event[];

        allEvents.forEach((ev) => {
          if (ev.occurrences && ev.occurrences.length > 0) {
            // Sort them by date ascending
            ev.occurrences.sort(
              (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
            );
            const earliest = ev.occurrences[0].date;
            const latest = ev.occurrences[ev.occurrences.length - 1].date;
            // Convert "2025-08-10T00:00:00.000Z" => "2025-08-10"
            ev.startDate = earliest.split("T")[0];
            ev.endDate = latest.split("T")[0];
          } else {
            // If no occurrences, or none returned, we have no date range
            ev.startDate = undefined;
            ev.endDate = undefined;
          }
        });

        // 1) Sort events by start date
        allEvents.sort((a, b) => {
          const dateA = a.startDate
            ? new Date(a.startDate).getTime()
            : Infinity;
          const dateB = b.startDate
            ? new Date(b.startDate).getTime()
            : Infinity;
          return dateA - dateB;
        });

        // 2) Build an upcoming only subset
        const now = new Date();
        const upcoming = allEvents.filter((event) => {
          const endDate = event.endDate ? new Date(event.endDate) : null;
          const startDate = event.startDate ? new Date(event.startDate) : null;

          // If there's an endDate and it's already passed, exclude
          if (endDate && endDate < now) return false;

          // If no endDate but the startDate is in the past, exclude
          if (!endDate && startDate && startDate < now) return false;

          return true;
        });

        // 3) Keep the full array so you can still display older items if needed
        setEvents(allEvents);

        // 4) 'defaultEvents' = upcoming only
        setDefaultEvents(upcoming);

        // 5) By default, show upcoming events
        setFilteredEvents(upcoming);

        // 6) Not in a “filtered” state yet
        setIsFiltering(false);

        // Build your unique event types
        const uniqueTypes: string[] = Array.from(
          new Set<string>(allEvents.map((ev) => ev.type || "").filter(Boolean))
        );
        setEventTypes(uniqueTypes);
      } catch (error) {
        console.error("Error fetching approved events:", error);
      }
    }

    fetchApprovedEvents();
  }, []);

  // -------------------- PROXIMITY & GEOLOCATION --------------------

  const getUserLocation = () => {
    if (!("geolocation" in navigator)) {
      setMessage("Geolocation is not supported.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(newLocation);
      },
      () =>
        setMessage(
          "Location access denied. Please enable location permissions."
        ),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  async function fetchEventDistances(someEvents: Event[]) {
    if (!userLocation) return someEvents;
    const validEvents = someEvents.filter((e) => e.latitude && e.longitude);

    if (validEvents.length === 0) return someEvents;

    const destinations = validEvents
      .map((ev) => `${ev.latitude},${ev.longitude}`)
      .join("|");
    if (!destinations) return someEvents;

    try {
      const url = `/api/proximity?origins=${userLocation.lat},${userLocation.lng}&destinations=${destinations}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.status !== "OK" || !data.rows?.length) return someEvents;

      const distances = data.rows[0].elements;
      return validEvents.map((ev, index) =>
        distances[index]?.status === "OK"
          ? { ...ev, distance: distances[index].distance.value / 1609.34 }
          : { ...ev, distance: NaN }
      );
    } catch {
      return someEvents;
    }
  }

  const handleProximityFilter = async (distance: number) => {
    // Mark that we're now filtering
    setIsFiltering(true);

    // Make sure we have user location
    if (!userLocation) {
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
            resolve();
          },
          () => {
            console.warn(
              "Location access denied. Please enable location permissions."
            );
            resolve();
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000,
          }
        );
      });
    }

    setSelectedProximity(distance);
    const updatedEvents = await fetchEventDistances(events);

    const filtered = updatedEvents.filter(
      (ev) => ev.distance !== undefined && ev.distance <= distance
    );
    setFilteredEvents(filtered);
  };

  // ------------------------- ROLES / TOKEN -------------------------
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decodedToken = jwt.decode(token) as { role: string };
        if (decodedToken) {
          if (decodedToken.role === "ADMIN") {
            router.push("/Admin");
            return;
          } else if (decodedToken.role === "MEMBER") {
            router.push("/Member");
            return;
          }
        }
      } catch (error) {
        console.error("Error decoding token:", error);
        return;
      }
    }
  }, [router]);

  // --------------------- FILTERS / TYPE / CALENDAR -------------------

  const handleTypeFilter = (keys: Set<string>) => {
    setIsFiltering(true); // user is applying a filter
    setSelectedTypes(keys);
    const selectedArray = Array.from(keys);

    if (selectedArray.length === 0) {
      // No type selected => show *all upcoming*
      setFilteredEvents(defaultEvents);
    } else {
      // Filter from *all* events or from default events?
      // Typically you'd filter from *defaultEvents* if you want to keep only future events
      // or from *events* if you want to allow older events as well.
      setFilteredEvents(
        defaultEvents.filter((ev) => selectedArray.includes(ev.type || ""))
      );
    }
  };

  const handleDateClick = (dateString: string) => {
    setIsFiltering(true); // user clicked a specific date => filtered

    // Convert string => Date
    const clickedDate = new Date(dateString);

    // If you want to allow older events, you could filter from all events.
    // If you only want upcoming events, filter from defaultEvents. It's up to you.
    const eventsForDate = events.filter((ev) => {
      if (!ev.startDate || !ev.endDate) return false;
      const start = new Date(ev.startDate);
      const end = new Date(ev.endDate);

      return clickedDate >= start && clickedDate <= end;
    });
    setFilteredEvents(eventsForDate);
  };

  // --------------------- INTEREST HANDLER -------------------

  const handleInterest = async (eventId: string) => {
    const interestedEvents = JSON.parse(
      localStorage.getItem("interestedEvents") || "[]"
    ) as string[];

    if (interestedEvents.includes(eventId)) {
      setMessage("You have already expressed interest in this event.");
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    // Add the event ID to the local storage
    localStorage.setItem(
      "interestedEvents",
      JSON.stringify([...interestedEvents, eventId])
    );

    try {
      const response = await fetch(`/api/Event/interest/${eventId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        // increment interest count in both arrays
        setEvents((prev) =>
          prev.map((ev) =>
            ev.id === eventId ? { ...ev, interested: ev.interested + 1 } : ev
          )
        );
        setFilteredEvents((prev) =>
          prev.map((ev) =>
            ev.id === eventId ? { ...ev, interested: ev.interested + 1 } : ev
          )
        );
        setMessage("Your interest has been recorded.");
      } else {
        setMessage("Failed to register interest.");
      }
    } catch (error) {
      console.error("Error registering interest:", error);
      setMessage("An error occurred. Please try again.");
    }

    setTimeout(() => setMessage(null), 3000);
  };

  // --------------------- RESET FILTER -------------------
  const resetFilter = () => {
    // Return to the default “upcoming only” subset
    setFilteredEvents(defaultEvents);
    setIsFiltering(false);
    setSelectedProximity(null);
    setSelectedTypes(new Set());
  };

  // --------------------- RENDERING -----------------------
  return (
    <div className="min-h-screen w-full bg-blue-100 flex flex-col">
      <div
        className="w-full h-[650px] bg-cover bg-center"
        style={{ backgroundImage: `url(${MilitaryBranches.src})` }}
      />

      <div className="flex flex-col md:flex-row w-full">
        {/* Sidebar */}
        <div className="calendar-sidebar w-full md:w-2/5 p-4 lg:w-1/4">
          <EventCalendar events={events} onDateClick={handleDateClick} />

          {/* Event type Filter */}
          <Dropdown>
            <DropdownTrigger>
              <Button className="w-full border border-gray-300 bg-white text-black">
                Filter by Event Type
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Filter by Event Type"
              selectionMode="multiple"
              selectedKeys={selectedTypes}
              onSelectionChange={(keys) =>
                handleTypeFilter(keys as Set<string>)
              }
            >
              {eventTypes.map((type) => (
                <DropdownItem key={type}>{type}</DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>

          {/* Proximity filter */}

          <Dropdown className="mt-2">
            <DropdownTrigger>
              <Button
                className="w-full border border-gray-300 bg-white text-black"
                onClick={getUserLocation}
              >
                Distance
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Filter by Distance"
              selectionMode="single"
              selectedKeys={
                selectedProximity ? [String(selectedProximity)] : []
              }
              onSelectionChange={(keys) => {
                const selectedValue = Number(Array.from(keys)[0] as string);
                handleProximityFilter(selectedValue);
              }}
            >
              <DropdownItem key="5">Within 5 miles</DropdownItem>
              <DropdownItem key="10">Within 10 miles</DropdownItem>
              <DropdownItem key="20">Within 20 miles</DropdownItem>
              <DropdownItem key="50">Within 50 miles</DropdownItem>
            </DropdownMenu>
          </Dropdown>

          {/* Print Events Button */}
          <Button
            className="mt-4 bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black text-black w-full"
            onClick={() => {
              const filters = {
                types: Array.from(selectedTypes),
                proximity: selectedProximity,
              };
              const queryParams = new URLSearchParams({
                filters: JSON.stringify(filters),
              }).toString();
              window.open(`/print?${queryParams}`, "_blank");
            }}
          >
            Print Events
          </Button>

          {/* Show "Reset" button ONLY if isFiltering is true */}
          {isFiltering && (
            <Button
              onClick={resetFilter}
              className="mt-4 bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black text-black w-full"
            >
              Reset Filter
            </Button>
          )}
        </div>

        {/* Main Content */}
        <div className="content w-3/4 p-4">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold">
            Welcome to Whitman county veteran page
            </h1>
            <p className="text-lg mt-4">
              Find and participate in events specifically tailored for veterans
              and their families.
            </p>
          </div>

          {/* Display the list of approved events */}
          <div className="mt-10">
            <h4 className="text-2xl mb-4 text-center">Events:</h4>

            {filteredEvents.length === 0 ? (
              <p className="text-center">
                No events found for the selected date
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-1 lg:grid-cols-3">
                {filteredEvents.map((event) => (
                  <Card
                    key={event.id}
                    className="mb-4 md:w-[320-px] lg:w-[380-px]"
                    style={{ minHeight: "400px", minWidth: "280px" }}
                  >
                    {event.flyer ? (
                      <>
                        <CardHeader className="p-4 flex justify-between items-center">
                          <h5 className="text-xl font-bold">{event.title}</h5>
                          <p className="text-gray-600">
                            <strong>Interested:</strong> {event.interested}
                          </p>
                        </CardHeader>
                        <CardBody className="flex flex-col justify-between p-6">
                        {isPdfUrl(event.flyer) ? (
  <a
  href={event.flyer}
  target="_blank"
  rel="noopener noreferrer"
  style={{ display: "block", position: "relative" }}
>
  <PdfViewer fileUrl={event.flyer} containerHeight={400} />
</a>) : (
  // If it’s not a PDF, fall back to the image:
  <a
    href={event.flyer}
    target="_blank"
    rel="noopener noreferrer"
  >
    <img
      src={event.flyer}
      alt={`${event.title} Flyer`}
      style={{ maxHeight: "400px" }}
      className="w-full h-full object-cover rounded-md"
    />
  </a>
)}
                          <div className="flex gap-2 mt-4 justify-center">
                            <Button
                              className="hover:scale-105 transition-transform duration-200 ease-in-out bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black text-black"
                              onClick={() => handleInterest(event.id)}
                            >
                              I'm Interested
                            </Button>

                            <Button
                              as={Link}
                              href={`/Event/${event.id}`}
                              passHref
                              className="hover:scale-105 transition-transform duration-200 ease-in-out bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black text-black"
                            >
                              View Details
                            </Button>
                          </div>
                        </CardBody>
                      </>
                    ) : (
                      <CardBody className="flex flex-col justify-between p-6">
                        <div>
                          <h5 className="text-xl font-bold mb-4">
                            {event.title}
                          </h5>
                          {event.description && (
                            <p className="text-gray-700 mb-4">
                              {event.description}
                            </p>
                          )}
                          {event.startDate && (
                            <p className="text-gray-600">
                              <strong>Start Date:</strong>{" "}
                              {new Date(event.startDate).toLocaleDateString()}
                            </p>
                          )}
                          {event.endDate && (
                            <p className="text-gray-600">
                              <strong>End Date:</strong>{" "}
                              {new Date(event.endDate).toLocaleDateString()}
                            </p>
                          )}
                          {event.startTime && (
                            <p className="text-gray-600">
                              <strong>Start Time:</strong> {event.startTime}
                            </p>
                          )}
                          {event.endTime && (
                            <p className="text-gray-600">
                              <strong>End Time:</strong> {event.endTime}
                            </p>
                          )}
                          {event.address && (
                            <p className="text-gray-600">
                              <strong>Address:</strong> {event.address}
                            </p>
                          )}

                          {event.website && (
                            <p className="text-gray-600">
                              <strong>Website:</strong>{" "}
                              <a
                                href={
                                  event.website.startsWith("http://") ||
                                  event.website.startsWith("https://")
                                    ? event.website
                                    : `https://${event.website}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 underline"
                              >
                                {event.website}
                              </a>
                            </p>
                          )}
                          <p className="text-gray-600">
                            <strong>Interested:</strong> {event.interested}
                          </p>
                        </div>
                        <div className="flex gap-2 mt-4 justify-center">
                          <Button
                            className="hover:scale-105 transition-transform duration-200 ease-in-out bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black text-black"
                            onClick={() => handleInterest(event.id)}
                          >
                            I'm Interested
                          </Button>

                          <Button
                            as={Link}
                            href={`/Event/${event.id}`}
                            passHref
                            className="hover:scale-105 transition-transform duration-200 ease-in-out bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black text-black"
                          >
                            View Details
                          </Button>
                        </div>
                      </CardBody>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <BottomBar />
    </div>
  );
}
