import { ProcessedVehicleData } from '../types';

// The entire code from 'analysis.worker.ts' is now inlined here as a string.
const workerCode = `
// All data and logic is now self-contained in this worker to simulate a backend.

// --- MOCK DATA ---
const mockAiDetections = [
  { "plate": "KA03AB1234", "vehicleType": "2-Wheeler", "helmet": false, "detectedLiters": 12.5, "timestamp": "2025-10-31T10:20:00" },
  { "plate": "TN10CD5678", "vehicleType": "4-Wheeler", "helmet": null, "detectedLiters": 45.0, "timestamp": "2025-10-31T10:22:30" },
  { "plate": "MH12EF9012", "vehicleType": "4-Wheeler", "helmet": null, "detectedLiters": 30.2, "timestamp": "2025-11-01T10:25:10" },
  { "plate": "DL05GH3456", "vehicleType": "2-Wheeler", "helmet": true, "detectedLiters": 14.8, "timestamp": "2025-11-01T10:28:05" }
];

const mockRtoDatabase = {
  "KA03AB1234": { "owner": "Ravi Kumar", "vehicleType": "2-Wheeler", "registrationValidTill": "2027-03-30", "insuranceStatus": "Active", "pollutionValidTill": "2026-02-12", "pendingFine": 500, "fineReason": "No Helmet", "roadTaxStatus": "Paid" },
  "TN10CD5678": { "owner": "Priya Sharma", "vehicleType": "4-Wheeler", "registrationValidTill": "2029-11-02", "insuranceStatus": "Expired", "pollutionValidTill": "2025-08-14", "pendingFine": 0, "fineReason": "None", "roadTaxStatus": "Due" },
  "MH12EF9012": { "owner": "Amit Patel", "vehicleType": "4-Wheeler", "registrationValidTill": "2023-12-15", "insuranceStatus": "Active", "pollutionValidTill": "2025-01-20", "pendingFine": 1500, "fineReason": "Overspeeding", "roadTaxStatus": "Paid" },
  "DL05GH3456": { "owner": "Sunita Devi", "vehicleType": "2-Wheeler", "registrationValidTill": "2028-06-10", "insuranceStatus": "Active", "pollutionValidTill": "2024-07-22", "pendingFine": 0, "fineReason": "None", "roadTaxStatus": "Paid" }
};

// --- PARSING LOGIC ---
const parseTransactions = (fileContent) => {
  if (!fileContent || !fileContent.trim()) return [];
  const lines = fileContent.trim().split('\\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const transactions = [];

  const headerMap = {
    timestamp: headers.indexOf('Timestamp'),
    plate: headers.indexOf('Plate'),
    billedLiters: headers.indexOf('Billed_Liters'),
    amount: headers.indexOf('Amount (₹)'),
    stationId: headers.indexOf('Station_ID'),
  };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const values = line.split(',').map(v => v.trim());

    if (values.length > headers.length) console.warn(\`Row \${i + 1} has more columns than headers.\`);

    const plate = headerMap.plate !== -1 ? values[headerMap.plate] : undefined;
    if (!plate) {
      console.warn(\`Skipping row \${i + 1} due to missing 'Plate' information.\`);
      continue;
    }

    const billedLitersStr = headerMap.billedLiters !== -1 ? values[headerMap.billedLiters] : '0';
    const billedLitersNum = parseFloat(billedLitersStr);
    if (isNaN(billedLitersNum)) throw new Error(\`Invalid data in row \${i + 1}: 'Billed_Liters' is not a valid number ('\${billedLitersStr}').\`);

    const amountStr = headerMap.amount !== -1 ? values[headerMap.amount] : '0';
    const amountNum = parseFloat(amountStr);
    if (isNaN(amountNum)) throw new Error(\`Invalid data in row \${i + 1}: 'Amount (₹)' is not a valid number ('\${amountStr}').\`);

    const transaction = {
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

// --- PROCESSING LOGIC ---
const processData = (transactions, aiDetections, rtoDatabase) => {
    const discrepancyCounts = {};
    const suspiciousSessions = new Set();
    
    transactions.forEach(tx => {
        const detection = aiDetections.find(d => d.plate === tx.plate);
        if (detection) {
            const difference = tx.billedLiters - detection.detectedLiters;
            const absDifference = Math.abs(difference);
            const percentageDifference = tx.billedLiters > 0.1 ? (absDifference / tx.billedLiters) * 100 : 0;
            const isSuspicious = absDifference > 5.0 || (percentageDifference > 10 && absDifference > 1.0);
            
            if (isSuspicious) {
                suspiciousSessions.add(tx.plate);
                discrepancyCounts[tx.stationId] = (discrepancyCounts[tx.stationId] || 0) + 1;
            }
        }
    });

    return transactions.map(tx => {
        const detection = aiDetections.find(d => d.plate === tx.plate) || {};
        const rto = rtoDatabase[tx.plate] || {};

        const difference = tx.billedLiters - (detection.detectedLiters || tx.billedLiters);
        let discrepancyFlag = 'OK';
        
        if (suspiciousSessions.has(tx.plate)) {
            if (discrepancyCounts[tx.stationId] >= 3) {
                discrepancyFlag = 'Potential Station Fault';
            } else {
                discrepancyFlag = 'Suspicious';
            }
        }
        
        let score = 100;
        const overallStatus = [];
        
        const isRegValid = new Date(rto.registrationValidTill || 0) > new Date();
        const isPucValid = new Date(rto.pollutionValidTill || 0) > new Date();
        
        if (!isRegValid) { score -= 20; overallStatus.push(\`Reg Expired for \${tx.plate}\`); }
        if (rto.insuranceStatus !== 'Active') { score -= 20; overallStatus.push(\`Insurance Expired for \${tx.plate}\`); }
        if (!isPucValid) { score -= 20; overallStatus.push(\`PUC Expired for \${tx.plate}\`); }
        if (rto.pendingFine > 0) { score -= 20; overallStatus.push(\`Fine Pending: ₹\${rto.pendingFine} on \${tx.plate}\`); }
        if (rto.roadTaxStatus !== 'Paid') { score -= 20; overallStatus.push(\`Tax Due for \${tx.plate}\`); }
        if (discrepancyFlag !== 'OK') { score -= 20; overallStatus.push(\`Fueling Discrepancy on \${tx.plate}\`); }
        if (detection.vehicleType === '2-Wheeler' && detection.helmet === false) {
            overallStatus.push(\`No Helmet on \${tx.plate}\`);
        }
        
        return {
            plate: tx.plate,
            vehicleType: detection.vehicleType || 'Other',
            helmet: detection.helmet === undefined ? null : detection.helmet,
            timestamp: tx.timestamp,
            rto: rto,
            amount: tx.amount,
            fueling: {
                billed: tx.billedLiters,
                detected: detection.detectedLiters || tx.billedLiters,
                difference,
                discrepancyFlag,
                microBalance: tx.amount > 0 ? tx.amount - Math.floor(tx.amount) : 0,
            },
            compliance: {
                score: Math.max(0, score),
                fineStatus: rto.pendingFine > 0 ? \`₹\${rto.pendingFine}\` : 'OK',
                insuranceStatus: rto.insuranceStatus || 'Expired',
                pucStatus: isPucValid ? 'Valid' : 'Expired',
                taxStatus: rto.roadTaxStatus || 'Due',
                registrationStatus: isRegValid ? 'Valid' : 'Expired',
                overallStatus,
            }
        };
    });
};

// --- WORKER MESSAGE HANDLER ---
self.onmessage = (event) => {
    try {
        const transactionLog = event.data;
        const transactions = parseTransactions(transactionLog);
        const processedData = processData(transactions, mockAiDetections, mockRtoDatabase);
        
        self.postMessage({ success: true, data: processedData });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred in the analysis worker.";
        self.postMessage({ success: false, error: errorMessage });
    }
};
`;

