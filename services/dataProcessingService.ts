
import { ProcessedVehicleData, RtoData, Transaction, AiDetection } from '../types';

/**
 * A centralized function to calculate the compliance score and status for a vehicle transaction.
 * This ensures consistent logic across the entire application (batch, live, and refresh).
 * This function is kept on the frontend to support the "Refresh Data" feature simulation.
 * The backend has a Python equivalent of this function for the main analysis pipeline.
 * @param data - An object containing all necessary data for a single vehicle transaction.
 * @returns An object with the calculated compliance details.
 */
export const calculateCompliance = (
    data: {
        plate: string;
        rto: RtoData;
        fueling: ProcessedVehicleData['fueling'];
        helmet: boolean | null;
        vehicleType: ProcessedVehicleData['vehicleType'];
    }
): ProcessedVehicleData['compliance'] => {
    let score = 100;
    const overallStatus: string[] = [];
    
    const { rto, plate, fueling, vehicleType, helmet } = data;

    const isRegValid = new Date(rto.registrationValidTill || 0) > new Date();
    const isPucValid = new Date(rto.pollutionValidTill || 0) > new Date();
    
    if (!isRegValid) { score -= 20; overallStatus.push(`Reg Expired for ${plate}`); }
    if (rto.insuranceStatus !== 'Active') { score -= 20; overallStatus.push(`Insurance Expired for ${plate}`); }
    if (!isPucValid) { score -= 20; overallStatus.push(`PUC Expired for ${plate}`); }
    // FIX: Correct currency symbol from '?' to '₹'.
    if (rto.pendingFine > 0) { score -= 20; overallStatus.push(`Fine Pending: ₹${rto.pendingFine} on ${plate}`); }
    if (rto.roadTaxStatus !== 'Paid') { score -= 20; overallStatus.push(`Tax Due for ${plate}`); }
    if (fueling.discrepancyFlag !== 'OK') { score -= 20; overallStatus.push(`Fueling Discrepancy on ${plate}`); }
    if (vehicleType === '2-Wheeler' && helmet === false) {
        // No score penalty per original logic, but it is a tracked violation
        overallStatus.push(`No Helmet on ${plate}`);
    }

    return {
        score: Math.max(0, score),
        overallStatus,
        // FIX: Correct currency symbol from '?' to '₹'.
        fineStatus: rto.pendingFine > 0 ? `₹${rto.pendingFine}` : 'OK',
        insuranceStatus: rto.insuranceStatus || 'Expired',
        pucStatus: isPucValid ? 'Valid' : 'Expired',
        taxStatus: rto.roadTaxStatus || 'Due',
        registrationStatus: isRegValid ? 'Valid' : 'Expired',
    };
};

/**
 * Processes live data from a simulated detection into a ProcessedVehicleData object.
 * This function is used by the LiveAnalysisView.
 * @param transaction - The simulated transaction data.
 * @param detection - The simulated AI detection data.
 * @param rto - The RTO data for the detected vehicle.
 * @returns A complete ProcessedVehicleData object.
 */
// FIX: Add and export processLiveData function to resolve import error.
export const processLiveData = (
    transaction: Transaction,
    detection: AiDetection,
    rto: RtoData
): ProcessedVehicleData => {
    const billed = transaction.billedLiters;
    const detected = detection.detectedLiters;
    const difference = billed - detected;
    const amount = transaction.amount;
    const microBalance = amount - Math.floor(amount);

    let discrepancyFlag: ProcessedVehicleData['fueling']['discrepancyFlag'] = 'OK';
    if (Math.abs(difference) > 2) { // More than 2L is a station fault
        discrepancyFlag = 'Potential Station Fault';
    } else if (Math.abs(difference) > 0.5) { // 0.5L to 2L is suspicious
        discrepancyFlag = 'Suspicious';
    }
    
    const fueling = {
        billed,
        detected,
        difference,
        discrepancyFlag,
        microBalance: microBalance > 0.01 ? microBalance : 0,
    };
    
    const compliance = calculateCompliance({
        plate: transaction.plate,
        rto,
        fueling,
        helmet: detection.helmet,
        vehicleType: detection.vehicleType,
    });
    
    return {
        plate: transaction.plate,
        vehicleType: detection.vehicleType,
        helmet: detection.helmet,
        timestamp: transaction.timestamp,
        rto,
        fueling,
        amount,
        compliance,
    };
};
