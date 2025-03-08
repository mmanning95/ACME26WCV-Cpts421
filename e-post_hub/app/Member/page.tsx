"use client";

import { Button, Card, CardBody, CardHeader } from "@nextui-org/react";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import jwt from "jsonwebtoken";
import EventCalendar from "../Components/Calendar/EventCalendar";
import BottomBar from "../Components/BottomBar/BottomBar";
import MilitaryBranches from '../Images/Military-Branches.jpg';
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@nextui-org/react";

type Event = {
  id: string;
  title: string;
  description?: string;
  createdBy: {
    id: string;
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
};

export default function Memberpage() {
  const [isMember, setIsMember] = useState(false);
  const [memberName, setMemberName] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null); // Store the logged-in user's ID
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  
  const [selectedProximity, setSelectedProximity] = useState<number | null>(
    null
  );
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // {
  //   /*for event filtering by type */
  // }
  // const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());

  // const handleTypeFilter = (keys: Set<string>) => {
  //   setSelectedTypes(keys);
  //   const selectedArray = Array.from(keys);

  //   if (selectedArray.length === 0) {
  //     setFilteredEvents(events); // Show all events if no filter is selected
  //   } else {
  //     setFilteredEvents(
  //       events.filter((event) => selectedArray.includes(event.type || ""))
  //     );
  //   }
  // };

  const handleTypeFilter = (keys: Set<string>) => {
    setSelectedTypes(keys);
    const selectedArray = Array.from(keys);

    if (selectedArray.length === 0) {
      setFilteredEvents(events);
    } else {
      setFilteredEvents(
        events.filter((event) => selectedArray.includes(event.type || ""))
      );
    }
  };

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

    if (token) {
      try {
        const decodedToken = jwt.decode(token) as {
          userId: string;
          role: string;
          name?: string;
        };

        if (decodedToken && decodedToken.role === "MEMBER") {
          setIsMember(true);
          setMemberName(decodedToken.name || "Member");
          setUserId(decodedToken.userId); // Save the logged-in user's ID
          fetchApprovedEvents();
        } else {
          setMessage("Unauthorized access.");
          setTimeout(() => {
            window.location.href = "/Unauthorized";
          }, 3000);
        }
      } catch (error) {
        console.error("Invalid token", error);
        setMessage("Invalid token. Redirecting...");
        setTimeout(() => {
          window.location.href = "/Unauthorized";
        }, 3000);
      }
    } else {
      setMessage("You need to log in to access the member page.");
      setTimeout(() => {
        window.location.href = "/Unauthorized";
      }, 3000);
    }
  }, []);

  // Fetch approved events
  const fetchApprovedEvents = async () => {
    try {
      const response = await fetch("/api/Event/approved");
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events);
        setFilteredEvents(data.events); // Initially, show all events

        const uniqueTypes: string[] = Array.from(
          new Set<string>(data.events.map((event: Event) => event.type as string).filter(Boolean))
        );

        setEventTypes(uniqueTypes);

      } else {
        console.error("Failed to fetch approved events:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching approved events:", error);
    }
  };

  const handleDateClick = (date: string) => {
    // Filter events based on the selected date
    const eventsForDate = events.filter((event) => {
      const startDate = event.startDate
        ? new Date(event.startDate).toISOString().split("T")[0]
        : null;
      const endDate = event.endDate
        ? new Date(event.endDate).toISOString().split("T")[0]
        : null;
      return startDate && endDate && date >= startDate && date < endDate;
    });
    setFilteredEvents(eventsForDate);
  };

  const resetFilter = () => {
    setFilteredEvents(events); // Reset to show all events
    setSelectedProximity(null); // Clear the selected distance
  };

  const handleInterest = async (eventId: string) => {
    const interestedEvents = JSON.parse(
      localStorage.getItem("interestedEvents") || "[]"
    ) as string[];

    // Check if user has already expressed interest
    if (interestedEvents.includes(eventId)) {
      setMessage("You have already expressed interest in this event.");
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    // Add event to localStorage
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

  return (
    <div className="min-h-screen w-full bg-blue-100 flex flex-col">
      <div
        className="w-full h-[650px] bg-cover bg-center"
        style={{ backgroundImage: `url(${MilitaryBranches.src})` }}
      >
      </div>
      <div className="flex flex-col md:flex-row w-full">
        {/*  Sidebar */}
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
                          onSelectionChange={(keys) => handleTypeFilter(keys as Set<string>)}
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

          {filteredEvents.length !== events.length && (
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
            <h3 className="text-3xl font-bold">
              Welcome, {memberName || "Member"}!
            </h3>
            <p className="text-lg mt-4">
              Check out the upcoming events that you can join!
            </p>
            {message && (
              <div className="text-center mt-4 text-green-500">{message}</div>
            )}
          </div>

          {/* Events List */}
          <div className="mt-10">
            <h4 className="text-2xl mb-4 text-center">Approved Events:</h4>

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
                      minHeight: "400px",minWidth: "280px",
                    }}
                  >
                    {event.flyer ? (
                      <>
                        <CardHeader className="p-4 flex justify-between items-center">
                          <h5 className="text-xl font-bold">{event.title}</h5>
                          <p className="text-gray-600">
                            Interested: {event.interested}
                          </p>
                        </CardHeader>
                        <CardBody className="flex flex-col justify-between p-6">
                          <a
                            href={event.flyer}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <img
                              src={event.flyer}
                              alt={`${event.title} Flyer`}
                              className="w-full h-full object-cover rounded-md"
                              style={{
                                maxHeight: "400px",
                              }}
                            />
                          </a>
                          <div className="flex flex-col gap-2 mt-4 justify-center items-center">
                            {userId === event.createdBy.id ? (
                              // If the Delete Event button is present
                              <>
                                {/* Top Row: I'm Interested and Delete Event */}
                                <div className="flex gap-2">
                                  <Button
                                    className="hover:scale-105 transition-transform duration-200 ease-in-out bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black text-black"
                                    onClick={() => handleInterest(event.id)}
                                  >
                                    I'm Interested
                                  </Button>
                                  <Button
                                    className="hover:scale-105 transition-transform duration-200 ease-in-out delete-button bg-red-500 text-white"
                                    onClick={() => {
                                      setSelectedEventId(event.id);
                                      setModalOpen(true);
                                    }}
                                  >
                                    Delete Event
                                  </Button>
                                </div>
                                {/* Bottom Row: View Details */}
                                <Button
                                  className="hover:scale-105 transition-transform duration-200 ease-in-out bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black text-black w-full"
                                  style={{ width: "220px" }} // Matches the combined width of top-row buttons
                                  as={Link}
                                  href={`/Event/${event.id}`}
                                  passHref
                                >
                                  View Details
                                </Button>
                              </>
                            ) : (
                              // If Delete Event button not present
                              <div className="flex gap-2">
                                {/* Side by Side: I'm Interested and View Details */}
                                <Button
                                  className="hover:scale-105 transition-transform duration-200 ease-in-out bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black text-black"
                                  onClick={() => handleInterest(event.id)}
                                >
                                  I'm Interested
                                </Button>
                                <Button
                                  className="hover:scale-105 transition-transform duration-200 ease-in-out bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black text-black"
                                  as={Link}
                                  href={`/Event/${event.id}`}
                                  passHref
                                >
                                  View Details
                                </Button>
                              </div>
                            )}
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
                        <div className="flex flex-col gap-2 mt-4 justify-center items-center">
                          {userId === event.createdBy.id ? (
                            // If the Delete Event button is present
                            <>
                              {/* Top Row: I'm Interested and Delete Event */}
                              <div className="flex gap-2">
                                <Button
                                  className="hover:scale-105 transition-transform duration-200 ease-in-out bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black text-black"
                                  onClick={() => handleInterest(event.id)}
                                >
                                  I'm Interested
                                </Button>
                                <Button
                                  className="hover:scale-105 transition-transform duration-200 ease-in-out delete-button bg-red-500 text-white"
                                  onClick={() => {
                                    setSelectedEventId(event.id);
                                    setModalOpen(true);
                                  }}
                                >
                                  Delete Event
                                </Button>
                              </div>
                              {/* Bottom Row: View Details */}
                              <Button
                                className="hover:scale-105 transition-transform duration-200 ease-in-out bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black text-black w-full"
                                style={{ width: "220px" }} // Matches the combined width of top-row buttons
                                as={Link}
                                href={`/Event/${event.id}`}
                                passHref
                              >
                                View Details
                              </Button>
                            </>
                          ) : (
                            // If Delete Event button not present
                            <div className="flex gap-2">
                              {/* Side by Side: I'm Interested and View Details */}
                              <Button
                                className="hover:scale-105 transition-transform duration-200 ease-in-out bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black text-black"
                                onClick={() => handleInterest(event.id)}
                              >
                                I'm Interested
                              </Button>
                              <Button
                                className="hover:scale-105 transition-transform duration-200 ease-in-out bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black text-black"
                                as={Link}
                                href={`/Event/${event.id}`}
                                passHref
                              >
                                View Details
                              </Button>
                            </div>
                          )}
                        </div>{" "}
                      </CardBody>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {modalOpen && (
          <div className="modal fixed top-0 left-0 w-full h-full flex items-center justify-center bg-black bg-opacity-50">
            <div className="modal-content bg-white p-6 rounded-lg shadow-lg">
              <p className="text-lg font-semibold mb-4 text-center">
                Are you sure you want to delete this event?
              </p>
              <div className="flex justify-center gap-4 mt-4">
                <Button
                  className="bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black text-black px-4 py-2 rounded-md"
                  onClick={handleDelete}
                >
                  Yes, Delete
                </Button>
                <Button
                  className="bg-gray-500 text-white px-4 py-2 rounded-md"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
      <BottomBar />
    </div>
  );
}
