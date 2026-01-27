import Instrument from '../Model/InstrumentModel.js';

// ✅ Controller Function
const getStockName = async (req, res) => {
  try {
    const instruments = await Instrument.find(
      { segment: { $in: ["NSE_FNO", "MCX_COMM"] } }, // only F&O and Commodities
      { tradingsymbol: 1, _id: 0 }
    ).lean();

    const names = instruments.map(inst => inst.tradingsymbol).filter(Boolean);
    res.json({ count: names.length, names });
  } catch (err) {
    console.error('Error fetching instruments list:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getAllStockNames = async (req, res) => {
  try {
    const instruments = await Instrument.find(
      {},
      { tradingsymbol: 1, _id: 0 }
    ).lean();

    const names = instruments.map(inst => inst.tradingsymbol).filter(Boolean);
    res.json({ count: names.length, names });
  } catch (err) {
    console.error('Error fetching all instruments list:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export { getStockName, getAllStockNames };






