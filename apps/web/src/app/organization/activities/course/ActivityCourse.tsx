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
import styles from "./ActivityCourse.module.css";

/* =========================
   Types
========================= */
type ActivityKind = "meetings" | "courses" | "challenges";
type ActivityStatus = "draft" | "publish";
type AudienceAccess = "invitedOnly" | "everyone";
type ParticipationMode = "joinAnytime" | "scheduledParticipation";
type ContentType = "video" | "article";
type AssessmentTab = "quiz";
type QuestionType = "multipleChoice" | "shortAnswer";

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


type RangeValue = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
};

type DateRangeSectionProps = {
  title: string;
  value: RangeValue;
  onChange: (value: RangeValue) => void;
};

type QuestionChoice = {
  id: string;
  text: string;
  isCorrect: boolean;
};

type QuizQuestion = {
  id: string;
  prompt: string;
  questionType: QuestionType;
  choices: QuestionChoice[];
  answerText: string;
};

type QuizConfig = {
  quizTitle: string;
  passingScore: string;
  attemptsAllowed: string;
  timeLimit: string;
  questions: QuizQuestion[];
};

type AssignmentConfig = {
  title: string;
  instructions: string;
  submissionType: string;
};

type LessonItem = {
  id: string;
  title: string;
  contentType: ContentType;
  url: string;
  notes: string;
  hasQuiz: boolean;
  hasAssignment: boolean;
  quiz: QuizConfig;
  assignment: AssignmentConfig;
};

type ModuleItem = {
  id: string;
  title: string;
  lessons: LessonItem[];
};

function createEmptyUploadState(): UploadPreviewState {
  return {
    file: null,
    previewUrl: "",
    mimeType: "",
    fileName: "",
  };
}

function createDefaultQuestion(index: number): QuizQuestion {
  return {
    id: `question-${Date.now()}-${index}`,
    prompt: "",
    questionType: "multipleChoice",
    choices: [
      { id: `choice-${Date.now()}-${index}-1`, text: "", isCorrect: true },
      { id: `choice-${Date.now()}-${index}-2`, text: "", isCorrect: false },
    ],
    answerText: "",
  };
}

