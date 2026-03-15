import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { 
  useGetLetterByToken, 
  useUnlockLetter,
  useCreateReply,
  LetterDetailResponse
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WaxSeal } from "@/components/WaxSeal";
import { ArabesqueDivider } from "@/components/ArabesqueDivider";
import { Lock, Unlock, Send, Loader2 } from "lucide-react";

export default function LetterView() {
  const [, params] = useRoute("/letter/:token");
  const token = params?.token || "";

  const { data: metaData, isLoading: metaLoading, isError: metaError } = useGetLetterByToken(token);
  const unlockMutation = useUnlockLetter();
  const replyMutation = useCreateReply();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [unlockedData, setUnlockedData] = useState<LetterDetailResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [replyBody, setReplyBody] = useState("");
  const [replyFrom, setReplyFrom] = useState("");
  const [replySuccess, setReplySuccess] = useState(false);

  const questions = metaData?.questions || [];
  const isComplete = currentQuestionIndex >= questions.length;
  const isUnlocked = !!unlockedData;

  const handleNextQuestion = () => {
    const currentQ = questions[currentQuestionIndex];
    if (!answers[currentQ.id]?.trim()) {
      setErrorMsg("الرجاء إدخال الإجابة");
      return;
    }
    setErrorMsg("");
    setCurrentQuestionIndex(prev => prev + 1);
  };

  const handleUnlock = async () => {
    try {
      setErrorMsg("");
      const formattedAnswers = Object.entries(answers).map(([id, answer]) => ({
        questionId: id,
        answer: answer.trim()
      }));

      const result = await unlockMutation.mutateAsync({
        token,
        data: { answers: formattedAnswers }
      });
      
      setUnlockedData(result);
    } catch (err: any) {
      setErrorMsg("بعض الإجابات غير صحيحة. حاول مرة أخرى.");
      // Reset to first question on fail to re-verify
      setCurrentQuestionIndex(0);
      setAnswers({});
    }
  };

  const handleReply = async () => {
    if (!replyBody.trim() || !replyFrom.trim()) return;
    try {
      await replyMutation.mutateAsync({
        data: { token, replyBody, replyFrom }
      });
      setReplySuccess(true);
    } catch (err) {
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
          <p className="text-muted-foreground">الرمز الذي أدخلته غير صحيح أو أن الرسالة لم تعد متوفرة.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden selection:bg-primary/20 selection:text-primary">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 bg-parchment-pattern opacity-50 mix-blend-multiply pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.8)_0%,transparent_100%)] pointer-events-none" />
      
      <main className="relative z-10 w-full max-w-4xl mx-auto px-4 py-12 md:py-24 min-h-screen flex flex-col items-center">
        
        {/* State 1: Security Verification */}
        <AnimatePresence mode="wait">
          {!isUnlocked && (
            <motion.div
              key="verification"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
              transition={{ duration: 0.6 }}
              className="w-full max-w-md mt-12"
            >
              <div className="text-center mb-10">
                <WaxSeal className="w-24 h-24 mx-auto mb-6" />
                <h1 className="font-display text-4xl text-gradient-gold mb-2">رسالة مغلقة</h1>
                <p className="text-lg text-foreground/80">إلى: {metaData.recipientName}</p>
              </div>

              {questions.length > 0 ? (
                <div className="bg-card/80 backdrop-blur-md border border-[#C9A84C]/30 p-8 rounded-3xl shadow-xl royal-shadow">
                  {errorMsg && (
                    <div className="mb-6 p-3 bg-destructive/10 text-destructive text-sm text-center rounded-xl font-medium border border-destructive/20">
                      {errorMsg}
                    </div>
                  )}

                  {!isComplete ? (
                    <motion.div
                      key={currentQuestionIndex}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-6"
                    >
                      <div className="space-y-2 text-center">
                        <span className="text-xs font-bold text-primary tracking-widest uppercase mb-2 block">
                          سؤال الأمان {currentQuestionIndex + 1} من {questions.length}
                        </span>
                        <h3 className="font-display text-2xl text-foreground">
                          {questions[currentQuestionIndex].questionText}
                        </h3>
                      </div>
                      
                      <Input
                        autoFocus
                        placeholder="أدخل إجابتك هنا..."
                        className="h-14 text-center text-lg bg-background"
                        value={answers[questions[currentQuestionIndex].id] || ""}
                        onChange={(e) => setAnswers(prev => ({ ...prev, [questions[currentQuestionIndex].id]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && handleNextQuestion()}
                      />

                      <Button variant="royal" className="w-full h-14 text-lg" onClick={handleNextQuestion}>
                        التالي
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center space-y-6"
                    >
                      <div className="w-20 h-20 bg-green-500/10 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/20">
                        <Unlock className="w-10 h-10" />
                      </div>
                      <h3 className="font-display text-2xl text-foreground">تمت الإجابة</h3>
                      <p className="text-muted-foreground">فض الختم للاطلاع على محتوى الرسالة الملكية.</p>
                      
                      <Button 
                        variant="royal" 
                        className="w-full h-14 text-lg" 
                        onClick={handleUnlock}
                        isLoading={unlockMutation.isPending}
                      >
                        فتح الرسالة
                      </Button>
                    </motion.div>
                  )}
                </div>
              ) : (
                <div className="text-center mt-12">
                  <Button 
                    variant="royal" 
                    className="h-16 px-12 text-xl rounded-full shadow-2xl" 
                    onClick={handleUnlock}
                    isLoading={unlockMutation.isPending}
                  >
                    فض الختم وفتح الرسالة
                  </Button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* State 2: Unlocked Letter View */}
        <AnimatePresence>
          {isUnlocked && unlockedData && (
            <motion.div
              key="letter"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
              className="w-full"
            >
              {/* The Parchment Paper */}
              <div className="relative w-full bg-[#FAF7F0] shadow-2xl rounded-sm p-8 md:p-16 lg:p-24 border border-[#e6dbb8] royal-shadow overflow-hidden">
                {/* Paper texture overlay inside */}
                <div className="absolute inset-0 bg-parchment-pattern opacity-60 mix-blend-multiply pointer-events-none" />
                
                {/* Golden inner border */}
                <div className="absolute inset-4 md:inset-6 border-[1.5px] border-[#C9A84C]/40 pointer-events-none" />
                <div className="absolute inset-[18px] md:inset-[26px] border-[0.5px] border-[#C9A84C]/20 pointer-events-none" />

                <div className="relative z-10">
                  <div className="flex justify-center mb-8">
                    <WaxSeal className="w-20 h-20 shadow-none drop-shadow-md" />
                  </div>
                  
                  <div className="text-center mb-12">
                    <h1 className="font-display text-4xl md:text-5xl text-[#2C1810] mb-4">
                      {unlockedData.letter.title}
                    </h1>
                    <p className="font-sans text-xl text-[#5a4231]">
                      إلى السيد/ة: <span className="font-bold">{unlockedData.letter.recipientName}</span>
                    </p>
                  </div>

                  <ArabesqueDivider className="mb-12" />

                  <div 
                    className="font-script text-[26px] md:text-[32px] leading-[2.5] text-[#2C1810] text-justify whitespace-pre-wrap px-2 md:px-8"
                    dir={unlockedData.letter.language === 'english' ? 'ltr' : 'rtl'}
                  >
                    {unlockedData.letter.body}
                  </div>

                  <ArabesqueDivider className="mt-16 mb-8" />
                  
                  <div className="text-left font-sans text-sm text-[#8b7355] mt-8" dir="ltr">
                    صدرت في: {new Date(unlockedData.letter.createdAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </div>
              </div>

              {/* Reply Section */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2, duration: 1 }}
                className="mt-16 max-w-2xl mx-auto"
              >
                {!replySuccess ? (
                  <div className="bg-card/50 backdrop-blur-sm border border-[#C9A84C]/30 p-8 rounded-3xl shadow-lg">
                    <h3 className="font-display text-2xl text-foreground mb-6">إرسال رد على الرسالة</h3>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold">اسم المرسل</label>
                        <Input 
                          placeholder="الاسم الكريم..." 
                          className="bg-background"
                          value={replyFrom}
                          onChange={e => setReplyFrom(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold">محتوى الرد</label>
                        <Textarea 
                          placeholder="اكتب ردك هنا..." 
                          className="bg-background min-h-[150px]"
                          value={replyBody}
                          onChange={e => setReplyBody(e.target.value)}
                        />
                      </div>
                      <Button 
                        variant="royal" 
                        className="w-full h-12" 
                        onClick={handleReply}
                        isLoading={replyMutation.isPending}
                        disabled={!replyBody.trim() || !replyFrom.trim()}
                      >
                        <Send className="w-4 h-4 me-2" /> إرسال الرد
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-500/10 border border-green-500/20 p-8 rounded-3xl text-center">
                    <div className="w-16 h-16 bg-green-500/20 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Send className="w-8 h-8" />
                    </div>
                    <h3 className="font-display text-2xl text-green-800 dark:text-green-400 mb-2">تم الإرسال بنجاح</h3>
                    <p className="text-green-700/80 dark:text-green-300/80">لقد تم إرسال ردكم إلى الديوان، شكراً لكم.</p>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
