import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FileLeaveComponent } from './file-leave';

describe('FileLeaveComponent', () => {
  let component: FileLeaveComponent;
  let fixture: ComponentFixture<FileLeaveComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileLeaveComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FileLeaveComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
