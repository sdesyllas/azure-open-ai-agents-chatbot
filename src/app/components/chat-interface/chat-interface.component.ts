import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { AiProjectService } from '../../services/ai-project.service';
import { RecommendedQuestionsService } from '../../services/recommended-questions.service';
import { ChatMessage, FileAttachment } from '../../models/chat-message.model';
import { Observable, Subscription, of } from 'rxjs';
import { Agent } from '../../models/agent.model';
import { MarkdownPipe } from '../../pipes/markdown.pipe';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-chat-interface',
  templateUrl: './chat-interface.component.html',
  styleUrls: ['./chat-interface.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatChipsModule,
    MarkdownPipe
  ]
})
export class ChatInterfaceComponent implements OnInit, AfterViewChecked, OnDestroy {
  messages: ChatMessage[] = [];
  newMessage = '';
  selectedAgent$: Observable<Agent | null> = of(null);
  isSending = false;
  selectedFile: File | null = null;
  recommendedQuestions: string[] = [];
  isLoadingRecommendations = false;
  
  private subscription: Subscription = new Subscription();
  private messageQueryParam: string | null = null;
  private hasAgentBeenSelected = false;
  private shouldSendMessageAutomatically = false;
  
  @ViewChild('chatContainer') private chatContainer!: ElementRef;
  @ViewChild('fileInput') private fileInput!: ElementRef;

  constructor(
    private aiProjectService: AiProjectService,
    private recommendedQuestionsService: RecommendedQuestionsService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Check for query parameters
    this.subscription.add(
      this.route.queryParams.subscribe(params => {
        this.messageQueryParam = params['message'] || null;
        
        if (this.messageQueryParam) {
          console.log(`Received message query parameter: ${this.messageQueryParam}`);
          this.newMessage = this.messageQueryParam;
          this.shouldSendMessageAutomatically = true;
        }
      })
    );
    
    // Subscribe to messages
    this.subscription.add(
      this.aiProjectService.messages$.subscribe(messages => {
        this.messages = messages;
        this.isSending = messages.some(m => m.status === 'sending');
        
        // Generate recommended questions when a new bot message is received and not loading
        if (messages.length > 0 && !this.isSending) {
          const lastMessage = messages[messages.length - 1];
          if (!lastMessage.isUserMessage && lastMessage.status === 'sent') {
            this.generateRecommendedQuestions();
          }
        }
      })
    );
    
    // Subscribe to selected agent
    this.subscription.add(
      this.aiProjectService.selectedAgent$.subscribe(agent => {
        // Check if agent is selected and we have a message to send automatically
        if (agent && this.shouldSendMessageAutomatically && !this.hasAgentBeenSelected) {
          this.hasAgentBeenSelected = true;
          
          // Short timeout to ensure UI has time to update
          setTimeout(() => {
            if (this.messageQueryParam && this.newMessage) {
              console.log('Automatically sending message from URL query parameter');
              console.log('Sending message:', this.newMessage);
              this.sendMessage();
              this.shouldSendMessageAutomatically = false;
            }
          }, 500);
        }
      })
    );
    
    this.selectedAgent$ = this.aiProjectService.selectedAgent$;
  }
  
  ngAfterViewChecked() {
    // Scroll to bottom after view updates
    this.scrollToBottom();
  }
  
  ngOnDestroy(): void {
    // Clean up subscriptions
    this.subscription.unsubscribe();
  }

  // Helper method to check if there's message content
  hasMessageContent(): boolean {
    return this.newMessage.trim().length > 0;
  }

  scrollToBottom(): void {
    try {
      this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
    } catch (err) { }
  }

  sendMessage(content: string = this.newMessage): void {
    const message = content.trim();
    if (!message && !this.selectedFile) return;
    
    // Clear recommended questions when sending a new message
    this.recommendedQuestions = [];
    
    if (this.selectedFile) {
      this.aiProjectService.sendMessageWithFile(message, this.selectedFile).subscribe({
        next: () => {
          this.newMessage = '';
          this.removeSelectedFile();
          this.scrollToBottom();
        },
        error: (err) => {
          console.error('Error sending message with file:', err);
        }
      });
    } else {
      this.aiProjectService.sendMessage(message).subscribe({
        next: () => {
          this.newMessage = '';
          this.scrollToBottom();
        },
        error: (err) => {
          console.error('Error sending message:', err);
        }
      });
    }
  }

  // Generate recommended questions based on the conversation history
  generateRecommendedQuestions(): void {
    // Only generate recommendations if we have messages and are not currently loading
    if (this.messages.length === 0 || this.isLoadingRecommendations) {
      return;
    }
    
    this.isLoadingRecommendations = true;
    
    // Convert our messages to the format expected by the OpenAI API
    const messageHistory = this.aiProjectService.getMessageHistory();
    
    this.recommendedQuestionsService.getRecommendedQuestions(messageHistory)
      .subscribe({
        next: (questions) => {
          this.recommendedQuestions = questions;
          this.isLoadingRecommendations = false;
          this.scrollToBottom();
        },
        error: (err) => {
          console.error('Error generating recommended questions:', err);
          this.isLoadingRecommendations = false;
        }
      });
  }
  
  // Use a recommended question
  useRecommendedQuestion(question: string): void {
    this.newMessage = question;
    this.sendMessage(question);
  }

  // Handler for Enter key press to send message
  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  // Handle file selection
  onFileSelected(event: Event): void {
    const element = event.target as HTMLInputElement;
    if (element.files && element.files.length) {
      this.selectedFile = element.files[0];
      console.log('File selected:', this.selectedFile.name);
    }
  }

  // Remove selected file
  removeSelectedFile(): void {
    this.selectedFile = null;
    if (this.fileInput && this.fileInput.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }
}
