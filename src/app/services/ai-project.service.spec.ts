import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { AiProjectService } from './ai-project.service';

describe('AiProjectService', () => {
  let service: AiProjectService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AiProjectService]
    });
    service = TestBed.inject(AiProjectService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
