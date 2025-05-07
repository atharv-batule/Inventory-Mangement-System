import mongoose from 'mongoose'

const vendorSchema = new mongoose.Schema({
  vendorId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String },
  contact: { type: String },
  gstId: { type: String }
});

const Vendor = mongoose.model('Vendor', vendorSchema);
export default Vendor