import express from 'express';
import ListModel from '../Model/List.js';
import { protect } from '../Middleware/authMiddleware.js';
const router = express.Router();

router.get('/allLists', protect ,async(req, res)=>{
    try{
        const allList = await ListModel.find({});
        res.json(allList);

    }catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  };
});

export default router;

//find stock as search

router.get("/getStock", verifyToken, async (req, res) => {
  try {
    const { name } = req.query;
    const trimmedName = name.trim();
    const stocks = await ListModel.find({
      name: { $regex: trimmedName, $options: "i" }
    });

    if (!stocks.length) {
      return res.status(409).json({ message: "stock not found", success: false });
    }

    res.json(stocks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

