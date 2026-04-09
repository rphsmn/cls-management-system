import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of, BehaviorSubject } from 'rxjs';
import { map, catchError, shareReplay, tap } from 'rxjs/operators';

export interface Holiday {
  date: string;
  name: string;
  region: 'ph' | 'au' | 'ph/au';
  type: 'regular' | 'special-non' | 'special-work';
}

@Injectable({ providedIn: 'root' })
export class HolidayService {
  private http = inject(HttpClient);
  
  private holidayListSubject = new BehaviorSubject<Holiday[]>([]);
  holidays$ = this.holidayListSubject.asObservable();
  
  private loaded = false;
  private currentYear = new Date().getFullYear();

  constructor() {
    this.loadHolidays(this.currentYear);
  }

  private loadHolidays(year: number): void {
    if (this.loaded) {
      this.holidays$.subscribe(h => {
        if (h.length > 0) return;
        this.fetchAndCache(year);
      });
      return;
    }
    this.fetchAndCache(year);
  }

  private fetchAndCache(year: number): void {
    forkJoin([
      this.http.get<any[]>(`https://date.nager.at/api/v3/PublicHolidays/${year}/PH`)
        .pipe(catchError(() => of([]))),
      this.http.get<any[]>(`https://date.nager.at/api/v3/PublicHolidays/${year}/AU`)
        .pipe(catchError(() => of([])))
    ]).subscribe(([phData, auData]) => {
      const holidays = this.processHolidays(phData, auData);
      // Store all holidays (PH and AU)
      this.holidayListSubject.next(holidays);
      this.loaded = true;
    });
  }

  private processHolidays(phData: any[], auData: any[]): Holiday[] {
    const processedPH = phData.map(h => ({
      date: h.date,
      name: h.name,
      region: 'ph' as const,
      type: this.mapHolidayType(h.name)
    }));
    
    const processedAU = auData.map(h => ({
      date: h.date,
      name: h.name,
      region: 'au' as const,
      type: this.mapHolidayType(h.name)
    }));

    // Combine both PH and AU holidays - keep them separate
    const allHolidays = [...processedPH, ...processedAU];
    return allHolidays.sort((a, b) => a.date.localeCompare(b.date));
  }

  // Return all holidays (both PH and AU)
  getHolidays(): Holiday[] {
    return this.holidayListSubject.value;
  }

  isHoliday(date: string): boolean {
    return this.holidayListSubject.value.some(h => h.date === date);
  }

  getHolidayForDate(date: string): Holiday | undefined {
    return this.holidayListSubject.value.find(h => h.date === date);
  }

  private mapHolidayType(name: string): 'regular' | 'special-non' | 'special-work' {
    const lower = name.toLowerCase();
    if (lower.includes('edsa')) return 'special-work';
    if (lower.includes('ninoy') || lower.includes('chinese')) return 'special-non';
    return 'regular';
  }

  refreshYear(year: number): void {
    this.loaded = false;
    this.currentYear = year;
    this.fetchAndCache(year);
  }
}
