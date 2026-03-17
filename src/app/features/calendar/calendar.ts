import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

interface CalendarEvent {
  title: string;
  type: 'regular' | 'special-non' | 'special-work' | 'company';
  description?: string;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar.html',
  styleUrl: './calendar.css'
})
export class Calendar implements OnInit {
  private router = inject(Router);

  today: Date = new Date();
  viewDate: Date = new Date(); 
  daysInMonth: number[] = [];
  paddingDays: number[] = []; 
  weekDays: string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  selectedDay: number | null = null;
  selectedEvent: CalendarEvent | null = null;
  showModal: boolean = false;

  holidays: { [key: string]: CalendarEvent } = {
    '2026-01-01': { title: 'PH/AU: New Year\'s Day', type: 'regular' },
    '2026-01-22': { title: 'AU: Day of Mourning (Bondi Victims)', type: 'special-non' },
    '2026-01-26': { title: 'AU: Australia Day', type: 'regular' },
    '2026-01-29': { title: 'PH: Lunar New Year', type: 'special-non' },
    '2026-02-25': { title: 'PH: EDSA Day', type: 'special-work' },
    '2026-03-02': { title: 'AU: Labour Day (WA)', type: 'regular' },
    '2026-03-09': { title: 'AU: Labour Day (VIC) / 8 Hours Day (TAS)', type: 'regular' },
    '2026-03-21': { title: 'AU: Harmony Day', type: 'special-non' },
    '2026-03-23': { title: 'AU: Labour Day (Christmas Island)', type: 'regular' },
    '2026-04-02': { title: 'PH: Maundy Thursday', type: 'regular' },
    '2026-04-03': { title: 'PH/AU: Good Friday', type: 'regular' },
    '2026-04-04': { title: 'PH/AU: Holy Saturday', type: 'special-non' },
    '2026-04-05': { title: 'AU: Easter Sunday', type: 'regular' },
    '2026-04-06': { title: 'AU: Easter Monday', type: 'regular' },
    '2026-04-09': { title: 'PH: Araw ng Kagitingan', type: 'regular' },
    '2026-04-25': { title: 'AU: ANZAC Day', type: 'regular' },
    '2026-05-01': { title: 'PH: Labor Day', type: 'regular' },
    '2026-05-04': { title: 'AU: May Day (NT) / Labour Day (QLD)', type: 'regular' },
    '2026-06-08': { title: 'AU: King\'s Birthday (Most Regions)', type: 'regular' },
    '2026-06-12': { title: 'PH: Independence Day', type: 'regular' },
    '2026-08-21': { title: 'PH: Ninoy Aquino Day', type: 'special-non' },
    '2026-08-31': { title: 'PH: National Heroes Day', type: 'regular' },
    '2026-09-28': { title: 'AU: King\'s Birthday (WA)', type: 'regular' },
    '2026-10-05': { title: 'AU: King\'s Birthday (QLD) / Labour Day (ACT, NSW, SA)', type: 'regular' },
    '2026-11-01': { title: 'PH: All Saints\' Day', type: 'special-non' },
    '2026-11-02': { title: 'PH: All Souls\' Day', type: 'special-non' },
    '2026-11-11': { title: 'AU: Remembrance Day', type: 'special-non' },
    '2026-11-30': { title: 'PH: Bonifacio Day', type: 'regular' },
    '2026-12-08': { title: 'PH: Feast of the Immaculate Conception', type: 'special-non' },
    '2026-12-24': { title: 'AU: Christmas Eve', type: 'special-work' },
    '2026-12-25': { title: 'PH/AU: Christmas Day', type: 'regular' },
    '2026-12-26': { title: 'AU: Boxing Day', type: 'regular' },
    '2026-12-30': { title: 'PH: Rizal Day', type: 'regular' },
    '2026-12-31': { title: 'AU: New Year\'s Eve', type: 'special-work' }
  };

  ngOnInit(): void {
    this.generateCalendar();
  }

  generateCalendar() {
    const year = this.viewDate.getFullYear();
    const month = this.viewDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    this.paddingDays = Array(firstDayIndex).fill(0);
    this.daysInMonth = Array.from({ length: totalDays }, (_, i) => i + 1);
  }

  getEvent(day: number): CalendarEvent | null {
    const year = this.viewDate.getFullYear();
    const month = String(this.viewDate.getMonth() + 1).padStart(2, '0');
    const date = String(day).padStart(2, '0');
    const key = `${year}-${month}-${date}`;
    return this.holidays[key] || null;
  }

  getRegionClass(title: string): string {
    if (title.includes('PH/AU')) return 'region-both';
    if (title.includes('PH:')) return 'region-ph';
    if (title.includes('AU:')) return 'region-au';
    return 'region-company';
  }

  openDayDetails(day: number) {
    this.selectedDay = day;
    this.selectedEvent = this.getEvent(day);
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.selectedDay = null;
    this.selectedEvent = null;
  }

  requestLeave() {
    if (this.selectedDay) {
      const year = this.viewDate.getFullYear();
      const month = String(this.viewDate.getMonth() + 1).padStart(2, '0');
      const day = String(this.selectedDay).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      this.router.navigate(['/file-leave'], { queryParams: { date: dateStr } });
      this.closeModal();
    }
  }

  changeMonth(delta: number) {
    this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() + delta, 1);
    this.generateCalendar();
  }

  isToday(day: number): boolean {
    return day === this.today.getDate() && 
           this.viewDate.getMonth() === this.today.getMonth() && 
           this.viewDate.getFullYear() === this.today.getFullYear();
  }
}