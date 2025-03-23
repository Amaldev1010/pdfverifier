const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

const validAadhaarNumbers = ['123456789012', '987654321098'];

const validateAadhaarFormat = (aadhaar) => {
  const aadhaarRegex = /^\d{12}$/;
  return aadhaarRegex.test(aadhaar);
};

app.post('/verify-aadhaar', (req, res) => {
  const { aadhaar } = req.body;
  if (!aadhaar || !validateAadhaarFormat(aadhaar)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid Aadhaar number format. Must be 12 digits.',
    });
  }
  const isValid = validAadhaarNumbers.includes(aadhaar);
  if (isValid) {
    res.json({ success: true, message: 'Aadhaar verified successfully' });
  } else {
    res.status(400).json({
      success: false,
      message: 'Aadhaar number not found or invalid.',
    });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
