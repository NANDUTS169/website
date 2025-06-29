const User = require("../models/userSchema");


const userAuth = (req, res, next) => {
    if (req.session.user) {
        User.findById(req.session.user)
            .then(data => {
                if (data && !data.isBlocked) {
                    next();
                } else {
                    console.log("Redirecting...")
                    req.session.destroy((err) => {
                        if (err) {
                            console.log("Session destruction error", err.message);
                            return res.redirect("/pageNotFound")
                        }
                        return res.redirect("/login");
                    })
                }
            })
            .catch(error => {
                console.log("Error in user auth middleware");
                res.status(500).send("Internal Server Error");
            })
    } else {
        res.redirect("/login");
    }
}

const adminAuth = (req, res, next) => {
    User.findOne({ isAdmin: true })
        .then(data => {
            if (data) {
                next();
            } else {
                res.redirect("/admin/login")
            }
        })
        .catch(error => {
            console.log("Error in adminauth middleware", error);
            res.status(500).send("Internal Server Error");
        })
}

module.exports = {
    userAuth,
    adminAuth,
}