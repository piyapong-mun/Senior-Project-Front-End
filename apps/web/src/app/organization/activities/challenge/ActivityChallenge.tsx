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

type RangePickerKey = "startDate" | "startTime" | "endDate" | "endTime" | null;

type RangeValue = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
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

const SKILL_PROGRESS_LIST: SkillProgressItem[] = [
  {
    id: "skill-01",
    skillName: "Performance Analysis",
    skillLevel: "Applying",
  },
  {
    id: "skill-02",
    skillName: "Performance Analysis",
    skillLevel: "Analyzing",
  },
  {
    id: "skill-03",
    skillName: "Performance Analysis",
    skillLevel: "Creating",
  },
];

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
            className={`${styles.segmentButton} ${selectedType === option.value ? styles.segmentButtonActive : ""
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

function ActivityInformationSection() {
  return (
    <SectionCard className={styles.infoPanel}>
      <label className={styles.labelText}>Activity Title</label>
      <input
        className={styles.largeInput}
        placeholder="Body"
        defaultValue={FORM_DEFAULTS.activityTitle}
      />

      <label className={styles.labelText}>Description</label>
      <textarea
        className={styles.descriptionTextarea}
        placeholder="Body"
        defaultValue={FORM_DEFAULTS.description}
      />
    </SectionCard>
  );
}

function ChallengeSpecificationSection({
  selectedLevel,
  onSelectLevel,
}: {
  selectedLevel: ChallengeLevel;
  onSelectLevel: (value: ChallengeLevel) => void;
}) {
  return (
    <SectionCard className={`${styles.detailsPanel} ${styles.challengeDetailsPanel}`}>
      <div className={styles.challengeFields}>
        <div className={styles.challengeFieldBlock}>
          <label className={styles.sectionTitle}>Problem statement</label>
          <textarea
            className={`${styles.bioTextarea} ${styles.challengeTextarea}`}
            placeholder="description"
            defaultValue={FORM_DEFAULTS.problemStatement}
          />
        </div>

        <div className={styles.challengeFieldBlock}>
          <label className={styles.sectionTitle}>Goal / expected outcome</label>
          <textarea
            className={`${styles.bioTextarea} ${styles.challengeTextarea}`}
            placeholder="description"
            defaultValue={FORM_DEFAULTS.goalExpectedOutcome}
          />
        </div>

        <div className={styles.challengeFieldBlock}>
          <div className={styles.challengeLevelGrid}>
            {CHALLENGE_LEVEL_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`${styles.challengeLevelButton} ${selectedLevel === option.value
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
            className={`${styles.bioTextarea} ${styles.submissionTextarea}`}
            placeholder="file, link (GitHub/Figma), video demo, pictures"
            defaultValue={FORM_DEFAULTS.submissionRequirements}
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
          className={`${styles.actionButton} ${selectedStatus === "draft"
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
          className={`${styles.actionButton} ${selectedStatus === "publish"
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
    if (!isOpen) {
      setIsSkillDropdownOpen(false);
    }
  }, [isOpen]);

  const filteredSkills = useMemo(() => {
    const keyword = formValue.searchText.trim().toLowerCase();

    if (!keyword) {
      return availableSkills.slice(0, 10);
    }

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

function SkillsAndRewardsSection() {
  const [skillItems, setSkillItems] = useState<SkillProgressItem[]>(SKILL_PROGRESS_LIST);
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

        <div className={styles.rewardStatsGrid}>
          <div className={styles.rewardCell}>
            <div className={styles.rewardTitle}>XP</div>
            <div className={styles.xpValueBox}>{FORM_DEFAULTS.xpReward}</div>
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
            className={`${styles.calendarWeekDay} ${day === "Sun" || day === "Sat" ? styles.calendarWeekDayAccent : ""
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
              className={`${styles.calendarDayButton} ${!cell.isCurrentMonth ? styles.calendarDayMuted : ""
                } ${cell.isWeekend ? styles.calendarDayWeekend : ""} ${isInRange ? styles.calendarDayInRange : ""
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
            className={`${styles.timeOptionButton} ${selectedTime === time ? styles.timeOptionButtonActive : ""
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

function DateRangeSection({
  title,
  startDateDefault,
  startTimeDefault,
  endDateDefault,
  endTimeDefault,
}: {
  title: string;
  startDateDefault: string;
  startTimeDefault: string;
  endDateDefault: string;
  endTimeDefault: string;
}) {
  const [rangeValue, setRangeValue] = useState<RangeValue>({
    startDate: startDateDefault,
    startTime: startTimeDefault,
    endDate: endDateDefault,
    endTime: endTimeDefault,
  });

  const [openPicker, setOpenPicker] = useState<RangePickerKey>(null);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const initialDate = parseIsoDate(startDateDefault) ?? new Date();
    return new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
  });

  useEffect(() => {
    if (!openPicker) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!sectionRef.current?.contains(event.target as Node)) {
        setOpenPicker(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenPicker(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openPicker]);

  const handleSelectDate = (field: "startDate" | "endDate", value: string) => {
    setRangeValue((previous) => ({ ...previous, [field]: value }));
    setOpenPicker(null);
  };

  const handleSelectTime = (field: "startTime" | "endTime", value: string) => {
    setRangeValue((previous) => ({ ...previous, [field]: value }));
    setOpenPicker(null);
  };

  return (
    <div className={styles.periodSection} ref={sectionRef}>
      <div className={styles.periodTitle}>{title}</div>

      <div className={styles.periodGrid}>
        <div className={styles.periodColumn}>
          <div className={styles.periodLabel}>Start</div>

          <div className={styles.periodFieldGrid}>
            <div className={styles.periodFieldWrap}>
              <button
                type="button"
                className={`${styles.dateTriggerButton} ${
                  openPicker === "startDate" ? styles.triggerButtonActive : ""
                }`}
                onClick={() =>
                  setOpenPicker((previous) =>
                    previous === "startDate" ? null : "startDate"
                  )
                }
              >
                {formatDateDisplay(rangeValue.startDate)}
              </button>

              {openPicker === "startDate" && (
                <div className={styles.floatingPicker}>
                  <CalendarPopup
                    visibleMonth={visibleMonth}
                    startDate={rangeValue.startDate}
                    endDate={rangeValue.endDate}
                    onPreviousMonth={() =>
                      setVisibleMonth(
                        (previous) =>
                          new Date(previous.getFullYear(), previous.getMonth() - 1, 1)
                      )
                    }
                    onNextMonth={() =>
                      setVisibleMonth(
                        (previous) =>
                          new Date(previous.getFullYear(), previous.getMonth() + 1, 1)
                      )
                    }
                    onSelectDate={(value) => handleSelectDate("startDate", value)}
                  />
                </div>
              )}
            </div>

            <div className={styles.periodFieldWrap}>
              <button
                type="button"
                className={`${styles.timeTriggerButton} ${
                  openPicker === "startTime" ? styles.triggerButtonActive : ""
                }`}
                onClick={() =>
                  setOpenPicker((previous) =>
                    previous === "startTime" ? null : "startTime"
                  )
                }
              >
                {rangeValue.startTime || "time"}
              </button>

              {openPicker === "startTime" && (
                <div className={styles.floatingPicker}>
                  <TimePopup
                    selectedTime={rangeValue.startTime}
                    onSelectTime={(value) => handleSelectTime("startTime", value)}
                  />
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
                className={`${styles.dateTriggerButton} ${
                  openPicker === "endDate" ? styles.triggerButtonActive : ""
                }`}
                onClick={() =>
                  setOpenPicker((previous) =>
                    previous === "endDate" ? null : "endDate"
                  )
                }
              >
                {formatDateDisplay(rangeValue.endDate)}
              </button>

              {openPicker === "endDate" && (
                <div className={`${styles.floatingPicker} ${styles.floatingPickerRight}`}>
                  <CalendarPopup
                    visibleMonth={visibleMonth}
                    startDate={rangeValue.startDate}
                    endDate={rangeValue.endDate}
                    onPreviousMonth={() =>
                      setVisibleMonth(
                        (previous) =>
                          new Date(previous.getFullYear(), previous.getMonth() - 1, 1)
                      )
                    }
                    onNextMonth={() =>
                      setVisibleMonth(
                        (previous) =>
                          new Date(previous.getFullYear(), previous.getMonth() + 1, 1)
                      )
                    }
                    onSelectDate={(value) => handleSelectDate("endDate", value)}
                  />
                </div>
              )}
            </div>

            <div className={styles.periodFieldWrap}>
              <button
                type="button"
                className={`${styles.timeTriggerButton} ${
                  openPicker === "endTime" ? styles.triggerButtonActive : ""
                }`}
                onClick={() =>
                  setOpenPicker((previous) =>
                    previous === "endTime" ? null : "endTime"
                  )
                }
              >
                {rangeValue.endTime || "time"}
              </button>

              {openPicker === "endTime" && (
                <div className={`${styles.floatingPicker} ${styles.floatingPickerRight}`}>
                  <TimePopup
                    selectedTime={rangeValue.endTime}
                    onSelectTime={(value) => handleSelectTime("endTime", value)}
                  />
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
}: {
  selectedAudience: AudienceAccess;
  onSelectAudience: (value: AudienceAccess) => void;
  selectedParticipation: ParticipationMode;
  onSelectParticipation: (value: ParticipationMode) => void;
}) {
  const [isUnlimited, setIsUnlimited] = useState(false);

  return (
    <SectionCard className={styles.settingsPanel}>
      <div className={styles.accessGrid}>
        {AUDIENCE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`${styles.accessCard} ${selectedAudience === option.value ? styles.accessCardActive : ""
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
            className={`${styles.joinModeButton} ${selectedParticipation === option.value
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
            className={styles.maxParticipantInput}
            defaultValue={FORM_DEFAULTS.maxParticipants}
            disabled={isUnlimited}
          />
        </div>

        <button
          type="button"
          className={styles.unlimitedToggle}
          onClick={() => setIsUnlimited((previous) => !previous)}
        >
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
      />

      <div className={styles.divider} />

      <DateRangeSection
        title="Activity Run Period"
        startDateDefault={FORM_DEFAULTS.activityStartDate}
        startTimeDefault={FORM_DEFAULTS.activityStartTime}
        endDateDefault={FORM_DEFAULTS.activityEndDate}
        endTimeDefault={FORM_DEFAULTS.activityEndTime}
      />
    </SectionCard>
  );
}

/* =========================
   Main Page
========================= */
export default function ActivityChallenge() {
  const router = useRouter();
  const [selectedActivityType, setSelectedActivityType] =
    useState<ActivityKind>("challenges");
  const [selectedActivityStatus, setSelectedActivityStatus] =
    useState<ActivityStatus>("publish");
  const [selectedAudience, setSelectedAudience] =
    useState<AudienceAccess>("everyone");
  const [selectedParticipation, setSelectedParticipation] =
    useState<ParticipationMode>("scheduledParticipation");
  const [selectedLevel, setSelectedLevel] =
    useState<ChallengeLevel>("advanced");

  const handleSelectActivityType = (value: ActivityKind) => {
    if (value === selectedActivityType) return;
    setSelectedActivityType(value);
    router.push(ACTIVITY_ROUTE_MAP[value]);
  };

  return (
    <div className={styles.page}>
      <div className={styles.column}>
        <ActivityInformationSection />

        <ActivityTypeSelector
          selectedType={selectedActivityType}
          onSelectType={handleSelectActivityType}
        />

        <ChallengeSpecificationSection
          selectedLevel={selectedLevel}
          onSelectLevel={setSelectedLevel}
        />
      </div>

      <div className={styles.column}>
        <ActivityStatusSection
          selectedStatus={selectedActivityStatus}
          onSelectStatus={setSelectedActivityStatus}
        />

        <SkillsAndRewardsSection />

        <AccessAndScheduleSection
          selectedAudience={selectedAudience}
          onSelectAudience={setSelectedAudience}
          selectedParticipation={selectedParticipation}
          onSelectParticipation={setSelectedParticipation}
        />
      </div>
    </div>
  );
}
