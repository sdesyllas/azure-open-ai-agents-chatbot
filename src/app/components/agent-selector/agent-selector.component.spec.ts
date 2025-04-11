import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { AgentSelectorComponent } from './agent-selector.component';
import { AiProjectService } from '../../services/ai-project.service';

describe('AgentSelectorComponent', () => {
  let component: AgentSelectorComponent;
  let fixture: ComponentFixture<AgentSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        AgentSelectorComponent,
        NoopAnimationsModule,
        HttpClientTestingModule,
        MatSelectModule,
        MatFormFieldModule,
        MatCardModule,
        MatButtonModule
      ],
      providers: [
        AiProjectService,
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of({})
          }
        }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AgentSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
