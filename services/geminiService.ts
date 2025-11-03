import { ProcessedVehicleData } from '../types';

export async function getComplianceSummary(vehicleData: ProcessedVehicleData): Promise<string> {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const model = 'gemini-2.5-flash';
    const { rto, compliance, fueling, helmet, vehicleType } = vehicleData;

    // Create a simplified object for the prompt
    const promptData = {
        plate: vehicleData.plate,
        vehicleType,
        helmet: helmet === null ? 'N/A' : helmet ? 'Worn' : 'Not Worn',
        complianceIssues: compliance.overallStatus,
        rtoDetails: {
            registration: compliance.registrationStatus,
            insurance: compliance.insuranceStatus,
            puc: compliance.pucStatus,
            tax: compliance.taxStatus,
            fine: rto.pendingFine > 0 ? `₹${rto.pendingFine} for ${rto.fineReason}` : 'None',
        },
        fuelingCheck: {
            status: fueling.discrepancyFlag,
            discrepancy: fueling.difference.toFixed(2) + ' L'
        }
    };

    const prompt = `
        You are an AI Vehicle Compliance Specialist for a futuristic transit network.
        Your task is to analyze the provided vehicle data and generate a concise, human-readable compliance summary, following strict NASA-style brevity.

        Rules:
        - Start with the vehicle's designation (plate number).
        - Use bullet points for clarity.
        - Report ONLY on anomalies, violations, or warnings.
        - If there are no issues, the only acceptable response is "All systems nominal. Full compliance achieved."
        - Keep the summary brief and technical.

        Here is the data for the vehicle:
        ${JSON.stringify(promptData, null, 2)}

        Generate the compliance summary now.
    `;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error calling Gemini API for compliance summary:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        throw new Error(`Failed to generate AI summary: ${errorMessage}`);
    }
}


export async function getOverallSuggestions(data: ProcessedVehicleData[]): Promise<string> {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const model = 'gemini-2.5-flash';

    const totalVehicles = data.length;
    const overallScore = data.reduce((acc, v) => acc + v.compliance.score, 0) / (totalVehicles || 1);
    
    // Improved aggregation logic to correctly group violation types
    const violationCounts = data.flatMap(v => v.compliance.overallStatus).reduce((acc, status) => {
        const key = status.split(' on ')[0].split(' for ')[0].split(':')[0].trim();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const summary = {
        totalVehicles,
        averageComplianceScore: overallScore.toFixed(2),
        violationSummary: violationCounts,
        fuelingDiscrepancies: data.filter(v => v.fueling.discrepancyFlag !== 'OK').length,
    };

    const prompt = `
        You are a seasoned Fleet Compliance Manager AI, tasked with providing strategic advice to improve a vehicle fleet's operational standards.
        Based on the following compliance data summary, generate a set of actionable recommendations.

        Rules:
        - Provide a brief, high-level overview of the fleet's current status.
        - Pay close attention to the \`violationSummary\` which details the frequency of each type of violation.
        - Prioritize your recommendations to address the most common issues first, making your advice data-driven.
        - Structure your recommendations under three distinct headings: "Immediate Actions", "Policy Recommendations", and "Potential Risks".
        - Use bullet points for each recommendation.
        - Ensure the tone is professional, authoritative, and helpful.

        Fleet Compliance Data:
        ${JSON.stringify(summary, null, 2)}

        Generate your strategic recommendations now.
    `;
    
     try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error calling Gemini API for overall suggestions:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        throw new Error(`Failed to generate AI suggestions: ${errorMessage}`);
    }
}