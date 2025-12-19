
export interface Message {
  role: 'user' | 'model';
  text: string;
}

export interface StoryState {
  analysis: string;
  story: string;
  image: string | null;
  loading: boolean;
  error: string | null;
}

export enum AppStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  READY = 'READY',
  ERROR = 'ERROR'
}
