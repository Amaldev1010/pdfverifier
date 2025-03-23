const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors()); // Allow cross-origin requests
app.use(express.json()); // Parse JSON bodies

// Mock database of valid Aadhaar numbers (for demo purposes)
const validAadhaarNumbers = ['123456789012', '987654321098'];

// Aadhaar format validation (12 digits)
const validateAadhaarFormat = (aadhaar) => {
  const aadhaarRegex = /^\d{12}$/;
  return aadhaarRegex.test(aadhaar);
};

// POST endpoint for Aadhaar verification
app.post('/verify-aadhaar', (req, res) => {
  const { aadhaar } = req.body;

  if (!aadhaar || !validateAadhaarFormat(aadhaar)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid Aadhaar number format. Must be 12 digits.',
    });
  }

  // Simulate verification (replace with real API call in production)
  const isValid = validAadhaarNumbers.includes(aadhaar);

  if (isValid) {
    res.json({
      success: true,
      message: 'Aadhaar verified successfully',
    });
  } else {
    res.status(400).json({
      success: false,
      message: 'Aadhaar number not found or invalid.',
    });
  }
});

// Start the server on the Render-assigned port or default to 5000 locally
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