/**
 * Starts the analysis using an in-browser Web Worker to simulate a backend.
 * This avoids the need for a separate server process and eliminates network errors.
 * It sends the transaction log to the worker and returns a promise that
 * resolves with the processed data.
 * @param _yoloModelFile The YOLO model file (no longer used, kept for signature).
 * @param _videoFile The video file (no longer used, kept for signature).
 * @param transactionLog The string content of the transaction CSV file.
 * @returns A promise that resolves to the processed vehicle data.
 */
export const startAnalysis = (
    _yoloModelFile: File,
    _videoFile: File,
    transactionLog: string
): Promise<ProcessedVehicleData[]> => {
    console.log("Starting in-browser analysis via self-contained Web Worker...");

    return new Promise((resolve, reject) => {
        // Create a Blob from the worker code string.
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        // Create a URL for the Blob. This URL is from the same origin.
        const workerUrl = URL.createObjectURL(blob);
        // Create the worker using the Blob URL.
        const worker = new Worker(workerUrl);

        worker.onmessage = (event: MessageEvent<{ success: boolean; data?: ProcessedVehicleData[]; error?: string }>) => {
            if (event.data.success) {
                console.log("Analysis complete. Received data from worker.");
                resolve(event.data.data!);
            } else {
                console.error("Worker returned an error:", event.data.error);
                reject(new Error(event.data.error || 'An unknown error occurred in the analysis worker.'));
            }
            // Clean up the Blob URL and terminate the worker
            URL.revokeObjectURL(workerUrl);
            worker.terminate();
        };

        worker.onerror = (error) => {
            console.error("An error occurred in the analysis worker:", error);
            reject(new Error(`Worker error: ${error.message}`));
            // Clean up the Blob URL and terminate the worker
            URL.revokeObjectURL(workerUrl);
            worker.terminate();
        };

        // Send the transaction log to the worker to start processing.
        worker.postMessage(transactionLog);
    });
};