export interface ChatMessage {
  id: string;
  content: string;
  timestamp: Date;
  isUserMessage: boolean;
  status: 'sending' | 'sent' | 'error';
}