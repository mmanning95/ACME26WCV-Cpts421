"use client";

import {
  createEventSchema,
  CreateEventSchema,
} from "@/lib/schemas/createEventSchema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Textarea,
  TimeInput,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Autocomplete,
  AutocompleteItem,
} from "@nextui-org/react";
import { Time } from "@internationalized/date";
import React, { useState } from "react";
import { useEdgeStore } from "@/lib/edgestore";
import Link from "next/link";
import { SingleImageDropzone } from "@/app/Components/Dropzone/single-image-dropzone";
import { LoadScript } from "@react-google-maps/api";
import { usePlacesWidget } from "react-google-autocomplete";

const predefinedEventType = ["Workshop", "Seminar", "Meeting", "Fundraiser"];

interface CreateEventForm {
  title: string;
  description?: string;
  type: string;
  website?: string;
  address?: string;
}

interface Occurrence {
  date: string;       // "YYYY-MM-DD"
  startTime: string;  // "HH:mm"
  endTime: string;    // "HH:mm"
}

export default function EventForm() {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<CreateEventForm>({
    mode: "onChange",
  });

  // States
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<Time | null>(null);
  const [endTime, setEndTime] = useState<Time | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [eventType, setEventType] = useState(predefinedEventType);
  const [selectedType, setSelectedType] = useState("");
  const [showRangeForm, setShowRangeForm] = useState(false);
  

  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [showAllDays, setShowAllDays] = useState(false);

  const [urls, setUrls] = useState<{
    url: string;
    thumbnailUrl: string | null;
  }>();
  const { edgestore } = useEdgeStore();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Watch form values
  const watchTitle = watch("title");
  const watchDescription = watch("description");
  const watchType = watch("type");

  // Check form validity: Title, Start/End Date, Type, and EITHER Description OR Flyer
  const hasAtLeastOneDate = occurrences.some((occ) => occ.date.trim() !== "");
  const isFormValid =
    watchTitle &&
    watchType &&
    hasAtLeastOneDate &&
    (watchDescription || file);

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

    // Store user inputs for the "range" form (start date, end date, etc.)
  const [rangeStartDate, setRangeStartDate] = useState("");
  const [rangeEndDate, setRangeEndDate] = useState("");
  const [rangeStartTime, setRangeStartTime] = useState("");
  const [rangeEndTime, setRangeEndTime] = useState("");

  function addRangeOccurrence() {
    if (!rangeStartDate || !rangeEndDate) return;
  
    // Force local midday, so we don't shift to the previous day in negative time zones
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
  
      // Move to the next day
      current.setDate(current.getDate() + 1);
    }
  
    setOccurrences((prev) => [...prev, ...occurrencesToAdd]);
  
    // Clear out the range fields if you like
    setRangeStartDate("");
    setRangeEndDate("");
    setRangeStartTime("");
    setRangeEndTime("");
    setShowRangeForm(false);
  }
  



  const handleTypeChange = (type: string) => {
    if (!type.trim()) return; // Prevent empty inputs
    setSelectedType(type);
    setValue("type", type, { shouldValidate: true });

    if (!eventType.includes(type.trim())) {
      setEventType([...eventType, type.trim()]); // Trim to avoid whitespace issues
    }
  };

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

  const onSubmit = async (data: CreateEventForm) => {
    try {
      // If there is an image file upload it to get its URL
      let flyerUrl: string | null = null;
      if (file) {
        const uploadResponse = await edgestore.myPublicImages.upload({ file });
        flyerUrl = uploadResponse.url; // Store uploaded image URL
      }

      // Build array of eventOccurrences to send to API
      const eventOccurrences = occurrences
      .filter((occ) => occ.date.trim())
      .map((occ) => {
        // Convert user’s "YYYY-MM-DD" to local date at noon
        const [yearStr, monthStr, dayStr] = occ.date.split("-");
        const year = Number(yearStr);
        const month = Number(monthStr) - 1; // 0-based
        const day = Number(dayStr);
    
        // Construct a date at local “noon”
        const dateObj = new Date(Date.UTC(year, month, day));
    
        return {
          date: dateObj.toISOString(),
          startTime: occ.startTime,
          endTime: occ.endTime,
        };
      });

        const fullData = {
          title: data.title,
          description: data.description,
          type: selectedType.toLowerCase(),
          website: data.website,
          address: data.address, 
          flyer: flyerUrl,
          eventOccurrences,
        };

      const response = await fetch("/api/Event/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(fullData),
      });

      if (response.ok) {
        setMessage({ type: "success", text: "Event successfully created!" });
        //redirect after some time
        setTimeout(() => {
          window.location.href = "/Event/create";
        }, 2000);
      } else {
        const errorResponse = await response.json();
        setMessage({
          type: "error",
          text: `Event creation failed: ${errorResponse.message}`,
        });
      }
    } catch (error) {
      console.error("An error occurred while creating the event:", error);
      setMessage({
        type: "error",
        text: "An error occurred while creating the event.",
      });
    }
  };

  // Address State
  const [address, setAddress] = useState("");

  const { ref } = usePlacesWidget<HTMLInputElement>({
    apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    onPlaceSelected: (place) => {
      const selectedAddress = place.formatted_address || "";
      setAddress(selectedAddress);
      setValue("address", selectedAddress); // Ensure React Hook Form updates
    },
    options: {
      types: ["geocode"],
      componentRestrictions: { country: "us" },
    },
  });

  return (
    <div className="w-full min-h-screen bg-gray-50 flex items-center justify-center pt-20 pb-8 px-4">
      <Card className="w-full max-w-lg mx-auto shadow-sm bg-white border border-gray-300 overflow-auto">
        <CardHeader className="flex flex-col items-center justify-center">
          <h3 className="text-3xl font-semibold">Create New Event</h3>
        </CardHeader>
        <CardBody>
          {/* Message Display */}
          {message && (
            <div
              className={`mb-4 p-4 rounded ${
                message.type === "success" ? "text-green-600" : "text-red-600"
              }`}
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4">
              <Input
                isRequired
                isClearable
                label="Event Title"
                aria-label="Event Title"
                variant="bordered"
                {...register("title", { required: "Title is required" })}
                errorMessage={errors.title?.message}
              />

{/* Occurrences Section */}
<div>
              {/* Only show the date/time list if there are occurrences */}
              {occurrences.length > 0 && (
                <div>
                  <p className="font-medium mb-2">Selected Dates/Times:</p>

                  {/* 
                    Wrap the occurrences in a container that is scrollable 
                    unless showAllDays is true, which removes the max height.
                  */}
                  <div
                    className={`${
                      showAllDays ? "" : "max-h-64 overflow-y-auto"
                    } border rounded p-2`}
                  >
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

                  {/* Toggle Button to expand/collapse the container */}
                  <Button
                    onPress={() => setShowAllDays(!showAllDays)}
                    className="mt-2"
                    type="button"
                  >
                    {showAllDays ? "Show Less" : "View All Days"}
                  </Button>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                {/* Button to add a single day */}
                <Button type="button" onPress={addSingleDay}>
                  + Add Single Day
                </Button>
                {/* Button to show/hide the range form */}
                {!showRangeForm && (
                  <Button type="button" onPress={() => setShowRangeForm(true)}>
                    + Add Range
                  </Button>
                )}
              </div>

              {/* Range Form, only visible if showRangeForm is true */}
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

                {/* Description */}
              <div className="flex flex-wrap gap-4">
                <div className="flex-1">
                  <Textarea
                    minRows={8}
                    label="Event Description"
                    aria-label="Event Description"
                    variant="bordered"
                    {...register("description")}
                    errorMessage={errors.description?.message}
                    style={{ height: "200px", resize: "none" }}
                  />

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
                {/* Image Dropzone */}
                <div>
                  {/* Uncomment to show URL and Thumbnail links */}
                  {/* {urls?.url && <Link href={urls.url} target="_blank">URL</Link>}
                {urls?.thumbnailUrl && (
                  <Link href={urls.thumbnailUrl} target="_blank">THUMBNAIL</Link>
                )} */}
                </div>
              </div>

              {/* Event Type  */}
              <Input
                isRequired
                label="Event Type"
                aria-label="Event Type"
                variant="bordered"
                placeholder="e.g. seminar, workshop, meeting"
                value={selectedType}
                onChange={(e) => {
                  const lowercase = e.target.value.toLowerCase();
                  setSelectedType(lowercase);
                  setValue("type", lowercase, { shouldValidate: true });
                }}
                onBlur={() => {
                  const trimmed = selectedType.trim().toLowerCase();
                  setSelectedType(trimmed);
                  setValue("type", trimmed, { shouldValidate: true });
                }}
                errorMessage={errors.type?.message}
              />
              
              {errors.type && (
                <p className="text-red-500">{errors.type.message}</p>
              )}

              {/* Autocomplete Address Input */}
              <Input
                label="Event Address"
                aria-label="Event Address"
                ref={ref as unknown as React.RefObject<HTMLInputElement>}
                variant="bordered"
                placeholder="Enter event location"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                errorMessage={errors.address?.message}
              />

              <Input
                label="Event Website"
                aria-label="Event Website"
                variant="bordered"
                {...register("website")}
                errorMessage={errors.website?.message}
                placeholder="For the use of external webpages"
              />

              <Button
                isDisabled={!isFormValid}
                fullWidth
                type="submit"
                className="bg-gradient-to-r from-[#f7960d] to-[#f95d09] border border-black"
              >
                Submit Event
              </Button>
              <div className="text-[#757575]" style={{ fontSize: "12px" }}>
                Note: Title, Start & End Dates, and Type are required, plus
                either a Description or Flyer. Other fields are optional.
              </div>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
