import OpenAI from "openai";

export type DBMessage = OpenAI.Chat.ChatCompletionMessageParam & {
  id?: string;
};

type ThreadState = {
  messages: DBMessage[];
  catalogsInjected: boolean;
};

const threads: Record<string, ThreadState> = {};

export const getMessageStore = (id: string) => {
  if (!threads[id]) {
    threads[id] = { messages: [], catalogsInjected: false };
  }
  const state = threads[id];
  return {
    addMessage: (message: DBMessage) => {
      state.messages.push(message);
    },
    prependSystem: (content: string) => {
      state.messages.unshift({ role: "system", content });
      state.catalogsInjected = true;
    },
    needsCatalogs: () => !state.catalogsInjected,
    getOpenAICompatibleMessageList: () =>
      state.messages.map((m) => {
        const message = { ...m };
        delete message.id;
        return message;
      }),
  };
};
