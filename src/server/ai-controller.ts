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
  ToolUtility,
} from "@azure/ai-projects";
import { Readable } from "stream";
import { ApiConfig } from "../app/config/api-config";

// Update Multer interface to correctly extend Express Request
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

export class AIController {
  private connectionString: string;
  // Initialize client with definite assignment assertion
  private client!: AIProjectsClient;

  constructor() {
    // Initialize with the connection string from config
    this.connectionString = ApiConfig.aiProjects.connectionString;

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
      console.log("Fetching agents...");
      // Call the agents operation and directly access the result
      // @ts-ignore - Temporarily bypass TypeScript checking while resolving API method names
      const agentsList = await this.client.agents.listAgents();
      console.log("Agents list fetched successfully");
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
      
      // Log each agent individually with details
      agents.forEach(agent => {
        console.log(`Agent: id=${agent.id}, name=${agent.name}`);
      });
      
      console.log(`Fetched ${agents.length} agents successfully`);
      
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
      console.log(`Received message: ${message}`);
      console.log(`Agent ID: ${agentId}, Thread ID: ${threadId}`);
      console.log(`Message history: ${messageHistory}`);
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
   * Handle chat requests with file attachments
   * 
   * This function processes chat messages that include file uploads,
   * sends them to the AI agent as a file search tool, and streams the response back to the client
   */
  async handleChatWithFile(req: MulterRequest, res: Response): Promise<void> {
    try {
      const { agentId, message, messageHistory, threadId } = req.body;
      const file = req.file; // This contains the uploaded file from multer
      console.log(`Received message: ${message}`);
      console.log(`Agent ID: ${agentId}, Thread ID: ${threadId}`);
      console.log(`File: ${file ? file.originalname : 'No file uploaded'}`);
      console.log(`Message history: ${messageHistory}`);
      console.log(`File size: ${file ? file.size : 'No file uploaded'}`);

      if (!agentId || !message) {
        res.status(400).json({ error: "Missing required parameters" });
        return;
      }

      // Set headers for Server-Sent Events
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders(); // Flush headers immediately to establish connection

      // Send an initial event to start the streaming
      this.sendEvent(res, 'status', { status: 'Processing file upload...' });
      
      let thread;
      
      if (file) {
        console.log(`Processing file: ${file.originalname}, size: ${file.size} bytes`);
        
        try {
          // Convert buffer to a readable stream
          const fileStream = new Readable();
          fileStream.push(file.buffer);
          fileStream.push(null); // Indicate end of file
          
          // Upload the file to the AI Projects client
          const uploadedFile = await this.client.agents.uploadFile(fileStream, "assistants", {
            fileName: file.originalname,
          });
          
          console.log(`File uploaded with ID: ${uploadedFile.id}, filename: ${uploadedFile.filename}`);
          this.sendEvent(res, 'status', { status: 'File uploaded successfully' });
          
          // Create vector store with the file ID
          const vectorStore = await this.client.agents.createVectorStore({
            fileIds: [uploadedFile.id],
          });
          
          console.log(`Vector store created with ID: ${vectorStore.id}`);
          this.sendEvent(res, 'status', { status: 'Vector store created' });
          
          // Create file search tool with the vector store
          const fileSearchTool = ToolUtility.createFileSearchTool([vectorStore.id]);
          
          // Create a new thread with the file search tool resources
          if (threadId) {
            // If threadId is provided, we need to create a new thread anyway
            // because we can't add tools to existing threads
            console.log(`Creating new thread with file search tool resources`);
          }
          
          // Create thread with tool resources
          thread = await this.client.agents.createThread({ 
            toolResources: fileSearchTool.resources 
          });
          
          console.log(`Created new thread with file search tool, thread ID: ${thread.id}, ${fileSearchTool.definition.type}`);
          this.sendEvent(res, 'status', { status: 'Thread created with file search capability' });

        } catch (error) {
          console.error("Error processing file upload:", error);
          this.sendEvent(res, 'error', { error: 'Failed to process file upload' });
          
          // Fallback to creating a regular thread if file processing fails
          thread = await this.client.agents.createThread();
          console.log(`Created fallback thread, thread ID: ${thread.id}`);
        }
      } else {
        // Reuse existing thread if provided and no file was uploaded, otherwise create a new one
        if (threadId) {
          try {
            thread = { id: threadId };
            console.log(`Using existing thread, thread ID: ${threadId}`);
          } catch (error) {
            console.warn(`Error using existing thread: ${error}. Creating a new thread.`);
            thread = await this.client.agents.createThread();
            console.log(`Created new thread, thread ID: ${thread.id}`);
          }
        } else {
          thread = await this.client.agents.createThread();
          console.log(`Created new thread, thread ID: ${thread.id}`);
        }
      }

      // Create user message
      await this.client.agents.createMessage(thread.id, { 
        role: "user", 
        content: message
      });
      
      console.log(`Created message, thread ID: ${thread.id}`);
      this.sendEvent(res, 'status', { status: 'Processing your request...' });

      let fullResponse = '';
      
      // Send thread ID to the client
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
      
      console.log(`Deleted vector store, thread ID: ${thread.id}`);
      this.sendEvent(res, 'status', { status: 'Completed' });
      res.end();
      await this.client.agents.deleteVectorStore(thread.id);
    } catch (error) {
      console.error("Error handling chat with file:", error);
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