import { useState } from "react";
import { useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetLetterByToken,
  useUnlockLetter,
  useCreateReply,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WaxSeal } from "@/components/WaxSeal";
import { ArabesqueDivider } from "@/components/ArabesqueDivider";
import { Lock, Send, Loader2, Crown, User, MessageSquare, AlertCircle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export default function LetterView() {
  const [, params] = useRoute("/letter/:token");
  const token = params?.token || "";

  const { data: metaData, isLoading: metaLoading, isError: metaError } = useGetLetterByToken(token);
  const unlockMutation = useUnlockLetter();
  const replyMutation = useCreateReply();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [unlockedData, setUnlockedData] = useState<any>(null);
  const [questionError, setQuestionError] = useState<{ message: string; failedIndex?: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [replyBody, setReplyBody] = useState("");
  const [replyFrom, setReplyFrom] = useState("");
  const [replySuccess, setReplySuccess] = useState(false);

  const questions = metaData?.questions || [];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  const handleAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentQ = questions[currentQuestionIndex];
    if (!answers[currentQ.id]?.trim()) {
      setQuestionError({ message: "الرجاء إدخال الإجابة", failedIndex: currentQuestionIndex });
      return;
    }
    setQuestionError(null);

    if (!isLastQuestion) {
      // Move to next question
      setCurrentQuestionIndex(prev => prev + 1);
      return;
    }

    // Last question — submit all answers to API
    setSubmitting(true);
    try {
      const formattedAnswers = Object.entries(answers).map(([id, answer]) => ({
        questionId: id,
        answer: answer.trim(),
      }));

      const result = await unlockMutation.mutateAsync({
        token,
        data: { answers: formattedAnswers },
      });

      setUnlockedData(result);
    } catch (err: any) {
      const errorData = err?.response?.data || err?.data || {};
      const failedIndex = errorData.failedIndex ?? currentQuestionIndex;
      const message = errorData.message || "إجابة خاطئة، حاول مرة أخرى";

      // Go back to the failed question and clear only its answer
      const failedQ = questions[failedIndex];
      if (failedQ) {
        setAnswers(prev => ({ ...prev, [failedQ.id]: "" }));
        setCurrentQuestionIndex(failedIndex);
      }
      setQuestionError({ message, failedIndex });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async () => {
    if (!replyBody.trim() || !replyFrom.trim()) return;
    try {
      await replyMutation.mutateAsync({
        data: { token, replyBody, replyFrom },
      });
      setReplySuccess(true);
    } catch {
      alert("حدث خطأ أثناء إرسال الرد");
    }
  };

  if (metaLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  if (metaError || !metaData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <Lock className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-display text-2xl mb-2 text-foreground">رسالة غير صالحة</h2>
          <p className="text-muted-foreground">الرمز غير صحيح أو الرسالة غير متوفرة.</p>
        </div>
      </div>
    );
  }

  const replies: any[] = unlockedData?.letter?.replies || [];
  const isUnlocked = !!unlockedData;

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden" dir="rtl">
      <div className="fixed inset-0 bg-parchment-pattern opacity-40 mix-blend-multiply pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.8)_0%,transparent_70%)] pointer-events-none" />

      <main className="relative z-10 w-full max-w-4xl mx-auto px-4 py-12 md:py-20 min-h-screen flex flex-col items-center">

        {/* LOCK SCREEN */}
        <AnimatePresence mode="wait">
          {!isUnlocked && (
            <motion.div
              key="verification"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
              transition={{ duration: 0.6 }}
              className="w-full max-w-md mt-8"
            >
              <div className="text-center mb-10">
                <WaxSeal className="w-24 h-24 mx-auto mb-6" />
                <h1 className="font-display text-4xl text-gradient-gold mb-2">رسالة مختومة</h1>
                <p className="text-lg text-foreground/80">إلى: <strong>{metaData.recipientName}</strong></p>
              </div>

              {questions.length > 0 ? (
                <div className="bg-card/80 backdrop-blur-md border border-[#C9A84C]/30 p-8 rounded-3xl shadow-2xl royal-shadow">
                  {/* Progress dots */}
                  <div className="flex justify-center gap-2 mb-6">
                    {questions.map((_, i) => (
                      <div
                        key={i}
                        className={`h-2 rounded-full transition-all duration-300 ${
                          i < currentQuestionIndex
                            ? "w-8 bg-green-500"
                            : i === currentQuestionIndex
                            ? "w-8 bg-primary"
                            : "w-3 bg-muted"
                        }`}
                      />
                    ))}
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.form
                      key={currentQuestionIndex}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, y: 0, opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.25 }}
                      onSubmit={handleAnswer}
                      className="space-y-5"
                    >
                      <div className="text-center space-y-2">
                        <span className="text-xs font-bold text-primary tracking-widest block">
                          سؤال {currentQuestionIndex + 1} من {questions.length}
                        </span>
                        <h3 className="font-display text-2xl text-foreground leading-snug">
                          {questions[currentQuestionIndex].questionText}
                        </h3>
                      </div>

                      {/* Error message for this question */}
                      {questionError && questionError.failedIndex === currentQuestionIndex && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-xl"
                        >
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          {questionError.message}
                        </motion.div>
                      )}

                      <Input
                        autoFocus
                        placeholder="أدخل إجابتك هنا..."
                        className={`h-14 text-center text-lg bg-background ${
                          questionError?.failedIndex === currentQuestionIndex
                            ? "border-destructive focus-visible:ring-destructive"
                            : ""
                        }`}
                        value={answers[questions[currentQuestionIndex].id] || ""}
                        onChange={e => {
                          setAnswers(prev => ({ ...prev, [questions[currentQuestionIndex].id]: e.target.value }));
                          if (questionError?.failedIndex === currentQuestionIndex) setQuestionError(null);
                        }}
                      />

                      {/* Show completed previous questions */}
                      {currentQuestionIndex > 0 && (
                        <div className="space-y-1">
                          {questions.slice(0, currentQuestionIndex).map((q, i) => (
                            <div key={q.id} className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                              <span>السؤال {i + 1}: أُجيب ✓</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <Button
                        type="submit"
                        variant="royal"
                        className="w-full h-14 text-lg"
                        disabled={submitting}
                      >
                        {submitting ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="animate-spin w-5 h-5" /> جارٍ التحقق...
                          </span>
                        ) : isLastQuestion ? "فض الختم وافتح الرسالة" : "التالي ←"}
                      </Button>
                    </motion.form>
                  </AnimatePresence>
                </div>
              ) : (
                <div className="text-center mt-12">
                  <Button
                    variant="royal"
                    className="h-16 px-12 text-xl rounded-full shadow-2xl"
                    onClick={() => unlockMutation.mutateAsync({ token, data: { answers: [] } }).then(setUnlockedData)}
                    disabled={unlockMutation.isPending}
                  >
                    {unlockMutation.isPending
                      ? <span className="flex items-center gap-2"><Loader2 className="animate-spin w-5 h-5" />جارٍ الفتح...</span>
                      : "فض الختم وافتح الرسالة"}
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* LETTER CONTENT */}
        <AnimatePresence>
          {isUnlocked && unlockedData && (
            <motion.div
              key="letter"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
              className="w-full"
            >
              {/* Parchment Paper */}
              <div className="relative w-full bg-[#FAF7F0] shadow-2xl rounded-sm p-8 md:p-16 lg:p-20 border border-[#e6dbb8] royal-shadow overflow-hidden">
                <div className="absolute inset-0 bg-parchment-pattern opacity-50 mix-blend-multiply pointer-events-none" />
                <div className="absolute inset-4 md:inset-6 border border-[#C9A84C]/40 pointer-events-none" />
                <div className="absolute inset-[18px] md:inset-[26px] border border-[#C9A84C]/15 pointer-events-none" />

                <div className="relative z-10">
                  <div className="flex justify-center mb-8">
                    <WaxSeal className="w-20 h-20 drop-shadow-md" />
                  </div>
                  <div className="text-center mb-10">
                    <h1 className="font-display text-4xl md:text-5xl text-[#2C1810] mb-3">{unlockedData.letter.title}</h1>
                    <p className="text-xl text-[#5a4231]">إلى السيد/ة: <strong>{unlockedData.letter.recipientName}</strong></p>
                  </div>
                  <ArabesqueDivider className="mb-12" />
                  <div
                    className="font-script text-[26px] md:text-[30px] leading-[2.6] text-[#2C1810] whitespace-pre-wrap px-2 md:px-8"
                    dir={unlockedData.letter.language === "english" ? "ltr" : "rtl"}
                    style={{ textAlign: unlockedData.letter.language === "english" ? "left" : "right" }}
                  >
                    {unlockedData.letter.body}
                  </div>
                  <ArabesqueDivider className="mt-14 mb-8" />
                  <p className="text-right text-sm text-[#8b7355]">
                    صدرت في: {format(new Date(unlockedData.letter.createdAt), "d MMMM yyyy", { locale: ar })}
                  </p>
                </div>
              </div>

              {/* Conversation Thread */}
              {replies.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.5 }}
                  className="mt-12 max-w-2xl mx-auto space-y-4"
                >
                  <h3 className="font-display text-xl flex items-center gap-2 text-foreground">
                    <MessageSquare className="w-5 h-5 text-primary" /> المراسلات
                  </h3>
                  {replies.map((reply: any) => {
                    const isAdminReply = reply.replyFrom === "__admin__";
                    return (
                      <motion.div
                        key={reply.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex gap-3 ${isAdminReply ? "flex-row-reverse" : ""}`}
                      >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isAdminReply ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                          {isAdminReply ? <Crown className="w-4 h-4" /> : <User className="w-4 h-4" />}
                        </div>
                        <div className={`max-w-sm flex flex-col ${isAdminReply ? "items-end" : "items-start"}`}>
                          <div className={`px-4 py-3 rounded-2xl font-script text-lg leading-relaxed ${isAdminReply ? "bg-primary/10 border border-primary/20 rounded-tr-sm" : "bg-muted/60 border border-border/50 rounded-tl-sm"}`}>
                            <p className="text-xs font-sans font-semibold text-muted-foreground mb-1">
                              {isAdminReply ? "أحمد" : reply.replyFrom}
                            </p>
                            <p>{reply.replyBody}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 font-sans">
                            {format(new Date(reply.createdAt), "d MMM - HH:mm", { locale: ar })}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}

              {/* Reply Form */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2, duration: 1 }}
                className="mt-12 max-w-2xl mx-auto"
              >
                {!replySuccess ? (
                  <div className="bg-card/60 backdrop-blur-sm border border-[#C9A84C]/30 p-8 rounded-3xl shadow-lg">
                    <h3 className="font-display text-2xl text-foreground mb-6 flex items-center gap-2">
                      <Send className="w-5 h-5 text-primary" /> أرسل رداً
                    </h3>
                    <div className="space-y-5">
                      <div>
                        <label className="text-sm font-semibold block mb-1.5">اسمك الكريم</label>
                        <Input placeholder="أدخل اسمك..." className="bg-background h-12" value={replyFrom} onChange={e => setReplyFrom(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-sm font-semibold block mb-1.5">رسالتك</label>
                        <Textarea placeholder="اكتب ردك هنا..." className="bg-background min-h-[140px] font-script text-xl leading-loose" value={replyBody} onChange={e => setReplyBody(e.target.value)} />
                      </div>
                      <Button
                        variant="royal"
                        className="w-full h-12"
                        onClick={handleReply}
                        disabled={replyMutation.isPending || !replyBody.trim() || !replyFrom.trim()}
                      >
                        {replyMutation.isPending
                          ? <span className="flex items-center gap-2"><Loader2 className="animate-spin w-4 h-4" />جارٍ الإرسال...</span>
                          : <><Send className="w-4 h-4 me-2" />إرسال الرد</>}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-green-50 border border-green-200 p-10 rounded-3xl text-center"
                  >
                    <div className="w-16 h-16 bg-green-500/20 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-200">
                      <Send className="w-8 h-8" />
                    </div>
                    <h3 className="font-display text-2xl text-green-800 mb-2">تم إرسال ردك بنجاح</h3>
                    <p className="text-green-700/80">شكراً لك، وصلنا ردك إلى الديوان.</p>
                  </motion.div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
