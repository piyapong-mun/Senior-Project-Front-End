"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import styles from "./ActivityCourseProgress.module.css";

type LessonContentType = "video" | "article";
type CourseStatus = "inProgress" | "complete";
type LessonStatus = "completed" | "inProgress" | "locked";

type LessonQuiz = {
  prompt: string;
  choices: string[];
  helperText?: string;
};

type LessonItem = {
  id: string;
  title: string;
  contentType: LessonContentType;
  contentTitle: string;
  summary: string;
  durationText: string;
  status: LessonStatus;
  videoLabel?: string;
  articleParagraphs?: string[];
  quiz?: LessonQuiz;
};

type ModuleItem = {
  id: string;
  title: string;
  description: string;
  lessons: LessonItem[];
};

type RewardSkill = {
  id: string;
  skillName: string;
  level: string;
  percentText: string;
};

type CourseMockItem = {
  id: string;
  title: string;
  organization: string;
  dueDate: string;
  type: "Course";
  level: string;
  xp: number;
  description: string;
  rewardSkills: RewardSkill[];
  progress: {
    completedLessons: number;
    totalLessons: number;
    isVerified: boolean;
    finishedAt: string;
    score: number;
    xpEarned: number;
  };
  modules: ModuleItem[];
};

function buildCourseModules(topic: string, lessonLabels: {
  foundation: string;
  concept: string;
  practice: string;
  advanced: string;
  reflection: string;
}): ModuleItem[] {
  return [
    {
      id: `${topic.toLowerCase()}-module-1`,
      title: `Module 1: ${lessonLabels.foundation}`,
      description:
        `Understand the core ideas behind ${topic} before moving to more complex examples and practical work.`,
      lessons: [
        {
          id: `${topic.toLowerCase()}-lesson-1`,
          title: lessonLabels.foundation,
          contentType: "article",
          contentTitle: lessonLabels.foundation,
          summary:
            `This lesson introduces the basic terms, structure, and purpose behind ${topic}.`,
          durationText: "10 min read",
          status: "completed",
          articleParagraphs: [
            `${topic} begins with understanding the core building blocks and how each one contributes to the final result.`,
            "A strong foundation makes later lessons easier because the learner already understands the vocabulary and the main structure.",
            "This lesson focuses on clarity, simple examples, and practical understanding.",
          ],
          quiz: {
            prompt: `Which statement best matches the main purpose of ${topic}?`,
            choices: [
              "It only matters after deployment",
              "It provides structure for practical implementation",
              "It removes the need for validation",
              "It replaces all other development work",
            ],
            helperText: "Choose the best answer based on the lesson content.",
          },
        },
        {
          id: `${topic.toLowerCase()}-lesson-2`,
          title: lessonLabels.concept,
          contentType: "video",
          contentTitle: lessonLabels.concept,
          summary:
            `Review the most important concept in ${topic} and see how it affects real implementation work.`,
          durationText: "08 min video",
          status: "completed",
          videoLabel: `Overview of ${lessonLabels.concept}`,
        },
        {
          id: `${topic.toLowerCase()}-lesson-3`,
          title: lessonLabels.practice,
          contentType: "article",
          contentTitle: lessonLabels.practice,
          summary:
            `Connect the concept to a practical scenario and understand the logic behind each step.`,
          durationText: "12 min read",
          status: "inProgress",
          articleParagraphs: [
            "Practical learning becomes stronger when students can connect each step to a real use case.",
            "This lesson focuses on reasoning, flow, and how the concept behaves during implementation.",
            "The goal is to make the learner comfortable enough to continue independently.",
          ],
        },
      ],
    },
    {
      id: `${topic.toLowerCase()}-module-2`,
      title: `Module 2: ${lessonLabels.advanced}`,
      description:
        `Move from the basics into more reusable and scalable work related to ${topic}.`,
      lessons: [
        {
          id: `${topic.toLowerCase()}-lesson-4`,
          title: lessonLabels.advanced,
          contentType: "video",
          contentTitle: lessonLabels.advanced,
          summary:
            `See how ${topic} can be organized more clearly for larger tasks and reusable workflows.`,
          durationText: "09 min video",
          status: "locked",
          videoLabel: `Applying ${lessonLabels.advanced} in practice`,
          quiz: {
            prompt: `Why is ${lessonLabels.advanced.toLowerCase()} useful?`,
            choices: [
              "It reduces all work to one step",
              "It helps organize and scale the work more clearly",
              "It only applies to design teams",
              "It replaces testing and review",
            ],
            helperText: "Answer after reviewing the lesson video.",
          },
        },
        {
          id: `${topic.toLowerCase()}-lesson-5`,
          title: lessonLabels.reflection,
          contentType: "article",
          contentTitle: lessonLabels.reflection,
          summary:
            `Summarize the main ideas from the course and connect them to a small reflection task.`,
          durationText: "07 min read",
          status: "locked",
          articleParagraphs: [
            "Reflection tasks help the learner explain why the logic matters, not only how the steps are performed.",
            "A short summary often reveals whether the learner understands the purpose of the process and not only the surface details.",
          ],
        },
      ],
    },
  ];
}

