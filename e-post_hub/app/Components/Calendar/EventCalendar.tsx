import React, { useState } from "react";
import Calendar, { CalendarProps } from "react-calendar";
import "react-calendar/dist/Calendar.css";

// The shape of each event
type Event = {
  id: string;
  title: string;
  startDate?: string; // "YYYY-MM-DD"
  endDate?: string;   // "YYYY-MM-DD"
};

// Props for our calendar
type EventCalendarProps = {
  events: Event[];
  onDateClick: (dateStr: string) => void;
};

export default function EventCalendar({ events, onDateClick }: EventCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Helper to format a JS Date as "YYYY-MM-DD" in local time
  function formatLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // When user clicks a date on the calendar
  const handleDateChange: CalendarProps["onChange"] = (value) => {
    if (value instanceof Date) {
      setSelectedDate(value);
      // Convert the chosen day to "YYYY-MM-DD" in local time
      const dayStr = formatLocal(value);
      onDateClick(dayStr);
    }
  };

  return (
    <div className="calendar-container rounded-lg shadow-md p-4">
      <Calendar
        onChange={handleDateChange}
        value={selectedDate}
        locale="en-US"
        // Show a small badge if an event covers that tile day
        tileContent={({ date }) => {
          const tileDayStr = formatLocal(date);

          // Find events that fall on this tileDay
          const eventsOnDate = events.filter((ev) => {
            if (!ev.startDate) return false;
            const start = ev.startDate;             // "YYYY-MM-DD"
            const end = ev.endDate || start;
            // Compare as strings
            return tileDayStr >= start && tileDayStr <= end;
          });

          if (eventsOnDate.length > 0) {
            return (
              <div className="relative flex justify-center">
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-semibold px-[4px] py-[1px] rounded-full leading-none">
                  {eventsOnDate.length}
                </span>
              </div>
            );
          }
          return null;
        }}
        // Highlight tiles that have events
        tileClassName={({ date }) => {
          const tileDayStr = formatLocal(date);

          const isEventDate = events.some((ev) => {
            if (!ev.startDate) return false;
            const start = ev.startDate;
            const end = ev.endDate || start;
            return tileDayStr >= start && tileDayStr <= end;
          });

          return isEventDate
            ? "bg-orange-500 text-black font-semibold hover:bg-orange-600 transition"
            : "hover:bg-white hover:text-black transition";
        }}
        className="border-none"
      />
    </div>
  );
}
