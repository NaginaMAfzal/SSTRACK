import mongoose from 'mongoose';

const OwnerSchema = new mongoose.Schema({
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
        default: 'system Admin',
    },

}, {
    timestamps: true,
}, );

export default mongoose.model('Owner', OwnerSchema);