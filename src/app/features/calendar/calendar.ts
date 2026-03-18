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
  years: number[] = [];
  
  selectedDay: any = null;
  showModal = false;
  isNoticeWarning = false;
  suggestedNoticeDays = 3;

  holidays = [
    // --- JANUARY ---
    { date: '2026-01-01', name: "New Year's Day", region: 'both', type: 'regular' },
    { date: '2026-01-22', name: 'National Day of Mourning', region: 'au', type: 'special-non' },
    { date: '2026-01-26', name: 'Australia Day', region: 'au', type: 'regular' },
    
    // --- FEBRUARY ---
    { date: '2026-02-17', name: 'Chinese New Year', region: 'ph', type: 'special-non' },
    { date: '2026-02-25', name: 'EDSA Anniversary', region: 'ph', type: 'special-work' },

    // --- MARCH ---
    { date: '2026-03-02', name: 'Labour Day (WA)', region: 'au', type: 'regular' },
    { date: '2026-03-09', name: 'Labour Day (VIC/TAS)', region: 'au', type: 'regular' },
    { date: '2026-03-21', name: 'Harmony Day', region: 'au', type: 'special-work' },
    { date: '2026-03-23', name: 'Labour Day (Christmas Is.)', region: 'au', type: 'regular' },

    // --- APRIL ---
    { date: '2026-04-02', name: 'Maundy Thursday', region: 'ph', type: 'regular' },
    { date: '2026-04-03', name: 'Good Friday', region: 'both', type: 'regular' },
    { date: '2026-04-04', name: 'Black Saturday', region: 'ph', type: 'special-non' },
    { date: '2026-04-05', name: 'Easter Sunday', region: 'au', type: 'special-non' },
    { date: '2026-04-06', name: 'Easter Monday', region: 'au', type: 'regular' },
    { date: '2026-04-09', name: 'Araw ng Kagitingan', region: 'ph', type: 'regular' },
    { date: '2026-04-25', name: 'ANZAC Day', region: 'au', type: 'regular' },

    // --- MAY ---
    { date: '2026-05-01', name: 'Labor Day', region: 'ph', type: 'regular' },
    { date: '2026-05-04', name: 'May Day / Labour Day', region: 'au', type: 'regular' },

    // --- JUNE ---
    { date: '2026-06-08', name: "King's Birthday", region: 'au', type: 'regular' },
    { date: '2026-06-12', name: 'Independence Day', region: 'ph', type: 'regular' },

    // --- AUGUST ---
    { date: '2026-08-21', name: 'Ninoy Aquino Day', region: 'ph', type: 'special-non' },
    { date: '2026-08-31', name: 'National Heroes Day', region: 'ph', type: 'regular' },

    // --- SEPTEMBER / OCTOBER ---
    { date: '2026-09-28', name: "King's Birthday (WA)", region: 'au', type: 'regular' },
    { date: '2026-10-05', name: "King's Birthday (QLD) / Labour Day", region: 'au', type: 'regular' },

    // --- NOVEMBER ---
    { date: '2026-11-01', name: "All Saints' Day", region: 'ph', type: 'special-non' },
    { date: '2026-11-02', name: "All Souls' Day", region: 'ph', type: 'special-non' },
    { date: '2026-11-11', name: 'Remembrance Day', region: 'au', type: 'special-work' },
    { date: '2026-11-30', name: 'Bonifacio Day', region: 'ph', type: 'regular' },

    // --- DECEMBER ---
    { date: '2026-12-08', name: 'Immaculate Conception', region: 'ph', type: 'special-non' },
    { date: '2026-12-24', name: 'Christmas Eve', region: 'both', type: 'special-non' },
    { date: '2026-12-25', name: 'Christmas Day', region: 'both', type: 'regular' },
    { date: '2026-12-26', name: 'Boxing Day', region: 'au', type: 'regular' },
    { date: '2026-12-30', name: 'Rizal Day', region: 'ph', type: 'regular' },
    { date: '2026-12-31', name: "New Year's Eve / Last Day", region: 'both', type: 'special-non' }
  ];

  ngOnInit() {
    this.generateYearOptions();
    this.generateCalendar();
  }

  generateYearOptions() {
    const currentYr = new Date().getFullYear();
    this.years = [currentYr - 1, currentYr, currentYr + 1];
  }

  generateCalendar() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allRequests = (this.authService as any).requestsSubject?.value || [];
    this.days = [];

    for (let i = 0; i < firstDay; i++) {
      this.days.push({ empty: true });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const dateObj = new Date(year, month, i);
      const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
      const holiday = this.holidays.find(h => h.date === dateStr);
      
      const awayCount = allRequests.filter((r: any) => 
        r.status === 'Approved' && this.isDateInPeriod(dateObj, r.period)
      ).length;

      this.days.push({
        day: i,
        date: dateStr,
        holiday: holiday,
        awayCount: awayCount,
        isToday: today.toDateString() === dateObj.toDateString(),
        isPast: dateObj < today 
      });
    }
  }

  private isDateInPeriod(target: Date, period: string): boolean {
    if (!period) return false;
    const parts = period.split(period.includes(' to ') ? ' to ' : ' - ');
    const start = new Date(parts[0]);
    const end = parts[1] ? new Date(parts[1]) : start;
    start.setHours(0,0,0,0);
    end.setHours(23,59,59,999);
    return target >= start && target <= end;
  }

  selectDay(day: any) {
    if (day.empty || day.isPast) return;
    this.selectedDay = day;
    const selectedDate = new Date(day.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((selectedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    this.isNoticeWarning = diffDays < this.suggestedNoticeDays && diffDays >= 0;
    this.showModal = true;
  }

  prevMonth() { this.currentDate = new Date(this.currentDate.setMonth(this.currentDate.getMonth() - 1)); this.generateCalendar(); }
  nextMonth() { this.currentDate = new Date(this.currentDate.setMonth(this.currentDate.getMonth() + 1)); this.generateCalendar(); }
  goToToday() { this.currentDate = new Date(); this.generateCalendar(); }
  changeYear(event: any) { this.currentDate = new Date(this.currentDate.setFullYear(parseInt(event.target.value))); this.generateCalendar(); }
  goToFiling(date: string) { this.router.navigate(['/file-leave'], { queryParams: { date } }); }

  
}

