export interface FileAttachment {
  name: string;
  type: string;
  content: File | Blob; // The actual file data
}

export interface ChatMessage {
  id: string;
  content: string;
  timestamp: Date;
  isUserMessage: boolean;
  status: 'sending' | 'sent' | 'error';
  attachedFile?: FileAttachment; // Optional file attachment
  attachedFiles?: FileAttachment[]; // Optional multiple file attachments
}