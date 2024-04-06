import mongoose from 'mongoose';

const updationSchema = new mongoose.Schema({
    version: {
        type: String,
        required: true,
    },
    url: {
        type: String,
    },


}, {
    timestamps: true,
}, );

export default mongoose.model('updationSchema', updationSchema);