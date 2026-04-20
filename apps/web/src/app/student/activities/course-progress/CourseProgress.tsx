"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useEffect, useCallback, Suspense } from "react";
import styles from "./page.module.css";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

// A "merged lesson card" = lesson data + optional quiz paired by index
type MergedLesson = {
  lessonId: string;
  lessonName: string;
  contentType: string;
  durationText: string;
  isDoneLesson: boolean;
  // quiz paired by same index (may be undefined)
  quizId?: string;
  quizName?: string;
  isDoneQuiz?: boolean;
};

type SelectedItem =
  | { kind: "none" }
  | {
      kind: "lesson";
      moduleId: string;
      moduleName: string;
      lesson: MergedLesson;
    };

// ─────────────────────────────────────────────────────────────
// RIGHT COLUMN — combined Lesson + Quiz viewer
// ─────────────────────────────────────────────────────────────
function LessonViewer({
  activityId,
  moduleId,
  moduleName,
  lesson,
  onFinished,
}: {
  activityId: string;
  moduleId: string;
  moduleName: string;
  lesson: MergedLesson;
  onFinished: () => void;
}) {
  const [lessonData, setLessonData] = useState<any>(null);
  const [quizData, setQuizData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [noticeText, setNoticeText] = useState("");
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);

  useEffect(() => {
    setLoading(true);
    setLessonData(null);
    setQuizData(null);
    setAnswers({});
    setNoticeText("");
    setCurrentQuestionIdx(0);

    async function fetchAll() {
      try {
        // Fetch lesson
        const lessonRes = await fetch(
          `/api/student/course/lesson?activity_id=${activityId}&module_id=${moduleId}&lesson_id=${lesson.lessonId}`
        );
        const lessonJson = await lessonRes.json();
        if (lessonJson.ok) setLessonData(lessonJson.data);

        // Fetch quiz if this lesson has one
        if (lesson.quizId) {
          const quizRes = await fetch(
            `/api/student/course/quiz?activity_id=${activityId}&module_id=${moduleId}&quiz_id=${lesson.quizId}`
          );
          const quizJson = await quizRes.json();
          if (quizJson.ok) {
            setQuizData(quizJson.data);
            // Pre-fill answers if already done
            if (quizJson.data?.is_done && quizJson.data?.answer) {
              const init: Record<string, string> = {};
              quizJson.data.answer.forEach((ans: any) => {
                init[ans.question_id] = ans.answer;
              });
              setAnswers(init);
            }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [activityId, moduleId, lesson.lessonId, lesson.quizId]);

  // ── Handlers ──
  const handleSaveProgress = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/student/submission/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity_id: activityId,
          done_lesson: { lessonID: lesson.lessonId, moduleID: moduleId },
        }),
      });
      if (res.ok) {
        setNoticeText("Lesson progress has been saved.");
        onFinished();
      } else {
        setNoticeText("Failed to save lesson progress.");
      }
    } catch {
      setNoticeText("An error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectAnswer = (questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmitQuiz = async () => {
    const questions: any[] = quizData?.questions ?? [];
    const allAnswered =
      questions.length > 0 &&
      questions.every((q: any) => answers[q.question_id]);
    if (!allAnswered) {
      setNoticeText("Please choose an answer for every question before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const mappedAnswers = Object.entries(answers).map(([question_id, answer]) => ({
        question_id,
        answer,
      }));
      const res = await fetch("/api/student/submission/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity_id: activityId,
          quiz_id: lesson.quizId,
          answers: mappedAnswers,
        }),
      });
      if (res.ok) {
        setNoticeText("Quiz submitted. Completion status will update after verification.");
        onFinished();
      } else {
        setNoticeText("Failed to submit quiz.");
      }
    } catch {
      setNoticeText("An error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <>
        <section className={`${styles.panel} ${styles.viewerPanel}`}>
          <div className={styles.loadingText}>Loading lesson...</div>
        </section>
        <section className={`${styles.panel} ${styles.assessmentPanel}`}>
          <div className={styles.loadingText}>Loading...</div>
        </section>
      </>
    );

  const isVideo =
    lessonData?.type === "video" ||
    (typeof lessonData?.data === "string" &&
      (lessonData.data.includes("youtube") || lessonData.data.includes("vimeo")));

  const lessonStatusLabel = lessonData?.is_done ? "Complete" : "In progress";

  const questions: any[] = quizData?.questions ?? [];
  const isQuizCompleted: boolean = quizData?.is_done ?? false;
  const quizScore =
    quizData?.score !== undefined
      ? `${quizData.score} / ${quizData.max_score}`
      : "";
  const hasQuiz = Boolean(lesson.quizId);

  return (
    <>
      {/* ── Viewer panel ── */}
      <section className={`${styles.panel} ${styles.viewerPanel}`}>
        <div className={styles.viewerHeader}>
          <div>
            <div className={styles.viewerPath}>
              {moduleName} / {lessonData?.title ?? lesson.lessonName}
            </div>
            <div className={styles.sectionTitle}>
              {lessonData?.title ?? lesson.lessonName}
            </div>
            <div className={styles.viewerMetaRow}>
              <span className={styles.viewerMeta}>
                {isVideo ? "Video" : "Article"}
              </span>
              {lessonData?.duration_text && (
                <>
                  <span className={styles.viewerMetaDot}>•</span>
                  <span className={styles.viewerMeta}>
                    {lessonData.duration_text}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className={styles.progressBadge}>{lessonStatusLabel}</div>
        </div>

        {isVideo ? (
          <div className={styles.videoBox}>
            <iframe
              width="100%"
              height="280"
              src={lessonData?.data}
              title={lessonData?.title ?? "Video"}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ border: 0, display: "block" }}
            />
          </div>
        ) : (
          <div className={styles.articleBox}>
            <div className={styles.articleTitle}>Lesson content</div>
            <p className={styles.articleText} style={{ whiteSpace: "pre-wrap" }}>
              {lessonData?.data ?? ""}
            </p>
          </div>
        )}

        {lessonData?.summary && (
          <div className={styles.lessonSummaryCard}>
            <div className={styles.lessonSummaryTitle}>Lesson summary</div>
            <div className={styles.lessonSummary}>{lessonData.summary}</div>
          </div>
        )}
      </section>

      {/* ── Assessment panel ── */}
      <section className={`${styles.panel} ${styles.assessmentPanel}`}>
        <div className={styles.sectionTitle}>Lesson quiz</div>

        {hasQuiz && questions.length > 0 ? (
          /* Quiz questions — one at a time */
          <div className={styles.quizWrap}>
            {(() => {
              const q = questions[currentQuestionIdx];
              let parsedChoices: string[] = q.options ?? [];
              if (
                parsedChoices.length === 1 &&
                typeof parsedChoices[0] === "string" &&
                parsedChoices[0].startsWith("[")
              ) {
                try { parsedChoices = JSON.parse(parsedChoices[0]); } catch {}
              }
              return (
                <>
                  {/* Progress indicator */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <span style={{ fontSize: 12, color: "rgba(0,0,0,0.5)" }}>
                      Question {currentQuestionIdx + 1} / {questions.length}
                    </span>
                    <div style={{ display: "flex", gap: 4 }}>
                      {questions.map((_: any, i: number) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setCurrentQuestionIdx(i)}
                          style={{
                            width: 24, height: 24, border: "1px solid #d7d7d7",
                            background: i === currentQuestionIdx ? "#C7BED4" : answers[questions[i].question_id] ? "#BED4D0" : "#f7f7f7",
                            cursor: "pointer", fontSize: 11, fontFamily: "inherit",
                          }}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Question */}
                  <div className={styles.questionPrompt}>
                    {currentQuestionIdx + 1}. {q.question}
                  </div>
                  <div className={styles.choiceList}>
                    {parsedChoices.map((choice: string, cIdx: number) => (
                      <label key={cIdx} className={styles.choiceRow}>
                        <input
                          type="radio"
                          name={`question-${q.question_id}`}
                          checked={answers[q.question_id] === choice}
                          onChange={() => handleSelectAnswer(q.question_id, choice)}
                          disabled={isQuizCompleted}
                        />
                        <span>{choice}</span>
                      </label>
                    ))}
                  </div>

                  {/* Prev / Next navigation */}
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, gap: 8 }}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      style={{ minWidth: 80, height: 32, fontSize: 13 }}
                      disabled={currentQuestionIdx === 0}
                      onClick={() => setCurrentQuestionIdx((i) => i - 1)}
                    >
                      ← Prev
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      style={{ minWidth: 80, height: 32, fontSize: 13 }}
                      disabled={currentQuestionIdx === questions.length - 1}
                      onClick={() => setCurrentQuestionIdx((i) => i + 1)}
                    >
                      Next →
                    </button>
                  </div>

                  {isQuizCompleted && quizScore && (
                    <div className={styles.infoText} style={{ marginTop: 12 }}>Score: {quizScore}</div>
                  )}
                </>
              );
            })()}
          </div>
        ) : (
          /* No quiz */
          <div className={styles.noQuizWrap}>
            <div className={styles.noQuizTitle}>This lesson has no quiz</div>
            <div className={styles.assignmentText}>
              Students only need to review the lesson content for this lesson
              before continuing to the next lesson.
            </div>
          </div>
        )}

        {noticeText && <div className={styles.infoText}>{noticeText}</div>}

        <div className={styles.actionRow}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={handleSaveProgress}
            disabled={submitting || lessonData?.is_done}
          >
            Save lesson progress
          </button>

          {hasQuiz ? (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleSubmitQuiz}
              disabled={submitting || isQuizCompleted}
            >
              {submitting ? "Submitting..." : "Submit quiz"}
            </button>
          ) : (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleSaveProgress}
              disabled={submitting || lessonData?.is_done}
            >
              {submitting ? "Saving..." : lessonData?.is_done ? "Completed" : "Continue lesson"}
            </button>
          )}
        </div>
      </section>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
