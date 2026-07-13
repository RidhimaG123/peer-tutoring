"use client";

import { useState } from "react";
import Button from "@/components/Button";

const TIMES = ["9:05–9:25 AM", "12:00–12:30 PM", "2:30–3:00 PM", "3:00–3:30 PM"];
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDayLabel(date: Date): string {
  return `${WEEKDAY_LABELS[date.getDay()]} ${date.getDate()} ${MONTH_LABELS[date.getMonth()]}`;
}

function getUpcomingWeekdays(): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();

  let start = today;
  if (dayOfWeek === 0) {
    start = new Date(today);
    start.setDate(start.getDate() + 1);
  } else if (dayOfWeek === 6) {
    start = new Date(today);
    start.setDate(start.getDate() + 2);
  }

  const daysUntilFriday = 5 - start.getDay();
  const dates: Date[] = [];
  for (let i = 0; i <= daysUntilFriday; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

interface TimeSlotPickerProps {
  selectedSlot: string;
  onSelectSlot: (slot: string) => void;
  blockedSlots?: string[];
}

export default function TimeSlotPicker({ selectedSlot, onSelectSlot, blockedSlots = [] }: TimeSlotPickerProps) {
  const weekdays = getUpcomingWeekdays();
  const [selectedDayLabel, setSelectedDayLabel] = useState(formatDayLabel(weekdays[0]));

  return (
    <div>
      <div className="mb-2 text-xs font-medium text-zinc-700">Choose a time slot</div>
      <div className="flex flex-wrap gap-2">
        {weekdays.map((date) => {
          const label = formatDayLabel(date);
          return (
            <Button
              key={label}
              type="button"
              variant={selectedDayLabel === label ? "primary" : "secondary"}
              onClick={() => setSelectedDayLabel(label)}
              className="!px-3 !py-1 !text-xs"
            >
              {label}
            </Button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {TIMES.map((time) => {
          const slot = `${selectedDayLabel}, ${time}`;
          if (blockedSlots.includes(slot)) {
            return (
              <button
                key={slot}
                type="button"
                disabled
                className="cursor-not-allowed rounded-xl border px-3 py-1 text-xs text-zinc-400 line-through"
              >
                {time}
              </button>
            );
          }
          return (
            <Button
              key={slot}
              type="button"
              variant={selectedSlot === slot ? "primary" : "secondary"}
              onClick={() => onSelectSlot(slot)}
              className="!px-3 !py-1 !text-xs"
            >
              {time}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
