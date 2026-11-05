export interface Theme {
  id: string;
  name: string;
  description: string;
  css: string;
}

export interface WeChatConfig {
  appId: string;
  appSecret: string;
}

export interface PublishResult {
  success: boolean;
  mediaId?: string;
  url?: string;
  error?: string;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
}
