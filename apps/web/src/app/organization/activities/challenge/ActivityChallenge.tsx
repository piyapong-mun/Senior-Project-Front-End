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
import styles from "./ActivityChallenge.module.css";

/* =========================
   Types
========================= */
type ActivityKind = "meetings" | "courses" | "challenges";
type ActivityStatus = "draft" | "publish";
type AudienceAccess = "invitedOnly" | "everyone";
type ParticipationMode = "joinAnytime" | "scheduledParticipation";
type ChallengeLevel = "beginner" | "intermediate" | "advanced";

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

type SkillFormValue = {
  searchText: string;
  selectedSkillId: string;
  selectedSkillName: string;
  selectedSkillCategory: string;
  skillLevel: string;
};


type RangeValue = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
};

type DateRangeSectionProps = {
  title: string;
  startDateDefault: string;
  startTimeDefault: string;
  endDateDefault: string;
  endTimeDefault: string;
  onRangeChange?: (value: RangeValue) => void;
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
   Static Data
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

const CHALLENGE_LEVEL_OPTIONS: ChoiceOption<ChallengeLevel>[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const SKILL_PROGRESS_LIST: SkillProgressItem[] = [];

const FORM_DEFAULTS = {
  activityTitle: "",
  description: "",
  problemStatement: "",
  goalExpectedOutcome: "",
  submissionRequirements: "",
  enrollmentStartDate: "",
  enrollmentStartTime: "",
  enrollmentEndDate: "",
  enrollmentEndTime: "",
  activityStartDate: "",
  activityStartTime: "",
  activityEndDate: "",
  activityEndTime: "",
  maxParticipants: "0",
  xpReward: "60",
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

function normalizeTextValue(value: any): string {
  if (value === null || value === undefined) return "";

  if (typeof value === "string") {
    const trimmed = value.trim();

    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "string") return parsed.trim();
    } catch {}

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

async function fetchNormalizedActivitySkills(activityId: string): Promise<SkillProgressItem[]> {
  const response = await fetch(
    `/api/organization/activity/${encodeURIComponent(activityId)}/skills`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

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

function buildIsoDateTime(date: string, time: string): string {
  if (!date) return "";
  const safeTime = /^\d{2}:\d{2}$/.test(time || "") ? time : "00:00";
  return `${date}T${safeTime}:00+07:00`;
}

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
   Small Reusable UI
========================= */
function SectionCard({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <section className={`${styles.panel} ${className}`}>{children}</section>;
}

function CheckBoxIcon({ checked }: { checked: boolean }) {
  return (
    <span
      className={`${styles.checkBox} ${checked ? styles.checkBoxChecked : ""}`}
      aria-hidden="true"
    >
      {checked ? "✓" : ""}
    </span>
  );
}

function AudienceIllustration({ value }: { value: AudienceAccess }) {
  if (value === "invitedOnly") {
    return (
      <div className={styles.accessCardIconWrap} aria-hidden="true">
        <span className={styles.inviteOnlyPlus} />
      </div>
    );
  }

  return (
    <div className={styles.accessCardIconWrap} aria-hidden="true">
      <Image
        src="/images/icons/body2-icon.png"
        alt="Everyone can join"
        fill
        className={styles.accessAudienceIcon}
        sizes="72px"
      />
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
            className={`${styles.segmentButton} ${
              selectedType === option.value ? styles.segmentButtonActive : ""
            }`}
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
  titleRef,
  descriptionRef,
  defaultTitle = FORM_DEFAULTS.activityTitle,
  defaultDescription = FORM_DEFAULTS.description,
}: {
  titleRef: React.RefObject<HTMLInputElement | null>;
  descriptionRef: React.RefObject<HTMLTextAreaElement | null>;
  defaultTitle?: string;
  defaultDescription?: string;
}) {
  return (
    <SectionCard className={styles.infoPanel}>
      <label className={styles.labelText}>Activity Title</label>
      <input
        ref={titleRef}
        className={styles.largeInput}
        placeholder="Body"
        defaultValue={defaultTitle}
      />

      <label className={styles.labelText}>Description</label>
      <textarea
        ref={descriptionRef}
        className={styles.descriptionTextarea}
        placeholder="Body"
        defaultValue={defaultDescription}
      />
    </SectionCard>
  );
}

function ChallengeSpecificationSection({
  selectedLevel,
  onSelectLevel,
  problemStatementRef,
  goalOutcomeRef,
  submissionReqsRef,
  defaultProblemStatement = FORM_DEFAULTS.problemStatement,
  defaultGoalOutcome = FORM_DEFAULTS.goalExpectedOutcome,
  defaultSubmissionReqs = FORM_DEFAULTS.submissionRequirements,
}: {
  selectedLevel: ChallengeLevel;
  onSelectLevel: (value: ChallengeLevel) => void;
  problemStatementRef: React.RefObject<HTMLTextAreaElement | null>;
  goalOutcomeRef: React.RefObject<HTMLTextAreaElement | null>;
  submissionReqsRef: React.RefObject<HTMLTextAreaElement | null>;
  defaultProblemStatement?: string;
  defaultGoalOutcome?: string;
  defaultSubmissionReqs?: string;
}) {
  return (
    <SectionCard className={`${styles.detailsPanel} ${styles.challengeDetailsPanel}`}>
      <div className={styles.challengeFields}>
        <div className={styles.challengeFieldBlock}>
          <label className={styles.sectionTitle}>Problem statement</label>
          <textarea
            ref={problemStatementRef}
            className={`${styles.bioTextarea} ${styles.challengeTextarea}`}
            placeholder="description"
            defaultValue={defaultProblemStatement}
          />
        </div>

        <div className={styles.challengeFieldBlock}>
          <label className={styles.sectionTitle}>Goal / expected outcome</label>
          <textarea
            ref={goalOutcomeRef}
            className={`${styles.bioTextarea} ${styles.challengeTextarea}`}
            placeholder="description"
            defaultValue={defaultGoalOutcome}
          />
        </div>

        <div className={styles.challengeFieldBlock}>
          <div className={styles.challengeLevelGrid}>
            {CHALLENGE_LEVEL_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`${styles.challengeLevelButton} ${
                  selectedLevel === option.value
                    ? styles.challengeLevelButtonActive
                    : ""
                }`}
                onClick={() => onSelectLevel(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.challengeFieldBlock}>
          <label className={styles.sectionTitle}>Submission Requirements</label>
          <textarea
            ref={submissionReqsRef}
            className={`${styles.bioTextarea} ${styles.submissionTextarea}`}
            placeholder="file, link (GitHub/Figma), video demo, pictures"
            defaultValue={defaultSubmissionReqs}
          />
        </div>
      </div>
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
          className={`${styles.actionButton} ${
            selectedStatus === "draft"
              ? styles.statusButtonActive
              : styles.statusButtonInactive
          }`}
          onClick={() => onSelectStatus("draft")}
        >
          <Image
            src="/images/icons/draft-icon.png"
            alt="Draft status"
            width={40}
            height={40}
            className={styles.actionIcon}
          />
          <span>Draft</span>
        </button>

        <button
          type="button"
          className={`${styles.actionButton} ${
            selectedStatus === "publish"
              ? styles.statusButtonActive
              : styles.statusButtonInactive
          }`}
          onClick={() => onSelectStatus("publish")}
        >
          <Image
            src="/images/icons/publish-icon.png"
            alt="Publish status"
            width={40}
            height={40}
            className={styles.actionIcon}
          />
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
    if (!isOpen) {
      setIsSkillDropdownOpen(false);
    }
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

  if (!isOpen) return null;

  return (
    <div className={styles.skillModalOverlay} onClick={onClose}>
      <div
        className={styles.skillModalCard}
        onClick={(event) => event.stopPropagation()}
      >
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
                setTimeout(() => setIsSkillDropdownOpen(false), 120);
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
                        className={`${styles.skillSearchItem} ${
                          isSelected ? styles.skillSearchItemActive : ""
                        }`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          onChange({
                            ...formValue,
                            searchText: skill.skillName,
                            selectedSkillId: skill.skillId,
                            selectedSkillName: skill.skillName,
                            selectedSkillCategory: skill.skillCategory,
                            skillLevel:
                              formValue.skillLevel || SKILL_LEVEL_OPTIONS[0],
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
      <input
        id={inputId}
        type="file"
        accept="image/*,application/pdf"
        className={styles.hiddenFileInput}
        onChange={onFileChange}
      />

      <label htmlFor={inputId} className={styles.uploadButton}>
        {upload.file ? (
          <div className={styles.rewardPreviewContent}>
            {isPdf ? (
              <iframe
                src={`${upload.previewUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                className={styles.rewardPreviewPdf}
                title={`${title} preview`}
              />
            ) : (
              <img
                src={upload.previewUrl}
                alt={`${title} preview`}
                className={styles.rewardPreviewImage}
              />
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
        <button
          type="button"
          className={styles.clearUploadButton}
          onClick={onClear}
          aria-label={`Remove ${title} file`}
          title="Remove file"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

function SkillsAndRewardsSection({
  xpRef,
  onSkillsChange,
  defaultXp = FORM_DEFAULTS.xpReward,
  defaultSkillItems = SKILL_PROGRESS_LIST,
}: {
  xpRef: React.RefObject<HTMLInputElement | null>;
  onSkillsChange: (items: SkillProgressItem[]) => void;
  defaultXp?: string;
  defaultSkillItems?: SkillProgressItem[];
}) {
  const [skillItems, setSkillItems] = useState<SkillProgressItem[]>(defaultSkillItems);
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [availableSkills, setAvailableSkills] = useState<SkillOption[]>([]);
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);
  const [skillLoadError, setSkillLoadError] = useState("");

  const [badgeUpload, setBadgeUpload] = useState<UploadPreviewState>(
    createEmptyUploadState()
  );
  const [certificateUpload, setCertificateUpload] = useState<UploadPreviewState>(
    createEmptyUploadState()
  );
  const [rewardUploadError, setRewardUploadError] = useState("");

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
    onSkillsChange(skillItems);
  }, [onSkillsChange, skillItems]);

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

        if (!isCancelled) {
          setAvailableSkills(Array.isArray(data.skills) ? data.skills : []);
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
    return skillItems.map((skill) => String(skill.skillId || "").trim()).filter(Boolean);
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
        if (previous.previewUrl) {
          URL.revokeObjectURL(previous.previewUrl);
        }

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
        if (previous.previewUrl) {
          URL.revokeObjectURL(previous.previewUrl);
        }
        return createEmptyUploadState();
      });
    };

  useEffect(() => {
    return () => {
      if (badgeUpload.previewUrl) {
        URL.revokeObjectURL(badgeUpload.previewUrl);
      }
      if (certificateUpload.previewUrl) {
        URL.revokeObjectURL(certificateUpload.previewUrl);
      }
    };
  }, [badgeUpload.previewUrl, certificateUpload.previewUrl]);

  const handleAddSkill = () => {
    if (!skillFormValue.selectedSkillId) {
      return;
    }

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
    setSkillItems((previous) => {
      return previous.filter((skill) => skill.id !== skillIdToRemove);
    });
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
                width={26}
                height={19}
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
                <div className={styles.skillName}>{skill.skillName}</div>
                <div className={styles.skillLevel}>{skill.skillLevel}</div>
                <button
                  type="button"
                  className={styles.removeSkillButton}
                  onClick={() => handleRemoveSkill(skill.id)}
                  aria-label={`Remove ${skill.skillName}`}
                  title="Remove skill"
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
              defaultValue={defaultXp}
              type="number"
              min="0"
              style={{ width: "60px", textAlign: "center" }}
            />
            <div className={styles.rewardIconWrap} aria-hidden="true">
              <div className={styles.challengeRewardBadge}>
                <Image
                  src="/images/icons/badge01.png"
                  alt="Challenge badge"
                  fill
                  className={styles.challengeRewardBadgeIcon}
                  sizes="54px"
                />
              </div>
            </div>
          </div>

          <div className={styles.rewardCell}>
            <div className={styles.rewardTitle}>Badges</div>
            <RewardUploadBox
              title="Badge"
              inputId="challenge-badge-upload-input"
              upload={badgeUpload}
              onFileChange={handleRewardFileChange(setBadgeUpload)}
              onClear={clearRewardUpload(setBadgeUpload)}
            />
          </div>

          <div className={styles.rewardCell}>
            <div className={styles.rewardTitle}>Certificate</div>
            <RewardUploadBox
              title="Certificate"
              inputId="challenge-certificate-upload-input"
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
        onChange={(nextValue) => {
          setSkillFormValue(nextValue);
        }}
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
        <button
          type="button"
          className={styles.calendarNavButton}
          onClick={onPreviousMonth}
        >
          ‹
        </button>

        <div className={styles.calendarMonthTitle}>{formatMonthTitle(visibleMonth)}</div>

        <button
          type="button"
          className={styles.calendarNavButton}
          onClick={onNextMonth}
        >
          ›
        </button>
      </div>

      <div className={styles.calendarWeekHeader}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className={`${styles.calendarWeekDay} ${
              day === "Sun" || day === "Sat" ? styles.calendarWeekDayAccent : ""
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      <div className={styles.calendarGrid}>
        {calendarCells.map((cell) => {
          const isSelected = cell.iso === startDate || cell.iso === endDate;
          const isInRange = isDateInRange(cell.iso, startDate, endDate);

          return (
            <button
              key={cell.iso}
              type="button"
              className={`${styles.calendarDayButton} ${
                !cell.isCurrentMonth ? styles.calendarDayMuted : ""
              } ${cell.isWeekend ? styles.calendarDayWeekend : ""} ${
                isInRange ? styles.calendarDayInRange : ""
              } ${isSelected ? styles.calendarDaySelected : ""}`}
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

function TimePopup({
  selectedTime,
  onSelectTime,
}: {
  selectedTime: string;
  onSelectTime: (value: string) => void;
}) {
  return (
    <div className={styles.timePopup}>
      <div className={styles.timePopupTitle}>Select time</div>

      <div className={styles.timeOptionList}>
        {TIME_OPTIONS.map((time) => (
          <button
            key={time}
            type="button"
            className={`${styles.timeOptionButton} ${
              selectedTime === time ? styles.timeOptionButtonActive : ""
            }`}
            onClick={() => onSelectTime(time)}
          >
            {time}
          </button>
        ))}
      </div>
    </div>
  );
}

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
  maxParticipantsRef,
  onIsUnlimitedChange,
  onEnrollmentRangeChange,
  onActivityRangeChange,
  defaultMaxParticipants = FORM_DEFAULTS.maxParticipants,
  defaultIsUnlimited = false,
  defaultEnrollmentRange,
  defaultActivityRange,
}: {
  selectedAudience: AudienceAccess;
  onSelectAudience: (value: AudienceAccess) => void;
  selectedParticipation: ParticipationMode;
  onSelectParticipation: (value: ParticipationMode) => void;
  maxParticipantsRef: React.RefObject<HTMLInputElement | null>;
  onIsUnlimitedChange: (value: boolean) => void;
  onEnrollmentRangeChange: (value: RangeValue) => void;
  onActivityRangeChange: (value: RangeValue) => void;
  defaultMaxParticipants?: string;
  defaultIsUnlimited?: boolean;
  defaultEnrollmentRange?: RangeValue;
  defaultActivityRange?: RangeValue;
}) {
  const [isUnlimited, setIsUnlimited] = useState(defaultIsUnlimited);

  const enrollDefault = defaultEnrollmentRange ?? {
    startDate: FORM_DEFAULTS.enrollmentStartDate,
    startTime: FORM_DEFAULTS.enrollmentStartTime,
    endDate: FORM_DEFAULTS.enrollmentEndDate,
    endTime: FORM_DEFAULTS.enrollmentEndTime,
  };
  const activityDefault = defaultActivityRange ?? {
    startDate: FORM_DEFAULTS.activityStartDate,
    startTime: FORM_DEFAULTS.activityStartTime,
    endDate: FORM_DEFAULTS.activityEndDate,
    endTime: FORM_DEFAULTS.activityEndTime,
  };

  useEffect(() => {
    setIsUnlimited(defaultIsUnlimited);
  }, [defaultIsUnlimited]);

  return (
    <SectionCard className={styles.settingsPanel}>
      <div className={styles.accessGrid}>
        {AUDIENCE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`${styles.accessCard} ${
              selectedAudience === option.value ? styles.accessCardActive : ""
            }`}
            onClick={() => onSelectAudience(option.value)}
          >
            <div className={styles.accessTitle}>{option.label}</div>
            <AudienceIllustration value={option.value} />
          </button>
        ))}
      </div>

      <div className={styles.divider} />

      <div className={styles.joinModeGrid}>
        {PARTICIPATION_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`${styles.joinModeButton} ${
              selectedParticipation === option.value
                ? styles.joinModeButtonActive
                : ""
            }`}
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
            disabled={isUnlimited}
          />
        </div>

        <button
          type="button"
          className={styles.unlimitedToggle}
          onClick={() => {
            setIsUnlimited((previous) => {
              onIsUnlimitedChange(!previous);
              return !previous;
            });
          }}
        >
          <CheckBoxIcon checked={isUnlimited} />
          <span>No</span>
        </button>
      </div>

      <div className={styles.divider} />

      <DateRangeSection
        title="Enrollment Period"
        startDateDefault={enrollDefault.startDate}
        startTimeDefault={enrollDefault.startTime}
        endDateDefault={enrollDefault.endDate}
        endTimeDefault={enrollDefault.endTime}
        onRangeChange={onEnrollmentRangeChange}
      />

      <div className={styles.divider} />

      <DateRangeSection
        title="Activity Run Period"
        startDateDefault={activityDefault.startDate}
        startTimeDefault={activityDefault.startTime}
        endDateDefault={activityDefault.endDate}
        endTimeDefault={activityDefault.endTime}
        onRangeChange={onActivityRangeChange}
      />
    </SectionCard>
  );
}

/* =========================
   Main Page
========================= */
export default function ActivityChallenge() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const editActivityId = (searchParams.get("edit") || "").trim();
  const isEditMode = Boolean(editActivityId);

  // UI state
  const [selectedActivityType, setSelectedActivityType] = useState<ActivityKind>("challenges");
  const [selectedActivityStatus, setSelectedActivityStatus] = useState<ActivityStatus>("draft");
  const [selectedAudience, setSelectedAudience] = useState<AudienceAccess>("everyone");
  const [selectedParticipation, setSelectedParticipation] = useState<ParticipationMode>("scheduledParticipation");
  const [selectedLevel, setSelectedLevel] = useState<ChallengeLevel>("advanced");

  // Async state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(isEditMode);
  const [initialLoadError, setInitialLoadError] = useState("");
  const [formSeed, setFormSeed] = useState(0);
  const [formDefaults, setFormDefaults] = useState({ ...FORM_DEFAULTS });
  const [initialSkillItems, setInitialSkillItems] = useState<SkillProgressItem[]>([]);

  // Refs for uncontrolled text inputs
  const activityTitleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const problemStatementRef = useRef<HTMLTextAreaElement>(null);
  const goalOutcomeRef = useRef<HTMLTextAreaElement>(null);
  const submissionReqsRef = useRef<HTMLTextAreaElement>(null);
  const maxParticipantsRef = useRef<HTMLInputElement>(null);
  const xpRef = useRef<HTMLInputElement>(null);

  // Mutable refs for date/boolean state (no re-render needed)
  const enrollmentRangeRef = useRef<RangeValue>({ startDate: "", startTime: "", endDate: "", endTime: "" });
  const activityRangeRef = useRef<RangeValue>({ startDate: "", startTime: "", endDate: "", endTime: "" });
  const isUnlimitedRef = useRef(false);
  const skillItemsRef = useRef<SkillProgressItem[]>([]);

  // Load existing activity data in edit mode
  useEffect(() => {
    if (!isEditMode) return;
    let cancelled = false;

    async function loadActivity() {
      setIsInitialLoading(true);
      setInitialLoadError("");
      try {
        const [detailResponse, normalizedSkillItems] = await Promise.all([
          fetch(`/api/organization/activity/${encodeURIComponent(editActivityId)}`, {
            cache: "no-store",
          }).then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.ok) throw new Error(data?.message || "Failed to load activity");
            return data;
          }),
          fetchNormalizedActivitySkills(editActivityId).catch(() => []),
        ]);

        if (cancelled) return;

        const raw = detailResponse?.activity ?? detailResponse ?? {};
        const info = raw?.commonInfo ?? raw?.common_info ?? raw;
        const ci = raw?.challenge_info ?? raw?.challengeInfo ?? info?.challenge_info ?? info?.challengeInfo ?? {};

        const split = (iso: string) => {
          if (!iso) return { date: "", time: "" };
          if (iso.startsWith("0001-") || iso.startsWith("0000-")) return { date: "", time: "" };
          const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
          if (!m) return { date: "", time: "" };
          return {
            date: `${m[1]}-${m[2]}-${m[3]}`,
            time: `${m[4]}:${m[5]}`,
          };
        };

        const es = split(info?.activity_enroll_start_at ?? info?.enroll_start_at ?? raw?.activity_enroll_start_at ?? raw?.enroll_start_at ?? "");
        const ee = split(info?.activity_enroll_end_at ?? info?.enroll_end_at ?? raw?.activity_enroll_end_at ?? raw?.enroll_end_at ?? "");
        const rs = split(info?.activity_start_at ?? info?.run_start_at ?? raw?.activity_start_at ?? raw?.run_start_at ?? "");
        const re = split(info?.activity_end_at ?? info?.run_end_at ?? raw?.activity_end_at ?? raw?.run_end_at ?? "");
        const maxP = Number(info?.activity_max_participants ?? info?.max_participants ?? raw?.activity_max_participants ?? raw?.max_participants ?? 0);

        enrollmentRangeRef.current = { startDate: es.date, startTime: es.time, endDate: ee.date, endTime: ee.time };
        activityRangeRef.current = { startDate: rs.date, startTime: rs.time, endDate: re.date, endTime: re.time };
        isUnlimitedRef.current = maxP === 0;
        skillItemsRef.current = normalizedSkillItems;

        const statusVal = String(info?.activity_status ?? info?.status ?? raw?.activity_status ?? raw?.status ?? "draft");
        setSelectedActivityStatus(statusVal === "published" ? "publish" : "draft");

        const visVal = String(info?.activity_visibility ?? info?.visibility ?? raw?.activity_visibility ?? raw?.visibility ?? "public");
        setSelectedAudience(visVal === "invited" ? "invitedOnly" : "everyone");

        const openEnded = Boolean(info?.is_open_ended ?? raw?.is_open_ended ?? false);
        setSelectedParticipation(openEnded ? "joinAnytime" : "scheduledParticipation");

        const lv = String(ci?.level ?? "advanced").toLowerCase() as ChallengeLevel;
        setSelectedLevel(["beginner", "intermediate", "advanced"].includes(lv) ? lv : "advanced");

        setInitialSkillItems(normalizedSkillItems);
        setFormDefaults({
          activityTitle: String(info?.activity_name ?? raw?.activity_name ?? ""),
          description: normalizeTextValue(info?.activity_detail ?? raw?.activity_detail ?? raw?.description ?? ""),
          problemStatement: normalizeTextValue(ci?.problem_statement ?? ""),
          goalExpectedOutcome: normalizeTextValue(ci?.description ?? ""),
          submissionRequirements: normalizeTextValue(ci?.submit_type ?? ""),
          enrollmentStartDate: es.date,
          enrollmentStartTime: es.time,
          enrollmentEndDate: ee.date,
          enrollmentEndTime: ee.time,
          activityStartDate: rs.date,
          activityStartTime: rs.time,
          activityEndDate: re.date,
          activityEndTime: re.time,
          maxParticipants: String(maxP),
          xpReward: String(info?.activity_hours ?? info?.hours ?? raw?.activity_hours ?? raw?.hours ?? 60),
        });

        setFormSeed((prev) => prev + 1);
      } catch (err: any) {
        if (!cancelled) setInitialLoadError(err?.message || "Failed to load activity data.");
      } finally {
        if (!cancelled) setIsInitialLoading(false);
      }
    }

    loadActivity();
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
      const xpValue = Number(xpRef.current?.value || formDefaults.xpReward);
      const maxPart = isUnlimitedRef.current ? 0 : Number(maxParticipantsRef.current?.value || 0);

      const payload = {
        activity_name: activityTitle,
        activity_detail: descriptionRef.current?.value?.trim() || "",
        activity_type: "challenge",
        status: selectedActivityStatus === "publish" ? "published" : "draft",
        visibility: selectedAudience === "everyone" ? "public" : "invited",
        is_open_ended: selectedParticipation === "joinAnytime",
        max_participants: maxPart,
        hours: xpValue,
        enroll_start_at: buildIsoDateTime(enrollmentRangeRef.current.startDate, enrollmentRangeRef.current.startTime),
        enroll_end_at: buildIsoDateTime(enrollmentRangeRef.current.endDate, enrollmentRangeRef.current.endTime),
        run_start_at: buildIsoDateTime(activityRangeRef.current.startDate, activityRangeRef.current.startTime),
        run_end_at: buildIsoDateTime(activityRangeRef.current.endDate, activityRangeRef.current.endTime),
        skills: skillItemsRef.current
          .filter((s) => s.skillId)
          .map((s) => ({
            skill_id: s.skillId!,
            skill_level: SKILL_LEVEL_OPTIONS.indexOf(s.skillLevel),
          })),
        challenge_info: {
          problem_statement: problemStatementRef.current?.value?.trim() || "",
          description: goalOutcomeRef.current?.value?.trim() || "",
          level: selectedLevel,
          submit_type: submissionReqsRef.current?.value?.trim() || "",
        },
        ...(isEditMode ? { activity_id: editActivityId } : {}),
      };

      const response = await fetch("/api/organization/activity/challenge", {
        method: isEditMode ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        throw new Error(data?.message || `Request failed: ${response.status}`);
      }
      setSubmitSuccess(true);
      const targetId =
        data?.activity_id ?? data?.id ?? data?.activity?.activity_id ?? editActivityId ?? null;
      if (targetId) {
        router.push(`/organization/activities/${encodeURIComponent(String(targetId))}`);
      } else {
        router.push("/organization/dashboard");
      }
    } catch (error: any) {
      setSubmitError(error?.message || "Failed to save activity. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isInitialLoading) {
    return <div style={{ padding: 40, textAlign: "center" }}>Loading activity...</div>;
  }

  if (initialLoadError) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#b91c1c" }}>
        {initialLoadError}
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
            style={{ marginLeft: 12, background: "none", border: "none", cursor: "pointer", color: "#b91c1c", fontWeight: 700 }}
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

      <div key={formSeed} className={styles.column}>
        <ActivityInformationSection
          titleRef={activityTitleRef}
          descriptionRef={descriptionRef}
          defaultTitle={formDefaults.activityTitle}
          defaultDescription={formDefaults.description}
        />

        <ActivityTypeSelector
          selectedType={selectedActivityType}
          onSelectType={handleSelectActivityType}
        />

        <ChallengeSpecificationSection
          selectedLevel={selectedLevel}
          onSelectLevel={setSelectedLevel}
          problemStatementRef={problemStatementRef}
          goalOutcomeRef={goalOutcomeRef}
          submissionReqsRef={submissionReqsRef}
          defaultProblemStatement={formDefaults.problemStatement}
          defaultGoalOutcome={formDefaults.goalExpectedOutcome}
          defaultSubmissionReqs={formDefaults.submissionRequirements}
        />
      </div>

      <div className={styles.column}>
        <ActivityStatusSection
          selectedStatus={selectedActivityStatus}
          onSelectStatus={setSelectedActivityStatus}
        />

        <SkillsAndRewardsSection
          xpRef={xpRef}
          defaultXp={formDefaults.xpReward}
          defaultSkillItems={initialSkillItems}
          onSkillsChange={(items) => {
            skillItemsRef.current = items;
          }}
        />

        <AccessAndScheduleSection
          selectedAudience={selectedAudience}
          onSelectAudience={setSelectedAudience}
          selectedParticipation={selectedParticipation}
          onSelectParticipation={setSelectedParticipation}
          maxParticipantsRef={maxParticipantsRef}
          defaultMaxParticipants={formDefaults.maxParticipants}
          defaultIsUnlimited={isUnlimitedRef.current}
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
          onIsUnlimitedChange={(v) => {
            isUnlimitedRef.current = v;
          }}
          onEnrollmentRangeChange={(v) => {
            enrollmentRangeRef.current = v;
          }}
          onActivityRangeChange={(v) => {
            activityRangeRef.current = v;
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
