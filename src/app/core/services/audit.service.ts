import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  getDocs,
} from '@angular/fire/firestore';
import { AuthService } from './auth';

export interface AuditLog {
  id?: string;
  action: string;
  details: string;
  targetUserId?: string;
  targetUserName?: string;
  performedBy: string;
  performedByName: string;
  timestamp: any;
  metadata?: Record<string, any>;
}

export type AuditAction =
  | 'leave_filed'
  | 'leave_approved'
  | 'leave_rejected'
  | 'leave_cancelled'
  | 'status_changed'
  | 'absent_marked'
  | 'profile_updated'
  | 'user_created'
  | 'user_deactivated'
  | 'login_success'
  | 'login_failed';

@Injectable({
  providedIn: 'root',
})
export class AuditService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);

  async logAction(
    action: AuditAction,
    details: string,
    options?: {
      targetUserId?: string;
      targetUserName?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<void> {
    const currentUser = this.authService.currentUser;

    const logEntry: Omit<AuditLog, 'id'> = {
      action,
      details,
      targetUserId: options?.targetUserId,
      targetUserName: options?.targetUserName,
      performedBy: currentUser?.uid || 'system',
      performedByName: currentUser?.name || 'System',
      timestamp: serverTimestamp(),
      metadata: options?.metadata,
    };

    try {
      await addDoc(collection(this.firestore, 'auditLogs'), logEntry);
      console.log('[AuditService] Logged action:', action, details);
    } catch (error) {
      console.error('[AuditService] Failed to log action:', error);
    }
  }

  async getRecentLogs(limitCount: number = 50): Promise<AuditLog[]> {
    try {
      const q = query(
        collection(this.firestore, 'auditLogs'),
        orderBy('timestamp', 'desc'),
        limit(limitCount),
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as AuditLog);
    } catch (error) {
      console.error('[AuditService] Failed to fetch logs:', error);
      return [];
    }
  }
}
