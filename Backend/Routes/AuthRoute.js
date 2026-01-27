// routes/Auth.js
import express from 'express';
import multer from 'multer';
import { handleUserLogin, handleLogout } from '../Controllers/AuthController.js';
import { getBrokers, addBroker } from '../Controllers/SuperBrocker.js';
// getBrokerCustomers को CustomerController.js से इम्पोर्ट करें
import { 
  getBrokerCustomers, 
  addCustomer, 
  deleteCustomer,
  getDeletedCustomers,
  restoreCustomer,
  permanentDeleteCustomer,
  uploadProfilePhoto,
  getCustomerDetails
} from '../Controllers/CustomerController.js';
// IMPORTANT: JWT verification ke liye
import { protect } from '../Middleware/authMiddleware.js';

const router = express.Router();

// Configure multer for profile photo upload
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
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
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max for profile photos
});

// --- PUBLIC ROUTES ---
router.post('/login', handleUserLogin); 
router.post('/logout', handleLogout);
router.post('/add-broker', addBroker); 
router.get('/get-all-brocker', getBrokers);

// --- PROTECTED ROUTES ---
router.post('/addCustomer', protect, addCustomer); 
router.get('/getCustomers', protect, getBrokerCustomers);
router.delete('/deleteCustomer/:id', protect, deleteCustomer);

// --- CUSTOMER PROFILE ROUTES ---
router.get('/customer/:customerId', protect, getCustomerDetails);
router.put('/customer/:customerId/profile-photo', protect, upload.single('profilePhoto'), uploadProfilePhoto);

// --- RECYCLE BIN ROUTES ---
router.get('/deleted-customers', protect, getDeletedCustomers);
router.post('/restore-customer/:id', protect, restoreCustomer);
router.delete('/permanent-delete/:id', protect, permanentDeleteCustomer);

export default router;

                                                    
