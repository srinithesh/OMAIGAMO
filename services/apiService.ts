import { AiDetection, RtoData, Transaction } from '../types';
import { mockAiDetections, mockRtoDatabase, parseTransactions } from './mockData';

interface AnalysisResponse {
    transactions: Transaction[];
    aiDetections: AiDetection[];
    rtoData: Record<string, RtoData>;
}

/**
 * Processes the analysis data locally without a backend server.
 * @param yoloModelFile The YOLO model file (ignored in this mock version).
 * @param videoFile The video file (ignored in this mock version).
 * @param transactionLog The string content of the transaction CSV file.
 * @returns A promise that resolves to the complete analysis data.
 */
export const startAnalysis = async (
    yoloModelFile: File, // parameter is kept for function signature consistency
    videoFile: File,     // parameter is kept for function signature consistency
    transactionLog: string
): Promise<AnalysisResponse> => {
    console.log("Starting local analysis... No backend required.");

    try {
        // 1. Parse the transaction log from the provided string content.
        const transactions = parseTransactions(transactionLog);
        
        // 2. Get the mock AI and RTO data from the mockData service.
        const aiDetections = mockAiDetections;
        const rtoData = mockRtoDatabase;

        // Simulate a short processing time to make the loading animation feel natural.
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log("Local analysis successful.");

        // 3. Return the data in the same format the backend would have.
        return {
            transactions,
            aiDetections,
            rtoData,
        };

    } catch (error) {
        console.error("Failed to process data locally:", error);
        // Re-throw the error so the UI can catch it and display a helpful message.
        if (error instanceof Error) {
            throw new Error(`Error parsing transaction log: ${error.message}`);
        }
        throw new Error('An unexpected error occurred during local data processing.');
    }
};
