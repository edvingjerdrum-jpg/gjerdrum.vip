/** One speech channel prevents pain cries from interrupting the commentator. */
export function speakNorwegian(text: string, commentator = false, volume = 1) {
  if (typeof speechSynthesis === "undefined" || speechSynthesis.speaking || speechSynthesis.pending) return false;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "nb-NO";
  const voice = speechSynthesis.getVoices().find((v) => /^(nb|no|nn)/i.test(v.lang));
  if (voice) utterance.voice = voice;
  utterance.pitch = commentator ? 0.85 : 0.8 + Math.random() * 0.9;
  utterance.rate = commentator ? 1.05 : 1.2;
  utterance.volume = volume;
  speechSynthesis.speak(utterance);
  return true;
}

export function stopGameVoice() {
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}