import { ProcessedVehicleData } from '../types';

// Helper function to convert a file to a Base64 string
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            // result is "data:mime/type;base64,the_base_64_string"
            // We only want the base64 part
            const base64String = (reader.result as string).split(',')[1];
            resolve(base64String);
        };
        reader.onerror = error => reject(error);
    });
};

/**
 * Starts the analysis by sending files to the backend server.
 * This is a true full-stack implementation.
 * @param videoFile The video file.
 * @param transactionLog The string content of the transaction CSV file.
 * @returns A promise that resolves to the processed vehicle data from the backend.
 */
export const startAnalysis = async (
    videoFile: File,
    transactionLog: string
): Promise<ProcessedVehicleData[]> => {
    const apiEndpoint = 'http://127.0.0.1:8000/api/analyze';

    try {
        // Convert video file to Base64 to send as JSON
        const videoBase64 = await fileToBase64(videoFile);

        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                videoFile: videoBase64,
                transactionLog: transactionLog,
                videoFileName: videoFile.name,
            }),
        });

        if (!response.ok) {
            // Try to parse a JSON error message from the backend
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(`API Error: ${errorData.message || 'An unknown error occurred on the server.'}`);
        }

        const result = await response.json();
        return result.data;
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
             throw new Error("Network Error: Could not connect to the analysis server. Please ensure the backend is running and accessible at http://127.0.0.1:8000/api/analyze");
        }
        // Re-throw other errors (like the API error from above)
        throw error;
    }
};

/**
 * Sends a single frame to the backend for live analysis.
 * @param frameData The Base64 encoded string of the video frame.
 * @returns A promise that resolves to the processed data for a single detected vehicle.
 */
export const analyzeLiveFrame = async (frameData: string): Promise<ProcessedVehicleData | null> => {
    const apiEndpoint = 'http://127.0.0.1:8000/api/analyze-frame';
     try {
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                frame: frameData,
            }),
        });

        if (!response.ok) {
            console.error("Live analysis API error:", response.statusText);
            return null;
        }

        const result = await response.json();
        return result.data;
    } catch (error) {
        console.error("Failed to send frame for analysis:", error);
        return null;
    }
};