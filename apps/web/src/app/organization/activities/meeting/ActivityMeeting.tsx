"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import styles from "./ActivityMeeting.module.css";

/* =========================
   Types
========================= */
type ActivityKind = "meetings" | "courses" | "challenges";
type ActivityStatus = "draft" | "publish";
type AudienceAccess = "invitedOnly" | "everyone";
type ParticipationMode = "joinAnytime" | "scheduledParticipation";
type AttendanceLocation = "onsite" | "online";

type ChoiceOption<T> = {
  value: T;
  label: string;
};

type SkillOption = {
  skillId: string;
  skillName: string;
  skillCategory: string;
};

type SkillProgressItem = {
  id: string;
  skillId?: string;
  skillName: string;
  skillCategory?: string;
  skillLevel: string;
};

type ActivitySkillApiItem = {
  id: string;
  skill_id: string;
  skill_name: string;
  skill_category?: string;
  skill_level_value: number;
  skill_level_label: string;
};

type UploadPreviewState = {
  file: File | null;
  previewUrl: string;
  mimeType: string;
  fileName: string;
};

type PlaceSuggestionItem = {
  id: string;
  label: string;
  placePrediction: any;
};

type SelectedPlaceState = {
  displayText: string;
  placeName: string;
  formattedAddress: string;
  detailText: string;
  latitude: number | null;
  longitude: number | null;
  googleMapsUri: string;
};

type RangeValue = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
};

type MeetingFormDefaults = {
  activityTitle: string;
  description: string;
  onsiteLocation: string;
  onlineLink: string;
  speakerNames: string;
  speakerBio: string;
  enrollmentStartDate: string;
  enrollmentStartTime: string;
  enrollmentEndDate: string;
  enrollmentEndTime: string;
  activityStartDate: string;
  activityStartTime: string;
  activityEndDate: string;
  activityEndTime: string;
  maxParticipants: string;
  xpReward: string;
  badgeButtonText: string;
  certificateButtonText: string;
  qrCodeValue: string;
};

function createEmptyUploadState(): UploadPreviewState {
  return {
    file: null,
    previewUrl: "",
    mimeType: "",
    fileName: "",
  };
}

/* =========================
   Mock / Static Data
========================= */
const ACTIVITY_TYPE_OPTIONS: ChoiceOption<ActivityKind>[] = [
  { value: "meetings", label: "Meetings" },
  { value: "courses", label: "Courses" },
  { value: "challenges", label: "Challenges" },
];

const ACTIVITY_ROUTE_MAP: Record<ActivityKind, string> = {
  meetings: "/organization/activities/meeting",
  courses: "/organization/activities/course",
  challenges: "/organization/activities/challenge",
};

const AUDIENCE_OPTIONS: ChoiceOption<AudienceAccess>[] = [
  { value: "invitedOnly", label: "Invited only" },
  { value: "everyone", label: "Everyone can join" },
];

const PARTICIPATION_OPTIONS: ChoiceOption<ParticipationMode>[] = [
  { value: "joinAnytime", label: "Join anytime" },
  { value: "scheduledParticipation", label: "Scheduled Participation" },
];

const SKILL_LEVEL_OPTIONS = [
  "Remembering",
  "Understanding",
  "Applying",
  "Analyzing",
  "Evaluating",
  "Creating",
];

const FORM_DEFAULTS: MeetingFormDefaults = {
  activityTitle: "",
  description: "",
  onsiteLocation: "",
  onlineLink: "",
  speakerNames: "",
  speakerBio: "",
  enrollmentStartDate: "",
  enrollmentStartTime: "",
  enrollmentEndDate: "",
  enrollmentEndTime: "",
  activityStartDate: "",
  activityStartTime: "",
  activityEndDate: "",
  activityEndTime: "",
  maxParticipants: "0",
  xpReward: "20",
  badgeButtonText: "upload",
  certificateButtonText: "upload",
  qrCodeValue: "ACT-MEETING-2026-001",
};

type SkillFormValue = {
  searchText: string;
  selectedSkillId: string;
  selectedSkillName: string;
  selectedSkillCategory: string;
  skillLevel: string;
};

const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hours = String(Math.floor(index / 2)).padStart(2, "0");
  const minutes = index % 2 === 0 ? "00" : "30";
  return `${hours}:${minutes}`;
});

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatDateDisplay(value: string) {
  if (!value) return "date";
  const date = parseIsoDate(value);
  if (!date) return "date";
  return date.toLocaleDateString("en-GB");
}

function formatMonthTitle(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function buildCalendarCells(viewMonth: Date) {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const offset = firstDayOfMonth.getDay();
  const totalDays = lastDayOfMonth.getDate();
  const totalCells = offset + totalDays <= 35 ? 35 : 42;
  const gridStart = new Date(year, month, 1 - offset);

  return Array.from({ length: totalCells }, (_, index) => {
    const cellDate = new Date(gridStart);
    cellDate.setDate(gridStart.getDate() + index);
    return {
      iso: toIsoDate(cellDate),
      dayNumber: cellDate.getDate(),
      isCurrentMonth: cellDate.getMonth() === month,
      isWeekend: cellDate.getDay() === 0 || cellDate.getDay() === 6,
    };
  });
}

function isDateInRange(targetIso: string, startIso: string, endIso: string) {
  if (!startIso || !endIso) return false;
  return targetIso >= startIso && targetIso <= endIso;
}

function createRandomQrCodeValue() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `ACT-MTG-${ts}-${rand}`;
}

function splitIsoDateTime(value: string): { date: string; time: string } {
  if (!value) return { date: "", time: "" };

  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})/);
  if (match) {
    return { date: match[1], time: match[2] };
  }

  return { date: "", time: "" };
}

function normalizeSkillLevelLabel(level: any) {
  if (typeof level === "string") {
    const trimmed = level.trim();

    const matchedLabel = SKILL_LEVEL_OPTIONS.find(
      (option) => option.toLowerCase() === trimmed.toLowerCase()
    );
    if (matchedLabel) return matchedLabel;

    const numericFromString = Number(trimmed);
    if (
      Number.isFinite(numericFromString) &&
      numericFromString >= 0 &&
      numericFromString < SKILL_LEVEL_OPTIONS.length
    ) {
      return SKILL_LEVEL_OPTIONS[numericFromString];
    }
  }

  const levelNumber = Number(level);
  if (
    Number.isFinite(levelNumber) &&
    levelNumber >= 0 &&
    levelNumber < SKILL_LEVEL_OPTIONS.length
  ) {
    return SKILL_LEVEL_OPTIONS[levelNumber];
  }

  return SKILL_LEVEL_OPTIONS[0];
}

function normalizeTextValue(value: any): string {
  if (value === null || value === undefined) return "";

  if (typeof value === "string") {
    const trimmed = value.trim();

    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "string") return parsed.trim();
    } catch { }

    return trimmed;
  }

  if (typeof value === "object") {
    if (typeof value?.text === "string") return value.text.trim();

    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }

  return String(value).trim();
}

function normalizeLoadedSkills(raw: any, info: any): SkillProgressItem[] {
  const source =
    raw?.skills ??
    raw?.skill_info ??
    raw?.skillInfo ??
    info?.skills ??
    info?.skill_info ??
    info?.skillInfo ??
    [];

  if (!Array.isArray(source)) return [];

  return source.map((skill: any, index: number) => ({
    id: `loaded-skill-${String(
      skill?.skill_id ??
      skill?.skillID ??
      skill?.skillId ??
      skill?.SkillID ??
      skill?.id ??
      index
    )}`,
    skillId: String(
      skill?.skill_id ??
      skill?.skillID ??
      skill?.skillId ??
      skill?.SkillID ??
      skill?.id ??
      ""
    ).trim(),
    skillName: String(
      skill?.skill_name ??
      skill?.skillName ??
      skill?.SkillName ??
      skill?.name ??
      ""
    ).trim(),
    skillCategory: String(
      skill?.skill_category ??
      skill?.skillCategory ??
      skill?.SkillCategory ??
      skill?.category ??
      ""
    ).trim(),
    skillLevel: normalizeSkillLevelLabel(
      skill?.skill_level ??
      skill?.skillLevel ??
      skill?.SkillLevel ??
      skill?.level
    ),
  }));
}

function hydrateSkillItemsWithCatalog(
  items: SkillProgressItem[],
  catalog: SkillOption[]
): SkillProgressItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];

  return items.map((item, index) => {
    const itemSkillId = String(item.skillId || "").trim().toLowerCase();

    const matched = catalog.find(
      (skill) => String(skill.skillId || "").trim().toLowerCase() === itemSkillId
    );

    return {
      ...item,
      id: item.id || `skill-${index}`,
      skillId: item.skillId || matched?.skillId || "",
      skillName:
        item.skillName?.trim() ||
        matched?.skillName ||
        `Skill ${index + 1}`,
      skillCategory:
        item.skillCategory?.trim() ||
        matched?.skillCategory ||
        "",
      skillLevel: normalizeSkillLevelLabel(item.skillLevel),
    };
  });
}

