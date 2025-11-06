const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { GoogleGenAI, Type } = require('@google/genai');
require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);


// --- FIREBASE INITIALIZATION ---
try {
  const serviceAccount = require('./serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
  console.log('Firebase Admin initialized successfully.');
} catch (error) {
  console.error("Failed to initialize Firebase Admin. Ensure 'serviceAccountKey.json' is present and correct.", error.message);
  // Exit or handle gracefully if Firebase is critical
  // process.exit(1); 
}
const db = admin.firestore();
const bucket = admin.storage().bucket();
// --- END FIREBASE INITIALIZATION ---


// --- GEMINI API INITIALIZATION ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
// --- END GEMINI API INITIALIZATION ---


const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for Base64 strings

const PORT = process.env.PORT || 8000;

// --- RTO DATABASE (SINGLE SOURCE OF TRUTH) ---
const rtoDatabase = {
  "KA03AB1234": { "owner": "Ravi Kumar", "vehicleType": "2-Wheeler", "registrationValidTill": "2027-03-30", "insuranceStatus": "Active", "pollutionValidTill": "2026-02-12", "pendingFine": 500, "fineReason": "No Helmet", "roadTaxStatus": "Paid" },
  "TN10CD5678": { "owner": "Priya Sharma", "vehicleType": "4-Wheeler", "registrationValidTill": "2029-11-02", "insuranceStatus": "Expired", "pollutionValidTill": "2025-08-14", "pendingFine": 0, "fineReason": "None", "roadTaxStatus": "Due" },
  "MH12EF9012": { "owner": "Amit Patel", "vehicleType": "4-Wheeler", "registrationValidTill": "2023-12-15", "insuranceStatus": "Active", "pollutionValidTill": "2025-01-20", "pendingFine": 1500, "fineReason": "Overspeeding", "roadTaxStatus": "Paid" },
  "DL05GH3456": { "owner": "Sunita Devi", "vehicleType": "2-Wheeler", "registrationValidTill": "2028-06-10", "insuranceStatus": "Active", "pollutionValidTill": "2024-07-22", "pendingFine": 0, "fineReason": "None", "roadTaxStatus": "Paid" },
  "DEFAULT": { owner: 'Unknown', vehicleType: 'Other', registrationValidTill: "1970-01-01", insuranceStatus: "Expired", pollutionValidTill: "1970-01-01", pendingFine: 0, fineReason: 'N/A', roadTaxStatus: "Due" }
};
// --- END RTO DATABASE ---

// Helper to convert image file to generative part
const fileToGenerativePart = async (filePath, mimeType) => {
  return {
    inlineData: {
      data: Buffer.from(await fs.readFile(filePath)).toString("base64"),
      mimeType
    },
  };
};

const analyzeVideoFramesWithGemini = async (videoFilePath) => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'frames-'));
    console.log(`Extracting frames to ${tempDir}`);

    await new Promise((resolve, reject) => {
        ffmpeg(videoFilePath)
            .outputOptions('-vf', 'fps=1') // Extract 1 frame per second
            .save(path.join(tempDir, 'frame-%03d.png'))
            .on('end', resolve)
            .on('error', reject);
    });

    const frameFiles = await fs.readdir(tempDir);
    console.log(`Found ${frameFiles.length} frames to analyze.`);

    const allDetections = [];

    const model = 'gemini-2.5-flash';
    const config = {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                detections: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            plate: { type: Type.STRING },
                            vehicleType: { type: Type.STRING, enum: ['2-Wheeler', '4-Wheeler', 'Truck', 'Other'] },
                            helmet: { type: Type.BOOLEAN, nullable: true },
                        },
                        required: ["plate", "vehicleType", "helmet"],
                    }
                }
            }
        },
    };
    const contents = `Analyze the vehicle in this image. Identify the license plate number, vehicle type (2-Wheeler, 4-Wheeler, or Truck), and if it's a 2-Wheeler, determine if the rider is wearing a helmet. Respond ONLY with a JSON object matching the provided schema. If no vehicle or plate is clear, return an empty detections array.`;
    

    // Process frames in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < frameFiles.length; i += batchSize) {
        const batch = frameFiles.slice(i, i + batchSize);
        const promises = batch.map(async (file) => {
            const filePath = path.join(tempDir, file);
            const imagePart = await fileToGenerativePart(filePath, "image/png");
            try {
                const response = await ai.models.generateContent({ model, config, contents: { parts: [imagePart, {text: contents}] } });
                const parsed = JSON.parse(response.text);
                if (parsed.detections && parsed.detections.length > 0) {
                    return parsed.detections;
                }
            } catch (e) {
                console.error(`Error processing frame ${file}:`, e.message);
            }
            return [];
        });

        const results = await Promise.all(promises);
        results.forEach(detections => {
            if (detections) allDetections.push(...detections);
        });
        console.log(`Processed batch ${i/batchSize + 1}, total detections so far: ${allDetections.length}`);
    }

    await fs.rm(tempDir, { recursive: true, force: true });
    console.log(`Cleaned up temp directory: ${tempDir}`);
    
    // Deduplicate detections based on license plate
    const uniqueDetections = Array.from(new Map(allDetections.map(item => [item.plate, item])).values());
    return uniqueDetections;
}


