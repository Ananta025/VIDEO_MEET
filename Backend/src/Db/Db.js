import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const connectDb = async () => {
    // Check if MONGO_URL is set to a non-empty value (matching .env variable name)
    const mongoUri = process.env.MONGO_URL;
    if (!mongoUri) {
        console.log('MongoDB URI not provided. Running in memory-only mode.');
        return false;
    }
    
    try {
        // Remove deprecated options
        await mongoose.connect(mongoUri);
        console.log('MongoDB connected successfully');
        return true;
    } catch (err) {
        console.error('MongoDB connection error:', err.message);
        // Continue with application even if MongoDB fails
        console.log('Continuing without database connection...');
        return false;
    }
}

export default connectDb;