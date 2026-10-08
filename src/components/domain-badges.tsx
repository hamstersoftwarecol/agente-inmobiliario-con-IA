import type {
  AppointmentStatus,
  CallDirection,
  CallOutcome,
  LeadStatus,
  LeadTemperature,
  PropertyStatus,
  Sentiment,
} from "@/db/schema";
import { Badge, type Tone } from "@/components/ui/badge";
import {
  appointmentStatusLabels,
  callDirectionLabels,
  callOutcomeLabels,
  leadStatusLabels,
  leadTemperatureLabels,
  propertyStatusLabels,
  sentimentLabels,
} from "@/lib/labels";

const leadStatusTone: Record<LeadStatus, Tone> = {
  new: "blue",
  contacted: "gray",
  qualified: "purple",
  appointment: "green",
  won: "green",
  lost: "red",
};

const temperatureTone: Record<LeadTemperature, Tone> = { hot: "red", warm: "orange", cold: "gray" };

const outcomeTone: Record<CallOutcome, Tone> = {
  appointment_booked: "green",
  qualified: "purple",
  info_provided: "blue",
  callback_requested: "yellow",
  not_interested: "gray",
  no_answer: "gray",
  voicemail: "gray",
  other: "gray",
};

const appointmentTone: Record<AppointmentStatus, Tone> = {
  scheduled: "blue",
  confirmed: "green",
  completed: "gray",
  cancelled: "red",
  no_show: "orange",
};

const propertyTone: Record<PropertyStatus, Tone> = {
  available: "green",
  reserved: "yellow",
  sold: "gray",
  rented: "gray",
  inactive: "gray",
};

const sentimentTone: Record<Sentiment, Tone> = { positive: "green", neutral: "gray", negative: "red" };

export const LeadStatusBadge = ({ status }: { status: LeadStatus }) => (
  <Badge tone={leadStatusTone[status]}>{leadStatusLabels[status]}</Badge>
);

export const TemperatureBadge = ({ temperature }: { temperature: LeadTemperature }) => (
  <Badge tone={temperatureTone[temperature]}>
    {temperature === "hot" ? "🔥 " : ""}
    {leadTemperatureLabels[temperature]}
  </Badge>
);

export const OutcomeBadge = ({ outcome }: { outcome: CallOutcome | null }) =>
  outcome ? <Badge tone={outcomeTone[outcome]}>{callOutcomeLabels[outcome]}</Badge> : <Badge>Pendiente</Badge>;

export const DirectionBadge = ({ direction }: { direction: CallDirection }) => (
  <Badge tone={direction === "inbound" ? "blue" : direction === "outbound" ? "purple" : "gray"}>
    {callDirectionLabels[direction]}
  </Badge>
);

export const AppointmentStatusBadge = ({ status }: { status: AppointmentStatus }) => (
  <Badge tone={appointmentTone[status]}>{appointmentStatusLabels[status]}</Badge>
);

export const PropertyStatusBadge = ({ status }: { status: PropertyStatus }) => (
  <Badge tone={propertyTone[status]}>{propertyStatusLabels[status]}</Badge>
);

export const SentimentBadge = ({ sentiment }: { sentiment: Sentiment | null }) =>
  sentiment ? <Badge tone={sentimentTone[sentiment]}>{sentimentLabels[sentiment]}</Badge> : null;
