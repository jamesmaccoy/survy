"use client";

import React, { useState } from "react";

interface Booking {
  id: string;
  propertyId: string;
  packageId: string | null;
  customerName: string;
  customerEmail: string;
  fromDate: string;
  toDate: string;
  total: number;
  paymentStatus: string;
  source?: string;
}

interface CalendarPickerProps {
  selectedFromDate: string; // YYYY-MM-DD
  selectedToDate: string; // YYYY-MM-DD
  bookings: Booking[];
  onChange: (fromDate: string, toDate: string) => void;
  singleMonth?: boolean;
  bookingType?: string;
}

export default function CalendarPicker({
  selectedFromDate,
  selectedToDate,
  bookings,
  onChange,
  singleMonth = false,
  bookingType = "nightly",
}: CalendarPickerProps) {
  // Current calendar month view (starts with the check-in date's month or current month)
  const initialDate = selectedFromDate ? new Date(selectedFromDate) : new Date();
  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth()); // 0-indexed

  // Helper to format date as YYYY-MM-DD in local time
  const formatDateString = (year: number, month: number, day: number): string => {
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  };

  const todayStr = (() => {
    const d = new Date();
    return formatDateString(d.getFullYear(), d.getMonth(), d.getDate());
  })();

  // Navigate months
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const getBookingForDate = (year: number, month: number, day: number): Booking | null => {
    const date = new Date(year, month, day);
    const time = date.getTime();

    for (const b of bookings) {
      if (b.paymentStatus === "failed" || b.paymentStatus === "refunded") continue;
      const start = new Date(b.fromDate.split("T")[0]); // compare dates only
      const end = new Date(b.toDate.split("T")[0]);

      const startTime = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
      const endTime = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();

      if (bookingType === "hourly") {
        if (time === startTime) {
          return b;
        }
      } else {
        // Block night of check-in up to night before check-out
        if (time >= startTime && time < endTime) {
          return b;
        }
      }
    }
    return null;
  };

  // Generate calendar days for a given month and year
  const getDaysInMonth = (year: number, month: number) => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    return { firstDayIndex, totalDays };
  };

  // Render a single month view
  const renderMonth = (year: number, month: number) => {
    const { firstDayIndex, totalDays } = getDaysInMonth(year, month);
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const days: React.JSX.Element[] = [];

    // Empty cells for offset before the first day of the month
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(
        <div key={`empty-${i}`} className="w-full aspect-square max-w-[44px]" />
      );
    }

    // Days cells
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = formatDateString(year, month, day);
      const booking = getBookingForDate(year, month, day);
      const isBooked = !!booking;

      const isSelectedFrom = selectedFromDate === dateStr;
      const isSelectedTo = selectedToDate === dateStr;

      // Check if day is inside selected range
      const isSelectedRange = (() => {
        if (!selectedFromDate || !selectedToDate) return false;
        return dateStr > selectedFromDate && dateStr < selectedToDate;
      })();

      const isToday = todayStr === dateStr;

      // Click handler for day selection
      const handleDayClick = () => {
        if (isBooked) return;

        if (bookingType === "hourly") {
          onChange(dateStr, dateStr);
        } else {
          // Selection Logic
          if (!selectedFromDate || (selectedFromDate && selectedToDate)) {
            // Select Check-in
            onChange(dateStr, "");
          } else {
            // Select Check-out
            if (dateStr > selectedFromDate) {
              // Ensure no booked days inside the selected range
              let hasOverlap = false;
              let current = new Date(selectedFromDate);
              const target = new Date(dateStr);

              while (current < target) {
                const checkB = getBookingForDate(current.getFullYear(), current.getMonth(), current.getDate());
                if (checkB) {
                  hasOverlap = true;
                  break;
                }
                current.setDate(current.getDate() + 1);
              }

              if (hasOverlap) {
                alert("The selected range overlaps with an existing booking. Please choose another range.");
                onChange(dateStr, "");
              } else {
                onChange(selectedFromDate, dateStr);
              }
            } else {
              // Selected a date before check-in date: reset check-in to this date
              onChange(dateStr, "");
            }
          }
        }
      };

      // Determine label & styles for tooltip/indicator
      let tooltipText = "";
      if (isBooked && booking) {
        if (booking.source === "gcal") {
          tooltipText = `Unavailable: ${booking.customerName}`;
        } else if (booking.source === "airbnb") {
          tooltipText = `Airbnb: Blocked Dates`;
        } else {
          tooltipText = `Booked by ${booking.customerName}`;
        }
      } else if (isToday) {
        tooltipText = "Today";
      }

      // Styles
      let dayClass = "w-full aspect-square max-w-[44px] flex items-center justify-center text-xs font-semibold rounded-xl relative cursor-pointer transition-all duration-200 ";
      if (isBooked) {
        dayClass += "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20 cursor-not-allowed hover:bg-red-100 dark:hover:bg-red-500/20";
      } else if (isSelectedFrom || isSelectedTo) {
        dayClass += "bg-teal-500 text-white shadow-md shadow-teal-500/20 scale-105 z-10 font-bold";
      } else if (isSelectedRange) {
        dayClass += "bg-teal-100/50 dark:bg-teal-500/20 text-teal-900 dark:text-teal-200 border border-teal-200 dark:border-teal-500/10";
      } else if (isToday) {
        dayClass += "bg-teal-50/80 dark:bg-zinc-800 text-teal-900 dark:text-white border border-teal-200 dark:border-zinc-700 hover:bg-teal-100 dark:hover:bg-zinc-700";
      } else {
        dayClass += "bg-white/40 dark:bg-white/5 text-teal-950 dark:text-zinc-300 hover:bg-teal-50 dark:hover:bg-white/10 hover:text-teal-700 dark:hover:text-white";
      }

      days.push(
        <div key={dateStr} className="relative group">
          <button
            type="button"
            onClick={handleDayClick}
            disabled={isBooked}
            className={dayClass}
          >
            {day}

            {/* Visual indicator for booked/blocked dates */}
            {isBooked && (
              <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-red-400 opacity-60" />
            )}
          </button>

          {/* Premium Tooltip */}
          {tooltipText && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-zinc-900 border border-white/10 text-white text-[10px] py-1.5 px-2.5 rounded-lg shadow-xl z-20 text-center font-sans tracking-wide">
              {tooltipText}
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-zinc-900" />
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Month Header */}
        <div className="text-center font-bold text-sm text-teal-950 dark:text-white border-b border-teal-100/50 dark:border-white/5 pb-2.5">
          {monthNames[month]} {year}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1.5 justify-items-center">
          {/* Weekday headers */}
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((dayName) => (
            <div key={dayName} className="h-6 w-full max-w-[44px] flex items-center justify-center text-[10px] font-bold text-teal-800/60 dark:text-zinc-500 uppercase tracking-wider">
              {dayName}
            </div>
          ))}
          {days}
        </div>
      </div>
    );
  };

  // Show two consecutive months
  const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;
  const nextMonthVal = currentMonth === 11 ? 0 : currentMonth + 1;

  return (
    <div className="w-full rounded-3xl border border-teal-100 dark:border-white/10 bg-teal-50/10 dark:bg-white/5 p-6 shadow-2xl backdrop-blur-md space-y-6">
      {/* Calendar Navigation */}
      <div className="flex items-center justify-between border-b border-teal-100 dark:border-white/5 pb-4">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="h-9 w-9 flex items-center justify-center rounded-xl bg-teal-50/50 dark:bg-white/5 border border-teal-100 dark:border-white/10 text-teal-800 dark:text-zinc-400 hover:text-teal-950 dark:hover:text-white hover:bg-teal-100 dark:hover:bg-white/10 hover:border-teal-200 dark:hover:border-white/20 transition-all active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <span className="text-xs font-extrabold uppercase tracking-widest text-teal-600 dark:text-teal-400 flex items-center gap-2">
          <span>📅</span> {bookingType === "hourly" ? "Time-Specific Calendar" : "Availability Calendar"}
        </span>

        <button
          type="button"
          onClick={handleNextMonth}
          className="h-9 w-9 flex items-center justify-center rounded-xl bg-teal-50/50 dark:bg-white/5 border border-teal-100 dark:border-white/10 text-teal-800 dark:text-zinc-400 hover:text-teal-950 dark:hover:text-white hover:bg-teal-100 dark:hover:bg-white/10 hover:border-teal-200 dark:hover:border-white/20 transition-all active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Responsive grids for two months */}
      <div className={`grid gap-8 ${singleMonth ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 md:gap-12"}`}>
        {renderMonth(currentYear, currentMonth)}
        {!singleMonth && renderMonth(nextMonthYear, nextMonthVal)}
      </div>

      {/* Date display legend */}
      <div className="border-t border-teal-100 dark:border-white/5 pt-4 flex flex-wrap gap-4 items-center justify-between text-[11px] text-teal-800 dark:text-zinc-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-teal-500" />
            <span className="text-teal-950 dark:text-zinc-300">Selected</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/30" />
            <span className="text-teal-950 dark:text-zinc-300">Unavailable</span>
          </div>
        </div>

        {selectedFromDate && (
          <div className="text-teal-600 dark:text-teal-300 font-medium">
            {bookingType === "hourly" ? (
              <>Selected Date: <strong className="text-teal-950 dark:text-white">{selectedFromDate}</strong></>
            ) : (
              <>
                Stay: <strong className="text-teal-950 dark:text-white">{selectedFromDate}</strong>
                {selectedToDate ? <> to <strong className="text-teal-950 dark:text-white">{selectedToDate}</strong></> : " (Select Check-out)"}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
