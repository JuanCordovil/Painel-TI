import { TestBed } from '@angular/core/testing';
import { Glpi } from './glpi';

describe('Glpi', () => {
  let service: Glpi;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Glpi);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