function CourseMainView({ activityId }: { activityId: string }) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SelectedItem>({ kind: "none" });

  const fetchMain = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/student/course/main?activity_id=${activityId}`
      );
      const json = await res.json();
      if (json.ok) setData(json.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activityId]);

  useEffect(() => { fetchMain(); }, [fetchMain]);
  const handleFinished = useCallback(() => { fetchMain(); }, [fetchMain]);

  // ── Derived values ──────────────────────────────────────
  const rawStatus =
    data?.submission_info?.status ?? data?.submission_info?.Status;
  const currentStatus: string =
    rawStatus === "" ? "In Progress" : rawStatus || "Incomplete";
  const isComplete = ["complete", "completed", "pass"].includes(
    currentStatus.toLowerCase()
  );

  const submitDate = useMemo(() => {
    const rawDate =
      data?.submission_info?.submittedAt || data?.submission_info?.SubmittedAt;
    if (!rawDate) return "—";
    return new Date(rawDate).toLocaleDateString("en-GB");
  }, [data?.submission_info]);

  const getStatusPillClass = (status: string) => {
    const s = status.toLowerCase();
    if (["complete", "completed", "pass"].includes(s))
      return `${styles.statusPill} ${styles.statusComplete}`;
    return `${styles.statusPill} ${styles.statusProgress}`;
  };

  // ── Build merged lesson list per module ──
  // Rule: quiz[i] pairs with lesson[i] by index
  // Remaining quizzes (if more quizzes than lessons) become standalone items
  const buildMergedLessons = useCallback(
    (mod: any): MergedLesson[] => {
      const lessons: any[] = mod.lesson ?? [];
      const quizzes: any[] = mod.quiz ?? [];
      if (lessons.length > 0) console.log("[VCEP debug] lesson fields:", Object.keys(lessons[0]), lessons[0]);
      return lessons.map((lesson: any, i: number) => {
        const pairedQuiz = quizzes[i];
        return {
          lessonId: lesson.lesson_id,
          lessonName: lesson.lesson_name ?? "Lesson",
          contentType: (() => {
            // Try known field names first
            const raw = lesson.lesson_type ?? lesson.content_type ?? lesson.type ?? lesson.lessonType ?? "";
            const normalized = raw.toString().toLowerCase();
            if (normalized.includes("video")) return "video";
            if (normalized.includes("article")) return "article";
            // Fallback: scan ALL string values in lesson object for "video"
            const hasVideoAnywhere = Object.values(lesson).some(
              (v) => typeof v === "string" && v.toLowerCase().includes("video")
            );
            if (hasVideoAnywhere) return "video";
            // Also check if data URL looks like a video embed
            const dataVal = lesson.data ?? lesson.url ?? lesson.content ?? "";
            if (typeof dataVal === "string" && (dataVal.includes("youtube") || dataVal.includes("vimeo") || dataVal.includes("youtu.be"))) return "video";
            return "article";
          })(),
          durationText: lesson.duration_text ?? "",
          isDoneLesson: data?.complete?.lesson?.some(
            (cl: any) => cl.lesson_id === lesson.lesson_id
          ) ?? false,
          quizId: pairedQuiz?.quiz_id,
          quizName: pairedQuiz?.quiz_name,
          isDoneQuiz: pairedQuiz
            ? (data?.complete?.quiz?.some(
                (cq: any) => cq.quiz_id === pairedQuiz.quiz_id
              ) ?? false)
            : undefined,
        };
      });
    },
    [data]
  );

  // Total / completed counts
  const totalItems = useMemo(
    () =>
      (data?.module ?? []).reduce(
        (sum: number, mod: any) =>
          sum + (mod.lesson?.length ?? 0) + (mod.quiz?.length ?? 0),
        0
      ),
    [data]
  );
  const completedItems =
    (data?.complete?.lesson?.length ?? 0) +
    (data?.complete?.quiz?.length ?? 0);

  const dueDate =
    data?.activity?.IsOpenEnded ?? data?.activity?.isOpenEnded
      ? "Open Ended"
      : data?.activity?.RunEndAt ?? data?.activity?.runEndAt
      ? (data.activity.RunEndAt || data.activity.runEndAt).split("T")[0]
      : "—";

  const currentLessonName = useMemo(() => {
    if (selected.kind === "lesson") return selected.lesson.lessonName;
    for (const mod of data?.module ?? []) {
      const merged = buildMergedLessons(mod);
      for (const item of merged) {
        if (!item.isDoneLesson) return item.lessonName;
      }
    }
    return "—";
  }, [data, selected, buildMergedLessons]);

  const metaItems = [
    { label: "Organization", value: data?.organization_name ?? "—" },
    { label: "Due date", value: dueDate },
    { label: "Type", value: "Course" },
    { label: "Level", value: data?.course_info?.level ?? "—" },
    { label: "Lesson progress", value: `${completedItems} / ${totalItems}` },
    { label: "Current lesson", value: currentLessonName },
  ];

  const rewardSkills: any[] = data?.course_info?.reward_skills ?? [];

  if (loading)
    return <div className={styles.loadingText}>Loading course...</div>;
  if (!data)
    return <div className={styles.loadingText}>Failed to load course details.</div>;

  return (
    <div className={styles.page}>
      {/* ── LEFT COLUMN ─────────────────────────────────── */}
      <div className={styles.column}>

        {/* Summary panel */}
        <section className={`${styles.panel} ${styles.summaryPanel}`}>
          <div className={styles.topRow}>
            <div>
              <div className={styles.eyebrow}>Student Activity</div>
              <h1 className={styles.title}>
                {data?.activity?.ActivityName ??
                  data?.activity?.activityName ??
                  "Course Name"}
              </h1>
            </div>
            <div className={styles.headerActions}>
              <span className={getStatusPillClass(currentStatus)}>
                {currentStatus}
              </span>
              <button
                className={styles.backButton}
                onClick={() => router.push("/student/activities")}
              >
                Back
              </button>
            </div>
          </div>

          <p className={styles.description}>
            {data?.course_description ?? ""}
          </p>

          <div className={styles.metaGrid}>
            {metaItems.map((item) => (
              <div key={item.label} className={styles.metaCard}>
                <div className={styles.metaLabel}>{item.label}</div>
                <div className={styles.metaValue}>{item.value}</div>
              </div>
            ))}
          </div>

          {rewardSkills.length > 0 && (
            <div className={styles.rewardSkillsSection}>
              <div className={styles.rewardSkillsTitle}>
                Skills you will receive
              </div>
              <div className={styles.rewardSkillsList}>
                {rewardSkills.map((skill: any, i: number) => (
                  <div key={i} className={styles.rewardSkillRow}>
                    <div className={styles.rewardSkillName}>
                      {skill.skillName ?? skill.skill_name}
                    </div>
                    <div className={styles.rewardSkillLevel}>{skill.level}</div>
                    <div className={styles.rewardSkillPercent}>
                      {skill.percentText ?? skill.percent}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.previewStateHint}>
            This status updates automatically after all required lessons and
            lesson quizzes are completed and verified.
          </div>
        </section>

        {/* Module panel */}
        <section className={`${styles.panel} ${styles.modulePanel}`}>
          <div className={styles.sectionTitle}>Modules &amp; lessons</div>

          <div className={styles.moduleScrollArea}>
            {(data?.module ?? []).map((mod: any, modIdx: number) => {
              const mergedLessons = buildMergedLessons(mod);
              const modDone = mergedLessons.filter(
                (l) =>
                  l.isDoneLesson &&
                  (l.quizId === undefined || l.isDoneQuiz)
              ).length;
              const modTotal = mergedLessons.length;

              return (
                <div
                  key={mod.module_id ?? modIdx}
                  className={styles.moduleCard}
                >
                  <div className={styles.moduleHeader}>
                    <div>
                      <div className={styles.moduleTitle}>
                        {mod.module_name ?? `Module ${modIdx + 1}`}
                      </div>
                      {mod.module_description && (
                        <div className={styles.moduleDescription}>
                          {mod.module_description}
                        </div>
                      )}
                    </div>
                    <div className={styles.moduleProgressBadge}>
                      {modDone}/{modTotal}
                    </div>
                  </div>

                  <div className={styles.lessonList}>
                    {mergedLessons.map((item, lIdx) => {
                      const isActive =
                        selected.kind === "lesson" &&
                        selected.lesson.lessonId === item.lessonId;

                      // Card is "done" only when lesson AND quiz (if exists) are both done
                      const isFullyDone =
                        item.isDoneLesson &&
                        (item.quizId === undefined || item.isDoneQuiz);
                      const statusText = isFullyDone
                        ? "Complete"
                        : "In progress";

                      return (
                        <button
                          key={item.lessonId}
                          type="button"
                          className={`${styles.lessonButton} ${
                            isActive ? styles.lessonButtonActive : ""
                          }`}
                          onClick={() =>
                            setSelected({
                              kind: "lesson",
                              moduleId: mod.module_id,
                              moduleName:
                                mod.module_name ?? `Module ${modIdx + 1}`,
                              lesson: item,
                            })
                          }
                        >
                          <div className={styles.lessonMainInfo}>
                            {/* Badge row: Lesson N | article/video | Quiz (if paired) */}
                            <div className={styles.lessonTopLine}>
                              <span className={styles.lessonOrder}>
                                Lesson {lIdx + 1}
                              </span>
                              <span className={styles.lessonContentBadge}>
                                {item.contentType}
                              </span>
                              {item.quizId && (
                                <span className={styles.lessonQuizBadge}>
                                  Quiz
                                </span>
                              )}
                            </div>
                            <div className={styles.lessonButtonTitle}>
                              {item.lessonName}
                            </div>
                            {item.durationText && (
                              <div className={styles.lessonButtonMeta}>
                                {item.durationText}
                              </div>
                            )}
                          </div>
                          <div className={styles.lessonRightInfo}>
                            <span className={styles.lessonStateText}>
                              {statusText}
                            </span>
                          </div>
                        </button>
                      );
                    })}

                    {mergedLessons.length === 0 && (
                      <div className={styles.emptyModule}>Empty module</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* ── RIGHT COLUMN ────────────────────────────────── */}
      <div className={styles.column}>
        {isComplete && (
          <section className={`${styles.panel} ${styles.successPanel}`}>
            <div className={styles.successTitle}>Congratulations !!!</div>
            <div className={styles.successCard}>
              <div className={styles.successCardLabel}>Certificate</div>
              <div className={styles.successCardValue}>
                Download Certificate
              </div>
            </div>
            <div className={styles.successMetaRow}>
              <span>Finished: {submitDate}</span>
              <span>
                XP: +
                {data?.submission_info?.XP ?? data?.submission_info?.xp ?? 0}
              </span>
            </div>
          </section>
        )}

        {/* Placeholder */}
        {selected.kind === "none" && (
          <>
            <section className={`${styles.panel} ${styles.viewerPanel}`}>
              <div className={styles.sectionTitle}>Select a lesson to begin</div>
              <div className={styles.noLessonWrap}>
                <p className={styles.noLessonText}>
                  Choose any lesson from the module list on the left to start
                  learning.
                </p>
              </div>
            </section>
            <section className={`${styles.panel} ${styles.assessmentPanel}`}>
              <div className={styles.sectionTitle}>Lesson quiz</div>
              <div className={styles.noQuizWrap}>
                <div className={styles.noQuizTitle}>No lesson selected</div>
                <div className={styles.assignmentText}>
                  Select a lesson from the left to see its quiz here.
                </div>
              </div>
            </section>
          </>
        )}

        {/* Lesson + (optional) quiz viewer */}
        {selected.kind === "lesson" && (
          <LessonViewer
            activityId={activityId}
            moduleId={selected.moduleId}
            moduleName={selected.moduleName}
            lesson={selected.lesson}
            onFinished={handleFinished}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Entry
// ─────────────────────────────────────────────────────────────
function CourseProgressContent() {
  const searchParams = useSearchParams();
  const activityId = searchParams.get("activityId");
  if (!activityId) return <div>Activity ID is missing.</div>;
  return <CourseMainView activityId={activityId} />;
}

export default function CourseProgress() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CourseProgressContent />
    </Suspense>
  );
}