const COURSE_ACTIVITIES: CourseMockItem[] = [
  {
    id: "course-basic-python",
    title: "Basic Python",
    organization: "Limbus Company",
    dueDate: "29 Jan 2026",
    type: "Course",
    level: "Beginner",
    xp: 120,
    description:
      "This course is organized by module. Each module contains lessons, every lesson contains article or video content, and some lessons include a quiz before students move forward.",
    rewardSkills: [
      { id: "skill-1", skillName: "Python Fundamentals", level: "Beginner", percentText: "50%" },
      { id: "skill-2", skillName: "Logical Thinking", level: "Beginner", percentText: "30%" },
      { id: "skill-3", skillName: "Problem Solving", level: "Beginner", percentText: "20%" },
    ],
    progress: {
      completedLessons: 2,
      totalLessons: 5,
      isVerified: false,
      finishedAt: "29 Jan 2026",
      score: 100,
      xpEarned: 120,
    },
    modules: buildCourseModules("Python", {
      foundation: "Variables and Data Types",
      concept: "Operators Overview",
      practice: "Conditional Logic",
      advanced: "Functions and Reuse",
      reflection: "Practice Reflection",
    }),
  },
  {
    id: "course-ui-layout-fundamentals",
    title: "UI Layout Fundamentals",
    organization: "BlueTechnologies",
    dueDate: "31 Jan 2026",
    type: "Course",
    level: "Beginner",
    xp: 100,
    description:
      "Learn how layout hierarchy, spacing, and section structure work together across simple interface examples.",
    rewardSkills: [
      { id: "skill-1", skillName: "UI Structure", level: "Beginner", percentText: "40%" },
      { id: "skill-2", skillName: "Visual Hierarchy", level: "Beginner", percentText: "35%" },
      { id: "skill-3", skillName: "Layout Thinking", level: "Understanding", percentText: "25%" },
    ],
    progress: {
      completedLessons: 5,
      totalLessons: 5,
      isVerified: true,
      finishedAt: "31 Jan 2026",
      score: 96,
      xpEarned: 100,
    },
    modules: buildCourseModules("UI Layout", {
      foundation: "Spacing and Alignment",
      concept: "Section Hierarchy",
      practice: "Responsive Block Structure",
      advanced: "Component Layout Patterns",
      reflection: "Layout Reflection",
    }),
  },
  {
    id: "course-frontend-basics",
    title: "Frontend Basics & Web Terminology",
    organization: "NextDynamics",
    dueDate: "01 Feb 2026",
    type: "Course",
    level: "Beginner",
    xp: 105,
    description:
      "Review essential web terminology and understand how the main front-end layers work together in practice.",
    rewardSkills: [
      { id: "skill-1", skillName: "Frontend Basics", level: "Beginner", percentText: "45%" },
      { id: "skill-2", skillName: "Web Terminology", level: "Understanding", percentText: "30%" },
      { id: "skill-3", skillName: "Technical Communication", level: "Understanding", percentText: "25%" },
    ],
    progress: {
      completedLessons: 5,
      totalLessons: 5,
      isVerified: true,
      finishedAt: "01 Feb 2026",
      score: 93,
      xpEarned: 105,
    },
    modules: buildCourseModules("Frontend", {
      foundation: "HTML, CSS, and JavaScript Roles",
      concept: "Client and Browser Basics",
      practice: "Page Rendering Flow",
      advanced: "Component-Based Thinking",
      reflection: "Terminology Reflection",
    }),
  },
  {
    id: "course-cloud-fundamentals",
    title: "Cloud Fundamentals",
    organization: "TechIndustries",
    dueDate: "03 Feb 2026",
    type: "Course",
    level: "Beginner",
    xp: 110,
    description:
      "Understand the main cloud service models, core deployment concepts, and how to describe cloud architecture clearly.",
    rewardSkills: [
      { id: "skill-1", skillName: "Cloud Basics", level: "Beginner", percentText: "50%" },
      { id: "skill-2", skillName: "System Thinking", level: "Understanding", percentText: "30%" },
      { id: "skill-3", skillName: "Architecture Communication", level: "Understanding", percentText: "20%" },
    ],
    progress: {
      completedLessons: 3,
      totalLessons: 5,
      isVerified: false,
      finishedAt: "03 Feb 2026",
      score: 100,
      xpEarned: 110,
    },
    modules: buildCourseModules("Cloud", {
      foundation: "Service Models",
      concept: "Deployment Models",
      practice: "Simple Architecture Flow",
      advanced: "Scalable Cloud Thinking",
      reflection: "Cloud Reflection",
    }),
  },
  {
    id: "course-sql-basics",
    title: "SQL Basics",
    organization: "TechIndustries",
    dueDate: "10 Feb 2026",
    type: "Course",
    level: "Beginner",
    xp: 108,
    description:
      "Learn the main SQL concepts used to read structured data, filter results, and explain simple query logic.",
    rewardSkills: [
      { id: "skill-1", skillName: "SQL", level: "Beginner", percentText: "50%" },
      { id: "skill-2", skillName: "Data Logic", level: "Understanding", percentText: "30%" },
      { id: "skill-3", skillName: "Query Writing", level: "Beginner", percentText: "20%" },
    ],
    progress: {
      completedLessons: 5,
      totalLessons: 5,
      isVerified: true,
      finishedAt: "10 Feb 2026",
      score: 94,
      xpEarned: 108,
    },
    modules: buildCourseModules("SQL", {
      foundation: "Tables and Columns",
      concept: "Filtering and Sorting",
      practice: "Reading Query Output",
      advanced: "Reusable Query Patterns",
      reflection: "SQL Reflection",
    }),
  },
  {
    id: "course-git-collaboration",
    title: "Git Collaboration",
    organization: "NextDynamics",
    dueDate: "15 Feb 2026",
    type: "Course",
    level: "Beginner",
    xp: 95,
    description:
      "Understand how version control supports team collaboration and how to explain branching and merge flow clearly.",
    rewardSkills: [
      { id: "skill-1", skillName: "Git Basics", level: "Beginner", percentText: "45%" },
      { id: "skill-2", skillName: "Collaboration", level: "Understanding", percentText: "35%" },
      { id: "skill-3", skillName: "Workflow Discipline", level: "Understanding", percentText: "20%" },
    ],
    progress: {
      completedLessons: 2,
      totalLessons: 5,
      isVerified: false,
      finishedAt: "15 Feb 2026",
      score: 100,
      xpEarned: 95,
    },
    modules: buildCourseModules("Git", {
      foundation: "Commit and Version History",
      concept: "Branching Basics",
      practice: "Merge Review Flow",
      advanced: "Team Workflow Patterns",
      reflection: "Collaboration Reflection",
    }),
  },
];

