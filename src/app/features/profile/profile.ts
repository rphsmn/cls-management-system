import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { AuthService, User, calculatePaidTimeOff } from '../../core/services/auth';
import { environment } from '../../../environments/environment';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class ProfileComponent implements OnInit {
  currentUser$: Observable<User | null>;
  private authService = inject(AuthService);
  private hrEmail = environment.hrEmail;

  // Computed values (will be updated when user data is available)
  yearsOfService = 'N/A';
  paidTimeOff = 0;
  private currentUser: User | null = null;

  // Email options state
  showEmailOptions = false;
  emailCopied = false;

  constructor() {
    this.currentUser$ = this.authService.currentUser$;
  }

  getFormattedDept(): string {
    const dept = this.currentUser?.department || this.currentUser?.dept || 'N/A';
    const deptMap: Record<string, string> = {
      devs: 'DevOps',
      accounts: 'Accounts',
      manager: 'Manager',
      'operations-admin': 'Operations-Admin',
      'part-time': 'Part-time',
    };
    const normalized = dept?.toLowerCase().trim();
    return deptMap[normalized] || dept;
  }

  ngOnInit(): void {
    // Subscribe to update computed values when user data changes
    this.authService.currentUser$.subscribe((user) => {
      if (user) {
        this.currentUser = user;
        console.log('[Profile] User name:', user.name);
        console.log('[Profile] Emergency Contact Person:', user.emergencyContactPerson);
        console.log('[Profile] Emergency Contact Mobile:', user.emergencyContactMobile);
        console.log('[Profile] Emergency Contact Address:', user.emergencyContactAddress);
        console.log('[Profile] Emergency Contact Relation:', user.emergencyContactRelation);
        console.log('[Profile] Full user keys:', Object.keys(user));
        this.updateComputedValues();
      } else {
        console.log('[Profile] No user data received');
      }
    });
  }

  private updateComputedValues(): void {
    if (!this.currentUser) return;

    // Calculate years of service
    if (this.currentUser.joinedDate) {
      const joinDate = new Date(this.currentUser.joinedDate);
      const today = new Date();
      const years = (today.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

      if (years < 1) {
        this.yearsOfService = 'Less than 1 year';
      } else if (years < 2) {
        this.yearsOfService = '1 year';
      } else {
        this.yearsOfService = `${Math.floor(years)} years`;
      }
    } else {
      this.yearsOfService = 'N/A';
    }

    // Calculate paid time off
    this.paidTimeOff = calculatePaidTimeOff(this.currentUser.joinedDate, this.currentUser.role);
  }

  formatDate(dateStr: string | undefined): string {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }

  toggleEmailOptions(): void {
    this.showEmailOptions = !this.showEmailOptions;
    this.emailCopied = false;
  }

  private getEmailSubjectAndBody(): { subject: string; body: string } {
    const subject = encodeURIComponent(`Update Request - ${this.currentUser?.name || 'Employee'}`);
    const body = encodeURIComponent(
      `Hello HR,\n\nI would like to request an update to my professional information.\n\nEmployee: ${this.currentUser?.name || 'N/A'}\nEmployee ID: ${this.currentUser?.employeeId || 'N/A'}\nDepartment: ${this.currentUser?.department || this.currentUser?.dept || 'N/A'}\n\nPlease let me know what information needs to be updated.\n\nThank you.`,
    );
    return { subject, body };
  }

  getGmailComposeUrl(): string {
    const { subject, body } = this.getEmailSubjectAndBody();
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${this.hrEmail}&su=${subject}&body=${body}`;
  }

  getYahooComposeUrl(): string {
    const { subject, body } = this.getEmailSubjectAndBody();
    return `https://compose.mail.yahoo.com/?to=${this.hrEmail}&subject=${subject}&body=${body}`;
  }

  getOutlookWebComposeUrl(): string {
    const { subject, body } = this.getEmailSubjectAndBody();
    return `https://outlook.live.com/owa/?path=/mail/action/compose&to=${this.hrEmail}&subject=${subject}&body=${body}`;
  }

  getMailtoUrl(): string {
    const { subject, body } = this.getEmailSubjectAndBody();
    return `mailto:${this.hrEmail}?subject=${subject}&body=${body}`;
  }

  copyHrEmail(): void {
    navigator.clipboard.writeText(this.hrEmail).then(() => {
      this.emailCopied = true;
      setTimeout(() => {
        this.emailCopied = false;
      }, 2000);
    });
  }

  downloadPdf(): void {
    if (!this.currentUser) return;

    const user = this.currentUser;
    const doc = new jsPDF();
    const isManager = user.role === 'MANAGING DIRECTOR';

    // Header
    doc.setFontSize(16);
    doc.setTextColor(26, 83, 54); // #1a5336
    doc.text('Cor Logics Solution Inc.', 105, 18, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(60, 60, 60);
    doc.text('Employee Information Record', 105, 26, { align: 'center' });

    let yPos = 38;

    // Compact table styles
    const compactStyles = {
      theme: 'grid' as const,
      headStyles: {
        fillColor: [26, 83, 54] as [number, number, number],
        fontSize: 9,
        cellPadding: 2,
      },
      bodyStyles: { fontSize: 9, cellPadding: 2 },
      margin: { left: 14, right: 14 },
    };

    // Section 1: Employment
    doc.setFontSize(10);
    doc.setTextColor(26, 83, 54);
    doc.text('Employment Details', 14, yPos);
    yPos += 5;

    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    autoTable(doc, {
      startY: yPos,
      head: [['Field', 'Information']],
      body: [
        ['Name', user.name || 'N/A'],
        ['Employee ID', user.employeeId || 'N/A'],
        ['Department', this.getFormattedDept()],
        ['Role', user.role || 'N/A'],
        ['Joined Date', this.formatDate(user.joinedDate)],
        ['Years of Service', this.yearsOfService],
      ],
      ...compactStyles,
      columnStyles: { 1: { cellWidth: 80 } },
    });
    yPos = (doc as any).lastAutoTable.finalY + 8;

    // Section 2: Personal & Government IDs
    doc.setFontSize(10);
    doc.setTextColor(26, 83, 54);
    doc.text('Personal & Government IDs', 14, yPos);
    yPos += 5;

    const govBody = [
      ['Birthday', user.birthday || 'N/A'],
      ['Gender', user.gender ? user.gender.charAt(0).toUpperCase() + user.gender.slice(1) : 'N/A'],
    ];
    if (user.tin) govBody.push(['TIN', user.tin]);
    if (user.sss) govBody.push(['SSS', user.sss]);
    if (user.philhealth) govBody.push(['PhilHealth', user.philhealth]);
    if (user.pagibig) govBody.push(['Pag-IBIG', user.pagibig]);

    autoTable(doc, {
      startY: yPos,
      head: [['Field', 'Information']],
      body: govBody,
      ...compactStyles,
      columnStyles: { 1: { cellWidth: 80 } },
    });
    yPos = (doc as any).lastAutoTable.finalY + 8;

    // Section 3: Emergency Contact
    doc.setFontSize(10);
    doc.setTextColor(26, 83, 54);
    doc.text('Emergency Contact', 14, yPos);
    yPos += 5;

    const emergencyBody = [];
    if (user.emergencyContactPerson)
      emergencyBody.push(['Primary Emergency Contact Person', user.emergencyContactPerson]);
    if (user.emergencyContactRelation)
      emergencyBody.push(['Relationship to Employee', user.emergencyContactRelation]);
    if (user.emergencyContactMobile)
      emergencyBody.push(['Emergency Contact Mobile', user.emergencyContactMobile]);
    if (user.emergencyContactAddress)
      emergencyBody.push(['Emergency Contact Address', user.emergencyContactAddress]);

    autoTable(doc, {
      startY: yPos,
      head: [['Field', 'Information']],
      body:
        emergencyBody.length > 0 ? emergencyBody : [['N/A', 'No emergency contact information']],
      ...compactStyles,
      columnStyles: { 1: { cellWidth: 80 } },
    });
    yPos = (doc as any).lastAutoTable.finalY + 8;

    // Section 4: Leave Balance (only for non-managers)
    if (!isManager) {
      doc.setFontSize(10);
      doc.setTextColor(26, 83, 54);
      doc.text('Leave Balance', 14, yPos);
      yPos += 5;

      autoTable(doc, {
        startY: yPos,
        head: [['Leave Type', 'Balance']],
        body: [
          ['Birthday Leave', `${user.birthdayLeave || 0} day(s)`],
          ['Paid Leave', `${this.paidTimeOff} day(s)`],
        ],
        ...compactStyles,
        columnStyles: { 1: { cellWidth: 80 } },
      });
    }

    // Footer
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      105,
      pageHeight - 10,
      { align: 'center' },
    );

    // Save
    doc.save(`Employee_Record_${user.employeeId || 'Unknown'}.pdf`);
  }
}
