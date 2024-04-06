import mongoose from 'mongoose';

const SystemAdmin = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    password: {
        type: String,
    },
    email: {
        type: String,
    },
    userType: {
        type: String,
        default: 'owner',
    },

}, {
    timestamps: true,
}, );

export default mongoose.model('SystemAdmin', SystemAdmin);