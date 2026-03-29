import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms'; 
import { AuthService, User } from '../../core/services/auth';
import { LeaveService } from '../../core/services/leave.services';
// Added getDocs and doc to imports
import { Firestore, collection, getDocs, doc, deleteDoc, addDoc } from '@angular/fire/firestore'; 
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, RouterModule, HttpClientModule, FormsModule],
  templateUrl: './calendar.html',
  styleUrls: ['./calendar.css']
})
export class CalendarComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private leaveService = inject(LeaveService);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private http = inject(HttpClient);
  private cd = inject(ChangeDetectorRef);
  
  private subscriptions = new Subscription();
  currentDate = new Date();
  days: any[] = [];
  weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  years: number[] = [];
  selectedDay: any = null;
  showModal = false;
  isNoticeWarning = false;
  suggestedNoticeDays = 3;
  isLoading = false; 
  isHR = false; 
  newEventName = ''; // Bound to your [(ngModel)] in the HTML
  holidays: any[] = [];
  companyEvents: any[] = [];
  birthdays: any[] = []; // Store employee birthdays

  ngOnInit() {
    this.generateYearOptions();
    
    this.subscriptions.add(
      this.authService.currentUser$.subscribe((user: User | null) => {
        if (user) {
          const r = user.role.toUpperCase();
          this.isHR = r === 'HR' || 
                       r.includes('HUMAN RESOURCE') || 
                       r.includes('ADMIN MANAGER') || 
                       r.includes('MANAGER') || 
                       r.includes('MGR');
          this.fetchHolidays(this.currentDate.getFullYear());
        }
      })
    );

    // Use getDocs instead of collectionData to avoid SDK mismatch
    this.loadCompanyEvents();

    this.subscriptions.add(
      this.leaveService.requests$.subscribe(() => {
        this.generateCalendar();
      })
    );
  }

  private async loadCompanyEvents() {
    try {
      const eventsRef = collection(this.firestore, 'company_events');
      const snapshot = await getDocs(eventsRef);
      this.companyEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      this.loadEmployeeBirthdays();
    } catch (error) {
      console.error('Error loading company events:', error);
    }
  }

  private async loadEmployeeBirthdays() {
    try {
      const usersRef = collection(this.firestore, 'users');
      const snapshot = await getDocs(usersRef);
      const allUsers = snapshot.docs.map(doc => doc.data() as any);
      this.birthdays = allUsers
        .filter((user: any) => user.birthday) // Only include users with birthday
        .map((user: any) => {
          const birthdayDate = new Date(user.birthday);
          return {
            name: user.name || user.Name || 'Employee',
            birthday: user.birthday,
            // Extract month and day for matching
            month: birthdayDate.getMonth(),
            day: birthdayDate.getDate()
          };
        });
      this.generateCalendar();
    } catch (error) {
      console.error('Error loading birthdays:', error);
      this.generateCalendar();
    }
  }

  ngOnDestroy() { 
    this.subscriptions.unsubscribe(); 
  }

  // FIX FOR TS2551: Adding the event to Firestore
  async addCompanyEvent() {
    if (!this.newEventName.trim() || !this.selectedDay) return;

    try {
      const eventsRef = collection(this.firestore, 'company_events');
      await addDoc(eventsRef, {
        title: this.newEventName,
        date: this.selectedDay.date, // Format: YYYY-MM-DD
        type: 'company-event',
        createdBy: this.authService.currentUser?.name || 'Admin'
      });

      this.newEventName = ''; // Clear input
      this.showModal = false; // Close modal
      
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Event added',
        showConfirmButton: false,
        timer: 1500
      });
    } catch (error) {
      Swal.fire('Error', 'Could not save event', 'error');
    }
  }

  async removeCompanyEvent() {
    if (!this.selectedDay?.companyEvent?.id) return;

    const result = await Swal.fire({
      title: 'Delete Event?',
      text: `Are you sure you want to remove "${this.selectedDay.companyEvent.title}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Yes, delete it'
    });

    if (result.isConfirmed) {
      try {
        const eventId = this.selectedDay.companyEvent.id;
        await deleteDoc(doc(this.firestore, `company_events/${eventId}`));
        this.showModal = false;
        Swal.fire('Deleted', 'Event removed successfully', 'success');
      } catch (error) {
        Swal.fire('Error', 'Failed to delete event', 'error');
      }
    }
  }

  // ... rest of your existing methods (fetchHolidays, generateCalendar, etc.)
  fetchHolidays(year: number) {
    this.isLoading = true;
    forkJoin([
      this.http.get<any[]>(`https://date.nager.at/api/v3/PublicHolidays/${year}/PH`).pipe(catchError(() => of([]))),
      this.http.get<any[]>(`https://date.nager.at/api/v3/PublicHolidays/${year}/AU`).pipe(catchError(() => of([])))
    ]).subscribe(([phData, auData]) => {
      const processedPH = phData.map(h => ({ date: h.date, name: h.name, region: 'ph', type: this.mapHolidayType(h.name) }));
      const processedAU = auData.map(h => ({ date: h.date, name: h.name, region: 'au', type: this.mapHolidayType(h.name) }));
      
      // Deduplicate holidays - if same date appears in both PH and AU (like Christmas),
      // merge them into a single entry with both regions
      const holidayMap = new Map<string, any>();
      
      processedPH.forEach(h => {
        holidayMap.set(h.date, { ...h, region: 'ph/au' });
      });
      
      processedAU.forEach(h => {
        if (holidayMap.has(h.date)) {
          // Date already exists (e.g., Christmas) - mark as shared
          const existing = holidayMap.get(h.date);
          existing.region = 'ph/au';
          existing.name = h.name; // Keep the name (same for both countries)
        } else {
          holidayMap.set(h.date, h);
        }
      });
      
      this.holidays = Array.from(holidayMap.values());
      this.generateCalendar();
      this.isLoading = false;
      this.cd.detectChanges();
    });
  }

  private mapHolidayType(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('edsa')) return 'special-work';
    if (lower.includes('ninoy') || lower.includes('chinese')) return 'special-non';
    return 'regular';
  }

  generateCalendar() {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0,0,0,0);

    this.leaveService.requests$.subscribe(allRequests => {
      this.days = [];
      for (let i = 0; i < firstDay; i++) { this.days.push({ empty: true }); }
      
      for (let i = 1; i <= daysInMonth; i++) {
        const dateObj = new Date(year, month, i);
        const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
        
        const customEvent = this.companyEvents.find(e => e.date === dateStr);
        const awayCount = allRequests.filter((r: any) => r.status === 'Approved' && this.isDateInPeriod(dateObj, r.period)).length;
        
        // Find birthdays on this day
        const dayBirthdays = this.birthdays.filter(b => b.month === month && b.day === i);
        
        this.days.push({
          day: i, 
          date: dateStr, 
          holiday: this.holidays.find(h => h.date === dateStr),
          companyEvent: customEvent,
          awayCount, 
          isToday: today.toDateString() === dateObj.toDateString(), 
          isPast: dateObj < today,
          birthdays: dayBirthdays
        });
      }
      // Force change detection by reassigning days array
      this.days = [...this.days];
      this.cd.detectChanges();
    });
  }

  isDateInPeriod(target: Date, period: string): boolean {
    if (!period) return false;
    const sep = period.includes(' to ') ? ' to ' : ' - ';
    const parts = period.split(sep);
    const start = new Date(parts[0]);
    const end = parts[1] ? new Date(parts[1]) : start;
    start.setHours(0,0,0,0); end.setHours(23,59,59,999);
    return target >= start && target <= end;
  }

  selectDay(day: any) {
    if (day.empty || (day.isPast && !this.isHR)) return;
    this.selectedDay = day;
    const diffDays = Math.ceil((new Date(day.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    this.isNoticeWarning = diffDays < this.suggestedNoticeDays && diffDays >= 0;
    this.showModal = true;
  }

  generateYearOptions() {
    const currentYear = new Date().getFullYear();
    for (let i = currentYear; i <= currentYear + 10; i++) { this.years.push(i); }
  }

  prevMonth() { this.currentDate = new Date(this.currentDate.setMonth(this.currentDate.getMonth() - 1)); this.fetchHolidays(this.currentDate.getFullYear()); }
  nextMonth() { this.currentDate = new Date(this.currentDate.setMonth(this.currentDate.getMonth() + 1)); this.fetchHolidays(this.currentDate.getFullYear()); }
  goToToday() { this.currentDate = new Date(); this.fetchHolidays(this.currentDate.getFullYear()); }
  changeYear(e: any) { this.currentDate = new Date(this.currentDate.setFullYear(e.target.value)); this.fetchHolidays(this.currentDate.getFullYear()); }
  goToFiling(date: string) { this.router.navigate(['/file-leave'], { queryParams: { date } }); }
}