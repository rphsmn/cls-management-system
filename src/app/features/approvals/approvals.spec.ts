import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApprovalsComponent } from './approvals'; // Changed from Approvals to ApprovalsComponent

describe('ApprovalsComponent', () => {
  let component: ApprovalsComponent;
  let fixture: ComponentFixture<ApprovalsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApprovalsComponent], // Changed to match the class name
    }).compileComponents();

    fixture = TestBed.createComponent(ApprovalsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});