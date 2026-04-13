import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Firestore,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  Unsubscribe,
} from '@angular/fire/firestore';
import { AuditService, AuditLog } from '../../core/services/audit.service';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audit-logs.html',
  styleUrls: ['./audit-logs.css'],
})
export class AuditLogsComponent implements OnInit {
  private firestore = inject(Firestore);
  private auditService = inject(AuditService);

  logs: AuditLog[] = [];
  isLoading = true;
  filterAction = 'all';
  actions = [
    'all',
    'leave_filed',
    'leave_approved',
    'leave_rejected',
    'absent_marked',
    'profile_updated',
    'user_created',
    'leave_cancelled',
  ];

  // Time filter properties
  selectedPreset = 'all';
  selectedMonth = '';
  selectedYear = new Date().getFullYear();

  timePresets = [
    { label: '24h', value: '24h' },
    { label: '7d', value: '7d' },
    { label: '30d', value: '30d' },
    { label: 'All', value: 'all' },
  ];

  months = [
    { label: 'January', value: '1' },
    { label: 'February', value: '2' },
    { label: 'March', value: '3' },
    { label: 'April', value: '4' },
    { label: 'May', value: '5' },
    { label: 'June', value: '6' },
    { label: 'July', value: '7' },
    { label: 'August', value: '8' },
    { label: 'September', value: '9' },
    { label: 'October', value: '10' },
    { label: 'November', value: '11' },
    { label: 'December', value: '12' },
  ];

  years: number[] = [];

  private allLogs: AuditLog[] = [];
  private unsubscribe: Unsubscribe | null = null;

  get hasActiveFilters(): boolean {
    return (
      this.selectedPreset !== 'all' || this.selectedMonth !== '' || this.filterAction !== 'all'
    );
  }

  constructor() {
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= currentYear - 2; y--) {
      this.years.push(y);
    }
  }

  async ngOnInit() {
    console.log('[AuditLogs] ngOnInit started');
    const start = performance.now();
    await this.fetchLogs();
    console.log('[AuditLogs] ngOnInit completed in', (performance.now() - start).toFixed(2), 'ms');
  }

  ngOnDestroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  async fetchLogs() {
    console.log('[AuditLogs] fetchLogs started');
    const startTime = performance.now();

    try {
      if (this.unsubscribe) {
        this.unsubscribe();
      }

      const logsRef = collection(this.firestore, 'auditLogs');
      const q = query(logsRef, orderBy('timestamp', 'desc'), limit(500));
      console.log('[AuditLogs] Query created, fetching...');

      this.unsubscribe = onSnapshot(q, (snapshot) => {
        const snapStart = performance.now();
        console.log('[AuditLogs] Snapshot received:', snapshot.size, 'docs');

        this.allLogs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as AuditLog[];

        this.applyFilters();

        this.isLoading = false;
        console.log(
          '[AuditLogs] Total fetch time:',
          (performance.now() - startTime).toFixed(2),
          'ms',
        );
      });
    } catch (error) {
      console.error('[AuditLogs] Error fetching logs:', error);
      this.isLoading = false;
    }
  }

  setTimePreset(preset: string) {
    this.selectedPreset = preset;
    this.applyFilters();
  }

  applyFilters() {
    let filtered = [...this.allLogs];

    // Apply time preset filter
    if (this.selectedPreset !== 'all') {
      const now = new Date();
      let startDate: Date;

      switch (this.selectedPreset) {
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(0);
      }

      filtered = filtered.filter((log) => {
        const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
        return logDate >= startDate;
      });
    }

    // Apply month/year filter
    if (this.selectedMonth || this.selectedYear) {
      filtered = filtered.filter((log) => {
        const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
        const logMonth = logDate.getMonth() + 1;
        const logYear = logDate.getFullYear();

        const monthMatch = this.selectedMonth ? logMonth === parseInt(this.selectedMonth) : true;
        const yearMatch = logYear === this.selectedYear;

        return monthMatch && yearMatch;
      });
    }

    // Apply action filter
    if (this.filterAction !== 'all') {
      filtered = filtered.filter((log) => log.action === this.filterAction);
    }

    this.logs = filtered;
  }

  clearFilters() {
    this.selectedPreset = 'all';
    this.selectedMonth = '';
    this.selectedYear = new Date().getFullYear();
    this.filterAction = 'all';
    this.applyFilters();
  }

  get filteredLogs() {
    return this.logs;
  }

  formatAction(action: string): string {
    const actionMap: Record<string, string> = {
      leave_filed: 'Leave Filed',
      leave_approved: 'Leave Approved',
      leave_rejected: 'Leave Rejected',
      leave_cancelled: 'Leave Cancelled',
      absent_marked: 'Marked Absent',
      profile_updated: 'Profile Updated',
      user_created: 'User Created',
      user_deactivated: 'User Deactivated',
      login_success: 'Login Success',
      login_failed: 'Login Failed',
    };
    return actionMap[action] || action;
  }

  getActionClass(action: string): string {
    if (action.includes('approve')) return 'success';
    if (action.includes('reject') || action.includes('failed')) return 'danger';
    if (action.includes('cancelled')) return 'cancelled';
    if (action.includes('absent')) return 'warning';
    return 'info';
  }

  formatTimestamp(timestamp: any): string {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getTimeAgo(timestamp: any): string {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return '';
  }
}
