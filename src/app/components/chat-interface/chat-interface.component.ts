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
import { AgentSelectorComponent } from '../agent-selector/agent-selector.component';

@Component({
  selector: 'app-chat-interface',
  templateUrl: './chat-interface.component.html',
  styleUrls: ['./chat-interface.component.scss'],
  standalone: true,  imports: [
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
    MarkdownPipe,
    AgentSelectorComponent
  ]
})
export class ChatInterfaceComponent implements OnInit, AfterViewChecked, OnDestroy {
  messages: ChatMessage[] = [];
  newMessage = '';
  selectedAgent$: Observable<Agent | null> = of(null);
  isSending = false;
  selectedFiles: File[] = [];
  maxFiles: number = 5;
  recommendedQuestions: string[] = [];
  isLoadingRecommendations = false;
  
  private subscription: Subscription = new Subscription();
  private messageQueryParam: string | null = null;
  private hasAgentBeenSelected = false;
  private shouldSendMessageAutomatically = false;
  
  @ViewChild('chatContainer') private chatContainer!: ElementRef;
  @ViewChild('fileInput') private fileInput!: ElementRef;
  // Reference to the file upload button for animation
  @ViewChild('fileUploadButton', { static: false }) fileUploadButton!: ElementRef;

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
  // Helper method to check if there's message content or files
  hasMessageContent(): boolean {
    return this.newMessage.trim().length > 0 || this.selectedFiles.length > 0;
  }

  scrollToBottom(): void {
    try {
      this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
    } catch (err) { }
  }  sendMessage(content: string = this.newMessage): void {
    const message = content.trim();
    if (!message && this.selectedFiles.length === 0) return;
    
    // Clear recommended questions when sending a new message
    this.recommendedQuestions = [];
    
    if (this.selectedFiles.length > 0) {
      this.aiProjectService.sendMessageWithFiles(message, this.selectedFiles).subscribe({
        next: () => {
          this.newMessage = '';
          this.removeSelectedFiles();
          this.scrollToBottom();
        },
        error: (error: Error) => {
          console.error('Error sending message with files:', error);
        }
      });
    } else {
      this.aiProjectService.sendMessage(message).subscribe({
        next: () => {
          this.newMessage = '';
          this.scrollToBottom();
        },
        error: (error: Error) => {
          console.error('Error sending message:', error);
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
  }  // Handle file selection
  onFileSelected(event: Event): void {
    const element = event.target as HTMLInputElement;
    if (element.files && element.files.length) {
      // Check if adding these files would exceed the max file limit
      const additionalFiles = Array.from(element.files);
      const totalFiles = this.selectedFiles.length + additionalFiles.length;
      
      if (totalFiles > this.maxFiles) {
        console.log(`Cannot select more than ${this.maxFiles} files.`);
        // Reset the file input since we couldn't accept all files
        if (this.fileInput && this.fileInput.nativeElement) {
          this.fileInput.nativeElement.value = '';
        }
        return;
      }
      
      // Add the files to our array with a slight delay between each to create animation effect
      additionalFiles.forEach((file, index) => {
        setTimeout(() => {
          this.selectedFiles.push(file);
          // Update the UI when the last file is added
          if (index === additionalFiles.length - 1) {
            // Force change detection if needed
            this.scrollToBottom();
          }
        }, index * 50); // 50ms delay between each file for a nice visual effect
      });
      
      console.log(`${additionalFiles.length} file(s) selected. Total files: ${this.selectedFiles.length}`);
    }
  }
  // Remove selected files
  removeSelectedFiles(): void {
    if (this.selectedFiles.length === 0) return;
    
    // Apply a fadeout class first
    const selectedFilesElements = document.querySelectorAll('.selected-file-box');
    selectedFilesElements.forEach(el => {
      (el as HTMLElement).style.opacity = '0';
      (el as HTMLElement).style.transform = 'translateY(10px)';
    });
    
    // Then remove the files after the animation
    setTimeout(() => {
      this.selectedFiles = [];
      if (this.fileInput && this.fileInput.nativeElement) {
        this.fileInput.nativeElement.value = '';
      }
    }, 200);
  }
  
  // Remove a specific file by index
  removeSelectedFile(index: number): void {
    if (index >= 0 && index < this.selectedFiles.length) {
      // Find the element to fade out
      const fileElements = document.querySelectorAll('.selected-file-box');
      if (fileElements[index]) {
        (fileElements[index] as HTMLElement).style.opacity = '0';
        (fileElements[index] as HTMLElement).style.transform = 'translateY(10px)';
      }
      
      // Remove the file after a short delay for the animation
      setTimeout(() => {
        this.selectedFiles.splice(index, 1);
      }, 150);
    }
  }

  // Get appropriate icon for file type
  getFileIcon(fileType: string): string {
    if (fileType.includes('pdf')) {
      return 'picture_as_pdf';
    } else if (fileType.includes('image') || fileType.includes('png') || fileType.includes('jpg') || fileType.includes('jpeg')) {
      return 'image';
    } else if (fileType.includes('word') || fileType.includes('doc')) {
      return 'description';
    } else if (fileType.includes('excel') || fileType.includes('spreadsheet') || fileType.includes('xls')) {
      return 'table_chart';
    } else if (fileType.includes('powerpoint') || fileType.includes('presentation') || fileType.includes('ppt')) {
      return 'slideshow';
    } else if (fileType.includes('text') || fileType.includes('txt')) {
      return 'article';
    } else {
      return 'insert_drive_file';
    }
  }
  
  // Format file type for display
  formatFileType(fileType: string): string {
    if (!fileType) return 'Unknown';
    
    const simplifiedType = fileType.split('/').pop() || fileType;
    return simplifiedType.toUpperCase();
  }

  // Animate the file upload button when clicked
  animateFileUploadButton(): void {
    if (this.fileUploadButton && this.fileUploadButton.nativeElement) {
      const button = this.fileUploadButton.nativeElement;
      
      // Add a pulse animation class
      button.classList.add('pulse-animation');
      
      // Remove the class after animation completes
      setTimeout(() => {
        button.classList.remove('pulse-animation');
      }, 300);
    }
  }
}
