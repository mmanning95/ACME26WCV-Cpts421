"use client";
import React, { useEffect, useState } from "react";
import EventForm from "./EventForm";
import jwt from "jsonwebtoken";

export default function CreateEventPage() {
  const [isUser, setIsUser] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: string;
    text: string;
  } | null>(null);

  useEffect(() => {
    // Check if the token is present in localStorage
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decodedToken = jwt.decode(token) as {
          userId: string;
          role: string;
          name?: string;
        };
        if (decodedToken) {
          setIsUser(true);
        } else {
          window.location.href = "/Unauthorized";
        }
      } catch (error) {
        console.error("Invalid token", error);
        setStatusMessage({
          type: "error",
          text: "Invalid token. Please log in again.",
        });
        setTimeout(() => {
          window.location.href = "/Unauthorized";
        }, 3000);
      }
    } else {
      window.location.href = "/Unauthorized";
    }

    // Retrieve status message from localStorage
    const storedMessage = localStorage.getItem("statusMessage");
    if (storedMessage) {
      setStatusMessage(JSON.parse(storedMessage));
      localStorage.removeItem("statusMessage"); // Clear message after displaying it
    }
  }, []);

    useEffect(() => {
      console.log("Google Places Loaded?", !!window.google);
    }, []);

  return (
    <div
      className="flex items-center justify-center"
      style={{ height: "calc(100vh - 64px)" }}
    >
      {statusMessage && (
        <div
          className={`fixed top-16 left-1/2 transform -translate-x-1/2 px-6 py-4 rounded shadow-lg ${
            statusMessage.type === "success" ? "bg-green-500" : "bg-red-500"
          } text-white z-50`}
          style={{ maxWidth: "90vw", textAlign: "center" }}
        >
          {statusMessage.text}
        </div>
      )}
      {isUser && <EventForm />}
    </div>
  );
}
