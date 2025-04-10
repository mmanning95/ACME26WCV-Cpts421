"use client";
import { Button, Card, CardBody, CardHeader } from "@nextui-org/react";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import jwt from "jsonwebtoken";
import EventCalendar from "../Components/Calendar/EventCalendar";
import BottomBar from "../Components/BottomBar/BottomBar";
import MilitaryBranches from "../Images/Military-Branches.jpg";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@nextui-org/react";
import dynamic from "next/dynamic";

const PdfViewer = dynamic(() => import("../Components/PdfViewer/PdfViewer"), {
  ssr: false,
});

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

export default function Adminpage() {
  const router = useRouter();

  function isPdfUrl(url?: string | null) {
    if (!url) return false;
    return url.toLowerCase().endsWith(".pdf");
  }
  
  

  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupStatus, setCleanupStatus] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminName, setAdminName] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [defaultEvents, setDefaultEvents] = useState<Event[]>([]);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [isFiltering, setIsFiltering] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedProximity, setSelectedProximity] = useState<number | null>(
    null
  );
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  {
    /*for event filtering by type */
  }
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());

  {
    /*  Retrieves the user's current location using the browser's Geolocation API. */
  }
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

        setUserLocation((prevLocation) =>
          prevLocation &&
          prevLocation.lat === newLocation.lat &&
          prevLocation.lng === newLocation.lng
            ? prevLocation
            : newLocation
        );
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

  {
    /* Fetches the distance between the user's location and each event location using an API. */
  }
  const fetchEventDistances = async (events: Event[]) => {
    if (!userLocation) return events;

    const validEvents = events.filter(
      (event) => event.latitude !== null && event.longitude !== null
    );

    if (validEvents.length === 0) return events;

    const destinations = validEvents
      .map((event) => `${event.latitude},${event.longitude}`)
      .join("|");

    if (!destinations) return events;

    const url = `/api/proximity?origins=${userLocation.lat},${userLocation.lng}&destinations=${destinations}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== "OK" || !data.rows || data.rows.length === 0)
        return events;

      const distances = data.rows[0].elements;

      return validEvents.map((event, index) =>
        distances[index]?.status === "OK"
          ? {
              ...event,
              distance: distances[index].distance.value / 1609.34,
            }
          : { ...event, distance: NaN }
      );
    } catch {
      return events;
    }
  };

  {
    /*  Filters events based on the selected proximity (distance in miles). */
  }
  const handleProximityFilter = async (distance: number) => {
    setIsFiltering(true);
    
    if (!userLocation) {
      getUserLocation();
    }

    setSelectedProximity(distance);

    const updatedEvents = await fetchEventDistances(events);

    setFilteredEvents(
      updatedEvents.filter(
        (event) => event.distance !== undefined && event.distance <= distance
      )
    );
  };

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      router.replace("/Unauthorized"); // Redirect immediately
      return;
    }


    if (token) {
      try {
        const decodedToken = jwt.decode(token) as {
          userId: string;
          role: string;
          name?: string;
        };
        if (!decodedToken || decodedToken.role !== "ADMIN") {
          router.replace("/Unauthorized");
        } else {
          setIsAdmin(true);
          setAdminName(decodedToken.name || "Admin");
          fetchEvents();
        }
      } catch (error) {
        router.replace("/Unauthorized");
      }    }

      async function fetchEvents() {
        try {
          const response = await fetch("/api/Event/approved");
          if (!response.ok) {
            console.error("Failed to fetch approved events:", response.statusText);
            return;
          }
      
          const data = await response.json();
          const allEvents = data.events as Event[];
      
          // ******** 1) Compute startDate / endDate from occurrences
          // Check if each event has .occurrences. If so, figure out earliest & latest
          allEvents.forEach((ev) => {
            if (ev.occurrences && ev.occurrences.length > 0) {
              // Sort them by date ascending
              ev.occurrences.sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
              );
              const earliest = ev.occurrences[0].date; 
              const latest = ev.occurrences[ev.occurrences.length - 1].date;
      
              // “YYYY-MM-DD”
              ev.startDate = earliest.split("T")[0];
              ev.endDate = latest.split("T")[0];
            } else {
              // No occurrences => no range
              ev.startDate = undefined;
              ev.endDate = undefined;
            }
          });
      
          // 2) Sort events by start date
          allEvents.sort((a, b) => {
            const dateA = a.startDate ? new Date(a.startDate).getTime() : Infinity;
            const dateB = b.startDate ? new Date(b.startDate).getTime() : Infinity;
            return dateA - dateB;
          });
      
          // 3) Build an upcoming only subset
          const now = new Date();
          const upcoming = allEvents.filter((event) => {
            const endDate = event.endDate ? new Date(event.endDate) : null;
            const startDate = event.startDate ? new Date(event.startDate) : null;
      
            if (endDate && endDate < now) return false;
            if (!endDate && startDate && startDate < now) return false;
            return true;
          });
      
          // 4) Keep full array for older items if needed
          setEvents(allEvents);
      
          // 5) defaultEvents = upcoming only
          setDefaultEvents(upcoming);
      
          // 6) By default, show upcoming
          setFilteredEvents(upcoming);
          setIsFiltering(false);
      
          // Build unique event types
          const uniqueTypes: string[] = Array.from(
            new Set<string>(allEvents.map((ev) => ev.type || "").filter(Boolean))
          );
          setEventTypes(uniqueTypes);
      
        } catch (error) {
          console.error("Error fetching approved events:", error);
        }
      }
      

    fetchEvents();
  }, []);


  const handleDateClick = (dateString: string) => {
    setIsFiltering(true);
  
    // Instead of new Date, just do a direct string compare
    const filtered = events.filter((ev) => {
      if (!ev.startDate) return false;
      const start = ev.startDate; // e.g. "2025-08-10"
      const end = ev.endDate || start;
      // If dateString is "2025-08-10", 
      // we check if it's between start & end (all strings).
      return dateString >= start && dateString <= end;
    });
  
    setFilteredEvents(filtered);
    console.log("Events in state:", events);
  };
  


  const handleTypeFilter = (keys: Set<string>) => {
    setIsFiltering(true);
    setSelectedTypes(keys);
    const selectedArray = Array.from(keys);

    if (selectedArray.length === 0) {
      setFilteredEvents(defaultEvents);
    } else {
      setFilteredEvents(
        defaultEvents.filter((ev) => selectedArray.includes(ev.type || ""))
      );
    }
  };

  const resetFilter = () => {
    setFilteredEvents(defaultEvents); // Reset to show all events
    setIsFiltering(false); // Reset filtering state
    setSelectedProximity(null); // Clear the selected distance
    setSelectedTypes(new Set()); 
  };

  const handleInterest = async (eventId: string) => {
    const interestedEvents = JSON.parse(
      localStorage.getItem("interestedEvents") || "[]"
    ) as string[];

    if (interestedEvents.includes(eventId)) {
      setMessage("You have already expressed interest in this event.");
      setTimeout(() => setMessage(null), 3000);
      return;
    }

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
        setEvents((prevEvents) =>
          prevEvents.map((event) =>
            event.id === eventId
              ? { ...event, interested: event.interested + 1 }
              : event
          )
        );
        setFilteredEvents((prevFilteredEvents) =>
          prevFilteredEvents.map((event) =>
            event.id === eventId
              ? { ...event, interested: event.interested + 1 }
              : event
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

  const handleDelete = async () => {
    if (!selectedEventId) return;

    try {
      const response = await fetch("/api/Event/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ eventId: selectedEventId }),
      });

      if (response.ok) {
        setEvents((prevEvents) =>
          prevEvents.filter((event) => event.id !== selectedEventId)
        );
        setFilteredEvents((prevEvents) =>
          prevEvents.filter((event) => event.id !== selectedEventId)
        );
        setMessage("Event deleted successfully.");
      } else {
        const errorData = await response.json();
        setMessage("Failed to delete the event: " + errorData.error);
      }
    } catch (error) {
      console.error("Error deleting event:", error);
      setMessage("An error occurred while deleting the event.");
    } finally {
      setModalOpen(false);
      setSelectedEventId(null);
    }
  };

  // if (!isAdmin) {
  //   return <div>Loading...</div>;
  // }

  return (
    <div className=" bg-blue-100 w-full">
      <div
        className="w-full h-[650px] bg-cover bg-center"
        style={{ backgroundImage: `url(${MilitaryBranches.src})` }}
      ></div>

      {/* Sidebar */}
      {/* Calendar */}
      <div className="flex flex-col md:flex-row w-full">
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

          {/* Proximity filter*/}
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

          {isFiltering && (
            <Button
              onClick={resetFilter}
              className="mt-4 bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black text-black w-full"
            >
              Reset Filter
            </Button>
          )}
          {isAdmin && (
            <Button
              onClick={() => setShowCleanupModal(true)}
              className="mt-4 bg-gradient-to-r from-red-600 to-orange-500 border border-black text-white w-full"
            >
              Delete Expired Events
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
            Check out the upcoming events that you can join!
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
                    style={{
                      minHeight: "400px", minWidth: "280px",
                    }}
                  >
                    {event.flyer ? (
                      // Display title, image, and buttons if the flyer exists
                      <>
                        <CardHeader className="p-4 flex justify-between items-center ">
                          <h5 className="text-xl font-bold">{event.title}</h5>
                          <p className="text-gray-600">
                            Interested: {event.interested}
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
                          <div className="flex flex-col gap-2 mt-4 justify-center items-center">
                            {/* Top Row: Interested and Delete Event */}
                            <div className="flex gap-2">
                              <Button
                                className="hover:scale-105 transition-transform duration-200 ease-in-out bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black text-black"
                                onClick={() => handleInterest(event.id)}
                              >
                                I'm Interested
                              </Button>
                              {isAdmin && (
                                <Button
                                  className=" hover:scale-105 transition-transform duration-200 ease-in-out delete-button bg-red-500 text-white"
                                  onClick={() => {
                                    setSelectedEventId((prev) => {
                                      const newId = event.id;
                                      return newId;
                                    });
                                    setModalOpen(true);
                                  }}
                                >
                                  Delete Event
                                </Button>
                              )}
                            </div>

                            {/* Bottom Row: View Details */}
                            <Button
                              className="hover:scale-105 transition-transform duration-200 ease-in-out bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black text-black w-full"
                              style={{
                                width: isAdmin ? "220px" : "110px",
                              }}
                              as={Link}
                              href={`/Event/${event.id}`}
                              passHref
                            >
                              View Details
                            </Button>
                          </div>
                        </CardBody>
                      </>
                    ) : (
                      // Display all event information if no flyer exists
                      <CardBody className="flex flex-col justify-between">
                        <div>
                          <h5 className="text-xl font-bold mb-2">
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
                        <div className="flex flex-col gap-2 mt-4 justify-center items-center">
                          {/* Top Row: Interested and Delete Event */}
                          <div className="flex gap-2">
                            <Button
                              className=" hover:scale-105 transition-transform duration-200 ease-in-out bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black text-black"
                              onClick={() => handleInterest(event.id)}
                            >
                              I'm Interested
                            </Button>
                            {isAdmin && (
                              <Button
                                className="hover:scale-105 transition-transform duration-200 ease-in-out delete-button bg-red-500 text-white"
                                onClick={() => {
                                  setSelectedEventId(event.id);
                                  setModalOpen(true);
                                }}
                              >
                                Delete Event
                              </Button>
                            )}
                          </div>

                          {/* Bottom Row: View Details */}
                          <Button
                            className="hover:scale-105 transition-transform duration-200 ease-in-out bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black text-black w-full"
                            style={{
                              width: isAdmin ? "220px" : "110px",
                            }}
                            as={Link}
                            href={`/Event/${event.id}`}
                            passHref
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
      {modalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h3 className="text-xl font-bold mb-4">Confirm Deletion</h3>
            <p>
              Are you sure you want to delete this event? This action cannot be
              undone.
            </p>
            <div className="mt-4 flex justify-end gap-4">
              <Button
                className="bg-gray-500 text-white"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black text-black"
                onClick={() => {
                  handleDelete();
                }}
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      )}
      {showCleanupModal && (
  <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
    <div className="bg-white p-6 rounded-lg shadow-lg w-96">
      <h3 className="text-xl font-bold mb-4">Confirm Expired Event Cleanup</h3>
      <p>
        This will permanently delete all events that ended over a month ago,
        including their files. Are you sure?
      </p>
      <div className="mt-4 flex justify-end gap-4">
        <Button
          className="bg-gray-500 text-white"
          onClick={() => setShowCleanupModal(false)}
        >
          Cancel
        </Button>
        <Button
          className="bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black text-black"
          onClick={async () => {
            try {
              const res = await fetch("/api/Event/cleanup", {
                method: "DELETE",
              });
              const data = await res.json();
          
              if (res.ok) {
                window.location.reload(); 
              } else {
                setCleanupStatus(` ${data.error || "Cleanup failed."}`);
              }
            } catch (err) {
              console.error("Cleanup error:", err);
              setCleanupStatus(" Error while cleaning up events.");
            } finally {
              setShowCleanupModal(false);
            }
          }}
                  >
          Confirm Cleanup
        </Button>
      </div>
    </div>
  </div>
)}


      <BottomBar /> 
    </div>
  );
}
