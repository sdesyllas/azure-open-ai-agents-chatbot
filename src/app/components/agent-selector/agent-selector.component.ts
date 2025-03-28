import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { Agent } from '../../models/agent.model';
import { AiProjectService } from '../../services/ai-project.service';
import { Observable, Subscription } from 'rxjs';

@Component({
  selector: 'app-agent-selector',
  templateUrl: './agent-selector.component.html',
  styleUrls: ['./agent-selector.component.scss'],
  standalone: true,
  imports: [CommonModule, MatSelectModule, MatFormFieldModule, MatCardModule]
})
export class AgentSelectorComponent implements OnInit, OnDestroy {
  agents$: Observable<Agent[]> = new Observable<Agent[]>();
  selectedAgent: Agent | null = null;
  private subscription: Subscription = new Subscription();

  constructor(private aiProjectService: AiProjectService) {}

  ngOnInit(): void {
    // Load available agents
    this.agents$ = this.aiProjectService.getAgents();
    
    // Subscribe to the selected agent
    this.subscription.add(
      this.aiProjectService.selectedAgent$.subscribe(agent => {
        this.selectedAgent = agent;
      })
    );
  }

  ngOnDestroy(): void {
    // Clean up subscriptions to prevent memory leaks
    this.subscription.unsubscribe();
  }

  onSelectAgent(agent: Agent): void {
    this.aiProjectService.selectAgent(agent);
  }
}