function normalizeMeetingEditorData(payload: any) {
  const raw = payload?.activity ?? payload ?? {};
  const info = raw?.commonInfo ?? raw?.common_info ?? raw;
  const meetingInfo =
    raw?.meeting_info ??
    raw?.meetingInfo ??
    info?.meeting_info ??
    info?.meetingInfo ??
    {};

  const visibility =
    info?.activity_visibility ??
    info?.visibility ??
    raw?.activity_visibility ??
    raw?.visibility ??
    "public";

  const status =
    info?.activity_status ??
    info?.status ??
    raw?.activity_status ??
    raw?.status ??
    "draft";

  const isOpenEnded = Boolean(
    info?.is_open_ended ??
    raw?.is_open_ended ??
    false
  );

  const hours = Number(
    info?.activity_hours ??
    info?.hours ??
    raw?.activity_hours ??
    raw?.hours ??
    0
  );

  const maxParticipants = Number(
    info?.activity_max_participants ??
    info?.max_participants ??
    raw?.activity_max_participants ??
    raw?.max_participants ??
    0
  );

  const enrollStart = splitIsoDateTime(
    info?.activity_enroll_start_at ??
    info?.enroll_start_at ??
    raw?.activity_enroll_start_at ??
    raw?.enroll_start_at ??
    ""
  );

  const enrollEnd = splitIsoDateTime(
    info?.activity_enroll_end_at ??
    info?.enroll_end_at ??
    raw?.activity_enroll_end_at ??
    raw?.enroll_end_at ??
    ""
  );

  const runStart = splitIsoDateTime(
    info?.activity_start_at ??
    info?.run_start_at ??
    raw?.activity_start_at ??
    raw?.run_start_at ??
    ""
  );

  const runEnd = splitIsoDateTime(
    info?.activity_end_at ??
    info?.run_end_at ??
    raw?.activity_end_at ??
    raw?.run_end_at ??
    ""
  );

  const meetingType = String(meetingInfo?.type ?? "onsite").toLowerCase();
  const meetingLocation = String(meetingInfo?.location ?? "");
  const qrCodeValue = String(meetingInfo?.qrcode_checkin ?? "") || createRandomQrCodeValue();

  const selectedPlace: SelectedPlaceState | null =
    meetingType === "onsite" && meetingLocation
      ? {
        displayText: meetingLocation,
        placeName: meetingLocation,
        formattedAddress: meetingLocation,
        detailText: meetingLocation,
        latitude: null,
        longitude: null,
        googleMapsUri: "",
      }
      : null;

  return {
    defaults: {
      activityTitle: String(info?.activity_name ?? raw?.activity_name ?? ""),
      description: normalizeTextValue(
        info?.activity_detail ??
        raw?.activity_detail ??
        raw?.description ??
        ""
      ),
      onsiteLocation: meetingType === "onsite" ? meetingLocation : "",
      onlineLink: meetingType === "online" ? meetingLocation : "",
      speakerNames: String(meetingInfo?.speaker ?? ""),
      speakerBio: String(meetingInfo?.speaker_position ?? ""),
      enrollmentStartDate: enrollStart.date,
      enrollmentStartTime: enrollStart.time,
      enrollmentEndDate: enrollEnd.date,
      enrollmentEndTime: enrollEnd.time,
      activityStartDate: runStart.date,
      activityStartTime: runStart.time,
      activityEndDate: runEnd.date,
      activityEndTime: runEnd.time,
      maxParticipants: String(Number.isFinite(maxParticipants) ? maxParticipants : 0),
      xpReward: String(Number.isFinite(hours) ? hours : 0),
      badgeButtonText: FORM_DEFAULTS.badgeButtonText,
      certificateButtonText: FORM_DEFAULTS.certificateButtonText,
      qrCodeValue,
    } as MeetingFormDefaults,
    selectedStatus: String(status).toLowerCase() === "published" ? "publish" : "draft",
    selectedAudience: String(visibility).toLowerCase() === "public" ? "everyone" : "invitedOnly",
    selectedParticipation: isOpenEnded ? "joinAnytime" : "scheduledParticipation",
    selectedLocation: meetingType === "online" ? "online" : "onsite",
    initialSkills: normalizeLoadedSkills(raw, info),
    initialSelectedPlace: selectedPlace,
    initialUnlimited: maxParticipants <= 0,
    enrollmentRange: {
      startDate: enrollStart.date,
      startTime: enrollStart.time,
      endDate: enrollEnd.date,
      endTime: enrollEnd.time,
    },
    activityRange: {
      startDate: runStart.date,
      startTime: runStart.time,
      endDate: runEnd.date,
      endTime: runEnd.time,
    },
  } as const;
}

