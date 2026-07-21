import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, Square, Pause, Play } from "lucide-react";

export function ReadAloudButton({ text, label }: { text: string; label?: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsPaused(false);
  }, []);

  const toggle = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    if (isPlaying && !isPaused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      return;
    }

    if (isPlaying && isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.lang = "en-US";

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
    setIsPaused(false);
  }, [text, isPlaying, isPaused]);

  if (!supported) return null;

  return (
    <div className="inline-flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={toggle}
        aria-label={
          isPlaying && !isPaused
            ? "Pause reading"
            : isPlaying && isPaused
              ? "Resume reading"
              : `Read aloud: ${label || "page content"}`
        }
        className="h-10 px-3 text-sm border-navy-foreground/30 text-navy-foreground hover:bg-navy-foreground/10 hover:text-navy-foreground bg-transparent"
      >
        {isPlaying && !isPaused ? (
          <>
            <Pause className="h-4 w-4 mr-1.5" />
            Pause
          </>
        ) : isPlaying && isPaused ? (
          <>
            <Play className="h-4 w-4 mr-1.5" />
            Resume
          </>
        ) : (
          <>
            <Volume2 className="h-4 w-4 mr-1.5" />
            Read aloud
          </>
        )}
      </Button>
      {isPlaying && (
        <Button
          variant="ghost"
          size="sm"
          onClick={stop}
          aria-label="Stop reading"
          className="h-10 px-2.5 text-sm text-navy-foreground/80 hover:bg-navy-foreground/10"
        >
          <Square className="h-4 w-4 mr-1.5" />
          Stop
        </Button>
      )}
    </div>
  );
}
