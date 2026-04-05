"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
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

const SKILL_PROGRESS_LIST: SkillProgressItem[] = [];

const FORM_DEFAULTS = {
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

type RangePickerKey = "startDate" | "startTime" | "endDate" | "endTime" | null;

type RangeValue = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
};

const SKILL_LEVEL_OPTIONS = [
  "Remembering",
  "Understanding",
  "Applying",
  "Analyzing",
  "Evaluating",
  "Creating",
];

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
const QR_SIZE = 21;
function isInsideFinder(row: number, col: number, size: number) {
  const topLeft = row < 7 && col < 7;
  const topRight = row < 7 && col >= size - 7;
  const bottomLeft = row >= size - 7 && col < 7;
  return topLeft || topRight || bottomLeft;
}
function isFinderDark(row: number, col: number, size: number) {
  let localRow = row;
  let localCol = col;
  if (row < 7 && col >= size - 7) {
    localCol = col - (size - 7);
  } else if (row >= size - 7 && col < 7) {
    localRow = row - (size - 7);
  }
  const isOuterBorder = localRow === 0 || localRow === 6 || localCol === 0 || localCol === 6;
  const isCenterBlock = localRow >= 2 && localRow <= 4 && localCol >= 2 && localCol <= 4;
  return isOuterBorder || isCenterBlock;
}
function getQrCellIsDark(row: number, col: number, size: number) {
  if (isInsideFinder(row, col, size)) return isFinderDark(row, col, size);
  const isTimingRow = row === 6 && col > 7 && col < size - 8;
  const isTimingCol = col === 6 && row > 7 && row < size - 8;
  if (isTimingRow || isTimingCol) return (row + col) % 2 === 0;
  const seed = (row * 13 + col * 17 + row * col) % 7;
  return seed === 0 || seed === 1 || ((row + col) % 5 === 0 && row % 2 === 0);
}
function CheckInQrPreview({ value }: { value: string }) {
  const qrCells = useMemo(() => {
    return Array.from({ length: QR_SIZE * QR_SIZE }, (_, index) => {
      const row = Math.floor(index / QR_SIZE);
      const col = index % QR_SIZE;
      return { key: `${row}-${col}`, isDark: getQrCellIsDark(row, col, QR_SIZE) };
    });
  }, []);
  return (
    <div className={styles.checkInBlock}>
      <div className={styles.checkInTitle}>Check-in</div>
      <div className={styles.qrPreviewCard}>
        <div className={styles.qrPreviewFrame}>
          <div className={styles.qrGrid} aria-label="Generated check-in QR code">
            {qrCells.map((cell) => (
              <span key={cell.key} className={`${styles.qrCell} ${cell.isDark ? styles.qrCellDark : ""}`} />
            ))}
          </div>
        </div>
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

/* --- Activity Info Section --- */
type ActivityInfoRef = {
  getValues: () => { activityTitle: string; description: string };
};

function ActivityInformationSection({
  activityTitleRef,
  descriptionRef,
}: {
  activityTitleRef: React.RefObject<HTMLInputElement>;
  descriptionRef: React.RefObject<HTMLTextAreaElement>;
}) {
  return (
    <SectionCard className={styles.infoPanel}>
      <label className={styles.labelText}>Activity Title</label>
      <input
        ref={activityTitleRef}
        className={styles.largeInput}
        placeholder="Activity Title"
        defaultValue={FORM_DEFAULTS.activityTitle}
      />
      <label className={styles.labelText}>Description</label>
      <textarea
        ref={descriptionRef}
        className={styles.descriptionTextarea}
        placeholder="Description"
        defaultValue={FORM_DEFAULTS.description}
      />
    </SectionCard>
  );
}

/* --- Location & Speaker with exposed refs --- */
function LocationAndSpeakerSection({
  selectedLocation,
  onSelectLocation,
  onsiteLocationRef,
  onlineLinkRef,
  speakerNamesRef,
  speakerBioRef,
  selectedPlaceRef,
}: {
  selectedLocation: AttendanceLocation;
  onSelectLocation: (value: AttendanceLocation) => void;
  onsiteLocationRef: React.RefObject<HTMLInputElement>;
  onlineLinkRef: React.RefObject<HTMLInputElement>;
  speakerNamesRef: React.RefObject<HTMLInputElement>;
  speakerBioRef: React.RefObject<HTMLTextAreaElement>;
  selectedPlaceRef: React.MutableRefObject<SelectedPlaceState | null>;
}) {
  const [onsiteLocationInput, setOnsiteLocationInput] = useState(FORM_DEFAULTS.onsiteLocation);
  const [onlineLink, setOnlineLink] = useState(FORM_DEFAULTS.onlineLink);
  const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestionItem[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [placeSearchError, setPlaceSearchError] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlaceState | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const autocompleteSessionTokenRef = useRef<any | null>(null);
  const latestRequestIdRef = useRef(0);
  const shouldSkipNextSearchRef = useRef(false);
  const blurTimerRef = useRef<number | null>(null);

  // Sync selected place to parent ref
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
                    <div className={styles.selectedPlaceDetail}>{selectedPlace.detailText || selectedPlace.formattedAddress}</div>
                  </div>
                  <button type="button" className={styles.clearSelectedPlaceButton} onClick={clearSelectedPlace}>Clear</button>
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
        <input ref={speakerNamesRef} className={styles.fullWidthInput} placeholder="Speaker name" defaultValue={FORM_DEFAULTS.speakerNames} />
      </div>

      <div className={styles.formBlock}>
        <label className={styles.sectionTitle}>Position/Bio</label>
        <textarea ref={speakerBioRef} className={styles.bioTextarea} placeholder="Position or bio" defaultValue={FORM_DEFAULTS.speakerBio} />
      </div>

      <CheckInQrPreview value={FORM_DEFAULTS.qrCodeValue} />
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
  onChange,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  formValue: SkillFormValue;
  availableSkills: SkillOption[];
  isLoadingSkills: boolean;
  loadError: string;
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
    if (!keyword) return availableSkills.slice(0, 10);
    return availableSkills
      .filter((skill) => {
        const name = skill.skillName.toLowerCase();
        const category = skill.skillCategory.toLowerCase();
        return name.includes(keyword) || category.includes(keyword);
      })
      .slice(0, 10);
  }, [availableSkills, formValue.searchText]);

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
              onBlur={() => setTimeout(() => setIsSkillDropdownOpen(false), 120)}
              onChange={(event) =>
                onChange({ ...formValue, searchText: event.target.value, selectedSkillId: "", selectedSkillName: "", selectedSkillCategory: "" })
              }
              placeholder="Click or type to search skill"
            />
            {isSkillDropdownOpen && (
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
                        className={`${styles.skillSearchItem} ${isSelected ? styles.skillSearchItemActive : ""}`}
                        onClick={() => {
                          onChange({ ...formValue, searchText: skill.skillName, selectedSkillId: skill.skillId, selectedSkillName: skill.skillName, selectedSkillCategory: skill.skillCategory });
                          setIsSkillDropdownOpen(false);
                        }}
                      >
                        <div className={styles.skillSearchItemName}>{skill.skillName}</div>
                        <div className={styles.skillSearchItemCategory}>{skill.skillCategory}</div>
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
            <>Selected: <strong>{formValue.selectedSkillName}</strong>{formValue.selectedSkillCategory ? ` (${formValue.selectedSkillCategory})` : ""}</>
          ) : "No skill selected"}
        </div>
        <div className={styles.skillModalField}>
          <label className={styles.skillModalLabel}>Level</label>
          <select
            className={styles.skillModalSelect}
            value={formValue.skillLevel}
            onChange={(event) => onChange({ ...formValue, skillLevel: event.target.value })}
          >
            {SKILL_LEVEL_OPTIONS.map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
        </div>
        <div className={styles.skillModalActions}>
          <button type="button" className={styles.skillModalSecondaryButton} onClick={onClose}>Cancel</button>
          <button type="button" className={styles.skillModalPrimaryButton} onClick={onSubmit} disabled={!formValue.selectedSkillId}>Add</button>
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
              <span className={styles.rewardPreviewName} title={upload.fileName}>{upload.fileName}</span>
            </div>
          </div>
        ) : (
          <span>upload</span>
        )}
      </label>
      {upload.file ? (
        <button type="button" className={styles.clearUploadButton} onClick={onClear} aria-label={`Remove ${title} file`} title="Remove file">×</button>
      ) : null}
    </div>
  );
}