function getLessonStatusLabel(status: LessonStatus) {
  if (status === "completed") return "Complete";
  if (status === "inProgress") return "In progress";
  return "Locked";
}

function StatusPill({ status }: { status: CourseStatus }) {
  return (
    <span
      className={`${styles.statusPill} ${
        status === "complete" ? styles.statusComplete : styles.statusProgress
      }`}
    >
      {status === "complete" ? "Complete" : "In progress"}
    </span>
  );
}

function ModuleSidebar({
  modules,
  selectedLessonId,
  onSelectLesson,
}: {
  modules: ModuleItem[];
  selectedLessonId: string;
  onSelectLesson: (lessonId: string) => void;
}) {
  return (
    <section className={`${styles.panel} ${styles.modulePanel}`}>
      <div className={styles.sectionTitle}>Modules & lessons</div>

      <div className={styles.moduleScrollArea}>
        {modules.map((module) => {
          const completedCount = module.lessons.filter(
            (lesson) => lesson.status === "completed"
          ).length;

          return (
            <div key={module.id} className={styles.moduleCard}>
              <div className={styles.moduleHeader}>
                <div>
                  <div className={styles.moduleTitle}>{module.title}</div>
                  <div className={styles.moduleDescription}>{module.description}</div>
                </div>
                <div className={styles.moduleProgressBadge}>
                  {completedCount}/{module.lessons.length}
                </div>
              </div>

              <div className={styles.lessonList}>
                {module.lessons.map((lesson, lessonIndex) => {
                  const isActive = lesson.id === selectedLessonId;
                  const lessonLabel = `Lesson ${lessonIndex + 1}`;
                  const isLocked = lesson.status === "locked";

                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      className={`${styles.lessonButton} ${
                        isActive ? styles.lessonButtonActive : ""
                      } ${isLocked ? styles.lessonButtonLocked : ""}`}
                      onClick={() => onSelectLesson(lesson.id)}
                    >
                      <div className={styles.lessonMainInfo}>
                        <div className={styles.lessonTopLine}>
                          <span className={styles.lessonOrder}>{lessonLabel}</span>
                          <span className={styles.lessonContentBadge}>
                            {lesson.contentType}
                          </span>
                          {lesson.quiz ? (
                            <span className={styles.lessonQuizBadge}>Quiz</span>
                          ) : null}
                        </div>
                        <div className={styles.lessonButtonTitle}>{lesson.title}</div>
                        <div className={styles.lessonButtonMeta}>{lesson.durationText}</div>
                      </div>

                      <div className={styles.lessonRightInfo}>
                        <span className={styles.lessonStateText}>
                          {getLessonStatusLabel(lesson.status)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function ActivityCourseProgress() {
  const searchParams = useSearchParams();
  const activityId = searchParams.get("activityId") || COURSE_ACTIVITIES[0].id;

  const selectedCourse =
    COURSE_ACTIVITIES.find((item) => item.id === activityId) || COURSE_ACTIVITIES[0];

  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [selectedChoice, setSelectedChoice] = useState("");
  const [noticeText, setNoticeText] = useState("");

  useEffect(() => {
    const firstLessonId = selectedCourse.modules[0]?.lessons[0]?.id || "";
    setSelectedLessonId(firstLessonId);
    setSelectedChoice("");
    setNoticeText("");
  }, [selectedCourse]);

  const courseStatus: CourseStatus = selectedCourse.progress.isVerified ? "complete" : "inProgress";

  const selectedModule = useMemo(() => {
    const foundModule = selectedCourse.modules.find((module) =>
      module.lessons.some((lesson) => lesson.id === selectedLessonId)
    );
    return foundModule || selectedCourse.modules[0];
  }, [selectedCourse, selectedLessonId]);

  const selectedLesson = useMemo(() => {
    const foundLesson = selectedModule?.lessons.find(
      (lesson) => lesson.id === selectedLessonId
    );
    return foundLesson || selectedModule?.lessons[0];
  }, [selectedLessonId, selectedModule]);

  useEffect(() => {
    setSelectedChoice("");
    setNoticeText("");
  }, [selectedLessonId]);

  if (!selectedModule || !selectedLesson) {
    return null;
  }

  const hasQuiz = Boolean(selectedLesson.quiz);
  const isLessonLocked = selectedLesson.status === "locked";

  return (
    <div className={styles.page}>
      <div className={styles.column}>
        <section className={`${styles.panel} ${styles.summaryPanel}`}>
          <div className={styles.topRow}>
            <div>
              <div className={styles.eyebrow}>Student Activity</div>
              <h1 className={styles.title}>{selectedCourse.title}</h1>
            </div>

            <div className={styles.headerActions}>
              <StatusPill status={courseStatus} />
              <Link href="/student/activities/overview" className={styles.backButton}>
                Back
              </Link>
            </div>
          </div>

          <p className={styles.description}>{selectedCourse.description}</p>

          <div className={styles.metaGrid}>
            <div className={styles.metaCard}>
              <div className={styles.metaLabel}>Organization</div>
              <div className={styles.metaValue}>{selectedCourse.organization}</div>
            </div>
            <div className={styles.metaCard}>
              <div className={styles.metaLabel}>Due date</div>
              <div className={styles.metaValue}>{selectedCourse.dueDate}</div>
            </div>
            <div className={styles.metaCard}>
              <div className={styles.metaLabel}>Type</div>
              <div className={styles.metaValue}>{selectedCourse.type}</div>
            </div>
            <div className={styles.metaCard}>
              <div className={styles.metaLabel}>Level</div>
              <div className={styles.metaValue}>{selectedCourse.level}</div>
            </div>
            <div className={styles.metaCard}>
              <div className={styles.metaLabel}>Lesson progress</div>
              <div className={styles.metaValue}>
                {selectedCourse.progress.completedLessons}/{selectedCourse.progress.totalLessons}
              </div>
            </div>
            <div className={styles.metaCard}>
              <div className={styles.metaLabel}>Current lesson</div>
              <div className={styles.metaValue}>{selectedLesson.title}</div>
            </div>
          </div>

          <div className={styles.rewardSkillsSection}>
            <div className={styles.rewardSkillsTitle}>Skills you will receive</div>
            <div className={styles.rewardSkillsList}>
              {selectedCourse.rewardSkills.map((skill) => (
                <div key={skill.id} className={styles.rewardSkillRow}>
                  <div className={styles.rewardSkillName}>{skill.skillName}</div>
                  <div className={styles.rewardSkillLevel}>{skill.level}</div>
                  <div className={styles.rewardSkillPercent}>{skill.percentText}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.previewStateRow}>
            <span className={styles.previewStateLabel}>Preview state</span>
            <div className={styles.previewStateGroup} aria-label="Preview state display only">
              <span
                className={`${styles.previewStateBadge} ${
                  courseStatus === "inProgress" ? styles.previewStateBadgeActive : ""
                }`}
              >
                In progress
              </span>
              <span
                className={`${styles.previewStateBadge} ${
                  courseStatus === "complete" ? styles.previewStateBadgeActive : ""
                }`}
              >
                Complete
              </span>
            </div>
          </div>

          <div className={styles.previewStateHint}>
            This status updates automatically after all required lessons and lesson quizzes are completed and verified.
          </div>
        </section>

        <ModuleSidebar
          modules={selectedCourse.modules}
          selectedLessonId={selectedLessonId}
          onSelectLesson={setSelectedLessonId}
        />
      </div>

      <div className={styles.column}>
        {courseStatus === "complete" ? (
          <section className={`${styles.panel} ${styles.successPanel}`}>
            <div className={styles.successTitle}>Congratulations !!!</div>
            <div className={styles.successCard}>
              <div className={styles.successCardLabel}>Certificate</div>
              <div className={styles.successCardValue}>Download Certificate</div>
            </div>
            <div className={styles.successMetaRow}>
              <span>Finished: {selectedCourse.progress.finishedAt}</span>
              <span>Score: {selectedCourse.progress.score}</span>
              <span>XP: +{selectedCourse.progress.xpEarned}</span>
            </div>
          </section>
        ) : null}

        <section className={`${styles.panel} ${styles.viewerPanel}`}>
          <div className={styles.viewerHeader}>
            <div>
              <div className={styles.viewerPath}>
                {selectedModule.title} / {selectedLesson.title}
              </div>
              <div className={styles.sectionTitle}>{selectedLesson.contentTitle}</div>
              <div className={styles.viewerMetaRow}>
                <span className={styles.viewerMeta}>{selectedLesson.contentType}</span>
                <span className={styles.viewerMetaDot}>•</span>
                <span className={styles.viewerMeta}>{selectedLesson.durationText}</span>
              </div>
            </div>
            <div className={styles.progressBadge}>
              {getLessonStatusLabel(selectedLesson.status)}
            </div>
          </div>

          {selectedLesson.contentType === "video" ? (
            <div className={styles.videoBox}>
              <div className={styles.playIcon}>▶</div>
              <div className={styles.videoCaption}>{selectedLesson.videoLabel}</div>
            </div>
          ) : (
            <div className={styles.articleBox}>
              <div className={styles.articleTitle}>Lesson content</div>
              {(selectedLesson.articleParagraphs || []).map((paragraph, index) => (
                <p key={`${selectedLesson.id}-paragraph-${index}`} className={styles.articleText}>
                  {paragraph}
                </p>
              ))}
            </div>
          )}

          <div className={styles.lessonSummaryCard}>
            <div className={styles.lessonSummaryTitle}>Lesson summary</div>
            <div className={styles.lessonSummary}>{selectedLesson.summary}</div>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.assessmentPanel}`}>
          <div className={styles.sectionTitle}>Lesson quiz</div>

          {hasQuiz && selectedLesson.quiz ? (
            <div className={styles.quizWrap}>
              <div className={styles.questionPrompt}>{selectedLesson.quiz.prompt}</div>
              {selectedLesson.quiz.helperText ? (
                <div className={styles.quizHelperText}>{selectedLesson.quiz.helperText}</div>
              ) : null}
              <div className={styles.choiceList}>
                {selectedLesson.quiz.choices.map((choice) => (
                  <label key={choice} className={styles.choiceRow}>
                    <input
                      type="radio"
                      name={selectedLesson.id}
                      checked={selectedChoice === choice}
                      onChange={() => setSelectedChoice(choice)}
                      disabled={isLessonLocked}
                    />
                    <span>{choice}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.noQuizWrap}>
              <div className={styles.noQuizTitle}>This lesson has no quiz</div>
              <div className={styles.assignmentText}>
                Students only need to review the lesson content for this lesson before continuing to the next lesson.
              </div>
            </div>
          )}

          {noticeText ? <div className={styles.infoText}>{noticeText}</div> : null}

          <div className={styles.actionRow}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() =>
                setNoticeText(
                  isLessonLocked
                    ? "This lesson is still locked. Complete the earlier lesson flow first."
                    : "Lesson progress has been saved. Course status will update only after all required lessons are completed and verified."
                )
              }
            >
              Save lesson progress
            </button>
            {hasQuiz ? (
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() =>
                  setNoticeText(
                    isLessonLocked
                      ? "This lesson quiz is locked until earlier lessons are completed."
                      : selectedChoice
                      ? "Quiz answer has been submitted. Completion status will update after verification."
                      : "Please choose an answer before submitting the quiz."
                  )
                }
              >
                Submit quiz
              </button>
            ) : (
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() =>
                  setNoticeText(
                    isLessonLocked
                      ? "This lesson is still locked. Complete the earlier lesson flow first."
                      : "This lesson does not require a quiz. Continue to the next lesson when ready."
                  )
                }
              >
                Continue lesson
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}