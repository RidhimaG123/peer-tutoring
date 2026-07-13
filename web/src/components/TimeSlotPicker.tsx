"use client";

import { useState } from "react";
import Button from "@/components/Button";
import { formatDayLabel, getUpcomingWeekdays } from "@/lib/weekSlots";

const TIMES = ["9:05–9:25 AM", "12:00–12:30 PM", "2:30–3:00 PM", "3:00–3:30 PM"];

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
