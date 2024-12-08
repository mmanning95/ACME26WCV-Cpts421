"use client";
import { Button, Card, CardBody, CardHeader } from "@nextui-org/react";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import jwt from "jsonwebtoken";
import EventCalendar from "../Components/Calendar/EventCalendar";

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
  interested: number;
};

export default function Adminpage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminName, setAdminName] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token) {
      try {
        const decodedToken = jwt.decode(token) as {
          userId: string;
          role: string;
          name?: string;
        };
        if (decodedToken && decodedToken.role === "ADMIN") {
          setIsAdmin(true);
          setAdminName(decodedToken.name || "Admin");
          fetchEvents();
        } else {
          setMessage("Unauthorized access.");
          setTimeout(() => {
            window.location.href = "./";
          }, 3000);
        }
      } catch (error) {
        console.error("Invalid token", error);
        setMessage("Invalid token. Please log in again.");
        setTimeout(() => {
          window.location.href = "./";
        }, 3000);
      }
    } else {
      setMessage("You need to log in to access the admin page.");
      setTimeout(() => {
        window.location.href = "./";
      }, 3000);
    }

    async function fetchEvents() {
      try {
        const response = await fetch("/api/Event/approved");
        if (response.ok) {
          const data = await response.json();
          setEvents(data.events);
          setFilteredEvents(data.events);
        } else {
          setMessage("Failed to fetch events.");
        }
      } catch (error) {
        console.error("Error fetching events:", error);
        setMessage("An error occurred while fetching events.");
      }
    }
  }, []);

  const handleDateClick = (date: string) => {
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
    setFilteredEvents(events);
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

  if (!isAdmin) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex">
      <div className="calendar-sidebar w-1/4 p-4">
        <EventCalendar events={events} onDateClick={handleDateClick} />
      </div>

      <div className="content w-3/4 p-4">
        <div className="text-center mb-10">
          <h3 className="text-3xl font-bold">Welcome, {adminName || "Admin"}!</h3>
          <p className="text-lg mt-4">
            Manage the events, edit them, or take other administrative actions.
          </p>
          {message && (
            <div className="text-center mt-4 p-2 bg-blue-100 text-blue-800 border border-blue-300 rounded">
              {message}
            </div>
          )}
        </div>

        <div className="text-center mb-10 flex justify-center gap-4">
          <Button
            as={Link}
            href="/Admin/creatorcode"
            className="bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black text-black"
          >
            Creator Code
          </Button>
          <Button
            as={Link}
            href="/Admin/editevent"
            className="bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black text-black"
          >
            Edit Event
          </Button>
          <Button
            onClick={resetFilter}
            className="bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black text-black"
          >
            Show All Events
          </Button>
        </div>

        <div className="mt-10">
          <h4 className="text-2xl mb-4 text-center">Events:</h4>
          {filteredEvents.length === 0 ? (
            <p className="text-center">No events available.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredEvents.map((event) => (
                <Card key={event.id} className="mb-4">
                  <CardHeader>
                    <h5 className="text-xl font-bold">{event.title}</h5>
                  </CardHeader>
                  <CardBody>
                    {event.description && (
                      <p className="text-gray-600">{event.description}</p>
                    )}
                    <p className="text-gray-600">
                      Created By: {event.createdBy.name} ({event.createdBy.email})
                    </p>
                    {event.startDate && (
                      <p className="text-gray-600">
                        Start Date:{" "}
                        {new Date(event.startDate).toLocaleDateString()}
                      </p>
                    )}
                    {event.endDate && (
                      <p className="text-gray-600">
                        End Date:{" "}
                        {new Date(event.endDate).toLocaleDateString()}
                      </p>
                    )}
                    <p className="text-gray-600">Interested: {event.interested}</p>
                    <Button
                      className="bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black text-black mt-4"
                      onClick={() => handleInterest(event.id)}
                    >
                      I'm Interested
                    </Button>
                    <div className="flex gap-2 mt-4">
                      <Button
                        className="delete-button bg-red-500 text-white"
                        onClick={() => {
                          setSelectedEventId(event.id);
                          setModalOpen(true);
                        }}
                      >
                        Delete Event
                      </Button>
                      <Link href={`/Event/${event.id}`} passHref>
                        <Button className="bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black text-black">
                          View Details
                        </Button>
                      </Link>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>

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
                  className="bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black text-black px-4 py-2 rounded-md"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
