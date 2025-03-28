import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AiProjectService } from '../../services/ai-project.service';
import { ChatMessage } from '../../models/chat-message.model';
import { Observable, of } from 'rxjs';
import { Agent } from '../../models/agent.model';
import { MarkdownPipe } from '../../pipes/markdown.pipe';

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
    MarkdownPipe
  ]
})
export class ChatInterfaceComponent implements OnInit, AfterViewChecked {
  messages: ChatMessage[] = [];
  newMessage = '';
  selectedAgent$: Observable<Agent | null> = of(null);
  isSending = false;
  
  @ViewChild('chatContainer') private chatContainer!: ElementRef;

  constructor(private aiProjectService: AiProjectService) {}

  ngOnInit(): void {
    // Subscribe to messages
    this.aiProjectService.messages$.subscribe(messages => {
      this.messages = messages;
      this.isSending = messages.some(m => m.status === 'sending');
    });
    
    // Subscribe to selected agent
    this.selectedAgent$ = this.aiProjectService.selectedAgent$;
  }
  
  ngAfterViewChecked() {
    // Scroll to bottom after view updates
    this.scrollToBottom();
  }

  scrollToBottom(): void {
    try {
      this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
    } catch (err) { }
  }

  sendMessage(): void {
    if (!this.newMessage.trim()) return;
    
    this.aiProjectService.sendMessage(this.newMessage).subscribe({
      next: () => {
        this.newMessage = '';
        this.scrollToBottom();
      },
      error: (err) => {
        console.error('Error sending message:', err);
      }
    });
  }

  // Handler for Enter key press to send message
  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
}
