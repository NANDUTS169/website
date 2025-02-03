const user = require('../../models/userSchema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const loadLogin = (req,res) => {
    
    if(req.session.admin){
        console.log("admin login function invoked...");
        return res.redirect("/admin/dashboard");
    }
    res.render("adminlogin",{message:null});
}



module.exports = {

    loadLogin,
    
}