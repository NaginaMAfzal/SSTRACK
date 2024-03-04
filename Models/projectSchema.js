import mongoose from 'mongoose';

const ProjectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: false
    },
    userId: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',

    }],
    allowedEmployees: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    isArchived: {
        type: Boolean,
        default: false
    },
    managerId: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
});

export default mongoose.model('Project', ProjectSchema);