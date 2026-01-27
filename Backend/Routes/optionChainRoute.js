import express from 'express';
import { getOptionChain, getExpiryList, getOptionSecurityId } from '../Controllers/optionChainController.js';

const router = express.Router();

// Get option chain for an underlying
router.get('/option-chain', getOptionChain);

// Get list of available expiries for an underlying
router.get('/option-chain/expiries', getExpiryList);

// Lookup security ID for an option contract
router.get('/option-chain/security-id', getOptionSecurityId);

export default router;
