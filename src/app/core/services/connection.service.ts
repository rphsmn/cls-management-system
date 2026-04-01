import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, fromEvent, merge } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

export interface ConnectionState {
  isOnline: boolean;
  isFirestoreConnected: boolean;
  lastChecked: Date;
}

/**
 * Service to monitor network connection and Firestore connectivity
 * Helps prevent API calls when offline and provides user feedback
 */
@Injectable({
  providedIn: 'root'
})
export class ConnectionService implements OnDestroy {
  private connectionStateSubject = new BehaviorSubject<ConnectionState>({
    isOnline: navigator.onLine,
    isFirestoreConnected: true, // Assume connected initially
    lastChecked: new Date()
  });

  connectionState$: Observable<ConnectionState> = this.connectionStateSubject.asObservable();

  private onlineSubscription: any;
  private offlineSubscription: any;

  constructor() {
    this.initializeNetworkMonitoring();
  }

  private initializeNetworkMonitoring(): void {
    // Monitor online/offline events
    const online$ = fromEvent(window, 'online').pipe(map(() => true));
    const offline$ = fromEvent(window, 'offline').pipe(map(() => false));
    
    const network$ = merge(online$, offline$).pipe(
      startWith(navigator.onLine)
    );

    this.onlineSubscription = network$.subscribe(isOnline => {
      this.updateConnectionState({ isOnline });
      

    });
  }

  private updateConnectionState(partial: Partial<ConnectionState>): void {
    const currentState = this.connectionStateSubject.value;
    this.connectionStateSubject.next({
      ...currentState,
      ...partial,
      lastChecked: new Date()
    });
  }

  /**
   * Update Firestore connection status
   * Called by Firestore listeners when connection state changes
   */
  updateFirestoreConnection(isConnected: boolean): void {
    this.updateConnectionState({ isFirestoreConnected: isConnected });
    

  }

  /**
   * Check if we can make API calls
   * Returns true if both network and Firestore are connected
   */
  canMakeApiCalls(): boolean {
    const state = this.connectionStateSubject.value;
    return state.isOnline && state.isFirestoreConnected;
  }

  /**
   * Get current connection state
   */
  getCurrentState(): ConnectionState {
    return this.connectionStateSubject.value;
  }

  ngOnDestroy(): void {
    if (this.onlineSubscription) {
      this.onlineSubscription.unsubscribe();
    }
    if (this.offlineSubscription) {
      this.offlineSubscription.unsubscribe();
    }
  }
}
