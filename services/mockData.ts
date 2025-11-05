
import { Transaction, AiDetection, RtoData } from '../types';

// This function remains on the frontend to allow the user to generate a mock CSV file
// that can then be uploaded to the backend for processing.
export const getMockTransactionCsv = (): string => {
  return `Timestamp,Plate,Billed_Liters,Amount (?),Station_ID
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

// FIX: Export mockRtoDatabase to resolve import error.
export const mockRtoDatabase: Record<string, RtoData> = {
  'KA03AB1234': {
    owner: 'Ravi Kumar',
    vehicleType: '4-Wheeler',
    registrationValidTill: '2030-05-20',
    insuranceStatus: 'Active',
    pollutionValidTill: '2026-05-20',
    pendingFine: 0,
    fineReason: '',
    roadTaxStatus: 'Paid',
  },
  'TN10CD5678': {
    owner: 'Priya Sharma',
    vehicleType: 'Truck',
    registrationValidTill: '2028-12-15',
    insuranceStatus: 'Expired',
    pollutionValidTill: '2025-12-15',
    pendingFine: 1500,
    fineReason: 'Speeding',
    roadTaxStatus: 'Due',
  },
  'MH12EF9012': {
    owner: 'Amit Patil',
    vehicleType: '2-Wheeler',
    registrationValidTill: '2029-08-01',
    insuranceStatus: 'Active',
    pollutionValidTill: '2025-08-01',
    pendingFine: 0,
    fineReason: '',
    roadTaxStatus: 'Paid',
  },
  'DL05GH3456': {
    owner: 'Sunita Gupta',
    vehicleType: '4-Wheeler',
    registrationValidTill: '2024-01-10', // Expired
    insuranceStatus: 'Active',
    pollutionValidTill: '2026-01-10',
    pendingFine: 500,
    fineReason: 'Parking Violation',
    roadTaxStatus: 'Paid',
  },
};

// FIX: Export mockAiDetections to resolve import error.
export const mockAiDetections: AiDetection[] = [
  { plate: 'KA03AB1234', vehicleType: '4-Wheeler', helmet: null, detectedLiters: 14.9, timestamp: '2025-10-31T10:20:05' },
  { plate: 'TN10CD5678', vehicleType: 'Truck', helmet: null, detectedLiters: 45.2, timestamp: '2025-10-31T10:22:35' },
  { plate: 'MH12EF9012', vehicleType: '2-Wheeler', helmet: false, detectedLiters: 34.5, timestamp: '2025-11-01T10:25:15' },
  { plate: 'DL05GH3456', vehicleType: '4-Wheeler', helmet: null, detectedLiters: 15.0, timestamp: '2025-11-01T10:28:10' },
  { plate: 'KA03AB1234', vehicleType: '4-Wheeler', helmet: null, detectedLiters: 9.8, timestamp: '2025-11-02T11:00:05' },
  { plate: 'TN10CD5678', vehicleType: 'Truck', helmet: null, detectedLiters: 20.0, timestamp: '2025-11-02T12:15:05' },
  { plate: 'TN10CD5678', vehicleType: 'Truck', helmet: null, detectedLiters: 29.5, timestamp: '2025-11-02T14:30:05' },
  { plate: 'TN10CD5678', vehicleType: 'Truck', helmet: null, detectedLiters: 5.1, timestamp: '2025-11-03T09:05:05' },
  { plate: 'TN10CD5678', vehicleType: 'Truck', helmet: null, detectedLiters: 50.0, timestamp: '2025-11-03T13:00:05' },
  { plate: 'TN10CD5678', vehicleType: 'Truck', helmet: null, detectedLiters: 48.3, timestamp: '2025-11-04T10:00:05' },
  { plate: 'TN10CD5678', vehicleType: 'Truck', helmet: null, detectedLiters: 22.0, timestamp: '2025-11-04T18:20:05' },
  { plate: 'TN10CD5678', vehicleType: 'Truck', helmet: null, detectedLiters: 14.8, timestamp: '2025-11-05T11:45:05' },
  { plate: 'TN10CD5678', vehicleType: 'Truck', helmet: null, detectedLiters: 18.0, timestamp: '2025-11-06T08:00:05' },
  { plate: 'TN10CD5678', vehicleType: 'Truck', helmet: null, detectedLiters: 33.3, timestamp: '2025-11-06T15:00:05' },
  { plate: 'TN10CD5678', vehicleType: 'Truck', helmet: null, detectedLiters: 24.9, timestamp: '2025-11-07T12:00:05' },
  { plate: 'MH12EF9012', vehicleType: '2-Wheeler', helmet: true, detectedLiters: 20.1, timestamp: '2025-11-08T09:30:05' },
];

// FIX: Export parseTransactions function to resolve import error.
export const parseTransactions = (csvContent: string): Transaction[] => {
  const lines = csvContent.trim().split('\n');
  const headerLine = lines.shift();
  if (!headerLine) {
    throw new Error('Invalid CSV: Missing header');
  }
  const header = headerLine.split(',');

  // Find column indices
  const timestampIndex = header.findIndex(h => h.trim() === 'Timestamp');
  const plateIndex = header.findIndex(h => h.trim() === 'Plate');
  const billedLitersIndex = header.findIndex(h => h.trim() === 'Billed_Liters');
  const amountIndex = header.findIndex(h => h.trim().startsWith('Amount'));
  const stationIdIndex = header.findIndex(h => h.trim() === 'Station_ID');

  if ([timestampIndex, plateIndex, billedLitersIndex, amountIndex, stationIdIndex].some(i => i === -1)) {
    throw new Error('Invalid CSV: Missing required columns (Timestamp, Plate, Billed_Liters, Amount, Station_ID)');
  }

  return lines.map(line => {
    const values = line.split(',');
    return {
      timestamp: values[timestampIndex].trim(),
      plate: values[plateIndex].trim(),
      billedLiters: parseFloat(values[billedLitersIndex]),
      amount: parseFloat(values[amountIndex]),
      stationId: values[stationIdIndex].trim(),
    };
  });
};
