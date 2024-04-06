/* eslint-disable func-names */
import mongoose from 'mongoose';

const { Schema } = mongoose;

const BillingInfoSchema = new mongoose.Schema({
    ratePerHour: { type: Number, default: 1 },
    currency: { type: String, default: 'USD' },

});

const userSchema = new mongoose.Schema({
    name: {
        type: String,
    },
    company: {
        type: String,
    },
    password: {
        type: String,
    },
    email: {
        type: String,
    },
    verification:
    {
        type: String,
        default:'null'
    },
    userType: {
        type: String,
        default: 'user',
    },
    groupId: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',

    }],
    projectId: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',

    }],
    isActive: { type: Boolean, default: false },
    lastActive: { type: Date, default: Date.now },
    billingInfo: BillingInfoSchema,
    isArchived: {
        type: Boolean,
        default: false,
    },
    employeeSettings: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EffectiveSettings'

           },


    assignedUsers: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],

    assignedGroups: [{
        type: Schema.Types.ObjectId,
        ref: 'Group'
    }],
    managerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    timezone: {
        type: String,
        default: ''
    },
    timezoneOffset: {
        type: String
    },
    gLink:{
        type:String
    },
    expirationTimestamp : {
        type: String
    },
    otpTime : {
        type: String
    },
    inviteStatus: {
        type: Boolean,
        default: false,
    },

}, {
    timestamps: true,
}, );


userSchema.pre('save', function(next) {
    this.company = this.company.toLowerCase(); // Normalize the company name to lowercase
    next();
});

export default mongoose.model('User', userSchema);