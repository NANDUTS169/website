const Address = require('../../models/addressSchema');
const User = require('../../models/userSchema');


const addAddress = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const userId = req.session.user;
        const { addressType, fullName, streetAddress, city, state, pincode, country, phone, defaultAddress } = req.body;

        // basic validation
        if (!fullName || !streetAddress || !city || !state || !pincode || !country || !phone) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }

        let addressDoc = await Address.findOne({ UserId: userId });

        if (!addressDoc) {
            // first address
            addressDoc = new Address({
                UserId: userId,
                address: [{
                    addressType,
                    fullName,
                    streetAddress,
                    city,
                    state,
                    pincode,
                    country,
                    phone,
                    defaultAddress: true
                }]
            });
        } else {
            if (defaultAddress) {
                // unset all others
                addressDoc.address.forEach(addr => addr.defaultAddress = false);
            }

            addressDoc.address.push({
                addressType,
                fullName,
                streetAddress,
                city,
                state,
                pincode,
                country,
                phone,
                defaultAddress: !!defaultAddress
            });
        }

        await addressDoc.save();

        return res.status(200).json({
            success: true,
            message: "Address added successfully",
            addresses: addressDoc.address
        });
    } catch (error) {
        console.error("❌ Error adding address:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};


const updateAddress = async (req, res) => {
    
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const userId = req.session.user;
        const addressId = req.params.addressId; // use _id of subdocument
        const { addressType, fullName, streetAddress, city, state, pincode, country, phone, defaultAddress } = req.body;

        console.log(req.body);

        const userAddress = await Address.findOne({ UserId: userId });

        if (!userAddress) {
            console.log("Address Not Found");
            return res.status(404).json({ success: false, message: "No addresses found" });
        }

        const address = userAddress.address.id(addressId);
        if (!address) {
            console.log("Address Id Not Found");
            return res.status(404).json({ success: false, message: "Address not found" });
        }

        if (defaultAddress) {
            userAddress.address.forEach(addr => addr.defaultAddress = false);
        }

        address.addressType = addressType;
        address.fullName = fullName;
        address.streetAddress = streetAddress;
        address.city = city;
        address.state = state;
        address.pincode = pincode;
        address.country = country;
        address.phone = phone;
        address.defaultAddress = defaultAddress || false;

        await userAddress.save();

        let addressDoc = await Address.findOne({ UserId: userId });


        // res.json({ success: true, message: "Address updated successfully" });
        res.status(200).json({ success: true, message: "Address updated successfully",addresses:addressDoc.address });

    } catch (error) {
        console.error("❌ editAddress Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};


const deleteAddress = async (req, res) => {
    try {
        const { addressId } = req.params;
        const userId = req.session.user;

        // Find the address document for the logged-in user
        const addressDoc = await Address.findOne({ UserId: userId });
        if (!addressDoc) return res.status(404).json({ success: false, message: "Address not found" });

        // Find the specific address inside the array
        const addrIndex = addressDoc.address.findIndex(a => a._id.toString() === addressId);
        if (addrIndex === -1) return res.status(404).json({ success: false, message: "Address not found" });

        // Soft delete by setting isActive to false
        addressDoc.address[addrIndex].isActive = false;
        await addressDoc.save();

        const addresses = await Address.findOne({UserId:userId})

        return res.json({ success: true, message: "Address deleted successfully",addresses:addresses.address });
    } catch (error) {
        console.error("Delete Address Error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

module.exports = {
    addAddress,
    updateAddress,
    deleteAddress
};
