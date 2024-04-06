import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema({
    startTime: {
        type: Date,
    },
    location: {
        type: String, // Corrected field type
    },
    longitude: {
        type: String,
    },
    latitude: {
        type: String,
    },
    endTime: {
        type: Date,
    },
}, { timestamps: true });

const locationEntrySchema = new mongoose.Schema({
    startTime: {
        type: Date,
    },
    endTime: {
        type: Date,
    },
    locations: [locationSchema],
});

const trackerSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId, // Corrected field type
        ref: 'User', // Assuming User model reference
    },
    locationEntries: [locationEntrySchema],
}, { timestamps: true });


export default mongoose.model('Tracker', trackerSchema);