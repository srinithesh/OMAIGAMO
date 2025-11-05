import { AiDetection, RtoData, Transaction } from '../types';
import { mockAiDetections, mockRtoDatabase, parseTransactions } from './mockData';

const SIMULATED_LATENCY_MS = {
    TRANSACTIONS: 800,
    AI_DETECTIONS: 1200,
    RTO_DATA: 500,
};

/**
 * Simulates fetching and parsing transaction data from an uploaded file.
 * @param logContent The string content of the transaction CSV file.
 * @returns A promise that resolves to an array of Transaction objects.
 */
export const fetchTransactions = (logContent: string): Promise<Transaction[]> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                const transactions = parseTransactions(logContent);
                resolve(transactions);
            } catch (error) {
                reject(error);
            }
        }, SIMULATED_LATENCY_MS.TRANSACTIONS);
    });
};

/**
 * Simulates running a video file through an AI model to get vehicle detections.
 * @param videoFile The video file to be analyzed.
 * @returns A promise that resolves to an array of AiDetection objects.
 */
export const fetchAiDetections = (videoFile: File): Promise<AiDetection[]> => {
    console.log("Simulating AI analysis for video:", videoFile.name);
    return new Promise((resolve) => {
        setTimeout(() => {
            // In a real app, this would involve uploading the file and polling for results.
            // Here, we just return the mock data.
            resolve(mockAiDetections);
        }, SIMULATED_LATENCY_MS.AI_DETECTIONS);
    });
};

/**
 * Simulates fetching RTO (Regional Transport Office) data from a database for a list of plates.
 * @param plates An array of license plate strings.
 * @returns A promise that resolves to a record mapping plate numbers to RtoData.
 */
export const fetchRtoData = (plates: string[]): Promise<Record<string, RtoData>> => {
    console.log("Fetching RTO data for plates:", plates);
    return new Promise((resolve) => {
        setTimeout(() => {
            const results: Record<string, RtoData> = {};
            plates.forEach(plate => {
                if (mockRtoDatabase[plate]) {
                    results[plate] = mockRtoDatabase[plate];
                }
            });
            resolve(results);
        }, SIMULATED_LATENCY_MS.RTO_DATA);
    });
};
