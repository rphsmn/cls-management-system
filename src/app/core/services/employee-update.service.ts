import { Injectable, inject } from '@angular/core';
import { Firestore, collection, query, where, getDocs, updateDoc, doc } from '@angular/fire/firestore';

interface EmployeeData {
  employeeId: string;
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  field1: string;
  field2: string;
  field3: string;
  field4: string;
}

@Injectable({
  providedIn: 'root'
})
export class EmployeeUpdateService {
  private firestore = inject(Firestore);

  /**
   * Parse the employee data from the provided string
   */
  parseEmployeeData(dataString: string): EmployeeData[] {
    const lines = dataString.trim().split('\n');
    const employees: EmployeeData[] = [];

    for (const line of lines) {
      const parts = line.split('\t').map(p => p.trim());
      if (parts.length >= 9) {
        employees.push({
          employeeId: parts[0],
          lastName: parts[1],
          firstName: parts[2],
          middleName: parts[3],
          birthDate: parts[4],
          field1: parts[5],
          field2: parts[6],
          field3: parts[7],
          field4: parts[8]
        });
      }
    }

    return employees;
  }

  /**
   * Convert birth date from "DD-MMM-YY" format to ISO date string
   */
  convertBirthDate(dateStr: string): string {
    const months: { [key: string]: string } = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
      'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
      'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };

    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;

    const day = parts[0].padStart(2, '0');
    const month = months[parts[1]] || '01';
    let year = parts[2];

    // Convert 2-digit year to 4-digit
    if (year.length === 2) {
      const yearNum = parseInt(year, 10);
      year = yearNum >= 0 && yearNum <= 99 
        ? (yearNum >= 50 ? `19${year}` : `20${year}`)
        : year;
    }

    return `${year}-${month}-${day}`;
  }

  /**
   * Update employee data in Firestore
   */
  async updateEmployeeData(employees: EmployeeData[]): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = { success: 0, failed: 0, errors: [] as string[] };

    for (const employee of employees) {
      try {
        // Query Firestore for the employee by employeeId
        const usersRef = collection(this.firestore, 'users');
        const q = query(usersRef, where('employeeId', '==', employee.employeeId));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          results.errors.push(`Employee not found: ${employee.employeeId}`);
          results.failed++;
          continue;
        }

        // Get the first matching document
        const userDoc = snapshot.docs[0];
        const docRef = doc(this.firestore, 'users', userDoc.id);

        // Prepare update data
        const updateData: any = {
          name: `${employee.firstName} ${employee.middleName} ${employee.lastName}`.trim(),
          birthday: this.convertBirthDate(employee.birthDate),
          // Store additional fields as custom properties
          tin: employee.field1,
          sss: employee.field2,
          philhealth: employee.field3,
          pagibig: employee.field4
        };

        // Update the document
        await updateDoc(docRef, updateData);
        results.success++;
        console.log(`Updated employee: ${employee.employeeId} - ${updateData.name}`);
      } catch (error) {
        const errorMsg = `Error updating ${employee.employeeId}: ${error}`;
        results.errors.push(errorMsg);
        results.failed++;
        console.error(errorMsg);
      }
    }

    return results;
  }

  /**
   * Main method to update all employee data
   */
  async applyEmployeeUpdates(): Promise<{ success: number; failed: number; errors: string[] }> {
    const employeeDataString = `CLS-ADM00040	Abion	Shannen Mae	Aringo	26-Mar-00	05-1700807-4	102502156109	121326048624	659-068-321-0000
CLS-ADM00006	Amoncio	Riza Jane	Alegre	1-Oct-99	05-1512551-9	100253640892	121252554020	745-276-001-0000
CLS-ADM00045	Balaguer	Maridhel	Pamarjos	14-Jun-98	05-1549604-4	102502142922	121266108842	756-287-066-0000
CLS-MGT00003	Belen	Edith	Dungog	26-Nov-82	33-8172099-6	100501655397	121292023736	612-949-249-0000
CLS-MGT00021	Belen	Roy	Esplana	11-Nov-75	35-1480246-1	102502231062	121292023747	228-448-588-0000
CLS-ACC00012	Boton	Toni Alyn	Yngente	23-Feb-97	35-1502847-7	100502836492	121293451941	659-114-099-0000
CLS-DEC00044	Catle	Benzel Mikko	N/A	14-Jun-01	05-1697143-2	102543044080	121331347517	663-761-077-0000
CLS-DEV00017	Laurinaria	Dyron	Alipio	23-Sep-98	35-1578077-3	100502855446	121278492218	642-602-581-0000
CLS-ADM00031	Melitante	Melanie	Mirabete	17-Sep-99	05-1602259-8	100255019168	121305168111	613-006-469-0000
CLS-ADM00046	Neptuno	Rosalie	Gñotob	25-Jun-01	05-1504484-9	102501822229	121318976458	645-483-488-0000
CLS-ACC00024	Oreste	Olympia	Ballon	14-Aug-90	05-1076461-6	100501724933	121044197775	311-581-479-0000
CLS-ADM00010	Prado	Reymart	Lovendino	13-Feb-98	05-1536350-4	102532523130	121254657342	754-897-376-0000
CLS-DEV00035	Ramirez	Khrystin Fiona	Conejos	21-Nov-00	05-1734806-4	102540836148	121334124324	632-103-240-0000
CLS-ADM00037	Reantaso	Domingo	Nayve	23-Feb-01	05-1693313-7	100255321611	121324890479	633-916-013-0000
CLS-ACC00023	Solano	Dorothy	Bitoy	20-Feb-97	34-7125538-4	182512680942	121211553461	342-788-123-0000
CLS-ADM00051	Morales	Ranilyn	Noleal	12-Aug-01	05-1906568-8	100255896800	121363601558	687-499-306-0000`;

    console.log('Parsing employee data...');
    const employees = this.parseEmployeeData(employeeDataString);
    console.log(`Found ${employees.length} employees to update`);

    console.log('Updating Firestore...');
    const results = await this.updateEmployeeData(employees);

    console.log('\n=== Update Results ===');
    console.log(`Successfully updated: ${results.success}`);
    console.log(`Failed: ${results.failed}`);
    
    if (results.errors.length > 0) {
      console.log('\nErrors:');
      results.errors.forEach(err => console.log(`  - ${err}`));
    }

    return results;
  }
}
