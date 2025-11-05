import { AiDetection, RtoData, Transaction } from '../types';

export const mockAiDetections: AiDetection[] = [
  {
    "plate": "KA03AB1234",
    "vehicleType": "2-Wheeler",
    "helmet": false,
    "detectedLiters": 12.5,
    "timestamp": "2025-10-31T10:20:00"
  },
  {
    "plate": "TN10CD5678",
    "vehicleType": "4-Wheeler",
    "helmet": null,
    "detectedLiters": 45.0,
    "timestamp": "2025-10-31T10:22:30"
  },
  {
    "plate": "MH12EF9012",
    "vehicleType": "4-Wheeler",
    "helmet": null,
    "detectedLiters": 30.2,
    "timestamp": "2025-11-01T10:25:10"
  },
  {
    "plate": "DL05GH3456",
    "vehicleType": "2-Wheeler",
    "helmet": true,
    "detectedLiters": 14.8,
    "timestamp": "2025-11-01T10:28:05"
  }
];

export const mockRtoDatabase: Record<string, RtoData> = {
  "KA03AB1234": {
    "owner": "Ravi Kumar",
    "vehicleType": "2-Wheeler",
    "registrationValidTill": "2027-03-30",
    "insuranceStatus": "Active",
    "pollutionValidTill": "2026-02-12",
    "pendingFine": 500,
    "fineReason": "No Helmet",
    "roadTaxStatus": "Paid"
  },
  "TN10CD5678": {
    "owner": "Priya Sharma",
    "vehicleType": "4-Wheeler",
    "registrationValidTill": "2029-11-02",
    "insuranceStatus": "Expired",
    "pollutionValidTill": "2025-08-14",
    "pendingFine": 0,
    "fineReason": "None",
    "roadTaxStatus": "Due"
  },
  "MH12EF9012": {
    "owner": "Amit Patel",
    "vehicleType": "4-Wheeler",
    "registrationValidTill": "2023-12-15",
    "insuranceStatus": "Active",
    "pollutionValidTill": "2025-01-20",
    "pendingFine": 1500,
    "fineReason": "Overspeeding",
    "roadTaxStatus": "Paid"
  },
  "DL05GH3456": {
    "owner": "Sunita Devi",
    "vehicleType": "2-Wheeler",
    "registrationValidTill": "2028-06-10",
    "insuranceStatus": "Active",
    "pollutionValidTill": "2024-07-22",
    "pendingFine": 0,
    "fineReason": "None",
    "roadTaxStatus": "Paid"
  }
};

export const parseTransactions = (fileContent: string): Transaction[] => {
  if (!fileContent || !fileContent.trim()) {
    // Return an empty array instead of throwing an error for empty files.
    return [];
  }
  const lines = fileContent.trim().split('\n');
  if (lines.length < 2) {
    // Also return empty array if there's no data.
    return [];
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const transactions: Transaction[] = [];

  // Map headers to their indices. If a header is not found, its index will be -1.
  const headerMap = {
    timestamp: headers.indexOf('Timestamp'),
    plate: headers.indexOf('Plate'),
    billedLiters: headers.indexOf('Billed_Liters'),
    amount: headers.indexOf('Amount (₹)'),
    stationId: headers.indexOf('Station_ID'),
  };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue; // Skip empty lines
    const values = line.split(',').map(v => v.trim());

    // Basic data integrity check. Warn in console instead of throwing.
    if (values.length > headers.length) {
      console.warn(`Row ${i + 1} has more columns than headers. Data might be misaligned.`);
    }

    // Plate is the most critical piece of info. If it's missing, skip the row.
    const plate = headerMap.plate !== -1 ? values[headerMap.plate] : undefined;
    if (!plate) {
      console.warn(`Skipping row ${i + 1} due to missing 'Plate' information.`);
      continue;
    }

    const billedLitersStr = headerMap.billedLiters !== -1 ? values[headerMap.billedLiters] : '0';
    const billedLitersNum = parseFloat(billedLitersStr);
    if (isNaN(billedLitersNum)) {
        throw new Error(`Invalid data in row ${i + 1}: 'Billed_Liters' is not a valid number ('${billedLitersStr}').`);
    }

    const amountStr = headerMap.amount !== -1 ? values[headerMap.amount] : '0';
    const amountNum = parseFloat(amountStr);
    if (isNaN(amountNum)) {
        throw new Error(`Invalid data in row ${i + 1}: 'Amount (₹)' is not a valid number ('${amountStr}').`);
    }

    const transaction: Transaction = {
      timestamp: headerMap.timestamp !== -1 ? values[headerMap.timestamp] : new Date().toISOString(),
      plate: plate,
      billedLiters: billedLitersNum,
      amount: amountNum,
      stationId: headerMap.stationId !== -1 ? values[headerMap.stationId] : 'N/A',
    };
    
    transactions.push(transaction);
  }
  return transactions;
};


export const getMockTransactionCsv = (): string => {
  return `Timestamp,Plate,Billed_Liters,Amount (₹),Station_ID
2025-10-31T10:20:00,KA03AB1234,15.0,1450.75,FS-01
2025-10-31T10:22:30,TN10CD5678,45.0,4350.95,FS-01
2025-11-01T10:25:10,MH12EF9012,35.0,3450.50,FS-02
2025-11-01T10:28:05,DL05GH3456,15.0,1505.00,FS-01
2025-11-02T11:00:00,KA03AB1234,10.0,980.50,FS-03
2025-11-02T12:15:00,TN10CD5678,20.0,1950.95,FS-02
2025-11-02T14:30:00,TN10CD5678,30.0,2950.95,FS-01
2025-11-03T09:05:00,TN10CD5678,5.0,490.95,FS-04
2025-11-03T13:00:00,TN10CD5678,50.0,4950.95,FS-01
2025-11-04T10:00:00,TN10CD5678,48.0,4700.95,FS-02
2025-11-04T18:20:00,TN10CD5678,22.0,2150.95,FS-03
2025-11-05T11:45:00,TN10CD5678,15.0,1480.95,FS-01
2025-11-06T08:00:00,TN10CD5678,18.0,1780.95,FS-04
2025-11-06T15:00:00,TN10CD5678,33.0,3250.95,FS-02
2025-11-07T12:00:00,TN10CD5678,25.0,2480.95,FS-01
2025-11-08T09:30:00,MH12EF9012,20.0,1980.80,FS-02
`;
}