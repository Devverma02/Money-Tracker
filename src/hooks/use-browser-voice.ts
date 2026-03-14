"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type UseBrowserVoiceOptions = {
  locale?: string;
  onFinalTranscript?: (transcript: string) => void | Promise<void>;
};

export function useBrowserVoice(options: UseBrowserVoiceOptions = {}) {
  const { locale = "hi-IN", onFinalTranscript } = options;
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef("");
  const callbackRef = useRef<typeof onFinalTranscript>(onFinalTranscript);

  useEffect(() => {
    callbackRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const Recognition =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!Recognition) {
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = locale;

    recognition.onresult = (event) => {
      let nextFinal = "";
      let nextInterim = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript?.trim() ?? "";

        if (!transcript) {
          continue;
        }

        if (result.isFinal) {
          nextFinal += `${transcript} `;
        } else {
          nextInterim += `${transcript} `;
        }
      }

      if (nextFinal) {
        finalTranscriptRef.current = `${finalTranscriptRef.current} ${nextFinal}`.trim();
      }

      setLiveTranscript(`${finalTranscriptRef.current} ${nextInterim}`.trim());
    };

    recognition.onerror = (event) => {
      setIsListening(false);

      if (event.error === "not-allowed") {
        setError("Microphone permission is blocked.");
        return;
      }

      if (event.error === "no-speech") {
        setError("No speech was detected. Please try again.");
        return;
      }

      setError("Voice capture failed. Please try again.");
    };

    recognition.onend = () => {
      setIsListening(false);
      const finalTranscript = finalTranscriptRef.current.trim();

      if (finalTranscript) {
        void callbackRef.current?.(finalTranscript);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [locale]);

  const isSupported = useSyncExternalStore(
    () => () => undefined,
    () =>
      typeof window !== "undefined" &&
      !!(window.SpeechRecognition ?? window.webkitSpeechRecognition),
    () => false,
  );

  const resetTranscript = () => {
    finalTranscriptRef.current = "";
    setLiveTranscript("");
  };

  const startListening = () => {
    const recognition = recognitionRef.current;

    if (!recognition) {
      setError("This browser does not support live voice capture.");
      return;
    }

    finalTranscriptRef.current = "";
    setLiveTranscript("");
    setError(null);
    setIsListening(true);
    recognition.lang = locale;
    window.speechSynthesis.cancel();

    try {
      recognition.start();
    } catch {
      setIsListening(false);
      setError("Microphone could not start. Please try again.");
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
  };

  const speakText = (text: string, language = "en-IN") => {
    if (typeof window === "undefined" || !window.speechSynthesis || !text.trim()) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = 1.02;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  return {
    isSupported,
    isListening,
    liveTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
    speakText,
  };
}