async function fetchNormalizedActivitySkills(activityId: string): Promise<SkillProgressItem[]> {
  const response = await fetch(`/api/organization/activity/${encodeURIComponent(activityId)}/skills`, {
    method: "GET",
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.ok) {
    throw new Error(data?.message || `Failed to load activity skills (${response.status})`);
  }

  const list = Array.isArray(data?.skills) ? data.skills : [];

  return list.map((skill: ActivitySkillApiItem, index: number) => ({
    id: skill.id || `loaded-skill-${index}`,
    skillId: String(skill.skill_id || "").trim(),
    skillName: String(skill.skill_name || "").trim(),
    skillCategory: String(skill.skill_category || "").trim(),
    skillLevel:
      String(skill.skill_level_label || "").trim() ||
      normalizeSkillLevelLabel(skill.skill_level_value),
  }));
}

/* =========================
   Google Maps Place Search
========================= */
declare global {
  interface Window {
    google?: any;
    __googleMapsPlacesLoaderPromise?: Promise<any>;
  }
}

const GOOGLE_MAPS_SCRIPT_ID = "activity-meeting-google-maps-script";

function loadGoogleMapsPlacesApi() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser."));
  }
  if (window.google?.maps?.importLibrary) {
    return Promise.resolve(window.google);
  }
  if (window.__googleMapsPlacesLoaderPromise) {
    return window.__googleMapsPlacesLoaderPromise;
  }
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(new Error("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"));
  }
  window.__googleMapsPlacesLoaderPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID) as HTMLScriptElement | null;
    const handleResolve = () => {
      if (window.google?.maps?.importLibrary) {
        resolve(window.google);
      } else {
        reject(new Error("Google Maps loaded but importLibrary is unavailable."));
      }
    };
    const handleReject = () => {
      reject(new Error("Failed to load Google Maps JavaScript API."));
    };
    if (existingScript) {
      existingScript.addEventListener("load", handleResolve, { once: true });
      existingScript.addEventListener("error", handleReject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly&loading=async&language=th&region=TH`;
    script.addEventListener("load", handleResolve, { once: true });
    script.addEventListener("error", handleReject, { once: true });
    document.head.appendChild(script);
  });
  return window.__googleMapsPlacesLoaderPromise;
}

function getAddressComponentText(components: any[] | undefined, typeName: string) {
  if (!Array.isArray(components)) return "";
  const matched = components.find((component) =>
    Array.isArray(component?.types) ? component.types.includes(typeName) : false
  );
  return matched?.longText || matched?.shortText || "";
}

function joinUniqueText(parts: Array<string | undefined | null>) {
  const cleaned = parts
    .map((value) => (value || "").trim())
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index);
  return cleaned.join(", ");
}

function normalizeSelectedPlace(place: any): SelectedPlaceState {
  const components = Array.isArray(place?.addressComponents) ? place.addressComponents : [];
  const detailText = joinUniqueText([
    getAddressComponentText(components, "premise"),
    getAddressComponentText(components, "subpremise"),
    getAddressComponentText(components, "floor"),
    getAddressComponentText(components, "room"),
    getAddressComponentText(components, "street_number"),
    getAddressComponentText(components, "route"),
    getAddressComponentText(components, "sublocality_level_1"),
    getAddressComponentText(components, "locality"),
  ]);
  const placeName = place?.displayName || "";
  const formattedAddress = place?.formattedAddress || "";
  const location = place?.location;
  const fallbackDetailText = detailText || formattedAddress || "";
  const displayText = joinUniqueText([placeName, fallbackDetailText]).replace(/, /g, " — ");
  return {
    displayText,
    placeName,
    formattedAddress,
    detailText: fallbackDetailText,
    latitude: typeof location?.lat === "function" ? location.lat() : null,
    longitude: typeof location?.lng === "function" ? location.lng() : null,
    googleMapsUri: place?.googleMapsURI || "",
  };
}

/* =========================
   Small Reusable UI
========================= */
function SectionCard({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <section className={`${styles.panel} ${className}`}>{children}</section>;
}

function CheckBoxIcon({ checked }: { checked: boolean }) {
  return (
    <span className={`${styles.checkBox} ${checked ? styles.checkBoxChecked : ""}`} aria-hidden="true">
      {checked ? "✓" : ""}
    </span>
  );
}

/* =========================
   QR Code Preview
========================= */
function CheckInQrPreview({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    import("qrcode").then((QRCode) => {
      QRCode.toCanvas(canvasRef.current!, value, {
        width: 160,
        margin: 2,
        color: { dark: "#111111", light: "#ffffff" },
      });
    });
  }, [value]);

  return (
    <div className={styles.checkInBlock}>
      <div className={styles.checkInTitle}>Check-in</div>
      <div className={styles.qrPreviewCard}>
        <canvas ref={canvasRef} />
        <div className={styles.qrCodeLabel}>Generated QR Code</div>
        <div className={styles.qrCodeValue}>{value}</div>
      </div>
    </div>
  );
}

/* =========================
   Content Sections
========================= */
function ActivityTypeSelector({
  selectedType,
  onSelectType,
}: {
  selectedType: ActivityKind;
  onSelectType: (value: ActivityKind) => void;
}) {
  return (
    <SectionCard className={styles.typePanel}>
      <div className={styles.segmentGrid}>
        {ACTIVITY_TYPE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`${styles.segmentButton} ${selectedType === option.value ? styles.segmentButtonActive : ""}`}
            onClick={() => onSelectType(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </SectionCard>
  );
}

function ActivityInformationSection({
  activityTitleRef,
  descriptionRef,
  defaultActivityTitle,
  defaultDescription,
}: {
  activityTitleRef: React.RefObject<HTMLInputElement | null>;
  descriptionRef: React.RefObject<HTMLTextAreaElement | null>;
  defaultActivityTitle: string;
  defaultDescription: string;
}) {
  return (
    <SectionCard className={styles.infoPanel}>
      <label className={styles.labelText}>Activity Title</label>
      <input
        ref={activityTitleRef}
        className={styles.largeInput}
        placeholder="Activity Title"
        defaultValue={defaultActivityTitle}
      />
      <label className={styles.labelText}>Description</label>
      <textarea
        ref={descriptionRef}
        className={styles.descriptionTextarea}
        placeholder="Description"
        defaultValue={defaultDescription}
      />
    </SectionCard>
  );
}

function LocationAndSpeakerSection({
  selectedLocation,
  onSelectLocation,
  onsiteLocationRef,
  onlineLinkRef,
  speakerNamesRef,
  speakerBioRef,
  selectedPlaceRef,
  qrCodeValue,
  defaultOnsiteLocation,
  defaultOnlineLink,
  defaultSpeakerNames,
  defaultSpeakerBio,
  defaultSelectedPlace,
}: {
  selectedLocation: AttendanceLocation;
  onSelectLocation: (value: AttendanceLocation) => void;
  onsiteLocationRef: React.RefObject<HTMLInputElement | null>;
  onlineLinkRef: React.RefObject<HTMLInputElement | null>;
  speakerNamesRef: React.RefObject<HTMLInputElement | null>;
  speakerBioRef: React.RefObject<HTMLTextAreaElement | null>;
  selectedPlaceRef: React.MutableRefObject<SelectedPlaceState | null>;
  qrCodeValue: string;
  defaultOnsiteLocation: string;
  defaultOnlineLink: string;
  defaultSpeakerNames: string;
  defaultSpeakerBio: string;
  defaultSelectedPlace: SelectedPlaceState | null;
}) {
  const [onsiteLocationInput, setOnsiteLocationInput] = useState(defaultOnsiteLocation);
  const [onlineLink, setOnlineLink] = useState(defaultOnlineLink);
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestionItem[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [placeSearchError, setPlaceSearchError] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlaceState | null>(defaultSelectedPlace);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const autocompleteSessionTokenRef = useRef<any | null>(null);
  const latestRequestIdRef = useRef(0);
  const shouldSkipNextSearchRef = useRef(false);
  const blurTimerRef = useRef<number | null>(null);

  useEffect(() => {
    selectedPlaceRef.current = selectedPlace;
  }, [selectedPlace, selectedPlaceRef]);

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (selectedLocation !== "onsite") {
      setIsDropdownOpen(false);
      return;
    }
    if (shouldSkipNextSearchRef.current) {
      shouldSkipNextSearchRef.current = false;
      return;
    }
    const keyword = onsiteLocationInput.trim();
    if (keyword.length < 2) {
      setPlaceSuggestions([]);
      setPlaceSearchError("");
      setIsSearchingPlaces(false);
      return;
    }
    const timeoutId = window.setTimeout(async () => {
      const requestId = latestRequestIdRef.current + 1;
      latestRequestIdRef.current = requestId;
      try {
        setIsSearchingPlaces(true);
        setPlaceSearchError("");
        const google = await loadGoogleMapsPlacesApi();
        const placesLibrary = await google.maps.importLibrary("places");
        const AutocompleteSessionToken = placesLibrary.AutocompleteSessionToken;
        const AutocompleteSuggestion = placesLibrary.AutocompleteSuggestion;
        if (!autocompleteSessionTokenRef.current) {
          autocompleteSessionTokenRef.current = new AutocompleteSessionToken();
        }
        const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: keyword,
          language: "th",
          region: "th",
          sessionToken: autocompleteSessionTokenRef.current,
        });
        if (requestId !== latestRequestIdRef.current) return;
        const nextSuggestions = Array.isArray(response?.suggestions)
          ? response.suggestions
            .map((suggestion: any, index: number) => {
              const placePrediction = suggestion?.placePrediction;
              if (!placePrediction) return null;
              const label = placePrediction.text?.toString?.() || "";
              return { id: `${label}-${index}`, label, placePrediction };
            })
            .filter(Boolean)
          : [];
        setPlaceSuggestions(nextSuggestions as PlaceSuggestionItem[]);
        setIsDropdownOpen(true);
      } catch (error: any) {
        if (requestId !== latestRequestIdRef.current) return;
        setPlaceSuggestions([]);
        setPlaceSearchError(error?.message || "Failed to search places from Google Maps.");
      } finally {
        if (requestId === latestRequestIdRef.current) setIsSearchingPlaces(false);
      }
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [onsiteLocationInput, selectedLocation]);

  const handleSelectSuggestion = async (suggestion: PlaceSuggestionItem) => {
    try {
      setIsSearchingPlaces(true);
      setPlaceSearchError("");
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ["displayName", "formattedAddress", "addressComponents", "location", "googleMapsURI"],
      });
      const normalizedPlace = normalizeSelectedPlace(place);
      shouldSkipNextSearchRef.current = true;
      autocompleteSessionTokenRef.current = null;
      setSelectedPlace(normalizedPlace);
      setOnsiteLocationInput(normalizedPlace.displayText || suggestion.label);
      setPlaceSuggestions([]);
      setIsDropdownOpen(false);
    } catch (error: any) {
      setPlaceSearchError(error?.message || "Failed to load selected place details.");
    } finally {
      setIsSearchingPlaces(false);
    }
  };

  const handleOnsiteInputChange = (value: string) => {
    setOnsiteLocationInput(value);
    setIsDropdownOpen(true);
    if (selectedPlace && value !== selectedPlace.displayText) setSelectedPlace(null);
  };

  const clearSelectedPlace = () => {
    autocompleteSessionTokenRef.current = null;
    setSelectedPlace(null);
    setOnsiteLocationInput("");
    setPlaceSuggestions([]);
    setPlaceSearchError("");
    setIsDropdownOpen(false);
  };

  return (
    <SectionCard className={styles.detailsPanel}>
      <div className={styles.locationBlock}>
        <div className={styles.locationRow}>
          <button type="button" className={styles.locationChoice} onClick={() => onSelectLocation("onsite")}>
            <CheckBoxIcon checked={selectedLocation === "onsite"} />
            <span>On-site</span>
          </button>
          <div className={styles.locationFieldWrap}>
            <div className={styles.locationInputWrap}>
              <input
                ref={onsiteLocationRef}
                className={`${styles.standardInput} ${selectedLocation !== "onsite" ? styles.locationInputDisabled : ""}`}
                placeholder="Search building, office, campus, floor, room"
                value={onsiteLocationInput}
                onChange={(event) => handleOnsiteInputChange(event.target.value)}
                onFocus={() => {
                  if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current);
                  if (selectedLocation === "onsite") setIsDropdownOpen(true);
                }}
                onClick={() => {
                  if (selectedLocation !== "onsite") onSelectLocation("onsite");
                  setIsDropdownOpen(true);
                }}
                onBlur={() => {
                  blurTimerRef.current = window.setTimeout(() => setIsDropdownOpen(false), 150);
                }}
                disabled={selectedLocation !== "onsite"}
              />
              {selectedLocation === "onsite" && isDropdownOpen ? (
                <div className={styles.placeSearchDropdown}>
                  {isSearchingPlaces ? (
                    <div className={styles.placeSearchState}>Searching places...</div>
                  ) : placeSearchError ? (
                    <div className={styles.placeSearchError}>{placeSearchError}</div>
                  ) : onsiteLocationInput.trim().length < 2 ? (
                    <div className={styles.placeSearchState}>Type at least 2 characters to search Google Maps.</div>
                  ) : placeSuggestions.length === 0 ? (
                    <div className={styles.placeSearchState}>No places found</div>
                  ) : (
                    placeSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        className={styles.placeSuggestionButton}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleSelectSuggestion(suggestion)}
                      >
                        <div className={styles.placeSuggestionTitle}>{suggestion.label}</div>
                        <div className={styles.placeSuggestionHint}>Select to fill place name and address details</div>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>

            <div className={styles.locationHelperText}>
              Search from Google Maps, then the field will store the place name and address details automatically.
            </div>

            {selectedLocation === "onsite" && selectedPlace ? (
              <div className={styles.selectedPlaceCard}>
                <div className={styles.selectedPlaceHeader}>
                  <div>
                    <div className={styles.selectedPlaceTitle}>{selectedPlace.placeName || "Selected place"}</div>
                    <div className={styles.selectedPlaceDetail}>
                      {selectedPlace.detailText || selectedPlace.formattedAddress}
                    </div>
                  </div>
                  <button type="button" className={styles.clearSelectedPlaceButton} onClick={clearSelectedPlace}>
                    Clear
                  </button>
                </div>
                {selectedPlace.formattedAddress ? (
                  <div className={styles.selectedPlaceMeta}>Full address: {selectedPlace.formattedAddress}</div>
                ) : null}
                {selectedPlace.latitude !== null && selectedPlace.longitude !== null ? (
                  <div className={styles.selectedPlaceMeta}>
                    Coordinates: {selectedPlace.latitude.toFixed(6)}, {selectedPlace.longitude.toFixed(6)}
                  </div>
                ) : null}
                {selectedPlace.googleMapsUri ? (
                  <a href={selectedPlace.googleMapsUri} target="_blank" rel="noreferrer" className={styles.selectedPlaceLink}>
                    Open in Google Maps
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className={styles.locationRow}>
          <button type="button" className={styles.locationChoice} onClick={() => onSelectLocation("online")}>
            <CheckBoxIcon checked={selectedLocation === "online"} />
            <span>Online</span>
          </button>
          <input
            ref={onlineLinkRef}
            className={`${styles.standardInput} ${selectedLocation !== "online" ? styles.locationInputDisabled : ""}`}
            placeholder="Link"
            value={onlineLink}
            onChange={(event) => setOnlineLink(event.target.value)}
            disabled={selectedLocation !== "online"}
          />
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.formBlock}>
        <label className={styles.sectionTitle}>Speakers/Hosts</label>
        <input
          ref={speakerNamesRef}
          className={styles.fullWidthInput}
          placeholder="Speaker name"
          defaultValue={defaultSpeakerNames}
        />
      </div>

      <div className={styles.formBlock}>
        <label className={styles.sectionTitle}>Position/Bio</label>
        <textarea
          ref={speakerBioRef}
          className={styles.bioTextarea}
          placeholder="Position or bio"
          defaultValue={defaultSpeakerBio}
        />
      </div>

      <CheckInQrPreview value={qrCodeValue || "Generating..."} />
    </SectionCard>
  );
}

function ActivityStatusSection({
  selectedStatus,
  onSelectStatus,
}: {
  selectedStatus: ActivityStatus;
  onSelectStatus: (value: ActivityStatus) => void;
}) {
  return (
    <SectionCard className={styles.actionPanel}>
      <div className={styles.actionGrid}>
        <button
          type="button"
          className={`${styles.actionButton} ${selectedStatus === "draft" ? styles.statusButtonActive : styles.statusButtonInactive}`}
          onClick={() => onSelectStatus("draft")}
        >
          <Image src="/images/icons/draft-icon.png" alt="Draft status" width={40} height={40} className={styles.actionIcon} />
          <span>Draft</span>
        </button>
        <button
          type="button"
          className={`${styles.actionButton} ${selectedStatus === "publish" ? styles.statusButtonActive : styles.statusButtonInactive}`}
          onClick={() => onSelectStatus("publish")}
        >
          <Image src="/images/icons/publish-icon.png" alt="Publish status" width={40} height={40} className={styles.actionIcon} />
          <span>Publish</span>
        </button>
      </div>
    </SectionCard>
  );
}

function AddSkillModal({
  isOpen,
  formValue,
  availableSkills,
  isLoadingSkills,
  loadError,
  selectedSkillIds,
  onChange,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  formValue: SkillFormValue;
  availableSkills: SkillOption[];
  isLoadingSkills: boolean;
  loadError: string;
  selectedSkillIds: string[];
  onChange: (nextValue: SkillFormValue) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const [isSkillDropdownOpen, setIsSkillDropdownOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) setIsSkillDropdownOpen(false);
  }, [isOpen]);

  const filteredSkills = useMemo(() => {
    const keyword = formValue.searchText.trim().toLowerCase();

    return availableSkills
      .filter((skill) => !selectedSkillIds.includes(skill.skillId))
      .filter((skill) => {
        if (!keyword) return true;
        const name = skill.skillName.toLowerCase();
        const category = skill.skillCategory.toLowerCase();
        return name.includes(keyword) || category.includes(keyword);
      })
      .slice(0, 10);
  }, [availableSkills, formValue.searchText, selectedSkillIds]);

  const shouldShowDropdown =
    isSkillDropdownOpen && !formValue.selectedSkillId;

  if (!isOpen) return null;

  return (
    <div className={styles.skillModalOverlay} onClick={onClose}>
      <div className={styles.skillModalCard} onClick={(event) => event.stopPropagation()}>
        <div className={styles.skillModalTitle}>Add skill reward</div>

        <div className={styles.skillModalField}>
          <label className={styles.skillModalLabel}>Skill Name</label>

          <div className={styles.skillSearchFieldWrap}>
            <input
              className={styles.skillModalInput}
              value={formValue.searchText}
              onFocus={() => setIsSkillDropdownOpen(true)}
              onClick={() => setIsSkillDropdownOpen(true)}
              onBlur={() => {
                window.setTimeout(() => setIsSkillDropdownOpen(false), 120);
              }}
              onChange={(event) =>
                onChange({
                  ...formValue,
                  searchText: event.target.value,
                  selectedSkillId: "",
                  selectedSkillName: "",
                  selectedSkillCategory: "",
                })
              }
              placeholder="Click or type to search skill"
            />
            {shouldShowDropdown && (
              <div className={styles.skillSearchResultBox}>
                {isLoadingSkills ? (
                  <div className={styles.skillSearchState}>Loading skills...</div>
                ) : loadError ? (
                  <div className={styles.skillSearchError}>{loadError}</div>
                ) : filteredSkills.length === 0 ? (
                  <div className={styles.skillSearchState}>No skills found</div>
                ) : (
                  filteredSkills.map((skill) => {
                    const isSelected = formValue.selectedSkillId === skill.skillId;

                    return (
                      <button
                        key={skill.skillId}
                        type="button"
                        className={`${styles.skillSearchItem} ${isSelected ? styles.skillSearchItemActive : ""
                          }`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          onChange({
                            ...formValue,
                            searchText: skill.skillName,
                            selectedSkillId: skill.skillId,
                            selectedSkillName: skill.skillName,
                            selectedSkillCategory: skill.skillCategory,
                          });
                          setIsSkillDropdownOpen(false);
                        }}
                      >
                        <div className={styles.skillSearchItemName}>
                          {skill.skillName}
                        </div>
                        <div className={styles.skillSearchItemCategory}>
                          {skill.skillCategory}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        <div className={styles.selectedSkillSummary}>
          {formValue.selectedSkillName ? (
            <>
              Selected: <strong>{formValue.selectedSkillName}</strong>
              {formValue.selectedSkillCategory
                ? ` (${formValue.selectedSkillCategory})`
                : ""}
            </>
          ) : (
            "No skill selected"
          )}
        </div>

        <div className={styles.skillModalField}>
          <label className={styles.skillModalLabel}>Level</label>
          <select
            className={styles.skillModalSelect}
            value={formValue.skillLevel}
            onChange={(event) =>
              onChange({ ...formValue, skillLevel: event.target.value })
            }
          >
            {SKILL_LEVEL_OPTIONS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.skillModalActions}>
          <button
            type="button"
            className={styles.skillModalSecondaryButton}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.skillModalPrimaryButton}
            onClick={onSubmit}
            disabled={!formValue.selectedSkillId}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

function RewardUploadBox({
  title,
  inputId,
  upload,
  onFileChange,
  onClear,
}: {
  title: string;
  inputId: string;
  upload: UploadPreviewState;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) {
  const isPdf = upload.mimeType === "application/pdf";
  return (
    <div className={styles.rewardUploadWrap}>
      <input id={inputId} type="file" accept="image/*,application/pdf" className={styles.hiddenFileInput} onChange={onFileChange} />
      <label htmlFor={inputId} className={styles.uploadButton}>
        {upload.file ? (
          <div className={styles.rewardPreviewContent}>
            {isPdf ? (
              <iframe src={`${upload.previewUrl}#toolbar=0&navpanes=0&scrollbar=0`} className={styles.rewardPreviewPdf} title={`${title} preview`} />
            ) : (
              <img src={upload.previewUrl} alt={`${title} preview`} className={styles.rewardPreviewImage} />
            )}
            <div className={styles.rewardPreviewOverlay}>
              <span className={styles.rewardPreviewName} title={upload.fileName}>
                {upload.fileName}
              </span>
            </div>
          </div>
        ) : (
          <span>upload</span>
        )}
      </label>
      {upload.file ? (
        <button type="button" className={styles.clearUploadButton} onClick={onClear} aria-label={`Remove ${title} file`} title="Remove file">
          ×
        </button>
      ) : null}
    </div>
  );
}

