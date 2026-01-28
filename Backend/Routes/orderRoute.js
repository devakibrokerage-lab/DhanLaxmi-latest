import { getOrderInstrument, postOrder, updateOrder, exitAllOpenOrder, deleteOrder, deleteAllClosedOrders, updateClosedOrderPrices } from '../Controllers/orderController.js';
import express from "express";

const router = express.Router();

router.post('/postOrder', postOrder);
router.get('/getOrderInstrument', getOrderInstrument);
router.post('/updateOrder', updateOrder);
router.put('/exitAllOpenOrder', exitAllOpenOrder);

// Delete Routes
router.post('/deleteOrder', deleteOrder);
router.post('/deleteAllClosedOrders', deleteAllClosedOrders);

// Update Closed Order Prices (Safe Manual Edit)
router.post('/updateClosedOrderPrices', updateClosedOrderPrices);

export default router;