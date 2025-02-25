const User = require("../../models/userSchema");

const customerInfo = async (req, res) => {
    console.log("CustomerInfo invoked");
    try {
        console.log("Entered try-catch block");

        let search = req.query.search || "";
        console.log("Search Query:", search);

        let page = parseInt(req.query.page, 10) || 1;
        console.log("Page:", page);

        const limit = 5;

        const userData = await User.find({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } },
            ],
        })
        .limit(limit)
        .skip((page - 1) * limit)
        .exec();

        console.log("User Data:", userData);

        const count = await User.countDocuments({
            isAdmin: false,
            $or: [
                { name: { $regex: ".*" + search + ".*", $options: "i" } },
                { email: { $regex: ".*" + search + ".*", $options: "i" } },
            ],
        });

        const totalUsers = await User.countDocuments();
  
        let totalPages = Math.ceil(totalUsers / limit);

        console.log("Total Count:", count);

        res.render("customers", { users: userData,totalPages, totalUsers: count, currentPage: page });

    } catch (error) {
        console.error("Error in customerInfo:", error);
        res.status(500).send("Internal Server Error");
    }
};

const customerBlocked = async (req,res) => {
    try {
        let id = req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:true}});
        res.redirect("/admin/users")

    } catch (error) {
        res.redirect("/pageerror")
    }
};

const customerunBlocked = async (req,res) => {
    try {
        let id = req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:false}});
        res.redirect("/admin/users");

    } catch (error) {
        res.redirect("/pageerror");
    }
}
 

module.exports = {
    customerInfo,
    customerBlocked,
    customerunBlocked,
}
