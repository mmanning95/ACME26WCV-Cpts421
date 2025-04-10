"use client";

import React, { useEffect, useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Textarea,
} from "@nextui-org/react";
import Link from "next/link";
import dynamic from "next/dynamic";

type EventOccurrence = {
  id: string;
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
  interested: string;
  status: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  website?: string;
  flyer?: string;
  type?: string
  address?: string;
  occurrences?: EventOccurrence[];
};

type Comment = {
  id: string;
  content: string;
  createdAt: string;
  createdBy: {
    name: string;
    email: string;
  };
  parentId?: string | null;
  replies: Comment[];
};

const PdfViewer = dynamic(() => import("../../Components/PdfViewer/PdfViewer"), {
  ssr: false,
});

function isPdfUrl(url?: string) {
  if (!url) return false;
  return url.toLowerCase().endsWith(".pdf");
}

export default function EventDetailsPage() {
  const [eventId, setEventId] = useState<string | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState<string>("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null); // For replies
  const [replyContent, setReplyContent] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null); // Track the comment being confirmed
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null); // Track the comment being edited
  const [editContent, setEditContent] = useState<string>(""); // Track the updated content of the comment

  useEffect(() => {
    // Extract event ID from the URL path
    const pathSegments = window.location.pathname.split("/");
    const extractedId = pathSegments[pathSegments.length - 1]; // Get the last part of the path
    setEventId(extractedId);
    console.log("Extracted Event ID:", extractedId);

    const token = localStorage.getItem("token");
    if (token) {
      setIsLoggedIn(true);
      const decodedToken = JSON.parse(atob(token.split(".")[1]));
      setUserId(decodedToken.email);
      setUserRole(decodedToken.role);
    }
  }, []);

  useEffect(() => {
    if (!eventId) return;

    // // Check if the user is logged in
    // const token = localStorage.getItem("token");
    // setIsLoggedIn(!!token);

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
          console.log("Comments fetched from API:", data);
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

  const canEditEvent = () => {
    if (!event) return false;
    if (userRole === "ADMIN") return true;
    return event.createdBy?.email === userId;
  };

  const handleEditComment = async (commentId: string) => {
    // Ensure the content is not empty
    if (!editContent.trim()) {
      setMessage("Comment cannot be empty.");
      setTimeout(() => setMessage(null), 3000); // Clear the message after 3 seconds
      return;
    }

    const token = localStorage.getItem("token"); // Retrieve the user's token from localStorage
    if (!token) {
      setMessage("You must be logged in to edit a comment.");
      return;
    }

    try {
      // Send a PATCH request to the backend API to update the comment
      const response = await fetch(`/api/Event/comments/${commentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // Include the token for authentication
        },
        body: JSON.stringify({ content: editContent }), // Send the updated content
      });

      if (response.ok) {
        const updatedComment = await response.json(); // Get the updated comment from the response

        // Update the state to reflect the new comment content
        setComments((prevComments) =>
          prevComments.map((comment) =>
            comment.id === updatedComment.id
              ? { ...comment, content: updatedComment.content } // Update the edited comment
              : {
                  ...comment,
                  replies: comment.replies.map((reply) =>
                    reply.id === updatedComment.id
                      ? { ...reply, content: updatedComment.content } // Update the edited reply
                      : reply
                  ),
                }
          )
        );
        setEditingCommentId(null); // Exit edit mode
        setEditContent(""); // Clear the content state
        setMessage("Comment updated successfully."); // Show a success message
      } else {
        setMessage("Failed to update comment."); // Show an error message if the request fails
      }
    } catch (error) {
      console.error("Error editing comment:", error); // Log any errors
      setMessage("An error occurred while editing the comment.");
    }

    setTimeout(() => setMessage(null), 3000); // Clear the message after 3 seconds
  };

  // Utility Function to Check Edit Authorization
  const isAuthorizedToEdit = (commentUserEmail: string) => {
    // Both admins and members can only edit their own comments
    return userId === commentUserEmail;
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

  // Delete a Comment
  const handleDeleteComment = async (commentId: string) => {
    const token = localStorage.getItem("token");
    if (!token) {
      setMessage("You must be logged in to delete a comment.");
      return;
    }

    try {
      const response = await fetch(`/api/Event/comments/${commentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        // Update the comments state by filtering out the deleted comment or reply
        setComments((prevComments) =>
          prevComments
            .filter((comment) => comment.id !== commentId) // Filter parent comments
            .map((comment) => ({
              ...comment,
              replies: comment.replies.filter(
                (reply) => reply.id !== commentId
              ), // Filter replies
            }))
        );
        setMessage("Comment deleted successfully.");
      } else {
        setMessage("Failed to delete comment.");
      }
    } catch (error) {
      console.error("Error deleting comment:", error);
      setMessage("An error occurred while deleting the comment.");
    }

    setConfirmDelete(null); // Reset the confirmation state
    setTimeout(() => setMessage(null), 3000); // Clear the message after a delay
  };

  // Utility Functions
  const isAuthorizedToDelete = (commentUserEmail: string) => {
    console.log("Current userId:", userId);
    console.log("Current userRole:", userRole);
    console.log("Comment userId:", commentUserEmail);
    console.log("___________");
    return userRole === "ADMIN" || userId === commentUserEmail;
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
              ? {
                  ...comment,
                  replies: [...(comment.replies || []), addedReply],
                }
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
 {/* Event Details */}
 <Card className="w-full max-w-2xl mx-auto mb-6">
  <CardHeader className="flex flex-col items-center justify-center">
    <h1 className="text-3xl font-semibold mb-4">{event.title}</h1>

    {/* Flyer Logic */}
    {event.flyer ? (
      isPdfUrl(event.flyer) ? (
        <a
          href={event.flyer}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "block", position: "relative" }}
          className="mb-4"
        >
          <PdfViewer fileUrl={event.flyer} containerHeight={400} />
        </a>
      ) : (
        <a
          href={event.flyer}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-4"
        >
          <img
            src={event.flyer}
            alt={`${event.title} Flyer`}
            className="w-full h-full object-cover rounded-md"
            style={{ maxHeight: "400px" }}
          />
        </a>
      )
    ) : (
      <div className="w-full h-40 flex items-center justify-center bg-gray-200 rounded-md mb-4">
        <span className="text-gray-500">No Image Available</span>
      </div>
    )}

    {/* Basic fields */}
    {event.type && (
      <p className="text-gray-700 mb-1">
        <strong>Type:</strong> {event.type}
      </p>
    )}
    {event.description && (
      <p className="text-gray-700 mb-4">{event.description}</p>
    )}

    {/* Single-day fields if present */}
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

    {/* Occurrences displayed in a bullet list */}
    {event.occurrences && event.occurrences.length > 0 && (
      <div className="mt-3 mb-2">
        <h4 className="font-semibold text-lg mb-2">Dates:</h4>
        <ul className="list-disc list-inside text-gray-600">
          {event.occurrences.map((occ) => {
            const d = new Date(occ.date);
            const dateStr = d.toLocaleDateString();
            const timeString =
              occ.startTime || occ.endTime
                ? ` (${occ.startTime || "???"} - ${occ.endTime || "???"})`
                : "";
            return (
              <li key={occ.id}>
                {dateStr}
                {timeString}
              </li>
            );
          })}
        </ul>
      </div>
    )}

    {/* Address, Website, Interested, etc. */}
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

    {/* Example Edit button, if user can edit */}
    {isLoggedIn && canEditEvent() && (
      <div className="mt-4 flex gap-2">
        <Button
          as={Link}
          href={`/Event/edit/${eventId}`}
          passHref
          className="hover:scale-105 transition-transform duration-200 ease-in-out bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black"
        >
          Edit Event
        </Button>
      </div>
    )}
  </CardHeader>
  <CardBody>{/* Additional details if needed */}</CardBody>
</Card>

      {/* Comment Section */}
      <Card className="w-full max-w-2xl mx-auto mb-6">
        <CardHeader>
          <h2 className="text-2xl font-semibold">Comments</h2>
        </CardHeader>
        <CardBody>
          {comments
            .filter((comment) => !comment.parentId) // Only show parent comments
            .map((comment) => (
              <div
                key={comment.id}
                className="mb-4 border border-gray-300 rounded-lg p-4 bg-white shadow-sm"
              >
                {/* Comment Details */}
                <div className="flex justify-between items-center">
                  <div>
                    {/* Display comment content */}
                    {editingCommentId === comment.id ? (
                      <Textarea
                        placeholder="Edit your comment..."
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)} // Update editContent state
                      />
                    ) : (
                      <p className="text-gray-800">{comment.content}</p>
                    )}
                    <p className="text-gray-500 text-sm">
                      - {comment.createdBy.name} (
                      {new Date(comment.createdAt).toLocaleString()})
                    </p>
                  </div>

                  {/* Edit and Delete Buttons for Comments */}
                  {isAuthorizedToEdit(comment.createdBy.email) && (
                    <div className="flex flex-col gap-2">
                      {editingCommentId === comment.id ? (
                        <div className="flex gap-2">
                          <Button
                            className="hover:scale-105 transition-transform duration-200 ease-in-out bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black"
                            onClick={() => handleEditComment(comment.id)} // Save the edited comment
                          >
                            Save
                          </Button>
                          <Button
                            className="hover:scale-105 transition-transform duration-200 ease-in-out text-gray-500 text-sm"
                            onClick={() => setEditingCommentId(null)} // Cancel edit mode
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          className="hover:scale-105 transition-transform duration-200 ease-in-out bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black"
                          onClick={() => {
                            setEditingCommentId(comment.id); // Enter edit mode
                            setEditContent(comment.content); // Populate the textarea with existing content
                          }}
                        >
                          Edit
                        </Button>
                      )}
                      {confirmDelete === comment.id ? (
                        <div className="flex gap-2">
                          <Button
                            className="hover:scale-105 transition-transform duration-200 ease-in-out bg-gradient-to-r from-[#f7110d] to-[#f95d09] border border-black"
                            onClick={() => handleDeleteComment(comment.id)} // Delete comment
                          >
                            Confirm Delete
                          </Button>
                          <Button
                            className="hover:scale-105 transition-transform duration-200 ease-in-out text-gray-500 text-sm"
                            onClick={() => setConfirmDelete(null)} // Cancel delete confirmation
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          className="hover:scale-105 transition-transform duration-200 ease-in-out bg-[#f7110d] border border-black"
                          onClick={() => setConfirmDelete(comment.id)} // Trigger delete confirmation
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Replies */}
                {comment.replies?.length > 0 && (
                  <div className="ml-4 mt-4">
                    {comment.replies.map((reply) => (
                      <div
                        key={reply.id}
                        className="mb-2 border border-gray-200 rounded-lg p-3 bg-gray-50"
                      >
                        {/* Reply Details */}
                        <div className="flex justify-between items-center">
                          <div>
                            {editingCommentId === reply.id ? (
                              <Textarea
                                placeholder="Edit your reply..."
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)} // Update editContent state
                              />
                            ) : (
                              <p className="text-gray-700">{reply.content}</p>
                            )}
                            <p className="text-gray-500 text-xs">
                              - {reply.createdBy.name} (
                              {new Date(reply.createdAt).toLocaleString()})
                            </p>
                          </div>

                          {/* Edit and Delete Buttons for Replies */}
                          {isAuthorizedToEdit(reply.createdBy.email) && (
                            <div className="flex flex-col gap-2">
                              {editingCommentId === reply.id ? (
                                <div className="flex gap-2">
                                  <Button
                                    className="hover:scale-105 transition-transform duration-200 ease-in-out bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black"
                                    onClick={() => handleEditComment(reply.id)} // Save the edited reply
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    className="hover:scale-105 transition-transform duration-200 ease-in-out text-gray-500 text-xs"
                                    onClick={() => setEditingCommentId(null)} // Cancel edit mode
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  className="hover:scale-105 transition-transform duration-200 ease-in-out bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black"
                                  onClick={() => {
                                    setEditingCommentId(reply.id); // Enter edit mode for reply
                                    setEditContent(reply.content); // Populate textarea with reply content
                                  }}
                                >
                                  Edit
                                </Button>
                              )}
                              {confirmDelete === reply.id ? (
                                <div className="flex gap-2">
                                  <Button
                                    className="hover:scale-105 transition-transform duration-200 ease-in-out bg-gradient-to-r from-[#f7110d] to-[#f95d09] border border-black"
                                    onClick={() =>
                                      handleDeleteComment(reply.id)
                                    } // Delete reply
                                  >
                                    Confirm Delete
                                  </Button>
                                  <Button
                                    className="hover:scale-105 transition-transform duration-200 ease-in-out text-gray-500 text-xs"
                                    onClick={() => setConfirmDelete(null)} // Cancel delete confirmation
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  className="hover:scale-105 transition-transform duration-200 ease-in-out bg-[#f7110d] border border-black"
                                  onClick={() => setConfirmDelete(reply.id)} // Trigger delete confirmation
                                >
                                  Delete
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
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
                    <Button
                      className="hover:scale-105 transition-transform duration-200 ease-in-out bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black"
                      onClick={handleReplySubmit}
                    >
                      Submit Reply
                    </Button>
                  </div>
                )}
                {isLoggedIn && replyingTo !== comment.id && (
                  <Button
                    className="hover:scale-105 transition-transform duration-200 ease-in-out bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black"
                    onClick={() => setReplyingTo(comment.id)}
                  >
                    Reply
                  </Button>
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
              <Button
                className="hover:scale-105 transition-transform duration-200 ease-in-out bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black"
                onClick={handleCommentSubmit}
              >
                Add Comment
              </Button>
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
