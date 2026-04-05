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

type RangePickerKey = "startDate" | "startTime" | "endDate" | "endTime" | null;

type RangeValue = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
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

const INITIAL_MODULES: ModuleItem[] = [
  {
    id: "module-1",
    title: "Module1: untitled",
    lessons: [
      {
        ...createDefaultLesson(0),
        id: "module-1-lesson-1",
        title: "Lesson1",
      },
    ],
  },
  {
    id: "module-2",
    title: "Module2: untitled",
    lessons: [
      {
        ...createDefaultLesson(0),
        id: "module-2-lesson-1",
        title: "Lesson1",
        url: "",
        notes: "",
      },
      {
        ...createDefaultLesson(1),
        id: "module-2-lesson-2",
        title: "Lesson2",
        contentType: "article",
        hasAssignment: true,
      },
      {
        ...createDefaultLesson(2),
        id: "module-2-lesson-3",
        title: "Lesson3",
        hasQuiz: false,
        hasAssignment: true,
      },
    ],
  },
];

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
                className={`${styles.courseModuleCard} ${
                  isActive ? styles.courseModuleCardActive : ""
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
                  alt="Course badge"
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
      <div className={styles.settingsScrollArea}>
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
                selectedParticipation === option.value ? styles.joinModeButtonActive : ""
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
  const selectedLesson = useMemo(() => {
    return selectedModule?.lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;
  }, [selectedLessonId, selectedModule]);

  const quizQuestions = selectedLesson?.quiz.questions ?? [];

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
                className={`${styles.lessonTab} ${
                  lesson.id === selectedLessonId ? styles.lessonTabActive : ""
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
          <div className={styles.assessmentTabs}>
            <button
              type="button"
              className={`${styles.assessmentTab} ${
                assessmentTab === "quiz" ? styles.assessmentTabActive : ""
              }`}
              onClick={() => onSelectAssessmentTab("quiz")}
            >
              Quiz
            </button>
            {/* <button
              type="button"
              className={`${styles.assessmentTab} ${
                assessmentTab === "assignment" ? styles.assessmentTabActive : ""
              }`}
              onClick={() => onSelectAssessmentTab("assignment")}
            >
              Assignment
            </button> */}
          </div>

          {assessmentTab === "quiz" ? (
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

              <div className={styles.questionSectionHeader}>
                <div className={styles.coursePanelTitleSmall}>Questions</div>
                <button
                  type="button"
                  className={styles.smallOutlineButton}
                  onClick={onAddQuestion}
                >
                  +
                </button>
              </div>

              <div className={styles.questionsCard}>
                {quizQuestions.map((question, index) => (
                  <div key={question.id} className={styles.questionCard}>
                    <div className={styles.questionTopRow}>
                      <div className={styles.questionLabel}>{`Q${index + 1}`}</div>
                      <button
                        type="button"
                        className={styles.smallGhostButton}
                        onClick={() => onRemoveQuestion(question.id)}
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
                        onUpdateQuestion(question.id, (currentQuestion) => ({
                          ...currentQuestion,
                          prompt: event.target.value,
                        }))
                      }
                      placeholder="description"
                    />

                    <label className={styles.sectionTitle}>Question Type</label>
                    <select
                      className={styles.fullWidthInput}
                      value={question.questionType}
                      onChange={(event) =>
                        onUpdateQuestion(question.id, (currentQuestion) => ({
                          ...currentQuestion,
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
                                className={`${styles.choiceActionButton} ${
                                  choice.isCorrect ? styles.choiceActionButtonActive : ""
                                }`}
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
                            onUpdateQuestion(question.id, (currentQuestion) => ({
                              ...currentQuestion,
                              answerText: event.target.value,
                            }))
                          }
                          placeholder="Type the expected answer"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className={styles.assignmentPanel}>
              <div className={styles.quizFieldBlock}>
                <label className={styles.sectionTitle}>Assignment Title</label>
                <input
                  className={styles.fullWidthInput}
                  value={selectedLesson.assignment.title}
                  onChange={(event) =>
                    onUpdateLesson((lesson) => ({
                      ...lesson,
                      assignment: { ...lesson.assignment, title: event.target.value },
                    }))
                  }
                  placeholder="..."
                />
              </div>

              <div className={styles.quizFieldBlock}>
                <label className={styles.sectionTitle}>Submission Type</label>
                <input
                  className={styles.fullWidthInput}
                  value={selectedLesson.assignment.submissionType}
                  onChange={(event) =>
                    onUpdateLesson((lesson) => ({
                      ...lesson,
                      assignment: {
                        ...lesson.assignment,
                        submissionType: event.target.value,
                      },
                    }))
                  }
                  placeholder="File upload / link / text"
                />
              </div>

              <div className={styles.quizFieldBlock}>
                <label className={styles.sectionTitle}>Instructions</label>
                <textarea
                  className={`${styles.bioTextarea} ${styles.assignmentTextarea}`}
                  value={selectedLesson.assignment.instructions}
                  onChange={(event) =>
                    onUpdateLesson((lesson) => ({
                      ...lesson,
                      assignment: {
                        ...lesson.assignment,
                        instructions: event.target.value,
                      },
                    }))
                  }
                  placeholder="Describe what students need to submit after completing this lesson."
                />
              </div>
            </div>
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

  const [selectedActivityType, setSelectedActivityType] =
    useState<ActivityKind>("courses");
  const [selectedActivityStatus, setSelectedActivityStatus] =
    useState<ActivityStatus>("publish");
  const [selectedAudience, setSelectedAudience] =
    useState<AudienceAccess>("everyone");
  const [selectedParticipation, setSelectedParticipation] =
    useState<ParticipationMode>("scheduledParticipation");

  const [modules, setModules] = useState<ModuleItem[]>(INITIAL_MODULES);
  const [selectedModuleId, setSelectedModuleId] = useState<string>(INITIAL_MODULES[1].id);
  const [selectedLessonId, setSelectedLessonId] = useState<string>(INITIAL_MODULES[1].lessons[0].id);
  const [assessmentTab, setAssessmentTab] = useState<AssessmentTab>("quiz");

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

  return (
    <div className={styles.page}>
      <div className={styles.column}>
        <ActivityInformationSection />

        <ActivityTypeSelector
          selectedType={selectedActivityType}
          onSelectType={handleSelectActivityType}
        />

        <CourseModulesSection
          modules={modules}
          selectedModuleId={selectedModuleId}
          selectedModuleTitle={selectedModule?.title ?? ""}
          onSelectModule={handleSelectModule}
          onAddModule={handleAddModule}
          onUpdateModuleTitle={handleUpdateModuleTitle}
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
    </div>
  );
}
