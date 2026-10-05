export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  toolCall?: {
    name: string;
    args: any;
  };
  toolResult?: any;
}

export async function sendChatMessage(messages: ChatMessage[], context: any): Promise<any> {
  const response = await fetch('/api/platform/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, context }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Chat request failed');
  }

  const data = await response.json();
  return data.result;
}
