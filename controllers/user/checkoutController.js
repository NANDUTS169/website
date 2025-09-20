const user = require('../../models/userSchema');
const product = require('../../models/productSchema');
const address = require('../../models/addressSchema');
const cart = require('../../models/cartSchema');
const order = require('../../models/orderSchema');



const getcheckoutPage = async (req , res) => {
    console.log("get checkout page function invoked..");
    try {
        if(!req.session.user){
            return res.redirect('/login');
        }

        const userId = req.session.user;

        const addresses = await address.findOne({UserId: userId});
        console.log("Address",addresses)
        res.render("checkout",{addresses:addresses.address});
    } catch (error) {
        console.log("Error loading checkout page",error);
        res.redirect("/pageNotFound");
    }
}



module.exports = {
    getcheckoutPage,
}