/* --- Skills & Rewards with exposed state --- */
type SkillsRewardsHandle = {
  getSkillItems: () => SkillProgressItem[];
  getXpValue: () => string;
};

function SkillsAndRewardsSection({ innerRef }: { innerRef?: React.MutableRefObject<SkillsRewardsHandle | null> }) {
  const [skillItems, setSkillItems] = useState<SkillProgressItem[]>(SKILL_PROGRESS_LIST);
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

  // Expose state to parent
  useEffect(() => {
    if (innerRef) {
      innerRef.current = {
        getSkillItems: () => skillItems,
        getXpValue: () => xpRef.current?.value || FORM_DEFAULTS.xpReward,
      };
    }
  });

  useEffect(() => {
    let isCancelled = false;
    async function loadSkills() {
      setIsLoadingSkills(true);
      setSkillLoadError("");
      try {
        const response = await fetch("/api/organization/activity/skills", { method: "GET", cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !data?.ok) throw new Error(data?.message || "Failed to load skills");
        if (!isCancelled) setAvailableSkills(Array.isArray(data.skills) ? data.skills : []);
      } catch (error: any) {
        if (!isCancelled) setSkillLoadError(error?.message || "Failed to load skills");
      } finally {
        if (!isCancelled) setIsLoadingSkills(false);
      }
    }
    loadSkills();
    return () => { isCancelled = true; };
  }, []);

  const resetSkillForm = () => {
    setSkillFormValue({ searchText: "", selectedSkillId: "", selectedSkillName: "", selectedSkillCategory: "", skillLevel: SKILL_LEVEL_OPTIONS[0] });
  };

  const handleRewardFileChange = (setter: Dispatch<SetStateAction<UploadPreviewState>>) => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const isSupported = file.type.startsWith("image/") || file.type === "application/pdf";
    if (!isSupported) {
      setRewardUploadError("Upload only image files or PDF files.");
      event.target.value = "";
      return;
    }
    const nextPreviewUrl = URL.createObjectURL(file);
    setter((previous) => {
      if (previous.previewUrl) URL.revokeObjectURL(previous.previewUrl);
      return { file, previewUrl: nextPreviewUrl, mimeType: file.type, fileName: file.name };
    });
    setRewardUploadError("");
    event.target.value = "";
  };

  const clearRewardUpload = (setter: Dispatch<SetStateAction<UploadPreviewState>>) => () => {
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
    setSkillItems((previous) => [
      ...previous,
      { id: `skill-${Date.now()}`, skillId: skillFormValue.selectedSkillId, skillName: skillFormValue.selectedSkillName, skillCategory: skillFormValue.selectedSkillCategory, skillLevel: skillFormValue.skillLevel },
    ]);
    resetSkillForm();
    setIsSkillModalOpen(false);
  };

  const handleRemoveSkill = (skillIdToRemove: string) => {
    setSkillItems((previous) => previous.filter((skill) => skill.id !== skillIdToRemove));
  };

  return (
    <>
      <SectionCard className={styles.rewardsPanel}>
        <div className={styles.rewardsHeader}>
          <div className={styles.rewardsTitle}>Skills</div>
          <button type="button" className={styles.addSkillButton} onClick={() => setIsSkillModalOpen(true)}>
            <Image src="/images/icons/button05-icon.png" alt="Add skill" width={26} height={19} className={styles.addSkillIcon} />
          </button>
        </div>
        <div className={styles.skillList}>
          {skillItems.map((skill) => (
            <div className={styles.skillRow} key={skill.id}>
              <div className={styles.skillName}>{skill.skillName}</div>
              <div className={styles.skillLevel}>{skill.skillLevel}</div>
              <button type="button" className={styles.removeSkillButton} onClick={() => handleRemoveSkill(skill.id)} aria-label={`Remove ${skill.skillName}`}>×</button>
            </div>
          ))}
        </div>
        <div className={styles.rewardStatsGrid}>
          <div className={styles.rewardCell}>
            <div className={styles.rewardTitle}>XP</div>
            <input ref={xpRef} className={styles.xpValueBox} defaultValue={FORM_DEFAULTS.xpReward} type="number" min="0" />
          </div>
          <div className={styles.rewardCell}>
            <div className={styles.rewardTitle}>Badges</div>
            <RewardUploadBox title="Badge" inputId="badge-upload-input" upload={badgeUpload} onFileChange={handleRewardFileChange(setBadgeUpload)} onClear={clearRewardUpload(setBadgeUpload)} />
          </div>
          <div className={styles.rewardCell}>
            <div className={styles.rewardTitle}>Certificate</div>
            <RewardUploadBox title="Certificate" inputId="certificate-upload-input" upload={certificateUpload} onFileChange={handleRewardFileChange(setCertificateUpload)} onClear={clearRewardUpload(setCertificateUpload)} />
          </div>
        </div>
        {rewardUploadError ? <div className={styles.rewardUploadError}>{rewardUploadError}</div> : null}
      </SectionCard>
      <AddSkillModal
        isOpen={isSkillModalOpen}
        formValue={skillFormValue}
        availableSkills={availableSkills}
        isLoadingSkills={isLoadingSkills}
        loadError={skillLoadError}
        onChange={(nextValue) => setSkillFormValue(nextValue)}
        onClose={() => { resetSkillForm(); setIsSkillModalOpen(false); }}
        onSubmit={handleAddSkill}
      />
    </>
  );
}