type SkillsRewardsHandle = {
  getSkillItems: () => SkillProgressItem[];
  getXpValue: () => string;
};

function SkillsAndRewardsSection({
  innerRef,
  defaultSkillItems,
  defaultXpValue,
}: {
  innerRef?: React.MutableRefObject<SkillsRewardsHandle | null>;
  defaultSkillItems: SkillProgressItem[];
  defaultXpValue: string;
}) {
  const [skillItems, setSkillItems] = useState<SkillProgressItem[]>(defaultSkillItems);
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [availableSkills, setAvailableSkills] = useState<SkillOption[]>([]);
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);
  const [skillLoadError, setSkillLoadError] = useState("");
  const [badgeUpload, setBadgeUpload] = useState<UploadPreviewState>(createEmptyUploadState());
  const [certificateUpload, setCertificateUpload] = useState<UploadPreviewState>(createEmptyUploadState());
  const [rewardUploadError, setRewardUploadError] = useState("");
  const xpRef = useRef<HTMLInputElement>(null);

  const [skillFormValue, setSkillFormValue] = useState<SkillFormValue>({
    searchText: "",
    selectedSkillId: "",
    selectedSkillName: "",
    selectedSkillCategory: "",
    skillLevel: SKILL_LEVEL_OPTIONS[0],
  });

  useEffect(() => {
    setSkillItems(defaultSkillItems);
  }, [defaultSkillItems]);

  useEffect(() => {
    if (innerRef) {
      innerRef.current = {
        getSkillItems: () => skillItems,
        getXpValue: () => xpRef.current?.value || defaultXpValue || FORM_DEFAULTS.xpReward,
      };
    }
  }, [innerRef, skillItems, defaultXpValue]);

  useEffect(() => {
    let isCancelled = false;

    async function loadSkills() {
      setIsLoadingSkills(true);
      setSkillLoadError("");

      try {
        const response = await fetch("/api/organization/activity/skills", {
          method: "GET",
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok || !data?.ok) {
          throw new Error(data?.message || "Failed to load skills");
        }

        const nextSkills = Array.isArray(data.skills) ? data.skills : [];

        if (!isCancelled) {
          setAvailableSkills(nextSkills);
          setSkillItems((previous) => hydrateSkillItemsWithCatalog(previous, nextSkills));
        }
      } catch (error: any) {
        if (!isCancelled) {
          setSkillLoadError(error?.message || "Failed to load skills");
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingSkills(false);
        }
      }
    }

    loadSkills();

    return () => {
      isCancelled = true;
    };
  }, []);

  const selectedSkillIds = useMemo(() => {
    return skillItems
      .map((skill) => skill.skillId || "")
      .filter(Boolean);
  }, [skillItems]);

  const resetSkillForm = () => {
    setSkillFormValue({
      searchText: "",
      selectedSkillId: "",
      selectedSkillName: "",
      selectedSkillCategory: "",
      skillLevel: SKILL_LEVEL_OPTIONS[0],
    });
  };

  const handleRewardFileChange =
    (setter: Dispatch<SetStateAction<UploadPreviewState>>) =>
      (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const isSupported =
          file.type.startsWith("image/") || file.type === "application/pdf";

        if (!isSupported) {
          setRewardUploadError("Upload only image files or PDF files.");
          event.target.value = "";
          return;
        }

        const nextPreviewUrl = URL.createObjectURL(file);

        setter((previous) => {
          if (previous.previewUrl) URL.revokeObjectURL(previous.previewUrl);
          return {
            file,
            previewUrl: nextPreviewUrl,
            mimeType: file.type,
            fileName: file.name,
          };
        });

        setRewardUploadError("");
        event.target.value = "";
      };

  const clearRewardUpload =
    (setter: Dispatch<SetStateAction<UploadPreviewState>>) => () => {
      setter((previous) => {
        if (previous.previewUrl) URL.revokeObjectURL(previous.previewUrl);
        return createEmptyUploadState();
      });
    };

  useEffect(() => {
    return () => {
      if (badgeUpload.previewUrl) URL.revokeObjectURL(badgeUpload.previewUrl);
      if (certificateUpload.previewUrl) URL.revokeObjectURL(certificateUpload.previewUrl);
    };
  }, [badgeUpload.previewUrl, certificateUpload.previewUrl]);

  const handleAddSkill = () => {
    if (!skillFormValue.selectedSkillId) return;

    const isDuplicate = skillItems.some(
      (skill) => skill.skillId === skillFormValue.selectedSkillId
    );
    if (isDuplicate) {
      resetSkillForm();
      setIsSkillModalOpen(false);
      return;
    }

    setSkillItems((previous) => [
      ...previous,
      {
        id: `skill-${Date.now()}`,
        skillId: skillFormValue.selectedSkillId,
        skillName: skillFormValue.selectedSkillName,
        skillCategory: skillFormValue.selectedSkillCategory,
        skillLevel: skillFormValue.skillLevel,
      },
    ]);

    resetSkillForm();
    setIsSkillModalOpen(false);
  };

  const handleRemoveSkill = (skillIdToRemove: string) => {
    setSkillItems((previous) =>
      previous.filter((skill) => skill.id !== skillIdToRemove)
    );
  };

  return (
    <>
      <SectionCard className={styles.rewardsPanel}>
        {skillItems.length > 0 ? (
          <div className={styles.rewardsHeader}>
            <div className={styles.rewardsTitle}>Skills</div>
            <button
              type="button"
              className={styles.addSkillButton}
              onClick={() => setIsSkillModalOpen(true)}
            >
              <Image
                src="/images/icons/button05-icon.png"
                alt="Add skill"
                width={50}
                height={50}
                className={styles.addSkillIcon}
              />
            </button>
          </div>
        ) : (
          <div className={styles.rewardsHeaderEmpty}>
            <div className={styles.rewardsTitle}>Skills</div>
          </div>
        )}

        {skillItems.length > 0 ? (
          <div className={styles.skillList}>
            {skillItems.map((skill) => (
              <div className={styles.skillRow} key={skill.id}>
                <div className={styles.skillName}>
                  {skill.skillName || "Unknown skill"}
                </div>
                <div className={styles.skillLevel}>{skill.skillLevel}</div>
                <button
                  type="button"
                  className={styles.removeSkillButton}
                  onClick={() => handleRemoveSkill(skill.id)}
                  aria-label={`Remove ${skill.skillName || "skill"}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.skillListEmpty}>
            <button
              type="button"
              className={styles.addSkillButtonCenter}
              onClick={() => setIsSkillModalOpen(true)}
            >
              <Image
                src="/images/icons/button05-icon.png"
                alt="Add skill"
                width={50}
                height={50}
                className={styles.addSkillIcon}
              />
            </button>
          </div>
        )}

        <div className={styles.rewardStatsGrid}>
          <div className={styles.rewardCell}>
            <div className={styles.rewardTitle}>XP</div>
            <input
              ref={xpRef}
              className={styles.xpValueBox}
              defaultValue={defaultXpValue}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              onInput={(event) => {
                event.currentTarget.value = event.currentTarget.value.replace(/\D+/g, "");
              }}
            />
          </div>

          <div className={styles.rewardCell}>
            <div className={styles.rewardTitle}>Badges</div>
            <RewardUploadBox
              title="Badge"
              inputId="badge-upload-input"
              upload={badgeUpload}
              onFileChange={handleRewardFileChange(setBadgeUpload)}
              onClear={clearRewardUpload(setBadgeUpload)}
            />
          </div>

          <div className={styles.rewardCell}>
            <div className={styles.rewardTitle}>Certificate</div>
            <RewardUploadBox
              title="Certificate"
              inputId="certificate-upload-input"
              upload={certificateUpload}
              onFileChange={handleRewardFileChange(setCertificateUpload)}
              onClear={clearRewardUpload(setCertificateUpload)}
            />
          </div>
        </div>

        {rewardUploadError ? (
          <div className={styles.rewardUploadError}>{rewardUploadError}</div>
        ) : null}
      </SectionCard>

      <AddSkillModal
        isOpen={isSkillModalOpen}
        formValue={skillFormValue}
        availableSkills={availableSkills}
        isLoadingSkills={isLoadingSkills}
        loadError={skillLoadError}
        selectedSkillIds={selectedSkillIds}
        onChange={(nextValue) => setSkillFormValue(nextValue)}
        onClose={() => {
          resetSkillForm();
          setIsSkillModalOpen(false);
        }}
        onSubmit={handleAddSkill}
      />
    </>
  );
}

function CalendarPopup({
  visibleMonth,
  startDate,
  endDate,
  onPreviousMonth,
  onNextMonth,
  onSelectDate,
}: {
  visibleMonth: Date;
  startDate: string;
  endDate: string;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (value: string) => void;
}) {
  const calendarCells = buildCalendarCells(visibleMonth);
  return (
    <div className={styles.calendarPopup}>
      <div className={styles.calendarHeader}>
        <button type="button" className={styles.calendarNavButton} onClick={onPreviousMonth}>
          ‹
        </button>
        <div className={styles.calendarMonthTitle}>{formatMonthTitle(visibleMonth)}</div>
        <button type="button" className={styles.calendarNavButton} onClick={onNextMonth}>
          ›
        </button>
      </div>
      <div className={styles.calendarWeekRow}>
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className={styles.calendarWeekLabel}>
            {d}
          </div>
        ))}
      </div>
      <div className={styles.calendarGrid}>
        {calendarCells.map((cell) => {
          const isStart = cell.iso === startDate;
          const isEnd = cell.iso === endDate;
          const isInRange = isDateInRange(cell.iso, startDate, endDate);
          return (
            <button
              key={cell.iso}
              type="button"
              className={[
                styles.calendarCell,
                !cell.isCurrentMonth ? styles.calendarCellOtherMonth : "",
                cell.isWeekend ? styles.calendarCellWeekend : "",
                isStart ? styles.calendarCellStart : "",
                isEnd ? styles.calendarCellEnd : "",
                isInRange && !isStart && !isEnd ? styles.calendarCellRange : "",
              ].join(" ")}
              onClick={() => onSelectDate(cell.iso)}
            >
              {cell.dayNumber}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TimePopup({ selectedTime, onSelectTime }: { selectedTime: string; onSelectTime: (value: string) => void }) {
  return (
    <div className={styles.timePopup}>
      <div className={styles.timeOptionList}>
        {TIME_OPTIONS.map((time) => (
          <button
            key={time}
            type="button"
            className={`${styles.timeOption} ${selectedTime === time ? styles.timeOptionSelected : ""}`}
            onClick={() => onSelectTime(time)}
          >
            {time}
          </button>
        ))}
      </div>
    </div>
  );
}

type DateRangeSectionProps = {
  title: string;
  startDateDefault: string;
  startTimeDefault: string;
  endDateDefault: string;
  endTimeDefault: string;
  onRangeChange?: (value: RangeValue) => void;
};

type ChainedPickerSide = "start" | "end" | null;
type ChainedPickerStep = "date" | "time";

function DateRangeSection({
  title,
  startDateDefault,
  startTimeDefault,
  endDateDefault,
  endTimeDefault,
  onRangeChange,
}: DateRangeSectionProps) {
  const [rangeValue, setRangeValue] = useState<RangeValue>({
    startDate: startDateDefault,
    startTime: startTimeDefault,
    endDate: endDateDefault,
    endTime: endTimeDefault,
  });
  const [openSide, setOpenSide] = useState<ChainedPickerSide>(null);
  const [pickerStep, setPickerStep] = useState<ChainedPickerStep>("date");
  const [flipUp, setFlipUp] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => {
    const initial = parseIsoDate(startDateDefault) ?? new Date();
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const startTriggerRef = useRef<HTMLButtonElement | null>(null);
  const endTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    onRangeChange?.(rangeValue);
  }, [onRangeChange, rangeValue]);

  useEffect(() => {
    if (!openSide) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (!sectionRef.current?.contains(e.target as Node)) setOpenSide(null);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenSide(null);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openSide]);

  const openChained = (side: "start" | "end") => {
    if (openSide === side) {
      setOpenSide(null);
      return;
    }
    const triggerEl = side === "start" ? startTriggerRef.current : endTriggerRef.current;
    if (triggerEl) {
      const rect = triggerEl.getBoundingClientRect();
      setFlipUp(window.innerHeight - rect.bottom < 420);
    }
    setOpenSide(side);
    setPickerStep("date");
  };

  const measureAndOpenTime = (side: "start" | "end") => {
    const triggerEl = side === "start" ? startTriggerRef.current : endTriggerRef.current;
    if (triggerEl) {
      const rect = triggerEl.getBoundingClientRect();
      setFlipUp(window.innerHeight - rect.bottom < 280);
    }
    setOpenSide(side);
    setPickerStep("time");
  };

  const handleSelectDate = (key: "startDate" | "endDate", value: string) => {
    const next = { ...rangeValue, [key]: value };
    setRangeValue(next);
    setPickerStep("time");
  };

  const handleSelectTime = (key: "startTime" | "endTime", value: string) => {
    const next = { ...rangeValue, [key]: value };
    setRangeValue(next);
    setOpenSide(null);
  };

  const renderChainedPopup = (side: "start" | "end", alignRight: boolean) => {
    const dateKey = side === "start" ? "startDate" : "endDate";
    const timeKey = side === "start" ? "startTime" : "endTime";
    const dateValue = rangeValue[dateKey];
    const timeValue = rangeValue[timeKey];
    const sideLabel = side === "start" ? "Start" : "End";

    return (
      <div
        className={[
          styles.floatingPicker,
          alignRight ? styles.floatingPickerRight : "",
          flipUp ? styles.floatingPickerUp : "",
        ].join(" ")}
      >
        <div className={styles.chainedPickerPopup}>
          <div className={styles.chainedPickerHeader}>
            {pickerStep === "time" && (
              <button type="button" className={styles.chainedPickerBack} onClick={() => setPickerStep("date")}>
                ‹
              </button>
            )}
            <span className={styles.chainedPickerTitle}>
              {sideLabel} — {pickerStep === "date" ? "Select date" : `${formatDateDisplay(dateValue)}, select time`}
            </span>
          </div>

          {pickerStep === "date" ? (
            <CalendarPopup
              visibleMonth={visibleMonth}
              startDate={rangeValue.startDate}
              endDate={rangeValue.endDate}
              onPreviousMonth={() => setVisibleMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))}
              onNextMonth={() => setVisibleMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))}
              onSelectDate={(value) => handleSelectDate(dateKey, value)}
            />
          ) : (
            <TimePopup selectedTime={timeValue} onSelectTime={(value) => handleSelectTime(timeKey, value)} />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.periodSection} ref={sectionRef}>
      <div className={styles.periodTitle}>{title}</div>

      <div className={styles.periodLabelRow}>
        <div className={styles.periodLabel}>Start</div>
        <div className={styles.periodLabelEnd}>End</div>
      </div>

      <div className={styles.periodInputRow}>
        <div className={styles.periodFieldWrap}>
          <button
            ref={startTriggerRef}
            type="button"
            className={`${styles.dateTriggerButton} ${openSide === "start" ? styles.triggerButtonActive : ""}`}
            onClick={() => openChained("start")}
          >
            {formatDateDisplay(rangeValue.startDate)}
          </button>
          {openSide === "start" && renderChainedPopup("start", false)}
        </div>

        <div className={styles.periodFieldWrap}>
          <button
            type="button"
            className={`${styles.timeTriggerButton} ${openSide === "start" && pickerStep === "time" ? styles.triggerButtonActive : ""}`}
            onClick={() => {
              measureAndOpenTime("start");
            }}
          >
            {rangeValue.startTime || "time"}
          </button>
        </div>

        <div className={styles.periodArrow}>→</div>

        <div className={styles.periodFieldWrap}>
          <button
            ref={endTriggerRef}
            type="button"
            className={`${styles.dateTriggerButton} ${openSide === "end" ? styles.triggerButtonActive : ""}`}
            onClick={() => openChained("end")}
          >
            {formatDateDisplay(rangeValue.endDate)}
          </button>
          {openSide === "end" && renderChainedPopup("end", true)}
        </div>

        <div className={styles.periodFieldWrap}>
          <button
            type="button"
            className={`${styles.timeTriggerButton} ${openSide === "end" && pickerStep === "time" ? styles.triggerButtonActive : ""}`}
            onClick={() => {
              measureAndOpenTime("end");
            }}
          >
            {rangeValue.endTime || "time"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AccessAndScheduleSection({
  selectedAudience,
  onSelectAudience,
  selectedParticipation,
  onSelectParticipation,
  enrollmentRangeRef,
  activityRangeRef,
  maxParticipantsRef,
  defaultMaxParticipants,
  defaultIsUnlimited,
  defaultEnrollmentRange,
  defaultActivityRange,
}: {
  selectedAudience: AudienceAccess;
  onSelectAudience: (value: AudienceAccess) => void;
  selectedParticipation: ParticipationMode;
  onSelectParticipation: (value: ParticipationMode) => void;
  enrollmentRangeRef: React.MutableRefObject<RangeValue>;
  activityRangeRef: React.MutableRefObject<RangeValue>;
  maxParticipantsRef: React.RefObject<HTMLInputElement | null>;
  defaultMaxParticipants: string;
  defaultIsUnlimited: boolean;
  defaultEnrollmentRange: RangeValue;
  defaultActivityRange: RangeValue;
}) {
  const [isUnlimited, setIsUnlimited] = useState(defaultIsUnlimited);

  return (
    <SectionCard className={styles.settingsPanel}>
      <div className={styles.accessGrid}>
        {AUDIENCE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`${styles.accessCard} ${selectedAudience === option.value ? styles.accessCardActive : ""}`}
            onClick={() => onSelectAudience(option.value)}
          >
            <div className={styles.accessTitle}>{option.label}</div>
          </button>
        ))}
      </div>

      <div className={styles.divider} />

      <div className={styles.joinModeGrid}>
        {PARTICIPATION_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`${styles.joinModeButton} ${selectedParticipation === option.value ? styles.joinModeButtonActive : ""}`}
            onClick={() => onSelectParticipation(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className={styles.divider} />

      <div className={styles.maxParticipantRow}>
        <div className={styles.maxParticipantGroup}>
          <label className={styles.maxParticipantLabel}>Max Participants</label>
          <input
            ref={maxParticipantsRef}
            className={styles.maxParticipantInput}
            defaultValue={defaultMaxParticipants}
            type="number"
            min="0"
            disabled={isUnlimited}
          />
        </div>
        <button type="button" className={styles.unlimitedToggle} onClick={() => setIsUnlimited((p) => !p)}>
          <CheckBoxIcon checked={isUnlimited} />
          <span>No</span>
        </button>
      </div>

      <div className={styles.divider} />

      <DateRangeSection
        title="Enrollment Period"
        startDateDefault={defaultEnrollmentRange.startDate}
        startTimeDefault={defaultEnrollmentRange.startTime}
        endDateDefault={defaultEnrollmentRange.endDate}
        endTimeDefault={defaultEnrollmentRange.endTime}
        onRangeChange={(v) => {
          enrollmentRangeRef.current = v;
        }}
      />

      <div className={styles.divider} />

      <DateRangeSection
        title="Activity Run Period"
        startDateDefault={defaultActivityRange.startDate}
        startTimeDefault={defaultActivityRange.startTime}
        endDateDefault={defaultActivityRange.endDate}
        endTimeDefault={defaultActivityRange.endTime}
        onRangeChange={(v) => {
          activityRangeRef.current = v;
        }}
      />
    </SectionCard>
  );
}

/* =========================
   API Submit Helper
========================= */
function buildIsoDateTime(date: string, time: string): string {
  if (!date) return "";
  const safeTime = /^\d{2}:\d{2}$/.test(time || "") ? time : "00:00";
  return `${date}T${safeTime}:00+07:00`;
}

function buildMeetingPayload(params: {
  activityTitle: string;
  description: string;
  selectedStatus: ActivityStatus;
  selectedLocation: AttendanceLocation;
  onsiteLocationInput: string;
  onlineLink: string;
  speakerNames: string;
  speakerBio: string;
  selectedAudience: AudienceAccess;
  selectedParticipation: ParticipationMode;
  maxParticipants: number;
  enrollmentRange: RangeValue;
  activityRange: RangeValue;
  skillItems: SkillProgressItem[];
  xpValue: number;
  selectedPlace: SelectedPlaceState | null;
  qrCodeValue: string;
}) {
  const {
    activityTitle,
    description,
    selectedStatus,
    selectedLocation,
    onsiteLocationInput,
    onlineLink,
    speakerNames,
    speakerBio,
    selectedAudience,
    selectedParticipation,
    maxParticipants,
    enrollmentRange,
    activityRange,
    skillItems,
    xpValue,
    selectedPlace,
    qrCodeValue,
  } = params;

  const visibilityMap: Record<AudienceAccess, string> = {
    everyone: "public",
    invitedOnly: "invited",
  };

  const meetingType = selectedLocation === "onsite" ? "onsite" : "online";

  return {
    activity_name: activityTitle,
    activity_detail: description,
    activity_type: "meeting",
    status: selectedStatus === "publish" ? "published" : "draft",
    visibility: visibilityMap[selectedAudience],
    hours: xpValue,
    max_participants: maxParticipants,
    is_open_ended: selectedParticipation === "joinAnytime",
    enroll_start_at: buildIsoDateTime(enrollmentRange.startDate, enrollmentRange.startTime),
    enroll_end_at: buildIsoDateTime(enrollmentRange.endDate, enrollmentRange.endTime),
    run_start_at: buildIsoDateTime(activityRange.startDate, activityRange.startTime),
    run_end_at: buildIsoDateTime(activityRange.endDate, activityRange.endTime),
    skills: skillItems
      .filter((s) => s.skillId)
      .map((s) => ({
        skill_id: s.skillId!,
        skill_level: SKILL_LEVEL_OPTIONS.indexOf(s.skillLevel),
      })),
    meeting_info: {
      type: meetingType,
      location: meetingType === "onsite" ? selectedPlace?.formattedAddress || onsiteLocationInput : onlineLink,
      speaker: speakerNames,
      speaker_position: speakerBio,
      qrcode_checkin: qrCodeValue || FORM_DEFAULTS.qrCodeValue,
    },
  };
}

/* =========================
   Main Page
========================= */
export default function ActivityMeeting() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const editActivityId = (searchParams.get("edit") || "").trim();
  const isEditMode = Boolean(editActivityId);

  const [selectedActivityType, setSelectedActivityType] = useState<ActivityKind>("meetings");
  const [selectedActivityStatus, setSelectedActivityStatus] = useState<ActivityStatus>("draft");
  const [selectedAudience, setSelectedAudience] = useState<AudienceAccess>("everyone");
  const [selectedParticipation, setSelectedParticipation] = useState<ParticipationMode>("scheduledParticipation");
  const [selectedLocation, setSelectedLocation] = useState<AttendanceLocation>("onsite");

  const [formDefaults, setFormDefaults] = useState<MeetingFormDefaults>({
    ...FORM_DEFAULTS,
    qrCodeValue: createRandomQrCodeValue(),
  });
  const [initialSkillItems, setInitialSkillItems] = useState<SkillProgressItem[]>([]);
  const [initialSelectedPlace, setInitialSelectedPlace] = useState<SelectedPlaceState | null>(null);
  const [initialUnlimited, setInitialUnlimited] = useState(false);
  const [formSeed, setFormSeed] = useState(0);

  const [isInitialLoading, setIsInitialLoading] = useState(isEditMode);
  const [initialLoadError, setInitialLoadError] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const activityTitleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const onsiteLocationRef = useRef<HTMLInputElement>(null);
  const onlineLinkRef = useRef<HTMLInputElement>(null);
  const speakerNamesRef = useRef<HTMLInputElement>(null);
  const speakerBioRef = useRef<HTMLTextAreaElement>(null);
  const maxParticipantsRef = useRef<HTMLInputElement>(null);
  const selectedPlaceRef = useRef<SelectedPlaceState | null>(null);
  const enrollmentRangeRef = useRef<RangeValue>({ startDate: "", startTime: "", endDate: "", endTime: "" });
  const activityRangeRef = useRef<RangeValue>({ startDate: "", startTime: "", endDate: "", endTime: "" });
  const skillsRewardsRef = useRef<SkillsRewardsHandle | null>(null);

  useEffect(() => {
    if (!isEditMode) {
      const generatedQr = createRandomQrCodeValue();
      setFormDefaults((prev) => ({ ...prev, qrCodeValue: generatedQr }));
      selectedPlaceRef.current = null;
      enrollmentRangeRef.current = {
        startDate: "",
        startTime: "",
        endDate: "",
        endTime: "",
      };
      activityRangeRef.current = {
        startDate: "",
        startTime: "",
        endDate: "",
        endTime: "",
      };
      return;
    }

    let cancelled = false;

    async function loadExistingActivity() {
      setIsInitialLoading(true);
      setInitialLoadError("");

      try {
        const [detailResponse, normalizedSkillItems] = await Promise.all([
          fetch(`/api/organization/activity/${encodeURIComponent(editActivityId)}`, {
            method: "GET",
            cache: "no-store",
          }).then(async (response) => {
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data?.ok) {
              throw new Error(data?.message || `Failed to load activity (${response.status})`);
            }
            return data;
          }),
          fetchNormalizedActivitySkills(editActivityId),
        ]);

        if (cancelled) return;

        const normalized = normalizeMeetingEditorData(detailResponse);

        setSelectedActivityType("meetings");
        setSelectedActivityStatus(normalized.selectedStatus);
        setSelectedAudience(normalized.selectedAudience);
        setSelectedParticipation(normalized.selectedParticipation);
        setSelectedLocation(normalized.selectedLocation);

        setFormDefaults(normalized.defaults);
        setInitialSkillItems(normalizedSkillItems.length ? normalizedSkillItems : normalized.initialSkills);
        setInitialSelectedPlace(normalized.initialSelectedPlace);
        setInitialUnlimited(normalized.initialUnlimited);

        selectedPlaceRef.current = normalized.initialSelectedPlace;
        enrollmentRangeRef.current = normalized.enrollmentRange;
        activityRangeRef.current = normalized.activityRange;

        setFormSeed((prev) => prev + 1);
      } catch (error: any) {
        if (!cancelled) {
          setInitialLoadError(error?.message || "Failed to load activity data.");
        }
      } finally {
        if (!cancelled) {
          setIsInitialLoading(false);
        }
      }
    }

    loadExistingActivity();

    return () => {
      cancelled = true;
    };
  }, [editActivityId, isEditMode]);

  const handleSelectActivityType = (value: ActivityKind) => {
    if (value === selectedActivityType) return;
    setSelectedActivityType(value);

    const nextRoute = ACTIVITY_ROUTE_MAP[value];
    if (editActivityId) {
      router.push(`${nextRoute}?edit=${encodeURIComponent(editActivityId)}`);
      return;
    }
    router.push(nextRoute);
  };

  const handleSubmit = async () => {
    setSubmitError("");
    setSubmitSuccess(false);

    const activityTitle = activityTitleRef.current?.value?.trim() || "";
    if (!activityTitle) {
      setSubmitError("Please fill in the Activity Title.");
      return;
    }

    setIsSubmitting(true);

    try {
      const skillItems = skillsRewardsRef.current?.getSkillItems() || [];
      const xpValue = Number(skillsRewardsRef.current?.getXpValue() || formDefaults.xpReward || FORM_DEFAULTS.xpReward);

      const payload = buildMeetingPayload({
        qrCodeValue: formDefaults.qrCodeValue,
        activityTitle,
        description: descriptionRef.current?.value?.trim() || "",
        selectedStatus: selectedActivityStatus,
        selectedLocation,
        onsiteLocationInput: onsiteLocationRef.current?.value?.trim() || "",
        onlineLink: onlineLinkRef.current?.value?.trim() || "",
        speakerNames: speakerNamesRef.current?.value?.trim() || "",
        speakerBio: speakerBioRef.current?.value?.trim() || "",
        selectedAudience,
        selectedParticipation,
        maxParticipants: Number(maxParticipantsRef.current?.value || 0),
        enrollmentRange: enrollmentRangeRef.current,
        activityRange: activityRangeRef.current,
        skillItems,
        xpValue,
        selectedPlace: selectedPlaceRef.current,
      });

      const requestPayload = isEditMode
        ? {
          ...payload,
          activity_id: editActivityId,
          activity_type: "meeting",
        }
        : payload;

      const response = await fetch("/api/organization/activity/meeting", {
        method: isEditMode ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.ok) {
        throw new Error(data?.message || `Request failed: ${response.status}`);
      }

      setSubmitSuccess(true);

      const targetActivityId =
        editActivityId ||
        data?.activity_id ||
        data?.id ||
        data?.activity?.activity_id ||
        data?.activity?.commonInfo?.activity_id ||
        data?.commonInfo?.activity_id;

      if (targetActivityId) {
        router.push(`/organization/activities/${encodeURIComponent(String(targetActivityId))}`);
      } else {
        router.push("/organization/dashboard");
      }
    } catch (error: any) {
      setSubmitError(error?.message || (isEditMode ? "Failed to update activity. Please try again." : "Failed to create activity. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isInitialLoading) {
    return (
      <div className={styles.page} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 420 }}>
        <div style={{ color: "#666", fontSize: 16 }}>Loading activity data...</div>
      </div>
    );
  }

  if (initialLoadError) {
    return (
      <div className={styles.page} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 420 }}>
        <div
          style={{
            background: "#fee2e2",
            border: "1px solid #fca5a5",
            borderRadius: 8,
            padding: "20px 24px",
            color: "#b91c1c",
            maxWidth: 520,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Failed to load activity</div>
          <div>{initialLoadError}</div>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              marginTop: 12,
              padding: "8px 16px",
              background: "#b91c1c",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {submitError && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 9999,
            background: "#fee2e2",
            border: "1px solid #fca5a5",
            borderRadius: 8,
            padding: "12px 20px",
            color: "#b91c1c",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            maxWidth: 400,
          }}
        >
          {submitError}
          <button
            style={{
              marginLeft: 12,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#b91c1c",
              fontWeight: 700,
            }}
            onClick={() => setSubmitError("")}
          >
            ×
          </button>
        </div>
      )}

      {submitSuccess && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 9999,
            background: "#dcfce7",
            border: "1px solid #86efac",
            borderRadius: 8,
            padding: "12px 20px",
            color: "#166534",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          {isEditMode ? "Activity updated successfully!" : "Activity created successfully!"}
        </div>
      )}

      <div className={styles.column}>
        <ActivityInformationSection
          key={`info-${formSeed}`}
          activityTitleRef={activityTitleRef}
          descriptionRef={descriptionRef}
          defaultActivityTitle={formDefaults.activityTitle}
          defaultDescription={formDefaults.description}
        />

        <ActivityTypeSelector selectedType={selectedActivityType} onSelectType={handleSelectActivityType} />

        <LocationAndSpeakerSection
          key={`location-${formSeed}`}
          selectedLocation={selectedLocation}
          onSelectLocation={setSelectedLocation}
          onsiteLocationRef={onsiteLocationRef}
          onlineLinkRef={onlineLinkRef}
          speakerNamesRef={speakerNamesRef}
          speakerBioRef={speakerBioRef}
          selectedPlaceRef={selectedPlaceRef}
          qrCodeValue={formDefaults.qrCodeValue}
          defaultOnsiteLocation={formDefaults.onsiteLocation}
          defaultOnlineLink={formDefaults.onlineLink}
          defaultSpeakerNames={formDefaults.speakerNames}
          defaultSpeakerBio={formDefaults.speakerBio}
          defaultSelectedPlace={initialSelectedPlace}
        />
      </div>

      <div className={styles.column}>
        <ActivityStatusSection selectedStatus={selectedActivityStatus} onSelectStatus={setSelectedActivityStatus} />

        <SkillsAndRewardsSection
          key={`skills-${formSeed}`}
          innerRef={skillsRewardsRef}
          defaultSkillItems={initialSkillItems}
          defaultXpValue={formDefaults.xpReward}
        />

        <AccessAndScheduleSection
          key={`access-${formSeed}`}
          selectedAudience={selectedAudience}
          onSelectAudience={setSelectedAudience}
          selectedParticipation={selectedParticipation}
          onSelectParticipation={setSelectedParticipation}
          enrollmentRangeRef={enrollmentRangeRef}
          activityRangeRef={activityRangeRef}
          maxParticipantsRef={maxParticipantsRef}
          defaultMaxParticipants={formDefaults.maxParticipants}
          defaultIsUnlimited={initialUnlimited}
          defaultEnrollmentRange={{
            startDate: formDefaults.enrollmentStartDate,
            startTime: formDefaults.enrollmentStartTime,
            endDate: formDefaults.enrollmentEndDate,
            endTime: formDefaults.enrollmentEndTime,
          }}
          defaultActivityRange={{
            startDate: formDefaults.activityStartDate,
            startTime: formDefaults.activityStartTime,
            endDate: formDefaults.activityEndDate,
            endTime: formDefaults.activityEndTime,
          }}
        />

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{
              background: "#84a59d",
              border: "none",
              borderRadius: 2,
              padding: "12px 32px",
              fontSize: 14,
              fontWeight: 400,
              cursor: isSubmitting ? "not-allowed" : "pointer",
              transition: "background 0.2s",
            }}
          >
            {isSubmitting
              ? isEditMode
                ? "Updating..."
                : "Saving..."
              : isEditMode
                ? "Update Activity"
                : selectedActivityStatus === "publish"
                  ? "Publish Activity"
                  : "Save as Draft"}
          </button>
        </div>
      </div>
    </div>
  );
}