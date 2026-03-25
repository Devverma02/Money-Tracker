import { containsAnyNormalizedTerm } from "@/lib/text/unicode-search";

export type VoiceReplyMode = "english" | "hinglish" | "hindi";

export type VoiceReplyContext = {
  mode: VoiceReplyMode;
  speechLang: "en-IN" | "hi-IN";
};

const hinglishSignalTerms = [
  "aaj",
  "kal",
  "parso",
  "udhaar",
  "loan",
  "kharcha",
  "paise",
  "paisa",
  "rupaye",
  "rupees",
  "diya",
  "liya",
  "mila",
  "milenge",
  "aayega",
  "aayenge",
  "bachat",
  "salary",
  "ghar",
  "dukaan",
  "kheti",
  "bhai",
  "se",
  "ko",
  "आज",
  "कल",
  "परसों",
  "उधार",
  "पैसे",
  "रुपये",
];

export function getVoiceReplyContext(text: string): VoiceReplyContext {
  if (/[\u0900-\u097f]/.test(text)) {
    return {
      mode: "hindi",
      speechLang: "hi-IN",
    };
  }

  if (containsAnyNormalizedTerm(text, hinglishSignalTerms)) {
    return {
      mode: "hinglish",
      speechLang: "en-IN",
    };
  }

  return {
    mode: "english",
    speechLang: "en-IN",
  };
}

export function voiceText(
  context: VoiceReplyContext,
  copy: {
    english: string;
    hinglish: string;
    hindi: string;
  },
) {
  if (context.mode === "hindi") {
    return copy.hindi;
  }

  if (context.mode === "hinglish") {
    return copy.hinglish;
  }

  return copy.english;
}
