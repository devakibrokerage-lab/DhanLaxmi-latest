// models/ListModel.js
import mongoose from 'mongoose';

const listSchema = new mongoose.Schema({
  name: String,
  price: Number,
  percent: String,
  isDown: Boolean,
});

const ListModel = mongoose.model('List', listSchema); // Use "List" as collection name

export default ListModel;
