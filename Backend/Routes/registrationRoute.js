// Routes/registrationRoute.js
// Registration API routes

import express from 'express';
import multer from 'multer';
import { 
  submitRegistration,
  getAllRegistrations,
  getRegistrationById,
  updateRegistrationStatus,
  getRegistrationStats,
  deleteRegistration,
} from '../Controllers/RegistrationController.js';
import { protect } from '../Middleware/authMiddleware.js';

const router = express.Router();

// Configure multer for memory storage (files stored in buffer)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Accept only images
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG and PNG images are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max per file
  },
});

// Define expected file fields
const uploadFields = upload.fields([
  { name: 'aadhaarFront', maxCount: 1 },
  { name: 'aadhaarBack', maxCount: 1 },
  { name: 'panCard', maxCount: 1 },
  { name: 'passportPhoto', maxCount: 1 },
]);

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB per file.',
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`,
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  next();
};

// ===== PUBLIC ROUTES =====
// POST /api/registration/submit - Submit new registration
router.post('/submit', uploadFields, handleMulterError, submitRegistration);

// ===== PROTECTED ROUTES (Super Broker/Admin only) =====
// GET /api/registration/stats - Get registration statistics
router.get('/stats', protect, getRegistrationStats);

// GET /api/registration/all - Get all registrations
router.get('/all', protect, getAllRegistrations);

// GET /api/registration/:id - Get single registration
router.get('/:id', protect, getRegistrationById);

// PATCH /api/registration/:id/status - Update status (approve/reject)
router.patch('/:id/status', protect, updateRegistrationStatus);

// DELETE /api/registration/:id - Delete a registration
router.delete('/:id', protect, deleteRegistration);

export default router;
