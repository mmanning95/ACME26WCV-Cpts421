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
import dynamic from "next/dynamic";
import { useEdgeStore } from "@/lib/edgestore";

// Import SingleImageDropzone if needed
import { SingleImageDropzone } from "@/app/Components/Dropzone/single-image-dropzone";

// Dynamically import PdfViewer
const PdfViewer = dynamic(() => import("@/app/Components/PdfViewer/PdfViewer"), {
  ssr: false,
});

function isPdfUrl(url?: string | null) {
  if (!url) return false;
  return url.toLowerCase().endsWith(".pdf");
}

// Occurrence type now represents a day for the event
interface Occurrence {
  date: string;    // "YYYY-MM-DD"
  startTime: string;  // "HH:mm"
  endTime: string;    // "HH:mm"
}

// Updated EventDetails type: no separate startDate/endDate/time fields
interface EventDetails {
  id: string;
  title: string;
  description?: string;
  type?: string;
  address?: string;
  website?: string;
  flyer?: string;
  interested: number;
  occurrences?: {
    id: string;
    date: string; // e.g. "2025-08-10T00:00:00Z" (we'll convert this to "YYYY-MM-DD")
    startTime?: string;
    endTime?: string;
  }[];
  createdBy?: {
    name: string;
    email: string;
  };
}

