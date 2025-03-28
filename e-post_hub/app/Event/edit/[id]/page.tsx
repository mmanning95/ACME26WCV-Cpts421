"use client";

import React, { useEffect, useState } from "react";
import {
  Button,
  Textarea,
  Input,
  Card,
  CardBody,
  CardHeader,
  TimeInput,
} from "@nextui-org/react";
import { usePlacesWidget } from "react-google-autocomplete";
import { Time } from "@internationalized/date";
// 1) Import SingleImageDropzone (same as in create)
import { SingleImageDropzone } from "@/app/Components/Dropzone/single-image-dropzone";
// 2) Import useEdgeStore to upload images
import { useEdgeStore } from "@/lib/edgestore";

export default function EditEventPage({ params }: { params: { id: string } }) {
  const eventId = params.id;

  // States for all the other event fields
  const [message, setMessage] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editType, setEditType] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editStartTime, setEditStartTime] = useState<Time | null>(null);
  const [editEndTime, setEditEndTime] = useState<Time | null>(null);

  // 3) State to track the existing flyer URL (if any) and the new file
  const [existingFlyerUrl, setExistingFlyerUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  // 4) Get your EdgeStore instance
  const { edgestore } = useEdgeStore();

  // Fetch event details, including the old flyer (if any)
  useEffect(() => {
    const fetchEventDetails = async () => {
      try {
        const response = await fetch(`/api/Event/${eventId}`);
        if (response.ok) {
          const data = await response.json();
          const evt = data.event;

          setEditTitle(evt.title || "");
          setEditDescription(evt.description || "");
          setEditType(evt.type || "");
          setEditAddress(evt.address || "");
          setEditWebsite(evt.website || "");
          setEditStartDate(adjustDateForDisplay(evt.startDate));
          setEditEndDate(adjustDateForDisplay(evt.endDate));

          // If there's an existing flyer, save its URL
          if (evt.flyer) {
            setExistingFlyerUrl(evt.flyer);
          }
        } else {
          setMessage("Failed to fetch event details.");
        }
      } catch (error) {
        console.error("Error fetching event details:", error);
        setMessage("An error occurred while fetching event details.");
      }
    };

    fetchEventDetails();
  }, [eventId]);

  // Same date offset logic
  const adjustDateForDisplay = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  };
  const adjustDateForSaving = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  };

  // Basic time formatting (AM/PM)
  function formatTime(time: Time | null): string | null {
    if (!time) return null;
    const ampm = time.hour >= 12 ? "PM" : "AM";
    let displayHour = time.hour % 12;
    if (displayHour === 0) displayHour = 12;
    const displayMinute = time.minute.toString().padStart(2, "0");
    return `${displayHour}:${displayMinute} ${ampm}`;
  }

  // Handling the file input
  const isImageFile = React.useMemo(() => {
    if (file && file.type.includes("image")) return true;
    return false;
  }, [file]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFile = e.target.files?.[0];
    setFile(newFile || null);

    // If it’s an image, show preview
    if (newFile && newFile.type.includes("image")) {
      const url = URL.createObjectURL(newFile);
      setFilePreview(url);
    } else {
      setFilePreview(null); // No preview for PDF
    }
  };

  // Google Maps Autocomplete
  const { ref } = usePlacesWidget<HTMLInputElement>({
    apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    onPlaceSelected: (place) => {
      const selectedAddress = place.formatted_address || "";
      setEditAddress(selectedAddress);
    },
    options: {
      types: ["geocode"],
      componentRestrictions: { country: "us" },
    },
  });

  // 5) On save, upload new file if provided; else use old flyer
  const handleSaveEvent = async () => {
    // If the user uploaded a new flyer, upload it to EdgeStore
    let finalFlyerUrl = existingFlyerUrl;
    if (file) {
      try {
        const uploadResponse = await edgestore.myPublicImages.upload({ file });
        finalFlyerUrl = uploadResponse.url;
      } catch (err) {
        console.error("Error uploading flyer:", err);
        setMessage("Failed to upload new flyer.");
        return;
      }
    }

    const updatedEvent = {
      title: editTitle,
      description: editDescription,
      type: editType,
      address: editAddress,
      website: editWebsite,
      startDate: adjustDateForSaving(editStartDate),
      endDate: adjustDateForSaving(editEndDate),
      startTime: formatTime(editStartTime),
      endTime: formatTime(editEndTime),
      flyer: finalFlyerUrl, // use either the old flyer or the newly uploaded one
    };

    try {
      const response = await fetch(`/api/Event/${eventId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedEvent),
      });

      if (!response.ok) {
        setMessage("Failed to update event.");
        return;
      }

      setMessage("Event updated successfully!");
      setTimeout(() => {
        window.location.href = `/Event/${eventId}`;
      }, 2000);
    } catch (error) {
      console.error("Error updating event:", error);
      setMessage("An error occurred while updating the event.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 pt-8 pb-8 px-4">
      <Card className="w-full max-w-lg mx-auto shadow-sm bg-white border border-gray-300">
        <CardHeader className="flex flex-col items-center justify-center">
          <h3 className="text-3xl font-semibold">Edit Event</h3>
        </CardHeader>
        <CardBody>
          {message && (
            <div className="p-2 mb-4 bg-yellow-100 text-yellow-800 rounded">
              {message}
            </div>
          )}

          <div className="space-y-4">
            <Input
              isRequired
              label="Event Title"
              variant="bordered"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />

            <div className="flex gap-4">
              <Input
                isRequired
                type="date"
                label="Start Date"
                variant="bordered"
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
              />
              <Input
                isRequired
                type="date"
                label="End Date"
                variant="bordered"
                value={editEndDate}
                onChange={(e) => setEditEndDate(e.target.value)}
              />
            </div>

            <div className="flex gap-4">
              <TimeInput
                label="Event Start Time"
                variant="bordered"
                value={editStartTime}
                onChange={(newValue) => setEditStartTime(newValue)}
              />
              <TimeInput
                label="Event End Time"
                variant="bordered"
                value={editEndTime}
                onChange={(newValue) => setEditEndTime(newValue)}
              />
            </div>

            <Textarea
              minRows={6}
              label="Event Description"
              variant="bordered"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />

            <Input
              label="Event Type"
              variant="bordered"
              value={editType}
              onChange={(e) => setEditType(e.target.value)}
            />

{/* Flyer (optional) block */}
<div>
  <label className="font-semibold text-sm">Flyer (optional)</label>

  <div className="flex items-center gap-4 mt-1">
    {existingFlyerUrl && (
      <div>
        <label className="block text-sm font-medium mb-1">
          Existing Flyer
        </label>
        <a href={existingFlyerUrl} target="_blank" rel="noreferrer">
          {existingFlyerUrl.toLowerCase().endsWith(".pdf") ? (
            <p className="text-blue-600 underline">View PDF</p>
          ) : (
            <img
              src={existingFlyerUrl}
              alt="Existing Flyer"
              className="mt-1 w-32 h-32 object-cover border border-gray-200 rounded"
            />
          )}
        </a>
      </div>
    )}

    {/* File input for image/PDF */}
    <div>
      <label className="block text-sm font-medium mb-1">
        Flyer / Attachment
      </label>
      <input
        type="file"
        accept="image/*,application/pdf"
        onChange={handleFileChange}
      />
      {filePreview && isImageFile && (
        <img
          src={filePreview}
          alt="Preview"
          className="mt-2 w-48 h-auto border border-gray-200 rounded"
        />
      )}
    </div>
  </div>

  <p className="text-xs text-gray-500 mt-1">
    You can replace or add a flyer by uploading a file here.
  </p>
</div>

            <Input
              label="Event Address"
              ref={ref as unknown as React.RefObject<HTMLInputElement>}
              variant="bordered"
              placeholder="Enter event location"
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
            />

            <Input
              label="Event Website"
              variant="bordered"
              value={editWebsite}
              onChange={(e) => setEditWebsite(e.target.value)}
              placeholder="For external webpages"
            />

            <div className="flex gap-4">
              <Button
                onClick={handleSaveEvent}
                className="bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black"
              >
                Save
              </Button>
              <a href={`/Event/${eventId}`}>
                <Button className="bg-gradient-to-r from-[#f7584c] to-[#ff0505] border border-black">
                  Cancel
                </Button>
              </a>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