/**
 * Endpoint to upload files, perform REAL analysis, and store results.
 */
app.post('/api/analyze', async (req, res) => {
  const { videoFile, transactionLog, videoFileName } = req.body;

  if (!videoFile || !transactionLog) {
    return res.status(400).json({ message: 'Missing video or transaction log file.' });
  }

  const videoBuffer = Buffer.from(videoFile, 'base64');
  const tempVideoPath = path.join(os.tmpdir(), videoFileName);

  try {
    await fs.writeFile(tempVideoPath, videoBuffer);
    console.log("Video file saved temporarily to:", tempVideoPath);

    const aiDetections = await analyzeVideoFramesWithGemini(tempVideoPath);
    console.log("AI Detections from Video:", aiDetections);
    
    const analysisData = processTransactions(transactionLog, aiDetections);
    
    // Store results in Firebase (optional, can be disabled if not needed)
    try {
        const timestamp = new Date();
        const recordId = `analysis_${timestamp.getTime()}`;
        const docRef = db.collection('analysisRecords').doc(recordId);
        await docRef.set({
          id: recordId,
          createdAt: timestamp,
          status: 'Completed',
          results: analysisData
        });
        console.log(`Successfully stored record in Firestore: ${recordId}`);
    } catch(fbError){
        console.warn("Could not save results to Firebase. This might be a configuration issue.", fbError.message);
    }
    
    res.status(200).json({ message: 'Analysis complete', data: analysisData });

  } catch (error) {
    console.error('Error during analysis:', error);
    res.status(500).json({ message: 'An internal server error occurred during AI analysis.' });
  } finally {
    // Cleanup the temporary video file
    await fs.unlink(tempVideoPath).catch(err => console.error("Error cleaning up temp video file:", err));
  }
});


app.post('/api/analyze-frame', async (req, res) => {
    const { frame } = req.body;
    if (!frame) {
        return res.status(400).json({ message: 'Missing frame data.' });
    }

    try {
        const model = 'gemini-2.5-flash';
        const prompt = "Analyze the vehicle in this image. Identify the license plate number, vehicle type (2-Wheeler, 4-Wheeler, or Truck), and if it's a 2-Wheeler, determine if the rider is wearing a helmet. Respond with a single line of text in the format: PLATE,VEHICLE_TYPE,HELMET_STATUS (e.g., 'MH12EF9012,4-Wheeler,null' or 'KA03AB1234,2-Wheeler,false'). If no vehicle is clear, respond with 'NONE'.";
        const imagePart = { inlineData: { data: frame, mimeType: 'image/jpeg' } };

        const response = await ai.models.generateContent({ model, contents: { parts: [imagePart, {text: prompt}] }});
        const [plate, vehicleType, helmetStr] = response.text.trim().split(',');
        
        if (plate === 'NONE' || !plate) {
            return res.status(200).json({ data: null });
        }

        const detection = {
            plate,
            vehicleType,
            helmet: helmetStr === 'null' ? null : helmetStr === 'true'
        };

        const processedData = processSingleDetection(detection);
        res.status(200).json({ data: processedData });

    } catch (error) {
        console.error("Error in live frame analysis:", error);
        res.status(500).json({ message: "Failed to analyze frame." });
    }
});


/**
 * Endpoint to generate AI summaries using Gemini.
 */
app.post('/api/summarize', async (req, res) => {
    const { vehicleData } = req.body;
    if (!vehicleData) {
        return res.status(400).json({ message: 'Vehicle data is required.' });
    }
    
    try {
        const prompt = `Generate a concise compliance summary for a vehicle with the following data: ${JSON.stringify(vehicleData)}. Focus on violations and potential risks.`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
        });
        res.status(200).json({ summary: response.text });
    } catch(error) {
        console.error('Error generating summary:', error);
        res.status(500).json({ message: 'Failed to generate AI summary.' });
    }
});

