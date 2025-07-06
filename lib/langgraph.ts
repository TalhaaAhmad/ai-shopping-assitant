import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  trimMessages,
} from "@langchain/core/messages";
import { ChatAnthropic } from "@langchain/anthropic";
import {
  END,
  MessagesAnnotation,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";

import SYSTEM_MESSAGE from "@/constants/systemMessage";
import productSearchTool from "@/tools/productSearchTool";
import orderTakingTool from "@/tools/orderTakingTool";
import {
  orderStatusTool,
  cancelOrderTool,
  updateOrderTool,
  updateOrderQuantitiesTool,
  updateShippingAddressTool,
} from "@/tools/orderManagementTools";

// 🧠 Trim messages (can adjust token count later)
const trimmer = trimMessages({
  maxTokens: 20,
  strategy: "last",
  tokenCounter: (msgs) => msgs.length,
  includeSystem: true,
  allowPartial: false,
  startOn: "human",
});

// ✅ Use only your local tools
const tools = [
  updateOrderQuantitiesTool,
  updateShippingAddressTool,
  productSearchTool,
  orderTakingTool,
  orderStatusTool,
  cancelOrderTool,
  updateOrderTool,
];
const toolNode = new ToolNode(tools);

// ✅ Create Anthropic model
const initialiseModel = () => {
  return new ChatAnthropic({
    modelName: "claude-3-5-sonnet-20241022",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    temperature: 0.7,
    maxTokens: 4096,
    streaming: true,
    clientOptions: {
      defaultHeaders: {
        "anthropic-beta": "prompt-caching-2024-07-31",
      },
    },
  }).bindTools(tools);
};

// ✅ Routing logic
function shouldContinue(state: typeof MessagesAnnotation.State) {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1] as AIMessage;

  if (lastMessage.tool_calls?.length) return "tools";
  if (lastMessage.content && lastMessage._getType() === "tool") return "agent";

  return END;
}

// ✅ Add ephemeral caching to recent messages
function addCachingHeaders(messages: BaseMessage[]): BaseMessage[] {
  const cached = [...messages];

  const addCache = (msg: BaseMessage) => {
    msg.content = [
      {
        type: "text",
        text: msg.content as string,
        cache_control: { type: "ephemeral" },
      },
    ];
  };

  if (cached.length) addCache(cached.at(-1)!);
  let humanCount = 0;
  for (let i = cached.length - 1; i >= 0; i--) {
    if (cached[i] instanceof HumanMessage) {
      humanCount++;
      if (humanCount === 2) {
        addCache(cached[i]);
        break;
      }
    }
  }

  return cached;
}

// ✅ Main function to handle chat workflow
export async function submitQuestion(messages: BaseMessage[], chatId: string) {
  const cachedMessages = addCachingHeaders(messages);
  const model = initialiseModel();

  const workflow = new StateGraph(MessagesAnnotation)
    .addNode("agent", async (state) => {
      const promptTemplate = ChatPromptTemplate.fromMessages([
        new SystemMessage(SYSTEM_MESSAGE, {
          cache_control: { type: "ephemeral" },
        }),
        new MessagesPlaceholder("messages"),
      ]);

      const trimmed = await trimmer.invoke(state.messages);
      const prompt = await promptTemplate.invoke({ messages: trimmed });
      const response = await model.invoke(prompt);

      return { messages: [response] };
    })
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent");

  const checkpointer = new MemorySaver();
  const app = workflow.compile({ checkpointer });

  const stream = await app.streamEvents(
    { messages: cachedMessages },
    {
      version: "v2",
      configurable: { thread_id: chatId },
      streamMode: "messages",
      runId: chatId,
    }
  );

  return stream;
}
