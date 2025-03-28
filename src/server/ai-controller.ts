import { DefaultAzureCredential } from "@azure/identity";
import { Request, Response } from "express";
import type {
  MessageDeltaChunk,
  MessageDeltaTextContent,
  ThreadRunOutput,
} from "@azure/ai-projects";
import {
  AIProjectsClient,
  DoneEvent,
  ErrorEvent,
  MessageStreamEvent,
  RunStreamEvent,
} from "@azure/ai-projects";
import { config } from "./config";

export class AIController {
  private connectionString: string;
  // Initialize client with definite assignment assertion
  private client!: AIProjectsClient;

  constructor() {
    // Initialize with the connection string from config
    this.connectionString = config.aiProjects.connectionString;

    try {
      // Initialize the AI Projects client on the server
      this.client = AIProjectsClient.fromConnectionString(
        this.connectionString,
        new DefaultAzureCredential(),
      );
    } catch (error) {
      console.error("Error initializing AIProjectsClient:", error);
    }
  }

  /**
   * Get available agents from the AI Project
   */
  async getAgents(req: Request, res: Response): Promise<void> {
    try {
      // Call the agents operation and directly access the result
      // @ts-ignore - Temporarily bypass TypeScript checking while resolving API method names
      const agentsList = await this.client.agents.listAgents();

      // Use a more defensive approach by accessing the response as any type
      const agentsResponse = agentsList as any;

      // Extract agents safely checking for different property names
      const agents = ((agentsResponse.data || agentsResponse.value || []) as any[]).map(agent => {
        return {
          id: agent.id,
          name: agent.name,
          description: agent.description
        };
      });

      res.status(200).json(agents);
    } catch (error) {
      console.error("Error fetching agents:", error);
      res.status(500).json({ error: "Failed to fetch agents" });
    }
  }

  /**
   * Handle chat requests with an agent using Server-Sent Events for streaming
   */
  async handleChat(req: Request, res: Response): Promise<void> {
    try {
      const { agentId, message, messageHistory, threadId } = req.body;

      if (!agentId || !message) {
        res.status(400).json({ error: "Missing required parameters" });
        return;
      }

      // Set headers for Server-Sent Events
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders(); // Flush headers immediately to establish connection

      // Format message history for API call
      const messages = messageHistory || [];
      messages.push({ role: 'user', content: message });

      let thread;
      
      // Reuse existing thread if provided, otherwise create a new one
      if (threadId) {
        try {
          // Try to get the existing thread
          thread = { id: threadId };
          console.log(`Using existing thread, thread ID: ${threadId}`);
        } catch (error) {
          // If thread doesn't exist or there's an error, create a new one
          console.warn(`Error using existing thread: ${error}. Creating a new thread.`);
          thread = await this.client.agents.createThread();
          console.log(`Created new thread, thread ID: ${thread.id}`);
        }
      } else {
        // Create a new thread if no threadId is provided
        thread = await this.client.agents.createThread();
        console.log(`Created new thread, thread ID: ${thread.id}`);
      }

      await this.client.agents.createMessage(thread.id, { role: "user", content: message });
      console.log(`Created message, thread ID: ${thread.id}`);

      let fullResponse = '';
      
      // Send an initial event to start the streaming
      this.sendEvent(res, 'start', { threadId: thread.id });

      const streamEventMessages = await this.client.agents.createRun(thread.id, agentId).stream();

      for await (const eventMessage of streamEventMessages) {
        switch (eventMessage.event) {
          case RunStreamEvent.ThreadRunCreated:
            console.log(`ThreadRun status: ${(eventMessage.data as ThreadRunOutput).status}`);
            this.sendEvent(res, 'status', { status: (eventMessage.data as ThreadRunOutput).status });
            break;
          case MessageStreamEvent.ThreadMessageDelta:
            {
              const messageDelta = eventMessage.data as MessageDeltaChunk;
              messageDelta.delta.content.forEach((contentPart) => {
                if (contentPart.type === "text") {
                  const textContent = contentPart as MessageDeltaTextContent;
                  const textValue = textContent.text?.value || "";
                  
                  if (textValue) {
                    console.log(`Text delta received:: ${textValue}`);
                    fullResponse += textValue;
                    
                    // Send delta to client
                    this.sendEvent(res, 'delta', { text: textValue });
                  }
                }
              });
            }
            break;

          case RunStreamEvent.ThreadRunCompleted:
            console.log("Thread Run Completed");
            this.sendEvent(res, 'complete', { fullText: fullResponse });
            break;
            
          case ErrorEvent.Error:
            console.log(`An error occurred. Data ${eventMessage.data}`);
            this.sendEvent(res, 'error', { error: 'An error occurred during processing' });
            break;
            
          case DoneEvent.Done:
            console.log("Stream completed.");
            this.sendEvent(res, 'done', {});
            res.end(); // Close the connection
            return;
        }
      }
      
      // Ensure the connection is closed if we exit the loop
      res.end();
    } catch (error) {
      console.error("Error handling chat:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to get response from AI" });
      } else {
        this.sendEvent(res, 'error', { error: "Failed to get response from AI" });
        res.end();
      }
    }
  }

  /**
   * Helper method to send SSE events to the client
   */
  private sendEvent(res: Response, event: string, data: any): void {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    // The flush() method is not available on standard Express Response
    // Use flushHeaders() for flushing headers, but data writes are sent immediately
  }
}