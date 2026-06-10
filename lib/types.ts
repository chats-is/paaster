export interface Attachment {
  data: string;
  name: string;
  size: number;
}

export interface Content {
  id: string;
  text?: string;
  title?: string;
  format: string;
  attachments?: Attachment[];
  expires: string;
  burnAfterRead: boolean;
  hasPassword: boolean;
  createdAt: string;
  expiresAt?: string;
}
