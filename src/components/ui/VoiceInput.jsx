import { useCallback, useEffect, useRef, useState } from "react";
import { recordVoiceNote } from "../../lib/media.js";

export function VoiceInput({ value, onChange, placeholder, rows = 3, allowRecording = true }) {
  const [isListening, setIsListening] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);
  const recorderRef = useRef(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);

  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.continuous = false;
    r.interimResults = false;
    r.lang = "en-ZA";
    r.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript || "";
      if (text) {
        const cur = valueRef.current;
        onChangeRef.current(cur ? `${cur} ${text}` : text);
      }
    };
    r.onerror = () => setIsListening(false);
    r.onend = () => setIsListening(false);
    recognitionRef.current = r;
    return () => { try { r.abort(); } catch {} };
  }, []);

  const toggleSpeech = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isListening) {
      try { recognitionRef.current.stop(); } catch {}
      setIsListening(false);
    } else {
      try { recognitionRef.current.start(); setIsListening(true); } catch { setIsListening(false); }
    }
  }, [isListening]);

  const toggleRecord = useCallback(() => {
    if (isRecording) {
      recorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    if (!allowRecording) return;
    recorderRef.current = recordVoiceNote(
      ({ ref }) => onChangeRef.current(valueRef.current ? `${valueRef.current} [voice:${ref}]` : `[voice:${ref}]`),
      () => setIsRecording(false)
    );
    setIsRecording(true);
  }, [isRecording, allowRecording]);

  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full bg-[#0A0A0A] border border-[#2A2A2A] p-3 rounded focus:border-[#F5C518] outline-none font-body pr-20 text-[#F2F0EA]"
      />
      <div className="absolute right-2 bottom-2 flex gap-1">
        {recognitionRef.current && (
          <button type="button" onClick={toggleSpeech}
            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm ${isListening ? "bg-[#EF4444] text-white animate-pulse" : "bg-[#2A2A2A] text-[#F5C518]"}`}>
            {isListening ? "⏹" : "🎤"}
          </button>
        )}
        {allowRecording && (
          <button type="button" onClick={toggleRecord}
            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm ${isRecording ? "bg-[#EF4444] text-white animate-pulse" : "bg-[#2A2A2A] text-[#00A4A6]"}`}>
            {isRecording ? "⏹" : "🔴"}
          </button>
        )}
      </div>
    </div>
  );
}
