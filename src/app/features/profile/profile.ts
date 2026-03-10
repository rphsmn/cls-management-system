import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService, User } from '../../core/services/auth';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class ProfileComponent implements OnInit {
  // FIXED: Changed name to match the template's *ngIf="currentUser"
  currentUser: User | null = null;
  
  govInfo = {
    tin: '000-000-000',
    sss: '00-0000000-0',
    philHealth: '00-000000000-0'
  };

  constructor(private authService: AuthService) {}

  ngOnInit() {
    // Subscribe so the template gets the raw user data without needing the async pipe
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }
}