function createDefaultLesson(index: number): LessonItem {
  return {
    id: `lesson-${Date.now()}-${index}`,
    title: `Lesson${index + 1}`,
    contentType: "video",
    url: "",
    notes: "",
    hasQuiz: true,
    hasAssignment: false,
    quiz: {
      quizTitle: "",
      passingScore: "",
      attemptsAllowed: "",
      timeLimit: "",
      questions: [createDefaultQuestion(index)],
    },
    assignment: {
      title: "",
      instructions: "",
      submissionType: "File upload / link",
    },
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

const CONTENT_TYPE_OPTIONS: ChoiceOption<ContentType>[] = [
  { value: "video", label: "Video" },
  { value: "article", label: "Article" },
];

const QUESTION_TYPE_OPTIONS: ChoiceOption<QuestionType>[] = [
  { value: "multipleChoice", label: "Multiple choice" },
  { value: "shortAnswer", label: "Fill answer" },
];

const SKILL_PROGRESS_LIST: SkillProgressItem[] = [];

const FORM_DEFAULTS = {
  activityTitle: "",
  description: "",
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

const INITIAL_MODULES: ModuleItem[] = [];

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
  const safe = (!date || isNaN(date.getTime())) ? new Date() : date;
  return safe.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function buildCalendarCells(viewMonth: Date) {
  // Guard against invalid date (NaN) — fallback to current month
  const safeDate = isNaN(viewMonth.getTime()) ? new Date() : viewMonth;
  const year = safeDate.getFullYear();
  const month = safeDate.getMonth();
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

function getModuleLessonsHeading(moduleTitle: string) {
  const trimmedTitle = moduleTitle.trim();

  if (!trimmedTitle) return "Module: Lessons";

  if (/\:\s*untitled$/i.test(trimmedTitle)) {
    return trimmedTitle.replace(/\:\s*untitled$/i, ": Lessons");
  }

  if (/\:\s*lessons$/i.test(trimmedTitle)) {
    return trimmedTitle;
  }

  return `${trimmedTitle}: Lessons`;
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
   Top Sections
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

function ActivityInformationSection({
  activityTitle,
  description,
  hours,
  onTitleChange,
  onDescriptionChange,
  onHoursChange,
}: {
  activityTitle: string;
  description: string;
  hours: string;
  onTitleChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onHoursChange: (v: string) => void;
}) {
  return (
    <SectionCard className={styles.infoPanel}>
      <label className={styles.labelText}>Activity Title</label>
      <input
        className={styles.largeInput}
        placeholder="Activity title"
        value={activityTitle}
        onChange={(e) => onTitleChange(e.target.value)}
      />

      <label className={styles.labelText}>Description</label>
      <textarea
        className={styles.descriptionTextarea}
        placeholder="Describe what participants will learn or do in this course"
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
      />

      <label className={styles.labelText}>Course Hours</label>
      <input
        className={styles.largeInput}
        placeholder="Total hours (e.g. 10)"
        value={hours}
        onChange={(e) => onHoursChange(e.target.value)}
        type="number"
        min="0"
      />
    </SectionCard>
  );
}

function CourseModulesSection({
  modules,
  selectedModuleId,
  selectedModuleTitle,
  onSelectModule,
  onAddModule,
  onUpdateModuleTitle,
}: {
  modules: ModuleItem[];
  selectedModuleId: string;
  selectedModuleTitle: string;
  onSelectModule: (moduleId: string) => void;
  onAddModule: () => void;
  onUpdateModuleTitle: (nextTitle: string) => void;
}) {
  return (
    <SectionCard className={styles.courseModulesPanel}>
      <div className={styles.coursePanelHeader}>
        <div className={styles.coursePanelTitle}>Module</div>
        <button
          type="button"
          className={styles.squareIconButton}
          onClick={onAddModule}
          aria-label="Add module"
          title="Add module"
        >
          +
        </button>
      </div>

      <div className={styles.headerDivider} />

      <div className={styles.courseModuleTitleEditor}>
        <label className={styles.sectionTitle}>Module Name</label>
        <input
          className={`${styles.fullWidthInput} ${styles.courseModuleNameInput}`}
          value={selectedModuleTitle}
          onChange={(event) => onUpdateModuleTitle(event.target.value)}
          placeholder="Module name"
        />
      </div>

      <div className={styles.courseModuleScrollArea}>
        <div className={styles.courseModuleList}>
          {modules.map((module) => {
            const isActive = module.id === selectedModuleId;

            return (
              <button
                key={module.id}
                type="button"
                className={`${styles.courseModuleCard} ${isActive ? styles.courseModuleCardActive : ""
                  }`}
                onClick={() => onSelectModule(module.id)}
              >
                <div className={styles.courseModuleCardTitle}>{module.title}</div>
                <div className={styles.courseModuleCardLessons}>
                  {module.lessons.length === 0
                    ? "No lessons yet"
                    : module.lessons.map((lesson, index) => (
                      <div key={lesson.id}>{`lesson${index + 1} : ${lesson.title || "untitled"}`}</div>
                    ))}
                </div>
              </button>
            );
          })}
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

/* =========================
   Skills + Rewards
========================= */
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

function SkillsAndRewardsSection({
  skillItems,
  setSkillItems,
  xp,
  setXp,
}: {
  skillItems: SkillProgressItem[];
  setSkillItems: Dispatch<SetStateAction<SkillProgressItem[]>>;
  xp: string;
  setXp: (v: string) => void;
}) {
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
            <div className={styles.rewardTitle}>XP / Hours</div>
            <input
              className={styles.xpValueBox}
              value={xp}
              onChange={(e) => setXp(e.target.value)}
              type="number"
              min="0"
              placeholder="0"
              style={{ width: "80px", textAlign: "center", fontWeight: 500, fontSize: 16 }}
            />
          </div>

          <div className={styles.rewardCell}>
            <div className={styles.rewardTitle}>Badges</div>
            <RewardUploadBox
              title="Badge"
              inputId="course-badge-upload-input"
              upload={badgeUpload}
              onFileChange={handleRewardFileChange(setBadgeUpload)}
              onClear={clearRewardUpload(setBadgeUpload)}
            />
          </div>

          <div className={styles.rewardCell}>
            <div className={styles.rewardTitle}>Certificate</div>
            <RewardUploadBox
              title="Certificate"
              inputId="course-certificate-upload-input"
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

/* =========================
   Date / Time Sections
========================= */
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

type ChainedPickerSide = "start" | "end" | null;
type ChainedPickerStep = "date" | "time";

function DateRangeSection({
  title,
  value: rangeValue,
  onChange,
}: DateRangeSectionProps) {
  const setRangeValue = (next: RangeValue | ((prev: RangeValue) => RangeValue)) => {
    const resolved = typeof next === "function" ? next(rangeValue) : next;
    onChange(resolved);
  };
  const [openSide, setOpenSide] = useState<ChainedPickerSide>(null);
  const [pickerStep, setPickerStep] = useState<ChainedPickerStep>("date");
  const [flipUp, setFlipUp] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => {
    if (rangeValue.startDate) {
      const d = parseIsoDate(rangeValue.startDate);
      if (d && !isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const startTriggerRef = useRef<HTMLButtonElement | null>(null);
  const endTriggerRef = useRef<HTMLButtonElement | null>(null);

  // Sync visibleMonth when external value changes (edit mode pre-fill)
  useEffect(() => {
    if (rangeValue.startDate) {
      const d = parseIsoDate(rangeValue.startDate);
      if (d && !isNaN(d.getTime())) {
        setVisibleMonth(new Date(d.getFullYear(), d.getMonth(), 1));
      }
    } else {
      // No date set — show current month
      const now = new Date();
      setVisibleMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    }
  }, [rangeValue.startDate]);

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
  maxParticipants,
  onMaxParticipantsChange,
  enrollRange,
  onEnrollRangeChange,
  activityRange,
  onActivityRangeChange,
}: {
  selectedAudience: AudienceAccess;
  onSelectAudience: (value: AudienceAccess) => void;
  selectedParticipation: ParticipationMode;
  onSelectParticipation: (value: ParticipationMode) => void;
  maxParticipants: string;
  onMaxParticipantsChange: (v: string) => void;
  enrollRange: RangeValue;
  onEnrollRangeChange: (value: RangeValue) => void;
  activityRange: RangeValue;
  onActivityRangeChange: (value: RangeValue) => void;
}) {
  const [isUnlimited, setIsUnlimited] = useState(true);

  return (
    <SectionCard className={styles.settingsPanel}>
      <div className={styles.settingsScrollArea}>
        <div className={styles.accessGrid}>
          {AUDIENCE_OPTIONS.map((option) => (
            <div
              key={option.value}
              className={`${styles.accessCard} ${selectedAudience === option.value ? styles.accessCardActive : ""}`}
              style={{ cursor: "default", opacity: option.value !== selectedAudience ? 0.4 : 1 }}
            >
              <div className={styles.accessTitle}>{option.label}</div>
              <AudienceIllustration value={option.value} />
            </div>
          ))}
        </div>

        <div className={styles.divider} />

        <div className={styles.joinModeGrid}>
          {PARTICIPATION_OPTIONS.map((option) => (
            <div
              key={option.value}
              className={`${styles.joinModeButton} ${selectedParticipation === option.value ? styles.joinModeButtonActive : ""}`}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", cursor: "default", opacity: option.value !== selectedParticipation ? 0.4 : 1 }}
            >
              {option.label}
            </div>
          ))}
        </div>

        <div className={styles.divider} />

        <div className={styles.maxParticipantRow}>
          <div className={styles.maxParticipantGroup}>
            <label className={styles.maxParticipantLabel}>Max Participants</label>
            <input
              className={styles.maxParticipantInput}
              value={isUnlimited ? "0" : maxParticipants}
              onChange={(e) => onMaxParticipantsChange(e.target.value)}
              disabled={isUnlimited}
              type="number"
              min="0"
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
          value={enrollRange}
          onChange={onEnrollRangeChange}
        />

        <div className={styles.divider} />

        <DateRangeSection
          title="Activity Run Period"
          value={activityRange}
          onChange={onActivityRangeChange}
        />
      </div>
    </SectionCard>
  );
}

/* =========================
   Course Builder
========================= */
function CourseBuilderSection({
  selectedModule,
  selectedLessonId,
  assessmentTab,
  onSelectLesson,
  onSelectAssessmentTab,
  onAddLesson,
  onUpdateLesson,
  onToggleLessonFlag,
  onAddQuestion,
  onRemoveQuestion,
  onUpdateQuestion,
  onAddChoice,
  onUpdateChoice,
  onSetCorrectChoice,
  onRemoveChoice,
}: {
  selectedModule: ModuleItem | null;
  selectedLessonId: string;
  assessmentTab: AssessmentTab;
  onSelectLesson: (lessonId: string) => void;
  onSelectAssessmentTab: (value: AssessmentTab) => void;
  onAddLesson: () => void;
  onUpdateLesson: (updater: (lesson: LessonItem) => LessonItem) => void;
  onToggleLessonFlag: (field: "hasQuiz" | "hasAssignment") => void;
  onAddQuestion: () => void;
  onRemoveQuestion: (questionId: string) => void;
  onUpdateQuestion: (questionId: string, updater: (question: QuizQuestion) => QuizQuestion) => void;
  onAddChoice: (questionId: string) => void;
  onUpdateChoice: (questionId: string, choiceId: string, text: string) => void;
  onSetCorrectChoice: (questionId: string, choiceId: string) => void;
  onRemoveChoice: (questionId: string, choiceId: string) => void;
}) {
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("");

  const selectedLesson = useMemo(() => {
    return selectedModule?.lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;
  }, [selectedLessonId, selectedModule]);

  const quizQuestions = selectedLesson?.quiz.questions ?? [];

  // Auto-select first question when lesson changes or question list changes
  useEffect(() => {
    if (quizQuestions.length > 0) {
      setSelectedQuestionId((prev) =>
        quizQuestions.find((q) => q.id === prev) ? prev : quizQuestions[0].id
      );
    } else {
      setSelectedQuestionId("");
    }
  }, [selectedLessonId, quizQuestions.length]);

  if (!selectedModule || !selectedLesson) {
    return (
      <SectionCard className={styles.courseEditorPanel}>
        <div className={styles.courseEditorEmpty}>Select or create a module and lesson to continue.</div>
      </SectionCard>
    );
  }

  return (
    <SectionCard className={styles.courseEditorPanel}>
      <div className={styles.courseEditorGrid}>
        <div className={styles.courseEditorColumn}>
          <div className={styles.coursePanelHeader}>
            <div className={styles.coursePanelTitle}>{getModuleLessonsHeading(selectedModule.title)}</div>
            <button
              type="button"
              className={styles.squareIconButton}
              onClick={onAddLesson}
              aria-label="Add lesson"
              title="Add lesson"
            >
              +
            </button>
          </div>

          <div className={styles.headerDivider} />

          <div className={styles.lessonTabs}>
            {selectedModule.lessons.map((lesson, index) => (
              <button
                key={lesson.id}
                type="button"
                className={`${styles.lessonTab} ${lesson.id === selectedLessonId ? styles.lessonTabActive : ""
                  }`}
                onClick={() => onSelectLesson(lesson.id)}
              >
                {lesson.title || `Lesson${index + 1}`}
              </button>
            ))}
          </div>

          <div className={styles.lessonForm}>
            <label className={styles.sectionTitle}>Title</label>
            <input
              className={styles.fullWidthInput}
              value={selectedLesson.title}
              onChange={(event) =>
                onUpdateLesson((lesson) => ({ ...lesson, title: event.target.value }))
              }
              placeholder="..."
            />

            <label className={styles.sectionTitle}>Content type</label>
            <select
              className={styles.fullWidthInput}
              value={selectedLesson.contentType}
              onChange={(event) =>
                onUpdateLesson((lesson) => ({
                  ...lesson,
                  contentType: event.target.value as ContentType,
                }))
              }
            >
              {CONTENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <label className={styles.sectionTitle}>URL</label>
            <input
              className={styles.fullWidthInput}
              value={selectedLesson.url}
              onChange={(event) =>
                onUpdateLesson((lesson) => ({ ...lesson, url: event.target.value }))
              }
              placeholder="Tip: keep video under ~10–15 minutes per lesson for better completion."
            />

            <label className={styles.sectionTitle}>Notes</label>
            <textarea
              className={`${styles.bioTextarea} ${styles.courseNotesTextarea}`}
              value={selectedLesson.notes}
              onChange={(event) =>
                onUpdateLesson((lesson) => ({ ...lesson, notes: event.target.value }))
              }
              placeholder="description"
            />
          </div>

          <div className={styles.lessonFeatureRow}>
            <button
              type="button"
              className={styles.lessonFeatureButton}
              onClick={() => onToggleLessonFlag("hasQuiz")}
            >
              <CheckBoxIcon checked={selectedLesson.hasQuiz} />
              <span>Quiz</span>
            </button>

            {/* <button
              type="button"
              className={styles.lessonFeatureButton}
              onClick={() => onToggleLessonFlag("hasAssignment")}
            >
              <CheckBoxIcon checked={selectedLesson.hasAssignment} />
              <span>Assignment</span>
            </button> */}
          </div>
        </div>

        <div className={styles.verticalDivider} />

        <div className={styles.courseEditorColumn}>
          {!selectedLesson.hasQuiz ? (
            <div className={styles.quizDisabledPlaceholder}>
              Enable Quiz on the left to configure questions.
            </div>
          ) : (
            <>
              <div className={styles.assessmentTabs}>
                <button
                  type="button"
                  className={`${styles.assessmentTab} ${assessmentTab === "quiz" ? styles.assessmentTabActive : ""}`}
                  onClick={() => onSelectAssessmentTab("quiz")}
                >
                  Quiz
                </button>
              </div>

              {assessmentTab === "quiz" && (
                <>
                  <div className={styles.quizFieldGrid}>
                    <div className={styles.quizFieldBlock}>
                      <label className={styles.sectionTitle}>Quiz Title</label>
                      <input
                        className={styles.fullWidthInput}
                        value={selectedLesson.quiz.quizTitle}
                        onChange={(event) =>
                          onUpdateLesson((lesson) => ({
                            ...lesson,
                            quiz: { ...lesson.quiz, quizTitle: event.target.value },
                          }))
                        }
                        placeholder="..."
                      />
                    </div>

                    <div className={styles.quizFieldBlock}>
                      <label className={styles.sectionTitle}>Passing Score (%)</label>
                      <input
                        className={styles.fullWidthInput}
                        value={selectedLesson.quiz.passingScore}
                        onChange={(event) =>
                          onUpdateLesson((lesson) => ({
                            ...lesson,
                            quiz: { ...lesson.quiz, passingScore: event.target.value },
                          }))
                        }
                        placeholder="..."
                      />
                    </div>

                    <div className={styles.quizFieldBlock}>
                      <label className={styles.sectionTitle}>Attempts Allowed</label>
                      <input
                        className={styles.fullWidthInput}
                        value={selectedLesson.quiz.attemptsAllowed}
                        onChange={(event) =>
                          onUpdateLesson((lesson) => ({
                            ...lesson,
                            quiz: { ...lesson.quiz, attemptsAllowed: event.target.value },
                          }))
                        }
                        placeholder="..."
                      />
                    </div>

                    <div className={styles.quizFieldBlock}>
                      <label className={styles.sectionTitle}>Time Limit</label>
                      <input
                        className={styles.fullWidthInput}
                        value={selectedLesson.quiz.timeLimit}
                        onChange={(event) =>
                          onUpdateLesson((lesson) => ({
                            ...lesson,
                            quiz: { ...lesson.quiz, timeLimit: event.target.value },
                          }))
                        }
                        placeholder="..."
                      />
                    </div>
                  </div>

                  <div className={styles.headerDivider} />

                  {/* Questions — tab-based selector */}
                  <div className={styles.questionSectionHeader}>
                    <div className={styles.coursePanelTitleSmall}>Questions</div>
                    <button
                      type="button"
                      className={styles.smallOutlineButton}
                      onClick={() => {
                        onAddQuestion();
                        // select the new question after add (it will be last)
                        setTimeout(() => {
                          setSelectedQuestionId(
                            selectedLesson.quiz.questions[selectedLesson.quiz.questions.length - 1]?.id ?? ""
                          );
                        }, 0);
                      }}
                    >
                      +
                    </button>
                  </div>

                  {/* Question tab strip */}
                  <div className={styles.questionTabStrip}>
                    {quizQuestions.map((question, index) => (
                      <button
                        key={question.id}
                        type="button"
                        className={`${styles.questionTab} ${selectedQuestionId === question.id ? styles.questionTabActive : ""}`}
                        onClick={() => setSelectedQuestionId(question.id)}
                      >
                        {`Q${index + 1}`}
                      </button>
                    ))}
                  </div>

                  {/* Selected question editor */}
                  {(() => {
                    const question = quizQuestions.find((q) => q.id === selectedQuestionId);
                    if (!question) return null;
                    return (
                      <div className={styles.questionCard}>
                        <div className={styles.questionTopRow}>
                          <div className={styles.questionLabel}>
                            {`Q${quizQuestions.indexOf(question) + 1}`}
                          </div>
                          <button
                            type="button"
                            className={styles.smallGhostButton}
                            onClick={() => {
                              const idx = quizQuestions.indexOf(question);
                              onRemoveQuestion(question.id);
                              const next = quizQuestions[idx - 1] ?? quizQuestions[idx + 1];
                              if (next) setSelectedQuestionId(next.id);
                            }}
                            disabled={quizQuestions.length === 1}
                            title="Remove question"
                          >
                            ×
                          </button>
                        </div>

                        <textarea
                          className={`${styles.bioTextarea} ${styles.questionPromptTextarea}`}
                          value={question.prompt}
                          onChange={(event) =>
                            onUpdateQuestion(question.id, (q) => ({ ...q, prompt: event.target.value }))
                          }
                          placeholder="description"
                        />

                        <label className={styles.sectionTitle}>Question Type</label>
                        <select
                          className={styles.fullWidthInput}
                          value={question.questionType}
                          onChange={(event) =>
                            onUpdateQuestion(question.id, (q) => ({
                              ...q,
                              questionType: event.target.value as QuestionType,
                            }))
                          }
                        >
                          {QUESTION_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>

                        {question.questionType === "multipleChoice" ? (
                          <div className={styles.choiceListWrap}>
                            <div className={styles.sectionTitle}>Choices</div>
                            <div className={styles.choiceList}>
                              {question.choices.map((choice, choiceIndex) => (
                                <div key={choice.id} className={styles.choiceRow}>
                                  <input
                                    className={styles.choiceInput}
                                    value={choice.text}
                                    onChange={(event) =>
                                      onUpdateChoice(question.id, choice.id, event.target.value)
                                    }
                                    placeholder={`${choiceIndex + 1}.`}
                                  />
                                  <button
                                    type="button"
                                    className={`${styles.choiceActionButton} ${choice.isCorrect ? styles.choiceActionButtonActive : ""}`}
                                    onClick={() => onSetCorrectChoice(question.id, choice.id)}
                                    title="Set as correct"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.choiceDeleteButton}
                                    onClick={() => onRemoveChoice(question.id, choice.id)}
                                    disabled={question.choices.length <= 2}
                                    title="Remove choice"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                            <button
                              type="button"
                              className={styles.smallOutlineButton}
                              onClick={() => onAddChoice(question.id)}
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <div className={styles.choiceListWrap}>
                            <div className={styles.sectionTitle}>Answer</div>
                            <input
                              className={styles.fullWidthInput}
                              value={question.answerText}
                              onChange={(event) =>
                                onUpdateQuestion(question.id, (q) => ({
                                  ...q,
                                  answerText: event.target.value,
                                }))
                              }
                              placeholder="Type the expected answer"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

/* =========================
   Main Page
========================= */
export default function ActivityCourse() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit") ?? "";
  const isEditMode = !!editId;

  const [selectedActivityType, setSelectedActivityType] =
    useState<ActivityKind>("courses");
  const [selectedActivityStatus, setSelectedActivityStatus] =
    useState<ActivityStatus>("draft");
  const [selectedAudience, setSelectedAudience] =
    useState<AudienceAccess>("everyone");
  const [selectedParticipation, setSelectedParticipation] =
    useState<ParticipationMode>("scheduledParticipation");

  // Form fields
  const [activityTitle, setActivityTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("0");

  // Skills lifted from SkillsAndRewardsSection
  const [skillItems, setSkillItems] = useState<SkillProgressItem[]>([]);
  const [xp, setXp] = useState("0");

  // Date ranges
  const [enrollRange, setEnrollRange] = useState<RangeValue>({
    startDate: "", startTime: "", endDate: "", endTime: "",
  });
  const [activityRange, setActivityRange] = useState<RangeValue>({
    startDate: "", startTime: "", endDate: "", endTime: "",
  });

  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [modules, setModules] = useState<ModuleItem[]>(INITIAL_MODULES);
  const [selectedModuleId, setSelectedModuleId] = useState<string>("");
  const [selectedLessonId, setSelectedLessonId] = useState<string>("");
  const [assessmentTab, setAssessmentTab] = useState<AssessmentTab>("quiz");

  // ─── Load existing activity for edit mode ───────────────────────────────────
  useEffect(() => {
    if (!editId) return;

    let cancelled = false;
    setIsLoadingEdit(true);

    async function loadActivity() {
      try {
        // Use ?prefer=course so the [id] route fetches course endpoint first (gets modules)
        const [actRes, skillRes] = await Promise.all([
          fetch(`/api/organization/activity/${encodeURIComponent(editId)}?prefer=course`, { cache: "no-store" }),
          fetch(`/api/organization/activity/${encodeURIComponent(editId)}/skills`, { cache: "no-store" }),
        ]);

        const actData = await actRes.json().catch(() => ({}));
        const skillData = await skillRes.json().catch(() => ({}));

        if (cancelled) return;
        if (!actRes.ok) return;

        const raw = actData?.activity ?? actData ?? {};
        const info = raw?.commonInfo ?? raw?.common_info ?? raw;

        // Basic fields
        setActivityTitle(String(info?.activity_name ?? raw?.activity_name ?? ""));
        // Strip surrounding JSON quotes if backend stored as JSON string (e.g. '"text"')
        const rawDetail = String(info?.activity_detail ?? raw?.activity_detail ?? "");
        const cleanDetail = (() => {
          const t = rawDetail.trim();
          if (t.startsWith('"') && t.endsWith('"')) {
            try { return JSON.parse(t); } catch { return t; }
          }
          return t;
        })();
        setDescription(cleanDetail);
        setHours(String(info?.hours ?? raw?.hours ?? "0"));
        setXp(String(info?.hours ?? raw?.hours ?? "0"));
        setMaxParticipants(String(info?.max_participants ?? raw?.max_participants ?? "0"));

        const status = String(info?.status ?? raw?.status ?? "draft").toLowerCase();
        setSelectedActivityStatus(status === "published" ? "publish" : "draft");

        const vis = String(info?.visibility ?? raw?.visibility ?? "public").toLowerCase();
        setSelectedAudience(vis === "private" ? "invitedOnly" : "everyone");

        const isOpenEnded = Boolean(info?.is_open_ended ?? raw?.is_open_ended ?? false);
        setSelectedParticipation(isOpenEnded ? "joinAnytime" : "scheduledParticipation");

        // Date ranges
        function isoToDateParts(iso: string) {
          if (!iso) return { date: "", time: "" };
          try {
            const d = new Date(iso);
            const date = d.toISOString().slice(0, 10);
            const time = d.toISOString().slice(11, 16);
            return { date, time };
          } catch { return { date: "", time: "" }; }
        }

        const es = isoToDateParts(info?.enroll_start_at ?? raw?.enroll_start_at ?? "");
        const ee = isoToDateParts(info?.enroll_end_at ?? raw?.enroll_end_at ?? "");
        const rs = isoToDateParts(info?.run_start_at ?? raw?.run_start_at ?? "");
        const re = isoToDateParts(info?.run_end_at ?? raw?.run_end_at ?? "");
        setEnrollRange({ startDate: es.date, startTime: es.time, endDate: ee.date, endTime: ee.time });
        setActivityRange({ startDate: rs.date, startTime: rs.time, endDate: re.date, endTime: re.time });

        // Modules
        const rawModules: any[] = Array.isArray(raw?.modules) ? raw.modules : [];
        if (rawModules.length > 0) {
          const loadedModules: ModuleItem[] = rawModules.map((m: any, mi: number) => {
            const lessons: LessonItem[] = Array.isArray(m?.lessons)
              ? m.lessons.map((l: any, li: number) => ({
                  ...createDefaultLesson(li),
                  id: l?.lesson_id ?? `loaded-${mi}-lesson-${li}`,
                  title: String(l?.title ?? `Lesson${li + 1}`),
                  contentType: (l?.type === "article" ? "article" : "video") as ContentType,
                  url: String(l?.data ?? ""),
                }))
              : [{ ...createDefaultLesson(0), id: `loaded-${mi}-lesson-0`, title: "Lesson1" }];
            return {
              id: m?.module_id ?? `loaded-module-${mi}`,
              title: String(m?.module_name ?? `Module${mi + 1}: untitled`),
              lessons,
            };
          });
          setModules(loadedModules);
          setSelectedModuleId(loadedModules[0].id);
          setSelectedLessonId(loadedModules[0].lessons[0]?.id ?? "");
        }

        // Skills
        const rawSkills: any[] = Array.isArray(skillData?.skills) ? skillData.skills
          : Array.isArray(raw?.skills) ? raw.skills : [];
        const LEVELS = ["Remembering","Understanding","Applying","Analyzing","Evaluating","Creating"];
        const loadedSkills: SkillProgressItem[] = rawSkills.map((s: any, i: number) => {
          const skillId = String(s?.skill_id ?? s?.skillID ?? s?.SkillID ?? `skill-${i}`);
          const lvNum = Number(s?.skill_level_value ?? s?.level ?? 0);
          return {
            id: s?.id ?? `loaded-skill-${skillId}-${i}`,
            skillId,
            skillName: String(s?.skill_name ?? s?.skillName ?? `Skill ${i + 1}`),
            skillCategory: String(s?.skill_category ?? s?.skillCategory ?? ""),
            skillLevel: LEVELS[lvNum] ?? LEVELS[0],
          };
        });
        setSkillItems(loadedSkills);
      } catch (e) {
        // silent — form stays empty
      } finally {
        if (!cancelled) setIsLoadingEdit(false);
      }
    }

    loadActivity();
    return () => { cancelled = true; };
  }, [editId]);

  const selectedModule = useMemo(() => {
    return modules.find((module) => module.id === selectedModuleId) ?? null;
  }, [modules, selectedModuleId]);

  useEffect(() => {
    if (!selectedModule) {
      if (modules.length > 0) {
        setSelectedModuleId(modules[0].id);
        setSelectedLessonId(modules[0].lessons[0]?.id ?? "");
      }
      return;
    }

    const lessonStillExists = selectedModule.lessons.some(
      (lesson) => lesson.id === selectedLessonId
    );

    if (!lessonStillExists) {
      setSelectedLessonId(selectedModule.lessons[0]?.id ?? "");
    }
  }, [modules, selectedLessonId, selectedModule]);

  const handleSelectActivityType = (value: ActivityKind) => {
    if (value === selectedActivityType) return;
    setSelectedActivityType(value);
    router.push(ACTIVITY_ROUTE_MAP[value]);
  };

  const handleAddModule = () => {
    const nextIndex = modules.length + 1;
    const newLesson = {
      ...createDefaultLesson(0),
      id: `module-${nextIndex}-lesson-1`,
      title: "Lesson1",
    };
    const newModule: ModuleItem = {
      id: `module-${Date.now()}`,
      title: `Module${nextIndex}: untitled`,
      lessons: [newLesson],
    };

    setModules((previous) => [...previous, newModule]);
    setSelectedModuleId(newModule.id);
    setSelectedLessonId(newLesson.id);
  };

  const handleSelectModule = (moduleId: string) => {
    const nextModule = modules.find((module) => module.id === moduleId);
    setSelectedModuleId(moduleId);
    setSelectedLessonId(nextModule?.lessons[0]?.id ?? "");
  };

  const handleUpdateModuleTitle = (nextTitle: string) => {
    setModules((previous) =>
      previous.map((module) =>
        module.id === selectedModuleId
          ? {
            ...module,
            title: nextTitle,
          }
          : module
      )
    );
  };

  const updateSelectedLesson = (updater: (lesson: LessonItem) => LessonItem) => {
    setModules((previous) =>
      previous.map((module) => {
        if (module.id !== selectedModuleId) return module;

        return {
          ...module,
          lessons: module.lessons.map((lesson) =>
            lesson.id === selectedLessonId ? updater(lesson) : lesson
          ),
        };
      })
    );
  };

  const handleAddLesson = () => {
    setModules((previous) =>
      previous.map((module) => {
        if (module.id !== selectedModuleId) return module;

        const nextIndex = module.lessons.length;
        const newLesson = {
          ...createDefaultLesson(nextIndex),
          id: `${module.id}-lesson-${nextIndex + 1}`,
          title: `Lesson${nextIndex + 1}`,
        };

        setSelectedLessonId(newLesson.id);
        return {
          ...module,
          lessons: [...module.lessons, newLesson],
        };
      })
    );
  };

  const handleToggleLessonFlag = (field: "hasQuiz" | "hasAssignment") => {
    updateSelectedLesson((lesson) => ({ ...lesson, [field]: !lesson[field] }));
  };

  const handleAddQuestion = () => {
    updateSelectedLesson((lesson) => ({
      ...lesson,
      quiz: {
        ...lesson.quiz,
        questions: [
          ...lesson.quiz.questions,
          createDefaultQuestion(lesson.quiz.questions.length),
        ],
      },
    }));
  };

  const handleRemoveQuestion = (questionId: string) => {
    updateSelectedLesson((lesson) => {
      const nextQuestions = lesson.quiz.questions.filter(
        (question) => question.id !== questionId
      );

      return {
        ...lesson,
        quiz: {
          ...lesson.quiz,
          questions: nextQuestions.length > 0 ? nextQuestions : [createDefaultQuestion(0)],
        },
      };
    });
  };

  const handleUpdateQuestion = (
    questionId: string,
    updater: (question: QuizQuestion) => QuizQuestion
  ) => {
    updateSelectedLesson((lesson) => ({
      ...lesson,
      quiz: {
        ...lesson.quiz,
        questions: lesson.quiz.questions.map((question) =>
          question.id === questionId ? updater(question) : question
        ),
      },
    }));
  };

  const handleAddChoice = (questionId: string) => {
    handleUpdateQuestion(questionId, (question) => ({
      ...question,
      choices: [
        ...question.choices,
        {
          id: `${questionId}-choice-${Date.now()}`,
          text: "",
          isCorrect: false,
        },
      ],
    }));
  };

  const handleUpdateChoice = (questionId: string, choiceId: string, text: string) => {
    handleUpdateQuestion(questionId, (question) => ({
      ...question,
      choices: question.choices.map((choice) =>
        choice.id === choiceId ? { ...choice, text } : choice
      ),
    }));
  };

  const handleSetCorrectChoice = (questionId: string, choiceId: string) => {
    handleUpdateQuestion(questionId, (question) => ({
      ...question,
      choices: question.choices.map((choice) => ({
        ...choice,
        isCorrect: choice.id === choiceId,
      })),
    }));
  };

  const handleRemoveChoice = (questionId: string, choiceId: string) => {
    handleUpdateQuestion(questionId, (question) => {
      const nextChoices = question.choices.filter((choice) => choice.id !== choiceId);

      return {
        ...question,
        choices: nextChoices.length >= 2 ? nextChoices : question.choices,
      };
    });
  };

  const handleSubmit = async () => {
    setSubmitError("");
    setSubmitSuccess(false);

    if (!activityTitle.trim()) {
      setSubmitError("กรุณากรอก Activity Title");
      return;
    }

    if (!description.trim()) {
      setSubmitError("กรุณากรอก Description");
      return;
    }

    if (!enrollRange.startDate || !enrollRange.endDate) {
      setSubmitError("กรุณาเลือก Enrollment Period");
      return;
    }

    if (!activityRange.startDate || !activityRange.endDate) {
      setSubmitError("กรุณาเลือก Activity Run Period");
      return;
    }

    setIsSubmitting(true);

    try {
      const toIso = (date: string, time: string) => {
        if (!date) return "";
        const t = time || "00:00";
        return `${date}T${t}:00Z`;
      };

      // Helper: check if string is a real UUID (from backend) vs local temp id
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isRealUuid = (v: string) => UUID_RE.test(v);

      const modulesPayload = modules.map((mod) => ({
        module_name: mod.title,
        description: "",
        // include module_id only if it's a real UUID (edit mode, from backend)
        ...(isEditMode && isRealUuid(mod.id) ? { module_id: mod.id } : {}),
        lessons: mod.lessons.map((lesson) => ({
          title: lesson.title,
          type: lesson.contentType,
          data: lesson.url || lesson.notes || "",
          // include lesson_id only if it's a real UUID (edit mode, from backend)
          ...(isEditMode && isRealUuid(lesson.id) ? { lesson_id: lesson.id } : {}),
        })),
        quizzes: mod.lessons
          .filter((lesson) => lesson.hasQuiz)
          .map((lesson) => ({
            title: lesson.quiz.quizTitle || lesson.title,
            type: "quiz",
            passing_score: Number(lesson.quiz.passingScore) || 0,
            time_limit: Number(lesson.quiz.timeLimit) || 0,
            questions: lesson.quiz.questions.map((q) => ({
              question: q.prompt,
              type: q.questionType === "multipleChoice" ? "MultipleChoice" : "ShortAnswer",
              option: q.questionType === "multipleChoice"
                ? q.choices.map((c) => c.text).filter(Boolean)
                : [],
              correct_answer: q.questionType === "multipleChoice"
                ? (q.choices.find((c) => c.isCorrect)?.text ?? "")
                : q.answerText,
            })),
          })),
      }));

      const LEVELS: Record<string, number> = {
        Remembering: 0, Understanding: 1, Applying: 2,
        Analyzing: 3, Evaluating: 4, Creating: 5,
      };
      const skillsPayload = skillItems
        .filter((s) => s.skillId)
        .map((s) => ({
          skill_id: s.skillId,
          skill_level: LEVELS[s.skillLevel] ?? 0,
        }));

      const payload = {
        activity_name: activityTitle.trim(),
        activity_detail: description.trim(),
        activity_type: "course",
        status: selectedActivityStatus === "publish" ? "published" : "draft",
        visibility: selectedAudience === "everyone" ? "public" : "private",
        is_open_ended: selectedParticipation === "joinAnytime",
        hours: Number(xp) || Number(hours) || 0,
        max_participants: Number(maxParticipants) || 0,
        enroll_start_at: toIso(enrollRange.startDate, enrollRange.startTime),
        enroll_end_at: toIso(enrollRange.endDate, enrollRange.endTime),
        run_start_at: toIso(activityRange.startDate, activityRange.startTime),
        run_end_at: toIso(activityRange.endDate, activityRange.endTime),
        modules: modulesPayload,
        skills: skillsPayload,
        ...(isEditMode ? { activity_id: editId } : {}),
      };

      let response: Response;
      if (isEditMode) {
        response = await fetch(`/api/organization/activity/${encodeURIComponent(editId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch("/api/organization/activity/course", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        throw new Error(data?.message || `Request failed: ${response.status}`);
      }
      setSubmitSuccess(true);
      const targetId = isEditMode
        ? editId
        : (data?.activity_id || data?.id || data?.activity?.activity_id);
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

  return (
    <div className={styles.page}>
      {isLoadingEdit && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9998,
          background: "rgba(255,255,255,0.75)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, color: "#6f665f",
        }}>
          Loading activity...
        </div>
      )}
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
          {isEditMode ? "Activity updated successfully!" : "Activity created successfully!"}
        </div>
      )}
      <div className={styles.column}>
        <ActivityInformationSection
          activityTitle={activityTitle}
          description={description}
          hours={hours}
          onTitleChange={setActivityTitle}
          onDescriptionChange={setDescription}
          onHoursChange={setHours}
        />

        <ActivityTypeSelector
          selectedType={selectedActivityType}
          onSelectType={handleSelectActivityType}
        />

        {isLoadingEdit ? (
          <div style={{ padding: 24, color: "#888", fontSize: 13 }}>Loading modules...</div>
        ) : (
          <CourseModulesSection
            modules={modules}
            selectedModuleId={selectedModuleId}
            selectedModuleTitle={selectedModule?.title ?? ""}
            onSelectModule={handleSelectModule}
            onAddModule={handleAddModule}
            onUpdateModuleTitle={handleUpdateModuleTitle}
          />
        )}
      </div>

      <div className={styles.column}>
        <ActivityStatusSection
          selectedStatus={selectedActivityStatus}
          onSelectStatus={setSelectedActivityStatus}
        />

        <SkillsAndRewardsSection
          skillItems={skillItems}
          setSkillItems={setSkillItems}
          xp={xp}
          setXp={setXp}
        />

        <AccessAndScheduleSection
          selectedAudience={selectedAudience}
          onSelectAudience={setSelectedAudience}
          selectedParticipation={selectedParticipation}
          onSelectParticipation={setSelectedParticipation}
          maxParticipants={maxParticipants}
          onMaxParticipantsChange={setMaxParticipants}
          enrollRange={enrollRange}
          onEnrollRangeChange={setEnrollRange}
          activityRange={activityRange}
          onActivityRangeChange={setActivityRange}
        />
      </div>
      {!isLoadingEdit && (
        <CourseBuilderSection
          selectedModule={selectedModule}
          selectedLessonId={selectedLessonId}
          assessmentTab={assessmentTab}
          onSelectLesson={setSelectedLessonId}
          onSelectAssessmentTab={setAssessmentTab}
          onAddLesson={handleAddLesson}
          onUpdateLesson={updateSelectedLesson}
          onToggleLessonFlag={handleToggleLessonFlag}
          onAddQuestion={handleAddQuestion}
          onRemoveQuestion={handleRemoveQuestion}
          onUpdateQuestion={handleUpdateQuestion}
          onAddChoice={handleAddChoice}
          onUpdateChoice={handleUpdateChoice}
          onSetCorrectChoice={handleSetCorrectChoice}
          onRemoveChoice={handleRemoveChoice}
        />
      )}
      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
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
            : isEditMode
              ? selectedActivityStatus === "publish" ? "Update & Publish" : "Save Changes"
              : selectedActivityStatus === "publish" ? "Publish Activity" : "Save as Draft"}
        </button>
      </div>
    </div>
  );
}
