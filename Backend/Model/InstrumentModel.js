import mongoose from "mongoose";

const InstrumentSchema = new mongoose.Schema({
  instrument_token: { type: String, index: true },
  exchange_token: { type: String, index: true },
  tradingsymbol: { type: String, index: true },
  name: { type: String },
  last_price: { type: Number },
  expiry: { type: Date },
  strike: { type: Number },
  tick_size: { type: Number },
  lot_size: { type: Number },
  instrument_type: { type: String },
  segment: { type: String },
  exchange: { type: String },
  canon_key: { type: String, unique: true }
}, { timestamps: true });

InstrumentSchema.index({ exchange: 1, tradingsymbol: 1 }, { unique: true });

const Instrument = mongoose.model("Instrument", InstrumentSchema, "instruments");
export default Instrument;