import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { Agent } from '../models/agent.model';
import { ChatMessage } from '../models/chat-message.model';

@Injectable({
  providedIn: 'root'
})
export class AiProjectService {
  private apiUrl = '/api'; // Base URL for your server API endpoints
  
  // Store the selected agent
  private selectedAgentSubject = new BehaviorSubject<Agent | null>(null);
  selectedAgent$ = this.selectedAgentSubject.asObservable();
  
  // Store chat messages
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  messages$ = this.messagesSubject.asObservable();

  // Store thread IDs for each agent
  private threadIds: Map<string, string> = new Map();
  private currentThreadId: string | null = null;

  constructor(private http: HttpClient) { }

  // Get available agents from the server API
  getAgents(): Observable<Agent[]> {
    return this.http.get<Agent[]>(`${this.apiUrl}/agents`).pipe(
      tap(agents => {
        console.log('Fetched agents from server');
        agents.forEach(agent => {
          console.log(`Agent ID: ${agent.id}, Name: ${agent.name}`);
        });
      }),
      catchError(error => {
        console.error('Error fetching agents:', error);
        return throwError(() => new Error('Failed to fetch agents'));
      })
    );
  }

  // Select an agent to chat with
  selectAgent(agent: Agent): void {
    const previousAgent = this.selectedAgentSubject.value;
    
    // If selecting a different agent, clear the current thread ID
    if (previousAgent?.id !== agent.id) {
      this.currentThreadId = null;
      // Clear messages when switching agents
      this.messagesSubject.next([]);
    } else {
      // If selecting the same agent, try to get the stored thread ID
      this.currentThreadId = this.threadIds.get(agent.id) || null;
    }
    
    this.selectedAgentSubject.next(agent);
  }

  // Send a message to the selected agent via server API with streaming support
  sendMessage(content: string): Observable<ChatMessage> {
    const selectedAgent = this.selectedAgentSubject.value;
    if (!selectedAgent) {
      return throwError(() => new Error('No agent selected'));
    }

    // Add user message to the messages array
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content,
      timestamp: new Date(),
      isUserMessage: true,
      status: 'sent'
    };
    
    const currentMessages = this.messagesSubject.value;
    this.messagesSubject.next([...currentMessages, userMessage]);
    
    // Create a placeholder for the bot response
    const botResponsePlaceholder: ChatMessage = {
      id: (Date.now() + 1).toString(),
      content: '',
      timestamp: new Date(),
      isUserMessage: false,
      status: 'sending'
    };
    
    // Add the placeholder to messages
    this.messagesSubject.next([...this.messagesSubject.value, botResponsePlaceholder]);
    
