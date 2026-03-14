"use client";

import { useRef, useState, useSyncExternalStore } from "react";

type RealtimeStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "listening"
  | "thinking"
  | "speaking"
  | "error";

type RealtimeMessage = {
  id: string;
  role: "assistant" | "system";
  text: string;
};

type OpenAiRealtimeServerEvent = {
  type?: string;
  delta?: string;
  transcript?: string;
  message?: string;
  error?: {
    message?: string;
  };
  response?: {
    output?: Array<{
      content?: Array<{
        transcript?: string;
        text?: string;
      }>;
    }>;
  };
};

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function extractAssistantTextFromDone(event: OpenAiRealtimeServerEvent) {
  const directTranscript = event.transcript?.trim();

  if (directTranscript) {
    return directTranscript;
  }

  const contentList = event.response?.output ?? [];

  for (const item of contentList) {
    for (const content of item.content ?? []) {
      const transcript = content.transcript?.trim() ?? content.text?.trim();

      if (transcript) {
        return transcript;
      }
    }
  }

  return null;
}

export function useOpenAiRealtimeVoice() {
  const [status, setStatus] = useState<RealtimeStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [assistantLiveTranscript, setAssistantLiveTranscript] = useState("");
  const [messages, setMessages] = useState<RealtimeMessage[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const assistantTranscriptBufferRef = useRef("");

  const isSupported = useSyncExternalStore(
    () => () => undefined,
    () =>
      typeof window !== "undefined" &&
      !!window.RTCPeerConnection &&
      !!navigator.mediaDevices?.getUserMedia,
    () => false,
  );

  const cleanupSession = () => {
    dataChannelRef.current?.close();
    dataChannelRef.current = null;

    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current = null;
    }

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    assistantTranscriptBufferRef.current = "";
    setAssistantLiveTranscript("");
  };

  const disconnect = () => {
    cleanupSession();
    setStatus("idle");
    setError(null);
  };

  const pushMessage = (message: RealtimeMessage) => {
    setMessages((current) => [message, ...current].slice(0, 8));
  };

  const sendClientEvent = (event: Record<string, unknown>) => {
    if (dataChannelRef.current?.readyState !== "open") {
      return;
    }

    dataChannelRef.current.send(JSON.stringify(event));
  };

  const greetUser = () => {
    sendClientEvent({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Please greet the user in one short sentence and say you are ready to listen.",
          },
        ],
      },
    });
    sendClientEvent({
      type: "response.create",
    });
  };

  const handleServerEvent = (event: OpenAiRealtimeServerEvent) => {
    if (!event.type) {
      return;
    }

    if (event.type === "input_audio_buffer.speech_started") {
      setStatus("listening");
      return;
    }

    if (event.type === "input_audio_buffer.speech_stopped") {
      setStatus("thinking");
      return;
    }

    if (event.type === "response.output_audio_transcript.delta") {
      const delta = event.delta ?? "";

      if (!delta) {
        return;
      }

      assistantTranscriptBufferRef.current += delta;
      setAssistantLiveTranscript(assistantTranscriptBufferRef.current);
      setStatus("speaking");
      return;
    }

    if (event.type === "response.output_audio_transcript.done") {
      const transcript =
        event.transcript?.trim() ?? assistantTranscriptBufferRef.current.trim();

      if (transcript) {
        pushMessage({
          id: createId("assistant"),
          role: "assistant",
          text: transcript,
        });
      }

      assistantTranscriptBufferRef.current = "";
      setAssistantLiveTranscript("");
      setStatus("connected");
      return;
    }

    if (event.type === "response.done") {
      const transcript = extractAssistantTextFromDone(event);

      if (transcript && transcript !== assistantTranscriptBufferRef.current.trim()) {
        pushMessage({
          id: createId("assistant"),
          role: "assistant",
          text: transcript,
        });
      }

      assistantTranscriptBufferRef.current = "";
      setAssistantLiveTranscript("");
      setStatus("connected");
      return;
    }

    if (event.type === "error" || event.type === "invalid_request_error") {
      const message =
        event.error?.message ?? event.message ?? "Realtime voice hit an error.";
      setError(message);
      setStatus("error");
    }
  };

  const connect = async () => {
    if (isConnecting) {
      return;
    }

    if (
      typeof window === "undefined" ||
      !window.RTCPeerConnection ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setError("Realtime voice is not supported in this browser.");
      setStatus("error");
      return;
    }

    setIsConnecting(true);
    setError(null);
    setStatus("connecting");
    setMessages([]);

    try {
      const tokenResponse = await fetch("/api/realtime/client-secret");
      const tokenPayload = (await tokenResponse.json()) as {
        clientSecret?: string;
        error?: string;
      };

      if (!tokenResponse.ok || !tokenPayload.clientSecret) {
        throw new Error(
          tokenPayload.error ?? "Realtime voice token could not be created.",
        );
      }

      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = localStream;

      const peerConnection = new RTCPeerConnection();
      peerConnectionRef.current = peerConnection;

      const remoteAudio = new Audio();
      remoteAudio.autoplay = true;
      remoteAudio.setAttribute("playsinline", "true");
      remoteAudioRef.current = remoteAudio;

      peerConnection.ontrack = (event) => {
        remoteAudio.srcObject = event.streams[0];
        void remoteAudio.play().catch(() => undefined);
      };

      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;

        if (state === "connected") {
          setStatus("connected");
        }

        if (state === "failed" || state === "closed" || state === "disconnected") {
          cleanupSession();
          setStatus("idle");
        }
      };

      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });

      const dataChannel = peerConnection.createDataChannel("oai-events");
      dataChannelRef.current = dataChannel;

      dataChannel.addEventListener("open", () => {
        setStatus("connected");
        greetUser();
      });
      dataChannel.addEventListener("message", (event) => {
        try {
          handleServerEvent(JSON.parse(event.data) as OpenAiRealtimeServerEvent);
        } catch {
          // Ignore malformed events and keep the session alive.
        }
      });

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${tokenPayload.clientSecret}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        throw new Error(
          `Realtime connection failed: ${sdpResponse.status} ${errorText}`,
        );
      }

      const answerSdp = await sdpResponse.text();
      await peerConnection.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      });
    } catch (caughtError) {
      cleanupSession();
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Realtime voice could not start.",
      );
      setStatus("error");
    } finally {
      setIsConnecting(false);
    }
  };

  return {
    status,
    error,
    messages,
    assistantLiveTranscript,
    isConnecting,
    isSupported,
    connect,
    disconnect,
  };
}