export default function EditEventPage({ params }: { params: { id: string } }) {
  const eventId = params.id;

  // Basic event state for non-occurrence fields
  const [message, setMessage] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editType, setEditType] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [existingFlyerUrl, setExistingFlyerUrl] = useState<string | null>(null);

  // Remove separate states for start/end dates and times since we use occurrences now

  // Occurrences: multi-day array
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  
  // File upload state
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const { edgestore } = useEdgeStore();

  // Google Places Autocomplete for address
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

  // Fetch event details including occurrences
  useEffect(() => {
    async function fetchEventDetails() {
      try {
        const response = await fetch(`/api/Event/${eventId}`);
        if (!response.ok) {
          setMessage("Failed to fetch event details.");
          return;
        }
        const data = await response.json();
        const evt: EventDetails = data.event;

        setEditTitle(evt.title || "");
        setEditDescription(evt.description || "");
        setEditType(evt.type || "");
        setEditAddress(evt.address || "");
        setEditWebsite(evt.website || "");
        if (evt.flyer) setExistingFlyerUrl(evt.flyer);

        // Populate occurrences if present
        if (evt.occurrences && evt.occurrences.length > 0) {
          const localOccs = evt.occurrences.map((occ) => {
            const [yyyy, mm, dd] = occ.date.split("T")[0].split("-");
            return {
              date: `${yyyy}-${mm}-${dd}`,
              startTime: occ.startTime || "",
              endTime: occ.endTime || "",
            };
          });
          setOccurrences(localOccs);
        }
                      } catch (error) {
        console.error("Error fetching event details:", error);
        setMessage("An error occurred while fetching event details.");
      }
    }
    fetchEventDetails();
  }, [eventId]);

  // Handle file changes
  const isImageFile = React.useMemo(() => {
    if (file && file.type.includes("image")) return true;
    return false;
  }, [file]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFile = e.target.files?.[0] || null;
    setFile(newFile);
    if (newFile && newFile.type.includes("image")) {
      setFilePreview(URL.createObjectURL(newFile));
    } else {
      setFilePreview(null);
    }
  };

  // Occurrence handlers (same logic as in your create page)
  function addSingleDay() {
    setOccurrences((prev) => [...prev, { date: "", startTime: "", endTime: "" }]);
  }

  function removeOccurrence(index: number) {
    setOccurrences((prev) => prev.filter((_, i) => i !== index));
  }

  function handleOccurrenceChange(index: number, field: keyof Occurrence, value: string) {
    setOccurrences((prev) =>
      prev.map((occ, i) => (i === index ? { ...occ, [field]: value } : occ))
    );
  }

  const [showRangeForm, setShowRangeForm] = useState(false);
  const [rangeStartDate, setRangeStartDate] = useState("");
  const [rangeEndDate, setRangeEndDate] = useState("");
  const [rangeStartTime, setRangeStartTime] = useState("");
  const [rangeEndTime, setRangeEndTime] = useState("");

  function addRangeOccurrence() {
    if (!rangeStartDate || !rangeEndDate) return;

    const start = new Date(`${rangeStartDate}T12:00:00`);
    const end = new Date(`${rangeEndDate}T12:00:00`);
    if (start > end) {
      alert("Start date cannot be after end date.");
      return;
    }
    const occurrencesToAdd: Occurrence[] = [];
    let current = new Date(start);
    while (current <= end) {
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, "0");
      const dd = String(current.getDate()).padStart(2, "0");

      occurrencesToAdd.push({
        date: `${yyyy}-${mm}-${dd}`,
        startTime: rangeStartTime,
        endTime: rangeEndTime,
      });
      current.setDate(current.getDate() + 1);
    }
    setOccurrences((prev) => [...prev, ...occurrencesToAdd]);
    setRangeStartDate("");
    setRangeEndDate("");
    setRangeStartTime("");
    setRangeEndTime("");
    setShowRangeForm(false);
  }

  // Save Event handler: build eventOccurrences from occurrences state
  const handleSaveEvent = async () => {
    try {
      let finalFlyerUrl = existingFlyerUrl;
      if (file) {
        const uploadResponse = await edgestore.myPublicImages.upload({ file });
        finalFlyerUrl = uploadResponse.url;
      }

      const eventOccurrences = occurrences
      .filter((o) => o.date.trim())
      .map((o) => ({
        date: new Date(o.date).toISOString(),
        startTime: o.startTime || null,
        endTime: o.endTime || null,
      }));
    
      const updatedEvent = {
        title: editTitle,
        description: editDescription,
        type: editType,
        address: editAddress,
        website: editWebsite,
        flyer: finalFlyerUrl,
        eventOccurrences, 
      };
      
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
      <Card className="w-full max-w-lg mx-auto shadow-sm bg-white border border-gray-300 overflow-auto">
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

            {/* Occurrences Section */}
            <div>
              {occurrences.length > 0 && (
                <div>
                  <p className="font-medium mb-2">Selected Dates/Times:</p>
                  <div className="max-h-64 overflow-y-auto border rounded p-2">
                    {occurrences.map((occ, idx) => (
                      <div key={idx} className="border p-3 mb-2 rounded">
                        <div className="flex gap-3">
                          <Input
                            label="Date"
                            type="date"
                            value={occ.date}
                            onChange={(e) =>
                              handleOccurrenceChange(idx, "date", e.target.value)
                            }
                          />
                          <Input
                            label="Start"
                            type="time"
                            value={occ.startTime}
                            onChange={(e) =>
                              handleOccurrenceChange(idx, "startTime", e.target.value)
                            }
                          />
                          <Input
                            label="End"
                            type="time"
                            value={occ.endTime}
                            onChange={(e) =>
                              handleOccurrenceChange(idx, "endTime", e.target.value)
                            }
                          />
                        </div>
                        {occurrences.length > 1 && (
                          <Button
                            type="button"
                            color="danger"
                            onPress={() => removeOccurrence(idx)}
                            className="mt-2"
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button type="button" onPress={addSingleDay}>
                      + Add Single Day
                    </Button>
                    <Button type="button" onPress={() => setShowRangeForm(true)}>
                      + Add Range
                    </Button>
                  </div>
                  {showRangeForm && (
                    <div className="mt-4 p-3 border rounded">
                      <p className="font-semibold mb-2">Add a Range of Days</p>
                      <div className="flex flex-wrap gap-3 mb-2">
                        <Input
                          label="Start Date"
                          type="date"
                          value={rangeStartDate}
                          onChange={(e) => setRangeStartDate(e.target.value)}
                        />
                        <Input
                          label="End Date"
                          type="date"
                          value={rangeEndDate}
                          onChange={(e) => setRangeEndDate(e.target.value)}
                        />
                        <Input
                          label="Start Time"
                          type="time"
                          value={rangeStartTime}
                          onChange={(e) => setRangeStartTime(e.target.value)}
                        />
                        <Input
                          label="End Time"
                          type="time"
                          value={rangeEndTime}
                          onChange={(e) => setRangeEndTime(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" onPress={addRangeOccurrence}>
                          Add This Range
                        </Button>
                        <Button
                          type="button"
                          color="danger"
                          onPress={() => setShowRangeForm(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {!occurrences.length && (
                <div className="mt-4">
                  <Button type="button" onPress={addSingleDay}>
                    + Add Occurrence
                  </Button>
                </div>
              )}
            </div>

            {/* Flyer Section */}
            <div>
              <label className="font-semibold text-sm">Existing Flyer (if any)</label>
              {existingFlyerUrl ? (
                <div className="my-2">
                  <a href={existingFlyerUrl} target="_blank" rel="noreferrer">
                    {isPdfUrl(existingFlyerUrl) ? (
                      <p className="text-blue-600 underline">View PDF</p>
                    ) : (
                      <img
                        src={existingFlyerUrl}
                        alt="Existing Flyer"
                        className="w-32 h-32 object-cover border border-gray-200 rounded"
                      />
                    )}
                  </a>
                </div>
              ) : (
                <p className="text-gray-400 text-sm">No existing flyer</p>
              )}

              <div className="mt-2">
                <label className="block text-sm font-medium mb-1">
                  Upload a New Flyer (optional)
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
              <p className="text-xs text-gray-500 mt-1">
                You can replace or add a flyer by uploading a file here.
              </p>
            </div>

            <div className="flex gap-4">
              <Button
                onPress={handleSaveEvent}
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
