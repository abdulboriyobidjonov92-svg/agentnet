export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  halalFlag?: string;
  timestamp: string;
}
