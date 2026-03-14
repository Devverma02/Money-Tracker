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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const callbackRef = useRef<typeof onFinalTranscript>(onFinalTranscript);

  useEffect(() => {
    callbackRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      mediaRecorderRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const isSupported = useSyncExternalStore(
    () => () => undefined,
    () =>
      typeof window !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof window.MediaRecorder !== "undefined",
    () => false,
  );

  const resetRecorder = () => {
    mediaRecorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    chunksRef.current = [];
    setIsListening(false);
  };

  const transcribeRecording = async (audioBlob: Blob) => {
    const formData = new FormData();
    const mimeType = audioBlob.type || "audio/webm";
    const extension = mimeType.includes("mp4") || mimeType.includes("mpeg") ? "mp3" : "webm";
    formData.append(
      "audio",
      new File([audioBlob], `speech.${extension}`, {
        type: mimeType,
      }),
    );
    formData.append("locale", locale);

    const response = await fetch("/api/transcribe", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json()) as {
      text?: string;
      error?: string;
    };

    if (!response.ok || !payload.text) {
      throw new Error(
        payload.error ?? "OpenAI transcription could not understand the audio.",
      );
    }

    return payload.text.trim();
  };

  const startListening = async () => {
    if (
      typeof window === "undefined" ||
      typeof window.MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setError("This browser does not support microphone recording.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      chunksRef.current = [];
      setError(null);
      setLiveTranscript("");
      window.speechSynthesis.cancel();

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : undefined,
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setError("Voice recording failed. Please try again.");
        resetRecorder();
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        resetRecorder();

        if (audioBlob.size === 0) {
          setError("No speech was captured. Please try again.");
          return;
        }

        setLiveTranscript("Transcribing with OpenAI...");

        void (async () => {
          try {
            const transcript = await transcribeRecording(audioBlob);
            setLiveTranscript(transcript);
            await callbackRef.current?.(transcript);
          } catch (caughtError) {
            setLiveTranscript("");
            setError(
              caughtError instanceof Error
                ? caughtError.message
                : "Transcription failed. Please try again.",
            );
          }
        })();
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsListening(true);
    } catch {
      resetRecorder();
      setError("Microphone permission is blocked or recording could not start.");
    }
  };

  const stopListening = () => {
    const recorder = mediaRecorderRef.current;

    if (!recorder || recorder.state === "inactive") {
      return;
    }

    recorder.stop();
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
    speakText,
  };
}
