import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AgentSelectorComponent } from './components/agent-selector/agent-selector.component';
import { ChatInterfaceComponent } from './components/chat-interface/chat-interface.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AgentSelectorComponent, ChatInterfaceComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'Azure Agentic Chat!';
  currentYear = new Date().getFullYear();
}
