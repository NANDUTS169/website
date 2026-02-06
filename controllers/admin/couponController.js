const Coupon = require("../../models/couponSchema");
const mongoose = require("mongoose");

const loadCoupon = async (req, res) => {
    try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 6;

        const query = {
            name: { $regex: search, $options: "i" }
        };

        const findCoupons = await Coupon.find(query)
            .sort({ createdOn: -1 })
            .limit(limit)
            .skip((page - 1) * limit);

        const count = await Coupon.find(query).countDocuments();

        res.render("coupon", {
            coupons: findCoupons,
            search: search,
            currentPage: page,
            totalPages: Math.ceil(count / limit)
        });
    } catch (error) {
        console.log(error);
        res.redirect("/admin/pageerror");
    }
};

const createCoupon = async (req, res) => {
    try {
        const data = {
            couponName: req.body.couponName,
            startDate: new Date(req.body.startDate + "T00:00:00"),
            endDate: new Date(req.body.endDate + "T00:00:00"),
            offerPrice: parseInt(req.body.offerPrice),
            minimumPrice: parseInt(req.body.minimumPrice)
        };

        const newCoupon = new Coupon({
            name: data.couponName,
            createdOn: data.startDate,
            expireOn: data.endDate,
            offerPrice: data.offerPrice,
            minimumPrice: data.minimumPrice
        });

        await newCoupon.save();
        return res.status(200).send("Coupon created successfully");
    } catch (error) {
        console.log(error);
        res.status(500).send("Internal Server Error");
    }
};

const addCoupon = async (req, res) => {
    try {
        const { couponName, startDate, endDate, offerPrice, minimumPrice } = req.body;

        const isExists = await Coupon.findOne({ name: couponName });

        if (isExists) {
            return res.status(400).json({ error: "Coupon already exists" });
        }

        if (offerPrice < 1 || offerPrice > 100) {
            return res.status(400).json({ error: "Offer percentage must be between 1 and 100" });
        }

        const newCoupon = new Coupon({
            name: couponName,
            createdOn: new Date(startDate),
            expireOn: new Date(endDate),
            offerPrice: offerPrice,
            minimumPrice: minimumPrice
        });

        await newCoupon.save();
        return res.status(200).json({ message: "Coupon created successfully" });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

const deleteCoupon = async (req, res) => {
    try {
        const id = req.query.id;
        await Coupon.deleteOne({ _id: id });
        res.status(200).send("Coupon deleted successfully");
    } catch (error) {
        console.log(error);
        res.status(500).send("Internal Server Error");
    }
};

const editCouponStatus = async (req, res) => {
    try {
        const id = req.query.id;
        const coupon = await Coupon.findOne({ _id: id });
        if (coupon) {
            coupon.isList = !coupon.isList;
            await coupon.save();
            res.status(200).send("Coupon status updated");
        } else {
            res.status(404).send("Coupon not found");
        }
    } catch (error) {
        console.log(error);
        res.status(500).send("Internal Server Error");
    }
};

module.exports = {
    loadCoupon,
    addCoupon,
    deleteCoupon,
    editCouponStatus
};
