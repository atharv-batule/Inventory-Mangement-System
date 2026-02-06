import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { DB_NAME } from '../constants.js'; // Adjust path if needed

// Import your invoice model
import Invoice from '../src/invoice.model.js';

dotenv.config();

const cleanup = async () => {
  try {
    // Connect to database
    await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`);
    console.log('✅ Connected to MongoDB');
    
    console.log('🧹 Starting cleanup...');
    
    // Remove invoices with null invoiceId
    const deleteResult = await Invoice.deleteMany({ invoiceId: null });
    console.log(`✅ Deleted ${deleteResult.deletedCount} invoices with null invoiceId`);
    
    // Drop the wrong index (invoiceNumber_1)
    try {
      await Invoice.collection.dropIndex('invoiceNumber_1');
      console.log('✅ Dropped wrong index: invoiceNumber_1');
    } catch (error) {
      console.log('ℹ️  Index invoiceNumber_1 does not exist (this is fine)');
    }
    
    // Check current indexes
    const indexes = await Invoice.collection.getIndexes();
    console.log('\n📋 Current indexes:');
    console.log(JSON.stringify(indexes, null, 2));
    
    console.log('\n✅ Cleanup completed successfully!');
    await mongoose.connection.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

cleanup();