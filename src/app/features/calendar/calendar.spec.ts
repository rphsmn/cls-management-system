import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './calendar.html',
  styleUrls: ['./calendar.css']
})
export class CalendarComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  currentDate = new Date();
  days: any[] = [];
  weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // Year Picker Data
  years: number[] = [];
  selectedDay: any = null;
  showModal = false;

  holidays = [
    // --- AUSTRALIA ---
    { date: '2026-01-01', name: "New Year's Day", region: 'au', type: 'regular' },
    { date: '2026-01-22', name: 'Bondi Victims Mourning', region: 'au', type: 'special-non' },
    { date: '2026-01-26', name: 'Australia Day', region: 'au', type: 'regular' },
    { date: '2026-03-02', name: 'Labour Day (WA)', region: 'au', type: 'regular' },
    { date: '2026-03-09', name: 'Labour Day (VIC/TAS)', region: 'au', type: 'regular' },
    { date: '2026-03-21', name: 'Harmony Day', region: 'au', type: 'special-work' },
    { date: '2026-03-23', name: 'Labour Day (Christmas Is.)', region: 'au', type: 'regular' },
    { date: '2026-04-03', name: 'Good Friday', region: 'both', type: 'regular' },
    { date: '2026-04-04', name: 'Holy Saturday', region: 'au', type: 'special-non' },
    { date: '2026-04-05', name: 'Easter Sunday', region: 'au', type: 'regular' },
    { date: '2026-04-06', name: 'Easter Monday', region: 'au', type: 'regular' },
    { date: '2026-04-25', name: 'ANZAC Day', region: 'au', type: 'regular' },
    { date: '2026-05-04', name: 'Labour Day (QLD/NT)', region: 'au', type: 'regular' },
    { date: '2026-06-08', name: "King's Birthday", region: 'au', type: 'regular' },
    { date: '2026-09-28', name: "King's Birthday (WA)", region: 'au', type: 'regular' },
    { date: '2026-10-05', name: 'Labour Day (ACT/NSW/SA)', region: 'au', type: 'regular' },
    { date: '2026-11-11', name: 'Remembrance Day', region: 'au', type: 'special-work' },
    { date: '2026-12-24', name: 'Christmas Eve', region: 'both', type: 'special-non' },
    { date: '2026-12-25', name: 'Christmas Day', region: 'both', type: 'regular' },
    { date: '2026-12-26', name: 'Boxing Day', region: 'au', type: 'regular' },
    { date: '2026-12-31', name: "New Year's Eve", region: 'both', type: 'special-non' },

    // --- PHILIPPINES ---
    { date: '2026-01-01', name: "New Year's Day", region: 'ph', type: 'regular' },
    { date: '2026-02-17', name: 'Chinese New Year', region: 'ph', type: 'special-non' },
    { date: '2026-02-25', name: 'EDSA Anniversary', region: 'ph', type: 'special-work' },
    { date: '2026-04-02', name: 'Maundy Thursday', region: 'ph', type: 'regular' },
    { date: '2026-04-03', name: 'Good Friday', region: 'both', type: 'regular' },
    { date: '2026-04-04', name: 'Black Saturday', region: 'ph', type: 'special-non' },
    { date: '2026-04-09', name: 'Araw ng Kagitingan', region: 'ph', type: 'regular' },
    { date: '2026-05-01', name: 'Labor Day', region: 'ph', type: 'regular' },
    { date: '2026-06-12', name: 'Independence Day', region: 'ph', type: 'regular' },
    { date: '2026-08-21', name: 'Ninoy Aquino Day', region: 'ph', type: 'special-non' },
    { date: '2026-08-31', name: 'National Heroes Day', region: 'ph', type: 'regular' },
    { date: '2026-11-01', name: "All Saints' Day", region: 'ph', type: 'special-non' },
    { date: '2026-11-02', name: "All Souls' Day", region: 'ph', type: 'special-non' },
    { date: '2026-11-30', name: 'Bonifacio Day', region: 'ph', type: 'regular' },
    { date: '2026-12-08', name: 'Immaculate Conception', region: 'ph', type: 'special-non' },
    { date: '2026-12-25', name: 'Christmas Day', region: 'both', type: 'regular' },
    { date: '2026-12-30', name: 'Rizal Day', region: 'ph', type: 'regular' },
    { date: '2026-12-31', name: 'Last Day of the Year', region: 'ph', type: 'special-non' }
  ];

  ngOnInit() {
    this.generateYearOptions();
    this.generateCalendar();
  }

  generateYearOptions() {
    const currentYear = new Date().getFullYear();
    for (let i = currentYear - 2; i <= currentYear + 5; i++) {
      this.years.push(i);
    }
  }

  generateCalendar() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    this.days = [];

    // Padding for empty start slots
    for (let i = 0; i < firstDay; i++) {
      this.days.push({ empty: true });
    }

    // Days in Month
    for (let i = 1; i <= daysInMonth; i++) {
      const dateObj = new Date(year, month, i);
      const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
      
      // Find all holidays for this specific day
      const holiday = this.holidays.find(h => h.date === dateStr);

      this.days.push({
        day: i,
        date: dateStr,
        holiday: holiday,
        isToday: today.toDateString() === dateObj.toDateString(),
        isPast: dateObj < today 
      });
    }
  }

  // --- NAVIGATION FIXES (IMMUTABLE PATTERN) ---
  
  prevMonth() {
    const newDate = new Date(this.currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    this.currentDate = newDate;
    this.generateCalendar();
  }

  nextMonth() {
    const newDate = new Date(this.currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    this.currentDate = newDate;
    this.generateCalendar();
  }

  goToToday() {
    this.currentDate = new Date();
    this.generateCalendar();
  }

  changeYear(event: any) {
    const newYear = parseInt(event.target.value);
    const newDate = new Date(this.currentDate);
    newDate.setFullYear(newYear);
    this.currentDate = newDate;
    this.generateCalendar();
  }

  selectDay(day: any) {
    if (day.empty || day.isPast) return;
    this.selectedDay = day;
    this.showModal = true;
  }
}