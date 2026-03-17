"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type UseNativeSpeechOptions = {
  locale?: string;
  onFinalTranscript?: (transcript: string) => void | Promise<void>;
};

export function useNativeSpeech(options: UseNativeSpeechOptions = {}) {
  const { locale = "hi-IN", onFinalTranscript } = options;
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const callbackRef = useRef<typeof onFinalTranscript>(onFinalTranscript);
  const finalTranscriptRef = useRef("");

  useEffect(() => {
    callbackRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const isSupported = useSyncExternalStore(
    () => () => undefined,
    () =>
      typeof window !== "undefined" &&
      !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    () => false,
  );

  const speakText = (
    text: string,
    language = "en-IN",
    onEnd?: () => void,
  ) => {
    if (typeof window === "undefined" || !window.speechSynthesis || !text.trim()) {
      onEnd?.();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = 1.02;
    utterance.pitch = 1;
    utterance.onend = () => {
      onEnd?.();
    };
    utterance.onerror = () => {
      onEnd?.();
    };
    window.speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    if (typeof window === "undefined") {
      setError("This browser does not support microphone capture.");
      return;
    }

    const RecognitionConstructor =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!RecognitionConstructor) {
      setError("This browser does not support speech recognition.");
      return;
    }

    try {
      const recognition = new RecognitionConstructor();
      recognition.lang = locale;
      recognition.continuous = false;
      recognition.interimResults = true;
      finalTranscriptRef.current = "";
      setLiveTranscript("");
      setError(null);
      window.speechSynthesis.cancel();

      recognition.onresult = (event) => {
        let interimTranscript = "";
        let finalTranscript = finalTranscriptRef.current;

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const transcript = event.results[index][0]?.transcript ?? "";

          if (event.results[index].isFinal) {
            finalTranscript = `${finalTranscript} ${transcript}`.trim();
          } else {
            interimTranscript = `${interimTranscript} ${transcript}`.trim();
          }
        }

        finalTranscriptRef.current = finalTranscript;
        setLiveTranscript(`${finalTranscript} ${interimTranscript}`.trim());
      };

      recognition.onerror = (event) => {
        setIsListening(false);

        if (event.error === "aborted") {
          return;
        }

        if (event.error === "not-allowed") {
          setError("Microphone permission is blocked.");
          return;
        }

        if (event.error === "no-speech") {
          setError("No speech was detected. Please try again.");
          return;
        }

        setError("Speech recognition failed. Please try again.");
      };

      recognition.onend = () => {
        setIsListening(false);
        const transcript = finalTranscriptRef.current.trim();
        recognitionRef.current = null;

        if (!transcript) {
          return;
        }

        void callbackRef.current?.(transcript);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      setError("Speech recognition could not start.");
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
  };

  return {
    isSupported,
    isListening,
    liveTranscript,
    error,
    startListening,
    stopListening,
    speakText,
  };
}
