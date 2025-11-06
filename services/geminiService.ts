import { ProcessedVehicleData } from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

/**
 * Gets a compliance summary for a single vehicle by calling the secure backend endpoint.
 * @param vehicleData The data for the vehicle to be summarized.
 * @returns A promise that resolves to the AI-generated summary string.
 */
export async function getComplianceSummary(vehicleData: ProcessedVehicleData): Promise<string> {
    try {
        const response = await fetch(`${API_BASE_URL}/summarize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ vehicleData }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Unknown server error' }));
            throw new Error(errorData.detail || 'Failed to fetch summary from server.');
        }

        const result = await response.json();
        return result.summary;

    } catch (error) {
        console.error("Error calling backend for compliance summary:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        throw new Error(`Failed to generate AI summary: ${errorMessage}`);
    }
}

/**
 * Gets overall fleet suggestions by calling the secure backend endpoint.
 * @param data The entire dataset of processed vehicles.
 * @returns A promise that resolves to the AI-generated suggestions string.
 */
export async function getOverallSuggestions(data: ProcessedVehicleData[]): Promise<string> {
    try {
        const response = await fetch(`${API_BASE_URL}/suggestions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ data }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Unknown server error' }));
            throw new Error(errorData.detail || 'Failed to fetch suggestions from server.');
        }
        
        const result = await response.json();
        return result.suggestions;

    } catch (error) {
        console.error("Error calling backend for overall suggestions:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        throw new Error(`Failed to generate AI suggestions: ${errorMessage}`);
    }
}
