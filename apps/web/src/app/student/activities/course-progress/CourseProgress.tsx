"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useEffect, useCallback, Suspense } from "react";
import styles from "./page.module.css";

// ----------------------------------------------------
// COMPONENTS
// ----------------------------------------------------

function CourseMainView({ activityId }: { activityId: string }) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // For accordion
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function fetchMain() {
      try {
        const res = await fetch(`/api/student/course/main?activity_id=${activityId}`);
        const json = await res.json();
        if (json.ok) {
          setData(json.data);
          console.log("data", json.data)
          const initialExpanded: Record<string, boolean> = {};
          if (json.data && json.data.module) {
            json.data.module.forEach((mod: any) => {
              initialExpanded[mod.module_id] = true;
            });
          }
          setExpandedModules(initialExpanded);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchMain();
  }, [activityId]);

  const rawStatus = data?.submission_info?.status ?? data?.submission_info?.Status;
  const currentStatus = rawStatus === "" ? "In Progress" : rawStatus || "Incomplete";

  const toggleModule = (modId: string) => {
    setExpandedModules(prev => ({ ...prev, [modId]: !prev[modId] }));
  };

  const isComplete = currentStatus.toLowerCase() === "complete" || currentStatus.toLowerCase() === "completed" || currentStatus.toLowerCase() === "pass";
  const getStatusClass = (status: string) => {
    if (!status) return styles.statusRed;
    const s = status.toLowerCase();
    if (s === "complete" || s === "completed" || s === "pass") return styles.statusGreen;
    if (s === "in progress") return styles.statusBlue;
    return styles.statusRed;
  };

  const submitDate = useMemo(() => {
    const rawDate = data?.submission_info?.submittedAt || data?.submission_info?.SubmittedAt;
    if (!rawDate) return "----";
    const date = new Date(rawDate);
    return date.toLocaleDateString('en-GB');
  }, [data?.submission_info?.submittedAt, data?.submission_info?.SubmittedAt]);

  if (loading) return <div>Loading course...</div>;
  if (!data) return <div>Failed to load course details.</div>;

  return (
    <>
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h1 className={styles.title}>
            {data?.activity?.ActivityName || data?.activity?.activityName || data?.course_name || "Course Name"}
          </h1>
          <button className={styles.backButton} onClick={() => router.push("/student/activities")}>
            Back
          </button>
        </div>
        <p className={styles.description}>{data?.course_description || ""}</p>

        <div className={styles.infoGrid}>
          <div className={styles.infoColumn}>
            <p>Hours : <span>{data?.activity?.Hours ?? data?.activity?.hours ?? 0}</span></p>
            <p>Due date: <span>{(data?.activity?.IsOpenEnded ?? data?.activity?.isOpenEnded) ? "----" : (data?.activity?.RunEndAt || data?.activity?.runEndAt ? `${(data.activity.RunEndAt || data.activity.runEndAt).split("T")[0]} ${(data.activity.RunEndAt || data.activity.runEndAt).split("T")[1]?.split("Z")[0] || ""}` : "----")}</span></p>
          </div>
          <div className={styles.infoColumn}>
            <p>Status : <span className={getStatusClass(currentStatus)}>{currentStatus}</span></p>
            <p>Type : <span>Course</span></p>
          </div>
        </div>
      </section>

      {isComplete && (
        <section className={`${styles.card} ${styles.congratsBanner}`}>
          <h2 className={styles.congratsTitle}>Congratulations !!!</h2>
          <div className={styles.congratsStats}>
            <span>Submit Date : {submitDate}</span>
            <span>EXP : {data?.submission_info?.XP ?? data?.submission_info?.xp ?? 0}</span>
          </div>
        </section>
      )}

      <section className={styles.card} style={{ padding: "24px 32px" }}>
        <h2 className={styles.sectionTitle}>Module</h2>

        {data?.module?.map((mod: any, index: number) => (
          <div key={mod.module_id || index} className={styles.moduleContainer}>
            <div className={styles.moduleHeader} onClick={() => toggleModule(mod.module_id)}>
              <span>{mod.module_name || `Module ${index + 1}`}</span>
              <span>{expandedModules[mod.module_id] ? "v" : "<"}</span>
            </div>
            {expandedModules[mod.module_id] && (
              <div className={styles.moduleContent}>

                {/* Lessons */}
                {mod.lesson?.map((lesson: any, lIndex: number) => {
                  const isDone = data.complete?.lesson?.some((l: any) => l.lesson_id === lesson.lesson_id);
                  return (
                    <div
                      key={lesson.lesson_id || lIndex}
                      className={styles.lessonItem}
                      onClick={() => router.push(`/student/activities/course-progress?activityId=${activityId}&moduleId=${mod.module_id}&lessonId=${lesson.lesson_id}`)}
                    >
                      <span className={styles.lessonName}>{lesson.lesson_name || "Video Link"}</span>
                      <div className={styles.lessonStatus}>
                        {isDone && <span className={styles.statusPass}>&#10003;</span>}
                      </div>
                    </div>
                  );
                })}

                {/* Quizzes */}
                {mod.quiz?.map((quiz: any, qIndex: number) => {
                  const isDone = data.complete?.quiz?.some((q: any) => q.quiz_id === quiz.quiz_id);
                  return (
                    <div
                      key={quiz.quiz_id || qIndex}
                      className={styles.lessonItem}
                      onClick={() => router.push(`/student/activities/course-progress?activityId=${activityId}&moduleId=${mod.module_id}&quizId=${quiz.quiz_id}`)}
                    >
                      <span className={styles.lessonName}>{quiz.quiz_name || "Quiz"}</span>
                      <div className={styles.lessonStatus}>
                        {isDone && <span className={styles.statusPass}>&#10003;</span>}
                      </div>
                    </div>
                  );
                })}

                {(!mod.lesson || mod.lesson.length === 0) && (!mod.quiz || mod.quiz.length === 0) && (
                  <span style={{ color: "#6b7280", fontSize: "0.9rem", paddingLeft: 16 }}>Empty Module</span>
                )}
              </div>
            )}
          </div>
        ))}

      </section>
    </>
  );
}

function CourseLessonView({ activityId, moduleId, lessonId }: { activityId: string, moduleId: string, lessonId: string }) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchLesson() {
      try {
        const res = await fetch(`/api/student/course/lesson?activity_id=${activityId}&module_id=${moduleId}&lesson_id=${lessonId}`);
        const json = await res.json();
        if (json.ok) {
          setData(json.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchLesson();
  }, [activityId, moduleId, lessonId]);

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/student/submission/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activity_id: activityId, done_lesson: { lessonID: lessonId, moduleID: moduleId } })
      });
      if (res.ok) {
        router.push(`/student/activities/course-progress?activityId=${activityId}`);
      } else {
        alert("Failed to submit lesson");
      }
    } catch (err) {
      console.error("Submission error", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>Loading lesson...</div>;

  const isVideo = data?.type?.toLowerCase() === "video";

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <img src="/assets/icons/student/activityProgress/backCourseArrow.svg" alt="" style={{ width: 24, cursor: "pointer", display: "none" }} />
          {/* Not in original screenshot, just back button on right is ok? Wait, the screenshot has backbutton in general layout? No, it has finish button at bottom. The video screen has no top back button? Oh, image 2 has no back button, just title and Finish. Wait, I will add a back button for safety. */}
          <h1 className={styles.title} style={{ display: "none" }}>Video Link</h1>
        </div>
        <button className={styles.backButton} onClick={() => router.push(`/student/activities/course-progress?activityId=${activityId}`)}>
          Back
        </button>
      </div>

      <h2 className={styles.lessonTitle}>{data?.title || "Untitled Lesson"}</h2>

      {isVideo ? (
        <div style={{ marginBottom: "24px", width: "100%", borderRadius: "8px", overflow: "hidden" }}>
          <iframe
            width="100%"
            height="400"
            src={data?.data}
            title={data?.title || "Video player"}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ borderRadius: "8px", backgroundColor: "#000" }}
          ></iframe>
        </div>
      ) : (
        <p style={{ fontSize: "0.95rem", color: "#4b5563", whiteSpace: "pre-wrap", marginBottom: "24px" }}>
          {data?.data || ""}
        </p>
      )}

      <div className={styles.finishButtonContainer}>
        <button className={styles.finishButton} onClick={handleFinish} disabled={submitting || data?.is_done}>
          {submitting ? "Submitting..." : (data?.is_done ? "Finished" : "Finish")}
        </button>
      </div>
    </section>
  );
}

