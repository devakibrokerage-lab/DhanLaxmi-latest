import { postOrder, getOrderInstrument, updateOrder, exitAllOpenOrder, deleteOrder, deleteAllClosedOrders } from '../Controllers/orderController.js';
import express from "express";

const router = express.Router();

router.post('/postOrder', postOrder);
router.get('/getOrderInstrument', getOrderInstrument);
router.post('/updateOrder', updateOrder);
router.put('/exitAllOpenOrder', exitAllOpenOrder);

// Delete Routes
router.post('/deleteOrder', deleteOrder);
router.post('/deleteAllClosedOrders', deleteAllClosedOrders);

export default router;