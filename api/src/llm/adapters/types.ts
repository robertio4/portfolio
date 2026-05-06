export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface StreamArgs {
  providerModelId: string;
  contents: ChatTurn[];
  systemInstruction: string;
  maxTokens: number;
  temperature: number;
  signal?: AbortSignal;
  stripThinking?: boolean;
}

export interface StreamAdapter {
  stream(args: StreamArgs): AsyncIterable<string>;
}