function CourseQuizView({ activityId, moduleId, quizId }: { activityId: string, moduleId: string, quizId: string }) {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchQuiz() {
      try {
        const res = await fetch(`/api/student/course/quiz?activity_id=${activityId}&module_id=${moduleId}&quiz_id=${quizId}`);
        const json = await res.json();
        if (json.ok) {
          setData(json.data);
          console.log("data", json.data)
          if (json.data.is_done && json.data.answer) {
            const initialAnswers: Record<string, string> = {};
            json.data.answer.forEach((ans: any) => {
              initialAnswers[ans.question_id] = ans.answer;
            });
            setAnswers(initialAnswers);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchQuiz();
  }, [activityId, moduleId, quizId]);

  const handleSelect = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      const mappedAnswers = Object.entries(answers).map(([question_id, answer]) => ({
        question_id,
        answer
      }));

      const res = await fetch("/api/student/submission/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activity_id: activityId, quiz_id: quizId, answers: mappedAnswers })
      });

      if (res.ok) {
        // Re-fetch or go back
        const resJson = await res.json();
        router.push(`/student/activities/course-progress?activityId=${activityId}`);
      } else {
        alert("Failed to submit quiz");
      }
    } catch (err) {
      console.error("Submission error", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div>Loading quiz...</div>;

  const questions = data?.questions || [];

  // If backend tells us it's done or we have a score
  const isCompleted = data?.is_done || false;
  const score = data?.score !== undefined ? `${data.score}/${data.max_score}` : "";

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <h1 className={styles.title}>{data?.title || "Data Type and Logic"}</h1>
          <p className={styles.subtitle} style={{ marginTop: 8, marginBottom: 0 }}>Quiz</p>
        </div>
        <button className={styles.backButton} onClick={() => router.push(`/student/activities/course-progress?activityId=${activityId}`)}>
          Back
        </button>
      </div>

      {questions.map((q: any, idx: number) => {
        // Handle options array that might be stringified strings
        let parsedChoices = q.options || [];
        if (parsedChoices.length === 1 && typeof parsedChoices[0] === "string" && parsedChoices[0].startsWith("[")) {
          try { parsedChoices = JSON.parse(parsedChoices[0]); } catch (e) { }
        } else if (parsedChoices.length > 0 && typeof parsedChoices[0] === "string" && parsedChoices[0].startsWith("[")) {
          try { parsedChoices = JSON.parse(parsedChoices.join(", ")); } catch (e) { }
        }

        return (
          <div key={q.question_id || idx} className={styles.questionBlock}>
            <div className={styles.questionText}>
              {idx + 1}. {q.question}
            </div>

            <div className={styles.choicesList}>
              {parsedChoices.map((choice: string, cIdx: number) => (
                <label key={cIdx} className={styles.choiceItem}>
                  <input
                    type="radio"
                    name={`question-${q.question_id}`}
                    className={styles.choiceRadio}
                    checked={answers[q.question_id] === choice}
                    onChange={() => handleSelect(q.question_id, choice)}
                    disabled={isCompleted}
                  />
                  <span>{choice}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}

      {isCompleted && (
        <div className={styles.quizScore}>
          Score: {score}
        </div>
      )}

      <div className={styles.finishButtonContainer}>
        <button
          className={styles.finishButton}
          onClick={handleFinish}
          disabled={submitting || isCompleted}
        >
          {submitting ? "Submitting..." : "Finish"}
        </button>
      </div>
    </section>
  );
}

function CourseProgressContent() {
  const searchParams = useSearchParams();
  const activityId = searchParams.get("activityId");
  const moduleId = searchParams.get("moduleId");
  const lessonId = searchParams.get("lessonId");
  const quizId = searchParams.get("quizId");

  if (!activityId) {
    return <div>Activity ID is missing.</div>;
  }

  if (lessonId && moduleId) {
    return <CourseLessonView activityId={activityId} moduleId={moduleId} lessonId={lessonId} />;
  }

  if (quizId && moduleId) {
    return <CourseQuizView activityId={activityId} moduleId={moduleId} quizId={quizId} />;
  }

  return <CourseMainView activityId={activityId} />;
}

export default function CourseProgress() {
  return (
    <div className={styles.container}>
      <Suspense fallback={<div>Loading router...</div>}>
        <CourseProgressContent />
      </Suspense>
    </div>
  );
}
