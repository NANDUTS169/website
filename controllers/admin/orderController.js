const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Address = require("../../models/addressSchema");

const getOrderList = async (req,res) => {
    try {
        res.render("orders");
    } catch (error) {
        console.log("Error loading orders page:",error);
        res.redirect("/pageerror");  
    }
}

module.exports = {
    getOrderList,
}
