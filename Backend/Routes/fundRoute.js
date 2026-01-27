import express from 'express';
import { updateNetAvailableBalance, getFunds, updateIntradayAvailabeLimit , updateOvernightAvailableLimit, updateBrokerMobile, updateOptionLimitPercentage} from '../Controllers/fundController.js';

const router = express.Router();

router.put('/updateNetAvailableBalance', updateNetAvailableBalance);
router.get('/getFunds', getFunds);
router.put('/updateIntradayAvailableLimit', updateIntradayAvailabeLimit);
router.put('/updateOvernightAvailableLimit', updateOvernightAvailableLimit);
router.put('/updateBrokerMobile', updateBrokerMobile);
router.put('/updateOptionLimitPercentage', updateOptionLimitPercentage);

export default router;