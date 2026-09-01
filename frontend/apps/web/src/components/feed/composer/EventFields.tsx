'use client';

interface EventFieldsProps {
  eventVenue: string;
  onEventVenueChange: (v: string) => void;
  eventDate: string;
  onEventDateChange: (v: string) => void;
  eventEndDate: string;
  onEventEndDateChange: (v: string) => void;
}

export default function EventFields({
  eventVenue, onEventVenueChange,
  eventDate, onEventDateChange,
  eventEndDate, onEventEndDateChange,
}: EventFieldsProps) {
  return (
    <div className="mx-4 mb-3 p-3 bg-purple-50 rounded-xl space-y-2 border border-purple-100">
      <p className="text-xs font-semibold text-purple-700">Event Details</p>
      <input className="w-full px-3 py-2 text-sm border border-app bg-surface rounded-lg text-app" placeholder="Venue / location name" value={eventVenue} onChange={(e) => onEventVenueChange(e.target.value)} spellCheck autoCorrect="on" />
      <input type="datetime-local" className="w-full px-3 py-2 text-sm border border-app bg-surface rounded-lg text-app" value={eventDate} onChange={(e) => onEventDateChange(e.target.value)} />
      <input type="datetime-local" className="w-full px-3 py-2 text-sm border border-app bg-surface rounded-lg text-app" placeholder="End date/time (optional)" value={eventEndDate} onChange={(e) => onEventEndDateChange(e.target.value)} />
    </div>
  );
}
