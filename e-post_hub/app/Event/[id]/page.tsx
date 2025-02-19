"use client";

import React, { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, Button, Textarea, Input } from "@nextui-org/react";
import Link from "next/link";
import { usePlacesWidget } from "react-google-autocomplete";
import { useForm } from "react-hook-form";

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
  // Removed startTime/endTime from display
  // startTime?: string;
  // endTime?: string;
  website?: string;
  flyer?: string;
  type?: string;    // <--- We now display/edit this
  address?: string; // <--- We now display/edit this
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
  replies: Comment[]; // Nested replies
};

export default function EventDetailsPage() {
  const [eventId, setEventId] = useState<string | null>(null);
  const [event, setEvent] = useState<Event | null>(null);

  // Commenting
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState<string>("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState<string>("");

  // Status / auth
  const [message, setMessage] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Deletion / editing for comments
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>("");

  // [Inline Event Editing] Toggle
  const [editingEvent, setEditingEvent] = useState(false);

  // Fields we can edit
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editType, setEditType] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");

    // Address State
    const [address, setAddress] = useState("");
    const { setValue } = useForm();
  
    const { ref } = usePlacesWidget<HTMLInputElement>({
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
      onPlaceSelected: (place) => {
        if (place.formatted_address) {
          setAddress(place.formatted_address);
          setValue("address", place.formatted_address);
        }
      },
      options: {
        types: ["geocode"],
        componentRestrictions: { country: "us" },
      },
    });

    useEffect(() => {
      console.log("Input Ref:", ref);
    }, [ref]);
    

  // 1) Get ID from URL, decode token
  useEffect(() => {
    const segments = window.location.pathname.split("/");
    const extractedId = segments[segments.length - 1];
    setEventId(extractedId);

    const token = localStorage.getItem("token");
    if (token) {
      setIsLoggedIn(true);
      const decodedToken = JSON.parse(atob(token.split(".")[1]));
      setUserId(decodedToken.email);
      setUserRole(decodedToken.role);
    }
  }, []);

  // 2) Fetch event & comments
  useEffect(() => {
    if (!eventId) return;

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

    const fetchComments = async () => {
      try {
        const response = await fetch(`/api/Event/comments/${eventId}`);
        if (response.ok) {
          const data = await response.json();
          setComments(data);
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

  // 3) Check if user can edit
  const canEditEvent = () => {
    if (!event) return false;
    if (userRole === "ADMIN") return true; 
    return event.createdBy.email === userId;
  };

  // [Inline Editing] Start
  const handleEditToggle = () => {
    if (!event) return;
    setEditingEvent(true);

    // Copy the event fields we want
    setEditTitle(event.title || "");
    setEditDescription(event.description || "");
    setEditType(event.type || "");
    setEditAddress(event.address || "");
    setEditWebsite(event.website || "");

    if (event.startDate) {
      const d = new Date(event.startDate);
      d.setDate(d.getDate() -1);
      setEditStartDate(d.toISOString().split("T")[0]);
    } else {
      setEditStartDate("");
    }

    if (event.endDate) {
      const d = new Date(event.endDate);
      d.setDate(d.getDate()-1);
      setEditEndDate(d.toISOString().split("T")[0]);
    } else {
      setEditEndDate("");
    }
  };
  

  // [Inline Editing] Cancel
  const handleCancelEdit = () => {
    setEditingEvent(false);
  };

  // [Inline Editing] Save
  const handleSaveEvent = async () => {
    if (!eventId || !event) return;

    const token = localStorage.getItem("token");
    if (!token) {
      setMessage("You are not logged in.");
      return;
    }

    // Parse user-chosen date, add 1 day, and convert to "YYYY-MM-DD"
    function parseAndAddOneDay(dateStr: string) {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      d.setDate(d.getDate() + 1);
      return d.toISOString().split("T")[0]; 
      }

      // Convert the user’s editStartDate and editEndDate
      const finalStartDate = parseAndAddOneDay(editStartDate);
      const finalEndDate   = parseAndAddOneDay(editEndDate);


    const updatedEvent = {
      title: editTitle,
      description: editDescription,
      type: editType,
      address: editAddress,
      website: editWebsite,
      startDate: finalStartDate,
      endDate: finalEndDate,
    };

    try {
      const response = await fetch(`/api/Event/${eventId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatedEvent),
      });

      if (!response.ok) {
        const err = await response.json();
        setMessage(err.message || "Failed to update event.");
        return;
      }

      // Merge changes into local event
      setEvent((prev) => {
        if (!prev) return null;
        return { ...prev, ...updatedEvent };
      });
      setMessage("Event updated successfully!");
      setEditingEvent(false);

      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Error updating event:", error);
      setMessage("An error occurred while updating the event.");
    }
  };

  // [SHARE]
  const handleShareEvent = () => {
    if (!eventId) return;
    const eventUrl = `${window.location.origin}/Event/${eventId}`;
    if (navigator.share) {
      navigator
        .share({
          title: event?.title || "Event",
          text: `Check out this event: ${event?.title}`,
          url: eventUrl,
        })
        .catch((err) => console.error("Error sharing", err));
    } else {
      navigator.clipboard
        .writeText(eventUrl)
        .then(() => {
          setMessage("Event link copied to clipboard!");
          setTimeout(() => setMessage(null), 3000);
        })
        .catch((err) => {
          console.error("Error copying to clipboard", err);
          setMessage("Failed to copy event link.");
          setTimeout(() => setMessage(null), 3000);
        });
    }
  };

  // COMMENT LOGIC 
  const handleEditComment = async (commentId: string) => {
    if (!editContent.trim()) {
      setMessage("Comment cannot be empty.");
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setMessage("You must be logged in to edit a comment.");
      return;
    }

    try {
      const response = await fetch(`/api/Event/comments/${commentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: editContent }),
      });

      if (!response.ok) {
        setMessage("Failed to update comment.");
      } else {
        const updatedComment = await response.json();
        setComments((prev) =>
          prev.map((comment) =>
            comment.id === updatedComment.id
              ? { ...comment, content: updatedComment.content }
              : {
                  ...comment,
                  replies: comment.replies.map((reply) =>
                    reply.id === updatedComment.id
                      ? { ...reply, content: updatedComment.content }
                      : reply
                  ),
                }
          )
        );
        setEditingCommentId(null);
        setEditContent("");
        setMessage("Comment updated successfully.");
      }
    } catch (error) {
      console.error("Error editing comment:", error);
      setMessage("An error occurred while editing the comment.");
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const isAuthorizedToEdit = (commentUserEmail: string) => {
    return userRole === "ADMIN" || userId === commentUserEmail;
  };

  const handleCommentSubmit = async () => {
    if (!newComment.trim()) {
      setMessage("Comment cannot be empty.");
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      setMessage("You must be logged in to comment.");
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    const decodedToken = JSON.parse(atob(token.split(".")[1]));
    const localUserId = decodedToken?.userId;
    if (!localUserId) {
      setMessage("You must be logged in to comment.");
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    try {
      const payload = {
        content: newComment,
        eventId,
        userId: localUserId,
      };

      const response = await fetch(`/api/Event/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const addedComment = await response.json();
        setComments((prev) => [...prev, addedComment]);
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
        setComments((prev) =>
          prev
            .filter((c) => c.id !== commentId)
            .map((c) => ({
              ...c,
              replies: c.replies.filter((r) => r.id !== commentId),
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

    setConfirmDelete(null);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleReplySubmit = async () => {
    if (!replyContent.trim()) {
      setMessage("Reply cannot be empty.");
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    const token = localStorage.getItem("token");
    if (!token || !replyingTo) {
      setMessage("You must be logged in to reply.");
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    const decodedToken = JSON.parse(atob(token.split(".")[1]));
    const localUserId = decodedToken?.userId;
    if (!localUserId) {
      setMessage("You must be logged in to reply.");
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    try {
      const payload = {
        content: replyContent,
        eventId,
        userId: localUserId,
        parentId: replyingTo,
      };

      const response = await fetch(`/api/Event/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const addedReply = await response.json();
        setComments((prev) =>
          prev.map((c) =>
            c.id === replyingTo
              ? { ...c, replies: [...c.replies, addedReply] }
              : c
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

  console.log(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      {message && (
        <div className="p-2 mb-4 bg-yellow-100 text-yellow-800 rounded">
          {message}
        </div>
      )}

      {/* Event Card */}
      <Card className="w-3/4 mb-10">
        <CardHeader className="flex flex-col items-center justify-center">
          {!editingEvent ? (
            <>
              <h1 className="text-3xl font-semibold">{event.title}</h1>
              {event.flyer && (
                <a href={event.flyer} target="_blank" rel="noopener noreferrer">
                  <img
                    src={event.flyer}
                    alt={`${event.title} Flyer`}
                    className="w-full h-full object-cover rounded-md"
                    style={{ maxHeight: "400px" }}
                  />
                </a>
              )}

              {event.description && (
                <p className="text-gray-700 mb-4">{event.description}</p>
              )}

              {/* Show Type if present */}
              {event.type && (
                <p className="text-gray-600">
                  <strong>Type:</strong> {event.type}
                </p>
              )}
              {/* Show Address if present */}
              {event.address && (
                <p className="text-gray-600">
                  <strong>Address:</strong> {event.address}
                </p>
              )}

              <p className="text-gray-600">
                <strong>Created By:</strong> {event.createdBy.name} (
                {event.createdBy.email})
              </p>

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

              {/* No more startTime/endTime display */}
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
              <Button onClick={handleShareEvent}>Share</Button>

              {/* If user can edit, show button */}
              {isLoggedIn && canEditEvent() && (
                <div className="mt-4 flex gap-2">
                  <Button onClick={handleEditToggle}>Edit Event</Button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Inline Edit Mode */}
              <input
                className="border rounded w-full p-2 text-xl font-semibold mb-2"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />

              {event.flyer && (
                <a href={event.flyer} target="_blank" rel="noopener noreferrer">
                  <img
                    src={event.flyer}
                    alt={`${event.title} Flyer`}
                    className="w-full h-full object-cover rounded-md mb-2"
                    style={{ maxHeight: "400px" }}
                  />
                </a>
              )}

              <Textarea
                placeholder="Description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="mb-2"
              />

              {/* Type */}
              <div className="mb-2">
                <label className="text-sm font-semibold">Type:</label>
                <input
                  type="text"
                  className="border rounded w-full p-2"
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                />
              </div>

              {/* Address */}
              <div className="mb-2">
              <Input
              label="Event Address"
              ref={ref as unknown as React.RefObject<HTMLInputElement>}
              variant="bordered"
              placeholder="Enter event location"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              //errorMessage={errors.address?.message}
            />
              </div>

              <div className="flex gap-2 mb-2">
                <div>
                  <label className="text-sm font-semibold">Start Date:</label>
                  <input
                    type="date"
                    className="border rounded w-full p-2"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold">End Date:</label>
                  <input
                    type="date"
                    className="border rounded w-full p-2"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Website */}
              <div className="mb-4">
                <label className="text-sm font-semibold">Website:</label>
                <input
                  type="text"
                  className="border rounded w-full p-2"
                  value={editWebsite}
                  onChange={(e) => setEditWebsite(e.target.value)}
                />
              </div>

              {/* Save/Cancel */}
              <div className="flex gap-4">
                <Button onClick={handleSaveEvent}
                className="bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black"
                >
                  Save
                </Button>
                <Button onClick={handleCancelEdit} 
                  className="bg-gradient-to-r from-[#f7584c] to-[#ff0505] border border-black"
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </CardHeader>
        <CardBody>{/* Optional extra event body content */}</CardBody>
      </Card>

      {/* Comments Card */}
      <Card className="w-3/4">
        <CardHeader>
          <h2 className="text-2xl font-semibold">Comments</h2>
        </CardHeader>
        <CardBody>
          {comments
            .filter((comment) => !comment.parentId)
            .map((comment) => (
              <div
                key={comment.id}
                className="mb-4 border border-gray-300 rounded-lg p-4 bg-white shadow-sm"
              >
                {/* Parent Comment */}
                <div className="flex justify-between items-center">
                  <div>
                    {editingCommentId === comment.id ? (
                      <Textarea
                        placeholder="Edit your comment..."
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                      />
                    ) : (
                      <p className="text-gray-800">{comment.content}</p>
                    )}
                    <p className="text-gray-500 text-sm">
                      - {comment.createdBy.name} (
                      {new Date(comment.createdAt).toLocaleString()})
                    </p>
                  </div>
                  {isAuthorizedToEdit(comment.createdBy.email) && (
                    <div className="flex flex-col gap-2">
                      {editingCommentId === comment.id ? (
                        <div className="flex gap-2">
                          <Button
                            className="text-blue-500 text-sm"
                            onClick={() => handleEditComment(comment.id)}
                          >
                            Save
                          </Button>
                          <Button
                            className="text-gray-500 text-sm"
                            onClick={() => setEditingCommentId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          className="text-blue-500 text-sm"
                          onClick={() => {
                            setEditingCommentId(comment.id);
                            setEditContent(comment.content);
                          }}
                        >
                          Edit
                        </Button>
                      )}
                      {confirmDelete === comment.id ? (
                        <div className="flex gap-2">
                          <Button
                            className="text-red-500 text-sm"
                            onClick={() => handleDeleteComment(comment.id)}
                          >
                            Confirm Delete
                          </Button>
                          <Button
                            className="text-gray-500 text-sm"
                            onClick={() => setConfirmDelete(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          className="text-red-500 text-sm"
                          onClick={() => setConfirmDelete(comment.id)}
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
                        <div className="flex justify-between items-center">
                          <div>
                            {editingCommentId === reply.id ? (
                              <Textarea
                                placeholder="Edit your reply..."
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                              />
                            ) : (
                              <p className="text-gray-700">{reply.content}</p>
                            )}
                            <p className="text-gray-500 text-xs">
                              - {reply.createdBy.name}{" "}
                              ({new Date(reply.createdAt).toLocaleString()})
                            </p>
                          </div>
                          {isAuthorizedToEdit(reply.createdBy.email) && (
                            <div className="flex flex-col gap-2">
                              {editingCommentId === reply.id ? (
                                <div className="flex gap-2">
                                  <Button
                                    className="text-blue-500 text-xs"
                                    onClick={() => handleEditComment(reply.id)}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    className="text-gray-500 text-xs"
                                    onClick={() => setEditingCommentId(null)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  className="text-blue-500 text-xs"
                                  onClick={() => {
                                    setEditingCommentId(reply.id);
                                    setEditContent(reply.content);
                                  }}
                                >
                                  Edit
                                </Button>
                              )}
                              {confirmDelete === reply.id ? (
                                <div className="flex gap-2">
                                  <Button
                                    className="text-red-500 text-xs"
                                    onClick={() =>
                                      handleDeleteComment(reply.id)
                                    }
                                  >
                                    Confirm Delete
                                  </Button>
                                  <Button
                                    className="text-gray-500 text-xs"
                                    onClick={() => setConfirmDelete(null)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  className="text-red-500 text-xs"
                                  onClick={() => setConfirmDelete(reply.id)}
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