/* --- Calendar / Time pickers (unchanged) --- */
function CalendarPopup({
  visibleMonth, startDate, endDate, onPreviousMonth, onNextMonth, onSelectDate,
}: {
  visibleMonth: Date; startDate: string; endDate: string;
  onPreviousMonth: () => void; onNextMonth: () => void;
  onSelectDate: (value: string) => void;
}) {
  const calendarCells = buildCalendarCells(visibleMonth);
  return (
    <div className={styles.calendarPopup}>
      <div className={styles.calendarHeader}>
        <button type="button" className={styles.calendarNavButton} onClick={onPreviousMonth}>‹</button>
        <div className={styles.calendarMonthTitle}>{formatMonthTitle(visibleMonth)}</div>
        <button type="button" className={styles.calendarNavButton} onClick={onNextMonth}>›</button>
      </div>
      <div className={styles.calendarWeekRow}>
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className={styles.calendarWeekLabel}>{d}</div>
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

function DateRangeSection({ title, startDateDefault, startTimeDefault, endDateDefault, endTimeDefault, onRangeChange }: DateRangeSectionProps) {
  const [rangeValue, setRangeValue] = useState<RangeValue>({
    startDate: startDateDefault,
    startTime: startTimeDefault,
    endDate: endDateDefault,
    endTime: endTimeDefault,
  });
  const [openPicker, setOpenPicker] = useState<RangePickerKey>(null);
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date());

  const handleSelectDate = (key: "startDate" | "endDate", value: string) => {
    const next = { ...rangeValue, [key]: value };
    setRangeValue(next);
    onRangeChange?.(next);
    setOpenPicker(null);
  };

  const handleSelectTime = (key: "startTime" | "endTime", value: string) => {
    const next = { ...rangeValue, [key]: value };
    setRangeValue(next);
    onRangeChange?.(next);
    setOpenPicker(null);
  };

  return (
    <div className={styles.periodSection}>
      <div className={styles.periodTitle}>{title}</div>
      <div className={styles.periodRow}>
        <div className={styles.periodColumn}>
          <div className={styles.periodLabel}>Start</div>
          <div className={styles.periodFieldGrid}>
            <div className={styles.periodFieldWrap}>
              <button
                type="button"
                className={`${styles.dateTriggerButton} ${openPicker === "startDate" ? styles.triggerButtonActive : ""}`}
                onClick={() => setOpenPicker((p) => (p === "startDate" ? null : "startDate"))}
              >
                {formatDateDisplay(rangeValue.startDate)}
              </button>
              {openPicker === "startDate" && (
                <div className={styles.floatingPicker}>
                  <CalendarPopup
                    visibleMonth={visibleMonth}
                    startDate={rangeValue.startDate}
                    endDate={rangeValue.endDate}
                    onPreviousMonth={() => setVisibleMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))}
                    onNextMonth={() => setVisibleMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))}
                    onSelectDate={(value) => handleSelectDate("startDate", value)}
                  />
                </div>
              )}
            </div>
            <div className={styles.periodFieldWrap}>
              <button
                type="button"
                className={`${styles.timeTriggerButton} ${openPicker === "startTime" ? styles.triggerButtonActive : ""}`}
                onClick={() => setOpenPicker((p) => (p === "startTime" ? null : "startTime"))}
              >
                {rangeValue.startTime || "time"}
              </button>
              {openPicker === "startTime" && (
                <div className={styles.floatingPicker}>
                  <TimePopup selectedTime={rangeValue.startTime} onSelectTime={(value) => handleSelectTime("startTime", value)} />
                </div>
              )}
            </div>
          </div>
        </div>
        <div className={styles.periodArrow}>→</div>
        <div className={styles.periodColumn}>
          <div className={styles.periodLabel}>End</div>
          <div className={styles.periodFieldGrid}>
            <div className={styles.periodFieldWrap}>
              <button
                type="button"
                className={`${styles.dateTriggerButton} ${openPicker === "endDate" ? styles.triggerButtonActive : ""}`}
                onClick={() => setOpenPicker((p) => (p === "endDate" ? null : "endDate"))}
              >
                {formatDateDisplay(rangeValue.endDate)}
              </button>
              {openPicker === "endDate" && (
                <div className={`${styles.floatingPicker} ${styles.floatingPickerRight}`}>
                  <CalendarPopup
                    visibleMonth={visibleMonth}
                    startDate={rangeValue.startDate}
                    endDate={rangeValue.endDate}
                    onPreviousMonth={() => setVisibleMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))}
                    onNextMonth={() => setVisibleMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))}
                    onSelectDate={(value) => handleSelectDate("endDate", value)}
                  />
                </div>
              )}
            </div>
            <div className={styles.periodFieldWrap}>
              <button
                type="button"
                className={`${styles.timeTriggerButton} ${openPicker === "endTime" ? styles.triggerButtonActive : ""}`}
                onClick={() => setOpenPicker((p) => (p === "endTime" ? null : "endTime"))}
              >
                {rangeValue.endTime || "time"}
              </button>
              {openPicker === "endTime" && (
                <div className={`${styles.floatingPicker} ${styles.floatingPickerRight}`}>
                  <TimePopup selectedTime={rangeValue.endTime} onSelectTime={(value) => handleSelectTime("endTime", value)} />
                </div>
              )}
            </div>
          </div>
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
}: {
  selectedAudience: AudienceAccess;
  onSelectAudience: (value: AudienceAccess) => void;
  selectedParticipation: ParticipationMode;
  onSelectParticipation: (value: ParticipationMode) => void;
  enrollmentRangeRef: React.MutableRefObject<RangeValue>;
  activityRangeRef: React.MutableRefObject<RangeValue>;
  maxParticipantsRef: React.RefObject<HTMLInputElement>;
}) {
  const [isUnlimited, setIsUnlimited] = useState(false);

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
            defaultValue={FORM_DEFAULTS.maxParticipants}
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
        startDateDefault={FORM_DEFAULTS.enrollmentStartDate}
        startTimeDefault={FORM_DEFAULTS.enrollmentStartTime}
        endDateDefault={FORM_DEFAULTS.enrollmentEndDate}
        endTimeDefault={FORM_DEFAULTS.enrollmentEndTime}
        onRangeChange={(v) => { enrollmentRangeRef.current = v; }}
      />

      <div className={styles.divider} />

      <DateRangeSection
        title="Activity Run Period"
        startDateDefault={FORM_DEFAULTS.activityStartDate}
        startTimeDefault={FORM_DEFAULTS.activityStartTime}
        endDateDefault={FORM_DEFAULTS.activityEndDate}
        endTimeDefault={FORM_DEFAULTS.activityEndTime}
        onRangeChange={(v) => { activityRangeRef.current = v; }}
      />
    </SectionCard>
  );
}

