const { CancellationToken } = require('mongodb')
const mongoose = require('mongoose')
const {Schema} = mongoose

const cartSchema = new Schema ({
    userId: {
        type: Schema.Types.ObjectIdId,
        ref: "User",
        required: true
    },
    items: [{
        productId: {
            type: Schema.Types.ObjeectId,
            required: true,
            ref: "Product"
        },
        quantity: {
            type: Number,
            default: 1
        },
        price: {
            type: Number,
            required: true
        },
        totalPrice: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            default: "placed"
        },
        CancellationReason: {
            type: String,
            default: "none"
        }
    }]
})

const Cart = mongoose.model("Cart",cartSchema)

module.exports = {
    Cart,
}