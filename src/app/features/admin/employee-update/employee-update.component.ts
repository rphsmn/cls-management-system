import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmployeeUpdateService } from '../../../core/services/employee-update.service';

@Component({
  selector: 'app-employee-update',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="update-container">
      <h2>Employee Data Update</h2>
      <p>Click the button below to update employee information in Firestore.</p>
      
      <button 
        (click)="runUpdate()" 
        [disabled]="isUpdating"
        class="update-btn">
        {{ isUpdating ? 'Updating...' : 'Update Employee Data' }}
      </button>

      <div *ngIf="updateResult" class="result-box">
        <h3>Update Results</h3>
        <p><strong>Successfully updated:</strong> {{ updateResult.success }}</p>
        <p><strong>Failed:</strong> {{ updateResult.failed }}</p>
        
        <div *ngIf="updateResult.errors.length > 0" class="errors">
          <h4>Errors:</h4>
          <ul>
            <li *ngFor="let error of updateResult.errors">{{ error }}</li>
          </ul>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .update-container {
      padding: 20px;
      max-width: 600px;
      margin: 0 auto;
    }
    h2 {
      color: #333;
      margin-bottom: 10px;
    }
    p {
      color: #666;
      margin-bottom: 20px;
    }
    .update-btn {
      background-color: #007bff;
      color: white;
      padding: 10px 20px;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 16px;
    }
    .update-btn:disabled {
      background-color: #ccc;
      cursor: not-allowed;
    }
    .update-btn:hover:not(:disabled) {
      background-color: #0056b3;
    }
    .result-box {
      margin-top: 20px;
      padding: 15px;
      border: 1px solid #ddd;
      border-radius: 5px;
      background-color: #f9f9f9;
    }
    .result-box h3 {
      margin-top: 0;
      color: #333;
    }
    .errors {
      margin-top: 10px;
      padding: 10px;
      background-color: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 5px;
    }
    .errors h4 {
      margin-top: 0;
      color: #856404;
    }
    .errors ul {
      margin: 0;
      padding-left: 20px;
    }
    .errors li {
      color: #856404;
      margin-bottom: 5px;
    }
  `]
})
export class EmployeeUpdateComponent {
  private employeeUpdateService = inject(EmployeeUpdateService);
  
  isUpdating = false;
  updateResult: { success: number; failed: number; errors: string[] } | null = null;

  async runUpdate() {
    this.isUpdating = true;
    this.updateResult = null;

    try {
      this.updateResult = await this.employeeUpdateService.applyEmployeeUpdates();
    } catch (error) {
      this.updateResult = {
        success: 0,
        failed: 16,
        errors: [`Update failed: ${error}`]
      };
    } finally {
      this.isUpdating = false;
    }
  }
}
