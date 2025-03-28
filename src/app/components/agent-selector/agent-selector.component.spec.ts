import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AgentSelectorComponent } from './agent-selector.component';

describe('AgentSelectorComponent', () => {
  let component: AgentSelectorComponent;
  let fixture: ComponentFixture<AgentSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgentSelectorComponent]
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
