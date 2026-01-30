import express from 'express';
import { 
    deleteBroker, 
    getDeletedBrokers, 
    restoreBroker, 
    permanentDeleteBroker 
} from '../Controllers/SuperBrocker.js';

const router = express.Router();

// Delete a broker (Move to Recycle Bin)
router.delete('/delete-broker/:id', deleteBroker);

// Get list of deleted brokers
router.get('/deleted-brokers', getDeletedBrokers);

// Restore a broker (and their customers)
router.post('/restore-broker/:id', restoreBroker);

// Permanently delete a broker
router.delete('/permanent-delete/:id', permanentDeleteBroker);

export default router;
