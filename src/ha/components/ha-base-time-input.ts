export interface TimeChangedEvent {
  days?: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
  amPm?: "AM" | "PM";
}
