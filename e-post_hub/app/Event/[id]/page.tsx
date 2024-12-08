"use client";

import React, { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, Button, Textarea } from "@nextui-org/react";
import Link from "next/link";

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
};

type Comment = {
  id: string;
  content: string;
  createdAt: string;
  createdBy: {
    name: string;
    email: string;
  };
  parentId?: string | null; // To differentiate parent and child comments
  replies: Comment[]; // Nested replies
};

export default function EventDetailsPage() {
  const [eventId, setEventId] = useState<string | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState<string>("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null); // For replies
  const [replyContent, setReplyContent] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  useEffect(() => {
    // Extract event ID from the URL path
    const pathSegments = window.location.pathname.split("/");
    const extractedId = pathSegments[pathSegments.length - 1]; // Get the last part of the path
    setEventId(extractedId);
    console.log("Extracted Event ID:", extractedId);
  }, []);

  useEffect(() => {
    if (!eventId) return;

    // Check if the user is logged in
    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token);

    // Fetch event details
    const fetchEventDetails = async () => {
      try {
        const response = await fetch(`/api/Event/${eventId}`);
        if (response.ok) {
          const data = await response.json();
          setEvent(data.event);
        } else {
          setMessage("Failed to fetch event details.");
        }
      } catch (error) {
        console.error("Error fetching event details:", error);
        setMessage("An error occurred while fetching event details.");
      }
    };

    // Fetch comments and replies
    const fetchComments = async () => {
      try {
        const response = await fetch(`/api/Event/comments/${eventId}`);
        if (response.ok) {
          const data = await response.json();
          setComments(data);
          console.log("Comments fetched:", data);
        } else {
          setMessage("Failed to fetch comments.");
        }
      } catch (error) {
        console.error("Error fetching comments:", error);
        setMessage("An error occurred while fetching comments.");
      }
    };

    fetchEventDetails();
    fetchComments();
  }, [eventId]);

  const handleShareEvent = () => {
    const eventUrl = `${window.location.origin}/Event/${eventId}`;
    if (navigator.share) {
      navigator
        .share({
          title: event?.title || "Event",
          text: `Check out this event: ${event?.title}`,
          url: eventUrl,
        })
        .catch((error) => console.error("Error sharing", error));
    } else {
      navigator.clipboard
        .writeText(eventUrl)
        .then(() => {
          setMessage("Event link copied to clipboard!");
          setTimeout(() => setMessage(null), 3000);
        })
        .catch((error) => {
          console.error("Error copying to clipboard", error);
          setMessage("Failed to copy event link.");
          setTimeout(() => setMessage(null), 3000);
        });
    }
  };

  // Submit a new comment
  const handleCommentSubmit = async () => {
    if (!newComment.trim()) {
      setMessage("Comment cannot be empty.");
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    const token = localStorage.getItem("token");
    const decodedToken = token ? JSON.parse(atob(token.split(".")[1])) : null;
    const userId = decodedToken?.userId;

    if (!userId) {
      setMessage("You must be logged in to comment.");
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    try {
      const payload = {
        content: newComment,
        eventId,
        userId,
      };

      const response = await fetch(`/api/Event/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const addedComment = await response.json();

        // Update comments with the new comment
        setComments((prevComments) => [...prevComments, addedComment]);
        setNewComment("");
        setMessage("Comment added successfully.");
      } else {
        setMessage("Failed to add comment.");
      }
    } catch (error) {
      console.error("Error adding comment:", error);
      setMessage("An error occurred while adding the comment.");
    }

    setTimeout(() => setMessage(null), 3000);
  };

  // Submit a reply
  const handleReplySubmit = async () => {
    if (!replyContent.trim()) {
      setMessage("Reply cannot be empty.");
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    const token = localStorage.getItem("token");
    const decodedToken = token ? JSON.parse(atob(token.split(".")[1])) : null;
    const userId = decodedToken?.userId;

    if (!userId || !replyingTo) {
      setMessage("You must be logged in to reply.");
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    try {
      const payload = {
        content: replyContent,
        eventId,
        userId,
        parentId: replyingTo, // Set the parent comment ID
      };

      const response = await fetch(`/api/Event/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const addedReply = await response.json();

        // Update replies for the specific comment
        setComments((prevComments) =>
          prevComments.map((comment) =>
            comment.id === replyingTo
              ? { ...comment, replies: [...(comment.replies || []), addedReply] }
              : comment
          )
        );
        setReplyingTo(null);
        setReplyContent("");
        setMessage("Reply added successfully.");
      } else {
        setMessage("Failed to add reply.");
      }
    } catch (error) {
      console.error("Error adding reply:", error);
      setMessage("An error occurred while adding the reply.");
    }

    setTimeout(() => setMessage(null), 3000);
  };

  if (!event) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-3/4 mb-10">
        <CardHeader className="flex flex-col items-center justify-center">
          <h1 className="text-3xl font-semibold">{event.title}</h1>
        </CardHeader>
        <CardBody>
          <p className="text-gray-600">
            <strong>Description:</strong> {event.description || "No description provided."}
          </p>
          {event.startDate && (
            <p className="text-gray-600">
              <strong>Start Date:</strong> {new Date(event.startDate).toLocaleDateString()}
            </p>
          )}
          {event.endDate && (
            <p className="text-gray-600">
              <strong>End Date:</strong> {new Date(event.endDate).toLocaleDateString()}
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
          {event.website && (
            <p className="text-gray-600">
              <strong>Website:</strong>{" "}
                <a
                  href={event.website.startsWith("http") ? event.website : `https://${event.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 underline"
                >
          {event.website}
                </a>
  </p>
)}

          {event.flyer && (
            <div>
              <strong>Flyer:</strong>
              <img src={event.flyer} alt="Event Flyer" className="mt-2 w-full max-w-md" />
            </div>
          )}
          <p className="text-gray-600">
            <strong>Created By:</strong> {event.createdBy.name} ({event.createdBy.email})
          </p>
          <div className="mt-4 flex justify-center gap-4">
            <Button onClick={handleShareEvent} className="bg-gradient-to-r from-orange-500 to-red-500">
              Share Event
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Comment Section */}
      <Card className="w-3/4">
        <CardHeader>
          <h2 className="text-2xl font-semibold">Comments</h2>
        </CardHeader>
        <CardBody>
          {comments
            .filter((comment) => !comment.parentId) // Only show parent comments
            .map((comment) => (
              <div key={comment.id} className="mb-4 border-b pb-4">
                <p className="text-gray-800">{comment.content}</p>
                <p className="text-gray-500 text-sm">
                  - {comment.createdBy.name} ({new Date(comment.createdAt).toLocaleString()})
                </p>
                {/* Replies */}
                {comment.replies?.length > 0 && (
                  <div className="ml-4 border-l pl-4">
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="mt-2">
                        <p className="text-gray-700">{reply.content}</p>
                        <p className="text-gray-500 text-xs">
                          - {reply.createdBy.name} ({new Date(reply.createdAt).toLocaleString()})
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {/* Reply Form */}
                {isLoggedIn && replyingTo === comment.id && (
                  <div className="mt-2">
                    <Textarea
                      placeholder="Write your reply..."
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                    />
                    <Button onClick={handleReplySubmit}>Submit Reply</Button>
                  </div>
                )}
                {isLoggedIn && replyingTo !== comment.id && (
                  <Button onClick={() => setReplyingTo(comment.id)}>Reply</Button>
                )}
              </div>
            ))}

          {/* New Comment Form */}
          {isLoggedIn ? (
            <div className="mt-6">
              <Textarea
                placeholder="Write your comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
              <Button onClick={handleCommentSubmit}>Add Comment</Button>
            </div>
          ) : (
            <div className="text-center mt-6">
              <p>You need to log in to comment.</p>
              <Link href="/Login" className="text-blue-500 underline">
                Log in
              </Link>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
