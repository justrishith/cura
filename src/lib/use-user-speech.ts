"use client";

// use-user-speech.ts — browser voice I/O for the patient console (Chrome/Edge only).
// Degrades silently: isSupported=false → start()/stop() are no-ops; speak() calls
// onDone immediately when speechSynthesis is missing. No throw paths escape the hook.
import { useCallback, useEffect, useRef, useState } from "react";

// Minimal structural Web Speech API types — lib.dom.d.ts coverage of SpeechRecognition
// varies by TypeScript version, so we cast window instead of relying on globals.
interface SpeechAlternativeLike {
  readonly transcript: string;
}
interface SpeechResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechAlternativeLike;
  [index: number]: SpeechAlternativeLike;
}
interface SpeechResultListLike {
  readonly length: number;
  [index: number]: SpeechResultLike;
}
interface SpeechEventLike {
  readonly resultIndex: number;
  readonly results: SpeechResultListLike;
}
interface SpeechErrorEventLike {
  readonly error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechEventLike) => void) | null;
  onerror: ((event: SpeechErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type UserSpeechState = "idle" | "listening";

export interface UserSpeech {
  state: UserSpeechState;
  /** True when SpeechRecognition exists; false → voice input silently no-ops. */
  isSupported: boolean;
  /** In-flight partial transcript; cleared whenever a recognition session ends. */
  interim: string;
  /** Start listening; onFinal gets the joined final text. onEnded fires as the session closes. */
  start(onFinal: (text: string) => void, onEnded?: () => void): void;
  /** Stop early; pending final text is still delivered via onFinal. */
  stop(): void;
  /** Speak via speechSynthesis at rate 0.95 / en-US; onDone fires at utterance end. */
  speak(text: string, onDone?: () => void): void;
  /** Cancel any queued speech immediately. */
  cancelSpeech(): void;
}

export function useUserSpeech(): UserSpeech {
  const [state, setState] = useState<UserSpeechState>("idle");
  const [isSupported, setIsSupported] = useState(false);
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef<((text: string) => void) | null>(null);
  const endedRef = useRef<(() => void) | null>(null);
  const finalsRef = useRef<string[]>([]);
  const listeningRef = useRef(false);

  useEffect(() => {
    setIsSupported(getRecognitionCtor() !== null);
  }, []);

  const deliverAndReset = useCallback(() => {
    const text = finalsRef.current.join(" ").trim();
    finalsRef.current = [];
    setInterim("");
    setState("idle");
    listeningRef.current = false;
    const onFinal = finalRef.current;
    const onEnded = endedRef.current;
    finalRef.current = null;
    endedRef.current = null;
    if (text && onFinal) {
      try {
        onFinal(text);
      } catch {
        // Consumer errors never break the recognition pipeline.
      }
    }
    if (onEnded) {
      try {
        onEnded();
      } catch {
        // Ignore.
      }
    }
  }, []);

  const start = useCallback((onFinal: (text: string) => void, onEnded?: () => void) => {
    const ctor = getRecognitionCtor();
    if (!ctor || listeningRef.current) return;
    const recognition = new ctor();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let partial = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalsRef.current.push(result[0].transcript);
        else partial += result[0].transcript;
      }
      setInterim(partial);
    };
    recognition.onerror = () => {
      // onend always follows (even for "not-allowed"/"no-speech"); the end
      // handler delivers whatever final text landed, then reports onEnded.
    };
    recognition.onend = () => deliverAndReset();
    finalRef.current = onFinal;
    endedRef.current = onEnded ?? null;
    finalsRef.current = [];
    setInterim("");
    try {
      recognition.start();
    } catch {
      // Already-started or blocked: report the end so the UI returns to idle.
      finalRef.current = null;
      endedRef.current = null;
      if (onEnded) {
        try {
          onEnded();
        } catch {
          // Ignore.
        }
      }
      return;
    }
    recognitionRef.current = recognition;
    listeningRef.current = true;
    setState("listening");
  }, [deliverAndReset]);

  const stop = useCallback(() => {
    if (!listeningRef.current) return;
    try {
      recognitionRef.current?.stop();
    } catch {
      deliverAndReset();
    }
  }, [deliverAndReset]);

  const speak = useCallback((text: string, onDone?: () => void) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      onDone?.();
      return;
    }
    window.speechSynthesis.cancel(); // one voice at a time, no queue buildup
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.lang = "en-US";
    // Prefer the most natural system voice installed (Windows Online Natural
    // voices or Chrome's Google voice); fall back to the platform default.
    const voices = window.speechSynthesis.getVoices();
    const natural =
      voices.find((v) => /(aria|jenny|guy).*natural/i.test(v.name)) ??
      voices.find((v) => /google us english/i.test(v.name)) ??
      null;
    if (natural) utterance.voice = natural;
    if (onDone) {
      utterance.onend = () => onDone();
      utterance.onerror = () => onDone();
    }
    window.speechSynthesis.speak(utterance);
  }, []);

  const cancelSpeech = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  // Unmount cleanup: abort recognition and clear the speech queue.
  useEffect(
    () => () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        // Ignore.
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    },
    [],
  );

  return { state, isSupported, interim, start, stop, speak, cancelSpeech };
}

export default useUserSpeech;
