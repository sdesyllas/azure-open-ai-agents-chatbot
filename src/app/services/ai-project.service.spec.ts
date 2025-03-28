import { TestBed } from '@angular/core/testing';

import { AiProjectService } from './ai-project.service';

describe('AiProjectService', () => {
  let service: AiProjectService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AiProjectService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
