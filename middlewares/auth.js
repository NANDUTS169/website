const User = require("../models/userSchema");


const userAuth = (req, res, next) => {
    if (req.session.user) {
        User.findById(req.session.user)
            .then(data => {
                if (data && !data.isBlocked) {
                    next();
                } else {
                    req.session.destroy((err) => {
                        if (err) {
                            console.log("Session destruction error", err.message);
                            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                                return res.status(500).json({ error: "Internal Server Error" });
                            }
                            return res.redirect("/pageNotFound")
                        }
                        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                            return res.status(401).json({ error: "Unauthorized. Please login" });
                        }
                        return res.redirect("/login");
                    })
                }
            })
            .catch(error => {
                console.log("Error in user auth middleware", error);
                if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                    return res.status(500).json({ error: "Internal Server Error" });
                }
                res.status(500).send("Internal Server Error");
            })
    } else {
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(401).json({ error: "Unauthorized. Please login" });
        }
        res.redirect("/login");
    }
}

const adminAuth = (req, res, next) => {
    if (req.session.admin) {
        User.findById(req.session.admin)
            .then(data => {
                if (data && data.isAdmin) {
                    next();
                } else {
                    req.session.destroy((err) => {
                        if (err) console.log("Error destroying session in adminAuth", err);
                        res.redirect("/admin/login")
                    });
                }
            })
            .catch(error => {
                console.log("Error in adminauth middleware", error);
                res.status(500).send("Internal Server Error");
            })
    } else {
        res.redirect("/admin/login");
    }
}

module.exports = {
    userAuth,
    adminAuth,
}