import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { Agent } from '../../models/agent.model';
import { AiProjectService } from '../../services/ai-project.service';
import { Observable, Subscription, catchError, finalize, of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-agent-selector',
  templateUrl: './agent-selector.component.html',
  styleUrls: ['./agent-selector.component.scss'],
  standalone: true,
  imports: [CommonModule, MatSelectModule, MatFormFieldModule, MatCardModule, MatButtonModule]
})
export class AgentSelectorComponent implements OnInit, OnDestroy {
  agents$: Observable<Agent[]> = of([]);
  selectedAgent: Agent | null = null;
  private subscription: Subscription = new Subscription();
  isAgentsLoaded: boolean = false;
  isLoadingAgents: boolean = false;
  errorMessage: string | null = null;
  agents: Agent[] = []; // Store actual agents array
  
  // Store the parameter name for agent selection
  private assistantNameParam: string | null = null;
  // Track if a message parameter is also present
  private hasMessageParam: boolean = false;

  constructor(
    private aiProjectService: AiProjectService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Get URL parameters
    this.subscription.add(
      this.route.queryParams.subscribe(params => {
        this.assistantNameParam = params['assistantName'] || null;
        this.hasMessageParam = !!params['message'];
        
        // If we have a parameter, automatically load agents to try finding the matching one
        if (this.assistantNameParam) {
          console.log(`Detected assistantName parameter: ${this.assistantNameParam}`);
          // If both parameters are present, we should prioritize loading agents immediately
          const priorityLoad = !!(this.hasMessageParam && this.assistantNameParam);
          this.loadAgents(priorityLoad);
        }
      })
    );

    // Subscribe to the selected agent
    this.subscription.add(
      this.aiProjectService.selectedAgent$.subscribe(agent => {
        this.selectedAgent = agent;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  onSelectAgent(agent: Agent): void {
    this.aiProjectService.selectAgent(agent);
  }

  loadAgents(priorityLoad: boolean = false): void {
    if (!this.isAgentsLoaded && !this.isLoadingAgents) {
      this.isLoadingAgents = true;
      this.errorMessage = null;
      
      // Subscribe directly to handle the response properly
      this.subscription.add(
        this.aiProjectService.getAgents()
          .pipe(
            catchError(error => {
              this.errorMessage = 'Failed to load agents. Click to try again.';
              console.error('Error loading agents:', error);
              return of([]);
            }),
            finalize(() => {
              this.isLoadingAgents = false;
              // Only set loaded to true if there was no error and we actually got agents
              this.isAgentsLoaded = !this.errorMessage && this.agents.length > 0;
              
              // If we completed with no error but also no agents, show a different message
              if (!this.errorMessage && this.agents.length === 0) {
                this.errorMessage = 'No agents available. Click to try again.';
                this.isAgentsLoaded = false;
              }
            })
          )
          .subscribe(agents => {
            this.agents = agents;
            if (agents.length > 0) {
              console.log(`Loaded ${agents.length} agents successfully`);
              this.agents$ = of(agents);
              this.isAgentsLoaded = true;
              
              // If we have a name parameter, try to find and select the matching agent
              if (this.assistantNameParam) {
                this.selectAgentByName(this.assistantNameParam);
              }
            }
          })
      );
    } else if (priorityLoad && this.isAgentsLoaded && this.assistantNameParam) {
      // If agents are already loaded and we have both parameters, make sure we select the right agent
      this.selectAgentByName(this.assistantNameParam);
    }
  }

  // Helper method to select an agent by name
  private selectAgentByName(name: string): void {
    const matchingAgent = this.agents.find(agent => 
      agent.name.toLowerCase() === name.toLowerCase()
    );
    
    if (matchingAgent) {
      console.log(`Found matching agent for name: ${name}`, matchingAgent);
      this.onSelectAgent(matchingAgent);
    } else {
      console.log(`No matching agent found for name: ${name}`);
    }
  }
}