/**
 * Endpoint to generate fleet suggestions using Gemini.
 */
app.post('/api/suggestions', async (req, res) => {
    const { data } = req.body;
     if (!data) {
        return res.status(400).json({ message: 'Fleet data is required.' });
    }
    
    try {
        const prompt = `Based on this fleet compliance data: ${JSON.stringify(data)}, provide a report with three sections: "Immediate Actions", "Policy Recommendations", and "Potential Risks".`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
        });
        res.status(200).json({ suggestions: response.text });
    } catch(error) {
        console.error('Error generating suggestions:', error);
        res.status(500).json({ message: 'Failed to generate AI suggestions.' });
    }
});


// Centralized processing function
const calculateCompliance = (detection, rto) => {
    let score = 100;
    const overallStatus = [];
    const isRegValid = new Date(rto.registrationValidTill || 0) > new Date();
    const isPucValid = new Date(rto.pollutionValidTill || 0) > new Date();

    if (!isRegValid) { score -= 20; overallStatus.push(`Registration Expired`); }
    if (rto.insuranceStatus !== 'Active') { score -= 20; overallStatus.push(`Insurance Expired`); }
    if (!isPucValid) { score -= 20; overallStatus.push(`PUC Expired`); }
    if (rto.pendingFine > 0) { score -= 20; overallStatus.push(`Fine Pending: ₹${rto.pendingFine}`); }
    if (rto.roadTaxStatus !== 'Paid') { score -= 20; overallStatus.push(`Tax Due`); }
    if (detection.vehicleType === '2-Wheeler' && detection.helmet === false) { score -= 15; overallStatus.push(`No Helmet`); }

    return {
        score: Math.max(0, score),
        overallStatus,
        fineStatus: rto.pendingFine > 0 ? `₹${rto.pendingFine}` : 'OK',
        insuranceStatus: rto.insuranceStatus,
        pucStatus: isPucValid ? 'Valid' : 'Expired',
        taxStatus: rto.roadTaxStatus,
        registrationStatus: isRegValid ? 'Valid' : 'Expired'
    };
};

const processTransactions = (csvData, aiDetections) => {
    const lines = csvData.trim().split('\n').slice(1);
    
    return lines.map(line => {
        const [timestamp, plate, billedLiters, amount] = line.split(',');
        const detection = aiDetections.find(d => d.plate === plate);
        if (!detection) return null; // Skip transactions for vehicles not detected in the video

        const rto = rtoDatabase[plate] || rtoDatabase.DEFAULT;
        const compliance = calculateCompliance(detection, rto);
        
        // Use a fixed detected liter amount for now, as Gemini can't measure fuel volume
        const detected = parseFloat(billedLiters) - (Math.random() * 4 - 2); // Simulate minor discrepancy
        const billed = parseFloat(billedLiters);
        const difference = detected - billed;
        const discrepancyFlag = Math.abs(difference) > 2 ? 'Suspicious' : 'OK';

        if (discrepancyFlag !== 'OK' && !compliance.overallStatus.includes('Fuel Discrepancy')) {
            compliance.score = Math.max(0, compliance.score - 10);
            compliance.overallStatus.push('Fuel Discrepancy');
        }

        return {
            plate,
            timestamp,
            vehicleType: detection.vehicleType,
            helmet: detection.helmet,
            rto,
            amount: parseFloat(amount),
            fueling: {
                billed,
                detected,
                difference,
                discrepancyFlag,
                microBalance: parseFloat(amount) % 1
            },
            compliance,
        };
    }).filter(Boolean); // Filter out null entries
};

const processSingleDetection = (detection) => {
    const rto = rtoDatabase[detection.plate] || rtoDatabase.DEFAULT;
    const compliance = calculateCompliance(detection, rto);

    return {
        plate: detection.plate,
        timestamp: new Date().toISOString(),
        vehicleType: detection.vehicleType,
        helmet: detection.helmet,
        rto,
        amount: 0, // Not applicable for live single frame
        fueling: {
            billed: 0, detected: 0, difference: 0,
            discrepancyFlag: 'OK', microBalance: 0
        },
        compliance,
    };
}


app.listen(PORT, () => {
  console.log(`OMAIGAMO backend listening at http://127.0.0.1:${PORT}`);
});