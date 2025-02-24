const user = require('../../models/userSchema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');



const pageerror = async (req,res) => {
    res.render("admin-error");
}


const loadLogin = (req,res) => {

    if(req.session.admin){
        return res.redirect("/admin/dashboard");
    }
    res.render("adminlogin",{message:null});
}

const login = async (req,res) => {
    try {

        const {email,password} = req.body;
        console.log(req.body)
        const admin = await user.findOne({email,isAdmin:true});
        if(admin){
            const passwordMarch = bcrypt.compare(password,admin.password);
            if(passwordMarch) {
                req.session.admin = true;
                return res.redirect("/admin")
            } else {
                return res.redirect("/login");
            }
        }else {
            return res.redirect("/login")
        }
        
    } catch (error) {
        console.log("login error",error);
        return res.redirect("/pageerror"); 
        
    }
}

const loadDashboard = async(req,res) => {
    if(req.session.admin) {
        try {

            res.render("dashboard");

        } catch (error) {

            res.redirect("/pageerror");
            
        }
    }
}

const logout = async (req,res) => {
    console.log("Admin logout - function invoked");
    try {
        req.session.destroy(err => {
            if(err){
                console.log("Error destroying the session",err);
                return res.redirect("/pageerror");
            }
            res.redirect("/admin/login");
        })
    } catch (error) {
        console.log(("Unexpected error occured during logout",error));
        res.redirect("/pageerror");
    }
}
 

module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout
}