/* =========================
   API Submit Helper
========================= */
function buildIsoDateTime(date: string, time: string): string {
  if (!date) return "";
  const timePart = time || "00:00";
  return `${date}T${timePart}:00Z`;
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
}) {
  const {
    activityTitle, description, selectedStatus, selectedLocation,
    onsiteLocationInput, onlineLink, speakerNames, speakerBio,
    selectedAudience, selectedParticipation, maxParticipants,
    enrollmentRange, activityRange, skillItems, xpValue, selectedPlace,
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
      location: meetingType === "onsite" ? (selectedPlace?.formattedAddress || onsiteLocationInput) : "",
      speaker: speakerNames,
      speaker_position: speakerBio,
      qrcode_checkin: FORM_DEFAULTS.qrCodeValue,
    },
  };
}

/* =========================
   Main Page
========================= */
export default function ActivityMeeting() {
  const router = useRouter();

  // Activity type / status
  const [selectedActivityType, setSelectedActivityType] = useState<ActivityKind>("meetings");
  const [selectedActivityStatus, setSelectedActivityStatus] = useState<ActivityStatus>("draft");
  const [selectedAudience, setSelectedAudience] = useState<AudienceAccess>("everyone");
  const [selectedParticipation, setSelectedParticipation] = useState<ParticipationMode>("scheduledParticipation");
  const [selectedLocation, setSelectedLocation] = useState<AttendanceLocation>("onsite");

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Refs for collecting form values
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

  const handleSelectActivityType = (value: ActivityKind) => {
    if (value === selectedActivityType) return;
    setSelectedActivityType(value);
    router.push(ACTIVITY_ROUTE_MAP[value]);
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
      const xpValue = Number(skillsRewardsRef.current?.getXpValue() || FORM_DEFAULTS.xpReward);

      const payload = buildMeetingPayload({
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

      const response = await fetch("/api/organization/activity/meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.ok) {
        throw new Error(data?.message || `Request failed: ${response.status}`);
      }

      setSubmitSuccess(true);

      // Navigate to dashboard or the activity detail page
      const newActivityId = data?.activity_id || data?.id;
      if (newActivityId) {
        router.push(`/organization/activities/${newActivityId}`);
      } else {
        router.push("/organization/dashboard");
      }
    } catch (error: any) {
      setSubmitError(error?.message || "Failed to create activity. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* Submit feedback */}
      {submitError && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          background: "#fee2e2", border: "1px solid #fca5a5",
          borderRadius: 8, padding: "12px 20px", color: "#b91c1c",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)", maxWidth: 400,
        }}>
          {submitError}
          <button
            style={{ marginLeft: 12, background: "none", border: "none", cursor: "pointer", color: "#b91c1c", fontWeight: 700 }}
            onClick={() => setSubmitError("")}
          >×</button>
        </div>
      )}

      {submitSuccess && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          background: "#dcfce7", border: "1px solid #86efac",
          borderRadius: 8, padding: "12px 20px", color: "#166534",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}>
          Activity created successfully!
        </div>
      )}

      <div className={styles.column}>
        <ActivityInformationSection activityTitleRef={activityTitleRef} descriptionRef={descriptionRef} />

        <ActivityTypeSelector selectedType={selectedActivityType} onSelectType={handleSelectActivityType} />

        <LocationAndSpeakerSection
          selectedLocation={selectedLocation}
          onSelectLocation={setSelectedLocation}
          onsiteLocationRef={onsiteLocationRef}
          onlineLinkRef={onlineLinkRef}
          speakerNamesRef={speakerNamesRef}
          speakerBioRef={speakerBioRef}
          selectedPlaceRef={selectedPlaceRef}
        />
      </div>

      <div className={styles.column}>
        <ActivityStatusSection selectedStatus={selectedActivityStatus} onSelectStatus={setSelectedActivityStatus} />

        <SkillsAndRewardsSection innerRef={skillsRewardsRef} />

        <AccessAndScheduleSection
          selectedAudience={selectedAudience}
          onSelectAudience={setSelectedAudience}
          selectedParticipation={selectedParticipation}
          onSelectParticipation={setSelectedParticipation}
          enrollmentRangeRef={enrollmentRangeRef}
          activityRangeRef={activityRangeRef}
          maxParticipantsRef={maxParticipantsRef}
        />

        {/* Save / Publish Button */}
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{
              background: isSubmitting ? "#9ca3af" : "#10b981",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "12px 32px",
              fontSize: 14,
              fontWeight: 600,
              cursor: isSubmitting ? "not-allowed" : "pointer",
              transition: "background 0.2s",
            }}
          >
            {isSubmitting
              ? "Saving..."
              : selectedActivityStatus === "publish"
              ? "Publish Activity"
              : "Save as Draft"}
          </button>
        </div>
      </div>
    </div>
  );
}
