const mongoose = require('mongoose');
const { Schema } = mongoose;

const addressSchema = new Schema({
    UserId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    address: [{
        addressType: {
            type: String,
            enum: ["home", "work", "other"],
            required: true
        },
        fullName: {
            type: String,
            required: true
        },
        streetAddress: {
            type: String,
            required: true
        },
        city: {
            type: String,
            required: true
        },
        state: {
            type: String,
            required: true
        },
        pincode: {
            type: String, // keeping as string to support leading 0s
            required: true
        },
        country: {
            type: String,
            required: true
        },
        phone: {
            type: String,
            required: true
        },
        defaultAddress: {
            type: Boolean,
            default: false
        },
        isActive: {
            type: Boolean,
            default: true
        }
    }]
});

const Address = mongoose.model("address", addressSchema);
module.exports = Address;