    // Create an observable that will handle the SSE connection
    return new Observable<ChatMessage>(observer => {
      // Prepare the request data
      const requestBody = {
        agentId: selectedAgent.id,
        message: content,
        messageHistory: this.getMessageHistory(),
        threadId: this.currentThreadId // Include threadId in the request if we have one
      };
      
      // Instead of using EventSource directly, we'll use fetch API to make a POST request
      // that establishes an SSE connection
      fetch(`${this.apiUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify(requestBody)
      }).then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        
        // Get the reader from the response body stream
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let responseText = '';
        
        // Process the stream chunks
        const processStream = ({ done, value }: ReadableStreamReadResult<Uint8Array>): Promise<void> => {
          if (done) {
            console.log('Stream complete');
            observer.complete();
            return Promise.resolve();
          }
          
          // Decode the chunk and append to buffer
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          
          // Process any complete events in the buffer
          const events = this.parseSSEEvents(buffer);
          buffer = events.remainingBuffer;
          
          // Handle each event
          events.parsedEvents.forEach(event => {
            if (event.event && event.data) {
              switch (event.event) {
                case 'start':
                  try {
                    const data = JSON.parse(event.data);
                    if (data.threadId) {
                      // Store the thread ID for this agent for future messages
                      this.currentThreadId = data.threadId;
                      this.threadIds.set(selectedAgent.id, data.threadId);
                      console.log(`Received thread ID: ${data.threadId} for agent: ${selectedAgent.id}`);
                    }
                  } catch (e) {
                    console.error('Error parsing start event data:', e);
                  }
                  break;
                  
                case 'delta':
                  try {
                    const data = JSON.parse(event.data);
                    if (data.text) {
                      responseText += data.text;
                      // Update bot message with the incremental text
                      const updatedMessage: ChatMessage = {
                        ...botResponsePlaceholder,
                        content: responseText,
                        status: 'sending'
                      };
                      this.updateBotMessage(botResponsePlaceholder.id, updatedMessage);
                    }
                  } catch (e) {
                    console.error('Error parsing delta event data:', e);
                  }
                  break;
                  
                case 'complete':
                  try {
                    const data = JSON.parse(event.data);
                    if (data.fullText) {
                      responseText = data.fullText; // Use the complete text from the server
                    }
                    
                    // Finalize the bot message with complete content
                    const completedMessage: ChatMessage = {
                      ...botResponsePlaceholder,
                      content: responseText,
                      status: 'sent'
                    };
                    
                    this.updateBotMessage(botResponsePlaceholder.id, completedMessage);
                    observer.next(completedMessage);
                  } catch (e) {
                    console.error('Error parsing complete event data:', e);
                  }
                  break;
                  
                case 'error':
                  try {
                    const data = JSON.parse(event.data);
                    const errorMessage: ChatMessage = {
                      ...botResponsePlaceholder,
                      content: data.error || 'An error occurred',
                      status: 'error'
                    };
                    
                    this.updateBotMessage(botResponsePlaceholder.id, errorMessage);
                    observer.error(new Error(data.error || 'Streaming error'));
                  } catch (e) {
                    console.error('Error parsing error event data:', e);
                    observer.error(new Error('Streaming error'));
                  }
                  break;
                  
                case 'done':
                  console.log('Stream done');
                  observer.complete();
                  break;
                  
                default:
                  console.log('Unknown event type:', event.event);
              }
            }
          });
          
          // Continue reading the stream
          return reader.read().then(processStream);
        };
        
        // Start reading the stream
        reader.read().then(processStream).catch(error => {
          console.error('Error reading stream:', error);
          const errorMessage: ChatMessage = {
            ...botResponsePlaceholder,
            content: responseText || 'Connection error',
            status: 'error'
          };
          
          this.updateBotMessage(botResponsePlaceholder.id, errorMessage);
          observer.error(error);
        });
      }).catch(error => {
        console.error('Fetch error:', error);
        const errorMessage: ChatMessage = {
          ...botResponsePlaceholder,
          content: 'Failed to connect to the server',
          status: 'error'
        };
        
        this.updateBotMessage(botResponsePlaceholder.id, errorMessage);
        observer.error(error);
      });
      
      // Return a cleanup function
      return () => {
        // Nothing specific to clean up with fetch API approach
      };
    });
  }
  
  // Parse SSE events from a text buffer
  private parseSSEEvents(buffer: string): { parsedEvents: Array<{ event?: string, data?: string }>, remainingBuffer: string } {
    const events: Array<{ event?: string, data?: string }> = [];
    const lines = buffer.split('\n');
    let event: { event?: string, data?: string } | null = null;
    let remainingBuffer = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.startsWith('event: ')) {
        if (event) {
          events.push(event);
        }
        event = { event: line.substring(7) };
      } else if (line.startsWith('data: ') && event) {
        event.data = line.substring(6);
      } else if (line === '' && event) {
        // Empty line marks the end of an event
        events.push(event);
        event = null;
      } else if (i === lines.length - 1) {
        // Last line might be incomplete
        remainingBuffer = line;
      }
    }
    
    // Add the last event if it exists
    if (event) {
      events.push(event);
    }
    
    return { parsedEvents: events, remainingBuffer };
  }
  
  // Helper method to update a specific bot message in the messages array
  private updateBotMessage(messageId: string, updatedMessage: ChatMessage): void {
    const updatedMessages = this.messagesSubject.value.map(msg => 
      msg.id === messageId ? updatedMessage : msg
    );
    this.messagesSubject.next(updatedMessages);
  }

  // Helper method to format message history for the server
  private getMessageHistory(): { role: string, content: string }[] {
    return this.messagesSubject.value.map(msg => ({
      role: msg.isUserMessage ? 'user' : 'assistant',
      content: msg.content
    }));
  }
}
