import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import {
  Firestore,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
  getDocs,
  writeBatch,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
} from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Notification {
  id?: string;
  type: 'new_leave_request' | 'leave_approved' | 'leave_rejected' | 'leave_cancelled';
  title: string;
  message: string;
  fromUser: string;
  fromUserId: string;
  requestId?: string;
  targetRole: string;
  createdAt: Date;
  read: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private firestore = inject(Firestore);
  private titleService = inject(Title);

  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  notifications$ = this.notificationsSubject.asObservable();

  private unreadCountSubject = new BehaviorSubject<number>(0);
  unreadCount$ = this.unreadCountSubject.asObservable();

  private unsubscribe: Unsubscribe | null = null;
  private previousCount = 0;

  subscribeToNotifications(userRole: string, userUid: string) {
    const targetRoles = this.getTargetRolesForRole(userRole);

    if (targetRoles.length === 0) {
      return;
    }

    const notificationsRef = collection(this.firestore, 'notifications');
    const q = query(notificationsRef);

    this.unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifications = snapshot.docs
          .map((doc) => {
            const data = doc.data() as any;
            const isForUser =
              targetRoles.includes(data.targetRole) || data.targetUserId === userUid;
            if (!isForUser && userUid) return null;

            const createdAt = data.createdAt?.toDate
              ? data.createdAt.toDate()
              : new Date(data.createdAt?.seconds ? data.createdAt.seconds * 1000 : Date.now());
            return {
              id: doc.id,
              type: data.type,
              title: data.title,
              message: data.message,
              fromUser: data.fromUser,
              fromUserId: data.fromUserId,
              targetRole: data.targetRole,
              createdAt: createdAt,
              read: data.read,
            } as Notification;
          })
          .filter((n) => n !== null)
          .sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          });

        const unreadNotifications = notifications.filter((n) => !n.read);
        const currentCount = unreadNotifications.length;

        this.updateBrowserTitle(currentCount);

        if (currentCount > this.previousCount) {
          this.playNotificationSound();
        }
        this.previousCount = currentCount;

        this.notificationsSubject.next(notifications);
        this.unreadCountSubject.next(currentCount);
      },
      (error) => {
        console.error('[NotificationService] Error listening to notifications:', error);
      },
    );
  }

  private updateBrowserTitle(count: number): void {
    const appTitle = environment.appTitle || 'CLS HRIS';
    if (count > 0) {
      this.titleService.setTitle(`(${count}) New notifications - ${appTitle}`);
    } else {
      this.titleService.setTitle(appTitle);
    }
  }

  private playNotificationSound(): void {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();

      if (audioContext.state === 'suspended') {
        audioContext
          .resume()
          .then(() => {
            this.playWithContext(audioContext);
          })
          .catch(() => {});
      } else {
        this.playWithContext(audioContext);
      }
    } catch (e) {
      // Audio not supported or blocked
    }
  }

  private playWithContext(audioContext: any): void {
    const audio = new Audio('sounds/notification.mp3');
    audio.volume = 0.7;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        this.playWebAudioFallback(audioContext);
      });
    }
  }

  private playWebAudioFallback(audioContext: any): void {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.linearRampToValueAtTime(1200, audioContext.currentTime + 0.03);
    oscillator.frequency.linearRampToValueAtTime(800, audioContext.currentTime + 0.08);

    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.4, audioContext.currentTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.15);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
  }

  private getTargetRolesForRole(role: string): string[] {
    const upperRole = role.toUpperCase();

    // Employees - no notifications
    if (
      [
        'PART-TIME',
        'EMPLOYEE',
        'IT DEVELOPER',
        'IT ASSISTANT',
        'SENIOR IT DEVELOPER',
        'ADMIN OPERATION OFFICER',
        'ADMIN OPERATION ASSISTANT',
        'ADMIN COMPLIANCE OFFICER',
        'ACCOUNTING CLERK',
        'ACCOUNT RECEIVABLE SPECIALIST',
        'ACCOUNT PAYABLES SPECIALIST',
      ].includes(upperRole)
    ) {
      return [];
    }

    // Supervisors get notified about their team's requests
    if (upperRole === 'OPERATIONS ADMIN SUPERVISOR') {
      return ['OPERATIONS ADMIN SUPERVISOR'];
    }
    if (upperRole === 'ACCOUNT SUPERVISOR') {
      return ['ACCOUNT SUPERVISOR'];
    }
    if (upperRole === 'ADMIN MANAGER') {
      return ['ADMIN MANAGER'];
    }
    if (upperRole === 'HR' || upperRole === 'HUMAN RESOURCE OFFICER') {
      return ['HR', 'HUMAN RESOURCE OFFICER'];
    }

    return [];
  }

  async createNotification(
    type: Notification['type'],
    title: string,
    message: string,
    fromUser: string,
    fromUserId: string,
    targetRole: string,
    requestId?: string,
    targetUserId?: string,
  ) {
    const notificationsRef = collection(this.firestore, 'notifications');

    const docData: any = {
      type,
      title,
      message,
      fromUser,
      fromUserId,
      targetRole,
      createdAt: new Date(),
      read: false,
    };

    if (targetUserId) {
      docData.targetUserId = targetUserId;
    }

    // Only add requestId if it's defined
    if (requestId) {
      docData.requestId = requestId;
    }

    await addDoc(notificationsRef, docData);
  }

  // Notify supervisors when a new leave is submitted
  async notifyNewLeaveRequest(
    employeeName: string,
    employeeUid: string,
    leaveType: string,
    period: string,
    employeeRole: string,
  ) {
    const targetRoles = this.getNotificationTargets(employeeRole);

    for (const role of targetRoles) {
      try {
        await this.createNotification(
          'new_leave_request',
          'New Leave Request',
          `${employeeName} filed ${leaveType} (${period})`,
          employeeName,
          employeeUid,
          role,
        );
      } catch (err) {
        console.error('[NotificationService] Failed to create notification for', role, err);
      }
    }
  }

  private getNotificationTargets(employeeRole: string): string[] {
    const upperRole = employeeRole.toUpperCase();

    // Part-time goes to HR only
    if (upperRole === 'PART-TIME') {
      return ['HR', 'HUMAN RESOURCE OFFICER'];
    }

    // Operations Admin staff -> Ops Admin Supervisor, then HR
    if (
      ['ADMIN OPERATION OFFICER', 'ADMIN OPERATION ASSISTANT', 'ADMIN COMPLIANCE OFFICER'].includes(
        upperRole,
      )
    ) {
      return ['OPERATIONS ADMIN SUPERVISOR', 'HR', 'HUMAN RESOURCE OFFICER'];
    }

    // Accounts staff -> Account Supervisor, then HR
    if (
      ['ACCOUNTING CLERK', 'ACCOUNT RECEIVABLE SPECIALIST', 'ACCOUNT PAYABLES SPECIALIST'].includes(
        upperRole,
      )
    ) {
      return ['ACCOUNT SUPERVISOR', 'HR', 'HUMAN RESOURCE OFFICER'];
    }

    // IT Staff -> Admin Manager, then HR
    if (['IT DEVELOPER', 'IT ASSISTANT', 'SENIOR IT DEVELOPER'].includes(upperRole)) {
      return ['ADMIN MANAGER', 'HR', 'HUMAN RESOURCE OFFICER'];
    }

    // Supervisors -> Admin Manager, then HR
    if (['OPERATIONS ADMIN SUPERVISOR', 'ACCOUNT SUPERVISOR'].includes(upperRole)) {
      return ['ADMIN MANAGER', 'HR', 'HUMAN RESOURCE OFFICER'];
    }

    // HR -> Admin Manager
    if (upperRole === 'HR' || upperRole === 'HUMAN RESOURCE OFFICER') {
      return ['ADMIN MANAGER'];
    }

    // Admin Manager -> HR
    if (upperRole === 'ADMIN MANAGER') {
      return ['HR', 'HUMAN RESOURCE OFFICER'];
    }

    // Default - just HR
    return ['HR', 'HUMAN RESOURCE OFFICER'];
  }

  private getRoleLabel(role: string): string {
    const map: { [key: string]: string } = {
      HR: 'HR',
      'HUMAN RESOURCE OFFICER': 'HR',
      'OPERATIONS ADMIN SUPERVISOR': 'Operations Admin Supervisor',
      'ACCOUNT SUPERVISOR': 'Account Supervisor',
      'ADMIN MANAGER': 'Admin Manager',
    };
    return map[role] || role;
  }

  unsubscribeFromNotifications() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.notificationsSubject.next([]);
    this.unreadCountSubject.next(0);
  }

  async markAllAsRead(userRole: string, userUid?: string) {
    const targetRoles = this.getTargetRolesForRole(userRole);
    if (targetRoles.length === 0 && !userUid) return;

    // Get all notifications and filter in memory (same logic as subscribeToNotifications)
    const notificationsRef = collection(this.firestore, 'notifications');
    const q = query(notificationsRef);

    const snapshot = await getDocs(q);
    const batch = writeBatch(this.firestore);

    snapshot.docs.forEach((doc) => {
      const data = doc.data() as any;
      const isForUser = targetRoles.includes(data.targetRole) || data.targetUserId === userUid;
      if (isForUser && !data.read) {
        batch.update(doc.ref, { read: true });
      }
    });

    await batch.commit();
    this.updateBrowserTitle(0);
  }

  async clearAllNotifications(userRole: string, userUid?: string) {
    const targetRoles = this.getTargetRolesForRole(userRole);
    if (targetRoles.length === 0 && !userUid) return;

    const notificationsRef = collection(this.firestore, 'notifications');
    const q = query(notificationsRef);

    const snapshot = await getDocs(q);
    const batch = writeBatch(this.firestore);

    snapshot.docs.forEach((doc) => {
      const data = doc.data() as any;
      const isForUser = targetRoles.includes(data.targetRole) || data.targetUserId === userUid;
      if (isForUser) {
        batch.delete(doc.ref);
      }
    });

    await batch.commit();
    this.updateBrowserTitle(0);
  }

  async markAsRead(notificationId: string) {
    if (!notificationId) return;
    const notifDoc = doc(this.firestore, 'notifications', notificationId);
    const docSnap = await getDoc(notifDoc);
    if (docSnap.exists() && !docSnap.data()['read']) {
      await updateDoc(notifDoc, { read: true });
    }
  }

  async deleteNotification(notificationId: string) {
    if (!notificationId) return;
    await deleteDoc(doc(this.firestore, 'notifications', notificationId));
  }
}
