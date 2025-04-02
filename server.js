require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const fs = require('fs').promises;
const Tesseract = require('tesseract.js');
const { fromPath } = require('pdf2pic');

const app = express();
const PORT = process.env.PDF_PORT || 4000;

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.stack);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Configure CORS
const corsOptions = {
  origin: '*',
  methods: ['POST'],
  allowedHeaders: ['Content-Type'],
};
app.use(cors(corsOptions));
app.use(express.json());

// Configure file upload with multer
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are allowed'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Ensure uploads directory exists
const ensureUploadsDir = async () => {
  try {
    await fs.mkdir('uploads', { recursive: true });
  } catch (error) {
    console.error('Error creating uploads directory:', error);
  }
};
ensureUploadsDir();

// Function to extract text from PDF
async function extractTextFromPdf(filePath) {
  let imagePaths = [];
  try {
    console.log('Starting text extraction for:', filePath);
    const pdfBuffer = await fs.readFile(filePath);
    console.log('PDF Buffer Size:', pdfBuffer.length);

    // Try pdf-parse first
    const pdfData = await pdfParse(pdfBuffer);
    console.log('pdf-parse Text Length:', pdfData.text.length, 'Text:', pdfData.text.slice(0, 100));

    if (pdfData.text.trim().length > 10) {
      console.log('Sufficient text extracted via pdf-parse');
      return pdfData.text;
    }

    // Convert PDF to images for OCR
    console.log('Insufficient text from pdf-parse. Converting PDF to images...');
    const convert = fromPath(filePath, {
      density: 200, // Higher DPI for better OCR
      saveFilename: 'page',
      savePath: './uploads',
      format: 'png',
      width: 1000,
      height: 1414, // A4 size at 200 DPI
    });

    const pdfInfo = await pdfParse(pdfBuffer);
    const numPages = pdfInfo.numpages;
    console.log('Number of pages:', numPages);

    let fullText = '';
    for (let page = 1; page <= numPages; page++) {
      let pageOutput;
      try {
        pageOutput = await convert(page);
        console.log(`Conversion result for page ${page}:`, pageOutput);
      } catch (convertError) {
        console.error(`PDF to image conversion failed for page ${page}:`, convertError.message);
        continue; // Skip this page and try the next
      }

      if (!pageOutput || !pageOutput.path) {
        console.error(`No image path returned for page ${page}`);
        continue;
      }

      const imagePath = pageOutput.path;
      imagePaths.push(imagePath);
      console.log(`Converted page ${page} to image:`, imagePath);

      // Verify image exists
      await fs.access(imagePath);
      console.log(`Image file verified for page ${page}:`, imagePath);

      // Perform OCR on the image
      let ocrResult;
      try {
        ocrResult = await Tesseract.recognize(imagePath, 'eng+hin', { // Add Hindi for "मेरा आधार, मेरी पहचान"
          logger: m => console.log(`Tesseract Progress (Page ${page}):`, m),
          timeout: 60000,
        });
        console.log(`OCR Completed for page ${page}. Extracted Text:`, ocrResult.data.text.slice(0, 100));
        fullText += ocrResult.data.text + '\n';
      } catch (ocrError) {
        console.error(`OCR processing failed for page ${page}:`, ocrError.message);
        fullText += `OCR failed for page ${page}: ${ocrError.message}\n`;
      }
    }

    if (!fullText.trim()) {
      console.error('No text extracted from any page');
      return 'No text extracted from PDF';
    }

    console.log('Final Extracted Text:', fullText.slice(0, 100));
    return fullText;
  } catch (error) {
    console.error('Text Extraction Failed:', error.stack);
    return 'No text extracted (general error: ' + error.message + ')';
  } finally {
    for (const imagePath of imagePaths) {
      await fs.unlink(imagePath).catch(err => console.error('Error deleting image:', err.message));
    }
  }
}

// Aadhaar verification endpoint
app.post('/verify-aadhaar', upload.single('file'), async (req, res) => {
  let filePath;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { aadhaarNumber } = req.body;
    if (!aadhaarNumber || !/^\d{12}$/.test(aadhaarNumber)) {
      return res.status(400).json({ error: 'Invalid Aadhaar number. Must be 12 digits.' });
    }

    filePath = req.file.path;
    console.log('Processing file:', req.file.originalname);

    const extractedText = await extractTextFromPdf(filePath);
    console.log('Final Extracted Text:', extractedText.slice(0, 200));

    if (!extractedText || extractedText.includes('No text extracted')) {
      return res.status(500).json({ error: 'Failed to extract text from PDF', extractedText });
    }

    const normalizedText = extractedText.replace(/\s+/g, '');
    const isMatch = normalizedText.includes(aadhaarNumber);

    console.log('Aadhaar Number:', aadhaarNumber);
    console.log('Normalized Extracted Text:', normalizedText.slice(0, 200));
    console.log('Match Found:', isMatch);

    res.json({
      status: isMatch ? 'Valid Aadhaar' : 'Aadhaar Mismatch',
      confidence: isMatch ? 100 : 0,
      extractedText: extractedText,
    });
  } catch (error) {
    console.error('Error processing PDF:', error.message);
    res.status(500).json({ error: 'Error processing PDF: ' + error.message });
  } finally {
    if (filePath) {
      await fs.unlink(filePath).catch(err => console.error('Error deleting file:', err.message));
    }
  }
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Aadhaar Verification Server running on http://0.0.0.0:${PORT}`);
});
