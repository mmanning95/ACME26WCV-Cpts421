"use client";

import React, { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
} from "@nextui-org/react";
import jwt from "jsonwebtoken";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

// Dynamically import your PdfViewer if needed
const PdfViewer = dynamic(() => import("@/app/Components/PdfViewer/PdfViewer"), {
  ssr: false,
});

// Helper to detect PDFs
function isPdfUrl(url?: string | null) {
  if (!url) return false;
  return url.toLowerCase().endsWith(".pdf");
}

type EventOccurrence = {
  id: string;
  date: string;        // e.g. "2025-08-10T00:00:00.000Z"
  startTime?: string;
  endTime?: string;
};

type Event = {
  id: string;
  title: string;
  description?: string;
  createdBy?: {
    name: string;
    email: string;
  };
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  website?: string;
  flyer?: string; // PDF or image
  type?: string;
  address?: string;
  occurrences?: EventOccurrence[]; // <--- including occurrences here
};

type Question = {
  id: string;
  text: string;
  username: string;
  userEmail: string;
  isPrivate: boolean;
  datePosted: string;
};

export default function EventManagement() {
  const router = useRouter();

  // States
  const [events, setEvents] = useState<Event[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // Approve / Deny checkboxes
  const [selectedActions, setSelectedActions] = useState<{
    [key: string]: "approve" | "deny" | null;
  }>({});
  // Rejection messages
  const [denyMessages, setDenyMessages] = useState<{ [key: string]: string }>(
    {}
  );
  // Global status
  const [globalStatusMessage, setGlobalStatusMessage] = useState<string | null>(
    null
  );

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      const decodedToken = jwt.decode(token) as { role?: string };
      if (!decodedToken || decodedToken.role !== "ADMIN") {
        setTimeout(() => router.replace("/Unauthorized"), 0);
      } else {
        setIsAdmin(true);
      }
    } else {
      setTimeout(() => router.replace("/Unauthorized"), 0);
    }
  }, [router]);

  useEffect(() => {
    async function fetchPendingEventsAndQuestions() {
      try {
        // We expect that /api/Event/pending includes event.occurrences
        const [eventsResponse, questionsResponse] = await Promise.all([
          fetch("/api/Event/pending"),
          fetch("/api/community/question/private"),
        ]);

        if (eventsResponse.ok) {
          const eventsData = await eventsResponse.json();
          setEvents(eventsData.events);

          // Initialize checkboxes (Approve/Deny)
          const initial: { [key: string]: "approve" | "deny" | null } = {};
          eventsData.events.forEach((ev: Event) => {
            initial[ev.id] = null;
          });
          setSelectedActions(initial);
        } else {
          setGlobalStatusMessage("Failed to fetch pending events.");
        }

        if (questionsResponse.ok) {
          const questionsData = await questionsResponse.json();
          setQuestions(questionsData.questions);
        } else {
          setGlobalStatusMessage("Failed to fetch private questions.");
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        setGlobalStatusMessage("An error occurred while fetching data.");
      }
    }

    if (isAdmin) {
      fetchPendingEventsAndQuestions();
    }
  }, [isAdmin]);

  // ============ Approve/Deny =============
  const handleCheckboxChange = (eventId: string, action: "approve" | "deny") => {
    setSelectedActions((prev) => ({
      ...prev,
      [eventId]: prev[eventId] === action ? null : action,
    }));

    // If user checks "deny," ensure we track a text reason
    if (action === "deny") {
      setDenyMessages((prev) => ({
        ...prev,
        [eventId]: prev[eventId] || "",
      }));
    } else {
      // If we uncheck "deny," remove any stored message
      setDenyMessages((prev) => {
        const next = { ...prev };
        delete next[eventId];
        return next;
      });
    }
  };

  const handleSubmitActions = async () => {
    let allSuccess = true;
    for (const [eventId, action] of Object.entries(selectedActions)) {
      if (action === "approve") {
        const success = await handleApproveEvent(eventId);
        if (!success) allSuccess = false;
      } else if (action === "deny") {
        const success = await handleDenyEvent(eventId);
        if (!success) allSuccess = false;
      }
      // if null => do nothing
    }

    setGlobalStatusMessage(
      allSuccess
        ? "All event actions completed successfully."
        : "Some actions failed."
    );
  };

  const handleApproveEvent = async (eventId: string) => {
    try {
      const response = await fetch(`/api/Event/approve/${eventId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        // remove from local list
        setEvents((prev) => prev.filter((ev) => ev.id !== eventId));
        return true;
      } else {
        const errorData = await response.json();
        console.error("Error approving event:", errorData);
        return false;
      }
    } catch (error) {
      console.error("Error approving event:", error);
      return false;
    }
  };

  const handleDenyEvent = async (eventId: string) => {
    const msg = denyMessages[eventId]?.trim();
    if (!msg) {
      setGlobalStatusMessage("Rejection message is required.");
      return false;
    }

    try {
      const response = await fetch(`/api/Event/deny/${eventId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ denyMessage: msg }),
      });

      if (response.ok) {
        setEvents((prev) => prev.filter((ev) => ev.id !== eventId));
        return true;
      } else {
        const errorData = await response.json();
        console.error("Error denying event:", errorData);
        return false;
      }
    } catch (error) {
      console.error("Error denying event:", error);
      return false;
    }
  };

  // ============ Private Questions ============
  const handleResolveQuestion = async (questionId: string) => {
    try {
      const response = await fetch(`/api/community/question/${questionId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        setQuestions((prev) => prev.filter((q) => q.id !== questionId));
        setGlobalStatusMessage("Question resolved successfully.");
      } else {
        const errData = await response.json();
        console.error("Error resolving question:", errData);
        setGlobalStatusMessage("Failed to resolve question.");
      }
    } catch (error) {
      console.error("Error resolving question:", error);
      setGlobalStatusMessage("An error occurred while resolving the question.");
    }
  };

  // if (!isAdmin) { return <div>Loading...</div>; }

  return (
    <div className="w-full min-h-screen bg-gray-50 py-8 px-4 flex flex-col gap-8">
      {/* Global status message if any */}
      {globalStatusMessage && (
        <div className="mx-auto max-w-3xl mb-4 p-2 bg-blue-100 text-blue-800 border border-blue-300 rounded">
          {globalStatusMessage}
        </div>
      )}

      {/* Pending Events Section */}
      <div className="mx-auto w-full max-w-3xl">
        <h2 className="text-3xl font-bold mb-4 text-center">Pending Events</h2>
        {events.length === 0 ? (
          <Card className="mb-4">
            <CardBody>
              <p className="text-center">No pending events at the moment.</p>
            </CardBody>
          </Card>
        ) : (
          <>
            {events.map((event) => (
              <Card
                key={event.id}
                className="w-full max-w-3xl mb-6 bg-white border border-gray-300 shadow-sm"
              >
                <CardHeader className="flex flex-col items-center justify-center">
                  <h3 className="text-xl font-semibold">{event.title}</h3>
                </CardHeader>
                <CardBody>
                  {/* Flyer (PDF or Image) */}
                  {event.flyer && (
                    <div className="mb-4">
                      {isPdfUrl(event.flyer) ? (
                        <a
                          href={event.flyer}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: "block", position: "relative" }}
                        >
                          <PdfViewer fileUrl={event.flyer} containerHeight={400} />
                        </a>
                      ) : (
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
                    </div>
                  )}

                  {/* Basic Info */}
                  {event.type && (
                    <p className="text-gray-600 mb-1">
                      <strong>Type:</strong> {event.type}
                    </p>
                  )}
                  {event.description && (
                    <p className="text-gray-600 mb-2">{event.description}</p>
                  )}
                  {event.createdBy ? (
                    <p className="text-gray-600 mb-1">
                      <strong>Created By:</strong> {event.createdBy.name} (
                      {event.createdBy.email})
                    </p>
                  ) : (
                    <p className="text-gray-600 italic mb-1">
                      <strong>Created By:</strong> Guest User
                    </p>
                  )}

                  {/* Single date/time fields (if used) */}
                  {event.startDate && (
                    <p className="text-gray-600 mb-1">
                      <strong>Start Date:</strong>{" "}
                      {new Date(event.startDate).toLocaleDateString()}
                    </p>
                  )}
                  {event.endDate && (
                    <p className="text-gray-600 mb-1">
                      <strong>End Date:</strong>{" "}
                      {new Date(event.endDate).toLocaleDateString()}
                    </p>
                  )}
                  {event.startTime && (
                    <p className="text-gray-600 mb-1">
                      <strong>Start Time:</strong> {event.startTime}
                    </p>
                  )}
                  {event.endTime && (
                    <p className="text-gray-600 mb-1">
                      <strong>End Time:</strong> {event.endTime}
                    </p>
                  )}

                  {/* Address / Website */}
                  {event.address && (
                    <p className="text-gray-600 mb-1">
                      <strong>Address:</strong> {event.address}
                    </p>
                  )}
                  {event.website && (
                    <p className="text-gray-600 mb-1">
                      <strong>Website:</strong>{" "}
                      <a
                        href={
                          event.website.startsWith("http")
                            ? event.website
                            : `https://${event.website}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-blue-500"
                      >
                        {event.website}
                      </a>
                    </p>
                  )}

                  {/* Occurrences if present */}
                  {event.occurrences && event.occurrences.length > 0 && (
                    <div className="mt-3 mb-2">
                      <h4 className="font-semibold">Dates:</h4>
                      {event.occurrences.map((occ) => {
                        const dateObj = new Date(occ.date);
                        const dateStr = dateObj.toLocaleDateString();
                        return (
                          <p key={occ.id} className="text-gray-600 ml-4">
                            - {dateStr}
                            {occ.startTime && `, Start: ${occ.startTime}`}
                            {occ.endTime && `, End: ${occ.endTime}`}
                          </p>
                        );
                      })}
                    </div>
                  )}

                  {/* Approve / Deny */}
                  <div className="flex justify-between mt-4 mb-2">
                    <Checkbox
                      isSelected={selectedActions[event.id] === "approve"}
                      onChange={() =>
                        handleCheckboxChange(event.id, "approve")
                      }
                      color="primary"
                    >
                      Approve
                    </Checkbox>
                    <Checkbox
                      isSelected={selectedActions[event.id] === "deny"}
                      onChange={() => handleCheckboxChange(event.id, "deny")}
                      color="danger"
                    >
                      Deny
                    </Checkbox>
                  </div>

                  {/* Deny Reason */}
                  {selectedActions[event.id] === "deny" && (
                    <textarea
                      value={denyMessages[event.id] || ""}
                      onChange={(e) =>
                        setDenyMessages((prev) => ({
                          ...prev,
                          [event.id]: e.target.value,
                        }))
                      }
                      placeholder="Please enter a reason for rejection..."
                      className="w-full p-2 border border-gray-300 rounded mt-2"
                    />
                  )}
                </CardBody>
              </Card>
            ))}

            {/* Submit Actions Button if we have events */}
            <div className="flex justify-center mt-4">
              <Button
                onClick={handleSubmitActions}
                className="bg-gradient-to-r from-[#f7960d] to-[#f95d09] text-white border-black"
              >
                Submit Actions
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Private Questions */}
      <div className="mx-auto w-full max-w-3xl">
        <h2 className="text-3xl font-bold mb-4 text-center">
          Private Questions
        </h2>
        {questions.length === 0 ? (
          <Card className="mb-4">
            <CardBody>
              <p className="text-center">No private questions at the moment.</p>
            </CardBody>
          </Card>
        ) : (
          questions.map((question) => (
            <Card
              key={question.id}
              className="w-full max-w-3xl mb-6 bg-white border border-gray-300 shadow-sm"
            >
              <CardHeader className="flex flex-col items-center justify-center">
                <h3 className="text-xl font-semibold">
                  Question from {question.username}
                </h3>
              </CardHeader>
              <CardBody>
                <p className="text-gray-600 mb-1">{question.text}</p>
                <p className="text-gray-600 mb-1">
                  <strong>Contact:</strong> {question.userEmail}
                </p>
                <p className="text-gray-600 mb-1">
                  <strong>Posted on:</strong>{" "}
                  {new Date(question.datePosted).toLocaleDateString()}
                </p>
                <div className="flex justify-end mt-4">
                  <Button
                    onClick={() => handleResolveQuestion(question.id)}
                    color="success"
                    className="bg-blue-500 text-white"
                  >
                    Resolve
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
