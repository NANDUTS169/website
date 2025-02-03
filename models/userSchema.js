const { name } = require('ejs');
const mongoose = require('mongoose');
// const { search } = require('../app');
const {Schema} = mongoose;

const userSchema = new Schema ({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },
    password: {
        type: String,
        required: function() {
            return !this.googleId; //required only if google id is not present 
        }
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    cart: [{
        type: Schema.Types.ObjectId,
        ref: "Cart",
    }],
    wallet: {
        type: Number,
        default : 0
    },
    Wishlist: [{
        type: Schema.Types.ObjectId,
        ref: "Wishlist"
    }],
    orderHistory: [{
        type: Schema.Types.ObjectId,
        ref: "Order"
    }],
    CreatedOn: {
        type: Date,
        default: Date.now,
    },
    referalCode: {
        type: String
    },
    redeemed: {
        type: Boolean
    },
    redeemedUsers: [{
        type: Schema.Types.ObjectId,
        ref: "User"
    }],
    searchHistory: [{
       category: {
        type: Schema.Types.ObjectId,
        ref: "Catagory"
       },
       brand: {
        type: String,
       },
       searchOn: {
        type: Date,
        default: Date.now
       }
    }]
})

const User = mongoose.model("User",userSchema)

module.exports = User;
